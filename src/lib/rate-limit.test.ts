import { describe, expect, it } from 'vitest';
import { criarRateLimit } from './rate-limit';

describe('rate limit (relógio injetável)', () => {
  it('permite até o limite e nega o excedente na mesma janela', () => {
    const rl = criarRateLimit({ limite: 3, janelaMs: 10_000 });
    const t0 = 1_000_000;
    expect(rl.permitir('ip1', t0)).toBe(true);
    expect(rl.permitir('ip1', t0 + 1)).toBe(true);
    expect(rl.permitir('ip1', t0 + 2)).toBe(true);
    expect(rl.permitir('ip1', t0 + 3)).toBe(false); // 4º na janela
  });

  it('libera quando a janela desliza', () => {
    const rl = criarRateLimit({ limite: 2, janelaMs: 1_000 });
    const t0 = 5_000;
    expect(rl.permitir('k', t0)).toBe(true);
    expect(rl.permitir('k', t0 + 10)).toBe(true);
    expect(rl.permitir('k', t0 + 20)).toBe(false);
    expect(rl.permitir('k', t0 + 1_011)).toBe(true); // o 1º evento saiu da janela
  });

  it('chaves independentes não interferem', () => {
    const rl = criarRateLimit({ limite: 1, janelaMs: 1_000 });
    expect(rl.permitir('a', 0)).toBe(true);
    expect(rl.permitir('b', 0)).toBe(true);
    expect(rl.permitir('a', 1)).toBe(false);
  });
});
