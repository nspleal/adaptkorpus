import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/dieta/route';

/**
 * Hardening-1: as rotas de compute passaram a ter rate-limit (reusa `criarRateLimit`, como o
 * `/api/suporte`). Sem Supabase configurado (teste), o guard de auth passa — então o que
 * exercitamos aqui é o teto de 30/min por chave: a 31ª requisição do mesmo IP é negada (429).
 * As anteriores retornam 400 (body vazio) — o importante é que NÃO são 429 (o guard deixou passar).
 */
describe('rate-limit nas rotas de compute (Hardening-1)', () => {
  const req = () =>
    new NextRequest('http://localhost/api/dieta', { method: 'POST', headers: { 'x-forwarded-for': '9.9.9.9' } });

  it('a 31ª requisição do mesmo IP dentro da janela → 429', async () => {
    let ultima = 0;
    for (let i = 0; i < 30; i++) ultima = (await POST(req())).status;
    expect(ultima).not.toBe(429); // dentro do limite (guard passou; body vazio → 400)
    expect((await POST(req())).status).toBe(429); // estourou
  });
});
