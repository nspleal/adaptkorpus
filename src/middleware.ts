/**
 * Middleware — renova a sessão do Supabase a cada navegação (cookies httpOnly).
 * Se o Supabase não estiver configurado (dev sem backend), apenas segue adiante.
 *
 * Nota: o gating de rotas privadas (ex.: exigir login + assinatura ativa para /plano)
 * deve ser adicionado aqui quando a auth entrar — está marcado em docs/security-lgpd.md.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { supabaseConfigurado } from '@/lib/supabase/env';

type CookieParaGravar = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  if (!supabaseConfigurado()) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieParaGravar[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Renova o token (não remover — mantém a sessão viva).
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Roda em tudo, menos estáticos e a imagem do Next.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)'],
};
