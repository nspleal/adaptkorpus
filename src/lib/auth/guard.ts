import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseConfigurado } from '@/lib/supabase/env';

/**
 * Guard de acesso das rotas de API — preparado para o Supabase Auth, INERTE até ele existir
 * (Gating-1/3, handoff auth-beta 2026-07-05). Enquanto o backend não é provisionado, o app
 * roda em "modo mock" e estas rotas de compute seguem headless/abertas como hoje; quando as
 * envs do Supabase entrarem, o portão passa a exigir usuário (401) sozinho.
 *
 * `decidirAcessoApi` é PURO (sem I/O) → testável direto. `getUsuario` faz import DINÂMICO do
 * server client só quando há Supabase configurado, então nem toca em `next/headers`/rede no
 * modo mock (e o módulo é importável em teste sem contexto de requisição).
 */
export async function getUsuario(): Promise<User | null> {
  if (!supabaseConfigurado()) return null; // modo mock: nunca toca em rede
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null; // fail-safe: nunca derruba a rota por erro de auth
  }
}

/**
 * Decisão de acesso a uma rota de API. `configurado === false` → passa (preserva o
 * comportamento atual sem backend); com Supabase vivo, exige usuário → 401. Determinístico.
 */
export function decidirAcessoApi(configurado: boolean, user: User | null): NextResponse | null {
  if (!configurado) return null; // sem backend: sem gate (modo mock)
  if (!user) return NextResponse.json({ error: 'nao_autenticado' }, { status: 401 });
  return null; // autenticado: segue
}

/**
 * Barreira de uma rota de compute: auth (401 quando o backend exigir) + rate-limit
 * (429; chave = usuário logado ou IP). Retorna a resposta de bloqueio, ou `null` p/ seguir.
 * `limitador` é per-rota (escopo de módulo) — reusa `criarRateLimit` de `@/lib/rate-limit`.
 */
export async function barreiraCompute(
  req: NextRequest,
  limitador: { permitir(chave: string): boolean },
): Promise<NextResponse | null> {
  const user = await getUsuario();
  const barra = decidirAcessoApi(supabaseConfigurado(), user);
  if (barra) return barra;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconhecido';
  if (!limitador.permitir(user?.id ?? ip)) {
    return NextResponse.json({ error: 'muitas_tentativas' }, { status: 429 });
  }
  return null;
}


/**
 * 🔒 Rate limit das rotas de DADOS e LGPD (auditoria 2026-07-29). Só as rotas de compute e
 * o formulário de suporte tinham limitador; `dados/*` e `lgpd/*` ficavam abertas a um laço
 * de escrita/leitura por conta autenticada. A chave é o USUÁRIO (não o IP): aqui todo mundo
 * está logado, e o IP puniria quem compartilha rede.
 *
 * Chamar DEPOIS do `contextoUsuario()` — ele já resolveu o 401/503, então este só limita.
 */
export function barreiraDados(
  userId: string,
  limitador: { permitir(chave: string): boolean },
): NextResponse | null {
  if (!limitador.permitir(userId)) {
    return NextResponse.json({ error: 'muitas_tentativas' }, { status: 429 });
  }
  return null;
}
