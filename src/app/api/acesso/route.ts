/**
 * GET /api/acesso — gate do beta fechado (regra 4.2.1): allowlist via RPC
 * `beta_liberado()` (security definer; o usuário NUNCA lê/escreve a tabela) OU
 * assinatura ativa/trial (`subscription`, read-only p/ o dono — só o webhook grava).
 * Decisão pura em `lib/auth/acesso-beta.ts`.
 */
import { NextResponse } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { decidirAcessoBeta } from '@/lib/auth/acesso-beta';

export const runtime = 'nodejs';

export async function GET() {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  const [beta, sub] = await Promise.all([
    ctx.supabase.rpc('beta_liberado'),
    ctx.supabase.from('subscription').select('status').maybeSingle(),
  ]);
  const decisao = decidirAcessoBeta(beta.data === true, sub.data?.status ?? null);
  return NextResponse.json(decisao);
}
