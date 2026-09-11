import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/persistencia/servidor', () => ({
  contextoUsuario: async () => ({ user: { id: 'u1' }, supabase: { rpc } }),
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
beforeEach(() => { rpc.mockReset().mockResolvedValue({ error: null }); });

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
});
