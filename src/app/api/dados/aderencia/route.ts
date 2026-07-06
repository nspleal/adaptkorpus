/**
 * GET/PUT /api/dados/aderencia — registro de refeições por DIA local (`logs` tipo
 * `refeicao`, um registro por dia; payload = { logs, notes } como no `evk_aderencia`).
 * Upsert manual (select→update|insert): `logs` não tem unique (user,tipo,data).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';

export const runtime = 'nodejs';

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  const { data, error } = await ctx.supabase.from('logs').select('data, payload').eq('tipo', 'refeicao');
  if (error) return NextResponse.json({ error: 'falha_leitura' }, { status: 500 });
  const dias: Record<string, unknown> = {};
  for (const r of data ?? []) if (typeof r.data === 'string') dias[r.data] = r.payload;
  return NextResponse.json({ dias });
}

export async function PUT(req: NextRequest) {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  const body = (await req.json().catch(() => null)) as { dia?: string; logs?: unknown; notes?: unknown } | null;
  if (!body || typeof body.dia !== 'string' || !DIA_RE.test(body.dia) ||
      typeof body.logs !== 'object' || body.logs === null || typeof body.notes !== 'object' || body.notes === null) {
    return NextResponse.json({ error: 'entrada inválida' }, { status: 400 });
  }
  const payload = { logs: body.logs, notes: body.notes };
  const { data: existente } = await ctx.supabase
    .from('logs').select('id').eq('tipo', 'refeicao').eq('data', body.dia).maybeSingle();
  const { error } = existente
    ? await ctx.supabase.from('logs').update({ payload }).eq('id', existente.id)
    : await ctx.supabase.from('logs').insert({ user_id: ctx.user.id, tipo: 'refeicao', data: body.dia, payload });
  if (error) return NextResponse.json({ error: 'falha_gravacao' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
