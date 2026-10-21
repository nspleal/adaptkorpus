/**
 * POST /api/lgpd/excluir — direito de eliminação (LGPD, Ownership-4): exclui a CONTA
 * (`auth.admin.deleteUser`) e, por cascata FK (`on delete cascade` no schema), todas as
 * linhas do usuário (profile/plans/logs/feedback/subscription).
 *
 * Único caminho de request com service_role FORA do webhook — uso legítimo auditado
 * (guard-rail estático em lib/auth/admin-guardrail.test.ts). O usuário só exclui A SI:
 * o id vem do próprio JWT (contextoUsuario), nunca do body. Sem a service_role no env
 * (ex.: preview sem segredo) → 503 honesto — nunca fingir exclusão.
 *
 * 🔒 RE-AUTENTICAÇÃO (auditoria 2026-07-29): exige a SENHA no corpo e a revalida contra o
 * Auth antes de excluir. O vetor é o mesmo do isolamento de dados locais — sessão aberta em
 * navegador compartilhado —, e consertar só um dos dois deixaria a suposição de pé: "quem
 * tem a aba tem a conta". Exclusão é irreversível e cascateia (profile/plans/logs/feedback/
 * subscription): merece a prova de posse, não só a de sessão.
 *
 * A revalidação usa um client ANÔNIMO e efêmero (`signInWithPassword` sem persistir sessão)
 * — não toca no cookie da sessão em curso, então uma senha errada não desloga ninguém.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { createAdminClient } from '@/lib/supabase/admin';
import { barreiraDados } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';
import { supabaseUrl } from '@/lib/supabase/env';

export const runtime = 'nodejs';

// Exclusão + revalidação de senha: 5 por hora por usuário. Também barra a tentativa de
// adivinhar a senha por esta rota.
const limitador = criarRateLimit({ limite: 5, janelaMs: 60 * 60_000 });

export async function POST(req: NextRequest) {
  const ctx = await contextoUsuario(req, true);
  if (ctx instanceof NextResponse) return ctx;
  const barra = barreiraDados(ctx.user.id, limitador);
  if (barra) return barra;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'indisponivel' }, { status: 503 });
  }

  // 🔒 Prova de POSSE, não só de sessão.
  const body = (await req.json().catch(() => null)) as { senha?: unknown } | null;
  const senha = typeof body?.senha === 'string' ? body.senha : '';
  const email = ctx.user.email ?? '';
  if (!senha || !email) {
    return NextResponse.json({ error: 'senha_obrigatoria' }, { status: 400 });
  }
  const efemero = createSupabaseClient(supabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: erroSenha } = await efemero.auth.signInWithPassword({ email, password: senha });
  if (erroSenha) return NextResponse.json({ error: 'senha_invalida' }, { status: 401 });

  const { error } = await createAdminClient().auth.admin.deleteUser(ctx.user.id);
  if (error) return NextResponse.json({ error: 'falha_exclusao' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
