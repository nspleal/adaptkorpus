/**
 * Webhook Kiwify → Supabase (status da assinatura).
 *
 * SEGURANÇA (o ponto mais sensível do app):
 *   1. Valida a assinatura HMAC do corpo CRU antes de confiar em qualquer dado.
 *   2. Comparação em tempo constante (timingSafeEqual) sobre os BYTES (decodificados de hex).
 *   3. Idempotência: deduplica reentregas/replay via tabela webhook_events — gravada
 *      DEPOIS do processamento (ver ⚠️ abaixo).
 *   4. Só então usa o cliente ADMIN (service_role) para atualizar a assinatura.
 *
 * ⚠️ Confirmar contra a doc atual da Kiwify: nome do header e algoritmo. Por isso o
 * algoritmo é configurável por env (KIWIFY_WEBHOOK_ALGO, default 'sha256') — não exige
 * editar código para alinhar. O header esperado é `x-kiwify-signature` (hex).
 *
 * ⚠️ ORDEM DA IDEMPOTÊNCIA (auditoria 2026-07-29). A dedup gravava o `event_id` ANTES de
 * resolver o usuário — e `resolverUserId` ainda é esqueleto (retorna null). Resultado: todo
 * evento era marcado como processado e descartado, e quando o espelho de e-mail entrasse os
 * retries da Kiwify bateriam em `23505 → duplicado` sem NUNCA aplicar. A assinatura só
 * apareceria como "não atualiza", meses depois, sem rastro.
 * Agora a marca é gravada **só quando o evento foi efetivamente processado** (aplicado ou
 * deliberadamente ignorado). O que ficou pendente NÃO entra na tabela — e o retry seguinte
 * encontra o caminho livre. `webhook_events` está zerada: nada foi engolido, nada a migrar.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const ALGO = process.env.KIWIFY_WEBHOOK_ALGO || 'sha256';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Compara a assinatura recebida (hex) com o HMAC esperado, em tempo constante. */
function assinaturaValida(rawBody: string, recebidaHex: string | null, segredo: string): boolean {
  if (!recebidaHex || !/^[0-9a-f]+$/i.test(recebidaHex)) return false;
  const esperado = createHmac(ALGO, segredo).update(rawBody, 'utf8').digest(); // Buffer
  let recebido: Buffer;
  try {
    recebido = Buffer.from(recebidaHex, 'hex');
  } catch {
    return false;
  }
  if (recebido.length !== esperado.length) return false;
  return timingSafeEqual(esperado, recebido);
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

function extrairEventId(payload: Record<string, unknown>): string | null {
  return (
    (payload['webhook_event_id'] as string) ??
    (payload['event_id'] as string) ??
    (payload['id'] as string) ??
    null
  );
}

export async function POST(request: NextRequest) {
  const segredo = process.env.KIWIFY_WEBHOOK_SECRET;
  if (!segredo) {
    return NextResponse.json({ error: 'webhook não configurado' }, { status: 503 });
  }

  // 1) Corpo CRU (necessário para validar a assinatura byte a byte) + assinatura no HEADER.
  const rawBody = await request.text();
  const assinatura = request.headers.get('x-kiwify-signature');

  if (!assinaturaValida(rawBody, assinatura, segredo)) {
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 });
  }

  // 2) Só depois de validar é seguro parsear/confiar.
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 3) Idempotência SEMPRE ativa (anti-replay/reentrega): usa o event_id do payload ou,
  //    na falta dele, um hash determinístico do corpo cru — nunca desliga a dedup.
  const eventId =
    extrairEventId(payload) ?? `body:${createHash('sha256').update(rawBody, 'utf8').digest('hex')}`;

  // 3a) CHECA se já foi processado (leitura — a marca só é gravada no fim).
  const { data: jaVisto } = await admin
    .from('webhook_events').select('event_id').eq('event_id', eventId).maybeSingle();
  if (jaVisto) return NextResponse.json({ ok: true, duplicado: true });

  /** Grava a marca de processado. Corrida entre reentregas simultâneas → 23505, que aqui é
   *  sucesso (o outro processou). Chamado só nos caminhos TERMINAIS. */
  async function marcarProcessado(): Promise<void> {
    const { error } = await admin.from('webhook_events').insert({ event_id: eventId, origem: 'kiwify' });
    if (error && error.code !== '23505') {
      // Não derruba a resposta: o efeito já foi aplicado. Sem log de conteúdo.
      console.error('kiwify: falha ao marcar evento como processado');
    }
  }

  // 4) Validação do e-mail (liga o evento ao usuário) + status.
  const emailBruto = (payload['customer_email'] as string) ?? (payload['email'] as string);
  const email = typeof emailBruto === 'string' ? emailBruto.trim().toLowerCase() : '';
  const status = mapearStatus(payload);
  if (!EMAIL_RE.test(email) || !status) {
    // Ignorado DE PROPÓSITO (evento que não nos interessa) — é terminal: marca.
    await marcarProcessado();
    return NextResponse.json({ ok: true, ignorado: true });
  }

  // 5) Resolve user_id; sem ele, NÃO grava (fail-safe — evita gravar em linha errada).
  const subscriptionId =
    (payload['subscription_id'] as string) ?? (payload['order_id'] as string) ?? null;
  const userId = await resolverUserId(admin, email);
  if (!userId) {
    // 🔒 PENDENTE — NÃO marca. O evento não produziu efeito nenhum; consumir a marca aqui
    // é o que faria o retry seguinte ser descartado sem nunca aplicar.
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
    // Falhou a aplicação → NÃO marca: o retry da Kiwify precisa poder tentar de novo.
    return NextResponse.json({ error: 'falha ao atualizar' }, { status: 500 });
  }

  await marcarProcessado();
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
