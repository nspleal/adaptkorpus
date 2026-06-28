/**
 * Ponto de entrada do motor determinístico do App Evokorpus.
 *
 * Orquestra: gate de saúde → (se PERMITIR/PISAR/RESTRINGIR) dieta → montagem do cardápio.
 * Postura fail-safe: ROTEAR → nenhum plano é gerado.
 */
export * from './types';
export * from './constants';
export * from './formulas';
export { avaliarGateSaude } from './health-gate';
export { gerarPlanoDieta } from './diet';
export {
  montarCardapioDia,
  type RestricoesUsuario,
  type CardapioDia,
  type StatusMontagem,
} from './assembler';

import { montarCardapioDia, type RestricoesUsuario, type CardapioDia } from './assembler';
import { gerarPlanoDieta } from './diet';
import { avaliarGateSaude } from './health-gate';
import type { Food, Recipe } from '../data/types';
import type { PerfilUsuario, PlanoDieta, ResultadoGate } from './types';

export interface ResultadoMotor {
  gate: ResultadoGate;
  /** null quando o gate é ROTEAR (nenhum plano gerado — orienta profissional). */
  plano: PlanoDieta | null;
  /** null quando não há plano ou quando não foram passados pratos para montar. */
  cardapio: CardapioDia | null;
}

/**
 * Executa o pipeline completo de dieta. Função PURA e determinística.
 * `recipes`/`foodsById` são opcionais: sem eles, calcula só o alvo (sem montar cardápio).
 */
export function gerarDieta(
  perfil: PerfilUsuario,
  opcoes?: {
    recipes?: readonly Recipe[];
    foodsById?: ReadonlyMap<string, Food>;
    restricoes?: RestricoesUsuario;
  },
): ResultadoMotor {
  const gate = avaliarGateSaude(perfil);

  if (gate.comportamento === 'ROTEAR') {
    return { gate, plano: null, cardapio: null };
  }

  const plano = gerarPlanoDieta(perfil, gate);

  let cardapio: CardapioDia | null = null;
  if (opcoes?.recipes && opcoes.foodsById) {
    cardapio = montarCardapioDia(
      plano,
      opcoes.recipes,
      opcoes.foodsById,
      opcoes.restricoes ?? { alergenos: [], preferencia: null },
    );
  }

  return { gate, plano, cardapio };
}
