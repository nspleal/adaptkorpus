/**
 * Dados curados do app (base completa, validada Δ≈0):
 * V2 limpa: 167 alimentos (TACO 4ª ed., rotulo_amigavel do cofre) · 107 pratos · 404 ingredientes · 168 exercícios.
 * (163 + a leva `e164`–`e168` de 2026-08-15 — a contagem travada vive em `data.test.ts`.)
 * (96 pratos da V2 + 11 veganos de 2026-08-06 — ver o cabeçalho de recipes.ts.)
 *
 * Os arrays vivem em foods.ts / recipes.ts / exercises.ts (gerados do xlsx do autor).
 * Estes aliases mantêm a API usada pela UI/motor.
 */
import { indexarFoods } from './nutrition';
import { FOODS } from './foods';
import { RECIPES } from './recipes';
import { EXERCISES } from './exercises';

export const FOODS_SEED = FOODS;
export const RECIPES_SEED = RECIPES;
export const EXERCISES_SEED = EXERCISES;
export const FOODS_BY_ID_SEED = indexarFoods(FOODS);
