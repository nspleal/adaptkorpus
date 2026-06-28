/**
 * Cálculo nutricional de pratos — SEMPRE pela soma dos ingredientes (TACO × gramas).
 * Regra travada (cofre): nunca recalcular kcal de alimento por 4/4/9; 4/4/9 é só p/ meta.
 */
import type { Food, Recipe, RecipeMacros } from './types';

/** Macros de uma quantidade (gramas) de um alimento. */
export function macrosDeAlimento(food: Food, gramas: number): RecipeMacros {
  const fator = gramas / 100;
  return {
    kcal: food.kcalPor100g * fator,
    proteinaG: food.proteinaPor100g * fator,
    carboidratoG: food.carboidratoPor100g * fator,
    gorduraG: food.gorduraPor100g * fator,
  };
}

/** Macros de um prato = soma dos ingredientes. Lança se faltar alimento referenciado. */
export function macrosDePrato(
  recipe: Recipe,
  foodsById: ReadonlyMap<string, Food>,
): RecipeMacros {
  const total: RecipeMacros = {
    kcal: 0,
    proteinaG: 0,
    carboidratoG: 0,
    gorduraG: 0,
  };
  for (const item of recipe.itens) {
    const food = foodsById.get(item.alimentoId);
    if (!food) {
      throw new Error(
        `Prato "${recipe.id}" referencia alimento inexistente: "${item.alimentoId}".`,
      );
    }
    const m = macrosDeAlimento(food, item.gramas);
    total.kcal += m.kcal;
    total.proteinaG += m.proteinaG;
    total.carboidratoG += m.carboidratoG;
    total.gorduraG += m.gorduraG;
  }
  return total;
}

/** Indexa uma lista de alimentos por id (helper). */
export function indexarFoods(foods: readonly Food[]): Map<string, Food> {
  return new Map(foods.map((f) => [f.id, f]));
}
