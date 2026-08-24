/**
 * 🔒 C1 — PONTE do gerador vivo para a distribuição semanal canônica de cardio (autor 2026-08-21).
 *
 * Constrói o `dias_horizonte` a partir da rotina real + a SELEÇÃO explícita de dias oferecidos para
 * cardio (`diasOferecidosCardio`, conjunto ORDENADO de índices de dia), e chama a primitiva única
 * `construirDistribuicaoCardioSemana`. Regras travadas (decisão do autor):
 *  - um dia só recebe cardio se foi OFERECIDO e NÃO contém musculação (dia de força nunca recebe);
 *  - cardio nunca remove/substitui/desloca musculação; dia vago NÃO oferecido é inelegível;
 *  - ordem cronológica, sem wrap; cardio próprio do dia reservado antes da redistribuição;
 *  - cardio adapta-se ao tempo (nunca usa os +480 da musculação);
 *  - os dias oferecidos entram, em ordem canônica, no `canonical_input_hash` (via a projeção da
 *    primitiva, que serializa `oferecido` por dia).
 *
 * `diasOferecidosCardio` é a MENOR fronteira funcional nova: um conjunto transiente por geração,
 * não uma preferência permanente do perfil. Puro/determinístico.
 */
import {
  construirDistribuicaoCardioSemana,
  type DiaHorizonte,
  type DistribuicaoCardioSemanal,
  type EntradaDistribuicaoSemana,
  type OrcamentoDia,
  type PlanoResistidoTerminalDia,
  type PrescricaoCardioSemana,
} from './distribuicao-cardio-semana';
import type { ResultadoDuracao } from './duracao-sessao';

export interface EntradaCardioSemanaViva {
  /** Nº total de dias da semana (força + vagos). Horizonte = 0..diasTotais-1. */
  diasTotais: number;
  /** Os primeiros `diasForca` dias são de MUSCULAÇÃO (temMusculacao = true). */
  diasForca: number;
  /** Certificação canônica por dia de força (para o MAX_RESISTIDA de cada origem). */
  duracaoDias: readonly ResultadoDuracao[];
  /** 🔒 Conjunto ORDENADO de índices de dia oferecidos pelo usuário para cardio. */
  diasOferecidosCardio: readonly number[];
  /** Orçamento por sessão (s) = tempoPorSessaoMin·60, igual para todos os dias. */
  orcamentoSegundos: number;
  /** Duração de cardio prescrita por dia OFERECIDO (s). 0/ausente ⇒ sem prescrição (ex.: meta em sessões). */
  cardioPrescritoPorDiaSegundos: number;
  aggregateId: string;
  expectedRevision: number;
  formulaVersion: string;
}

/** Índice → id de dia estável e ordenável. */
export function idDoDia(indice: number): string {
  return `dia-${String(indice).padStart(3, '0')}`;
}

/**
 * Materializa a distribuição semanal de cardio do plano real. Cada dia OFERECIDO origina uma
 * prescrição de cardio adaptável; a primitiva reserva o uso próprio de cada dia e redistribui os
 * saldos a dias posteriores oferecidos e sem musculação.
 */
export function fatosDistribuicaoCardioDaRotina(e: EntradaCardioSemanaViva): EntradaDistribuicaoSemana {
  const ofertados = new Set(e.diasOferecidosCardio);

  const dias: DiaHorizonte[] = Array.from({ length: e.diasTotais }, (_, i) => ({
    diaId: idDoDia(i),
    ordemNoHorizonte: i,
    oferecido: ofertados.has(i),
  }));

  const planos: PlanoResistidoTerminalDia[] = Array.from({ length: e.diasTotais }, (_, i) => {
    const ehForca = i < e.diasForca;
    const cert = ehForca ? e.duracaoDias[i] : undefined;
    const maxResistidaSegundos = ehForca
      ? (cert?.estadoCalculo === 'CALCULADO' ? cert.duracaoMaximaEstimadaSegundos ?? null : null)
      : 0;
    return { diaId: idDoDia(i), temMusculacao: ehForca, maxResistidaSegundos };
  });

  const orcamentos: OrcamentoDia[] = Array.from({ length: e.diasTotais }, (_, i) => ({
    diaId: idDoDia(i),
    orcamentoSegundos: e.orcamentoSegundos,
  }));

  // Uma prescrição de cardio por dia OFERECIDO (origem), só quando há duração prescrita.
  const prescricoes: PrescricaoCardioSemana[] =
    e.cardioPrescritoPorDiaSegundos > 0
      ? [...ofertados]
          .filter((i) => i >= 0 && i < e.diasTotais)
          .sort((a, b) => a - b)
          .map((i) => ({
            prescricaoId: `cardio-${idDoDia(i)}`,
            diaOrigemId: idDoDia(i),
            ordemPrescricao: 0,
            duracaoPrescritaSegundos: e.cardioPrescritoPorDiaSegundos,
          }))
      : [];

  return {
    aggregateId: e.aggregateId,
    expectedRevision: e.expectedRevision,
    formulaVersion: e.formulaVersion,
    diasHorizonte: dias,
    planosResistidosTerminais: planos,
    orcamentoPorDia: orcamentos,
    prescricoesCardio: prescricoes,
  };
}

/** Constrói a distribuição observada exclusivamente a partir dos fatos-base congelados. */
export function distribuirCardioDaRotina(e: EntradaCardioSemanaViva): DistribuicaoCardioSemanal {
  return construirDistribuicaoCardioSemana(fatosDistribuicaoCardioDaRotina(e));
}
