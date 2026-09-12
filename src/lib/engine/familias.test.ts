import { describe, expect, it } from 'vitest';
import { FAMILIAS, familiaDe, mesmaFamilia } from './familias';
import { EXERCISES } from '../data/exercises';

/**
 * Âncoras da spec TRAVADA: cofre `parametros-motor-substituicao-adaptkorpus` §"Famílias
 * de equivalência" (DF 2026-07-04) — 20 famílias, membership verbatim.
 */
const byId = new Set(EXERCISES.map((e) => e.id));

describe('famílias de equivalência (cofre §Famílias)', () => {
  it('são exatamente 20 famílias', () => {
    expect(Object.keys(FAMILIAS)).toHaveLength(20);
  });

  it('todos os ids existem na biblioteca real', () => {
    for (const [fam, ids] of Object.entries(FAMILIAS))
      for (const id of ids) expect(byId.has(id), `${fam}: ${id} não existe`).toBe(true);
  });

  it('nenhum exercício em duas famílias', () => {
    const todos = Object.values(FAMILIAS).flat();
    expect(new Set(todos).size).toBe(todos.length);
  });

  it('membership verbatim das famílias-chave da DF', () => {
    expect(FAMILIAS['supino-horizontal']).toEqual(['e15', 'e11', 'e9']);
    expect(FAMILIAS['barra-fixa']).toEqual(['e116', 'e22', 'e21']);
    expect(FAMILIAS.flexao).toEqual(['e157', 'e156', 'e1', 'e113', 'e2', 'e100']);
    expect(FAMILIAS['cardio-continuo']).toEqual(['e24', 'e29', 'e31', 'e93']);
    expect(FAMILIAS['rosca-biceps']).toHaveLength(11);
  });

  it('cobertura total = 107 exercícios distintos', () => {
    expect(new Set(Object.values(FAMILIAS).flat()).size).toBe(107);
  });

  it('familiaDe/mesmaFamilia: membros resolvem; one-offs → null', () => {
    expect(familiaDe('e9')).toBe('supino-horizontal');
    expect(familiaDe('e116')).toBe('barra-fixa');
    expect(familiaDe('e108')).toBeNull(); // swing — one-off legítimo
    expect(familiaDe('e118')).toBeNull(); // pendura — one-off legítimo
    expect(mesmaFamilia('e9', 'e11')).toBe(true);
    expect(mesmaFamilia('e9', 'e10')).toBe(false); // horizontal ≠ inclinado
    expect(mesmaFamilia('e108', 'e108')).toBe(false); // fora de família nunca casa
  });
});
