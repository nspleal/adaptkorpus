/**
 * POLÍTICA DE SENHA — espelho honesto do que o SERVIDOR exige, nunca substituto dele.
 *
 * 🔴 O defeito que este módulo fecha (beta, 11/09/2026 18:07:36 BRT): a tela de cadastro
 * media "força" de senha e liberava o envio com `senha.length >= 8`. O Supabase respondeu
 * `POST /signup` → **422 `weak_password`** e a tela disse apenas *"Não foi possível criar a
 * conta. Confira os dados e tente de novo."* — enquanto o medidor classificava a mesma senha
 * como **"Razoável"**. O beta tester não tinha como saber que faltava um NÚMERO.
 *
 * 🔒 Os valores abaixo NÃO são chute: vieram da própria resposta do servidor
 * (`kvoqiwlvpbuaereasmvc`, leitura de 11/09/2026, requisição 422 deliberada e sem criação de
 * conta), que devolve em `weak_password.reasons` e na mensagem:
 *
 *   "Password should be at least 8 characters. Password should contain at least one
 *    character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789."
 *
 * ⚠️ **Não existe exigência de SÍMBOLO.** Anunciar uma seria mentir para o usuário e empurrar
 * senha pior (ele troca uma senha válida por outra achando que o símbolo é obrigatório).
 *
 * 🔑 REGRA DE OURO: isto é uma PRÉ-VALIDAÇÃO para poder EXPLICAR antes do envio. A autoridade
 * continua sendo o backend — ele ainda checa coisas que o browser não tem como checar (ex.:
 * a razão `pwned`, vazamentos conhecidos). Por isso a tela precisa tratar a recusa do servidor
 * mesmo quando tudo aqui passou (ver `erro-auth.ts`).
 */

/** As exigências que o servidor aplica hoje, uma por eixo verificável. */
export type RequisitoSenha = 'tamanho' | 'minuscula' | 'maiuscula' | 'numero';

/**
 * Mínimo de caracteres exigido pelo servidor.
 *
 * 📏 Comparação por `length` (unidades UTF-16) contra um mínimo que o servidor conta em BYTES
 * (Go: `len(string)`). Bytes UTF-8 ≥ unidades UTF-16 para todo code point, então esta checagem
 * só erra para o lado SEGURO: o que passa aqui passa lá. O inverso — aceitar aqui e apanhar
 * lá — é justamente o defeito que estamos fechando.
 */
export const MINIMO_SENHA = 8;

type Regra = {
  id: RequisitoSenha;
  /** Texto da lista ao lado do campo (o usuário lê ANTES de digitar). */
  rotulo: string;
  /** Forma curta, para a frase "ainda falta …". */
  curto: string;
  cumpre: (senha: string) => boolean;
};

/**
 * ⚠️ As classes são ASCII ESTRITAS, de propósito: o servidor usa `strings.ContainsAny` sobre
 * `abcdefghijklmnopqrstuvwxyz` / `ABCDEFGHIJKLMNOPQRSTUVWXYZ` / `0123456789`. "Á" NÃO conta
 * como maiúscula lá — e não pode contar aqui, senão a tela volta a aprovar o que o servidor
 * recusa.
 */
const REGRAS: readonly Regra[] = [
  { id: 'tamanho', rotulo: `Pelo menos ${MINIMO_SENHA} caracteres`, curto: `${MINIMO_SENHA} caracteres`, cumpre: (s) => s.length >= MINIMO_SENHA },
  { id: 'minuscula', rotulo: 'Uma letra minúscula (a-z)', curto: 'uma letra minúscula', cumpre: (s) => /[a-z]/.test(s) },
  { id: 'maiuscula', rotulo: 'Uma letra maiúscula (A-Z)', curto: 'uma letra maiúscula', cumpre: (s) => /[A-Z]/.test(s) },
  { id: 'numero', rotulo: 'Um número (0-9)', curto: 'um número', cumpre: (s) => /[0-9]/.test(s) },
];

export type EstadoRequisito = { id: RequisitoSenha; rotulo: string; ok: boolean };

/** Estado de cada requisito para a senha dada — a lista que a tela renderiza. */
export function requisitosDaSenha(senha: string): EstadoRequisito[] {
  return REGRAS.map((r) => ({ id: r.id, rotulo: r.rotulo, ok: r.cumpre(senha) }));
}

/** Só os que faltam, na ordem em que aparecem na tela. */
export function requisitosFaltantes(senha: string): RequisitoSenha[] {
  return REGRAS.filter((r) => !r.cumpre(senha)).map((r) => r.id);
}

/**
 * A senha cumpre TUDO que sabemos que o servidor exige.
 *
 * 🔒 É este o predicado que libera o botão — nunca `forcaSenha`, que é ESTIMATIVA e foi
 * exatamente o que fez a tela sugerir aceitação ("Razoável") para uma senha recusada.
 */
export function senhaCumprePolitica(senha: string): boolean {
  return REGRAS.every((r) => r.cumpre(senha));
}

/** "a", "a e b", "a, b e c" — enumeração em português, sem vírgula antes do "e". */
export function listarEmPortugues(itens: readonly string[]): string {
  if (itens.length === 0) return '';
  if (itens.length === 1) return itens[0]!;
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]!}`;
}

/** "uma letra maiúscula e um número" — o miolo da frase que explica o que falta. */
export function fraseDosFaltantes(ids: readonly RequisitoSenha[]): string {
  const curtos = REGRAS.filter((r) => ids.includes(r.id)).map((r) => r.curto);
  return listarEmPortugues(curtos);
}

/** A política inteira em uma frase — usada quando o servidor recusa sem dizer o que faltou. */
export function frasePoliticaCompleta(): string {
  return listarEmPortugues(REGRAS.map((r) => r.curto));
}
