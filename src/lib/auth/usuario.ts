/**
 * Identidade exibível do usuário logado. A inicial do avatar deriva do NOME real
 * (`user_metadata.nome`, gravado no signUp) com fallback para o e-mail — nunca um
 * placeholder fixo (bug do "V" hardcoded, teste ao vivo 2026-07-06). Puro/testável.
 */
export function inicialDe(nome?: string | null, email?: string | null): string {
  const n = nome?.trim();
  if (n) return n[0]!.toUpperCase();
  const e = email?.trim();
  if (e) return e[0]!.toUpperCase();
  return ''; // sem dado — o componente decide o placeholder (só no modo mock)
}
