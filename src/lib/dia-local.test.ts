import { describe, expect, it } from 'vitest';
import { diaLocalISO } from './dia-local';

/**
 * Regressão do bug de aderência em UTC: um horário noturno LOCAL não pode "virar amanhã".
 * Testamos com objetos Date construídos no fuso local do runner — os getters locais
 * (getFullYear/Month/Date) devem devolver o dia-calendário local, nunca o de `toISOString`.
 */
describe('diaLocalISO — dia-calendário local, não UTC', () => {
  it('formata Y-M-D com zero-pad', () => {
    expect(diaLocalISO(new Date(2026, 0, 5, 8, 0))).toBe('2026-01-05'); // jan = mês 0
    expect(diaLocalISO(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('um horário noturno permanece no MESMO dia local (não avança)', () => {
    // 5 de julho, 21:30 LOCAL. Em UTC-3, toISOString() daria 2026-07-06 (bug antigo).
    const noite = new Date(2026, 6, 5, 21, 30);
    expect(diaLocalISO(noite)).toBe('2026-07-05');
    expect(diaLocalISO(noite)).toBe(`${noite.getFullYear()}-07-05`); // coerente com getters locais
  });

  it('meia-noite local mapeia para o próprio dia', () => {
    expect(diaLocalISO(new Date(2026, 6, 5, 0, 0))).toBe('2026-07-05');
  });
});
