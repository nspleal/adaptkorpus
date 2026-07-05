/**
 * Anti open-redirect (§2.C da blindagem 2026-07-05): o parâmetro `next` de um fluxo de auth
 * (`/auth/callback?next=…`, redirects do gating) só pode ser um **caminho relativo interno**.
 * Qualquer coisa com esquema, host, barra dupla (protocol-relative) ou controle → fallback.
 * Puro/determinístico — testável direto.
 */
export function caminhoRelativoSeguro(next: string | null | undefined, fallback = '/app'): string {
  if (!next || typeof next !== 'string') return fallback;
  if (!next.startsWith('/')) return fallback; // precisa ser caminho absoluto interno
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback; // //evil.com  /\evil.com
  if (next.includes('://') || next.includes('\\')) return fallback; // esquema / backslash
  for (let i = 0; i < next.length; i++) {
    const c = next.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return fallback; // caractere de controle / quebra de linha
  }
  return next;
}
