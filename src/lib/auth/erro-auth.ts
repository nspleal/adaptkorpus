/**
 * TRADUÇÃO DAS RECUSAS DO SUPABASE AUTH — por CÓDIGO, não por texto.
 *
 * 🔴 O defeito de origem: a tela de cadastro classificava a falha com
 * `/already|registered|exist/i.test(error.message)` e caía num balde genérico para todo o
 * resto. Uma recusa de senha (422 `weak_password`) virava *"Confira os dados"* — a mensagem
 * que o beta tester viu sem ter como agir.
 *
 * 🔒 Três travas, e elas são o ponto do módulo:
 *  1. **Código antes de mensagem.** `error.code` (`ErrorCode` do SDK) e, na senha fraca,
 *     `error.reasons` (`WeakPasswordReasons`: 'length' | 'characters' | 'pwned') são contrato
 *     documentado. `error.message` é texto do servidor, em inglês, que muda de versão para
 *     versão — casar regex nele é apostar em prosa alheia.
 *  2. **Nada de mensagem crua na tela.** Toda saída daqui é copy nossa, em português. A
 *     mensagem original NUNCA é concatenada, logada nem enviada a telemetria: ela pode
 *     carregar detalhe de infraestrutura, e o usuário não tem o que fazer com ela.
 *  3. **Só afirmamos o que o código realmente diz.** Um código genérico recebe copy genérica
 *     e HONESTA; ele não é convertido em acusação a um campo específico. Errar o culpado é
 *     pior que dizer "não deu": manda a pessoa corrigir o que estava certo.
 *
 * 📚 Fonte dos significados: https://supabase.com/docs/guides/auth/debugging/error-codes
 * e `node_modules/@supabase/auth-js/src/lib/fetch.ts` (`handleError`), conferidos na versão
 * instalada (auth-js 2.108.2).
 *
 * ⚠️ Import de TIPO apenas (`import type`): o SDK continua chegando por `import()` dinâmico na
 * tela, e um import de valor aqui arrastaria o `@supabase/supabase-js` inteiro para o bundle
 * inicial do cadastro. A checagem é estrutural sobre os campos documentados.
 */
import type { AuthError } from '@supabase/supabase-js';
import { fraseDosFaltantes, frasePoliticaCompleta, requisitosFaltantes } from './politica-senha';

/**
 * O que a pessoa estava tentando fazer. A mesma recusa exige frase diferente conforme a
 * ação: "não foi possível criar a conta" numa tela de redefinição de senha é mentira sobre
 * o que acabou de falhar.
 */
export type ContextoAuth = 'criar-conta' | 'salvar-senha';

export type MotivoRecusa =
  | 'senha-fraca'
  | 'senha-igual-a-atual'
  | 'email-em-uso'
  | 'email-invalido'
  | 'email-sem-envio'
  | 'cadastro-fechado'
  | 'limite-tentativas'
  | 'rede'
  | 'servidor'
  | 'link-expirado'
  | 'sessao-invalida'
  | 'reautenticacao'
  | 'nao-validado'
  | 'desconhecido';

export type RecusaTraduzida = {
  motivo: MotivoRecusa;
  /** Campo para onde levar o foco — `null` quando a falha não é de um campo. */
  campo: 'nome' | 'email' | 'senha' | null;
  /** Copy em português, pronta para a tela. Nunca contém a mensagem do servidor. */
  texto: string;
};

/** `AuthError` do SDK: identificado pela marca `__isAuthError` (mesma do `isAuthError`). */
function ehErroDeAuth(e: unknown): e is AuthError {
  return typeof e === 'object' && e !== null && '__isAuthError' in e;
}

