/**
 * 🔴 A CLASSIFICAÇÃO HISTÓRICA NÃO PODE VIRAR FILTRO MORTO (2026-09-17, 2ª volta).
 *
 * 🔑 O defeito que este arquivo fecha, medido nesta rodada: a contagem de testes PULADOS caiu
 * de 24 para 23 sem que ninguém tivesse decidido nada. A causa: `deload-volume-entregue.test.ts`
 * teve a sua fotografia REESCRITA e RENOMEADA em `d93028b` — de
 * *"…(96 → 93 na S5; a S6 fica em 48)"* para *"…(S5 86 · S6 ~45% menos, mesma estrutura)"* —
 * e o `testNamePattern` de `vitest.config.ts`, que casa pelo nome COMPLETO, passou a excluir
 * um nome que não existe mais. A exclusão continuou no JSON, sem excluir nada.
 *
 * ⚠️ O repositório JÁ SABIA do risco: `regressao-cinco-casos.test.ts` traz, em cima de um
 * `it`, o comentário *"O NOME DESTE TESTE É CONTRATO … Renomeá-lo tira o teste da exclusão"*.
 * Saber não bastou — um comentário não falha em CI. Este teste falha.
 *
 * 🔒 O que ele cobra: **todo nome histórico declarado corresponde a um teste que existe**.
 * Ele lê a fonte do arquivo classificado e casa o nome contra `describe` + `it`/`test`,
 * inclusive os gerados por `it.each` com marcadores (`$nome`), pelos pedaços ESTÁTICOS do
 * título, em ordem e ancorados nas pontas.
 *
 * PURO: lê arquivos do repositório e não executa nada do motor.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import classificacao from '../../test-support/selecao-etapa1-classificacao.json';

const raiz = (...p: string[]) => join(process.cwd(), ...p);

/**
 * Literais de string de uma chamada `nome(` — cobre aspas simples, duplas e crase, e as DUAS
 * formas: a direta (`it('…')`) e a currificada de `each` (`it.each(DADOS)('…')`), que é
 * justamente a que gera nome por interpolação.
 */
function literais(src: string, chamada: RegExp): string[] {
  const aspas = String.raw`(['"\`])((?:\\.|(?!\2)[\s\S])*?)\2`;
  const direta = new RegExp(`(${chamada.source})\\s*\\(\\s*${aspas}`, 'g');
  const curried = new RegExp(`(${chamada.source})\\s*\\([\\s\\S]*?\\)\\s*\\(\\s*${aspas}`, 'g');
  return [...src.matchAll(direta), ...src.matchAll(curried)].map((m) => m[3]!);
}

/**
 * O título casa o restante do nome? Um título sem marcador tem de ser IGUAL; um título de
 * `it.each` (`$nome — reproduzido…`) casa pelos pedaços estáticos, em ordem, com as pontas
 * ancoradas onde o título não começa/termina em marcador.
 */
function casaTitulo(titulo: string, resto: string): boolean {
  const partes = titulo.split(/\$[A-Za-z_$][\w$]*|%[sdifjo#%]/g);
  if (partes.length === 1) return titulo === resto;
  let i = 0;
  for (const [k, parte] of partes.entries()) {
    if (parte === '') continue;
    const achou = k === 0 ? (resto.startsWith(parte) ? 0 : -1) : resto.indexOf(parte, i);
    if (achou < 0) return false;
    i = achou + parte.length;
  }
  const ultima = partes[partes.length - 1]!;
  return ultima === '' || resto.endsWith(ultima);
}

describe('🔒 a classificação histórica casa com testes que existem', () => {
  it('anti-vacuidade: há nomes históricos declarados para conferir', () => {
    const total = classificacao.arquivos.reduce((n, a) => n + a.historicos.length, 0);
    expect(total, 'nenhum nome histórico — este arquivo não prova nada').toBeGreaterThan(0);
  });

  it('todo nome histórico declarado corresponde a um teste do arquivo (renomear DERRUBA aqui)', () => {
    const orfaos: string[] = [];
    for (const { arquivo, historicos } of classificacao.arquivos) {
      if (historicos.length === 0) continue;
      const src = readFileSync(raiz(arquivo), 'utf8');
      const suites = literais(src, /\bdescribe(?:\.\w+)?/);
      const titulos = [...literais(src, /\bit(?:\.\w+)?/), ...literais(src, /\btest(?:\.\w+)?/)];
      for (const { nome } of historicos) {
        const ok = suites.some((d) => nome.startsWith(d + ' ')
          && titulos.some((t) => casaTitulo(t, nome.slice(d.length + 1))))
          || titulos.some((t) => casaTitulo(t, nome));
        if (!ok) orfaos.push(`${arquivo} :: ${nome}`);
      }
    }
    expect(orfaos, 'nome histórico sem teste correspondente — a exclusão virou filtro morto').toEqual([]);
  });

  it('cada arquivo classificado existe e é um arquivo de teste', () => {
    for (const { arquivo } of classificacao.arquivos) {
      expect(() => readFileSync(raiz(arquivo), 'utf8'), arquivo).not.toThrow();
      expect(arquivo, `${arquivo} não é um arquivo de teste`).toMatch(/\.(test|spec)\.tsx?$/);
    }
  });

  /**
   * 🔒 O NÚMERO, preso. Cada nome histórico vira exatamente um teste PULADO no projeto
   * `atual:<arquivo>`. Um a mais ou a
   * menos sem decisão derruba este teste em vez de aparecer só no rodapé.
   */
  it('as 19 exclusões históricas remanescentes estão contabilizadas', () => {
    const total = classificacao.arquivos.reduce((n, a) => n + a.historicos.length, 0);
    // 20/09: duas fotografias substituídas antes, monotonicidade revogada e
    // quota de slots substituída por cobertura não deixam filtros órfãos.
    expect(total).toBe(19);
  });
});
