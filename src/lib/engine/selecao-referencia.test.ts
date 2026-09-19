/**
 * 🎯 Seleção por função e referência — o módulo puro (decisão do autor, 2026-09-19).
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { FAMILIAS } from './familias';
import {
  COMPLEMENTARES, ehComplementar, ehDiaDePernas, ehDiaDisponivel, ehReferencia, funcaoDe,
  rankReferencia, REFERENCIA_POR_GRUPO,
} from './selecao-referencia';

const ex = (id: string) => EXERCISES.find((e) => e.id === id)!;

describe('funcaoDe — a família do cofre, ou grupo/padrão para quem não tem', () => {
  it('quem tem família devolve a família, verbatim', () => {
    expect(funcaoDe(ex('e9'))).toBe('supino-horizontal');
    expect(funcaoDe(ex('e64'))).toBe('flexora-posterior');
    expect(funcaoDe(ex('e28'))).toBe('agachamento-bilateral');
    expect(funcaoDe(ex('e141'))).toBe('agachamento-bilateral');
  });
  it('a extensora (sem família) vira quadriceps/isolado; o supino fechado, triceps/empurrar', () => {
    expect(funcaoDe(ex('e62'))).toBe('quadriceps/isolado');
    expect(funcaoDe(ex('e63'))).toBe('quadriceps/isolado');
    expect(funcaoDe(ex('e70'))).toBe('triceps/empurrar');
  });
  it('as listas de referência só citam famílias do cofre ou grupo/padrão existentes', () => {
    const funcoes = new Set(EXERCISES.filter((e) => e.grupoPrimario).map(funcaoDe));
    for (const [grupo, lista] of Object.entries(REFERENCIA_POR_GRUPO)) {
      for (const f of lista!) {
        expect(f in FAMILIAS || funcoes.has(f), `${grupo}: função "${f}" não existe no catálogo`).toBe(true);
      }
    }
  });
});

describe('rankReferencia — a ordem que o autor pediu', () => {
  it('pernas: agachamento/leg press/hack são a MESMA função, e vêm antes da extensora e do afundo', () => {
    expect(rankReferencia(ex('e28'))).toBe(0); // leg press
    expect(rankReferencia(ex('e141'))).toBe(0); // hack
    expect(rankReferencia(ex('e32'))).toBe(0); // agachamento com barra
    expect(rankReferencia(ex('e62'))).toBe(1); // extensora
    expect(rankReferencia(ex('e16'))).toBe(2); // afundo
  });
  it('posterior: flexora antes do stiff; peito: supino antes do crucifixo e da flexão', () => {
    expect(rankReferencia(ex('e64'))).toBeLessThan(rankReferencia(ex('e80')));
    expect(rankReferencia(ex('e9'))).toBeLessThan(rankReferencia(ex('e14')));
    expect(rankReferencia(ex('e10'))).toBeLessThan(rankReferencia(ex('e1')));
  });
  it('costas: puxada e remada antes da barra fixa; função fora da lista fica por último', () => {
    expect(rankReferencia(ex('e49'))).toBe(0);
    expect(rankReferencia(ex('e46'))).toBe(1);
    expect(rankReferencia(ex('e22'))).toBe(2);
    expect(ehReferencia(ex('e126'))).toBe(false); // pullover
    expect(rankReferencia(ex('e126'))).toBe(3);
  });
  it('grupo sem lista (core, antebraço) é sempre referência, com rank 0', () => {
    expect(ehReferencia(ex('e147'))).toBe(true);
    expect(rankReferencia(ex('e147'))).toBe(0);
    expect(rankReferencia(ex('e73'))).toBe(0);
  });
});

describe('complementares e dias', () => {
  it('core, panturrilha e antebraço são os complementares; bíceps/tríceps não', () => {
    expect([...COMPLEMENTARES].sort()).toEqual(['antebraco', 'core', 'panturrilha']);
    expect(ehComplementar('biceps')).toBe(false);
    expect(ehComplementar(null)).toBe(false);
  });
  it('dia de pernas e dia disponível', () => {
    expect(ehDiaDePernas(['quadriceps', 'posterior', 'gluteos', 'panturrilha'])).toBe(true);
    expect(ehDiaDePernas(['peito', 'ombros', 'core'])).toBe(false);
    expect(ehDiaDisponivel(['panturrilha', 'core'])).toBe(true);
    expect(ehDiaDisponivel(['core', 'antebraco'])).toBe(true);
    expect(ehDiaDisponivel(['ombros', 'core'])).toBe(false);
    expect(ehDiaDisponivel([])).toBe(false);
  });

});
