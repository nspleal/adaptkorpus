import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 🔒 NENHUMA TELA DE PRODUTO PROMETE DINHEIRO DE VOLTA (DF 2026-08-01,
 * `operacao-legal-suporte-reembolso` §Páginas institucionais).
 *
 * 🔴 O defeito removido: `/reembolso` descrevia, passo a passo, uma operação que não existe —
 * *"Peça o reembolso (Assinatura → Reembolso)"* · *"Estorno em até 2 dias úteis"* · *"o valor
 * volta pelo mesmo meio de pagamento usado na compra"*. **Não há assinatura, checkout nem
 * meio de pagamento. Página de reembolso sem venda é só superfície de risco.** O texto
 * público está preservado no cofre e volta com o lançamento pago.
 *
 * 🔑 **O guard é ancorado no CRITÉRIO, não no caminho `/reembolso`** — a rota pode voltar com
 * outro nome e o defeito volta junto. O critério é o do aceite: *se o texto afirma que o
 * usuário recebe dinheiro de volta, sai.* Duas afirmações independentes:
 *   ① nenhuma tela **promete** devolução/estorno/garantia de dinheiro;
 *   ② nenhuma tela **linka** para uma rota que não existe (promessa órfã é pior que a página:
 *      o link some da vista e a frase que o vendia continua).
 *
 * ⚠️ Fora do escopo por decisão declarada (ver `FORA_DO_CRITERIO` abaixo, com a razão de
 * cada uma) e a rota de webhook da Kiwify — backend de um checkout que não está ligado, não
 * é tela. Todas listadas no relatório do lote.
 */

const APP = join(process.cwd(), 'src/app');

/** Toda tela de produto: `page.tsx` sob `src/app`, menos as rotas de API. */
function telas(dir = APP, fora: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome !== 'api') telas(caminho, fora);
    } else if (nome === 'page.tsx') {
      fora.push(caminho);
    }
  }
  return fora;
}

const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
const rel = (p: string) => p.slice(process.cwd().length + 1);

/**
 * ⚠️ EXCEÇÕES NOMEADAS — as duas estão FORA por decisão declarada, não por o guard não as
 * alcançar (ele alcança: sem esta lista, as duas falham). 🔴 **Lista de exceção que cresce é
 * guard morrendo devagar** — se aparecer uma terceira, o critério é que está errado.
 *
 *  · `/termos` — documento legal, pauta jurídica única. Mexer sem advogado troca um texto
 *    errado por outro (instrução explícita do lote).
 *  · `/changelog` — 🟡 **PENDÊNCIA REPORTADA, não resolvida.** A entrada de 02/jul anuncia
 *    *"Garantia de 7 dias e reembolso — nova página explicando a garantia"*: com a rota fora
 *    do ar, ela é **promessa órfã**, exatamente o que a armadilha ① do lote nomeia. Mas
 *    changelog é **registro datado do que aconteceu**, e apagar a entrada falsifica a
 *    história na direção oposta. O conserto provável é uma entrada NOVA dizendo que a página
 *    saiu — e essa copy é do autor. Enquanto não vier, a promessa continua viva aqui.
 */
const FORA_DO_CRITERIO = ['src/app/termos/page.tsx', 'src/app/changelog/page.tsx'];

describe('🔒 ① nenhuma tela de produto promete devolução de dinheiro', () => {
  /**
   * O léxico é da PROMESSA, não da palavra: "reembolso" numa nota de rodapé do cofre não
   * promete nada; "devolvemos o dinheiro" promete. Cada padrão descreve um ato de devolver
   * valor ao usuário.
   */
  const PROMESSAS: readonly [RegExp, string][] = [
    [/devolvemos o dinheiro|dinheiro de volta|seu dinheiro de volta/i, 'promessa de devolução'],
    [/garantia de \d+ dias?/i, 'garantia com prazo'],
    [/estorno/i, 'estorno'],
    [/pe[çc]a o reembolso|pedir o reembolso|pedido de reembolso/i, 'fluxo de reembolso'],
    [/reembols(o|ar|amos)\b(?![^.]{0,40}n[ãa]o (h[áa]|existe))/i, 'reembolso como operação'],
  ];

  const alvos = telas().filter((p) => !FORA_DO_CRITERIO.includes(rel(p)));

  it('a varredura enxerga o app inteiro (anti-vacuidade)', () => {
    expect(alvos.length, 'quase nenhuma tela varrida — o coletor quebrou').toBeGreaterThanOrEqual(10);
    expect(alvos.some((p) => rel(p) === 'src/app/page.tsx')).toBe(true);
    expect(alvos.some((p) => rel(p) === 'src/app/faq/page.tsx')).toBe(true);
  });

  it.each(PROMESSAS)('nenhuma tela contém %s (%s)', (re) => {
    const culpadas = alvos.filter((p) => re.test(semComentarios(readFileSync(p, 'utf8')))).map(rel);
    expect(culpadas, `telas que ainda prometem: ${culpadas.join(', ')}`).toEqual([]);
  });

  it('anti-vacuidade do léxico: ele pega o texto que saiu do ar', () => {
    const antigo = 'Nossa garantia é simples: se você não gostou, devolvemos o dinheiro — sem perguntas.';
    expect(PROMESSAS.some(([re]) => re.test(antigo)), 'o léxico ficou cego para a própria página removida').toBe(true);
    // …e não pega a negação que as telas DEVEM poder dizer.
    const permitido = 'Não há o que reembolsar: não há cobrança no beta.';
    expect(PROMESSAS.some(([re]) => re.test(permitido)), 'o léxico proíbe negar a cobrança').toBe(false);
  });
});

