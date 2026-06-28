/**
 * Seed de demonstração (espelha supabase/migrations/0003_seed_reference.sql).
 * Permite o app montar um cardápio de ponta a ponta antes da base completa entrar
 * no Supabase. NÃO é a base final (163 exercícios · 125 alimentos · 56 pratos).
 */
import { indexarFoods } from './nutrition';
import type { Food, Recipe } from './types';

export const FOODS_SEED: Food[] = [
  { id: 'arroz', nome: 'Arroz branco cozido', fonteTaco: 1, grupo: 'grao_cereal_tuberculo', kcalPor100g: 128, proteinaPor100g: 2.5, carboidratoPor100g: 28, gorduraPor100g: 0.2, alergenos: [] },
  { id: 'feijao', nome: 'Feijão carioca cozido', fonteTaco: 2, grupo: 'leguminosa_proteina_vegetal', kcalPor100g: 76, proteinaPor100g: 4.8, carboidratoPor100g: 13.6, gorduraPor100g: 0.5, alergenos: [] },
  { id: 'frango', nome: 'Frango grelhado (peito)', fonteTaco: 3, grupo: 'proteina_animal', kcalPor100g: 159, proteinaPor100g: 32, carboidratoPor100g: 0, gorduraPor100g: 2.5, alergenos: ['origem_animal'] },
  { id: 'ovo', nome: 'Ovo de galinha cozido', fonteTaco: 4, grupo: 'proteina_animal', kcalPor100g: 146, proteinaPor100g: 13, carboidratoPor100g: 0.6, gorduraPor100g: 9.5, alergenos: ['origem_animal', 'ovo'] },
  { id: 'banana', nome: 'Banana prata', fonteTaco: 5, grupo: 'fruta', kcalPor100g: 92, proteinaPor100g: 1.4, carboidratoPor100g: 23, gorduraPor100g: 0.1, alergenos: [] },
  { id: 'aveia', nome: 'Aveia em flocos', fonteTaco: 6, grupo: 'grao_cereal_tuberculo', kcalPor100g: 394, proteinaPor100g: 14, carboidratoPor100g: 67, gorduraPor100g: 8, alergenos: ['gluten'] },
  { id: 'tofu', nome: 'Tofu', fonteTaco: 7, grupo: 'leguminosa_proteina_vegetal', kcalPor100g: 64, proteinaPor100g: 6.6, carboidratoPor100g: 2, gorduraPor100g: 4, alergenos: ['soja'] },
  { id: 'batata', nome: 'Batata cozida', fonteTaco: 8, grupo: 'grao_cereal_tuberculo', kcalPor100g: 86, proteinaPor100g: 1.7, carboidratoPor100g: 20, gorduraPor100g: 0.1, alergenos: [] },
];

export const RECIPES_SEED: Recipe[] = [
  { id: 'cafe_aveia_banana', nome: 'Aveia com banana', refeicao: 'cafe', tipo: 'vegano', itens: [{ alimentoId: 'aveia', gramas: 40 }, { alimentoId: 'banana', gramas: 100 }], contemAlergenos: ['gluten'] },
  { id: 'cafe_ovos', nome: 'Ovos cozidos', refeicao: 'cafe', tipo: 'vegetariano', itens: [{ alimentoId: 'ovo', gramas: 100 }], contemAlergenos: ['origem_animal', 'ovo'] },
  { id: 'almoco_tofu_arroz', nome: 'Tofu com arroz', refeicao: 'almoco', tipo: 'vegano', itens: [{ alimentoId: 'tofu', gramas: 200 }, { alimentoId: 'arroz', gramas: 150 }], contemAlergenos: ['soja'] },
  { id: 'almoco_frango', nome: 'Frango, arroz e feijão', refeicao: 'almoco', tipo: 'onivoro', itens: [{ alimentoId: 'frango', gramas: 150 }, { alimentoId: 'arroz', gramas: 150 }, { alimentoId: 'feijao', gramas: 100 }], contemAlergenos: ['origem_animal'] },
  { id: 'jantar_feijao_arroz', nome: 'Feijão com arroz', refeicao: 'jantar', tipo: 'vegano', itens: [{ alimentoId: 'feijao', gramas: 150 }, { alimentoId: 'arroz', gramas: 150 }], contemAlergenos: [] },
  { id: 'jantar_frango', nome: 'Frango com batata', refeicao: 'jantar', tipo: 'onivoro', itens: [{ alimentoId: 'frango', gramas: 120 }, { alimentoId: 'batata', gramas: 200 }], contemAlergenos: ['origem_animal'] },
  { id: 'lanche_banana', nome: 'Banana', refeicao: 'lanche', tipo: 'vegano', itens: [{ alimentoId: 'banana', gramas: 120 }], contemAlergenos: [] },
];

export const FOODS_BY_ID_SEED = indexarFoods(FOODS_SEED);
