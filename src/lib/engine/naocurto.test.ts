import { describe, expect, it } from 'vitest';
import { gerarDieta } from './index';
import { RECIPES_SEED, FOODS_BY_ID_SEED } from '../data/seed';
import type { PerfilUsuario } from './types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil: PerfilUsuario = { sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado', objetivo: 'massa', flagsSaude: SEM };
const semRestr = { alergenos: [] as never[], preferencia: null };
const gerar = (excluir?: string[]) => gerarDieta(perfil, { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, restricoes: { ...semRestr, excluirAlimentoIds: excluir } });

describe('"não curto" na geração do cardápio (preferência relaxável)', () => {
  it('evita o alimento indesejado numa refeição obrigatória quando há alternativa', () => {
    const base = gerar();
    expect(base.cardapio?.status).toBeDefined();
    const OBRIG = new Set(['cafe', 'almoco', 'jantar']);
    let testou = false;
    for (const item of base.cardapio!.itens) {
      if (!OBRIG.has(item.refeicao)) continue;
      for (const it of item.prato.itens) {
        const foodId = it.alimentoId;
        // existe outro prato dessa refeição SEM esse alimento? (todos elegíveis: perfil sem alergia/pref)
        const temAlternativaSem = RECIPES_SEED.some(
          (r) => r.refeicoes.includes(item.refeicao) && !r.itens.some((x) => x.alimentoId === foodId),
        );
        if (!temAlternativaSem) continue;
        const d2 = gerar([foodId]);
        const item2 = d2.cardapio!.itens.find((x) => x.refeicao === item.refeicao)!;
        expect(item2.prato.itens.some((x) => x.alimentoId === foodId)).toBe(false); // evitado
        testou = true;
      }
    }
    expect(testou).toBe(true);
  });

  it('preferência não quebra o plano: exclusão realista ainda fecha o cardápio', () => {
    // conjunto realista de "não curto" — o cardápio precisa fechar (preferência relaxável)
    const d = gerar(['a19', 'a26', 'a16', 'a3', 'a22', 'a5']);
    expect(d.plano).not.toBeNull();
    expect(d.cardapio!.itens.length).toBeGreaterThanOrEqual(3); // café+almoço+jantar continuam
    expect(['ok', 'fora_da_janela']).toContain(d.cardapio!.status);
  });

  it('colisão entre slots (filtro esvazia distinção) → relaxa por completo e fecha', () => {
    // Caso real: com este "não curto", almoço e jantar filtrados colapsam no MESMO prato.
    // O per-slot não relaxa (nenhum slot fica vazio); a distinção café≠almoço≠jantar falha.
    // O 2º passo relaxa por completo e o cardápio fecha (era 'sem_candidatos' antes do fix).
    const d = gerar(['a103', 'a14', 'a18', 'a36', 'a42', 'a47', 'a49', 'a60', 'a68', 'a90', 'a97']);
    expect(d.plano).not.toBeNull();
    expect(d.cardapio!.status).not.toBe('sem_candidatos');
    expect(d.cardapio!.itens.length).toBeGreaterThanOrEqual(3);
  });

  it('é determinístico', () => {
    const a = gerar(['a67', 'a49']).cardapio!.itens.map((i) => i.prato.id);
    const b = gerar(['a67', 'a49']).cardapio!.itens.map((i) => i.prato.id);
    expect(a).toEqual(b);
  });

  it('sem exclusões → idêntico ao cardápio base (sem efeito colateral)', () => {
    const a = gerar().cardapio!.itens.map((i) => i.prato.id);
    const b = gerar([]).cardapio!.itens.map((i) => i.prato.id);
    expect(a).toEqual(b);
  });
});
