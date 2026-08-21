/**
 * 🔒 C1 — CAS (compare-and-swap) · NÚCLEO PURO (decisão do autor "Escolha A", 2026-08-21).
 *
 * Arquitetura travada:
 *  - o MOTOR permanece puro — sem rede, relógio ou I/O (princípio 6, determinismo auditável);
 *  - o motor produz: o AGREGADO, o `canonicalInputHash` e o COMANDO DE COMMIT;
 *  - a camada de aplicação/repositório executa o compare-and-swap REAL (ver
 *    `lib/persistencia/plano-cas.ts`) e devolve o RESULTADO DISCRIMINADO ao chamador;
 *  - conflito exige recarregar o snapshot atual e RECOMPUTAR — nunca reaplicar agregado obsoleto,
 *    nunca entregar resultado obsoleto como certificado.
 *
 * Este arquivo é SÓ o núcleo puro: o hash canônico do input e a DECISÃO de pré-commit. A troca
 * atômica de fato (o UPDATE condicional) mora no repositório — aqui não há efeito colateral.
 *
 * Chave do commit: { aggregateId, expectedRevision, formulaVersion, canonicalInputHash }.
 */

/** Chave do compare-and-swap (o "expected" da troca atômica). */
export interface ChaveCommit {
  /** Identidade estável do agregado (ex.: `${userId}:plano`). */
  aggregateId: string;
  /** Revisão que o escritor LEU. A troca atômica só confirma se a atual ainda é esta. */
  expectedRevision: number;
  /** Versão da fórmula que PRODUZIU o agregado. Nunca se persiste certificação de motor obsoleto. */
  formulaVersion: string;
  /** Hash canônico do INPUT que gerou o agregado (determinístico, sem relógio/rede). */
  canonicalInputHash: string;
}

/** Comando de commit = chave + o agregado a persistir. */
export interface ComandoCommit<A = unknown> extends ChaveCommit {
  aggregate: A;
}

/** O que o repositório lê do snapshot atual (sem o payload — só o necessário à decisão). */
export interface SnapshotAtual {
  revision: number;
  formulaVersion: string;
  canonicalInputHash: string;
}

/** Resultado DISCRIMINADO devolvido ao chamador (os quatro estados da decisão do autor). */
export type ResultadoCommit<A = unknown> =
  | {
      tipo: 'COMMIT_CONFIRMADO';
      aggregateId: string;
      revision: number;
      formulaVersion: string;
      canonicalInputHash: string;
      aggregate: A;
    }
  | { tipo: 'CONFLITO_REVISAO'; revisaoEsperada: number; revisaoAtual: number }
  | { tipo: 'CONFLITO_VERSAO_OU_HASH'; motivo: 'VERSAO' | 'HASH'; esperado: string; recebido: string }
  | { tipo: 'FALHA_ATOMICA'; detalhe: string };

/** Pré-decisão pura (antes da troca atômica): ou prossegue, ou já é um conflito terminal. */
export type PreCommit =
  | { tipo: 'PROSSEGUIR'; proximaRevision: number }
  | Extract<ResultadoCommit, { tipo: 'CONFLITO_REVISAO' | 'CONFLITO_VERSAO_OU_HASH' }>;

/**
 * 🔒 Hash canônico determinístico (FNV-1a 64 bits, hex). Puro: mesma entrada → mesmo hash, sem
 * relógio, rede ou ordem de chaves ambígua (serialização com chaves ORDENADAS). Sustenta o
 * enquadramento legal (determinismo auditável) — o hash é o "certificado" de qual input gerou o plano.
 */
export function canonicalInputHash(input: unknown): string {
  const s = serializacaoCanonica(input);
  // FNV-1a 64-bit
  let h = 0xcbf29ce484222325n;
  const primo = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < s.length; i += 1) {
    h ^= BigInt(s.charCodeAt(i) & 0xff);
    // caracteres multibyte: mistura também o byte alto para não colidir por truncamento
    h = (h * primo) & mask;
    const alto = s.charCodeAt(i) >> 8;
    if (alto) {
      h ^= BigInt(alto);
      h = (h * primo) & mask;
    }
  }
  return h.toString(16).padStart(16, '0');
}

/** Serialização estável com chaves ordenadas (determinística). */
function serializacaoCanonica(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'undefined') return 'undefined';
  if (Array.isArray(v)) return `[${v.map(serializacaoCanonica).join(',')}]`;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const chaves = Object.keys(o).sort();
    return `{${chaves.map((k) => `${JSON.stringify(k)}:${serializacaoCanonica(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(String(v));
}

/**
 * 🔒 DECISÃO PURA de pré-commit. Precedência dos erros (fail-safe, do mais "nunca persista" ao
 * mais "tente de novo"):
 *
 *  1. CONFLITO_VERSAO_OU_HASH · VERSAO — o agregado foi produzido por uma `formulaVersion` que NÃO
 *     é a vigente. Nunca se persiste certificação de motor obsoleto, ainda que a revisão bata.
 *  2. CONFLITO_VERSAO_OU_HASH · HASH — o `canonicalInputHash` do comando é vazio/malformado (sem
 *     certificado de input não se persiste agregado).
 *  3. CONFLITO_REVISAO — a revisão atual ≠ `expectedRevision`: alguém confirmou no meio. O chamador
 *     recarrega o snapshot atual e RECOMPUTA (não reaplica o agregado obsoleto).
 *  4. PROSSEGUIR — segue para a troca ATÔMICA no repositório (que é a garantia final da corrida).
 *
 * A troca atômica ainda pode devolver CONFLITO_REVISAO (corrida entre a leitura e o commit) ou
 * FALHA_ATOMICA — por isso esta pré-decisão é otimização/porta, não a garantia única.
 */
export function decidirPreCommit(
  atual: SnapshotAtual | null,
  comando: ChaveCommit,
  formulaVersionVigente: string,
): PreCommit {
  if (comando.formulaVersion !== formulaVersionVigente) {
    return { tipo: 'CONFLITO_VERSAO_OU_HASH', motivo: 'VERSAO', esperado: formulaVersionVigente, recebido: comando.formulaVersion };
  }
  if (!hashBemFormado(comando.canonicalInputHash)) {
    return { tipo: 'CONFLITO_VERSAO_OU_HASH', motivo: 'HASH', esperado: 'hash canônico não-vazio', recebido: String(comando.canonicalInputHash) };
  }
  const revAtual = atual?.revision ?? 0;
  if (revAtual !== comando.expectedRevision) {
    return { tipo: 'CONFLITO_REVISAO', revisaoEsperada: comando.expectedRevision, revisaoAtual: revAtual };
  }
  return { tipo: 'PROSSEGUIR', proximaRevision: comando.expectedRevision + 1 };
}

function hashBemFormado(h: unknown): boolean {
  return typeof h === 'string' && /^[0-9a-f]{16}$/.test(h);
}
