import { describe, expect, it } from 'vitest';
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, AuthWeakPasswordError } from '@supabase/supabase-js';
import { traduzirErroAuth } from './erro-auth';

/**
 * 🔴 A RECUSA TEM DE CHEGAR EM PORTUGUÊS, ACIONÁVEL — E VERDADEIRA.
 *
 * O que a tela fazia: `/already|registered|exist/i.test(error.message)` e, para todo o resto,
 * *"Não foi possível criar a conta. Confira os dados e tente de novo."* — a frase que o beta
 * tester leu quando o servidor recusou a senha por falta de número.
 *
 * 🔑 A revisão do Codex (2026-09-12) achou o defeito SEGUINTE, e ele é do mesmo tipo: a
 * primeira correção trocou um balde genérico por classificações **erradas**. Traduzir mal é
 * pior que não traduzir — manda a pessoa consertar o que estava certo. Os quatro casos
 * corrigidos estão marcados com 🔴 abaixo, cada um com a fonte do significado real.
 *
 * 🔒 Os erros deste teste são construídos com as CLASSES REAIS do SDK, não com objetos
 * fabricados: é o que prova que a checagem estrutural (`__isAuthError`, `code`, `name`,
 * `status`, `reasons`) casa com o que o `@supabase/supabase-js` realmente entrega em runtime.
 * O caminho HTTP → erro → copy (com respostas de verdade) vive em `erro-auth-sdk.test.ts`.
 *
 * 📚 https://supabase.com/docs/guides/auth/debugging/error-codes
 *    node_modules/@supabase/auth-js/src/lib/fetch.ts → `handleError`
 */

/** A mensagem literal que o servidor devolveu no 422 de 11/09/2026, 18:07:36 BRT. */
const MSG_SERVIDOR =
  'Password should be at least 8 characters. Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789.';

describe('senha recusada pelo servidor (422 weak_password)', () => {
  it('o caso do beta: nomeia o requisito que falta, em português', () => {
    const erro = new AuthWeakPasswordError(MSG_SERVIDOR, 422, ['characters']);
    const r = traduzirErroAuth(erro, 'Senhaboa', 'criar-conta');
    expect(r.motivo).toBe('senha-fraca');
    expect(r.campo).toBe('senha');
    expect(r.texto).toContain('um número');
  });

  it('quando falta mais de um requisito, lista todos', () => {
    const erro = new AuthWeakPasswordError(MSG_SERVIDOR, 422, ['length', 'characters']);
    expect(traduzirErroAuth(erro, 'abc', 'criar-conta').texto).toContain('8 caracteres, uma letra maiúscula e um número');
  });

  /**
   * 🔑 O BACKEND É A AUTORIDADE — e este é o caso que prova que a tela aceita isso: a senha
   * passou em TODA a validação local e mesmo assim foi recusada. Sem este caminho, a pessoa
   * receberia uma frase que diz "não falta nada", que é pior que a mensagem genérica.
   */
  it('senha vazada (pwned) — o local não tem como saber, e a copy não finge que sabe', () => {
    const erro = new AuthWeakPasswordError('Password is known to be weak and easy to guess', 422, ['pwned']);
    const r = traduzirErroAuth(erro, 'Adaptkorpus2026', 'criar-conta');
    expect(r.motivo).toBe('senha-fraca');
    expect(r.texto).toMatch(/vazamentos/i);
  });

  it('recusa sem razão reconhecível e sem pendência local → declara a política inteira', () => {
    const erro = new AuthWeakPasswordError(MSG_SERVIDOR, 422, []);
    const r = traduzirErroAuth(erro, 'Adaptkorpus2026', 'criar-conta');
    expect(r.motivo).toBe('senha-fraca');
    expect(r.texto).toContain('8 caracteres');
    expect(r.texto).toContain('um número');
  });

  it('o `code` basta, mesmo se o SDK entregar um AuthApiError cru', () => {
    const erro = new AuthApiError(MSG_SERVIDOR, 422, 'weak_password');
    expect(traduzirErroAuth(erro, 'Senhaboa', 'salvar-senha').motivo).toBe('senha-fraca');
  });

  it('a frase da senha fraca serve às duas telas sem falar da ação errada', () => {
    const erro = new AuthWeakPasswordError(MSG_SERVIDOR, 422, ['characters']);
    for (const ctx of ['criar-conta', 'salvar-senha'] as const) {
      const t = traduzirErroAuth(erro, 'Senhaboa', ctx).texto;
      expect(t).toContain('O servidor recusou esta senha');
      expect(t).not.toMatch(/criar a conta|salvar a senha/);
    }
  });
});

