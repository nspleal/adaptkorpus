/** Utilitários de recorte usados pelos guards estáticos do modo diário. */

/** Só o código: os JSDoc destes arquivos citam as formas proibidas para explicar por que saíram. */
function podar(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/** Índice do `}` que fecha a chave aberta em `i`. -1 se não fechar. */
function fechaChave(s: string, i: number): number {
  let n = 0;
  for (let j = i; j < s.length; j += 1) {
    if (s[j] === '{') n += 1;
    else if (s[j] === '}') { n -= 1; if (n === 0) return j; }
  }
  return -1;
}

/**
 * 🔒 O bloco `{!modoDiario && ( … )}` de um arquivo, recortado por CASAMENTO DE CHAVES.
 *
 * ⚠️ Substitui a janela `[\s\S]{0,400}` que estas provas usavam. Ela quebrou quando um
 * bloco novo entrou entre a condição e a âncora — e "quebrou por edição de vizinho" é o
 * defeito do anchor-por-tamanho, não do código. O recorte por chaves não tem esse limite.
 */
export function blocoNaoModoDiario(src: string): string {
  const i = src.indexOf('{!modoDiario && (');
  if (i < 0) return '';
  const fim = fechaChave(src, i);
  return fim < 0 ? '' : src.slice(i, fim + 1);
}

/**
 * 🔑 As CONDIÇÕES de todos os containers JSX `{cond && ( … )}` que **envolvem** `alvo`.
 *
 * ⚠️ Por que isto existe, medido: a prova de que os marcos ALCANÇADOS aparecem nos dois
 * modos era "o `alcancados.map` não está dentro do bloco `{!modoDiario && (`". Uma mutação
 * que escondia o passado por **outra forma** — `{!modoDiario && alcancados.length > 0 && (`
 * — SOBREVIVEU: o literal não casava mais, e o guard ficou cego para exatamente o defeito
 * que ele existe para pegar. Casar forma é frágil; o que vale é **o que a condição faz**.
 * Devolvendo as condições, a prova pode AVALIÁ-LAS com `modoDiario = true`.
 *
 * `cabecalhoNaoReconhecido` marca container cuja forma não é `cond && (` — a prova falha
 * alto em vez de ficar cega de novo (ex.: alguém trocar por `{modoDiario ? null : (…)}`).
 */
export function condicoesQueEnvolvem(src: string, alvo: string): { cond: string; reconhecida: boolean }[] {
  const s = podar(src);
  const alvoIdx = s.indexOf(alvo);
  if (alvoIdx < 0) return [];
  const out: { cond: string; reconhecida: boolean }[] = [];
  for (let i = 0; i < alvoIdx; i += 1) {
    if (s[i] !== '{') continue;
    const fim = fechaChave(s, i);
    if (fim <= alvoIdx) continue; // não envolve o alvo
    const cabeca = s.slice(i + 1, alvoIdx);
    // Forma canônica: `{ <cond> && ( <jsx>`. A condição é UMA EXPRESSÃO — sem `;` e sem
    // chaves —, o que também descarta o `{` do corpo da função (que envolve tudo).
    // O `&&` que importa é o ÚLTIMO antes do JSX, então o não-guloso atravessa os `&&`
    // internos da própria condição.
    const mE = /^([^;{}]*?)&&\s*\(\s*</.exec(cabeca);
    // Ternário — forma NÃO reconhecida: registrada para a prova falhar alto, nunca ficar cega.
    const mT = /^([^;{}?]*?)\?/.exec(cabeca);
    // Só interessam containers que ramificam por MODO; os demais não escondem nada por modo.
    const condE = mE?.[1];
    const condT = mT?.[1];
    if (condE != null && /\bmodoDiario\b/.test(condE)) out.push({ cond: condE.trim(), reconhecida: true });
    else if (condE == null && condT != null && /\bmodoDiario\b/.test(condT)) out.push({ cond: condT.trim(), reconhecida: false });
  }
  return out;
}
