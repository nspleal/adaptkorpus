/**
 * GET/PUT /api/dados/aderencia — registro de refeições por DIA local (`logs` tipo
 * `refeicao`, um registro por dia; payload = { logs, notes } como no `evk_aderencia`).
 * Upsert manual (select→update|insert): `logs` não tem unique (user,tipo,data).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { aderenciaDiaSchema, payloadCabe } from '@/lib/validation/api';
import { barreiraDados } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';

// 60 escritas / 5 min por usuário: folgado para o uso real (4 refeições/dia), apertado o
// bastante para não virar laço de escrita.
const limitador = criarRateLimit({ limite: 60, janelaMs: 5 * 60_000 });

export const runtime = 'nodejs';


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
  const barra = barreiraDados(ctx.user.id, limitador);
  if (barra) return barra;
  const parsed = aderenciaDiaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'entrada inválida' }, { status: 400 });
  const body = parsed.data;
  const payload = { logs: body.logs, notes: body.notes };
  // 🔒 Teto de tamanho: o zod limita a FORMA, não o volume (um mapa válido pode ter 10 mil
  // chaves). Os dois juntos fecham.
  if (!payloadCabe(payload)) return NextResponse.json({ error: 'payload_grande' }, { status: 413 });
  const { data: existente } = await ctx.supabase
    .from('logs').select('id').eq('tipo', 'refeicao').eq('data', body.dia).maybeSingle();
  const { error } = existente
    ? await ctx.supabase.from('logs').update({ payload }).eq('id', existente.id)
    : await ctx.supabase.from('logs').insert({ user_id: ctx.user.id, tipo: 'refeicao', data: body.dia, payload });
  if (error) return NextResponse.json({ error: 'falha_gravacao' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
