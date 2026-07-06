/**
 * GET/POST /api/dados/historico — sessões de treino do usuário LOGADO (`logs` tipo
 * `treino`, payload = SessaoHistorico verbatim; calibrações viajam no próprio payload,
 * `tipo:'calibracao'`). Feedback por sessão também vira linha em `feedback` (contexto
 * `treino`). RLS isola por dono; `user_id` de `getUser()` (regra 4.2.3).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import type { SessaoHistorico } from '@/lib/treino-historico';

export const runtime = 'nodejs';

export async function GET() {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  const { data, error } = await ctx.supabase
    .from('logs').select('payload').eq('tipo', 'treino').order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'falha_leitura' }, { status: 500 });
  return NextResponse.json({ sessoes: (data ?? []).map((r) => r.payload as SessaoHistorico) });
}

export async function POST(req: NextRequest) {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  const body = (await req.json().catch(() => null)) as { sessao?: SessaoHistorico } | null;
  const s = body?.sessao;
  if (!s || typeof s.dataISO !== 'string' || !Number.isFinite(s.n) || !Array.isArray(s.exercicios)) {
    return NextResponse.json({ error: 'entrada inválida' }, { status: 400 });
  }
  const { error } = await ctx.supabase
    .from('logs').insert({ user_id: ctx.user.id, tipo: 'treino', data: s.dataISO, payload: s });
  if (error) return NextResponse.json({ error: 'falha_gravacao' }, { status: 500 });
  if (s.feedback && Object.keys(s.feedback).length > 0) {
    await ctx.supabase.from('feedback').insert({
      user_id: ctx.user.id, contexto: 'treino', payload: { n: s.n, dataISO: s.dataISO, feedback: s.feedback },
    }); // best-effort: a sessão já está gravada
  }
  return NextResponse.json({ ok: true });
}
