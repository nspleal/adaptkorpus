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
  // Âncoras da V2 limpa (cofre: banco-alimentos §Expansão V2 + handoff-pratos-v2, 2026-07-01)
  // 🔒 2026-08-06: +11 pratos veganos (p97–p107, +41 ingredientes) — leva de importação.
  // 404 e não 405: a tabela de composição do handoff tem 41 linhas, não as 42 da prosa.
  // 🔒 2026-08-15: 163 + 5 = 168 exercícios — a leva `e164`–`e168` (puxar de casa sem
  // equipamento, curadoria do autor). O número aqui é ÂNCORA de curadoria: ele existe para
  // que ninguém edite `exercises.ts` à mão sem que apareça. Ele quebrou nesta importação
  // exatamente como devia, e só sobe junto com a leva que o justifica.
  it('contagens da base (167 alimentos · 107 pratos · 404 ingredientes · 168 exercícios)', () => {
    expect(FOODS).toHaveLength(167);
    expect(RECIPES).toHaveLength(107);
    expect(RECIPES.reduce((n, r) => n + r.itens.length, 0)).toBe(404);
    expect(EXERCISES).toHaveLength(168);
  });

  it('distribuição por tipo (vegano 46 · vegetariano 29 · onívoro 32)', () => {
    const conta = { vegano: 0, vegetariano: 0, onivoro: 0 };
    for (const r of RECIPES) conta[r.tipo]++;
    expect(conta).toEqual({ vegano: 46, vegetariano: 29, onivoro: 32 });
  });

  // Âncoras do grupoPrimario (cofre: parametros-motor-substituicao §2, DF 2026-07-04 —
  // 1ª entrada da coluna de grupo muscular da A1, vocabulário normalizado de 18 valores).
  // 🔑 Reescrito em 2026-08-15 como PROPRIEDADE, não como contagem: a regra é "TODO
  // exercício está classificado", e ela vale para 163, 168 ou 500. A versão anterior
  // ancorava `comGrupo === 151`, que quebra a cada importação legítima sem nada dizer
  // sobre a regra — e cujo conserto é sempre trocar o número, o pior tipo de verde.
  it('grupoPrimario: TODOS classificados — vocabulário fechado (12 valores) ou cardio', () => {
    const VOCAB = new Set([
      'antebraco', 'biceps', 'core', 'costas', 'gluteos', 'lombar',
      'ombros', 'panturrilha', 'peito', 'posterior', 'quadriceps', 'triceps',
    ]);
    // 🔒 12 valores ANATÔMICOS + `null` (DF 2026-07-27; destinos ratificados 2026-07-28):
    // `cardio` e `corpo-inteiro` saíram da anatomia e contam só pelo padrão de movimento.
    for (const e of EXERCISES) {
      if (e.grupoPrimario == null) {
        expect(e.padraoMovimento, `${e.id} sem grupo mas fora do cardio`).toBe('cardio');
        continue;
      }
      expect(VOCAB.has(e.grupoPrimario), `${e.id}: "${e.grupoPrimario}" fora do vocabulário`).toBe(true);
    }
    const comGrupo = EXERCISES.filter((e) => e.grupoPrimario != null);
    // Os 12 valores continuam TODOS em uso: nenhum some da base sem que se perceba.
    expect(new Set(comGrupo.map((e) => e.grupoPrimario)).size).toBe(12);
    // A propriedade: não existe exercício sem classificação. Um `grupoPrimario` esquecido
    // numa importação nova cai aqui, seja qual for o tamanho da base.
    const orfaos = EXERCISES.filter((e) => e.grupoPrimario == null && e.padraoMovimento !== 'cardio');
    expect(orfaos.map((e) => e.id), 'exercício sem grupo e fora do cardio').toEqual([]);
    // Âncora do CARDIO (independente do tamanho da base): são 12, e não cresce por acidente.
    expect(EXERCISES.filter((e) => e.grupoPrimario == null)).toHaveLength(12);
  });

  it('grupoPrimario: spot-anchors da curadoria do autor', () => {
    const g = (id: string) => EXERCISES.find((e) => e.id === id)!.grupoPrimario;
    expect(g('e1')).toBe('peito'); // Flexão
    expect(g('e9')).toBe('peito'); // Supino reto
    expect(g('e3')).toBe('quadriceps'); // Agachamento livre
    expect(g('e116')).toBe('costas'); // Remada invertida
    expect(g('e7')).toBe('core'); // Prancha
    // 🔒 Remap de 2026-07-27/28 — os destinos ratificados, ancorados um a um.
    expect(g('e24')).toBeNull();          // Esteira: cardio saiu da anatomia (é tipo)
    expect(g('e30')).toBeNull();          // Burpee: idem, por `corpo-inteiro`
    expect(g('e4')).toBe('core');         // Abdominal: `core` absorveu `abdomen`
    expect(g('e97')).toBe('costas');      // Encolhimento: o campo é anatomia, não split
    expect(g('e129')).toBe('gluteos');    // Cadeira adutora: adução é quadril
    expect(g('e143')).toBe('quadriceps'); // Avanço com salto
    expect(g('e163')).toBe('quadriceps'); // Agachamento com salto
    expect(g('e151')).toBe('quadriceps'); // Patinador (re-ratificado: mantém a troca viva)
  });

  it('rótulo amigável (vocabulário do cofre): 100% preenchido e único', () => {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const vistos = new Set<string>();
    for (const f of FOODS) {
      expect(f.rotuloAmigavel, `${f.id} sem rotuloAmigavel`).toBeTruthy();
      const n = norm(f.rotuloAmigavel!);
      expect(vistos.has(n), `rótulo repetido: ${f.rotuloAmigavel}`).toBe(false);
      vistos.add(n);
    }
  });

  it('Atwater: kcal ≈ 4P+4C+9G (desvio > ±12% E > 25 kcal = troca de coluna)', () => {
    for (const f of FOODS) {
      const atwater = 4 * f.proteinaPor100g + 4 * f.carboidratoPor100g + 9 * f.gorduraPor100g;
      const desvio = Math.abs(f.kcalPor100g - atwater);
      expect(desvio <= Math.max(0.12 * f.kcalPor100g, 25), `${f.id} "${f.nome}": kcal ${f.kcalPor100g} vs 4/4/9 ${atwater.toFixed(0)}`).toBe(true);
    }
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
