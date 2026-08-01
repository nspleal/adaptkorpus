/**
 * GET/PUT /api/dados/perfil — perfil do usuário LOGADO (Ownership-1, RLS).
 * Server client sempre (nunca admin); `id` nasce de `getUser()` (regra 4.2.3). O e-mail
 * NUNCA vem do body — o trigger espelho (0006) o força a `auth.email()`. O PUT também
 * grava o SNAPSHOT auditável do plano em `plans` (motor puro recomputado no servidor).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { linhaComConsentimentos, linhaParaPerfil, perfilParaLinha, type ProfileRow } from '@/lib/persistencia/perfil-profile';
import { consentimentosSchema, perfilResumoSchema } from '@/lib/validation/perfil-resumo';
import { recomputarPlano } from '@/lib/plano';
import type { PerfilResumo } from '@/components/painel/Painel';

export const runtime = 'nodejs';

export async function GET() {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  const { data, error } = await ctx.supabase.from('profile').select('*').eq('id', ctx.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'falha_leitura' }, { status: 500 });
  // Linha inexistente OU criada sem o bloco de preferências (parcial) = sem perfil usável.
  if (!data || !data.sexo || !data.preferencias?.nivelExperiencia) {
    return NextResponse.json({ error: 'sem_perfil' }, { status: 404 });
  }
  return NextResponse.json({ perfil: linhaParaPerfil(data as ProfileRow) });
}

export async function PUT(req: NextRequest) {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  const body = (await req.json().catch(() => null)) as { perfil?: unknown; consentimentos?: unknown } | null;
  const parsed = perfilResumoSchema.safeParse(body?.perfil);
  if (!parsed.success) return NextResponse.json({ error: 'entrada inválida' }, { status: 400 });
  const perfil = parsed.data as PerfilResumo;

  let linha: Record<string, unknown> = { ...perfilParaLinha(perfil), id: ctx.user.id };
  const consent = consentimentosSchema.safeParse(body?.consentimentos);
  if (consent.success) linha = linhaComConsentimentos(linha, consent.data, new Date().toISOString());

  const { error } = await ctx.supabase.from('profile').upsert(linha, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: 'falha_gravacao' }, { status: 500 });

  /**
   * Snapshot auditável (best-effort — o perfil já está salvo): dieta+treino recomputados
   * no servidor pelo MESMO mapeamento do client (lib/plano.ts, determinístico).
   *
   * ⚠️ EXCEÇÃO ACEITA COMO TEMPORÁRIA (cofre `parametros-motor-dieta-evokorpus` §5, DF
   * 2026-07-31): daqui **não** sai o peso resolvido da Leva D. A âncora do peso do plano
   * (`evk_peso_plano`) vive no NAVEGADOR, e o servidor não a enxerga — então este snapshot
   * pode divergir do plano que a pessoa vê. Duas verdades para o mesmo número, latentes.
   *
   * 🔒 GATILHO DO CONSERTO, declarado: **no dia em que qualquer tela exibir kcal derivada
   * deste snapshot**, a âncora migra para `profile.preferencias` (jsonb — zero SQL) e os
   * dois lados passam a ler o mesmo número. Enquanto nada exibe, a divergência não chega a
   * ninguém; quando exibir, chega. Há teste que mantém esta exceção nomeada.
   */
  try {
    const { dieta, treino } = recomputarPlano(perfil);
    await ctx.supabase.from('plans').update({ ativo: false }).eq('user_id', ctx.user.id).eq('ativo', true);
    await ctx.supabase.from('plans').insert([
      { user_id: ctx.user.id, tipo: 'dieta', payload: dieta },
      { user_id: ctx.user.id, tipo: 'treino', payload: treino },
    ]);
  } catch { /* snapshot falhou — sem log de conteúdo (dado de saúde) */ }

  return NextResponse.json({ ok: true });
}
