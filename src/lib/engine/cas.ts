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
 * 🔒 Hash canônico determinístico SHA-256 (hex). A serialização ordena chaves antes de
 * converter para UTF-8; assim entradas semanticamente diferentes não compartilham a
 * assinatura por causa de unidades UTF-16. O hash é puro, síncrono e seguro para o
 * caminho comum browser + servidor.
 */
export function canonicalInputHash(input: unknown): string {
  return sha256Hex(serializacaoCanonica(input));
}

/** SHA-256 síncrono sobre UTF-8; evita I/O e API assíncrona no núcleo puro do motor. */
function sha256Hex(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  const bits = BigInt(bytes.length) * 8n;
  const tamanho = Math.ceil((bytes.length + 9) / 64) * 64;
  const dados = new Uint8Array(tamanho);
  dados.set(bytes);
  dados[bytes.length] = 0x80;
  for (let i = 0; i < 8; i += 1) {
    dados[tamanho - 1 - i] = Number((bits >> BigInt(i * 8)) & 0xffn);
  }

  let a0 = 0x6a09e667;
  let b0 = 0xbb67ae85;
  let c0 = 0x3c6ef372;
  let d0 = 0xa54ff53a;
  let e0 = 0x510e527f;
  let f0 = 0x9b05688c;
  let g0 = 0x1f83d9ab;
  let h0 = 0x5be0cd19;

  const palavras = new Uint32Array(64);
  for (let inicio = 0; inicio < dados.length; inicio += 64) {
    for (let i = 0; i < 16; i += 1) {
      const p = inicio + i * 4;
      palavras[i] = ((dados[p]! << 24) | (dados[p + 1]! << 16) | (dados[p + 2]! << 8) | dados[p + 3]!) >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const anterior15 = palavras[i - 15]!;
      const anterior2 = palavras[i - 2]!;
      const s0 = direita(anterior15, 7) ^ direita(anterior15, 18) ^ (anterior15 >>> 3);
      const s1 = direita(anterior2, 17) ^ direita(anterior2, 19) ^ (anterior2 >>> 10);
      palavras[i] = soma32(palavras[i - 16]!, s0, palavras[i - 7]!, s1);
    }

    let a = a0, b = b0, c = c0, d = d0, e = e0, f = f0, g = g0, h = h0;
    for (let i = 0; i < 64; i += 1) {
      const S1 = direita(e, 6) ^ direita(e, 11) ^ direita(e, 25);
      const escolha = (e & f) ^ (~e & g);
      const t1 = soma32(h, S1, escolha, SHA256_K[i]!, palavras[i]!);
      const S0 = direita(a, 2) ^ direita(a, 13) ^ direita(a, 22);
      const maioria = (a & b) ^ (a & c) ^ (b & c);
      const t2 = soma32(S0, maioria);
      h = g; g = f; f = e; e = soma32(d, t1);
      d = c; c = b; b = a; a = soma32(t1, t2);
    }
    a0 = soma32(a0, a); b0 = soma32(b0, b); c0 = soma32(c0, c); d0 = soma32(d0, d);
    e0 = soma32(e0, e); f0 = soma32(f0, f); g0 = soma32(g0, g); h0 = soma32(h0, h);
  }
  return [a0, b0, c0, d0, e0, f0, g0, h0].map((n) => n.toString(16).padStart(8, '0')).join('');
}

function direita(n: number, bits: number): number {
  return (n >>> bits) | (n << (32 - bits));
}
function soma32(...numeros: number[]): number {
  return numeros.reduce((soma, n) => (soma + n) >>> 0, 0);
}
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
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
  return typeof h === 'string' && /^[0-9a-f]{64}$/.test(h);
}
