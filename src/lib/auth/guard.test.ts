import { describe, expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { decidirAcessoApi } from './guard';

const fakeUser = { id: 'u1' } as User;

/**
 * Gating-3 (inerte-mas-pronto): sem Supabase configurado o portão passa (modo mock atual);
 * com Supabase vivo, exige usuário → 401. A decisão é pura — sem I/O.
 */
describe('decidirAcessoApi — portão de auth das rotas de compute', () => {
  it('SEM backend (configurado=false) → passa (null), preserva o modo mock', () => {
    expect(decidirAcessoApi(false, null)).toBeNull();
    expect(decidirAcessoApi(false, fakeUser)).toBeNull();
  });

  it('COM backend e SEM usuário → 401', () => {
    const r = decidirAcessoApi(true, null);
    expect(r).not.toBeNull();
    expect(r!.status).toBe(401);
  });

  it('COM backend e COM usuário → passa (null)', () => {
    expect(decidirAcessoApi(true, fakeUser)).toBeNull();
  });
});
