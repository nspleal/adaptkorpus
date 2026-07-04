import { describe, expect, it } from 'vitest';
import { MODIFICACOES_ISOMETRICOS, indiceBase, modificacoesDe, temModificacoes } from './modificacoes-isometricos';
import { REP_UNIT_SEGUNDOS, repUnitDe } from './isometricos';
import { EXERCISES } from '../data/exercises';

/**
 * Âncoras da spec TRAVADA: cofre `parametros-motor-treino-evokorpus`
 * §"Escada de modificações (ordenada)" (B1, DF 2026-07-04) — sequências e base verbatim.
 */
describe('modificações dos isométricos (cofre §Escada de modificações)', () => {
  it('cobre exatamente os 5 holds de repUnit=segundos', () => {
    expect(Object.keys(MODIFICACOES_ISOMETRICOS).sort()).toEqual([...REP_UNIT_SEGUNDOS].sort());
    for (const id of Object.keys(MODIFICACOES_ISOMETRICOS)) {
      expect(repUnitDe(id)).toBe('segundos');
      expect(EXERCISES.some((e) => e.id === id), `${id} existe na biblioteca`).toBe(true);
    }
  });

  it('exatamente uma base por escada', () => {
    for (const [id, mods] of Object.entries(MODIFICACOES_ISOMETRICOS)) {
      expect(mods.filter((m) => m.base).length, `${id}: 1 base`).toBe(1);
    }
  });

  it('e7 Prancha: sequência e base verbatim do cofre', () => {
    expect(MODIFICACOES_ISOMETRICOS.e7!.map((m) => m.nome)).toEqual([
      'Joelhos no chão',
      'Mãos elevadas (banco/parede)',
      'Prancha padrão',
      'Pés elevados',
      'Tirar um apoio (1 braço ou 1 perna)',
    ]);
    expect(indiceBase('e7')).toBe(2);
  });

  it('e90 Prancha lateral: sequência e base verbatim', () => {
    expect(MODIFICACOES_ISOMETRICOS.e90!.map((m) => m.nome)).toEqual([
      'Joelho de baixo apoiado',
      'Lateral padrão',
      'Pés elevados',
      'Braço/perna de cima estendidos',
    ]);
    expect(indiceBase('e90')).toBe(1);
  });

  it('e94 Agachamento na parede: sequência e base verbatim', () => {
    expect(MODIFICACOES_ISOMETRICOS.e94!.map((m) => m.nome)).toEqual([
      'Ângulo > 90° / mãos na coxa',
      '90° padrão',
      'Peso no colo',
      'Uma perna',
    ]);
    expect(indiceBase('e94')).toBe(1);
  });

  it('e118 Pendura na barra: sequência e base verbatim', () => {
    expect(MODIFICACOES_ISOMETRICOS.e118!.map((m) => m.nome)).toEqual([
      'Pés no apoio / faixa elástica',
      'Pendura passiva padrão',
      'Pegada mais estreita',
      'Pendura ativa (ombros ativos)',
      'Uma mão (avançado)',
    ]);
    expect(indiceBase('e118')).toBe(1);
  });

  it('e140 Pegada estática: sequência e base verbatim', () => {
    expect(MODIFICACOES_ISOMETRICOS.e140!.map((m) => m.nome)).toEqual([
      'Menos carga',
      'Carga padrão',
      'Mais carga',
      'Uma mão',
    ]);
    expect(indiceBase('e140')).toBe(1);
  });

  it('helpers: modificacoesDe/temModificacoes/indiceBase fora dos 5 → null/false/-1', () => {
    expect(modificacoesDe('e1')).toBeNull();
    expect(temModificacoes('e1')).toBe(false);
    expect(indiceBase('e1')).toBe(-1);
    expect(temModificacoes('e7')).toBe(true);
    expect(modificacoesDe('e7')).toHaveLength(5);
  });
});
