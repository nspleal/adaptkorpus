/**
 * 🔒 C1 — DISTRIBUIÇÃO SEMANAL DE CARDIO · primitiva canônica única (spec §2, handoff §3).
 *
 * `construirDistribuicaoCardioSemana` é a ÚNICA construção; o gerador e o crítico/validador semanal
 * a compartilham. `validarDistribuicaoCardioSemana` CHAMA o construtor e compara EXATAMENTE a
 * distribuição/blocos observados — não duplica a lógica (§8.1, mutação "validar sem confrontar o
 * construtor").
 *
 * 🔴 Decisão do autor (2026-09-23): o tempo do perfil é o orçamento só da musculação. Cada
 * prescrição de cardio conserva a duração prescrita INTEIRA no seu dia de origem — também no dia
 * com musculação e também acima do tempo escolhido para o treino. Sem capacidade derivada desse
 * tempo não há saldo, nem redistribuição a outro dia, nem descarte. O único teto de cardio aprovado
 * é o por dia (`TETO_MIN_DIA_CARDIO`, DF 2026-08-01), aplicado na prescrição (`duracaoDoDiaDeCardio`).
 *
 * Ordem total canônica de linhagens: `{ordem_no_horizonte(dia_origem), ordem_prescricao,
 * prescricao_id}`. Consolidação: um único bloco por dia = soma das prescrições daquele dia.
 *
 * Puro/determinístico: sem rede/relógio/IO. O commit atômico (CAS) mora na camada de persistência.
 */
import { canonicalInputHash } from './cas';

const intSeguro = (n: number): boolean => Number.isSafeInteger(n);

// ── Entradas ───────────────────────────────────────────────────────────────────
export interface DiaHorizonte {
  diaId: string;
  /** Inteiro seguro `>= 0`, único no horizonte. */
  ordemNoHorizonte: number;
  /** O usuário ofereceu este dia para cardio? Prescrição só nasce em dia oferecido. */
  oferecido: boolean;
}

export interface PrescricaoCardioSemana {
  prescricaoId: string;
  diaOrigemId: string;
  ordemPrescricao: number;
  duracaoPrescritaSegundos: number;
}

export interface EntradaDistribuicaoSemana {
  aggregateId: string;
  expectedRevision: number;
  formulaVersion: string;
  diasHorizonte: readonly DiaHorizonte[];
  prescricoesCardio: readonly PrescricaoCardioSemana[];
}

// ── Saídas ───────────────────────────────────────────────────────────────────
export interface LinhagemParcela {
  prescricaoId: string;
  diaOrigemId: string;
  ordemPrescricao: number;
  segundos: number;
}

export interface BlocoCardioDia {
  diaId: string;
  duracaoTotalSegundos: number;
  /** Ordenadas por `{ordem_no_horizonte(dia_origem), ordem_prescricao, prescricao_id}`. */
  linhagens: LinhagemParcela[];
}

export type EstadoDistribuicao = 'CONSTRUIDA' | 'NAO_AVALIADA_ESTRUTURAL';

export interface DistribuicaoCardioSemanal {
  estado: EstadoDistribuicao;
  aggregateId: string;
  expectedRevision: number;
  formulaVersion: string;
  canonicalInputHash: string;
  blocosPorDia: BlocoCardioDia[];
  motivos: string[];
}

/** Chave de ordem total canônica (spec §2/§4). */
function chaveOrdem(ordemHorizonte: number, ordemPrescricao: number, prescricaoId: string): string {
  const pad = (n: number) => String(n).padStart(12, '0');
  return `${pad(ordemHorizonte)}|${pad(ordemPrescricao)}|${prescricaoId}`;
}

