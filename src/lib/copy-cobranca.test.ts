import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NUCLEO_COBRANCA, QUANTO_CUSTA, type SuperficieCobranca } from './copy-cobranca';

/**
 * 🔒 O NÚCLEO DA AFIRMAÇÃO SOBRE DINHEIRO É IDÊNTICO NAS TRÊS SUPERFÍCIES
 * (DF 2026-08-01, `faq-evokorpus` §Assinatura, preço e cancelamento).
 *
 * 🔴 O defeito medido: *"quanto custa?"* tinha **três textos diferentes** em `/faq`, landing
 * e `/suporte`. O conteúdo concordava; a forma divergia — e **três lugares livres derivam
 * sozinhos**, sem que ninguém descubra qual dos três envelheceu.
 *
 * 🔑 A separação travada: **o que não pode variar é a afirmação sobre dinheiro**; o
 * complemento varia porque a superfície varia (marketing × referência × operação).
 */
const SUPERFICIES: Record<SuperficieCobranca, string> = {
  faq: 'src/app/faq/page.tsx',
  landing: 'src/app/page.tsx',
  suporte: 'src/app/suporte/page.tsx',
};

const ler = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

describe('🔒 "quanto custa?" — núcleo travado, complemento livre', () => {
  it('o núcleo bate LITERALMENTE com o texto da DF', () => {
    expect(NUCLEO_COBRANCA).toBe('Nada. O beta é gratuito: não existe cobrança nem assinatura hoje.');
  });

  /**
   * ⚠️ Comparação LITERAL, nunca `contains`: um guard de substring deixa passar uma das três
   * ganhando uma negação ("não existe cobrança nem assinatura hoje**, mas vai existir**"),
   * que é exatamente a deriva que este bloco existe para pegar. Aqui se recorta o prefixo do
   * tamanho do núcleo e se compara caractere a caractere.
   */
  it.each(Object.keys(QUANTO_CUSTA) as SuperficieCobranca[])(
    '%s: a resposta ABRE com o núcleo, idêntico',
    (sup) => {
      const resposta = QUANTO_CUSTA[sup];
      expect(resposta.slice(0, NUCLEO_COBRANCA.length), `o núcleo de "${sup}" divergiu`).toBe(NUCLEO_COBRANCA);
    },
  );

  it('🔑 as três compartilham o MESMO núcleo — comparadas entre si, não só com a constante', () => {
    const nucleos = Object.fromEntries(
      (Object.keys(QUANTO_CUSTA) as SuperficieCobranca[]).map((s) => [s, QUANTO_CUSTA[s].slice(0, NUCLEO_COBRANCA.length)]),
    );
    const distintos = new Set(Object.values(nucleos));
    // A mensagem NOMEIA quem divergiu — "divergiu" sem "qual" não conserta nada.
    expect(distintos.size, `núcleos distintos: ${JSON.stringify(nucleos, null, 1)}`).toBe(1);
  });

  it('os complementos continuam LIVRES — e este guard não os compara', () => {
    const rabos = (Object.keys(QUANTO_CUSTA) as SuperficieCobranca[]).map((s) => QUANTO_CUSTA[s].slice(NUCLEO_COBRANCA.length).trim());
    // ⚠️ A 1ª escrita afirmava `new Set(rabos).size === 3` — e isso É comparar, exatamente o
    // que o aceite proíbe. Duas superfícies escolherem o mesmo complemento é decisão de copy
    // legítima, não defeito; o guard que a reprovasse estaria travando COMPOSIÇÃO, não regra.
    // A única coisa afirmada aqui é que o complemento existe: resposta que é só o núcleo
    // perdeu a adequação de superfície que motivou a separação.
    expect(rabos.every((r) => r.length > 0), 'alguma superfície ficou só com o núcleo').toBe(true);
  });

  /**
   * 🔑 A DERIVA SILENCIOSA que o resto do bloco não pega (mutação M4, sobreviveu na 1ª
   * escrita): trocar `` `${NUCLEO_COBRANCA} …` `` por uma string literal com o MESMO texto.
   * Nada quebra hoje — e a superfície fica livre de novo, porque a próxima edição do núcleo
   * já não a alcança. O que prende é o núcleo aparecer como literal UMA vez só no módulo.
   */
  it('cada superfície DERIVA do núcleo — nenhuma o repete como literal', () => {
    const src = semComentarios(ler('src/lib/copy-cobranca.ts'));
    const ocorrencias = src.split(NUCLEO_COBRANCA).length - 1;
    expect(ocorrencias, 'o núcleo foi repetido como literal — a superfície soltou do módulo').toBe(1);
    for (const sup of Object.keys(QUANTO_CUSTA) as SuperficieCobranca[]) {
      expect(src, `${sup} não interpola o núcleo`).toMatch(new RegExp(`${sup}: \`\\$\\{NUCLEO_COBRANCA\\}`));
    }
  });

  /**
   * 🔑 A prova ESTRUTURAL, sem a qual as de cima são decorativas: o núcleo só é único se as
   * três telas o renderizarem A PARTIR DAQUI. Uma superfície que volte a inlinar a resposta
   * ficaria livre de novo, e nenhum teste sobre a constante notaria — a constante seguiria
   * consistente consigo mesma enquanto a tela mostra outra coisa.
   */
  it.each(Object.entries(SUPERFICIES))('%s renderiza a resposta pelo módulo, não por string solta', (sup, arquivo) => {
    const src = semComentarios(ler(arquivo));
    expect(src, `${arquivo} não importa a copy compartilhada`).toMatch(/from '@\/lib\/copy-cobranca'/);
    expect(src, `${arquivo} não usa QUANTO_CUSTA.${sup}`).toMatch(new RegExp(`QUANTO_CUSTA\\.${sup}\\b`));
    // …e a pergunta não pode ter uma resposta inlinada em paralelo.
    const i = src.indexOf("q: 'Quanto custa?'");
    expect(i, `${arquivo} não responde "Quanto custa?"`).toBeGreaterThan(-1);
    const item = src.slice(i, src.indexOf('}', i));
    expect(item, `${arquivo} voltou a inlinar a resposta`).not.toMatch(/a: ['"`]/);
  });

  it('anti-vacuidade: o critério reprova um núcleo divergente e diz QUEM divergiu', () => {
    const impostor = { ...QUANTO_CUSTA, landing: 'Nada. O beta é gratuito: não existe cobrança nem assinatura ainda. As vagas são por convite.' };
    const divergentes = (Object.keys(impostor) as SuperficieCobranca[])
      .filter((s) => impostor[s].slice(0, NUCLEO_COBRANCA.length) !== NUCLEO_COBRANCA);
    expect(divergentes).toEqual(['landing']);

    // 🔑 LITERAL × `contains`, demonstrado: um núcleo EMPURRADO para o meio do texto passa
    // no substring e é reprovado aqui. É a diferença que o aceite pede.
    const enterrado = `Hoje, no beta: ${NUCLEO_COBRANCA}`;
    expect(enterrado.includes(NUCLEO_COBRANCA), 'substring aceitaria').toBe(true);
    expect(enterrado.slice(0, NUCLEO_COBRANCA.length)).not.toBe(NUCLEO_COBRANCA);

    // ⚠️ Limite DECLARADO deste guard, para ninguém confiar nele além do que ele prova:
    // uma negação acrescentada DEPOIS do núcleo cai no complemento, que é livre por decisão —
    // nem o literal nem o substring a pegam. Quem pega é a varredura de mecanismo do
    // `honestidade-tela.test.ts`. Aqui se trava a IDENTIDADE do núcleo; lá, a VERACIDADE.
    expect(`${NUCLEO_COBRANCA} Mas vai existir em breve.`.slice(0, NUCLEO_COBRANCA.length)).toBe(NUCLEO_COBRANCA);
  });
});

/**
 * 🔒 O TÍTULO QUE ENUNCIAVA O MECANISMO NÃO VOLTA (DF 2026-08-01).
 *
 * 🔑 *"Como funciona o teste grátis de 7 dias?"* **afirma no próprio título**. Responder
 * "não existe" embaixo dele deixa a tela se contradizendo — e a busca do FAQ mostra
 * TÍTULOS. Por isso o conserto é na pergunta, não na resposta.
 */
describe('🔒 nenhuma PERGUNTA enuncia mecanismo que não existe', () => {
  const PUBLICAS = ['src/app/page.tsx', 'src/app/faq/page.tsx', 'src/app/suporte/page.tsx'] as const;

  it.each(PUBLICAS)('%s: o título do teste grátis não existe', (arq) => {
    const src = semComentarios(ler(arq));
    expect(src).not.toMatch(/Como funciona o teste gr[áa]tis/i);
  });

  /**
   * A varredura é da SEÇÃO inteira, não das respostas trocadas: o aceite pede que nenhuma
   * outra afirme mecanismo. Critério = verbo de mecanismo operante sobre cobrança.
   */
  it('nenhuma pergunta da seção de preço do /faq afirma cobrança em operação', () => {
    const src = semComentarios(ler('src/app/faq/page.tsx'));
    const i = src.indexOf("id: 's-cat-assinatura'");
    expect(i, 'seção de preço não encontrada').toBeGreaterThan(-1);
    const secao = src.slice(i, src.indexOf('id: ', src.indexOf('},', src.indexOf('],', i))));
    const perguntas = [...secao.matchAll(/q: '([^']+)'/g)].map((m) => m[1]!);
    expect(perguntas.length).toBeGreaterThanOrEqual(3);
    for (const q of perguntas) {
      expect(q, `pergunta enuncia mecanismo: "${q}"`).not.toMatch(/teste gr[áa]tis|minha assinatura|meu cart[ãa]o|renova[çc][ãa]o/i);
    }
  });
});
