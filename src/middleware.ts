/**
 * Middleware — Content-Security-Policy com NONCE por requisição + renovação de sessão.
 *
 * Por que aqui (e não no next.config): o App Router emite scripts inline para hidratar.
 * Uma CSP estática `script-src 'self'` os bloqueia → página em branco. Com nonce por
 * requisição (+ 'strict-dynamic'), o Next assina seus próprios scripts e a CSP continua
 * forte (sem 'unsafe-inline'). Os demais headers de segurança ficam no next.config.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { supabaseConfigurado } from '@/lib/supabase/env';

type CookieParaGravar = { name: string; value: string; options: CookieOptions };

function supabaseOrigin(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) return '';
  try {
    return new URL(v).origin;
  } catch {
    return '';
  }
}

function construirCSP(nonce: string): string {
  const origin = supabaseOrigin();
  const ws = origin ? origin.replace(/^http/, 'ws') : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${origin} ${ws}`.trim(),
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ]
    .filter(Boolean)
    .join('; ');
}

export async function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = construirCSP(nonce);

  // O Next lê a CSP do header da REQUISIÇÃO e aplica o nonce aos seus scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);

  // Renova a sessão do Supabase quando configurado (não remover — mantém login vivo).
  if (supabaseConfigurado()) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: CookieParaGravar[]) {
            for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
            response = NextResponse.next({ request: { headers: requestHeaders } });
            response.headers.set('content-security-policy', csp);
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      },
    );
    await supabase.auth.getUser();
  }

  return response;
}

export const config = {
  // Roda em tudo, menos estáticos e a imagem do Next.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)'],
};