/** Projeção canônica das entradas para o hash (dias/prescrições ordenados). */
function projecaoCanonica(e: EntradaDistribuicaoSemana): unknown {
  return {
    aggregateId: e.aggregateId,
    expectedRevision: e.expectedRevision,
    formulaVersion: e.formulaVersion,
    dias: [...e.diasHorizonte]
      .sort((a, b) => a.ordemNoHorizonte - b.ordemNoHorizonte || (a.diaId < b.diaId ? -1 : 1))
      .map((d) => ({ diaId: d.diaId, ordemNoHorizonte: d.ordemNoHorizonte, oferecido: d.oferecido })),
    prescricoes: [...e.prescricoesCardio]
      .sort((a, b) => (a.prescricaoId < b.prescricaoId ? -1 : 1))
      .map((p) => ({
        prescricaoId: p.prescricaoId,
        diaOrigemId: p.diaOrigemId,
        ordemPrescricao: p.ordemPrescricao,
        duracaoPrescritaSegundos: p.duracaoPrescritaSegundos,
      })),
  };
}

/**
 * 🔒 CONSTRUTOR CANÔNICO. Fail-safe: erro ESTRUTURAL invalida o agregado inteiro (commit atômico,
 * zero subconjunto). Sem erro, cada prescrição vira, inteira, parte do bloco do seu dia.
 */
export function construirDistribuicaoCardioSemana(e: EntradaDistribuicaoSemana): DistribuicaoCardioSemanal {
  const hash = canonicalInputHash(projecaoCanonica(e));
  const resultado = (estado: EstadoDistribuicao, blocosPorDia: BlocoCardioDia[], motivos: string[]): DistribuicaoCardioSemanal => ({
    estado, aggregateId: e.aggregateId, expectedRevision: e.expectedRevision, formulaVersion: e.formulaVersion,
    canonicalInputHash: hash, blocosPorDia, motivos,
  });

  // ── Validação ESTRUTURAL global (identidade, ordens, horizonte, prescrições) ─────────────────
  const motivosEstruturais: string[] = [];
  if (typeof e.aggregateId !== 'string' || e.aggregateId.length === 0) motivosEstruturais.push('aggregate_id vazio');
  if (typeof e.formulaVersion !== 'string' || e.formulaVersion.length === 0) motivosEstruturais.push('formula_version vazia');
  if (!intSeguro(e.expectedRevision) || e.expectedRevision < 0) motivosEstruturais.push('expected_revision inválida');

  const diaPorId = new Map<string, DiaHorizonte>();
  const ordensHorizonte = new Set<number>();
  for (const d of e.diasHorizonte) {
    if (typeof d.diaId !== 'string' || d.diaId.length === 0) motivosEstruturais.push('dia_id vazio');
    if (typeof d.oferecido !== 'boolean') motivosEstruturais.push(`oferecido inválido: ${d.diaId}`);
    if (diaPorId.has(d.diaId)) motivosEstruturais.push(`dia_id duplicado: ${d.diaId}`);
    if (!intSeguro(d.ordemNoHorizonte) || d.ordemNoHorizonte < 0) motivosEstruturais.push(`ordem_no_horizonte inválida: ${d.diaId}`);
    else if (ordensHorizonte.has(d.ordemNoHorizonte)) motivosEstruturais.push(`ordem_no_horizonte duplicada: ${d.ordemNoHorizonte}`);
    else ordensHorizonte.add(d.ordemNoHorizonte);
    diaPorId.set(d.diaId, d);
  }

  const prescIds = new Set<string>();
  const ordemPorDiaOrigem = new Map<string, Set<number>>();
  for (const p of e.prescricoesCardio) {
    if (typeof p.prescricaoId !== 'string' || p.prescricaoId.length === 0) motivosEstruturais.push('prescricao_id vazio');
    if (prescIds.has(p.prescricaoId)) motivosEstruturais.push(`prescricao_id duplicado: ${p.prescricaoId}`);
    prescIds.add(p.prescricaoId);
    if (!diaPorId.has(p.diaOrigemId)) motivosEstruturais.push(`prescricao ${p.prescricaoId} referencia dia fora do horizonte: ${p.diaOrigemId}`);
    else if (!diaPorId.get(p.diaOrigemId)!.oferecido) motivosEstruturais.push(`prescricao ${p.prescricaoId} nasce em dia não oferecido: ${p.diaOrigemId}`);
    if (!intSeguro(p.duracaoPrescritaSegundos) || p.duracaoPrescritaSegundos <= 0) {
      motivosEstruturais.push(`duracao_prescrita inválida: ${p.prescricaoId}`);
    }
    if (!intSeguro(p.ordemPrescricao) || p.ordemPrescricao < 0) {
      motivosEstruturais.push(`ordem_prescricao inválida: ${p.prescricaoId}`);
    } else {
      const set = ordemPorDiaOrigem.get(p.diaOrigemId) ?? new Set<number>();
      if (set.has(p.ordemPrescricao)) motivosEstruturais.push(`ordem_prescricao duplicada no dia ${p.diaOrigemId}: ${p.ordemPrescricao}`);
      set.add(p.ordemPrescricao);
      ordemPorDiaOrigem.set(p.diaOrigemId, set);
    }
  }
  if (motivosEstruturais.length > 0) return resultado('NAO_AVALIADA_ESTRUTURAL', [], motivosEstruturais);

  // ── Blocos consolidados por dia: a prescrição inteira fica no dia de origem ─────────────────
  const ordemDoDia = (diaId: string) => diaPorId.get(diaId)!.ordemNoHorizonte;
  const chave = (l: LinhagemParcela) => chaveOrdem(ordemDoDia(l.diaOrigemId), l.ordemPrescricao, l.prescricaoId);
  const porDia = new Map<string, LinhagemParcela[]>();
  for (const p of e.prescricoesCardio) {
    const linhagens = porDia.get(p.diaOrigemId) ?? [];
    linhagens.push({ prescricaoId: p.prescricaoId, diaOrigemId: p.diaOrigemId, ordemPrescricao: p.ordemPrescricao, segundos: p.duracaoPrescritaSegundos });
    porDia.set(p.diaOrigemId, linhagens);
  }
  const blocos: BlocoCardioDia[] = [...porDia.entries()]
    .map(([diaId, linhagens]) => ({
      diaId,
      duracaoTotalSegundos: linhagens.reduce((n, l) => n + l.segundos, 0),
      linhagens: linhagens.sort((x, y) => (chave(x) < chave(y) ? -1 : 1)),
    }))
    .sort((a, b) => ordemDoDia(a.diaId) - ordemDoDia(b.diaId));

  return resultado('CONSTRUIDA', blocos, []);
}

