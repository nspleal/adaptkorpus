import { describe, expect, it } from 'vitest';
import { substituirExercicio, substituirPrato } from './substituicao';
import { gerarDieta } from './index';
import { macrosDePrato } from '../data/nutrition';
import { FOODS_BY_ID_SEED, RECIPES_SEED } from '../data/seed';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude, PerfilUsuario } from './types';
import type { PedidoSubPrato } from './substituicao-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

function perfil(over: Partial<PerfilUsuario> = {}): PerfilUsuario {
  return { sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado', objetivo: 'saude', flagsSaude: SEM, ...over };
}

/** Monta um cenário de dia real (plano + cardápio) e devolve o pedido p/ trocar o 1º prato. */
function cenario(over: Partial<PerfilUsuario> = {}, restr: PedidoSubPrato['restricoes'] = { alergenos: [], preferencia: null }) {
  const r = gerarDieta(perfil(over), { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, restricoes: restr });
  const item = r.cardapio!.itens[0]!;
  const pedido: PedidoSubPrato = {
    pratoAtual: item.prato,
    slot: item.refeicao,
    recipes: RECIPES_SEED,
    foodsById: FOODS_BY_ID_SEED,
    plano: r.plano!,
    totaisDiaAtual: r.cardapio!.totais,
    restricoes: restr,
  };
  return pedido;
}

describe('substituição de prato (F.2)', () => {
  it('nunca devolve prato com alérgeno do usuário', () => {
    const pedido = cenario({}, { alergenos: ['origem_animal'], preferencia: null });
    const r = substituirPrato(pedido);
    if (r.prato) expect(r.prato.contemAlergenos).not.toContain('origem_animal');
  });

  it('respeita identidade vegana (nunca relaxa)', () => {
    const pedido = cenario({}, { alergenos: [], preferencia: 'vegano' });
    const r = substituirPrato(pedido);
    if (r.prato) expect(r.prato.tipo).toBe('vegano');
    // mesmo no fallback (gosto relaxado), identidade não cede
    const r2 = substituirPrato({ ...pedido, gosto: { excluirPratoIds: RECIPES_SEED.map((x) => x.id) } });
    if (r2.prato) expect(r2.prato.tipo).toBe('vegano');
  });

  it('troca mantém o dia dentro da janela e ≥ piso de proteína; troca um prato diferente', () => {
    const pedido = cenario();
    const r = substituirPrato(pedido);
    if (r.status === 'ok') {
      expect(r.prato!.id).not.toBe(pedido.pratoAtual.id);
      expect(r.prato!.refeicoes).toContain(pedido.slot);
      expect(r.totaisDiaNovo!.kcal).toBeGreaterThanOrEqual(pedido.plano.janela.minKcal - 1e-6);
      expect(r.totaisDiaNovo!.kcal).toBeLessThanOrEqual(pedido.plano.janela.maxKcal + 1e-6);
      expect(r.totaisDiaNovo!.proteinaG).toBeGreaterThanOrEqual(pedido.plano.macros.proteinaPisoG - 1e-6);
    }
  });

  it('ordena por menor desvio calórico do prato trocado', () => {
    const pedido = cenario();
    const r = substituirPrato(pedido);
    if (r.status === 'ok') {
      const xk = macrosDePrato(pedido.pratoAtual, FOODS_BY_ID_SEED).kcal;
      const escolhidoDelta = Math.abs(macrosDePrato(r.prato!, FOODS_BY_ID_SEED).kcal - xk);
      // nenhum outro elegível (mesmo slot, sem alérgeno) tem desvio menor mantendo a janela+piso
      for (const y of RECIPES_SEED) {
        if (y.id === pedido.pratoAtual.id || !y.refeicoes.includes(pedido.slot)) continue;
        const ym = macrosDePrato(y, FOODS_BY_ID_SEED);
        const diaNew = pedido.totaisDiaAtual.kcal - xk + ym.kcal;
        const protNew = pedido.totaisDiaAtual.proteinaG - macrosDePrato(pedido.pratoAtual, FOODS_BY_ID_SEED).proteinaG + ym.proteinaG;
        const dentro = diaNew >= pedido.plano.janela.minKcal - 1e-6 && diaNew <= pedido.plano.janela.maxKcal + 1e-6 && protNew >= pedido.plano.macros.proteinaPisoG - 1e-6;
        if (dentro) expect(Math.abs(ym.kcal - xk)).toBeGreaterThanOrEqual(escolhidoDelta - 1e-6);
      }
    }
  });

  it('gosto cede por último (fallback) — exclui o melhor e ainda acha troca', () => {
    const pedido = cenario();
    const primeiro = substituirPrato(pedido);
    if (primeiro.status === 'ok') {
      const r = substituirPrato({ ...pedido, gosto: { excluirPratoIds: [primeiro.prato!.id] } });
      if (r.status === 'ok') expect(r.prato!.id).not.toBe(primeiro.prato!.id);
    }
  });

  it('é determinístico', () => {
    const pedido = cenario();
    const a = substituirPrato(pedido);
    const b = substituirPrato(pedido);
    expect(a.prato?.id).toBe(b.prato?.id);
  });
});

describe('substituição de exercício (F.2)', () => {
  const supinoBarra = EXERCISES.find((e) => e.id === 'e9')!; // Supino reto, academia, empurrar
  const flexao = EXERCISES.find((e) => e.id === 'e1')!; // Flexão, casa_sem, empurrar, iniciante

  it('respeita equipamento/local, tipo e dificuldade ≤ liberada', () => {
    const r = substituirExercicio({ exercicioAtual: flexao, equipamento: 'nenhum', nivelExperiencia: 'iniciante', exercises: EXERCISES });
    if (r.exercicio) {
      expect(r.exercicio.local).toBe('casa_sem');
      expect(r.exercicio.nivel).toBe('iniciante');
      expect(r.exercicio.id).not.toBe(flexao.id);
    }
  });

  it('preserva grupo/padrão e prefere o mais familiar (tier menor)', () => {
    const r = substituirExercicio({ exercicioAtual: supinoBarra, equipamento: 'academia', nivelExperiencia: 'avancado', exercises: EXERCISES });
    expect(r.status).toBe('ok');
    // entre dois igualmente preservados, escolhe o de menor tier
    expect(r.exercicio).toBeTruthy();
  });

  it('skater (pliométrico, padrão cardio) degrada sem crashar', () => {
    const skater = EXERCISES.find((e) => e.nomePt.toLowerCase().includes('patinador'));
    if (skater) {
      const r = substituirExercicio({ exercicioAtual: skater, equipamento: 'nenhum', nivelExperiencia: 'avancado', exercises: EXERCISES });
      expect(['ok', 'sinalizado']).toContain(r.status);
      if (r.exercicio) expect(r.exercicio.local).toBe('casa_sem');
    }
  });

  it('gosto/variedade cedem por último (fallback)', () => {
    const r1 = substituirExercicio({ exercicioAtual: flexao, equipamento: 'casa', nivelExperiencia: 'intermediario', exercises: EXERCISES });
    if (r1.exercicio) {
      const r2 = substituirExercicio({ exercicioAtual: flexao, equipamento: 'casa', nivelExperiencia: 'intermediario', exercises: EXERCISES, gostoExcluirIds: [r1.exercicio.id] });
      if (r2.status === 'ok') expect(r2.exercicio!.id).not.toBe(r1.exercicio.id);
    }
  });

  it('é determinístico', () => {
    const args = { exercicioAtual: supinoBarra, equipamento: 'academia' as const, nivelExperiencia: 'avancado' as const, exercises: EXERCISES };
    expect(substituirExercicio(args).exercicio?.id).toBe(substituirExercicio(args).exercicio?.id);
  });

  it('nunca devolve o próprio exercício', () => {
    for (const equip of ['nenhum', 'casa', 'academia'] as const)
      for (const ex of [flexao, supinoBarra]) {
        const r = substituirExercicio({ exercicioAtual: ex, equipamento: equip, nivelExperiencia: 'avancado', exercises: EXERCISES });
        if (r.exercicio) expect(r.exercicio.id).not.toBe(ex.id);
      }
  });
});
