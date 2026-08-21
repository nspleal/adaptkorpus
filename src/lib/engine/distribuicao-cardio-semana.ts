/**
 * 🔒 C1 — DISTRIBUIÇÃO SEMANAL DE CARDIO · primitiva canônica única (spec §2/§4, handoff §3/§4.2).
 *
 * `construirDistribuicaoCardioSemana` é a ÚNICA construção; o gerador e o crítico/validador semanal
 * a compartilham. `validarDistribuicaoCardioSemana` CHAMA o construtor e compara EXATAMENTE a
 * distribuição/contratos/blocos observados — não duplica a lógica (§8.1, mutação "validar sem
 * confrontar o construtor"). Ambos consomem `calcularUsosCardioNaOrigem` (fórmula única de uso).
 *
 * Duas fases determinísticas sobre o MESMO snapshot (§4):
 *  (1) reserva o uso de TODAS as prescrições nos seus dias de origem, compartilhando a capacidade
 *      por `ordem_prescricao`; (2) só então distribui os saldos para destinos POSTERIORES.
 *  Parcela recebida nunca rouba a capacidade do cardio próprio já prescrito no destino.
 *
 * Ordem total canônica de origens e linhagens: `{ordem_no_horizonte(dia_origem), ordem_prescricao,
 * prescricao_id}`. Destino elegível: oferecido, SEM musculação e estritamente posterior à origem no
 * horizonte (sem wrap-around). Consolidação: um único bloco por dia = cardio próprio + recebido.
 * Conservação obrigatória: `prescrita = usada_na_origem + Σ destinos + descartada`.
 *
 * Puro/determinístico: sem rede/relógio/IO. O commit atômico (CAS) mora na camada de persistência.
 */
import { canonicalInputHash } from './cas';
import {
  calcularUsosCardioNaOrigem,
  capacidadeCardioDoDia,
  type PrescricaoCardioDia,
} from './cardio-sessao';

const intSeguro = (n: number): boolean => Number.isSafeInteger(n);

// ── Entradas ───────────────────────────────────────────────────────────────────
export interface DiaHorizonte {
  diaId: string;
  /** Inteiro seguro `>= 0`, único no horizonte. */
  ordemNoHorizonte: number;
  /** O usuário ofereceu este dia para receber cardio? Destino exige `true`. */
  oferecido: boolean;
}

export interface PlanoResistidoTerminalDia {
  diaId: string;
  temMusculacao: boolean;
  /** MAX_RESISTIDA terminal do dia; `null` ⇒ incalculável (sessão NAO_AVALIADO). */
  maxResistidaSegundos: number | null;
}

export interface OrcamentoDia {
  diaId: string;
  /** B do dia; `undefined`/`null` ⇒ ausente (destino inelegível; origem vira saldo). */
  orcamentoSegundos: number | undefined;
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
  planosResistidosTerminais: readonly PlanoResistidoTerminalDia[];
  orcamentoPorDia: readonly OrcamentoDia[];
  prescricoesCardio: readonly PrescricaoCardioSemana[];
}

// ── Saídas ───────────────────────────────────────────────────────────────────
export interface AlocacaoDestino {
  diaId: string;
  segundos: number;
}

export interface LinhagemParcela {
  prescricaoId: string;
  diaOrigemId: string;
  ordemPrescricao: number;
  segundos: number;
  /** ORIGEM = cardio próprio do dia; DESTINO = parcela recebida de outra origem. */
  papel: 'ORIGEM' | 'DESTINO';
}

export interface BlocoCardioDia {
  diaId: string;
  duracaoTotalSegundos: number;
  /** Ordenadas por `{ordem_no_horizonte(dia_origem), ordem_prescricao, prescricao_id}`. */
  linhagens: LinhagemParcela[];
}

export interface CardioPlanejado {
  prescricaoId: string;
  diaOrigemId: string;
  ordemPrescricao: number;
  duracaoPrescritaSegundos: number;
  duracaoUsadaNaSessaoSegundos: number;
  alocacoesDestino: AlocacaoDestino[];
  duracaoDescartadaSegundos: number;
  /** Motivo quando a prescrição é local-inválida/ressalvada (resultado temporal NAO_AVALIADO). */
  motivos: string[];
}

