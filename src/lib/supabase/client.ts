'use client';

/**
 * Cliente Supabase para o BROWSER. Usa a anon key (pública) — toda proteção vem do RLS.
 */
import { createBrowserClient } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from './env';

export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
