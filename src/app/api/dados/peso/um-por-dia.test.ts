/**
 * A rota de peso sob a regra de UM REGISTRO POR DIA. Comportamento de verdade: a rota é
 * chamada e a resposta é inspecionada. A arbitragem é do BANCO (`registrar_peso_dia` sob o
 * índice único) — aqui se prova que a rota delega a ela e traduz os três desfechos.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

const estado = vi.hoisted(() => ({
  /** linhas por dia, como o banco veria: dia -> peso já gravado */
  banco: new Map<string, number>(),
  chamadas: [] as { fn: string; args: Record<string, unknown> }[],
  erro: null as unknown,
}));

vi.mock('@/lib/auth/guard', () => ({ barreiraDados: () => null }));
vi.mock('@/lib/persistencia/servidor', () => ({
  contextoUsuario: vi.fn(async () => ({
    user: { id: 'conta-teste' },
    supabase: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        estado.chamadas.push({ fn, args });
        if (estado.erro) return { data: null, error: estado.erro };
        // O comportamento REAL do `insert … on conflict do nothing`:
        const dia = (args.p_dia as string | null) ?? '2026-09-11';
        const peso = Number(args.p_peso);
        const jaTinha = estado.banco.has(dia);
        if (!jaTinha) estado.banco.set(dia, peso);
        return {
          data: [{ inserido: !jaTinha, peso_kg: estado.banco.get(dia), dia }],
          error: null,
        };
      },
    },
  })),
}));

import { POST } from './route';

function req(body: unknown) {
  return new Request('http://x/api/dados/peso', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/dados/peso — um por dia', () => {
  beforeEach(() => { estado.banco.clear(); estado.chamadas = []; estado.erro = null; });

  it('o primeiro registro do dia é aceito', async () => {
    const r = await POST(req({ pesoKg: 80, dataISO: '2026-09-11' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, estado: 'REGISTRADO' });
    expect(estado.chamadas[0]!.fn).toBe('registrar_peso_dia');
    expect(estado.chamadas[0]!.args).toEqual({ p_dia: '2026-09-11', p_peso: 80 });
  });

  it('🔒 a segunda tentativa do dia com peso DIFERENTE é recusada (409) e o primeiro fica', async () => {
    await POST(req({ pesoKg: 80, dataISO: '2026-09-11' }));
    const r = await POST(req({ pesoKg: 74, dataISO: '2026-09-11' }));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: 'peso_ja_registrado_hoje', estado: 'RECUSADO_DIA', pesoKg: 80 });
    expect(estado.banco.get('2026-09-11')).toBe(80); // não substituiu
  });

  it('reenvio IDÊNTICO (retry) é idempotente: 200, sem duplicar', async () => {
    await POST(req({ pesoKg: 80, dataISO: '2026-09-11' }));
    const r = await POST(req({ pesoKg: 80, dataISO: '2026-09-11' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, estado: 'IDEMPOTENTE', pesoKg: 80 });
    expect(estado.banco.size).toBe(1);
  });

  it('duas tentativas CONCORRENTES resultam em um único registro coerente', async () => {
    const [a, b] = await Promise.all([
      POST(req({ pesoKg: 80, dataISO: '2026-09-11' })),
      POST(req({ pesoKg: 74, dataISO: '2026-09-11' })),
    ]);
    const status = [a.status, b.status].sort();
    expect(status).toEqual([200, 409]); // uma aceita, uma recusada — nunca duas aceitas
    expect(estado.banco.size).toBe(1);
  });

  it('o dia seguinte é um registro novo', async () => {
    await POST(req({ pesoKg: 80, dataISO: '2026-09-11' }));
    const r = await POST(req({ pesoKg: 79.4, dataISO: '2026-09-12' }));
    expect(r.status).toBe(200);
    expect(estado.banco.size).toBe(2);
  });

  it('o DIA LOCAL do cliente é repassado ao banco — inclusive à frente do UTC', async () => {
    // quem vive em fuso adiantado (ex.: UTC+13) tem dia civil maior que o do servidor
    const amanhaUtc = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await POST(req({ pesoKg: 80, dataISO: amanhaUtc }));
    expect(estado.chamadas[0]!.args.p_dia).toBe(amanhaUtc); // não foi descartado
  });

  it('data ausente/inválida cai no `current_date` do banco (p_dia nulo), sem inventar dia', async () => {
    await POST(req({ pesoKg: 80 }));
    expect(estado.chamadas[0]!.args.p_dia).toBeNull();
    estado.chamadas = [];
    await POST(req({ pesoKg: 80, dataISO: '11/09/2026' }));
    expect(estado.chamadas[0]!.args.p_dia).toBeNull();
  });

  it('entrada fora de faixa é 400 e nem chega ao banco', async () => {
    expect((await POST(req({ pesoKg: 12 }))).status).toBe(400);
    expect((await POST(req({ pesoKg: 'x' }))).status).toBe(400);
    expect(estado.chamadas).toHaveLength(0);
  });

  it('falha do banco é 500 — nunca um falso "registrado"', async () => {
    estado.erro = { message: 'indisponivel' };
    const r = await POST(req({ pesoKg: 80, dataISO: '2026-09-11' }));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: 'falha_gravacao' });
  });
});
