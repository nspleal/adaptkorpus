import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { traduzirErroAuth } from './erro-auth';

/**
 * 🔑 O CAMINHO REAL DA TELA, COM RESPOSTAS SIMULADAS (revisão Codex, 2026-09-12).
 *
 * Os outros testes deste lote provam duas pontas soltas: `erro-auth.test.ts` monta os erros
 * **à mão** (com as classes do SDK, mas à mão), e os guards de tela leem o **fonte**. Nenhum
 * dos dois prova o meio: que uma RESPOSTA HTTP do GoTrue, passando pelo
 * `@supabase/supabase-js` de verdade, vira o erro que a tela espera e a copy certa.
 *
 * Aqui o percurso é o mesmo da tela, inteiro:
 *
 *   resposta HTTP crua → `auth.signUp` / `auth.updateUser` do SDK instalado
 *     → `handleError` monta a classe de erro → `traduzirErroAuth(error, senha, contexto)`
 *       → a frase que a pessoa lê
 *
 * ⚠️ Nada de rede: o `fetch` é injetado por `global.fetch` do próprio cliente e devolve
 * `Response` locais com as cargas gravadas do servidor real. Nenhuma conta é criada, nenhum
 * e-mail sai, nenhuma senha de ninguém muda.
 *
 * 📌 Por que isto pega o que o resto não pega: quem decide se um 503 vira
 * `AuthRetryableFetchError` ou `AuthApiError` é a tabela `NETWORK_ERROR_CODES` **dentro** do
 * SDK (fetch.ts). Se uma atualização do SDK mudar essa tabela, ou passar a mandar `code` por
 * outro caminho, é aqui que a mudança aparece — e não num 422 na cara do usuário.
 */

const URL_FAKE = 'https://projeto-ficticio.supabase.co';
const CHAVE_FAKE = 'sb_publishable_chave_ficticia_de_teste';

