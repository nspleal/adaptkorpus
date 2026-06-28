/**
 * Cliente Supabase para o SERVIDor (Server Components / Route Handlers).
 * Usa a anon key + cookies do usuário → RLS continua valendo (acessa só o próprio dado).
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAnonKey, supabaseUrl } from './env';

type CookieParaGravar = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieParaGravar[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set({ name, value, ...options });
          }
        } catch {
          // Chamado de um Server Component — ok ignorar; o middleware renova a sessão.
        }
      },
    },
  });
}
