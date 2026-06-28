import { describe, expect, it } from 'vitest';
import { FOODS } from './foods';
import { RECIPES } from './recipes';
import { EXERCISES } from './exercises';
import { FOODS_BY_ID_SEED } from './seed';
import { macrosDePrato } from './nutrition';
import { gerarDieta } from '../engine';
import type { FlagsSaude, PerfilUsuario } from '../engine';
import type { Alergeno } from './types';

const semFlags: FlagsSaude = {
  gestacaoAmamentacao: false,
  renal: false,
  cardiaca: false,
  lesao: false,
  diabetes: false,
};

describe('integridade da base curada', () => {
  it('contagens da base (125 alimentos · 56 pratos · 163 exercícios)', () => {
    expect(FOODS).toHaveLength(125);
    expect(RECIPES).toHaveLength(56);
    expect(EXERCISES).toHaveLength(163);
  });

  it('ids únicos em todas as tabelas', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });

  it('integridade referencial: todo ingrediente aponta para um alimento existente', () => {
    for (const r of RECIPES) {
      expect(r.itens.length).toBeGreaterThan(0);
      for (const it of r.itens) {
        expect(FOODS_BY_ID_SEED.has(it.alimentoId)).toBe(true);
        expect(it.gramas).toBeGreaterThan(0);
      }
    }
  });

  it('macros de todo prato são finitos e positivos (soma TACO × gramas)', () => {
    for (const r of RECIPES) {
      const m = macrosDePrato(r, FOODS_BY_ID_SEED);
      for (const v of [m.kcal, m.proteinaG, m.carboidratoG, m.gorduraG]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
      expect(m.kcal).toBeGreaterThan(0);
    }
  });

  it('contemAlergenos = união dos alérgenos dos ingredientes (consistência)', () => {
    for (const r of RECIPES) {
      const uniao = new Set<Alergeno>();
      for (const it of r.itens) {
        for (const a of FOODS_BY_ID_SEED.get(it.alimentoId)!.alergenos) uniao.add(a);
      }
      expect(new Set(r.contemAlergenos)).toEqual(uniao);
    }
  });

  it('todo prato serve ao menos uma refeição', () => {
    for (const r of RECIPES) expect(r.refeicoes.length).toBeGreaterThan(0);
  });
});

describe('motor + base real', () => {
  function perfil(over: Partial<PerfilUsuario> = {}): PerfilUsuario {
    return {
      sexo: 'masculino',
      pesoKg: 80,
      alturaCm: 180,
      idade: 30,
      nivelAtividade: 'moderado',
      objetivo: 'saude',
      flagsSaude: semFlags,
      ...over,
    };
  }

  for (const objetivo of ['emagrecimento', 'massa', 'saude'] as const) {
    it(`monta cardápio com a base real (objetivo: ${objetivo})`, () => {
      const r = gerarDieta(perfil({ objetivo }), {
        recipes: RECIPES,
        foodsById: FOODS_BY_ID_SEED,
        restricoes: { alergenos: [], preferencia: null },
      });
      expect(r.gate.comportamento).toBe('PERMITIR');
      expect(r.cardapio).not.toBeNull();
      expect(r.cardapio!.status).not.toBe('sem_candidatos');
      expect(r.cardapio!.itens.length).toBeGreaterThanOrEqual(3);
      expect(Number.isFinite(r.cardapio!.totais.kcal)).toBe(true);
    });
  }

  it('alergia (origem_animal) nunca aparece no cardápio gerado', () => {
    const r = gerarDieta(perfil({ objetivo: 'saude' }), {
      recipes: RECIPES,
      foodsById: FOODS_BY_ID_SEED,
      restricoes: { alergenos: ['origem_animal'], preferencia: null },
    });
    for (const it of r.cardapio!.itens) {
      expect(it.prato.contemAlergenos).not.toContain('origem_animal');
    }
  });

  it('é determinístico com a base real', () => {
    const args = {
      recipes: RECIPES,
      foodsById: FOODS_BY_ID_SEED,
      restricoes: { alergenos: [] as Alergeno[], preferencia: null },
    };
    const a = gerarDieta(perfil({ objetivo: 'emagrecimento' }), args);
    const b = gerarDieta(perfil({ objetivo: 'emagrecimento' }), args);
    expect(a.cardapio!.itens.map((i) => i.prato.id)).toEqual(
      b.cardapio!.itens.map((i) => i.prato.id),
    );
  });
});
