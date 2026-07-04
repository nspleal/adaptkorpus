import { describe, expect, it } from 'vitest';
import { limiarAderencia } from './aderencia';

/** Âncoras da DF 2026-07-04 (registro-de-aderencia): ≥ ¾ arredondado. */
describe('limiarAderencia — ¾ das refeições, arredondado (DF 2026-07-04)', () => {
  it('plano de 3 refeições → 2 (o "3 fixo" exigiria 100% — rejeitado)', () => {
    expect(limiarAderencia(3)).toBe(2);
  });
  it('plano de 4 → 3 (comportamento igual ao anterior)', () => {
    expect(limiarAderencia(4)).toBe(3);
  });
  it('plano de 5 → 4 · plano de 6 → 5', () => {
    expect(limiarAderencia(5)).toBe(4);
    expect(limiarAderencia(6)).toBe(5);
  });
  it('piso 1 (nunca exige 0)', () => {
    expect(limiarAderencia(1)).toBe(1);
  });
});
