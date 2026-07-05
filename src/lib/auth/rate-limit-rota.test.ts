import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/dieta/route';

/**
 * Hardening-1: as rotas de compute têm rate-limit (reusa `criarRateLimit`, como o `/api/suporte`).
 * Forçamos MODO MOCK (envs do Supabase vazias) para o guard de auth passar e exercitar o teto de
 * 30/min por chave: a 31ª requisição do mesmo IP é negada (429). As anteriores retornam 400 (body
 * vazio) — o importante é que NÃO são 429/401. (Com Supabase configurado, o guard devolve 401 antes,
 * coberto por `guard.test.ts`.)
 */
describe('rate-limit nas rotas de compute (Hardening-1)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  const req = () =>
    new NextRequest('http://localhost/api/dieta', { method: 'POST', headers: { 'x-forwarded-for': '9.9.9.9' } });

  it('a 31ª requisição do mesmo IP dentro da janela → 429', async () => {
    let ultima = 0;
    for (let i = 0; i < 30; i++) ultima = (await POST(req())).status;
    expect(ultima).not.toBe(429); // dentro do limite (guard passou; body vazio → 400)
    expect((await POST(req())).status).toBe(429); // estourou
  });
});
