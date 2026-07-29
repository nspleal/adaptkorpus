/**
 * Cliente Supabase para o SERVIDOR (Server Components / Route Handlers).
 * Usa a anon key + cookies do usuário → RLS continua valendo (acessa só o próprio dado).
 *
 * 🔒 `Secure` no cookie de sessão (tarefa aberta desde 2026-07-06). Sem ele, o cookie do
 * refresh token viaja em `http://` — irrelevante em produção (a Vercel serve só HTTPS e o
 * HSTS do next.config força), mas é a diferença entre "não acontece" e "não pode acontecer".
 *
 * ⚠️ CONDICIONADO AO AMBIENTE, de propósito: em `NODE_ENV !== 'production'` o `Secure` fica
 * de fora, senão o desenvolvimento local em `http://localhost` deixaria de manter sessão —
 * o browser recusa cookie `Secure` em origem insegura, e o login entraria em laço. O
 * `sameSite: 'lax'` vale nos dois (a navegação de volta do link de e-mail precisa dele).
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAnonKey, supabaseUrl } from './env';

const producao = process.env.NODE_ENV === 'production';

type CookieParaGravar = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookieOptions: { secure: producao, sameSite: 'lax', path: '/' },
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
