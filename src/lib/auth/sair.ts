'use client';

import { continuacaoDaConta } from '@/lib/persistencia/continuidade-conta';
import { escopoLocal } from '@/lib/escopo-local';
import { limparDadosLocais } from '@/lib/session';
import { definirEscopoLocal, CHAVES_SESSAO } from '@/lib/escopo-local';
import { supabaseConfigurado } from '@/lib/supabase/env';

/** Pausa imediatamente o escopo e revoga a sessão quando há backend.
 * Fila e rascunhos persistem por UUID para reautenticação da MESMA conta.
 * Logout não é consentimento para apagar pendências ou dados de outros usuários.
 * Sem backend, preserva a limpeza explícita do modo de demonstração. */
export async function sairDaConta(aoPausar?: (continuaPausado: () => boolean) => void): Promise<boolean> {
  // Pausa callbacks antes do signOut. Fila/draft continuam vinculados ao UUID para reentrada.
  definirEscopoLocal(null);
  const ativo = continuacaoDaConta(escopoLocal, null);
  // Permite acompanhar esta pausa esperada, sem recriar um contexto após awaits.
  aoPausar?.(ativo);
  if (supabaseConfigurado()) {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      if (!ativo()) return false;
      await createClient().auth.signOut();
    } catch {
      // O escopo permanece pausado; não apaga pendências em falha de rede.
    }
  }
  if (!ativo()) return false;
  if (!supabaseConfigurado()) limparDadosLocais();
  try { for (const k of CHAVES_SESSAO) sessionStorage.removeItem(k); } catch { /* indisponível */ }
  return true;
}
