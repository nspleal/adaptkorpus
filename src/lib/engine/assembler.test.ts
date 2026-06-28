import { describe, expect, it } from 'vitest';
import { montarCardapioDia } from './assembler';
import { indexarFoods } from '../data/nutrition';
import type { Food, Recipe } from '../data/types';
import type { PlanoDieta } from './types';

const foods: Food[] = [
  { id: 'arroz', nome: 'Arroz cozido', grupo: 'grao_cereal_tuberculo', kcalPor100g: 128, proteinaPor100g: 2.5, carboidratoPor100g: 28, gorduraPor100g: 0.2, alergenos: [] },
  { id: 'feijao', nome: 'Feijão cozido', grupo: 'leguminosa_proteina_vegetal', kcalPor100g: 76, proteinaPor100g: 4.8, carboidratoPor100g: 13.6, gorduraPor100g: 0.5, alergenos: [] },
  { id: 'frango', nome: 'Frango grelhado', grupo: 'proteina_animal', kcalPor100g: 159, proteinaPor100g: 32, carboidratoPor100g: 0, gorduraPor100g: 2.5, alergenos: ['origem_animal'] },
  { id: 'ovo', nome: 'Ovo cozido', grupo: 'proteina_animal', kcalPor100g: 146, proteinaPor100g: 13, carboidratoPor100g: 0.6, gorduraPor100g: 9.5, alergenos: ['origem_animal', 'ovo'] },
  { id: 'banana', nome: 'Banana', grupo: 'fruta', kcalPor100g: 92, proteinaPor100g: 1.4, carboidratoPor100g: 23, gorduraPor100g: 0.1, alergenos: [] },
  { id: 'aveia', nome: 'Aveia', grupo: 'grao_cereal_tuberculo', kcalPor100g: 394, proteinaPor100g: 14, carboidratoPor100g: 67, gorduraPor100g: 8, alergenos: ['gluten'] },
  { id: 'tofu', nome: 'Tofu', grupo: 'leguminosa_proteina_vegetal', kcalPor100g: 64, proteinaPor100g: 6.6, carboidratoPor100g: 2, gorduraPor100g: 4, alergenos: ['soja'] },
];

const recipes: Recipe[] = [
  { id: 'cafe_aveia_banana', nome: 'Aveia com banana', refeicao: 'cafe', tipo: 'vegano', itens: [{ alimentoId: 'aveia', gramas: 40 }, { alimentoId: 'banana', gramas: 100 }], contemAlergenos: ['gluten'] },
  { id: 'cafe_ovos', nome: 'Ovos cozidos', refeicao: 'cafe', tipo: 'vegetariano', itens: [{ alimentoId: 'ovo', gramas: 100 }], contemAlergenos: ['origem_animal', 'ovo'] },
  { id: 'almoco_tofu_arroz', nome: 'Tofu com arroz', refeicao: 'almoco', tipo: 'vegano', itens: [{ alimentoId: 'tofu', gramas: 200 }, { alimentoId: 'arroz', gramas: 150 }], contemAlergenos: ['soja'] },
  { id: 'almoco_frango', nome: 'Frango, arroz e feijão', refeicao: 'almoco', tipo: 'onivoro', itens: [{ alimentoId: 'frango', gramas: 150 }, { alimentoId: 'arroz', gramas: 150 }, { alimentoId: 'feijao', gramas: 100 }], contemAlergenos: ['origem_animal'] },
  { id: 'jantar_feijao_arroz', nome: 'Feijão com arroz', refeicao: 'jantar', tipo: 'vegano', itens: [{ alimentoId: 'feijao', gramas: 150 }, { alimentoId: 'arroz', gramas: 150 }], contemAlergenos: [] },
  { id: 'jantar_frango', nome: 'Frango com arroz', refeicao: 'jantar', tipo: 'onivoro', itens: [{ alimentoId: 'frango', gramas: 120 }, { alimentoId: 'arroz', gramas: 120 }], contemAlergenos: ['origem_animal'] },
  { id: 'lanche_banana', nome: 'Banana', refeicao: 'lanche', tipo: 'vegano', itens: [{ alimentoId: 'banana', gramas: 120 }], contemAlergenos: [] },
];

const foodsById = indexarFoods(foods);

function plano(over: Partial<PlanoDieta> = {}): PlanoDieta {
  return {
    comportamento: 'PERMITIR',
    kcalAlvo: 900,
    macros: { proteinaG: 60, gorduraG: 25, carboidratoG: 120, kcalProteina: 240, kcalGordura: 225, kcalCarboidrato: 480, proteinaPisoG: 50 },
    janela: { minKcal: 800, maxKcal: 1000 },
    derivados: { imc: 22, tmb: 1500, get: 1900, pisoSeguro: 1550 },
    motivos: [],
    avisos: [],
    ...over,
  };
}

describe('montador de cardápio (Bloco B v0)', () => {
  it('NUNCA inclui prato com alérgeno do usuário (filtro absoluto)', () => {
    const r = montarCardapioDia(plano(), recipes, foodsById, {
      alergenos: ['origem_animal'],
      preferencia: null,
    });
    for (const p of r.pratos) {
      expect(p.contemAlergenos).not.toContain('origem_animal');
    }
  });

  it('mantém o alérgeno absoluto mesmo quando isso impede fechar a janela', () => {
    // alvo altíssimo: nenhum combo vegano fecha, mas frango/ovo continuam BANIDOS
    const r = montarCardapioDia(plano({ kcalAlvo: 5000, janela: { minKcal: 4800, maxKcal: 5200 } }), recipes, foodsById, {
      alergenos: ['origem_animal'],
      preferencia: null,
    });
    expect(r.status).toBe('fora_da_janela');
    for (const p of r.pratos) {
      expect(p.contemAlergenos).not.toContain('origem_animal');
    }
    expect(r.nota).toContain('nenhum alérgeno foi afrouxado');
  });

  it('escolhe o cardápio dentro da janela com menor desvio calórico', () => {
    const r = montarCardapioDia(plano(), recipes, foodsById, {
      alergenos: ['origem_animal'],
      preferencia: null,
    });
    expect(r.status).toBe('ok');
    expect(r.totais.kcal).toBeGreaterThanOrEqual(800);
    expect(r.totais.kcal).toBeLessThanOrEqual(1000);
  });

  it('é determinístico (mesmo input → mesma saída)', () => {
    const restr = { alergenos: ['origem_animal'] as const, preferencia: null };
    const a = montarCardapioDia(plano(), recipes, foodsById, { ...restr, alergenos: [...restr.alergenos] });
    const b = montarCardapioDia(plano(), recipes, foodsById, { ...restr, alergenos: [...restr.alergenos] });
    expect(a.pratos.map((p) => p.id)).toEqual(b.pratos.map((p) => p.id));
  });

  it('sinaliza sem_candidatos quando uma refeição obrigatória fica vazia', () => {
    // soja + origem_animal eliminam todos os almoços
    const r = montarCardapioDia(plano(), recipes, foodsById, {
      alergenos: ['origem_animal', 'soja'],
      preferencia: null,
    });
    expect(r.status).toBe('sem_candidatos');
  });

  it('respeita preferência vegana (cede antes do alérgeno, nunca o alérgeno)', () => {
    const r = montarCardapioDia(plano(), recipes, foodsById, {
      alergenos: [],
      preferencia: 'vegano',
    });
    for (const p of r.pratos) {
      expect(p.tipo).toBe('vegano');
    }
  });
});