/* ══════════ Os quatro achados da revisão Codex ══════════ */

/**
 * 🔴 ACHADO 1 — `email_address_not_authorized` **não** é ausência na allowlist do beta.
 *
 * Documentado: "Email sending is not allowed for this address as your project is using the
 * default SMTP service. Emails can only be sent to members in your Supabase organization."
 * É impedimento de ENVIO do serviço de e-mail. A versão anterior dizia *"Este e-mail não está
 * liberado para o beta fechado"* — afirmava sobre o convite da pessoa algo que o servidor
 * nunca disse, e que pode ser falso mesmo com convite válido.
 */
describe('🔴 achado 1 — email_address_not_authorized é restrição de ENVIO, não de convite', () => {
  const erro = new AuthApiError('Email address not authorized', 403, 'email_address_not_authorized');

  it('classifica como impedimento de envio', () => {
    const r = traduzirErroAuth(erro, 'Adaptkorpus2026', 'criar-conta');
    expect(r.motivo).toBe('email-sem-envio');
  });

  it('NÃO alega que a pessoa não foi convidada nem fala em allowlist/beta fechado', () => {
    const { texto } = traduzirErroAuth(erro, 'Adaptkorpus2026', 'criar-conta');
    expect(texto).not.toMatch(/allowlist|beta fechado|não está liberado|não foi convidad|sem convite/i);
  });

  it('diz que o problema é o envio e oferece saída', () => {
    const { texto } = traduzirErroAuth(erro, 'Adaptkorpus2026', 'criar-conta');
    expect(texto).toMatch(/envi/i);
    expect(texto).toMatch(/suporte/i);
  });

  it('não culpa um campo (o endereço pode estar perfeitamente correto)', () => {
    expect(traduzirErroAuth(erro, 'Adaptkorpus2026', 'criar-conta').campo).toBeNull();
  });
});

/**
 * 🔴 ACHADO 2 — `validation_failed` é genérico.
 *
 * Documentado: "Provided parameters are not in the expected format." O servidor **não diz
 * qual** parâmetro. A versão anterior o classificava como `email-invalido` e mandava o foco
 * para o e-mail: chute apresentado como diagnóstico.
 */
describe('🔴 achado 2 — validation_failed não vira acusação ao e-mail', () => {
  const erro = new AuthApiError('Validation failed', 400, 'validation_failed');

  it('classifica como "não validado", sem campo', () => {
    const r = traduzirErroAuth(erro, 'Adaptkorpus2026', 'criar-conta');
    expect(r.motivo).toBe('nao-validado');
    expect(r.campo).toBeNull();
  });

  it('declara que a solicitação não pôde ser validada e que o campo não veio', () => {
    const { texto } = traduzirErroAuth(erro, 'Adaptkorpus2026', 'criar-conta');
    expect(texto).toMatch(/não conseguiu validar/i);
    expect(texto).toMatch(/não informou qual campo/i);
    expect(texto).not.toMatch(/e-mail|email/i);
  });

  it('`bad_json` cai no mesmo balde honesto', () => {
    expect(traduzirErroAuth(new AuthApiError('bad json', 400, 'bad_json'), 'x', 'criar-conta').motivo).toBe('nao-validado');
  });

  it('a frase fala da ação de cada tela', () => {
    expect(traduzirErroAuth(erro, 'x', 'criar-conta').texto).toContain('criar a conta');
    expect(traduzirErroAuth(erro, 'x', 'salvar-senha').texto).toContain('salvar a senha');
  });

  /** `email_address_invalid` continua sendo do e-mail — esse o servidor DIZ. */
  it('email_address_invalid segue apontando o e-mail (o servidor afirma o campo)', () => {
    const r = traduzirErroAuth(new AuthApiError('Email address is invalid', 400, 'email_address_invalid'), 'x', 'criar-conta');
    expect(r.motivo).toBe('email-invalido');
    expect(r.campo).toBe('email');
  });
});

/**
 * 🔴 ACHADO 3 — `AuthRetryableFetchError` também carrega 5xx.
 *
 * `handleError` (auth-js/src/lib/fetch.ts) lança `AuthRetryableFetchError(msg, 0)` quando a
 * resposta nem parece uma `Response` (transporte), e `AuthRetryableFetchError(msg, status)`
 * para `[500, 501, 502, 503, 504, 520…530]`. A versão anterior mandava as duas para
 * "verifique sua conexão" — culpava a rede da pessoa por resposta do servidor.
 */
