import 'server-only';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigurado } from '@/lib/supabase/env';

/**
 * Contexto das rotas de DADOS DO USUÁRIO (Ownership-1): sempre o SERVER client (anon key
 * + JWT do cookie → RLS decide), NUNCA o admin. `user_id` nasce AQUI, de `getUser()` —
 * regra 4.2.3 da blindagem: jamais do corpo da request.
 *
 * Sem envs → 503 `nao_configurado` (modo mock não tem persistência server); sem usuário →
 * 401. Nunca loga detalhe (higiene de logs — dado de saúde/token fora dos logs).
 */
export type ContextoUsuario = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
};

export async function contextoUsuario(): Promise<ContextoUsuario | NextResponse> {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ error: 'nao_configurado' }, { status: 503 });
  }
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return NextResponse.json({ error: 'nao_autenticado' }, { status: 401 });
    return { supabase, user: data.user };
  } catch {
    return NextResponse.json({ error: 'nao_autenticado' }, { status: 401 });
  }
}
