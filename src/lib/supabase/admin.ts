import 'server-only';

/**
 * Cliente ADMIN (service_role) — BYPASSA o RLS. Uso EXCLUSIVO em servidor confiável
 * (ex.: webhook da Kiwify). O import 'server-only' garante erro de build se isto
 * vazar para um bundle de cliente.
 *
 * ⚠️ A service_role key dá acesso TOTAL ao banco. Nunca logar, nunca expor, nunca
 * prefixar com NEXT_PUBLIC_. Vive só em variável de ambiente do servidor.
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl } from './env';

export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');

  return createSupabaseClient(supabaseUrl(), serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
