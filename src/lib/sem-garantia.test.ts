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
 *  · `/changelog` — 🔒 **EXCEÇÃO PERMANENTE (DF 2026-08-01), não "até consertar".** A entrada
 *    de 02/jul anuncia a garantia e **fica**: changelog é **registro datado do que aconteceu**,
 *    e apagá-la falsificaria a história na direção oposta. Ela vai casar o léxico **para
 *    sempre**, por construção — um log do passado sempre citará capacidades que já não valem.
 *    🔑 Por isso a isenção não é em branco: o changelog troca o critério ① por um **próprio e
 *    mais forte** (bloco §changelog abaixo) — *capacidade anunciada e depois removida precisa
 *    da entrada que a retrata*. A promessa não é apagada; é **respondida**.
 */
const FORA_DO_CRITERIO = ['src/app/termos/page.tsx', 'src/app/changelog/page.tsx', 'src/app/reembolso/page.tsx'];

/**
 * 🔒 A TERCEIRA EXCEÇÃO — `/reembolso`, DF do autor de 2026-08-11 (desfaz a de 2026-08-01).
 *
 * ⚠️ O comentário acima diz que lista de exceção que cresce é guard morrendo devagar, e ele
 * está certo. Por isso esta entrada NÃO é uma isenção: é uma TROCA. O léxico genérico não
 * consegue distinguir *"a página que promete estorno"* de *"a página chamada Reembolso que
 * nega haver cobrança"* — medido: os matches eram o nome do componente (`function
 * Reembolso()`), o `title` da metadata, a chave `page="reembolso"` e o `titulo`. Nenhum é
 * promessa; todos são estrutura.
 *
 * Em troca da saída do léxico genérico, a página entra no bloco DEDICADO logo abaixo, que é
 * MAIS ESTRITO que o léxico: proíbe nominalmente a copy antiga (a que o cofre marca como
 * "não usar") e exige que os números legais estejam em placeholder visível. Isenção que só
 * tira é buraco; isenção que troca por régua mais dura é escopo.
 */

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
    expect(rotaExisteTeste('/rota-que-nunca-existiu')).toBe(false);
  });

  /**
   * 🔒 REMOVIDO EM 2026-08-11, pela DF do autor que devolve `/reembolso` ao ar.
   *
   * Saíram daqui DUAS asserções, e as duas eram ancoradas no NOME da rota — não no critério:
   *   · `expect(rotaExisteTeste('/reembolso')).toBe(false)` — "a rota removida ainda está em
   *     disco". A rota voltou por decisão; afirmar que ela não existe passou a ser falso.
   *   · o bloco *"a casca institucional não oferece mais a rota removida — nem no tipo"*, que
   *     exigia `PageKey` sem `'reembolso'` e nenhum `href: '/reembolso'`. A casca voltou a
   *     oferecê-la, também por decisão.
   *
   * ⚠️ O que NÃO saiu, e é a maior parte deste arquivo: o léxico de promessa (①) e a varredura
   * de link órfão (②) continuam valendo para todas as telas. A documentação do topo dizia que
   * o guard era "ancorado no CRITÉRIO, não no caminho `/reembolso`" — era verdade para ① e ②,
   * e falso para estas duas. Ficam registradas aqui em vez de sumirem do diff.
   */
});

/**
 * 🔒 As exceções são EXCEÇÕES, não buracos: este bloco prova que o critério as alcança.
 * Sem ele, alguém poderia esvaziar a lista de padrões e as duas continuariam "isentas" —
 * isenção que não é testada vira o lugar onde o defeito mora.
 */
describe('🔒 as exceções declaradas seriam REPROVADAS pelo critério', () => {
  it('o changelog casa o léxico — a isenção é real, não decorativa', () => {
    const src = semComentarios(readFileSync(join(process.cwd(), 'src/app/changelog/page.tsx'), 'utf8'));
    // 🔒 Isto NÃO é "pendência a consertar": é a prova de que a exceção existe por necessidade.
    // Se um dia parar de casar, a exceção virou decoração e deve sair da lista.
    expect(/garantia de \d+ dias?/i.test(src), 'o changelog não casa mais o léxico — a exceção virou decoração').toBe(true);
  });

  it('a lista de exceções é exatamente esta — e cada uma tem seu par', () => {
    expect(FORA_DO_CRITERIO).toEqual([
      'src/app/termos/page.tsx',      // pauta jurídica única
      'src/app/changelog/page.tsx',   // par: §changelog, a retratação datada
      'src/app/reembolso/page.tsx',   // par: §reembolso, o bloco dedicado (DF 2026-08-11)
    ]);
  });
});

