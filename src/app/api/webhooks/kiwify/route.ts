/**
 * Webhook Kiwify → Supabase (status da assinatura).
 *
 * SEGURANÇA (o ponto mais sensível do app):
 *   1. Valida a assinatura HMAC do corpo CRU antes de confiar em qualquer dado.
 *   2. Comparação em tempo constante (timingSafeEqual) — anti-timing-attack.
 *   3. Só então usa o cliente ADMIN (service_role) para atualizar a assinatura.
 *
 * ⚠️ Confirmar contra a doc atual da Kiwify: nome do header/param e algoritmo
 * (SHA-1 vs SHA-256). O esqueleto abaixo aceita header `x-kiwify-signature` ou
 * query `?signature=`, HMAC-SHA1 hex. Ajustar `ALGO` se a Kiwify usar outro.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
const ALGO = 'sha1';

function assinaturaValida(rawBody: string, recebida: string | null, segredo: string): boolean {
  if (!recebida) return false;
  const esperada = createHmac(ALGO, segredo).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(esperada, 'utf8');
  const b = Buffer.from(recebida, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Mapeia o evento da Kiwify → status interno da assinatura. */
function mapearStatus(payload: Record<string, unknown>): string | null {
  const raw =
    (payload['subscription_status'] as string) ??
    (payload['order_status'] as string) ??
    ((payload['status'] as string) || '');
  const s = String(raw).toLowerCase();
  if (['paid', 'active', 'approved'].includes(s)) return 'ativa';
  if (['trialing', 'trial'].includes(s)) return 'trial';
  if (['canceled', 'cancelled'].includes(s)) return 'cancelada';
  if (['refunded', 'chargedback'].includes(s)) return 'reembolsada';
  if (['past_due', 'overdue', 'unpaid'].includes(s)) return 'inadimplente';
  return null;
}

export async function POST(request: NextRequest) {
  const segredo = process.env.KIWIFY_WEBHOOK_SECRET;
  if (!segredo) {
    return NextResponse.json({ error: 'webhook não configurado' }, { status: 503 });
  }

  // 1) Corpo CRU (necessário para validar a assinatura byte a byte).
  const rawBody = await request.text();
  const assinatura =
    request.headers.get('x-kiwify-signature') ??
    request.nextUrl.searchParams.get('signature');

  if (!assinaturaValida(rawBody, assinatura, segredo)) {
    // Não vaza detalhe. Resposta genérica.
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 });
  }

  // 2) Só depois de validar é seguro parsear/confiar.
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 });
  }

  // O e-mail do comprador liga o evento ao usuário (auth.users). Ajustar ao payload real.
  const email = (payload['customer_email'] as string) ?? (payload['email'] as string);
  const status = mapearStatus(payload);
  if (!email || !status) {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  // 3) Atualização com cliente ADMIN (service_role) — server-only.
  const admin = createAdminClient();
  const subscriptionId =
    (payload['subscription_id'] as string) ?? (payload['order_id'] as string) ?? null;

  // Liga o evento ao usuário pelo e-mail. PENDÊNCIA de produção: manter um espelho
  // de e-mail→user_id (tabela com RLS) ou paginar admin.auth.admin.listUsers().
  // Fail-safe: sem user_id resolvido, NÃO grava (evita escrever em linha errada).
  const userId = await resolverUserId(admin, email);
  if (!userId) {
    return NextResponse.json({ ok: true, pendente: 'user_id não resolvido' });
  }

  const { error } = await admin.from('subscription').upsert(
    {
      user_id: userId,
      kiwify_subscription_id: subscriptionId,
      status,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'user_id', ignoreDuplicates: false },
  );

  if (error) {
    return NextResponse.json({ error: 'falha ao atualizar' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Resolve user_id a partir do e-mail. Esqueleto: a estratégia definitiva (espelho de
 * e-mail com RLS) entra junto com a Auth. Hoje retorna null (fail-safe).
 */
async function resolverUserId(
  _admin: ReturnType<typeof createAdminClient>,
  _email: string,
): Promise<string | null> {
  return null;
}
