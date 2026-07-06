import { describe, expect, it } from 'vitest';
import { decidirAcessoBeta } from './acesso-beta';

/** Regra 4.2.1: allowlist OU assinatura ativa/trial; todo o resto → /acesso-restrito. */
describe('decidirAcessoBeta', () => {
  it('allowlist libera (via beta), independente de assinatura', () => {
    expect(decidirAcessoBeta(true)).toEqual({ liberado: true, via: 'beta' });
    expect(decidirAcessoBeta(true, 'cancelada')).toEqual({ liberado: true, via: 'beta' });
  });

  it('assinatura ativa/trial libera (via assinatura)', () => {
    expect(decidirAcessoBeta(false, 'ativa')).toEqual({ liberado: true, via: 'assinatura' });
    expect(decidirAcessoBeta(false, 'trial')).toEqual({ liberado: true, via: 'assinatura' });
  });

  it('nega tudo o mais: sem status, inativa, inadimplente, cancelada, reembolsada', () => {
    for (const s of [undefined, null, 'inativa', 'inadimplente', 'cancelada', 'reembolsada', '']) {
      expect(decidirAcessoBeta(false, s).liberado).toBe(false);
    }
  });
});
