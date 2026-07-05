import { NextResponse, type NextRequest } from 'next/server';
import { caminhoRelativoSeguro } from '@/lib/auth/redirect-seguro';

/**
 * `/auth/callback` — destino dos links de e-mail do Supabase Auth (confirmação de cadastro,
 * recuperação de senha). Troca o `code` PKCE por sessão (grava os cookies) e redireciona ao
 * `next` — **validado como caminho interno** (anti open-redirect, §2.C/§6 da blindagem).
 */
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const destino = caminhoRelativoSeguro(url.searchParams.get('next'), '/app');

  if (code) {
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(destino, url.origin));
    } catch {
      // cai no redirect de erro abaixo — nunca logar detalhe (§ higiene de logs)
    }
  }
  return NextResponse.redirect(new URL('/login?erro=link', url.origin));
}
