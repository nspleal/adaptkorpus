import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * OPEN REDIRECT em `/auth/callback` — teste DA ROTA (§2.C da blindagem 2026-07-05).
 *
 * 🔴 O buraco que isto fecha (achado 2026-07-30): `caminhoRelativoSeguro` tinha 3 testes e
 * `route.ts` tinha ZERO. Apagar a chamada do helper na rota — trocando-a por
 * `searchParams.get('next') ?? '/app'` — **passava na suíte inteira (731 testes)**. O
 * helper provado + a rota não provada = a mesma lição que se repetiu a semana toda: testar
 * a peça pura não testa que alguém a usa.
 *
 * ⚠️ E o teste tem de exercitar o **caminho de SUCESSO**. Um `curl` contra o app sem
 * Supabase manda `next=https://evil.com` E `next=/app` para o mesmo `/login?erro=link`,
 * porque a troca do `code` falha antes de o `destino` ser usado: prova o caminho de erro e
 * dá a sensação de segurança sem tocar na linha que importa. Por isso o mock devolve
 * `{ error: null }` — só assim a linha 21 (`NextResponse.redirect(destino)`) roda.
 */

const trocar = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: trocar } }),
}));

const ORIGEM = 'https://app.example.test';

/** Chama a rota com um `code` que TROCA COM SUCESSO e devolve o destino do 302. */
async function destinoDe(next: string | null): Promise<string> {
  const { GET } = await import('./route');
  const qs = next === null ? 'code=ok' : `code=ok&next=${encodeURIComponent(next)}`;
  const res = await GET(new NextRequest(`${ORIGEM}/auth/callback?${qs}`));
  return res.headers.get('location') ?? '';
}

beforeEach(() => {
  trocar.mockReset();
  trocar.mockResolvedValue({ error: null }); // caminho de SUCESSO — sem isto o teste é vazio
});

describe('/auth/callback — `next` externo nunca sai do domínio', () => {
  it('o mock realmente entra no caminho de sucesso (senão tudo abaixo é vácuo)', async () => {
    const d = await destinoDe('/app');
    expect(trocar, 'a troca do code nem foi chamada').toHaveBeenCalledTimes(1);
    // Se cair em /login?erro=link, o mock não pegou e os casos hostis passariam de graça.
    expect(d, 'a rota caiu no caminho de ERRO — o teste não prova nada').toBe(`${ORIGEM}/app`);
  });

  const HOSTIS = [
    'https://evil.com',
    'http://evil.com/x',
    '//evil.com',
    '/\\evil.com',
    'javascript:alert(1)',
    'https://app.example.test.evil.com',
    '/a\nb',
  ];

  /**
   * Quase-acertos: estes PASSAM pelo helper (começam com `/`, sem `//` inicial, sem `\`) e
   * só ficam no domínio pela semântica do `new URL(path, origin)` — host fixo quando o
   * caminho tem uma barra inicial. Ficam travados aqui porque a segurança deles é
   * consequência de biblioteca, não decisão nossa: se o redirect um dia passar a montar a
   * URL de outro jeito, é aqui que quebra.
   */
  it.each(['/.//evil.com', '/:%2F%2Fevil.com', '/..//evil.com'])(
    'next=%j passa pelo helper mas NÃO troca de host',
    async (quaseAcerto) => {
      const d = await destinoDe(quaseAcerto);
      expect(new URL(d).origin, `escapou para ${d}`).toBe(ORIGEM);
      expect(new URL(d).host).toBe('app.example.test');
    },
  );

  it.each(HOSTIS)('next=%j → fica no domínio', async (hostil) => {
    const d = await destinoDe(hostil);
    expect(new URL(d).origin, `escapou para ${d}`).toBe(ORIGEM);
    expect(d).toBe(`${ORIGEM}/app`); // cai no fallback, não no valor hostil
  });

  it.each(['/app', '/onboarding?x=1', '/conta#sec'])('next=%j (interno) é respeitado', async (interno) => {
    expect(await destinoDe(interno)).toBe(`${ORIGEM}${interno}`);
  });

  it('sem `next` vai para /app', async () => {
    expect(await destinoDe(null)).toBe(`${ORIGEM}/app`);
  });

  it('troca falha → /login?erro=link, e o `next` hostil não vaza nem aí', async () => {
    trocar.mockResolvedValue({ error: new Error('code inválido') });
    const d = await destinoDe('https://evil.com');
    expect(d).toBe(`${ORIGEM}/login?erro=link`);
  });

  it('exceção na troca → /login?erro=link (sem vazar detalhe na URL)', async () => {
    trocar.mockRejectedValue(new Error('rede'));
    const d = await destinoDe('https://evil.com');
    expect(d).toBe(`${ORIGEM}/login?erro=link`);
    expect(d).not.toMatch(/rede/);
  });

  /**
   * Trava a estrutura, não só o comportamento: a rota tem de passar pelo helper. Um
   * `new URL(next, origin)` com `next` cru resolveria para `https://evil.com` — a
   * sanitização é a única coisa entre o parâmetro e o `Location`.
   */
  it('a rota chama `caminhoRelativoSeguro` (não confia no `new URL`)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/app/auth/callback/route.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^[ \t]*\/\/.*$/gm, ' ');
    expect(src).toMatch(/caminhoRelativoSeguro\(\s*url\.searchParams\.get\('next'\)/);
    expect(/new URL\(\s*url\.searchParams\.get\('next'\)/.test(src), 'usa o `next` cru no redirect').toBe(false);
  });
});