describe('🔒 ② nenhuma tela linka para rota que não existe', () => {
  /**
   * 🔑 O critério que sobrevive à rota voltar com outro nome: em vez de procurar
   * `/reembolso`, extrai-se TODO href interno das telas e confere-se se a rota existe em
   * disco. Link órfão é o defeito, qualquer que seja o nome.
   */
  const rotaExiste = (href: string): boolean => {
    const limpa = href.split(/[?#]/)[0]!.replace(/\/$/, '');
    if (limpa === '' || limpa === '/') return true;
    const base = join(APP, limpa);
    return existsSync(join(base, 'page.tsx')) || existsSync(join(base, 'route.ts')) || existsSync(`${base}.tsx`);
  };

  it('todo href interno aponta para uma rota que existe', () => {
    const quebrados: string[] = [];
    for (const tela of telas()) {
      const src = semComentarios(readFileSync(tela, 'utf8'));
      for (const m of src.matchAll(/(?:href|push\()\s*=?\s*["'`](\/[^"'`\s]*)["'`]/g)) {
        const href = m[1]!;
        if (href.startsWith('/api/')) continue;
        if (!rotaExiste(href)) quebrados.push(`${rel(tela)} → ${href}`);
      }
    }
    expect(quebrados, `links para rotas inexistentes: ${quebrados.join(' · ')}`).toEqual([]);
  });

  it('anti-vacuidade: o detector reprova um href inventado e aprova um real', () => {
    const rotaExisteTeste = (h: string) => existsSync(join(APP, h, 'page.tsx'));
    expect(rotaExisteTeste('/faq')).toBe(true);
    expect(rotaExisteTeste('/reembolso'), 'a rota removida ainda está em disco').toBe(false);
    expect(rotaExisteTeste('/rota-que-nunca-existiu')).toBe(false);
  });

  it('🔴 a casca institucional não oferece mais a rota removida — nem no tipo', () => {
    const shell = semComentarios(readFileSync(join(process.cwd(), 'src/components/legal/InstitucionalShell.tsx'), 'utf8'));
    // O tipo é a porta: tirar só o item do array deixaria a chave viva e a próxima linha
    // que a usasse compilaria.
    expect(shell, 'a chave voltou ao PageKey').not.toMatch(/'reembolso'/);
    expect(shell).not.toMatch(/href: '\/reembolso'/);
  });
});

/**
 * 🔒 As exceções são EXCEÇÕES, não buracos: este bloco prova que o critério as alcança.
 * Sem ele, alguém poderia esvaziar a lista de padrões e as duas continuariam "isentas" —
 * isenção que não é testada vira o lugar onde o defeito mora.
 */
describe('🔒 as exceções declaradas seriam REPROVADAS pelo critério', () => {
  it('o changelog ainda contém a promessa — é pendência aberta, não isenção silenciosa', () => {
    const src = semComentarios(readFileSync(join(process.cwd(), 'src/app/changelog/page.tsx'), 'utf8'));
    expect(/garantia de \d+ dias?/i.test(src), 'o changelog foi consertado — tire-o de FORA_DO_CRITERIO').toBe(true);
  });

  it('a lista de exceções não cresceu', () => {
    expect(FORA_DO_CRITERIO).toEqual(['src/app/termos/page.tsx', 'src/app/changelog/page.tsx']);
  });
});