/** `AuthWeakPasswordError.reasons`, defensivamente (o campo é opcional no tipo base). */
function razoesDaSenha(e: unknown): string[] {
  const r = (e as { reasons?: unknown }).reasons;
  return Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * 📌 Por que a senha entra aqui: quando o servidor diz só "characters", quem sabe QUAL classe
 * faltou é a pré-validação local. Se ela não achar nada (caso do `pwned`, ou de uma política
 * que mudou no servidor e ainda não aqui), a frase cai para a política inteira — honesta e
 * acionável, sem fingir precisão que não temos.
 */
function textoSenhaFraca(senha: string, razoes: readonly string[]): string {
  if (razoes.includes('pwned')) {
    return 'Esta senha aparece em vazamentos públicos conhecidos. Escolha outra que você não use em nenhum outro lugar.';
  }
  const faltam = requisitosFaltantes(senha);
  if (faltam.length > 0) {
    return `O servidor recusou esta senha: ainda falta ${fraseDosFaltantes(faltam)}.`;
  }
  return `O servidor recusou esta senha. Ela precisa de ${frasePoliticaCompleta()} — e não pode ser uma senha comum.`;
}

/** "Não foi possível criar a conta" / "salvar a senha" — o sujeito certo para cada tela. */
function acao(contexto: ContextoAuth): string {
  return contexto === 'criar-conta' ? 'criar a conta' : 'salvar a senha';
}

/**
 * 🔴 O LINK, DE VERDADE (revisão Codex, 2026-09-12 — 2ª volta).
 *
 * Só estes códigos sustentam a afirmação *"o link expirou ou já foi usado"*: todos descrevem
 * o artefato de uso único que o e-mail carrega — o OTP e o estado do fluxo PKCE que
 * `/auth/callback` troca por sessão.
 *  · `otp_expired` — "OTP code for this sign-in has expired."
 *  · `flow_state_expired` / `flow_state_not_found` — o estado PKCE expirou ou já foi limpo
 *    (e é limpo justamente porque a requisição anterior o consumiu).
 *  · `bad_code_verifier` — o verificador não casa com o fluxo iniciado.
 */
const CODIGOS_LINK = new Set([
  'otp_expired',
  'flow_state_expired',
  'flow_state_not_found',
  'bad_code_verifier',
]);

/**
 * 🔒 SESSÃO AUSENTE OU INVÁLIDA — a autorização desta requisição não vale mais.
 *
 * ⚠️ Parecido, mas NÃO é o mesmo fato que o de cima: a sessão pode ter caído por logout em
 * outra aba, por revogação, por relógio fora de hora. Afirmar "o link expirou ou já foi
 * usado" aqui seria contar uma história que o código não sustenta — e mandar a pessoa
 * conferir a caixa de entrada por um motivo que pode não ser o dela. A orientação de
 * recuperação é a mesma; a AFIRMAÇÃO sobre o link, não.
 */
const CODIGOS_SESSAO = new Set([
  'session_not_found',
  'session_expired',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'bad_jwt',
  'no_authorization',
  'user_not_found',
]);

/**
 * 🔴 CONFIRMAÇÃO EXTRA DE IDENTIDADE — não é sessão expirada (revisão Codex).
 *
 *  · `reauthentication_needed` — "A user needs to reauthenticate to change their password.
 *    Ask the user to reauthenticate by calling the supabase.auth.reauthenticate() API."
 *  · `insufficient_aal` — "the user must have a higher Authenticator Assurance Level."
 *
 * Os dois dizem que FALTA UM PASSO, não que a autorização morreu. Pedir link novo não resolve
 * nenhum dos dois: a pessoa repetiria o fluxo e bateria na mesma parede.
 *
 * 🔒 A copy NÃO promete o passo. `reauthenticate()` e MFA não existem neste app, e anunciar
 * uma tela que não há é o mesmo defeito que esta leva inteira veio consertar. O caminho
 * honesto é o que já existe: o suporte.
 */
const CODIGOS_REAUTENTICACAO = new Set([
  'reauthentication_needed',
  'reauth_nonce_missing',
  'reauthentication_not_valid',
  'insufficient_aal',
]);

/**
 * Traduz a recusa de uma operação de autenticação em copy acionável.
 *
 * @param erro     o que veio em `{ error }` do SDK, ou o que foi lançado no `catch`
 * @param senha    a senha tentada — usada só para dizer QUAL requisito faltou; nunca sai daqui
 * @param contexto o que a pessoa estava fazendo, para a frase falar da ação certa
 */
export function traduzirErroAuth(erro: unknown, senha: string, contexto: ContextoAuth): RecusaTraduzida {
  const generico: RecusaTraduzida = {
    motivo: 'desconhecido',
    campo: null,
    texto: `Não foi possível ${acao(contexto)}. Tente de novo em instantes.`,
  };

  /**
   * Falha antes de existir resposta: o `import()` do chunk que não baixou, ou um `fetch` que
   * nem saiu. Distinta de propósito — mandar "confira os dados" para quem está sem rede é
   * mentira, e culpar a conexão de quem recebeu um 503 também.
   */
  if (!ehErroDeAuth(erro)) {
    return { motivo: 'rede', campo: null, texto: `Não foi possível ${acao(contexto)} agora. Verifique sua conexão e tente de novo.` };
  }

  /**
   * 🔴 `AuthRetryableFetchError` NÃO É SÓ FALHA DE CONEXÃO. Em `handleError`
   * (auth-js/src/lib/fetch.ts) ele é lançado com `status = 0` quando a resposta sequer parece
   * uma `Response` (transporte caiu) **e** com o status real para 500, 501, 502, 503, 504 e a
   * faixa 520–530 da Cloudflare. Tratar os dois como "verifique sua conexão" acusa a rede da
   * pessoa por um problema que é do servidor — ela reinicia o roteador à toa.
   */
  if (erro.name === 'AuthRetryableFetchError') {
    if (typeof erro.status === 'number' && erro.status >= 500) {
      return { motivo: 'servidor', campo: null, texto: 'O servidor de contas não respondeu como esperado. Tente de novo em instantes.' };
    }
    return { motivo: 'rede', campo: null, texto: 'Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.' };
  }

  // `session_not_found` vira `AuthSessionMissingError` dentro do SDK e chega sem `code`.
  if (erro.name === 'AuthSessionMissingError') {
    return { motivo: 'sessao-invalida', campo: null, texto: textoSessao(contexto) };
  }

  if (erro.code === 'weak_password' || erro.name === 'AuthWeakPasswordError') {
    return { motivo: 'senha-fraca', campo: 'senha', texto: textoSenhaFraca(senha, razoesDaSenha(erro)) };
  }

  if (erro.code && CODIGOS_LINK.has(erro.code)) {
    return { motivo: 'link-expirado', campo: null, texto: textoLink(contexto) };
  }

  if (erro.code && CODIGOS_SESSAO.has(erro.code)) {
    return { motivo: 'sessao-invalida', campo: null, texto: textoSessao(contexto) };
  }

  if (erro.code && CODIGOS_REAUTENTICACAO.has(erro.code)) {
    return { motivo: 'reautenticacao', campo: null, texto: textoReautenticacao(contexto) };
  }

  switch (erro.code) {
    case 'same_password':
      // Documentado: "A user that is updating their password must use a different password
      // than the one currently used."
      return { motivo: 'senha-igual-a-atual', campo: 'senha', texto: 'Esta já é a sua senha atual. Escolha uma senha diferente.' };

    case 'user_already_exists':
    case 'email_exists':
    case 'identity_already_exists':
      return { motivo: 'email-em-uso', campo: 'email', texto: 'Este e-mail já tem uma conta. Tente entrar.' };

    case 'email_address_invalid':
      // Documentado: "Example and test domains are currently not supported."
      return { motivo: 'email-invalido', campo: 'email', texto: 'O servidor não aceitou este e-mail. Confira se está escrito corretamente — domínios de exemplo ou de teste não são aceitos.' };

    /**
     * 🔴 NÃO É A ALLOWLIST DO BETA. Documentado: "Email sending is not allowed for this
     * address as your project is using the default SMTP service. Emails can only be sent to
     * members in your Supabase organization." É impedimento de ENVIO do serviço de e-mail do
     * projeto. Dizer "você não foi convidado" seria acusar a pessoa de algo que o servidor
     * não afirmou — e ela não teria o que fazer com isso.
     */
    case 'email_address_not_authorized':
      return {
        motivo: 'email-sem-envio',
        campo: null,
        texto: 'Nosso serviço de e-mail ainda não consegue enviar mensagens para este endereço — é uma limitação do envio, não do seu convite. Fale com o suporte.',
      };

    case 'signup_disabled':
    case 'email_provider_disabled':
      return { motivo: 'cadastro-fechado', campo: null, texto: 'O cadastro está fechado no momento.' };

    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
      return { motivo: 'limite-tentativas', campo: null, texto: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.' };

    /**
     * 🔴 GENÉRICO DE VERDADE. Documentado: "Provided parameters are not in the expected
     * format." O servidor não diz QUAL parâmetro. Atribuir ao e-mail era chute: mandava a
     * pessoa mexer num campo possivelmente correto enquanto o problema estava noutro.
     */
    case 'validation_failed':
    case 'bad_json':
      return { motivo: 'nao-validado', campo: null, texto: `O servidor não conseguiu validar esta solicitação, e não informou qual campo. Tente de novo; se continuar, fale com o suporte para ${acao(contexto)}.` };

    case 'unexpected_failure':
    case 'request_timeout':
      return { motivo: 'servidor', campo: null, texto: 'O servidor de contas não respondeu como esperado. Tente de novo em instantes.' };

    default:
      break;
  }

  // Sem código conhecido, o status ainda separa o que a pessoa pode resolver do que não pode.
  if (erro.status === 429) {
    return { motivo: 'limite-tentativas', campo: null, texto: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.' };
  }
  if (typeof erro.status === 'number' && erro.status >= 500) {
    return { motivo: 'servidor', campo: null, texto: 'O servidor de contas não respondeu como esperado. Tente de novo em instantes.' };
  }
  /**
   * 🔴 AQUI HAVIA UM FALLBACK QUE TRANSFORMAVA QUALQUER 401/403 EM "o link expirou" — e era
   * falso (revisão Codex, 2026-09-12, 2ª volta): `insufficient_aal` (403), um código novo
   * qualquer em 403 e `reauthentication_needed` (401) todos saíam dizendo isso, e nenhum dos
   * três decorre do link. Status sozinho não é significado: 401/403 dizem "não autorizado",
   * não dizem POR QUÊ. O que não tem código conhecido cai no genérico neutro abaixo.
   */
  return generico;
}

/**
 * 🔑 A AFIRMAÇÃO SOBRE O LINK — reservada aos códigos que a sustentam (`CODIGOS_LINK`).
 *
 * Em `/cadastro` não existe link nenhum para expirar; prometer um seria inventar um caminho
 * que aquela tela não tem.
 */
function textoLink(contexto: ContextoAuth): string {
  return contexto === 'salvar-senha'
    ? 'O link de redefinição expirou ou já foi usado. Peça um novo link e crie a senha por ele.'
    : 'Este link não vale mais. Comece de novo por esta tela.';
}

/**
 * Sessão ausente ou inválida. A ORIENTAÇÃO de recuperação é a mesma do link, mas a frase não
 * AFIRMA que o link expirou ou foi usado — a sessão pode ter caído por logout em outra aba,
 * por revogação ou por relógio fora de hora, e contar a história errada manda a pessoa
 * caçar um e-mail que não é o problema.
 *
 * ⚠️ Em `/cadastro` quem está ali ainda **não tem conta**: mandar "entre de novo" como saída
 * genérica é oferecer uma porta que essa pessoa não consegue abrir (revisão Codex).
 */
function textoSessao(contexto: ContextoAuth): string {
  return contexto === 'salvar-senha'
    ? 'Não há mais uma sessão válida para salvar a senha. Peça um novo link de redefinição e crie a senha por ele.'
    : 'A sessão desta página não vale mais. Recarregue a página e tente de novo.';
}

/**
 * Confirmação extra de identidade exigida pelo servidor (`reauthentication_needed`,
 * `insufficient_aal` e parentes).
 *
 * 🔒 A copy diz o que é e para onde ir — e NÃO promete um passo que o app não tem. Não há
 * `reauthenticate()` nem MFA aqui; anunciar uma tela inexistente é o defeito que esta leva
 * inteira veio consertar. O caminho oferecido é o que já existe: o suporte.
 */
function textoReautenticacao(contexto: ContextoAuth): string {
  const alvo = contexto === 'salvar-senha' ? 'antes de trocar a senha' : 'para continuar';
  return `Por segurança, o servidor pediu uma confirmação extra de identidade ${alvo}, e este app ainda não oferece esse passo. Fale com o suporte.`;
}
