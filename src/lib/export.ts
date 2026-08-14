/**
 * Utilidades de exportação client-side (direito LGPD "baixar meus dados", stopgap).
 * Gera um arquivo a partir de texto e dispara o download no browser. Sem rede:
 * a exportação completa (perfil + plano + logs do servidor) é a tarefa Ownership-4.
 */

export function baixarArquivo(nome: string, conteudo: string, mime = 'application/json'): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([conteudo], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

