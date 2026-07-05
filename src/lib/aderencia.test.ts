import { describe, expect, it } from 'vitest';
import { faixaTint, limiarAderencia, streakAderencia } from './aderencia';

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

describe('streakAderencia — sequência GLOBAL, não limitada pela janela visível', () => {
  // Mapa dia→refeições seguidas; ausência = sem registro (quebra a sequência).
  const mapa = (seguidos: Record<string, number>) => (dia: string) =>
    dia in seguidos ? seguidos[dia]! : null;

  it('conta 11 dias seguidos mesmo além da janela de 7 (bug: mostrava 7 na Semana)', () => {
    const seguidos: Record<string, number> = {};
    for (let i = 0; i < 11; i++) {
      const d = new Date(Date.parse('2026-07-15T00:00:00Z') - i * 86_400_000).toISOString().slice(0, 10);
      seguidos[d] = 3; // plano de 4 → limiar 3 → conta
    }
    expect(streakAderencia('2026-07-15', mapa(seguidos), 4)).toBe(11);
  });

  it('para no 1º furo (dia sem registro OU abaixo do limiar)', () => {
    expect(streakAderencia('2026-07-05', mapa({ '2026-07-05': 3, '2026-07-04': 3 }), 4)).toBe(2); // 07-03 sem registro
    expect(streakAderencia('2026-07-05', mapa({ '2026-07-05': 3, '2026-07-04': 2, '2026-07-03': 3 }), 4)).toBe(1); // 07-04 abaixo do limiar (3)
    expect(streakAderencia('2026-07-05', mapa({ '2026-07-04': 3 }), 4)).toBe(0); // hoje sem registro
  });

  it('plano de 3 (limiar 2): um dia com 2 seguidas conta', () => {
    expect(streakAderencia('2026-07-05', mapa({ '2026-07-05': 2, '2026-07-04': 2 }), 3)).toBe(2);
    expect(streakAderencia('2026-07-05', mapa({ '2026-07-05': 1 }), 3)).toBe(0); // 1 < limiar 2
  });
});

describe('faixaTint — calor proporcional ao plano (0 vazio → 4 dia cheio)', () => {
  it('plano de 3: o dia PERFEITO (3/3) chega ao tier máximo (bug: travava em cnt>=4)', () => {
    expect(faixaTint(3, 3)).toBe(4);
    expect(faixaTint(2, 3)).toBe(3);
    expect(faixaTint(1, 3)).toBe(2);
    expect(faixaTint(0, 3)).toBe(0);
  });
  it('plano de 4: preserva o comportamento anterior (1,2,3,4)', () => {
    expect(faixaTint(4, 4)).toBe(4);
    expect(faixaTint(3, 4)).toBe(3);
    expect(faixaTint(2, 4)).toBe(2);
    expect(faixaTint(1, 4)).toBe(1);
  });
  it('cnt >= total sempre é dia cheio; total inválido → 0', () => {
    expect(faixaTint(5, 4)).toBe(4);
    expect(faixaTint(2, 0)).toBe(0);
  });
});
