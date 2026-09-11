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
  const [profile, plans, logs, feedback, subscription, eventos] = await Promise.all([
    ctx.supabase.from('profile').select('*').maybeSingle(),
    ctx.supabase.from('plans').select('*').order('created_at', { ascending: true }),
    ctx.supabase.from('logs').select('*').order('created_at', { ascending: true }),
    ctx.supabase.from('feedback').select('*').order('created_at', { ascending: true }),
    ctx.supabase.from('subscription').select('*').maybeSingle(),
    // 🔒 Telemetria entra no export como SEÇÃO PRÓPRIA (Leva C2). Tabela separada de `logs`
    // justamente para não sair misturada com o histórico da pessoa.
    ctx.supabase.from('eventos').select('*').order('created_at', { ascending: true }),
  ]);
  /**
   * 🔴 D8c (2026-09-07, reconfirmado em 2026-09-10) — a rota lia só `.data` das seis consultas
   * e nunca `.error`. Uma falha de leitura virava seção VAZIA dentro de um 200, e o arquivo
   * baixado afirmava, pelo silêncio, que a pessoa não tem plano, histórico ou telemetria.
   *
   * 🔒 Numa rota de PORTABILIDADE, export incompleto apresentado como completo é o pior erro
   * possível: quem baixa não tem como saber. Falhou uma? Nenhuma sai, e a resposta nomeia
   * quais. `data` nulo com `error` nulo continua sendo ausência legítima — e 200.
   */
  const consultas = { profile, plans, logs, feedback, subscription, eventos };
  const falharam = Object.entries(consultas)
    .filter(([, r]) => r.error != null)
    .map(([nome]) => nome);
  if (falharam.length > 0) {
    return NextResponse.json({ error: 'falha_leitura', secoes: falharam }, { status: 500 });
  }
  return NextResponse.json({
    exportadoEm: new Date().toISOString(),
    usuario: { id: ctx.user.id, email: ctx.user.email ?? null },
    profile: profile.data ?? null,
    plans: plans.data ?? [],
    logs: logs.data ?? [],
    feedback: feedback.data ?? [],
    subscription: subscription.data ?? null,
    eventos: eventos.data ?? [],
  });
}