describe('🔴 achado 3 — transporte (status 0) ≠ servidor/gateway (5xx)', () => {
  it('status 0 é transporte: aí sim a conexão entra na frase', () => {
    const r = traduzirErroAuth(new AuthRetryableFetchError('Failed to fetch', 0), 'x', 'criar-conta');
    expect(r.motivo).toBe('rede');
    expect(r.texto).toMatch(/conex[ãa]o/i);
  });

  /**
   * A distinção que importa é o MOTIVO e a ausência de acusação à rede. A frase "não é a sua
   * conexão" saiu na simplificação de copy (2ª volta): negar o que ninguém afirmou é ruído —
   * basta não culpar a conexão.
   */
  it.each([500, 501, 502, 503, 504, 520, 530])('status %i é servidor, e a copy NÃO culpa a conexão', (status) => {
    const r = traduzirErroAuth(new AuthRetryableFetchError('Server error', status), 'x', 'criar-conta');
    expect(r.motivo).toBe('servidor');
    expect(r.texto).toBe('O servidor de contas não respondeu como esperado. Tente de novo em instantes.');
    expect(r.texto).not.toMatch(/conex[ãa]o/i);
  });

  it('o que é lançado fora do SDK (chunk que não baixou) continua sendo rede', () => {
    expect(traduzirErroAuth(new TypeError('Failed to fetch'), 'x', 'criar-conta').motivo).toBe('rede');
    expect(traduzirErroAuth(undefined, 'x', 'salvar-senha').motivo).toBe('rede');
    expect(traduzirErroAuth(undefined, 'x', 'salvar-senha').texto).toContain('salvar a senha');
  });

  it('5xx que chega como AuthApiError (sem ser retryable) também é servidor', () => {
    expect(traduzirErroAuth(new AuthApiError('boom', 503, undefined), 'x', 'criar-conta').motivo).toBe('servidor');
    expect(traduzirErroAuth(new AuthApiError('boom', 500, 'unexpected_failure'), 'x', 'criar-conta').motivo).toBe('servidor');
  });
});

/**
 * 🔴 ACHADO 4 — em `/redefinir`, nem toda falha é "peça um novo link".
 *
 * A versão anterior mandava tudo que não fosse `weak_password` para o link novo: a pessoa
 * refazia o fluxo inteiro por um 429, por um 503, ou por ter repetido a senha atual.
 */
