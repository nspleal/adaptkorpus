import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { rpc, contexto } = vi.hoisted(() => ({ rpc: vi.fn(), contexto: vi.fn() }));
vi.mock('@/lib/persistencia/servidor', () => ({
  contextoUsuario: contexto,
}));
vi.mock('@/lib/auth/guard', () => ({ barreiraDados: () => null }));

const CORPO = { dia: '2026-09-10', logs: { cafe: 'seguiu' }, notes: {} };
async function gravar(corpo: unknown = CORPO) {
  const { PUT } = await import('./route');
  const req = new NextRequest('https://app/api/dados/aderencia', {
    method: 'PUT', body: JSON.stringify(corpo), headers: { 'content-type': 'application/json' },
  });
  const res = await PUT(req);
  return { status: res.status, corpo: await res.json() as Record<string, unknown> };
}
beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ error: null, status: 204 });
  contexto.mockReset().mockResolvedValue({ user: { id: 'u1' }, supabase: { rpc } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('PUT /api/dados/aderencia — RPC com conflito parcial', () => {
  it('grava com sucesso pelo contrato da RPC', async () => {
    expect(await gravar()).toEqual({ status: 200, corpo: { ok: true } });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('registrar_aderencia_dia', {
      p_dia: CORPO.dia, p_payload: { logs: CORPO.logs, notes: CORPO.notes },
    });
  });
  it('não recebe identidade do corpo: a RPC resolve auth.uid()', async () => {
    await gravar({ ...CORPO, user_id: 'outro-usuario' });
    expect(rpc.mock.calls[0]![1]).toEqual({
      p_dia: CORPO.dia, p_payload: { logs: CORPO.logs, notes: CORPO.notes },
    });
  });
  it('falha da RPC vira 500 explícito', async () => {
    rpc.mockResolvedValue({ error: { code: '42501' } });
    expect(await gravar()).toEqual({ status: 500, corpo: { error: 'falha_gravacao' } });
  });
  it('entrada inválida é recusada antes do banco', async () => {
    expect((await gravar({ dia: '10/09/2026', logs: {}, notes: {} })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('504 upstream é registrado sem dados pessoais e não vira sucesso nem retry de escrita', async () => {
    rpc.mockResolvedValue({ error: { message: 'dado-saude-privado', details: 'token-secreto' }, status: 504 });
    expect(await gravar()).toEqual({ status: 500, corpo: { error: 'falha_gravacao' } });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
    const evento = JSON.parse(vi.mocked(console.error).mock.calls[0]![0] as string);
    expect(evento).toEqual({ evento: 'aderencia_falhou', etapa: 'rpc', status: 500, upstreamStatus: 504, duracaoMs: expect.any(Number) });
    expect(evento.duracaoMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(evento)).not.toMatch(/u1|2026-09|seguiu|saude|token|cafe/);
  });

  it('exceção de transporte mantém resposta de falha controlada sem vazar a exceção', async () => {
    rpc.mockRejectedValue(new Error('segredo-na-url'));
    expect(await gravar()).toEqual({ status: 500, corpo: { error: 'falha_gravacao' } });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0]![0] as string)).toEqual({ evento: 'aderencia_falhou', etapa: 'rpc', status: 500, duracaoMs: expect.any(Number) });
  });

  it('distingue recusa de autenticação de falha da RPC sem alegar a causa do 401', async () => {
    contexto.mockResolvedValue(NextResponse.json({ error: 'nao_autenticado' }, { status: 401 }));
    expect(await gravar()).toEqual({ status: 401, corpo: { error: 'nao_autenticado' } });
    expect(rpc).not.toHaveBeenCalled();
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0]![0] as string)).toEqual({ evento: 'aderencia_falhou', etapa: 'autenticacao', status: 401, duracaoMs: expect.any(Number) });
  });

  it('sucesso não emite evento de falha', async () => {
    expect((await gravar()).status).toBe(200);
    expect(console.error).not.toHaveBeenCalled();
  });
});
