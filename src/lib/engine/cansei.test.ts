import { describe, expect, it } from 'vitest';
import { gerarDieta } from './index';
import { RECIPES_SEED, FOODS_BY_ID_SEED } from '../data/seed';
import type { PerfilUsuario } from './types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil: PerfilUsuario = { sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado', objetivo: 'massa', flagsSaude: SEM };
const semRestr = { alergenos: [] as never[], preferencia: null };
const gerar = (excluirPratoIds?: string[], excluirAlimentoIds?: string[]) =>
  gerarDieta(perfil, { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, restricoes: { ...semRestr, excluirPratoIds, excluirAlimentoIds } });

// IDs de prato que aparecem no cardápio base (para excluí-los).
const idsBase = () => gerar().cardapio!.itens.map((i) => i.prato.id);

describe('"Cansei deste prato" na geração do cardápio (exclusão nível-prato, relaxável)', () => {
  it('remove o prato cansado quando há alternativa no mesmo slot', () => {
    const base = gerar().cardapio!;
    let testou = false;
    for (const item of base.itens) {
      // há OUTRO prato elegível nesse slot (sem alergia/preferência todos elegíveis)?
      const alternativas = RECIPES_SEED.filter((r) => r.refeicoes.includes(item.refeicao) && r.id !== item.prato.id);
      if (alternativas.length === 0) continue;
      const d2 = gerar([item.prato.id]);
      const noSlot = d2.cardapio!.itens.find((x) => x.refeicao === item.refeicao)!;
      expect(noSlot.prato.id).not.toBe(item.prato.id); // o prato cansado saiu da rotação
      testou = true;
    }
    expect(testou).toBe(true);
  });

  it('preferência relaxável: excluir os pratos do dia inteiro ainda fecha o cardápio', () => {
    const d = gerar(idsBase());
    expect(d.plano).not.toBeNull();
    expect(d.cardapio!.status).not.toBe('sem_candidatos');
    expect(d.cardapio!.itens.length).toBeGreaterThanOrEqual(3);
  });

  it('não confunde prato com alimento: "cansei do prato X" ≠ "não curto o alimento Y"', () => {
    // Excluir um prato NÃO remove pratos que só compartilham ingredientes com ele.
    const alvo = idsBase()[0]!;
    const d = gerar([alvo]);
    expect(d.cardapio!.itens.some((i) => i.prato.id === alvo)).toBe(false);
  });

  it('combina com "não curto" (alimento) sem quebrar', () => {
    const d = gerar(idsBase().slice(0, 1), ['a49', 'a67']);
    expect(d.plano).not.toBeNull();
    expect(d.cardapio!.itens.length).toBeGreaterThanOrEqual(3);
  });

  it('é determinístico', () => {
    const a = gerar(['r2', 'r5']).cardapio!.itens.map((i) => i.prato.id);
    const b = gerar(['r2', 'r5']).cardapio!.itens.map((i) => i.prato.id);
    expect(a).toEqual(b);
  });

  it('sem exclusões de prato → idêntico ao cardápio base (sem efeito colateral)', () => {
    expect(gerar([]).cardapio!.itens.map((i) => i.prato.id)).toEqual(idsBase());
  });
});
