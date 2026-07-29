/**
 * GET /api/lgpd/exportar — portabilidade (LGPD, Ownership-4): TODOS os dados do usuário
 * logado num JSON. Server client (RLS) — cada select devolve só as linhas do dono.
 */
import { NextResponse } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { barreiraDados } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';

// Exportação lê CINCO tabelas de uma vez — a rota mais cara do app. 6 por hora cobre o uso
// legítimo (baixar os próprios dados) sem virar alavanca de carga.
const limitador = criarRateLimit({ limite: 6, janelaMs: 60 * 60_000 });

export const runtime = 'nodejs';

export async function GET() {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  const barra = barreiraDados(ctx.user.id, limitador);
  if (barra) return barra;
  const [profile, plans, logs, feedback, subscription] = await Promise.all([
    ctx.supabase.from('profile').select('*').maybeSingle(),
    ctx.supabase.from('plans').select('*').order('created_at', { ascending: true }),
    ctx.supabase.from('logs').select('*').order('created_at', { ascending: true }),
    ctx.supabase.from('feedback').select('*').order('created_at', { ascending: true }),
    ctx.supabase.from('subscription').select('*').maybeSingle(),
  ]);
  return NextResponse.json({
    exportadoEm: new Date().toISOString(),
    usuario: { id: ctx.user.id, email: ctx.user.email ?? null },
    profile: profile.data ?? null,
    plans: plans.data ?? [],
    logs: logs.data ?? [],
    feedback: feedback.data ?? [],
    subscription: subscription.data ?? null,
  });
}
