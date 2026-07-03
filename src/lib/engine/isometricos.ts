import type { Faixa, NivelExperiencia } from './treino-types';

/**
 * Isométricos (holds) — unidade de registro em SEGUNDOS + faixas de tempo por nível.
 *
 * Curadoria do cofre:
 *  - `fontes/ranking-exercicios-evokorpus` §"Unidade de registro (repUnit)" — os 5 holds abaixo
 *    registram `segundos` (o app mostra "Segundos" no lugar de "Reps"); todo o resto = `reps`.
 *  - `conceitos/parametros-motor-treino-evokorpus` §"Isométricos (holds)" (DF 2026-07-03) —
 *    faixas de tempo por nível (benchmark de mercado, registrado com ressalva) + piso de 10 s.
 *
 * Determinístico e sem relógio: são constantes ancoradas em teste (isometricos.test.ts).
 * NÃO progressão dinâmica (+5–10 s / modificação) nem peso do farmer hold — ficam p/ a fase de
 * motor ("Bloco B" do cofre). Aqui os 5 são tratados como TIME-ONLY (sem carga/volume).
 */

export type RepUnit = 'reps' | 'segundos';

/** IDs (chave `e{#}` = ranking A1) dos 5 isométricos que registram segundos. */
export const REP_UNIT_SEGUNDOS: ReadonlySet<string> = new Set(['e7', 'e90', 'e94', 'e118', 'e140']);

export function repUnitDe(id: string): RepUnit {
  return REP_UNIT_SEGUNDOS.has(id) ? 'segundos' : 'reps';
}

/** Piso de registro (segundos). Abaixo disso o motor sugere a modificação mais fácil (cofre). */
export const PISO_HOLD_SEG = 10;

/**
 * Passo da progressão de tempo (Passo 2, unidade = segundos — cofre §Isométricos):
 * "na medida" → +5–10 s / sessão · "difícil 2×" → −5–10 s. Passo único determinístico dentro
 * da faixa do cofre (análogo a +1 rep / −2 reps na progressão de reps).
 */
export const INCREMENTO_SEG = 5;
export const DECREMENTO_SEG = 5;

/** Faixa de tempo com marcação opcional de topo aberto (ex.: farmer hold avançado "60–90+"). */
export interface FaixaHold extends Faixa {
  aberto?: boolean;
}

/**
 * Faixas por nível (segundos) — verbatim do cofre §"Faixas por nível":
 * | # | Exercício            | Iniciante | Intermediário | Avançado |
 * | 7 | Prancha              | 20–40     | 40–70         | 70–120   |
 * | 90| Prancha lateral      | 15–30     | 30–50         | 50–90    |
 * | 94| Agachamento na parede| 20–45     | 45–75         | 75–120   |
 * |118| Pendura na barra     | 10–25     | 25–50         | 50–90    |
 * |140| Pegada estática      | 15–30     | 30–60         | 60–90+   |
 */
export const HOLD_SEGUNDOS: Record<string, Record<NivelExperiencia, FaixaHold>> = {
  e7: { iniciante: { min: 20, max: 40 }, intermediario: { min: 40, max: 70 }, avancado: { min: 70, max: 120 } },
  e90: { iniciante: { min: 15, max: 30 }, intermediario: { min: 30, max: 50 }, avancado: { min: 50, max: 90 } },
  e94: { iniciante: { min: 20, max: 45 }, intermediario: { min: 45, max: 75 }, avancado: { min: 75, max: 120 } },
  e118: { iniciante: { min: 10, max: 25 }, intermediario: { min: 25, max: 50 }, avancado: { min: 50, max: 90 } },
  e140: { iniciante: { min: 15, max: 30 }, intermediario: { min: 30, max: 60 }, avancado: { min: 60, max: 90, aberto: true } },
};

/** Faixa de segundos do hold para o nível do usuário; null se não for um hold conhecido. */
export function faixaSegundos(id: string, nivel: NivelExperiencia): FaixaHold | null {
  return HOLD_SEGUNDOS[id]?.[nivel] ?? null;
}

/** Rótulo curto da faixa de um hold (ex.: "20–40", ou "60–90+" com topo aberto). */
export function rotuloFaixaSeg(f: FaixaHold): string {
  return `${f.min}–${f.max}${f.aberto ? '+' : ''}`;
}
