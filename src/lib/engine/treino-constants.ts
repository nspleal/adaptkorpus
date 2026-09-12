/**
 * Constantes travadas do motor de treino — transcrição fiel das tabelas do cofre
 * (parametros-motor-treino-adaptkorpus, DFs 2026-06-28). NÃO alterar sem decisão registrada.
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

/**
 * 🏷️ TETO DE TAMANHO do campo de séries do editor guiado — **trava de entrada, não regra de
 * treino** (D3, 2026-09-10). Não há teto de séries por exercício no cofre; este número existe
 * só para que um campo numérico livre não vire um plano de 9 h. Fonte única: o schema
 * (`perfil-resumo`), o input da tela e o montador leem daqui. Quando ele morde, o motor DIZ —
 * entrada recusada em silêncio é a mesma perda, só invisível.
 */
export const SERIES_MANUAIS_MAX = 99;

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

/** Leva 2 — Rampa de retomada (cofre §"Rampa de retomada", DF 2026-07-27; diretriz
 *  CSCCa/NSCA 2019). Feature de SEGURANÇA: o risco é rabdomiólise por esforço. */
/** ≤ 14 dias: nada muda — e o app não diz nada ("ausência não fala"). */
export const RETOMADA_DIAS_GATILHO = 14;
/** > 56 dias vira rampa longa. ⚠️ 56 é CONVENÇÃO DO CAMPO, não medida de diretriz. */
export const RETOMADA_DIAS_LONGA = 56;
/** Fatores sobre o volume de REFERÊNCIA (última semana efetivamente treinada). NÃO compostos. */
export const RETOMADA_FATORES_CURTA = [0.5, 0.7] as const;
export const RETOMADA_FATORES_LONGA = [0.5, 0.7, 0.8, 0.9] as const;
/** Janela da regra FIT (frequência/IRV/descanso) e da suspensão da B5. */
export const RETOMADA_SEMANAS_FIT = 2;
/** IRV = séries × reps × %1RM (decimal) por grupo/sessão — guarda-corpo DURO. */
export const RETOMADA_IRV_TETO = 30;
/** Sem carga o IRV é incomputável (não há %1RM) → teto fixo de séries por grupo/sessão. */
export const RETOMADA_SERIES_MAX_SEM_CARGA = 3;
/** Frequência máx. por GRUPO/PADRÃO por semana (não por dias de treino). */
export const RETOMADA_FREQ_MAX_POR_GRUPO = [3, 4] as const;
/** Descanso mínimo (razão 1:4 → 1:3 com série ≈ 30 s). Eleva o mínimo do isolado (v1 60–90 s). */
export const RETOMADA_DESCANSO_MIN_SEG = [120, 90] as const;
/** RIR-alvo na rampa = piso da escada. NUNCA o RIR da semana em que a pessoa parou. */
export const RETOMADA_RIR_ALVO = 3;

/** Nível de experiência → dificuldades de exercício liberadas (escada da biblioteca A1). */
export const DIFICULDADE_LIBERADA: Record<NivelExperiencia, NivelExercicio[]> = {
  iniciante: ['iniciante'],
  intermediario: ['iniciante', 'intermediario'],
  avancado: ['iniciante', 'intermediario', 'avancado'],
};

/** Limiares de IMC do gate (reaproveitados — espelham gate-de-saude). */
export const IMC_LIMITES = { magrezaSevera: 16, baixoPeso: 18.5, sobrepeso: 25, obesidade: 30 } as const;
