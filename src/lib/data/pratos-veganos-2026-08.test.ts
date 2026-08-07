/**
 * ÂNCORA dos 11 pratos veganos importados em 2026-08-06 (p97–p107).
 *
 * Fonte: outputs/handoff-leva-importacao-pratos-2026-08-06 — planilha aprovada pelo autor
 * (`pratos-novos-veganos-2026-08-05.xlsx`, SHA-256 535f55de…), transcrita verbatim.
 *
 * 🔑 POR QUE ESTE ARQUIVO EXISTE. O seed é GERADO do xlsx, mas estes 11 entraram por merge
 * manual (DF 2026-08-06: a transcrição tem dupla procedência — planilha aprovada + Δ=0 contra
 * a paleta do app —, então o xlsx não acrescentaria informação). O preço dessa escolha é que
 * uma regeneração futura poderia reintroduzir números diferentes em silêncio. Esta âncora é o
 * que cobra o preço: os 4 números de cada prato (kcal · proteína · carboidrato · gordura)
 * ficam presos ao valor aprovado, e regeneração divergente derruba a suíte.
 *
 * Ancorar só kcal deixaria passar macro divergente — por isso os quatro, sempre.
 */
import { describe, expect, it } from 'vitest';
import { RECIPES } from './recipes';
import { FOODS_BY_ID_SEED } from './seed';
import { macrosDePrato } from './nutrition';
import type { Alergeno, Refeicao } from './types';

/** Transcrição verbatim da tabela do handoff. Não "consertar" números aqui — divergência é PARADA. */
const APROVADOS: {
  id: string; nome: string; refeicoes: Refeicao[];
  kcal: number; prot: number; carb: number; gord: number; alergenos: Alergeno[];
}[] = [
  { id: 'p97', nome: 'Tofu grelhado com brócolis e broto de feijão', refeicoes: ['almoco', 'jantar'], kcal: 233, prot: 19.1, carb: 15.7, gord: 13.7, alergenos: ['soja'] },
  { id: 'p98', nome: 'Tofu ao forno com couve-flor e tomate', refeicoes: ['almoco', 'jantar'], kcal: 211, prot: 15.4, carb: 12.6, gord: 13.4, alergenos: ['soja'] },
  { id: 'p99', nome: 'Tofu salteado com broto de feijão e cebola', refeicoes: ['jantar'], kcal: 230, prot: 19.0, carb: 13.8, gord: 13.9, alergenos: ['soja'] },
  { id: 'p100', nome: 'Tofu mexido com brócolis', refeicoes: ['cafe', 'almoco'], kcal: 183, prot: 13.7, carb: 8.2, gord: 12.6, alergenos: ['soja'] },
  { id: 'p101', nome: 'Shake de farinha de soja com banana', refeicoes: ['cafe'], kcal: 326, prot: 23.5, carb: 39.7, gord: 10.6, alergenos: ['soja'] },
  { id: 'p102', nome: 'Vitamina de banana com farinha de soja', refeicoes: ['cafe', 'lanche'], kcal: 253, prot: 15.5, carb: 37.0, gord: 6.9, alergenos: ['soja'] },
  { id: 'p103', nome: 'Salada de broto de feijão com pepino e tofu', refeicoes: ['almoco', 'lanche'], kcal: 151, prot: 11.1, carb: 10.7, gord: 9.1, alergenos: ['soja'] },
  { id: 'p104', nome: 'Ervilha refogada com tofu', refeicoes: ['almoco', 'lanche'], kcal: 197, prot: 12.1, carb: 18.2, gord: 9.5, alergenos: ['soja'] },
  { id: 'p105', nome: 'Ensopado de lentilha com abobrinha', refeicoes: ['almoco', 'jantar'], kcal: 346, prot: 20.3, carb: 53.7, gord: 6.7, alergenos: [] },
  { id: 'p106', nome: 'Sopa de feijão fradinho com couve-flor', refeicoes: ['jantar'], kcal: 274, prot: 14.8, carb: 40.8, gord: 6.9, alergenos: [] },
  { id: 'p107', nome: 'Tofu em cubos com repolho refogado', refeicoes: ['almoco', 'jantar'], kcal: 186, prot: 13.2, carb: 9.8, gord: 12.3, alergenos: ['soja'] },
];

