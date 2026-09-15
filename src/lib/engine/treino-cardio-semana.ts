/**
 * 🔒 C1 — PONTE do gerador vivo para a distribuição semanal canônica de cardio (autor 2026-08-21).
 *
 * Constrói o `dias_horizonte` a partir da semana real + a SELEÇÃO explícita de dias oferecidos para
 * cardio (`diasOferecidosCardio`, conjunto de Weekday), e chama a primitiva única
 * `construirDistribuicaoCardioSemana`. Regras travadas (decisão do autor):
 *  - cardio próprio pode ocorrer após a musculação no mesmo dia; parcela REDISTRIBUÍDA só vai a
 *    destino oferecido, posterior e sem musculação;
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
import { ORDEM_SEMANA, type Weekday } from '../semana';

export interface EntradaCardioSemanaViva {
  /** Dias reais que contêm musculação, com sua certificação resistida terminal. */
  diasComMusculacao?: readonly { diaId: Weekday; duracao: ResultadoDuracao }[];
  /** 🔒 Conjunto de dias reais oferecidos pelo usuário para cardio. */
  diasOferecidosCardio: readonly (Weekday | number)[];
  /** Orçamento por sessão (s) = tempoPorSessaoMin·60, igual para todos os dias. */
  orcamentoSegundos: number | undefined;
  semLimite?: boolean;
  /** Duração de cardio prescrita por dia OFERECIDO (s). 0/ausente ⇒ sem prescrição (ex.: meta em sessões). */
  cardioPrescritoPorDiaSegundos: number;
  aggregateId: string;
  expectedRevision: number;
  formulaVersion: string;
  /** Adaptador de compatibilidade: APIs anteriores enviavam índices artificiais 0..6. */
  diasTotais?: number;
  diasForca?: number;
  duracaoDias?: readonly ResultadoDuracao[];
}

/** A identidade canônica de um dia do horizonte é o próprio Weekday, não um índice artificial. */
export function idDoDia(dia: Weekday | number): string {
  return typeof dia === 'number' ? ORDEM_SEMANA[dia] ?? `dia-invalido-${dia}` : dia;
}

/** Aceita índices legados somente na fronteira de compatibilidade e os converte à semana real. */
function normalizarOferta(entrada: readonly (Weekday | number)[]): Weekday[] {
  return ORDEM_SEMANA.filter((dia, indice) => entrada.includes(dia) || entrada.includes(indice));
}

/**
 * Materializa a distribuição semanal de cardio do plano real. Cada dia OFERECIDO origina uma
 * prescrição de cardio adaptável; a primitiva reserva o uso próprio de cada dia e redistribui os
 * saldos a dias posteriores oferecidos e sem musculação.
 */
export function fatosDistribuicaoCardioDaRotina(e: EntradaCardioSemanaViva): EntradaDistribuicaoSemana {
  const ofertados = new Set(normalizarOferta(e.diasOferecidosCardio));
  const legado: { diaId: Weekday; duracao: ResultadoDuracao }[] = [];
  for (let treinoIdx = 0; treinoIdx < Math.max(0, Math.min(7, e.diasForca ?? 0)); treinoIdx += 1) {
    const diaId = ORDEM_SEMANA[treinoIdx];
    const duracao = e.duracaoDias?.[treinoIdx];
    if (diaId && duracao) legado.push({ diaId, duracao });
  }
  const diasComMusculacao = e.diasComMusculacao ?? legado;
  const musculacaoPorDia = new Map(diasComMusculacao.map((dia) => [dia.diaId, dia.duracao]));

  const dias: DiaHorizonte[] = ORDEM_SEMANA.map((diaId, ordemNoHorizonte) => ({
    diaId,
    ordemNoHorizonte,
    oferecido: ofertados.has(diaId),
  }));

  const planos: PlanoResistidoTerminalDia[] = ORDEM_SEMANA.map((diaId) => {
    const cert = musculacaoPorDia.get(diaId);
    const temMusculacao = cert != null;
    const maxResistidaSegundos = temMusculacao
      ? (cert?.estadoCalculo === 'CALCULADO' ? cert.duracaoMaximaEstimadaSegundos ?? null : null)
      : 0;
    return { diaId, temMusculacao, maxResistidaSegundos };
  });

  const orcamentos: OrcamentoDia[] = ORDEM_SEMANA.map((diaId) => ({
    diaId,
    orcamentoSegundos: e.orcamentoSegundos,
    ...(e.semLimite ? { semLimite: true } : {}),
  }));

  // Uma prescrição de cardio por dia OFERECIDO (origem), só quando há duração prescrita.
  const prescricoes: PrescricaoCardioSemana[] =
    e.cardioPrescritoPorDiaSegundos > 0
      ? [...ofertados]
          .sort((a, b) => ORDEM_SEMANA.indexOf(a) - ORDEM_SEMANA.indexOf(b))
          .map((diaId) => ({
            prescricaoId: `cardio-${diaId}`,
            diaOrigemId: diaId,
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