export type EstadoDistribuicao = 'CONSTRUIDA' | 'CONSTRUIDA_COM_RESSALVAS' | 'NAO_AVALIADA_ESTRUTURAL';

export interface RessalvaLocal {
  prescricaoIds: string[];
  diaIds: string[];
  motivo: string;
}

export interface DistribuicaoCardioSemanal {
  estado: EstadoDistribuicao;
  aggregateId: string;
  expectedRevision: number;
  formulaVersion: string;
  canonicalInputHash: string;
  contratosPorPrescricao: CardioPlanejado[];
  blocosPorDia: BlocoCardioDia[];
  motivos: string[];
  ressalvas: RessalvaLocal[];
}

/** Chave de ordem total canônica (spec §2/§4). */
function chaveOrdem(ordemHorizonte: number, ordemPrescricao: number, prescricaoId: string): string {
  const pad = (n: number) => String(n).padStart(12, '0');
  return `${pad(ordemHorizonte)}|${pad(ordemPrescricao)}|${prescricaoId}`;
}

/** Projeção canônica das entradas para o hash (dias/ordens/prescrições ordenados). */
function projecaoCanonica(e: EntradaDistribuicaoSemana): unknown {
  return {
    aggregateId: e.aggregateId,
    expectedRevision: e.expectedRevision,
    formulaVersion: e.formulaVersion,
    dias: [...e.diasHorizonte]
      .sort((a, b) => a.ordemNoHorizonte - b.ordemNoHorizonte || (a.diaId < b.diaId ? -1 : 1))
      .map((d) => ({ diaId: d.diaId, ordemNoHorizonte: d.ordemNoHorizonte, oferecido: d.oferecido })),
    planos: [...e.planosResistidosTerminais]
      .sort((a, b) => (a.diaId < b.diaId ? -1 : 1))
      .map((p) => ({ diaId: p.diaId, temMusculacao: p.temMusculacao, maxResistidaSegundos: p.maxResistidaSegundos })),
    orcamentos: [...e.orcamentoPorDia]
      .sort((a, b) => (a.diaId < b.diaId ? -1 : 1))
      .map((o) => ({ diaId: o.diaId, orcamentoSegundos: o.orcamentoSegundos ?? null })),
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

function estrutural(e: EntradaDistribuicaoSemana, hash: string, motivos: string[]): DistribuicaoCardioSemanal {
  return {
    estado: 'NAO_AVALIADA_ESTRUTURAL',
    aggregateId: e.aggregateId,
    expectedRevision: e.expectedRevision,
    formulaVersion: e.formulaVersion,
    canonicalInputHash: hash,
    contratosPorPrescricao: [],
    blocosPorDia: [],
    motivos,
    ressalvas: [],
  };
}

/**
 * 🔒 CONSTRUTOR CANÔNICO. Fail-safe: erro ESTRUTURAL global invalida o agregado inteiro (commit
 * atômico, zero subconjunto); ressalva LOCAL isola a prescrição afetada e segue com as válidas.
 */
export function construirDistribuicaoCardioSemana(e: EntradaDistribuicaoSemana): DistribuicaoCardioSemanal {
  const hash = canonicalInputHash(projecaoCanonica(e));

  // ── Fase 0 — validação ESTRUTURAL global (identidade, ordens, horizonte, hash) ───────────────
  const motivosEstruturais: string[] = [];
  if (typeof e.aggregateId !== 'string' || e.aggregateId.length === 0) motivosEstruturais.push('aggregate_id vazio');
  if (typeof e.formulaVersion !== 'string' || e.formulaVersion.length === 0) motivosEstruturais.push('formula_version vazia');
  if (!intSeguro(e.expectedRevision) || e.expectedRevision < 0) motivosEstruturais.push('expected_revision inválida');

  const diaPorId = new Map<string, DiaHorizonte>();
  const ordensHorizonte = new Set<number>();
  for (const d of e.diasHorizonte) {
    if (diaPorId.has(d.diaId)) motivosEstruturais.push(`dia_id duplicado: ${d.diaId}`);
    if (!intSeguro(d.ordemNoHorizonte) || d.ordemNoHorizonte < 0) motivosEstruturais.push(`ordem_no_horizonte inválida: ${d.diaId}`);
    else if (ordensHorizonte.has(d.ordemNoHorizonte)) motivosEstruturais.push(`ordem_no_horizonte duplicada: ${d.ordemNoHorizonte}`);
    else ordensHorizonte.add(d.ordemNoHorizonte);
    diaPorId.set(d.diaId, d);
  }

  const prescIds = new Set<string>();
  const ordemPorDiaOrigem = new Map<string, Set<number>>();
  for (const p of e.prescricoesCardio) {
    if (prescIds.has(p.prescricaoId)) motivosEstruturais.push(`prescricao_id duplicado: ${p.prescricaoId}`);
    prescIds.add(p.prescricaoId);
    if (!diaPorId.has(p.diaOrigemId)) motivosEstruturais.push(`prescricao ${p.prescricaoId} referencia dia fora do horizonte: ${p.diaOrigemId}`);
    if (!intSeguro(p.ordemPrescricao) || p.ordemPrescricao < 0) {
      motivosEstruturais.push(`ordem_prescricao inválida: ${p.prescricaoId}`);
    } else {
      const set = ordemPorDiaOrigem.get(p.diaOrigemId) ?? new Set<number>();
      if (set.has(p.ordemPrescricao)) motivosEstruturais.push(`ordem_prescricao duplicada no dia ${p.diaOrigemId}: ${p.ordemPrescricao}`);
      set.add(p.ordemPrescricao);
      ordemPorDiaOrigem.set(p.diaOrigemId, set);
    }
  }
  if (motivosEstruturais.length > 0) return estrutural(e, hash, motivosEstruturais);

  const orcPorDia = new Map<string, number | undefined>();
  for (const o of e.orcamentoPorDia) orcPorDia.set(o.diaId, o.orcamentoSegundos ?? undefined);
  const planoPorDia = new Map<string, PlanoResistidoTerminalDia>();
  for (const p of e.planosResistidosTerminais) planoPorDia.set(p.diaId, p);

  const temMusculacao = (diaId: string) => planoPorDia.get(diaId)?.temMusculacao ?? false;
  const maxResistida = (diaId: string) => planoPorDia.get(diaId)?.maxResistidaSegundos ?? (temMusculacao(diaId) ? null : 0);
  const ordemDoDia = (diaId: string) => diaPorId.get(diaId)!.ordemNoHorizonte;

  const ressalvas: RessalvaLocal[] = [];

  // ── Fase 1 — reservar o uso de origem de TODAS as prescrições (capacidade compartilhada) ─────
  // Agrupa prescrições por dia de origem.
  const prescricoesPorDia = new Map<string, PrescricaoCardioSemana[]>();
  for (const p of e.prescricoesCardio) {
    const arr = prescricoesPorDia.get(p.diaOrigemId) ?? [];
    arr.push(p);
    prescricoesPorDia.set(p.diaOrigemId, arr);
  }

  // Estado por prescrição: uso na origem, saldo, alocações, descarte, motivos.
  interface EstadoPresc {
    presc: PrescricaoCardioSemana;
    usadaOrigem: number;
    saldo: number;
    alocacoes: AlocacaoDestino[];
    descartada: number;
    motivos: string[];
  }
  const estadoPresc = new Map<string, EstadoPresc>();
  // cardio próprio já usado como origem por dia (base da capacidade residual do destino).
  const cardioProprioNoDia = new Map<string, number>();

  for (const [diaId, prescs] of prescricoesPorDia) {
    const cap = capacidadeCardioDoDia({
      temMusculacao: temMusculacao(diaId),
      orcamentoSegundos: orcPorDia.get(diaId),
      maxResistidaSegundos: maxResistida(diaId),
    });
    const entradaPrimitiva: PrescricaoCardioDia[] = prescs.map((p) => ({
      prescricaoId: p.prescricaoId,
      ordemPrescricao: p.ordemPrescricao,
      duracaoPrescritaSegundos: p.duracaoPrescritaSegundos,
    }));
    const res = calcularUsosCardioNaOrigem(cap, entradaPrimitiva);

    if (cap.tipo === 'INCALCULAVEL') {
      ressalvas.push({ prescricaoIds: prescs.map((p) => p.prescricaoId), diaIds: [diaId], motivo: `capacidade de origem incalculável (${cap.motivo})` });
    }
    cardioProprioNoDia.set(diaId, res.cardioOrigemNoDiaSegundos);

    for (const p of prescs) {
      const uso = res.usos.find((u) => u.prescricaoId === p.prescricaoId)!;
      const motivos: string[] = [];
      if (uso.motivoInvalido) {
        motivos.push(uso.motivoInvalido);
        ressalvas.push({ prescricaoIds: [p.prescricaoId], diaIds: [diaId], motivo: `prescrição local inválida: ${uso.motivoInvalido}` });
      } else if (cap.tipo === 'INCALCULAVEL') {
        motivos.push(`origem incalculável (${cap.motivo}) — uso 0, saldo preservado`);
      }
      estadoPresc.set(p.prescricaoId, {
        presc: p,
        usadaOrigem: uso.duracaoUsadaNaSessaoSegundos,
        // prescrição inválida não gera saldo (não é alocável); as demais viram saldo pelo restante.
        saldo: uso.motivoInvalido ? 0 : uso.restanteAposOrigemSegundos,
        alocacoes: [],
        descartada: 0,
        motivos,
      });
    }
  }

  // ── Fase 2 — distribuir os saldos para destinos POSTERIORES (ordem total canônica) ───────────
  // parcelas recebidas por dia (para a capacidade residual e o bloco consolidado).
  const recebidoNoDia = new Map<string, number>();
  const origensOrdenadas = [...estadoPresc.values()].sort((a, b) =>
    chaveOrdem(ordemDoDia(a.presc.diaOrigemId), a.presc.ordemPrescricao, a.presc.prescricaoId) <
    chaveOrdem(ordemDoDia(b.presc.diaOrigemId), b.presc.ordemPrescricao, b.presc.prescricaoId)
      ? -1 : 1,
  );

  // destinos candidatos ordenados cronologicamente.
  const diasCronologicos = [...e.diasHorizonte].sort((a, b) => a.ordemNoHorizonte - b.ordemNoHorizonte);

  for (const st of origensOrdenadas) {
    if (st.saldo <= 0) continue;
    const ordemOrigem = ordemDoDia(st.presc.diaOrigemId);
    for (const destino of diasCronologicos) {
      if (st.saldo <= 0) break;
      if (destino.ordemNoHorizonte <= ordemOrigem) continue; // estritamente posterior; sem wrap
      if (!destino.oferecido) continue; // só dia oferecido
      if (temMusculacao(destino.diaId)) continue; // destino não pode conter musculação
      const b = orcPorDia.get(destino.diaId);
      if (b === undefined || !intSeguro(b) || !(b > 0)) continue; // capacidade desconhecida ⇒ pulado
      const jaNoDia = (cardioProprioNoDia.get(destino.diaId) ?? 0) + (recebidoNoDia.get(destino.diaId) ?? 0);
      const residual = Math.max(b - jaNoDia, 0);
      if (residual <= 0) continue;
      const parcela = Math.min(st.saldo, residual);
      if (parcela <= 0) continue;
      st.alocacoes.push({ diaId: destino.diaId, segundos: parcela });
      st.saldo -= parcela;
      recebidoNoDia.set(destino.diaId, (recebidoNoDia.get(destino.diaId) ?? 0) + parcela);
    }
    // saldo remanescente após esgotar destinos válidos ⇒ descarte.
    if (st.saldo > 0) {
      st.descartada = st.saldo;
      st.saldo = 0;
    }
  }

  // ── Contratos por prescrição (conservação obrigatória) ───────────────────────────────────────
  const contratos: CardioPlanejado[] = origensOrdenadas.map((st) => ({
    prescricaoId: st.presc.prescricaoId,
    diaOrigemId: st.presc.diaOrigemId,
    ordemPrescricao: st.presc.ordemPrescricao,
    duracaoPrescritaSegundos: st.presc.duracaoPrescritaSegundos,
    duracaoUsadaNaSessaoSegundos: st.usadaOrigem,
    alocacoesDestino: st.alocacoes,
    duracaoDescartadaSegundos: st.descartada,
    motivos: st.motivos,
  }));

  // ── Blocos consolidados por dia (1 bloco sse cardio_total_no_dia > 0) ────────────────────────
  interface Acc { total: number; linhagens: LinhagemParcela[]; }
  const acc = new Map<string, Acc>();
  const add = (diaId: string, l: LinhagemParcela) => {
    const a = acc.get(diaId) ?? { total: 0, linhagens: [] };
    a.total += l.segundos;
    a.linhagens.push(l);
    acc.set(diaId, a);
  };
  for (const st of origensOrdenadas) {
    if (st.usadaOrigem > 0) {
      add(st.presc.diaOrigemId, {
        prescricaoId: st.presc.prescricaoId, diaOrigemId: st.presc.diaOrigemId,
        ordemPrescricao: st.presc.ordemPrescricao, segundos: st.usadaOrigem, papel: 'ORIGEM',
      });
    }
    for (const al of st.alocacoes) {
      add(al.diaId, {
        prescricaoId: st.presc.prescricaoId, diaOrigemId: st.presc.diaOrigemId,
        ordemPrescricao: st.presc.ordemPrescricao, segundos: al.segundos, papel: 'DESTINO',
      });
    }
  }
  const blocos: BlocoCardioDia[] = [...acc.entries()]
    .filter(([, a]) => a.total > 0)
    .map(([diaId, a]) => ({
      diaId,
      duracaoTotalSegundos: a.total,
      linhagens: a.linhagens.sort((x, y) =>
        chaveOrdem(ordemDoDia(x.diaOrigemId), x.ordemPrescricao, x.prescricaoId) <
        chaveOrdem(ordemDoDia(y.diaOrigemId), y.ordemPrescricao, y.prescricaoId) ? -1 : 1),
    }))
    .sort((a, b) => ordemDoDia(a.diaId) - ordemDoDia(b.diaId));

  return {
    estado: ressalvas.length > 0 ? 'CONSTRUIDA_COM_RESSALVAS' : 'CONSTRUIDA',
    aggregateId: e.aggregateId,
    expectedRevision: e.expectedRevision,
    formulaVersion: e.formulaVersion,
    canonicalInputHash: hash,
    contratosPorPrescricao: contratos,
    blocosPorDia: blocos,
    motivos: [],
    ressalvas,
  };
}

// ── Validação (chama o construtor; não duplica a lógica) ─────────────────────────────────────
export type ValidacaoDistribuicao =
  | { tipo: 'VALIDA' }
  | { tipo: 'VALIDA_COM_RESSALVAS'; afetados: string[]; motivos: string[] }
  | { tipo: 'NAO_AVALIADA_ESTRUTURAL'; motivos: string[] };

/** Serialização estável de um agregado observado para comparação exata contra o construtor. */
function assinaturaDistribuicao(d: DistribuicaoCardioSemanal): string {
  return canonicalInputHash({
    estado: d.estado,
    canonicalInputHash: d.canonicalInputHash,
    contratos: [...d.contratosPorPrescricao]
      .sort((a, b) => (a.prescricaoId < b.prescricaoId ? -1 : 1))
      .map((c) => ({
        prescricaoId: c.prescricaoId, diaOrigemId: c.diaOrigemId, ordemPrescricao: c.ordemPrescricao,
        duracaoPrescritaSegundos: c.duracaoPrescritaSegundos, duracaoUsadaNaSessaoSegundos: c.duracaoUsadaNaSessaoSegundos,
        alocacoesDestino: [...c.alocacoesDestino].sort((x, y) => (x.diaId < y.diaId ? -1 : 1)),
        duracaoDescartadaSegundos: c.duracaoDescartadaSegundos, motivos: c.motivos,
      })),
    blocos: [...d.blocosPorDia]
      .sort((a, b) => (a.diaId < b.diaId ? -1 : 1))
      .map((bl) => ({ diaId: bl.diaId, duracaoTotalSegundos: bl.duracaoTotalSegundos, linhagens: bl.linhagens })),
  });
}

/**
 * 🔒 O validador RECONSTRÓI a distribuição canônica a partir dos fatos-base (independentes do
 * resultado observado) e compara EXATAMENTE contra o observado. Qualquer divergência de contratos,
 * blocos, identidade ou estado é falha estrutural — nunca se confia no `CardioPlanejado` persistido.
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
  if (canonica.estado === 'CONSTRUIDA_COM_RESSALVAS') {
    return {
      tipo: 'VALIDA_COM_RESSALVAS',
      afetados: [...new Set(canonica.ressalvas.flatMap((r) => [...r.prescricaoIds, ...r.diaIds]))],
      motivos: canonica.ressalvas.map((r) => r.motivo),
    };
  }
  return { tipo: 'VALIDA' };
}
