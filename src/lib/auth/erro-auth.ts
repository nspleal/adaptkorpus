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
 *  3. **O backend continua sendo a autoridade.** A pré-validação local (`politica-senha.ts`)
 *     não cobre tudo — `pwned` (vazamentos) só o servidor sabe. Quando ele recusa uma senha
 *     que passou aqui, esta função ainda produz uma explicação útil.
 *
 * ⚠️ Import de TIPO apenas (`import type`): o SDK continua chegando por `import()` dinâmico na
 * tela, e um import de valor aqui arrastaria o `@supabase/supabase-js` inteiro para o bundle
 * inicial do cadastro. A checagem é estrutural sobre os campos documentados.
 */
import type { AuthError } from '@supabase/supabase-js';
import { fraseDosFaltantes, frasePoliticaCompleta, requisitosFaltantes } from './politica-senha';

export type MotivoRecusa =
  | 'senha-fraca'
  | 'email-em-uso'
  | 'email-invalido'
  | 'email-nao-autorizado'
  | 'cadastro-fechado'
  | 'limite-tentativas'
  | 'rede'
  | 'servidor'
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

/**
 * Traduz a recusa de um `signUp` (ou qualquer falha do caminho) em copy acionável.
 *
 * @param erro   o que veio em `{ error }` do SDK, ou o que foi lançado no `catch`
 * @param senha  a senha tentada — usada só para dizer QUAL requisito faltou; nunca sai daqui
 */
export function traduzirErroCadastro(erro: unknown, senha: string): RecusaTraduzida {
  // Falha antes de ter resposta: `import()` do chunk que não baixou, fetch que não saiu.
  // Distinta de propósito — mandar "confira os dados" para quem está sem rede é mentira.
  if (!ehErroDeAuth(erro)) {
    return { motivo: 'rede', campo: null, texto: 'Não foi possível criar a conta agora. Verifique sua conexão e tente de novo.' };
  }

  // `AuthRetryableFetchError` não carrega `code` — o SDK o identifica pelo `name`, e é assim
  // que `isAuthRetryableFetchError` funciona lá dentro.
  if (erro.name === 'AuthRetryableFetchError') {
    return { motivo: 'rede', campo: null, texto: 'Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.' };
  }

  if (erro.code === 'weak_password' || erro.name === 'AuthWeakPasswordError') {
    return { motivo: 'senha-fraca', campo: 'senha', texto: textoSenhaFraca(senha, razoesDaSenha(erro)) };
  }

  switch (erro.code) {
    case 'user_already_exists':
    case 'email_exists':
    case 'identity_already_exists':
      return { motivo: 'email-em-uso', campo: 'email', texto: 'Este e-mail já tem uma conta. Tente entrar.' };

    case 'email_address_invalid':
    case 'validation_failed':
      return { motivo: 'email-invalido', campo: 'email', texto: 'Confira o e-mail digitado — o servidor não o aceitou.' };

    case 'email_address_not_authorized':
      return { motivo: 'email-nao-autorizado', campo: 'email', texto: 'Este e-mail não está liberado para o beta fechado. Fale com o suporte.' };

    case 'signup_disabled':
    case 'email_provider_disabled':
      return { motivo: 'cadastro-fechado', campo: null, texto: 'O cadastro está fechado no momento.' };

    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return { motivo: 'limite-tentativas', campo: null, texto: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.' };

    default:
      break;
  }

  // Sem código conhecido, o status ainda separa o que o usuário pode resolver do que não pode.
  if (erro.status === 429) {
    return { motivo: 'limite-tentativas', campo: null, texto: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.' };
  }
  if (typeof erro.status === 'number' && erro.status >= 500) {
    return { motivo: 'servidor', campo: null, texto: 'Algo falhou do nosso lado. Tente de novo em instantes.' };
  }
  return { motivo: 'desconhecido', campo: null, texto: 'Não foi possível criar a conta. Tente de novo em instantes.' };
}
