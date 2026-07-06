/**
 * GET /api/lgpd/exportar — portabilidade (LGPD, Ownership-4): TODOS os dados do usuário
 * logado num JSON. Server client (RLS) — cada select devolve só as linhas do dono.
 */
import { NextResponse } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';

export const runtime = 'nodejs';

export async function GET() {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
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
