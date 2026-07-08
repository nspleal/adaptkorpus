/**
 * Constantes travadas do motor de treino — transcrição fiel das tabelas do cofre
 * (parametros-motor-treino-evokorpus, DFs 2026-06-28). NÃO alterar sem decisão registrada.
 */
import type { NivelExercicio } from '../data/types';
import type { CardioPrescricao, Faixa, NivelExperiencia } from './treino-types';
import type { Objetivo } from './types';

/** 1.1 — Base por objetivo: reps, RIR, descanso, cardio. */
export interface BaseObjetivo {
  repsComposto: Faixa;
  repsIsolado: Faixa;
  rir: Faixa;
  descansoCompostoSeg: Faixa;
  descansoIsoladoSeg: Faixa;
  cardio: CardioPrescricao;
}

export const FITT_OBJETIVO: Record<Objetivo, BaseObjetivo> = {
  saude: {
    repsComposto: { min: 8, max: 15 },
    repsIsolado: { min: 10, max: 15 },
    rir: { min: 2, max: 4 },
    descansoCompostoSeg: { min: 60, max: 90 },
    descansoIsoladoSeg: { min: 60, max: 90 },
    cardio: { tipo: 'minutos_semana', min: 150, max: 150 },
  },
  massa: {
    repsComposto: { min: 6, max: 12 },
    repsIsolado: { min: 8, max: 15 },
    rir: { min: 1, max: 3 },
    descansoCompostoSeg: { min: 90, max: 120 },
    descansoIsoladoSeg: { min: 60, max: 90 },
    cardio: { tipo: 'sessoes_moderadas', min: 1, max: 2 },
  },
  emagrecimento: {
    repsComposto: { min: 8, max: 12 },
    repsIsolado: { min: 10, max: 15 },
    rir: { min: 1, max: 3 },
    descansoCompostoSeg: { min: 60, max: 90 },
    descansoIsoladoSeg: { min: 60, max: 90 },
    cardio: { tipo: 'minutos_semana', min: 150, max: 300 },
  },
};

/** 1.2 — Volume e frequência por nível (volume/grupo modulado pelo objetivo). */
export interface VolumeNivel {
  sessoesForca: Faixa;
  seriesPorExercicio: Faixa;
  volumePorGrupoSemana: Record<Objetivo, Faixa>;
}

export const VOLUME_NIVEL: Record<NivelExperiencia, VolumeNivel> = {
  iniciante: {
    sessoesForca: { min: 2, max: 3 },
    seriesPorExercicio: { min: 1, max: 3 },
    volumePorGrupoSemana: {
      saude: { min: 6, max: 10 },
      massa: { min: 10, max: 12 },
      emagrecimento: { min: 8, max: 10 },
    },
  },
  intermediario: {
    sessoesForca: { min: 3, max: 4 },
    seriesPorExercicio: { min: 2, max: 4 },
    volumePorGrupoSemana: {
      saude: { min: 8, max: 12 },
      massa: { min: 13, max: 16 },
      emagrecimento: { min: 10, max: 14 },
    },
  },
  avancado: {
    sessoesForca: { min: 4, max: 6 },
    seriesPorExercicio: { min: 3, max: 4 },
    volumePorGrupoSemana: {
      saude: { min: 10, max: 12 },
      massa: { min: 16, max: 20 },
      emagrecimento: { min: 12, max: 16 },
    },
  },
};

/** 1.3 — Trilhos de segurança (conservadores = legais). */
export const PISO_REPS_COM_CARGA = 6; // faixas começam em 6
export const PISO_ABSOLUTO_REPS = 5; // a progressão com carga nunca cruza
export const RIR_MIN_GLOBAL = 1;
export const RIR_MIN_INICIANTE = 2; // iniciante nunca treina com RIR < 2
export const FREQ_POR_GRUPO_MIN = 2; // ≥ 2×/sem (1× só com 1 dia)

/** Passo 2 — incrementos de carga no "fácil" (% da carga atual). */
export const INCREMENTO_CARGA = {
  superiorIsolado: 0.025, // +2,5%
  inferiorComposto: 0.05, // +2,5–5% → topo p/ grandes compostos inferiores
} as const;
export const REDUCAO_CARGA_DIFICIL = 0.1; // −~10% após 2 "difícil" seguidas

/** Deload (semana de alívio). */
export const DELOAD_SEMANAS_DEFAULT = 6; // v2: agendado = semana 6 do mesociclo (universal)
export const DELOAD_REDUCAO_VOLUME = 0.45; // −40–50% do volume (ponto: 45%)

/** v2 — Mesociclo + autorregulação (cofre parametros-motor-treino §"v2 — decisões
 *  travadas" + outputs/handoff-motor-treino-v2, DFs 2026-07-08). */
export const MESOCICLO_SEMANAS = 6; // 5 de rampa + 1 de deload
export const MESOCICLO_SEMANAS_RAMPA = 5;
/** Largura de banda acima da qual a rampa sobe +2 séries/sem (tabela 1.2 atual: nunca). */
export const RAMPA_BANDA_LARGA = 4;
/** RIR-alvo por semana da rampa (linear 3→1; sem. 6 = deload volta a 3). Piso do
 *  iniciante (2) e do objetivo entram por cima via `rirAlvoDaSemana`. Nunca 0. */
export const RIR_ALVO_POR_SEMANA = [3, 3, 2, 2, 1] as const;
/** Teto do descanso do composto quando o tempo por sessão permite (v2 §5). */
export const DESCANSO_COMPOSTO_TETO_SEG = 180;
/** Modo força: alvo fixo de reps nos compostos (nunca < 6 nem > 6; → 6RM). */
export const MODO_FORCA_REPS = 6;

/** Nível de experiência → dificuldades de exercício liberadas (escada da biblioteca A1). */
export const DIFICULDADE_LIBERADA: Record<NivelExperiencia, NivelExercicio[]> = {
  iniciante: ['iniciante'],
  intermediario: ['iniciante', 'intermediario'],
  avancado: ['iniciante', 'intermediario', 'avancado'],
};

/** Limiares de IMC do gate (reaproveitados — espelham gate-de-saude). */
export const IMC_LIMITES = { magrezaSevera: 16, baixoPeso: 18.5, sobrepeso: 25, obesidade: 30 } as const;