// ── Validação (chama o construtor; não duplica a lógica) ─────────────────────────────────────
export type ValidacaoDistribuicao =
  | { tipo: 'VALIDA' }
  | { tipo: 'NAO_AVALIADA_ESTRUTURAL'; motivos: string[] };

/** Serialização estável de um agregado observado para comparação exata contra o construtor. */
function assinaturaDistribuicao(d: DistribuicaoCardioSemanal): string {
  return canonicalInputHash({
    estado: d.estado,
    aggregateId: d.aggregateId,
    expectedRevision: d.expectedRevision,
    formulaVersion: d.formulaVersion,
    canonicalInputHash: d.canonicalInputHash,
    motivos: d.motivos,
    blocos: [...d.blocosPorDia]
      .sort((a, b) => (a.diaId < b.diaId ? -1 : 1))
      .map((bl) => ({ diaId: bl.diaId, duracaoTotalSegundos: bl.duracaoTotalSegundos, linhagens: bl.linhagens })),
  });
}

/**
 * 🔒 O validador RECONSTRÓI a distribuição canônica a partir dos fatos-base (independentes do
 * resultado observado) e compara EXATAMENTE contra o observado. Qualquer divergência de blocos,
 * identidade ou estado é falha estrutural — nunca se confia na distribuição persistida.
 */
export function validarDistribuicaoCardioSemana(params: {
  fatosBase: EntradaDistribuicaoSemana;
  distribuicaoObservada: DistribuicaoCardioSemanal;
}): ValidacaoDistribuicao {
  const canonica = construirDistribuicaoCardioSemana(params.fatosBase);
  if (canonica.estado === 'NAO_AVALIADA_ESTRUTURAL') {
    return { tipo: 'NAO_AVALIADA_ESTRUTURAL', motivos: canonica.motivos };
  }
  if (assinaturaDistribuicao(canonica) !== assinaturaDistribuicao(params.distribuicaoObservada)) {
    return { tipo: 'NAO_AVALIADA_ESTRUTURAL', motivos: ['distribuição observada diverge do construtor canônico'] };
  }
  return { tipo: 'VALIDA' };
}