/**
 * 🔒 §reembolso — A RÉGUA QUE SUBSTITUI O ① NA PÁGINA QUE VOLTOU (DF 2026-08-11).
 *
 * 🔑 Por que a página sai do léxico genérico: medido, os matches eram ESTRUTURA, não promessa
 * — `function Reembolso()`, `title: 'Reembolso · Evokorpus'`, `page="reembolso"`,
 * `titulo="Reembolso"`. Um léxico que proíbe a palavra proíbe a página de ter nome.
 *
 * ⚠️ Este é o par que sustenta a exceção, e ele é MAIS ESTRITO que o léxico: proíbe
 * nominalmente a copy que o cofre marca como "não usar", exige a negação da cobrança e exige
 * que todo número legal esteja em placeholder visível. Sem ele, `FORA_DO_CRITERIO` viraria
 * isenção em branco — e isenção em branco é onde o defeito volta a morar.
 */
describe('🔒 reembolso — a página existe, e diz que hoje não há cobrança', () => {
  const src = () => semComentarios(readFileSync(join(APP, 'reembolso/page.tsx'), 'utf8'));

  it('afirma, sem rodeio, que não há cobrança hoje', () => {
    const s = src();
    expect(s, 'a página não nega a cobrança — sem isso ela volta a ser promessa órfã')
      .toMatch(/n[ãa]o cobra nada|n[ãa]o h[áa] cobran[çc]a/i);
    expect(s, 'não diz que não há o que reembolsar').toMatch(/n[ãa]o h[áa] reembolso a pedir|n[ãa]o h[áa] pagamento/i);
  });

  /** 🔴 A copy de 01/08, nominalmente proibida. É o texto que o cofre marca como "não usar". */
  it('a copy retirada em 2026-08-01 NÃO voltou', () => {
    const s = src();
    const PROIBIDO: readonly [RegExp, string][] = [
      [/garantia de \d+ dias?/i, 'título "Garantia de N dias"'],
      [/devolvemos o dinheiro|dinheiro de volta/i, 'promessa de devolução'],
      [/pe[çc]a o reembolso|pedir o reembolso/i, 'passo "Peça o reembolso"'],
      [/assinatura\s*(→|->|&rarr;)\s*reembolso/i, 'caminho "Assinatura → Reembolso"'],
      [/estorno em at[ée]|em at[ée] \d+ dias? [úu]te/i, 'prazo de estorno prometido'],
      [/mesmo meio de pagamento/i, 'devolução pelo meio de pagamento'],
      [/sem perguntas|sem multa/i, 'promessa de cancelamento sem atrito'],
    ];
    for (const [re, oque] of PROIBIDO) expect(re.test(s), `a copy de 01/08 voltou: ${oque}`).toBe(false);
  });

  /**
   * 🔑 Números legais só entram como placeholder VISÍVEL. O handoff é explícito: prazo,
   * percentual e condições são peça jurídica — não se inventa número. Um dígito solto numa
   * frase de prazo é promessa, mesmo sem querer.
   */
  it('nenhum prazo ou percentual literal — só `AValidar`', () => {
    const s = src();
    expect(s, 'a página não usa placeholder visível para o que falta').toMatch(/<AValidar>/);
    const corpo = s.slice(s.indexOf('<LegalLayout'));
    expect(corpo, 'prazo em dias literal na página').not.toMatch(/\b\d+\s*dias?\b/i);
    expect(corpo, 'percentual literal na página').not.toMatch(/\d+\s*%/);
    expect(corpo, 'valor em dinheiro na página').not.toMatch(/R\$/);
  });

  it('e a rota está de fato em disco, alcançável pela casca', () => {
    expect(existsSync(join(APP, 'reembolso/page.tsx')), 'a rota não existe').toBe(true);
    const shell = semComentarios(readFileSync(join(process.cwd(), 'src/components/legal/InstitucionalShell.tsx'), 'utf8'));
    expect(shell, 'a chave não voltou ao PageKey').toMatch(/'reembolso'/);
  });
});

/**
 * 🔒 A CASCA INSTITUCIONAL OFERECE AS ROTAS QUE EXISTEM (DF 2026-08-11).
 *
 * 🔑 O inverso da varredura de 01/08, e a mesma família de erro: aquela procurava quem ainda
 * linkava para uma página morta; esta procura quem DEVERIA linkar para uma página viva e não
 * linka. Foi assim que `/faq` e `/changelog` ficaram fora do cabeçalho por mais de um mês —
 * entraram como rota na V6.1 e a navegação nunca foi atualizada.
 *
 * O critério não é a lista de hoje: é que toda rota institucional em disco esteja no NAV. Rota
 * nova sem entrada no cabeçalho derruba isto — que é exatamente o que faltou em 02/07.
 */
