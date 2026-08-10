/**
 * 🔴 ACEITE 1 da leva H — EXAUSTIVIDADE BILATERAL do `custoRelativo`.
 *
 * O Passo 0.2 do handoff ("existe alimento no seed fora dos 167, ou id dos 167 fora do seed?
 * qualquer sobra/falta é PARADA") vira guard permanente aqui — mesma forma do teste dos 163
 * exercícios → classe de descanso.
 *
 * 🔑 Por que BILATERAL e não só "todo alimento tem faixa": as duas direções falham por causas
 * diferentes. Alimento sem faixa = o montador o trataria como custo indefinido (defeito vivo).
 * Faixa sem alimento = curadoria referenciando id que sumiu do seed (dado morto que mascara
 * uma remoção). Um teste que só cobre uma direção deixa a outra passar em silêncio.
 */
import { describe, expect, it } from 'vitest';
import { FOODS } from './foods';
import {
  CUSTO_RELATIVO, CUSTO_RELATIVO_TRILHO, MOVIDOS_REGRA_6, JULGAMENTO_DECLARADO,
} from './custo-relativo';

describe('🔒 custoRelativo — exaustividade bilateral e procedência', () => {
  it('🔴 todo alimento do seed tem faixa (alimento novo sem faixa derruba a suíte)', () => {
    const semFaixa = FOODS.filter((f) => CUSTO_RELATIVO[f.id] === undefined).map((f) => `${f.id} ${f.nome}`);
    expect(semFaixa, `alimento(s) sem custoRelativo:\n${semFaixa.join('\n')}`).toEqual([]);
  });

  it('🔴 toda faixa aponta para um alimento existente (nenhuma faixa órfã)', () => {
    const ids = new Set(FOODS.map((f) => f.id));
    const orfas = Object.keys(CUSTO_RELATIVO).filter((id) => !ids.has(id));
    expect(orfas, `faixa(s) sem alimento no seed: ${orfas.join(', ')}`).toEqual([]);
  });

  it('vocabulário fechado: toda faixa é 1, 2 ou 3', () => {
    const fora = Object.entries(CUSTO_RELATIVO).filter(([, v]) => ![1, 2, 3].includes(v));
    expect(fora).toEqual([]);
  });

  /** Âncoras da curadoria (handoff §Apêndice): se a distribuição mudar, foi re-seed de dado. */
  it('distribuição da curadoria: 43 na faixa 1 · 73 na 2 · 51 na 3', () => {
    const conta = { 1: 0, 2: 0, 3: 0 };
    for (const v of Object.values(CUSTO_RELATIVO)) conta[v]++;
    expect(conta).toEqual({ 1: 43, 2: 73, 3: 51 });
    expect(Object.keys(CUSTO_RELATIVO)).toHaveLength(167);
  });

  it('o rastro da curadoria está declarado: 11 movidos pela regra 6, 47 sem base de preço', () => {
    expect(MOVIDOS_REGRA_6).toHaveLength(11);
    expect(JULGAMENTO_DECLARADO).toHaveLength(47);
    // e ambos os rastros apontam para alimentos que existem
    const ids = new Set(FOODS.map((f) => f.id));
    for (const id of [...MOVIDOS_REGRA_6, ...JULGAMENTO_DECLARADO]) expect(ids.has(id), id).toBe(true);
  });

  /**
   * 🔑 A arbitrariedade é DECLARADA, não escondida (armadilha 5). O rótulo de procedência é o
   * que torna "trocar a forma do corte" um re-seed de dado em vez de re-arquitetura — some o
   * rótulo, some a possibilidade de saber QUE dado está no ar.
   */
  it('o dado viaja rotulado com procedência e versão', () => {
    expect(CUSTO_RELATIVO_TRILHO.procedencia).toBe('curadoria');
    expect(CUSTO_RELATIVO_TRILHO.versao).toMatch(/2026-07-28/);
    expect(CUSTO_RELATIVO_TRILHO.versao).toMatch(/regra 6/);
    expect(CUSTO_RELATIVO_TRILHO.origem).toMatch(/sem base de preço/);
  });

  /** Spot-anchors: um por grupo, batendo com a tabela do apêndice do handoff. */
  it('spot-anchors da tabela aprovada', () => {
    expect(CUSTO_RELATIVO.a47).toBe(2);   // Tofu — julgamento declarado
    expect(CUSTO_RELATIVO.a115).toBe(2);  // Azeite extra virgem
    expect(CUSTO_RELATIVO.a42).toBe(1);   // Feijão fradinho
    expect(CUSTO_RELATIVO.a25).toBe(3);   // Salmão
    expect(CUSTO_RELATIVO.a41).toBe(3);   // Feijão carioca — ⚠️ movido pela regra 6 (era 2)
    expect(CUSTO_RELATIVO.a97).toBe(2);   // Brócolis — ⚠️ movido pela regra 6 (era 1)
    expect(CUSTO_RELATIVO.a18).toBe(1);   // Ovo inteiro cozido
  });
});
