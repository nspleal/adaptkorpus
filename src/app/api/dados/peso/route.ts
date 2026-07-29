/**
 * GET/POST /api/dados/peso — registros de peso do usuário LOGADO (`logs` tipo `peso`,
 * payload = { pesoKg }). Antes do backend o peso era só memória (resetava no reload) —
 * esta rota o torna persistente de verdade.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { barreiraDados } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';

const limitador = criarRateLimit({ limite: 60, janelaMs: 5 * 60_000 });

export const runtime = 'nodejs';

export async function GET() {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  const { data, error } = await ctx.supabase
    .from('logs').select('payload').eq('tipo', 'peso').order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'falha_leitura' }, { status: 500 });
  const pesos = (data ?? [])
    .map((r) => Number((r.payload as { pesoKg?: unknown } | null)?.pesoKg))
    .filter((v) => Number.isFinite(v));
  return NextResponse.json({ pesos });
}

export async function POST(req: NextRequest) {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  const barra = barreiraDados(ctx.user.id, limitador);
  if (barra) return barra;
  const body = (await req.json().catch(() => null)) as { pesoKg?: unknown } | null;
  const v = Number(body?.pesoKg);
  if (!Number.isFinite(v) || v < 30 || v > 300) {
    return NextResponse.json({ error: 'entrada inválida' }, { status: 400 });
  }
  const { error } = await ctx.supabase
    .from('logs').insert({ user_id: ctx.user.id, tipo: 'peso', payload: { pesoKg: v } });
  if (error) return NextResponse.json({ error: 'falha_gravacao' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
