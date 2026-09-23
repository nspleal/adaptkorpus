/**
 * 🔒 O PLACAR COMPLETO (decisão do autor, 2026-09-19): todos os grupos acompanhados pelo
 * motor, inclusive zerados, com a unidade dita e sem verde artificial para quem não tem faixa.
 * E a frase positiva só fala por quem foi avaliado.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EXERCISES } from './data/exercises';
import { GRUPOS_DO_PLACAR, placarDaSemana, avaliarSemana, type ContextoCritico, type DiaDoEditor } from './engine/critico';
import { GRUPOS_GRANDES } from './engine/alocador';
import { fraseDaSemana, tituloDaLinha } from '@/components/painel/EditorTreino';

const ex = (id: string) => EXERCISES.find((e) => e.id === id)!;
const CTX: ContextoCritico = { nivel: 'intermediario', objetivo: 'massa', tempoPorSessaoMin: 60 };
const diaDe = (nome: string, ids: string[], series = 4): DiaDoEditor => ({ nome, exercicios: ids.map(ex), series: ids.map(() => series) });

describe('placarDaSemana — todos os grupos, zerados inclusive', () => {
  it('tem uma linha por grupo acompanhado (12), os seis grandes primeiro', () => {
    const placar = placarDaSemana([diaDe('A', ['e9'])], CTX);
    expect(placar.map((l) => l.grupo)).toEqual([...GRUPOS_DO_PLACAR]);
    expect(placar.slice(0, 6).map((l) => l.grupo)).toEqual([...GRUPOS_GRANDES]);
    expect(placar).toHaveLength(12);
  });
  it('grupo sem exercício aparece com 0 — não some', () => {
    const placar = placarDaSemana([diaDe('A', ['e9'])], CTX);
    const pant = placar.find((l) => l.grupo === 'panturrilha')!;
    expect(pant.ponderado).toBe(0);
    expect(pant.direto).toBe(0);
    expect(pant.status).toBe('sem_referencia');
  });
  it('a unidade é dita: direto + indireto (já a 0,5) = ponderado, em toda linha', () => {
    const placar = placarDaSemana([diaDe('A', ['e9', 'e72', 'e147', 'e80'])], CTX);
    for (const l of placar) expect(Math.round((l.direto + l.indireto) * 10) / 10, l.grupo).toBe(l.ponderado);
    const triceps = placar.find((l) => l.grupo === 'triceps')!;
    expect(triceps).toMatchObject({ direto: 0, indireto: 2, ponderado: 2 }); // supino reto credita tríceps a 0,5
    const antebraco = placar.find((l) => l.grupo === 'antebraco')!;
    expect(antebraco).toMatchObject({ direto: 0, indireto: 2 }); // rosca martelo credita antebraço
    const lombar = placar.find((l) => l.grupo === 'lombar')!;
    expect(lombar).toMatchObject({ direto: 0, indireto: 2 }); // bird dog credita lombar
  });
  it('grupo sem faixa: contagem e ausência de referência — nunca verde, nunca "abaixo"', () => {
    const placar = placarDaSemana([diaDe('A', ['e72', 'e74', 'e75', 'e19'])], CTX);
    const biceps = placar.find((l) => l.grupo === 'biceps')!;
    expect(biceps.ponderado).toBe(16);
    expect(biceps.temFaixa).toBe(false);
    expect(biceps.status).toBe('sem_referencia');
    expect(biceps.mev).toBeUndefined();
    expect(biceps.mrv).toBe(19);
    expect(biceps.temTeto).toBe(true);
    for (const l of placar.filter((x) => !x.temFaixa)) expect(l.status).toBe('sem_referencia');
  });
  it('os grandes continuam avaliados como antes (faixa, teto, máximo automático)', () => {
    const placar = placarDaSemana([diaDe('A', ['e9', 'e10', 'e14'])], CTX);
    const peito = placar.find((l) => l.grupo === 'peito')!;
    expect(peito.temFaixa).toBe(true);
    expect(peito).toMatchObject({ ponderado: 12, direto: 12, indireto: 0, status: 'na_banda', mev: 10, mrv: 19, maxAutomatico: 16 });
  });
  it('braços sem mínimo não geram aumento; o teto por sessão continua independente', () => {
    const a = avaliarSemana([diaDe('A', ['e72', 'e74', 'e75', 'e19', 'e67', 'e68', 'e69'])], CTX);
    for (const item of a.recomendacoes) {
      expect(['biceps', 'triceps'].includes(item.fato?.grupo ?? '')).toBe(false);
    }
    expect(a.avisos.some(i=>i.fato?.grupo==='biceps' && i.fato.escopo==='sessao')).toBe(true);
  });
});

describe('a frase da semana e o título do chip', () => {
  it('a frase positiva nomeia quem foi avaliado e quem ficou só com a contagem', () => {
    const placar = placarDaSemana([diaDe('A', ['e9'])], CTX);
    const frase = fraseDaSemana(placar);
    expect(frase).not.toMatch(/^Sua semana está dentro das faixas/);
    expect(frase).toMatch(/grupos com faixa definida \(Peito, Costas, Quadríceps, Posterior, Glúteos, Ombros\)/);
    expect(frase).toMatch(/Antebraço, Core, Panturrilhas, Lombar aparecem só com a contagem/);
    expect(frase).toMatch(/não foram avaliados/);
  });
  it('o título separa diretas de crédito indireto e diz quando não há faixa', () => {
    const placar = placarDaSemana([diaDe('A', ['e9', 'e72'])], CTX);
    expect(tituloDaLinha(placar.find((l) => l.grupo === 'peito')!)).toMatch(/4 séries ponderadas \(4 diretas \+ 0 de crédito indireto, já a 0,5\) · faixa 10–16 · teto 19/);
    expect(tituloDaLinha(placar.find((l) => l.grupo === 'triceps')!)).toMatch(/2 séries ponderadas \(0 diretas \+ 2 de crédito indireto, já a 0,5\) · máximo automático 16 · teto 19 · sem mínimo semanal definido/);
  });
  it('🔒 a tela não afirma mais "Sua semana está dentro das faixas" — e a frase depende só de quem tem faixa', () => {
    const fonte = readFileSync(new URL('../components/painel/EditorTreino.tsx', import.meta.url), 'utf8');
    expect(fonte).not.toContain('>Sua semana está dentro das faixas do seu nível.<');
    expect(fonte).toContain("placar.filter((l) => l.temFaixa).every((l) => l.status === 'na_banda')");
    expect(fonte).toContain('sem faixa');
  });
});
