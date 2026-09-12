import { describe, expect, it } from 'vitest';
import { AuthApiError, AuthRetryableFetchError, AuthWeakPasswordError } from '@supabase/supabase-js';
import { traduzirErroCadastro } from './erro-auth';

/**
 * 🔴 A RECUSA TEM DE CHEGAR EM PORTUGUÊS E ACIONÁVEL.
 *
 * O que a tela fazia: `/already|registered|exist/i.test(error.message)` e, para todo o resto,
 * *"Não foi possível criar a conta. Confira os dados e tente de novo."* — a frase que o beta
 * tester leu quando o servidor recusou a senha por falta de número.
 *
 * 🔒 Os erros deste teste são construídos com as CLASSES REAIS do SDK, não com objetos
 * fabricados: é o que prova que a checagem estrutural (`__isAuthError`, `code`, `name`,
 * `reasons`) casa com o que o `@supabase/supabase-js` realmente entrega em runtime.
 */

/** A mensagem literal que o servidor devolveu no 422 de 11/09/2026, 18:07:36 BRT. */
const MSG_SERVIDOR =
  'Password should be at least 8 characters. Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789.';

describe('senha recusada pelo servidor (422 weak_password)', () => {
  it('o caso do beta: nomeia o requisito que falta, em português', () => {
    const erro = new AuthWeakPasswordError(MSG_SERVIDOR, 422, ['characters']);
    const r = traduzirErroCadastro(erro, 'Senhaboa');
    expect(r.motivo).toBe('senha-fraca');
    expect(r.campo).toBe('senha');
    expect(r.texto).toContain('um número');
  });

  it('quando falta mais de um requisito, lista todos', () => {
    const erro = new AuthWeakPasswordError(MSG_SERVIDOR, 422, ['length', 'characters']);
    expect(traduzirErroCadastro(erro, 'abc').texto).toContain('8 caracteres, uma letra maiúscula e um número');
  });

  /**
   * 🔑 O BACKEND É A AUTORIDADE — e este é o caso que prova que a tela aceita isso: a senha
   * passou em TODA a validação local e mesmo assim foi recusada. Sem este caminho, a pessoa
   * receberia uma frase que diz "não falta nada", que é pior do que a mensagem genérica.
   */
  it('senha vazada (pwned) — o local não tem como saber, e a copy não finge que sabe', () => {
    const erro = new AuthWeakPasswordError('Password is known to be weak and easy to guess', 422, ['pwned']);
    const r = traduzirErroCadastro(erro, 'Adaptkorpus2026');
    expect(r.motivo).toBe('senha-fraca');
    expect(r.texto).toMatch(/vazamentos/i);
  });

  it('recusa sem razão reconhecível e sem pendência local → declara a política inteira', () => {
    const erro = new AuthWeakPasswordError(MSG_SERVIDOR, 422, []);
    const r = traduzirErroCadastro(erro, 'Adaptkorpus2026');
    expect(r.motivo).toBe('senha-fraca');
    expect(r.texto).toContain('8 caracteres');
    expect(r.texto).toContain('um número');
  });

  it('o `code` basta, mesmo se o SDK entregar um AuthApiError cru', () => {
    const erro = new AuthApiError(MSG_SERVIDOR, 422, 'weak_password');
    expect(traduzirErroCadastro(erro, 'Senhaboa').motivo).toBe('senha-fraca');
  });
});

describe('as demais recusas continuam separadas (nada de balde único)', () => {
  it.each([
    ['user_already_exists', 400, 'email-em-uso', 'email'],
    ['email_exists', 422, 'email-em-uso', 'email'],
    ['email_address_invalid', 400, 'email-invalido', 'email'],
    ['email_address_not_authorized', 403, 'email-nao-autorizado', 'email'],
    ['signup_disabled', 422, 'cadastro-fechado', null],
    ['over_request_rate_limit', 429, 'limite-tentativas', null],
    ['over_email_send_rate_limit', 429, 'limite-tentativas', null],
  ] as const)('%s → %s', (code, status, motivo, campo) => {
    const r = traduzirErroCadastro(new AuthApiError('qualquer coisa em inglês', status, code), 'Adaptkorpus2026');
    expect(r.motivo).toBe(motivo);
    expect(r.campo).toBe(campo);
  });

  it('e-mail já cadastrado mantém a copy que já existia', () => {
    const r = traduzirErroCadastro(new AuthApiError('User already registered', 400, 'user_already_exists'), 'Adaptkorpus2026');
    expect(r.texto).toBe('Este e-mail já tem uma conta. Tente entrar.');
  });

  it('falha de rede do SDK é rede — não "confira os dados"', () => {
    const r = traduzirErroCadastro(new AuthRetryableFetchError('Failed to fetch', 0), 'Adaptkorpus2026');
    expect(r.motivo).toBe('rede');
    expect(r.texto).toMatch(/conex[ãa]o/i);
  });

  it('o que é lançado fora do SDK (chunk que não baixou) também é rede', () => {
    expect(traduzirErroCadastro(new TypeError('Failed to fetch'), 'Adaptkorpus2026').motivo).toBe('rede');
    expect(traduzirErroCadastro(undefined, 'Adaptkorpus2026').motivo).toBe('rede');
  });

  it('sem código conhecido, o status ainda separa 429 de 5xx de 4xx', () => {
    expect(traduzirErroCadastro(new AuthApiError('x', 429, undefined), 'a').motivo).toBe('limite-tentativas');
    expect(traduzirErroCadastro(new AuthApiError('x', 503, undefined), 'a').motivo).toBe('servidor');
    expect(traduzirErroCadastro(new AuthApiError('x', 400, 'algo_novo_do_servidor'), 'a').motivo).toBe('desconhecido');
  });
});

/**
 * 🔒 NADA DE TEXTO CRU NA TELA. A mensagem do servidor é inglês de infraestrutura; pode
 * carregar detalhe interno e o usuário não tem o que fazer com ela. A varredura é sobre TODAS
 * as saídas, não sobre uma amostra escolhida a dedo.
 */
describe('🔒 a mensagem do servidor nunca vaza para a copy', () => {
  const CASOS: unknown[] = [
    new AuthWeakPasswordError(MSG_SERVIDOR, 422, ['characters']),
    new AuthWeakPasswordError(MSG_SERVIDOR, 422, []),
    new AuthApiError('User already registered', 400, 'user_already_exists'),
    new AuthApiError('Signups not allowed for this instance', 422, 'signup_disabled'),
    new AuthApiError('unexpected_failure: db error', 500, 'unexpected_failure'),
    new AuthRetryableFetchError('Failed to fetch', 0),
    new TypeError('NetworkError when attempting to fetch resource'),
  ];

  it.each(CASOS.map((e, i) => [i, e] as const))('caso %i: copy em português, sem o texto do servidor', (_i, erro) => {
    const { texto } = traduzirErroCadastro(erro, 'Senhaboa');
    expect(texto.length).toBeGreaterThan(10);
    expect(texto).not.toMatch(/Password should|already registered|Failed to fetch|unexpected_failure|NetworkError|Signups not allowed/i);
    // A senha tentada jamais aparece na copy (ela vira mensagem, log e print de suporte).
    expect(texto).not.toContain('Senhaboa');
  });
});