/** Resposta de erro do GoTrue, na forma exata em que o servidor real a devolve. */
function respostaErro(status: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Sessão válida devolvida por `/token?grant_type=password` — só para alcançar o `updateUser`. */
function respostaSessao(): Response {
  const agora = Math.floor(Date.now() / 1000);
  return new Response(
    JSON.stringify({
      access_token: 'token.de.teste',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: agora + 3600,
      refresh_token: 'refresh-de-teste',
      user: { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'ficticio@exemplo.invalid', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

/** Cliente do SDK com o `fetch` sob controle do teste. */
function clienteCom(responder: (url: string, init?: RequestInit) => Promise<Response>) {
  return createClient(URL_FAKE, CHAVE_FAKE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => responder(String(input), init) },
  });
}

/** O que a tela de cadastro faz, ponta a ponta. */
async function cadastrarCom(responder: (url: string, init?: RequestInit) => Promise<Response>, senha: string) {
  const { error } = await clienteCom(responder).auth.signUp({ email: 'ficticio@exemplo.invalid', password: senha });
  expect(error, 'o SDK deveria ter devolvido erro nesta resposta').not.toBeNull();
  return { erro: error, recusa: traduzirErroAuth(error, senha, 'criar-conta') };
}

/** O que a tela de redefinição faz: entra com a sessão de recuperação e salva a senha nova. */
async function salvarSenhaCom(respostaDoUpdate: Response | (() => never), senha: string) {
  const sb = clienteCom(async (url) => {
    if (url.includes('/token')) return respostaSessao();
    if (typeof respostaDoUpdate === 'function') respostaDoUpdate();
    return respostaDoUpdate as Response;
  });
  const entrada = await sb.auth.signInWithPassword({ email: 'ficticio@exemplo.invalid', password: 'irrelevante' });
  expect(entrada.error, 'a sessão de recuperação simulada não foi estabelecida').toBeNull();

  const { error } = await sb.auth.updateUser({ password: senha });
  expect(error, 'o SDK deveria ter devolvido erro nesta resposta').not.toBeNull();
  return { erro: error, recusa: traduzirErroAuth(error, senha, 'salvar-senha') };
}

beforeEach(() => {
  // O SDK faz `console.error(e)` no caminho de transporte caído (fetch.ts, _handleRequest).
  // É log DELE, não nosso; silenciado para o teste não confundir ruído com defeito.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

/* ══════════ /cadastro ══════════ */

describe('caminho real do /cadastro — resposta HTTP → SDK → copy', () => {
  /** A carga LITERAL do 422 que o servidor devolveu ao beta tester em 11/09/2026. */
  it('🔴 o 422 do beta tester vira "ainda falta um número"', async () => {
    const { erro, recusa } = await cadastrarCom(
      async () => respostaErro(422, {
        code: 422,
        error_code: 'weak_password',
        msg: 'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789.',
        weak_password: { reasons: ['characters'], message: 'Password should contain at least one character of each…' },
      }),
      'Senhaboa',
    );
    // Prova de que o SDK realmente construiu a classe especializada (e não um AuthApiError).
    expect(erro?.name).toBe('AuthWeakPasswordError');
    expect((erro as unknown as { reasons: string[] }).reasons).toEqual(['characters']);
    expect(recusa.motivo).toBe('senha-fraca');
    expect(recusa.campo).toBe('senha');
    expect(recusa.texto).toContain('um número');
  });

  it('e-mail já cadastrado', async () => {
    const { erro, recusa } = await cadastrarCom(
      async () => respostaErro(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' }),
      'Adaptkorpus2026',
    );
    expect(erro?.code).toBe('user_already_exists');
    expect(recusa.motivo).toBe('email-em-uso');
  });

  /** 🔴 achado 1 da revisão: restrição do SMTP padrão, nunca "você não foi convidado". */
  it('email_address_not_authorized não vira acusação de convite', async () => {
    const { recusa } = await cadastrarCom(
      async () => respostaErro(403, {
        code: 403,
        error_code: 'email_address_not_authorized',
        msg: 'Email address "x" cannot be used as it is not authorized',
      }),
      'Adaptkorpus2026',
    );
    expect(recusa.motivo).toBe('email-sem-envio');
    expect(recusa.texto).not.toMatch(/allowlist|beta fechado|convidad/i);
    expect(recusa.texto).toMatch(/envi/i);
  });

  /** 🔴 achado 2: genérico continua genérico, e não aponta o e-mail. */
  it('validation_failed não culpa campo nenhum', async () => {
    const { recusa } = await cadastrarCom(
      async () => respostaErro(400, { code: 400, error_code: 'validation_failed', msg: 'Validation failed' }),
      'Adaptkorpus2026',
    );
    expect(recusa.motivo).toBe('nao-validado');
    expect(recusa.campo).toBeNull();
    expect(recusa.texto).not.toMatch(/e-mail/i);
  });

  /** 🔴 achado 3a: transporte caído — o `fetch` nem devolve `Response`. */
  it('transporte caído vira AuthRetryableFetchError status 0 → fala de conexão', async () => {
    const { erro, recusa } = await cadastrarCom(
      async () => { throw new TypeError('Failed to fetch'); },
      'Adaptkorpus2026',
    );
    expect(erro?.name).toBe('AuthRetryableFetchError');
    expect(erro?.status).toBe(0);
    expect(recusa.motivo).toBe('rede');
    expect(recusa.texto).toMatch(/Verifique sua conexão/i);
  });

  /**
   * 🔴 achado 3b: o MESMO tipo de erro com status 5xx. É este caso que o teste de unidade
   * sozinho não provava — quem decide isso é a tabela `NETWORK_ERROR_CODES` do SDK.
   */
  it.each([500, 502, 503, 504, 521])('HTTP %i também vira AuthRetryableFetchError, e a copy não culpa a conexão', async (status) => {
    const { erro, recusa } = await cadastrarCom(
      async () => new Response('<html>upstream error</html>', { status, headers: { 'Content-Type': 'text/html' } }),
      'Adaptkorpus2026',
    );
    expect(erro?.name).toBe('AuthRetryableFetchError');
    expect(erro?.status).toBe(status);
    expect(recusa.motivo).toBe('servidor');
    expect(recusa.texto).toMatch(/Não é a sua conexão/i);
    expect(recusa.texto).not.toMatch(/Verifique sua conexão/i);
  });

  it('429 do servidor vira limite de tentativas', async () => {
    const { recusa } = await cadastrarCom(
      async () => respostaErro(429, { code: 429, error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' }),
      'Adaptkorpus2026',
    );
    expect(recusa.motivo).toBe('limite-tentativas');
  });

  it('🔒 em nenhum destes a mensagem crua do servidor chega à copy', async () => {
    const cargas: [number, Record<string, unknown>][] = [
      [422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 8 characters.', weak_password: { reasons: ['length'] } }],
      [422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' }],
      [403, { code: 403, error_code: 'email_address_not_authorized', msg: 'Email address not authorized' }],
      [400, { code: 400, error_code: 'validation_failed', msg: 'Validation failed' }],
      [500, { code: 500, error_code: 'unexpected_failure', msg: 'Database error saving new user' }],
    ];
    for (const [status, corpo] of cargas) {
      const { recusa } = await cadastrarCom(async () => respostaErro(status, corpo), 'Senhaboa');
      expect(recusa.texto).not.toContain(String(corpo.msg));
      expect(recusa.texto).not.toContain('Senhaboa');
    }
  });
});

/* ══════════ /redefinir ══════════ */

describe('caminho real do /redefinir — resposta HTTP → SDK → copy', () => {
  it('🔴 same_password: escolher outra senha, sem pedir link novo', async () => {
    const { erro, recusa } = await salvarSenhaCom(
      respostaErro(422, { code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' }),
      'Adaptkorpus2026',
    );
    expect(erro?.code).toBe('same_password');
    expect(recusa.motivo).toBe('senha-igual-a-atual');
    expect(recusa.texto).toMatch(/senha diferente/i);
    expect(recusa.texto).not.toMatch(/link/i);
  });

  it('🔴 limite de tentativas: aguardar, sem pedir link novo', async () => {
    const { recusa } = await salvarSenhaCom(
      respostaErro(429, { code: 429, error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' }),
      'Adaptkorpus2026',
    );
    expect(recusa.motivo).toBe('limite-tentativas');
    expect(recusa.texto).not.toMatch(/link/i);
  });

  it('🔴 503 do servidor: tentar de novo, sem pedir link e sem culpar a conexão', async () => {
    const { erro, recusa } = await salvarSenhaCom(
      new Response('<html>503</html>', { status: 503, headers: { 'Content-Type': 'text/html' } }),
      'Adaptkorpus2026',
    );
    expect(erro?.name).toBe('AuthRetryableFetchError');
    expect(recusa.motivo).toBe('servidor');
    expect(recusa.texto).not.toMatch(/link|Verifique sua conexão/i);
  });

  it('🔴 transporte caído: conexão, sem pedir link novo', async () => {
    const { recusa } = await salvarSenhaCom(
      () => { throw new TypeError('Failed to fetch'); },
      'Adaptkorpus2026',
    );
    expect(recusa.motivo).toBe('rede');
    expect(recusa.texto).toMatch(/conex[ãa]o/i);
    expect(recusa.texto).not.toMatch(/link/i);
  });

  it('🔴 sessão expirada: AÍ SIM o link novo', async () => {
    const { recusa } = await salvarSenhaCom(
      respostaErro(401, { code: 401, error_code: 'session_expired', msg: 'Session expired' }),
      'Adaptkorpus2026',
    );
    expect(recusa.motivo).toBe('sessao-invalida');
    expect(recusa.texto).toMatch(/link de redefinição/i);
  });

  it('session_not_found: o SDK converte em AuthSessionMissingError e a copy é a mesma', async () => {
    const { erro, recusa } = await salvarSenhaCom(
      respostaErro(404, { code: 404, error_code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' }),
      'Adaptkorpus2026',
    );
    expect(erro?.name).toBe('AuthSessionMissingError');
    expect(recusa.motivo).toBe('sessao-invalida');
    expect(recusa.texto).toMatch(/link de redefinição/i);
  });

  it('a senha nova também é validada pelo servidor aqui, e a recusa nomeia o requisito', async () => {
    const { erro, recusa } = await salvarSenhaCom(
      respostaErro(422, {
        code: 422,
        error_code: 'weak_password',
        msg: 'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789.',
        weak_password: { reasons: ['characters'] },
      }),
      'Senhaboa',
    );
    expect(erro?.name).toBe('AuthWeakPasswordError');
    expect(recusa.motivo).toBe('senha-fraca');
    expect(recusa.texto).toContain('um número');
    expect(recusa.texto).not.toMatch(/link/i);
  });

  it('🔒 nenhuma destas frases fala em "criar a conta" — a tela é outra', async () => {
    const casos: (Response | (() => never))[] = [
      respostaErro(422, { code: 422, error_code: 'same_password', msg: 'x' }),
      respostaErro(429, { code: 429, error_code: 'over_request_rate_limit', msg: 'x' }),
      respostaErro(401, { code: 401, error_code: 'session_expired', msg: 'x' }),
      respostaErro(418, { code: 418, error_code: 'codigo_desconhecido', msg: 'x' }),
    ];
    for (const c of casos) {
      const { recusa } = await salvarSenhaCom(c, 'Adaptkorpus2026');
      expect(recusa.texto).not.toMatch(/criar a conta/i);
    }
  });
});
