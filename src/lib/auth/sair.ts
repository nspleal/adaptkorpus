'use client';

import { limparDadosLocais } from '@/lib/session';
import { definirEscopoLocal } from '@/lib/escopo-local';
import { supabaseConfigurado } from '@/lib/supabase/env';

/**
 * Logout real (Auth-3): revoga o refresh token no Supabase (quando há backend) e limpa o
 * local. Sem backend (modo mock) só limpa o local — comportamento atual preservado.
 * O access JWT é stateless (expira sozinho); a blindagem cobre isso com expiração curta +
 * idle/absolute timeout (tarefas 15–16).
 *
 * 🔒 Auditoria 2026-07-29: limpa TODO dado pessoal local, não só `evk_sessao`. Antes
 * sobreviviam treinos, pesos e aderência, e a reconciliação do Painel os re-subia para a
 * PRÓXIMA conta a entrar no mesmo navegador. O isolamento por escopo (`escopo-local.ts`) já
 * torna a leitura cruzada impossível; esta limpeza é a segunda camada, por minimização de
 * dado pessoal em repouso (LGPD) — cobre inclusive quem nunca mais logar neste navegador.
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
  limparDadosLocais();
  definirEscopoLocal(null); // a próxima conta desta aba começa do zero
}