describe('🔴 achado 4 — /redefinir separa senha igual, limite, servidor, rede e sessão', () => {
  it('same_password: escolher senha diferente, sem pedir link nenhum', () => {
    const r = traduzirErroAuth(new AuthApiError('New password should be different from the old password.', 422, 'same_password'), 'Adaptkorpus2026', 'salvar-senha');
    expect(r.motivo).toBe('senha-igual-a-atual');
    expect(r.campo).toBe('senha');
    expect(r.texto).toMatch(/senha diferente/i);
    expect(r.texto).not.toMatch(/link/i);
  });

  it.each([
    ['over_request_rate_limit', 429],
    ['over_email_send_rate_limit', 429],
  ] as const)('%s: aguardar, sem pedir link', (code, status) => {
    const r = traduzirErroAuth(new AuthApiError('rate limited', status, code), 'x', 'salvar-senha');
    expect(r.motivo).toBe('limite-tentativas');
    expect(r.texto).toMatch(/Espere alguns minutos/i);
    expect(r.texto).not.toMatch(/link/i);
  });

  it('429 sem código conhecido também é limite', () => {
    expect(traduzirErroAuth(new AuthApiError('too many', 429, undefined), 'x', 'salvar-senha').motivo).toBe('limite-tentativas');
  });

  it('503 em salvar senha: tentar de novo, sem pedir link', () => {
    const r = traduzirErroAuth(new AuthRetryableFetchError('Service Unavailable', 503), 'x', 'salvar-senha');
    expect(r.motivo).toBe('servidor');
    expect(r.texto).not.toMatch(/link/i);
  });

  /**
   * 🔑 SÓ ESTES DOIS sustentam "o link expirou ou já foi usado" — e o que os une é que ambos
   * dizem EXPIROU, com todas as letras ("OTP code … has expired", "PKCE flow state … has
   * expired"). A lista encolheu na 3ª volta; ver o bloco de regressão mais abaixo.
   */
  it.each(['otp_expired', 'flow_state_expired'])('%s: aí sim, a afirmação sobre o link', (code) => {
    const r = traduzirErroAuth(new AuthApiError('link gone', 401, code), 'x', 'salvar-senha');
    expect(r.motivo).toBe('link-expirado');
    expect(r.texto).toMatch(/link de redefinição expirou ou já foi usado/i);
  });

  /**
   * 🔴 ACHADO DA 3ª VOLTA — classificação falsa que o delta anterior introduziu. Reproduzido
   * pelo Codex no módulo real: `AuthApiError(403, bad_code_verifier)` dizia "o link de
   * redefinição expirou ou já foi usado", e não é isso que o código significa:
   *  · `bad_code_verifier` — "the provided code verifier does not match the expected one.
   *    Indicates a bug in the implementation of the client library." É DIVERGÊNCIA do
   *    verificador PKCE: bug de cliente, fluxo iniciado em outro navegador, aba duplicada.
   *  · `flow_state_not_found` — estado NÃO ENCONTRADO. "Not found" tem várias causas; deduzir
   *    "logo, foi usado" é a mesma inferência que já foi reprovada no fallback por status.
   *
   * 🔑 Os dois voltam ao fallback neutro que já existia. Perder precisão é aceitável; afirmar
   * o que não se sabe, não.
   */
  it.each([
    ['bad_code_verifier', 403],
    ['bad_code_verifier', 401],
    ['flow_state_not_found', 404],
  ] as const)('%s (%i) NÃO declara expiração nem uso do link', (code, status) => {
    const r = traduzirErroAuth(new AuthApiError('pkce', status, code), 'x', 'salvar-senha');
    expect(r.motivo).toBe('desconhecido');
    expect(r.campo).toBeNull();
    expect(r.texto).toBe('Não foi possível salvar a senha. Tente de novo em instantes.');
    expect(r.texto, 'voltou a afirmar sobre o link').not.toMatch(/link/i);
  });

  it('o caso exato que o Codex reproduziu (403 bad_code_verifier) deixou de mentir', () => {
    const { texto } = traduzirErroAuth(new AuthApiError('code verifier mismatch', 403, 'bad_code_verifier'), 'x', 'salvar-senha');
    expect(texto).not.toMatch(/expirou ou já foi usado/i);
  });

  /**
   * 🔴 ACHADO DA 2ª VOLTA. Sessão ausente/inválida ORIENTA a recuperação, mas não AFIRMA que
   * o link expirou ou foi usado — a sessão pode ter caído por logout em outra aba, revogação
   * ou relógio fora de hora. Contar a história errada manda a pessoa caçar um e-mail que não
   * é o problema.
   */
  it.each([
    'session_expired',
    'session_not_found',
    'refresh_token_not_found',
    'refresh_token_already_used',
    'bad_jwt',
    'no_authorization',
    'user_not_found',
  ])('%s: orienta o link novo, sem afirmar que o link expirou', (code) => {
    const r = traduzirErroAuth(new AuthApiError('session gone', 401, code), 'x', 'salvar-senha');
    expect(r.motivo).toBe('sessao-invalida');
    expect(r.texto).toMatch(/Peça um novo link/i);
    expect(r.texto, 'afirmou sobre o link algo que o código não sustenta').not.toMatch(/expirou ou já foi usado/i);
  });

  /** `session_not_found` o SDK converte em `AuthSessionMissingError`, que chega SEM `code`. */
  it('AuthSessionMissingError (o que o SDK faz com session_not_found) é sessão inválida', () => {
    const r = traduzirErroAuth(new AuthSessionMissingError(), 'x', 'salvar-senha');
    expect(r.motivo).toBe('sessao-invalida');
    expect(r.texto).toMatch(/Peça um novo link/i);
    expect(r.texto).not.toMatch(/expirou ou já foi usado/i);
  });

  /**
   * 🔴 ACHADO DA 2ª VOLTA. `reauthentication_needed` e `insufficient_aal` dizem que FALTA UM
   * PASSO, não que a autorização morreu — pedir link novo não resolve nenhum dos dois: a
   * pessoa repetiria o fluxo e bateria na mesma parede.
   */
  it.each([
    ['reauthentication_needed', 401],
    ['reauth_nonce_missing', 401],
    ['reauthentication_not_valid', 401],
    ['insufficient_aal', 403],
  ] as const)('%s (%i): confirmação extra de identidade, não expiração de link', (code, status) => {
    const r = traduzirErroAuth(new AuthApiError('reauth', status, code), 'x', 'salvar-senha');
    expect(r.motivo).toBe('reautenticacao');
    expect(r.texto).toMatch(/confirmação extra de identidade/i);
    expect(r.texto).toMatch(/suporte/i);
    expect(r.texto, 'não pode virar história de link').not.toMatch(/link/i);
  });

  /** 🔒 E não promete um passo que o app não tem: não há `reauthenticate()` nem MFA aqui. */
  it('a copy de reautenticação não anuncia tela, código ou fator que não existe', () => {
    const { texto } = traduzirErroAuth(new AuthApiError('reauth', 401, 'reauthentication_needed'), 'x', 'salvar-senha');
    expect(texto).not.toMatch(/MFA|autenticador|c[óo]digo de verifica|token|SMS|aplicativo/i);
    expect(texto).toMatch(/ainda não oferece esse passo/i);
  });

  it('o fallback desconhecido fala de salvar a senha, não de criar conta', () => {
    const r = traduzirErroAuth(new AuthApiError('x', 418, 'codigo_novo_do_servidor'), 'x', 'salvar-senha');
    expect(r.motivo).toBe('desconhecido');
    expect(r.texto).toContain('salvar a senha');
    expect(r.texto).not.toMatch(/criar a conta|link/i);
  });
});

