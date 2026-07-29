/**
 * POST /api/suporte — envio REAL do formulário de suporte (melhoria adotada no cofre,
 * operacao-legal-suporte-reembolso §Confiança pública: "formulário mudo é anti-marca").
 *
 * Env-gated: precisa de RESEND_API_KEY + SUPORTE_EMAIL_DESTINO. Sem eles a rota responde
 * `{ ok: false, status: 'nao_configurado' }` (200) e o formulário mantém o aviso honesto
 * de demonstração — nunca fingimos envio.
 *
 * LGPD/segurança: e-mail SEMPRE texto puro (sem HTML → sem injeção); NUNCA logamos
 * nome/e-mail/mensagem (só status HTTP); honeypot finge sucesso sem enviar nada;
 * rate limit best-effort por IP (5/10min).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { suporteSchema } from '@/lib/validation/api';
import { criarRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const ASSUNTO_LABEL: Record<string, string> = {
  duvida: 'Dúvida sobre o app',
  cobranca: 'Cobrança e assinatura',
  privacidade: 'Privacidade / LGPD',
  outro: 'Outro',
};

const limitador = criarRateLimit({ limite: 5, janelaMs: 10 * 60_000 });

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const destino = process.env.SUPORTE_EMAIL_DESTINO;
  if (!apiKey || !destino) {
    // Primeira parte (form próprio), não webhook: 200 tipado mantém o cliente trivial e o
    // monitoramento limpo; a UI mostra o aviso de demonstração de sempre.
    return NextResponse.json({ ok: false, status: 'nao_configurado' });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconhecido';
  if (!limitador.permitir(ip)) {
    return NextResponse.json({ error: 'muitas_tentativas' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  // Honeypot ANTES da validação: bot preencheu `site` → finge sucesso, não envia, não loga.
  if (body && typeof body.site === 'string' && body.site.length > 0) {
    return NextResponse.json({ ok: true });
  }
  const parsed = suporteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'entrada inválida', detalhes: parsed.error.issues }, { status: 400 });
  }
  const { nome, email, assunto, mensagem } = parsed.data;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.SUPORTE_EMAIL_REMETENTE ?? 'Evokorpus <onboarding@resend.dev>',
        to: [destino],
        reply_to: email,
        // 🔒 `nome` é interpolado no ASSUNTO: CR/LF viram separador de header em SMTP.
        // A API JSON da Resend já neutraliza na prática, mas a defesa é do nosso lado.
        subject: `[Suporte] ${ASSUNTO_LABEL[assunto]} — ${nome.replace(/[\r\n]/g, ' ')}`,
        text: mensagem, // texto puro, nunca HTML
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      console.error(`suporte: provedor de e-mail respondeu ${r.status}`); // só o status — nunca conteúdo
      return NextResponse.json({ error: 'falha_envio' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    console.error('suporte: falha de rede/timeout no provedor de e-mail');
    return NextResponse.json({ error: 'falha_envio' }, { status: 502 });
  }
}
