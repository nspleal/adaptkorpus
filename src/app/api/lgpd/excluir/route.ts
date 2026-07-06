/**
 * POST /api/lgpd/excluir — direito de eliminação (LGPD, Ownership-4): exclui a CONTA
 * (`auth.admin.deleteUser`) e, por cascata FK (`on delete cascade` no schema), todas as
 * linhas do usuário (profile/plans/logs/feedback/subscription).
 *
 * Único caminho de request com service_role FORA do webhook — uso legítimo auditado
 * (guard-rail estático em lib/auth/admin-guardrail.test.ts). O usuário só exclui A SI:
 * o id vem do próprio JWT (contextoUsuario), nunca do body. Sem a service_role no env
 * (ex.: preview sem segredo) → 503 honesto — nunca fingir exclusão.
 */
import { NextResponse } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST() {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'indisponivel' }, { status: 503 });
  }
  const { error } = await createAdminClient().auth.admin.deleteUser(ctx.user.id);
  if (error) return NextResponse.json({ error: 'falha_exclusao' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