/**
 * 🔴 ACHADO DA 2ª VOLTA — O FALLBACK POR STATUS. Havia uma última linha que convertia
 * QUALQUER 401/403 em "o link expirou ou já foi usado". Reproduzido pelo Codex no módulo
 * real: `insufficient_aal` (403), um código novo em 403 e `reauthentication_needed` (401)
 * saíam os três com essa frase, e nenhum dos três decorre do link.
 *
 * 🔑 A regra: **status não é significado.** 401/403 dizem "não autorizado", não dizem por quê.
 * Sem código conhecido, o honesto é o genérico neutro.
 */
describe('🔴 2ª volta — 401/403 sem código conhecido não vira história de link', () => {
  it.each([
    ['codigo_novo_do_servidor', 403],
    ['codigo_novo_do_servidor', 401],
    ['algo_que_ainda_nao_existe', 403],
  ] as const)('%s (%i) permanece neutro', (code, status) => {
    const r = traduzirErroAuth(new AuthApiError('nope', status, code), 'x', 'salvar-senha');
    expect(r.motivo).toBe('desconhecido');
    expect(r.campo).toBeNull();
    expect(r.texto).toBe('Não foi possível salvar a senha. Tente de novo em instantes.');
  });

  it('401/403 SEM code nenhum também permanece neutro', () => {
    for (const status of [401, 403]) {
      const r = traduzirErroAuth(new AuthApiError('nope', status, undefined), 'x', 'salvar-senha');
      expect(r.motivo).toBe('desconhecido');
      expect(r.texto).not.toMatch(/link/i);
    }
  });

  it('os três casos exatos que o Codex reproduziu não dizem mais que o link expirou', () => {
    const casos = [
      new AuthApiError('insufficient aal', 403, 'insufficient_aal'),
      new AuthApiError('novo', 403, 'codigo_novo'),
      new AuthApiError('reauth', 401, 'reauthentication_needed'),
    ];
    for (const erro of casos) {
      expect(traduzirErroAuth(erro, 'x', 'salvar-senha').texto).not.toMatch(/O link de redefinição expirou ou já foi usado/i);
    }
    // …e continuam distintos entre si: dois motivos diferentes, não um balde novo.
    expect(new Set(casos.map((e) => traduzirErroAuth(e, 'x', 'salvar-senha').motivo)))
      .toEqual(new Set(['reautenticacao', 'desconhecido']));
  });
});

/**
 * ⚠️ `/cadastro` — quem está ali AINDA NÃO TEM CONTA. Mandar "entre de novo" como saída
 * genérica oferece uma porta que essa pessoa não consegue abrir (revisão Codex, 2ª volta).
 */
