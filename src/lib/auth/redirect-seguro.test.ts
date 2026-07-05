import { describe, expect, it } from 'vitest';
import { caminhoRelativoSeguro } from './redirect-seguro';

/** Anti open-redirect (§6 do playbook): `next` externo NUNCA sai do site. */
describe('caminhoRelativoSeguro', () => {
  it('aceita caminhos internos relativos', () => {
    expect(caminhoRelativoSeguro('/app')).toBe('/app');
    expect(caminhoRelativoSeguro('/onboarding?x=1')).toBe('/onboarding?x=1');
    expect(caminhoRelativoSeguro('/conta#sec')).toBe('/conta#sec');
  });

  it('rejeita externos, protocol-relative, esquema e backslash → fallback', () => {
    expect(caminhoRelativoSeguro('https://evil.com')).toBe('/app');
    expect(caminhoRelativoSeguro('//evil.com')).toBe('/app');
    expect(caminhoRelativoSeguro('/\\evil.com')).toBe('/app');
    expect(caminhoRelativoSeguro('http://x/y')).toBe('/app');
    expect(caminhoRelativoSeguro('javascript:alert(1)')).toBe('/app');
    expect(caminhoRelativoSeguro('/a\\b')).toBe('/app');
  });

  it('rejeita vazio/nulo e controle; respeita fallback custom', () => {
    expect(caminhoRelativoSeguro(null)).toBe('/app');
    expect(caminhoRelativoSeguro('')).toBe('/app');
    expect(caminhoRelativoSeguro('sem-barra')).toBe('/app');
    expect(caminhoRelativoSeguro(`/a${String.fromCharCode(10)}b`)).toBe('/app'); // \n
    expect(caminhoRelativoSeguro(null, '/login')).toBe('/login');
  });
});
