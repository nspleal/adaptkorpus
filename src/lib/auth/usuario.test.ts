import { describe, expect, it } from 'vitest';
import { inicialDe } from './usuario';

/** Avatar: inicial do NOME real; fallback e-mail; nunca "V" fixo (bug 2026-07-06). */
describe('inicialDe', () => {
  it('primeira letra do nome, maiúscula (trim + acentos)', () => {
    expect(inicialDe('lucas silva')).toBe('L');
    expect(inicialDe('  ana ')).toBe('A');
    expect(inicialDe('érico')).toBe('É');
  });

  it('sem nome → primeira letra do e-mail', () => {
    expect(inicialDe(undefined, 'maria@ex.com')).toBe('M');
    expect(inicialDe('', 'z@ex.com')).toBe('Z');
    expect(inicialDe('   ', 'b@ex.com')).toBe('B');
  });

  it('ambos vazios → string vazia (nunca um "V" fixo)', () => {
    expect(inicialDe()).toBe('');
    expect(inicialDe(null, null)).toBe('');
    expect(inicialDe('', '')).toBe('');
  });
});