describe('🔴 2ª volta — /cadastro não manda entrar quem ainda não tem conta', () => {
  const ERROS: unknown[] = [
    new AuthSessionMissingError(),
    new AuthApiError('session gone', 401, 'session_expired'),
    new AuthApiError('link gone', 401, 'otp_expired'),
    new AuthApiError('reauth', 401, 'reauthentication_needed'),
    new AuthApiError('novo', 403, 'codigo_novo'),
    new AuthApiError('validation', 400, 'validation_failed'),
  ];

  it.each(ERROS.map((e, i) => [i, e] as const))('caso %i: nenhuma copy manda a pessoa entrar', (_i, erro) => {
    const { texto } = traduzirErroAuth(erro, 'x', 'criar-conta');
    expect(texto, 'mandou entrar alguém que veio criar conta').not.toMatch(/\bEntre\b|\bentrar\b|fa[çc]a login/i);
  });

  it('a sessão inválida no cadastro orienta o que dá para fazer ali: recarregar', () => {
    const r = traduzirErroAuth(new AuthSessionMissingError(), 'x', 'criar-conta');
    expect(r.motivo).toBe('sessao-invalida');
    expect(r.texto).toMatch(/Recarregue a página/i);
    expect(r.texto).not.toMatch(/link de redefinição/i);
  });
});

describe('as demais recusas do cadastro continuam separadas', () => {
  it.each([
    ['user_already_exists', 400, 'email-em-uso', 'email'],
    ['email_exists', 422, 'email-em-uso', 'email'],
    ['signup_disabled', 422, 'cadastro-fechado', null],
    ['email_provider_disabled', 422, 'cadastro-fechado', null],
  ] as const)('%s → %s', (code, status, motivo, campo) => {
    const r = traduzirErroAuth(new AuthApiError('qualquer coisa em inglês', status, code), 'Adaptkorpus2026', 'criar-conta');
    expect(r.motivo).toBe(motivo);
    expect(r.campo).toBe(campo);
  });

  it('e-mail já cadastrado mantém a copy que já existia', () => {
    const r = traduzirErroAuth(new AuthApiError('User already registered', 400, 'user_already_exists'), 'Adaptkorpus2026', 'criar-conta');
    expect(r.texto).toBe('Este e-mail já tem uma conta. Tente entrar.');
  });

  it('código desconhecido em 4xx não vira acusação a campo nenhum', () => {
    const r = traduzirErroAuth(new AuthApiError('x', 400, 'algo_novo_do_servidor'), 'x', 'criar-conta');
    expect(r.motivo).toBe('desconhecido');
    expect(r.campo).toBeNull();
    expect(r.texto).toContain('criar a conta');
  });
});

/**
 * 🔒 NADA DE TEXTO CRU NA TELA. A mensagem do servidor é inglês de infraestrutura; pode
 * carregar detalhe interno e o usuário não tem o que fazer com ela. A varredura é sobre TODAS
 * as saídas, nos DOIS contextos, não sobre uma amostra escolhida a dedo.
 */
describe('🔒 a mensagem do servidor nunca vaza para a copy', () => {
  const CASOS: unknown[] = [
    new AuthWeakPasswordError(MSG_SERVIDOR, 422, ['characters']),
    new AuthWeakPasswordError(MSG_SERVIDOR, 422, []),
    new AuthApiError('User already registered', 400, 'user_already_exists'),
    new AuthApiError('Email address not authorized', 403, 'email_address_not_authorized'),
    new AuthApiError('Validation failed', 400, 'validation_failed'),
    new AuthApiError('New password should be different from the old password.', 422, 'same_password'),
    new AuthApiError('Signups not allowed for this instance', 422, 'signup_disabled'),
    new AuthApiError('unexpected_failure: db error', 500, 'unexpected_failure'),
    new AuthRetryableFetchError('Failed to fetch', 0),
    new AuthRetryableFetchError('<html>503 Service Unavailable</html>', 503),
    new AuthSessionMissingError(),
    new TypeError('NetworkError when attempting to fetch resource'),
  ];

  it.each(CASOS.flatMap((e, i) => [['criar-conta', i, e] as const, ['salvar-senha', i, e] as const]))(
    '%s / caso %i: copy em português, sem o texto do servidor',
    (contexto, _i, erro) => {
      const { texto } = traduzirErroAuth(erro, 'Senhaboa', contexto);
      expect(texto.length).toBeGreaterThan(10);
      expect(texto).not.toMatch(/Password should|already registered|Failed to fetch|unexpected_failure|NetworkError|Signups not allowed|Service Unavailable|Validation failed|Email address not authorized|old password|Auth session missing/i);
      // A senha tentada jamais aparece na copy (ela vira mensagem, log e print de suporte).
      expect(texto).not.toContain('Senhaboa');
      // Nem código de erro nem status cru chegam à pessoa.
      expect(texto).not.toMatch(/\b(4\d\d|5\d\d)\b|_[a-z]+_|<html>/);
    },
  );
});
