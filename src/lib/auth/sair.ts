'use client';

import { limparSessao } from '@/lib/session';
import { supabaseConfigurado } from '@/lib/supabase/env';

/**
 * Logout real (Auth-3): revoga o refresh token no Supabase (quando há backend) e limpa a
 * sessão local. Sem backend (modo mock) só limpa o local — comportamento atual preservado.
 * O access JWT é stateless (expira sozinho); a blindagem cobre isso com expiração curta +
 * idle/absolute timeout (tarefas 15–16).
 */
export async function sairDaConta(): Promise<void> {
  if (supabaseConfigurado()) {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      await createClient().auth.signOut();
    } catch {
      // segue e limpa o local mesmo assim — nunca logar detalhe
    }
  }
  limparSessao();
}