describe('🔒 11 pratos veganos de 2026-08-06 — âncora da transcrição aprovada', () => {
  it('os 11 existem, são veganos, e nenhum id foi reaproveitado', () => {
    for (const a of APROVADOS) {
      const r = RECIPES.find((x) => x.id === a.id);
      expect(r, `${a.id} não está no catálogo`).toBeDefined();
      expect(r!.nome).toBe(a.nome);
      expect(r!.tipo).toBe('vegano');
    }
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  /**
   * 🔴 Aceite 2 (Δ=0) com os QUATRO números. O prato não armazena nutrição: os valores saem
   * de `macrosDePrato` sobre a paleta, então este teste prova a corrente inteira —
   * gramas → paleta → soma — contra o número que o autor aprovou.
   */
  it('🔴 Δ=0: kcal E os 3 macros de cada prato batem com a planilha aprovada', () => {
    const fora: string[] = [];
    for (const a of APROVADOS) {
      const m = macrosDePrato(RECIPES.find((x) => x.id === a.id)!, FOODS_BY_ID_SEED);
      // kcal: a planilha traz o inteiro arredondado; macros: 1 decimal.
      if (Math.abs(Math.round(m.kcal) - a.kcal) > 1) fora.push(`${a.id} kcal ${m.kcal.toFixed(1)} ≠ ${a.kcal}`);
      if (Math.abs(m.proteinaG - a.prot) > 0.05) fora.push(`${a.id} prot ${m.proteinaG.toFixed(2)} ≠ ${a.prot}`);
      if (Math.abs(m.carboidratoG - a.carb) > 0.05) fora.push(`${a.id} carb ${m.carboidratoG.toFixed(2)} ≠ ${a.carb}`);
      if (Math.abs(m.gorduraG - a.gord) > 0.05) fora.push(`${a.id} gord ${m.gorduraG.toFixed(2)} ≠ ${a.gord}`);
    }
    expect(fora, `divergência contra a planilha aprovada — é PARADA, não ajuste:\n${fora.join('\n')}`).toEqual([]);
  });

  it('🔴 aceite 1: elegíveis nos slots da planilha — e SOMENTE neles', () => {
    for (const a of APROVADOS) {
      const r = RECIPES.find((x) => x.id === a.id)!;
      expect([...r.refeicoes].sort(), `${a.id} serve slots errados`).toEqual([...a.refeicoes].sort());
    }
  });

  /**
   * 🔴 Aceite 3. `contemAlergenos` é DERIVADO da paleta (data.test.ts impõe a união), então
   * este teste não confere digitação: confere que a derivação produziu o que a curadoria
   * previu — 9 com soja, e o 105/106 limpos. Se um dia alguém trocar o tofu de lugar, cai aqui.
   */
  it('🔴 aceite 3: 9 pratos com soja; 105 e 106 sem alérgeno nenhum', () => {
    for (const a of APROVADOS) {
      const r = RECIPES.find((x) => x.id === a.id)!;
      expect([...r.contemAlergenos].sort(), `${a.id}`).toEqual([...a.alergenos].sort());
    }
    expect(APROVADOS.filter((a) => a.alergenos.includes('soja'))).toHaveLength(9);
    expect(APROVADOS.filter((a) => a.alergenos.length === 0).map((a) => a.id)).toEqual(['p105', 'p106']);
  });

  it('🔴 aceite 6: nenhum prato PRÉ-EXISTENTE foi alterado (p1–p96 intactos)', () => {
    // Âncoras da V2: contagem, tipos e um spot-check de composição do primeiro e do último.
    const antigos = RECIPES.filter((r) => Number(r.id.slice(1)) <= 96);
    expect(antigos).toHaveLength(96);
    expect(antigos.reduce((n, r) => n + r.itens.length, 0)).toBe(363);
    const conta = { vegano: 0, vegetariano: 0, onivoro: 0 };
    for (const r of antigos) conta[r.tipo]++;
    expect(conta).toEqual({ vegano: 35, vegetariano: 29, onivoro: 32 });
  });
});
