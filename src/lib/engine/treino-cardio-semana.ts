/**
 * 🔒 C1 — PONTE do gerador vivo para a distribuição semanal canônica de cardio (autor 2026-08-21).
 *
 * Constrói o `dias_horizonte` a partir da semana real + a SELEÇÃO explícita de dias oferecidos para
 * cardio (`diasOferecidosCardio`, conjunto de Weekday), e chama a primitiva única
 * `construirDistribuicaoCardioSemana`. Regras travadas (decisão do autor):
 *  - cardio só entra em dia oferecido; pode ocorrer após a musculação no mesmo dia;
 *  - cardio nunca remove/substitui/desloca musculação;
 *  - 🔴 2026-09-23: o tempo do perfil é só da musculação — o cardio conserva a duração prescrita,
 *    sem ser cortado, redistribuído ou descartado por falta de folga do treino;
 *  - os dias oferecidos entram, em ordem canônica, no `canonical_input_hash` (via a projeção da
 *    primitiva, que serializa `oferecido` por dia).
 *
 * `diasOferecidosCardio` é a MENOR fronteira funcional nova: um conjunto transiente por geração,
 * não uma preferência permanente do perfil. Puro/determinístico.
 */
import {
  construirDistribuicaoCardioSemana,
  type DistribuicaoCardioSemanal,
  type EntradaDistribuicaoSemana,
} from './distribuicao-cardio-semana';
import { ORDEM_SEMANA, type Weekday } from '../semana';

export interface EntradaCardioSemanaViva {
  /** 🔒 Conjunto de dias reais oferecidos pelo usuário para cardio (índices legados 0..6 aceitos). */
  diasOferecidosCardio: readonly (Weekday | number)[];
  /** Duração de cardio prescrita por dia OFERECIDO (s). 0 ⇒ sem prescrição em minutos (ex.: meta em sessões). */
  cardioPrescritoPorDiaSegundos: number;
  aggregateId: string;
  expectedRevision: number;
  formulaVersion: string;
}

/**
 * Materializa os fatos da distribuição semanal de cardio do plano real: cada dia OFERECIDO origina
 * uma prescrição de cardio, que a primitiva mantém inteira no próprio dia.
 */
export function fatosDistribuicaoCardioDaRotina(e: EntradaCardioSemanaViva): EntradaDistribuicaoSemana {
  const ofertados = ORDEM_SEMANA.filter((dia, indice) =>
    e.diasOferecidosCardio.includes(dia) || e.diasOferecidosCardio.includes(indice));
  return {
    aggregateId: e.aggregateId,
    expectedRevision: e.expectedRevision,
    formulaVersion: e.formulaVersion,
    diasHorizonte: ORDEM_SEMANA.map((diaId, ordemNoHorizonte) => ({
      diaId, ordemNoHorizonte, oferecido: ofertados.includes(diaId),
    })),
    // Uma prescrição de cardio por dia OFERECIDO (origem), só quando há duração prescrita.
    prescricoesCardio: e.cardioPrescritoPorDiaSegundos > 0
      ? ofertados.map((diaId) => ({
          prescricaoId: `cardio-${diaId}`,
          diaOrigemId: diaId,
          ordemPrescricao: 0,
          duracaoPrescritaSegundos: e.cardioPrescritoPorDiaSegundos,
        }))
      : [],
  };
}

/** Constrói a distribuição observada exclusivamente a partir dos fatos-base congelados. */
export function distribuirCardioDaRotina(e: EntradaCardioSemanaViva): DistribuicaoCardioSemanal {
  return construirDistribuicaoCardioSemana(fatosDistribuicaoCardioDaRotina(e));
}
