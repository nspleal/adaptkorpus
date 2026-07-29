/**
 * GET/POST /api/dados/historico — sessões de treino do usuário LOGADO (`logs` tipo
 * `treino`, payload = SessaoHistorico verbatim; calibrações viajam no próprio payload,
 * `tipo:'calibracao'`). Feedback por sessão também vira linha em `feedback` (contexto
 * `treino`). RLS isola por dono; `user_id` de `getUser()` (regra 4.2.3).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { payloadCabe, sessaoHistoricoSchema } from '@/lib/validation/api';
import { barreiraDados } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';

// 60 sessões / 5 min por usuário — a reconciliação sobe em lote no boot, então o teto
// precisa caber num histórico inteiro re-subido de uma vez.
const limitador = criarRateLimit({ limite: 60, janelaMs: 5 * 60_000 });
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
  const barra = barreiraDados(ctx.user.id, limitador);
  if (barra) return barra;
  const body = (await req.json().catch(() => null)) as { sessao?: unknown } | null;
  const parsed = sessaoHistoricoSchema.safeParse(body?.sessao);
  if (!parsed.success) return NextResponse.json({ error: 'entrada inválida' }, { status: 400 });
  const s = parsed.data as unknown as SessaoHistorico;
  if (!payloadCabe(s)) return NextResponse.json({ error: 'payload_grande' }, { status: 413 });
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