describe('🔒 toda rota institucional aparece no cabeçalho', () => {
  const shell = () => semComentarios(readFileSync(join(process.cwd(), 'src/components/legal/InstitucionalShell.tsx'), 'utf8'));
  /** As institucionais: páginas de conteúdo público, fora do funil e fora do app logado. */
  const INSTITUCIONAIS = ['termos', 'privacidade', 'aviso', 'faq', 'reembolso', 'suporte', 'changelog'];

  it('as institucionais existem em disco', () => {
    const faltando = INSTITUCIONAIS.filter((r) => !existsSync(join(APP, r, 'page.tsx')));
    expect(faltando, `rota(s) na lista que não existem: ${faltando.join(', ')}`).toEqual([]);
  });

  it('🔴 cada uma tem entrada no NAV — não só no rodapé', () => {
    const s = shell();
    const nav = s.slice(s.indexOf('const NAV'), s.indexOf('const FOOTER'));
    const fora = INSTITUCIONAIS.filter((r) => !nav.includes(`href: '/${r}'`));
    expect(fora, `no disco mas fora do cabeçalho: ${fora.join(', ')}`).toEqual([]);
  });

  it('anti-vacuidade: o detector reprovaria uma rota ausente do NAV', () => {
    const s = shell();
    const nav = s.slice(s.indexOf('const NAV'), s.indexOf('const FOOTER'));
    expect(nav.includes("href: '/rota-que-nunca-existiu'")).toBe(false);
    expect(nav.includes("href: '/termos'")).toBe(true);
  });
});

/**
 * 🔒 §changelog — O CRITÉRIO QUE SUBSTITUI O ① NO LOG DATADO (DF 2026-08-01).
 *
 * 🔑 O changelog não pode ser cobrado por "não prometer": ele **registra o que foi
 * anunciado**, e um log do passado sempre citará capacidades que já não valem. Cobrá-lo pelo
 * ① só levaria a apagar história. O que se exige dele é mais forte e é o que fecha o buraco:
 * **capacidade anunciada e depois removida precisa da entrada que a retrata.** A promessa
 * não some do registro — ela ganha resposta, com data.
 *
 * ⚠️ Este é o par que sustenta a exceção. Sem ele, `FORA_DO_CRITERIO` seria isenção em
 * branco — e isenção em branco é onde o defeito volta a morar.
 */
describe('🔒 changelog — toda capacidade retirada tem a entrada que a retrata', () => {
  const src = () => semComentarios(readFileSync(join(process.cwd(), 'src/app/changelog/page.tsx'), 'utf8'));

  it('se o log anuncia a garantia, ele TAMBÉM anuncia que ela saiu', () => {
    const s = src();
    const anuncia = /titulo: 'Garantia de \d+ dias e reembolso'/.test(s);
    if (!anuncia) return; // entrada removida por outra decisão → nada a exigir
    expect(s, 'a garantia foi anunciada e nunca retratada — promessa órfã no log').toMatch(
      /titulo: 'A página de garantia saiu'/,
    );
  });

  it('a retratação é posterior ao anúncio — retratar antes não retrata nada', () => {
    const s = src();
    // ⚠️ ARMADILHA DO -1, que deixou uma mutação passar na 1ª escrita: `indexOf` devolve -1
    // quando não acha, e -1 satisfaz QUALQUER `toBeLessThan`. A prova de ordem entre duas
    // coisas ausentes passava sozinha. Existência primeiro, ordem depois — sempre.
    const pos = (agulha: string): number => {
      const i = s.indexOf(agulha);
      expect(i, `não encontrado no changelog: ${agulha}`).toBeGreaterThan(-1);
      return i;
    };
    // O log vai do mais novo para o mais antigo: vir ANTES no arquivo é vir DEPOIS no tempo.
    expect(pos("titulo: 'A página de garantia saiu'")).toBeLessThan(pos("titulo: 'Garantia de 7 dias e reembolso'"));
    expect(pos("mes: 'Agosto 2026'")).toBeLessThan(pos("mes: 'Julho 2026'"));
  });

  it('a retratação diz por que saiu — entrada que só avisa a remoção não fecha a promessa', () => {
    const s = src();
    const i = s.indexOf("titulo: 'A página de garantia saiu'");
    const entrada = s.slice(i, s.indexOf('},', i));
    expect(entrada).toMatch(/n[ãa]o existe compra/i);
    expect(entrada).toMatch(/n[ãa]o h[áa] assinatura nem checkout/i);
    expect(entrada, 'a tag do vermelho é para erro/segurança').toMatch(/tag: 'Melhoria'/);
  });
});
