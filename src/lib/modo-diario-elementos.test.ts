import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RECURSOS_SEM_ALVO } from './modo-diario';

/**
 * ASSERÇÃO POR **ELEMENTO** — a rede que faltava (DF 2026-07-29).
 *
 * Por que ela existe: dos sete achados da varredura visual, **o léxico pegaria um**. Um dos
 * cinco vazamentos originais não tinha palavra nenhuma — os pips **são a régua desenhada** —
 * e a armadilha de 2ª ordem (a tela nascer esmaecida) também era visual. `FALA_NO_FUTURO` e
 * `pressupoePrescricao` são textuais, então a forma executável era mais estreita que a regra
 * que ela executa.
 *
 * 🔒 **CRITÉRIO, em uma linha: algum desenho está esperando ser preenchido, ou marcando um
 * nível esperado?**
 *
 * Cinco famílias proibidas em modo diário:
 *   1. barra/anel de progresso (`role="progressbar"`, `<progress>`, `<meter>`);
 *   2. largura/`stroke-dashoffset` derivados de RAZÃO (feito ÷ alvo);
 *   3. marcador, pip, tick ou linha de referência sobre escala;
 *   4. esmaecimento por estar "abaixo" de algo;
 *   5. `%` que não seja de coisa já ocorrida · contagem regressiva.
 *
 * ⚠️ O que este arquivo NÃO cobre está declarado no fim, e é material: ele é estático, e a
 * rede de verdade para desenho é o smoke sobre o DOM renderizado.
 */

const FONTE = (caminho: string): string =>
  readFileSync(caminho, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Telas EXCLUSIVAS do modo diário — copy e desenho 100% nossos, regra absoluta. */
const SO_DO_DIARIO = ['src/components/painel/ModoDiario.tsx'];

describe('nenhum desenho esperando ser preenchido nas telas do modo diário', () => {
  for (const arquivo of SO_DO_DIARIO) {
    const src = FONTE(arquivo);

    it(`${arquivo} — sem barra/anel de progresso semântico`, () => {
      expect(src).not.toMatch(/role=["']progressbar["']/);
      expect(src).not.toMatch(/<progress|<meter/);
      expect(src).not.toMatch(/aria-value(now|min|max)/);
    });

    it(`${arquivo} — sem largura derivada de razão`, () => {
      // `width: \`${x / y * 100}%\`` é a assinatura de "preenchido até aqui".
      expect(src).not.toMatch(/width:\s*`\$\{[^`]*\/[^`]*\}%`/);
      expect(src).not.toMatch(/width:\s*`\$\{[^`]*\bpct\b[^`]*\}`/);
    });

    it(`${arquivo} — sem anel de progresso em SVG (o detector que faltava)`, () => {
      // O anel é o desenho MAIS provável de aparecer numa feature nova, e a varredura de
      // largura não olha SVG: lá o preenchimento é `stroke-dasharray`/`stroke-dashoffset`.
      expect(src).not.toMatch(/strokeDash(array|offset)|stroke-dash(array|offset)/);
      expect(src).not.toMatch(/pathLength/);
    });

    it(`${arquivo} — sem pip/segmento com dois estados`, () => {
      // Pips = irmãos de tamanho fixo, uns acesos e outros apagados, gerados por índice.
      expect(src).not.toMatch(/Array\.from\(\{\s*length:[^}]*\}[^)]*\)[\s\S]{0,220}?i\s*<\s*\w+\s*\?/);
      expect(src).not.toMatch(/\bpip\b/i);
    });

    it(`${arquivo} — sem marcador/tick sobre escala`, () => {
      // Tick = absoluto, estreito e alto, posicionado por percentual sobre um trilho.
      expect(src).not.toMatch(/position:\s*['"]absolute['"][^}]*left:\s*`\$\{[^`]*%`/);
      expect(src).not.toMatch(/ESCALA_MAX|marcador|\bmarca\b/i);
    });

    it(`${arquivo} — sem esmaecimento por estar "abaixo" de algo`, () => {
      // Opacidade/cor decidida por comparação com um alvo.
      expect(src).not.toMatch(/opacity:\s*\w+\s*[><]=?\s*\w+\s*\?/);
      expect(src).not.toMatch(/\bemDia\b|abaixo/i);
    });

    it(`${arquivo} — sem % de coisa não ocorrida e sem contagem regressiva`, () => {
      // `%` só é permitido sobre o que já aconteceu. Em ModoDiario não há nenhum.
      expect(src).not.toMatch(/\}%<|\}%`/);
      expect(src).not.toMatch(/restam|regressiv|countdown/i);
    });
  }
});

/**
 * Nos arquivos COMPARTILHADOS (as duas modalidades no mesmo componente), o desenho existe e
 * é legítimo com plano. A prova é que ele está **atrás do guard** — mesma tabela do guard de
 * texto, agora com as expressões VISUAIS.
 */
describe('recursos `sem_alvo` — o desenho de alvo está atrás do guard', () => {
  const PROVAS_VISUAIS: Record<string, { arquivo: string; provas: RegExp[] }> = {
    frequencia_grupos: {
      arquivo: 'src/components/painel/FrequenciaGrupos.tsx',
      provas: [
        // o cartão de meio de semana (7 segmentos, 4 esperando) só existe com projeção
        /const projecao = parcial && !modoDiario;/,
        /\{projecao && \([\s\S]{0,400}Array\.from\(\{ length: 7 \}/,
        // os 2 pips da régua seguem atrás do `!semReferencia`
        /\{!semReferencia && \(/,
        // o tick sobre a escala só desenha quando existe marca (null em modo diário)
        /\{marca != null && \(/,
        // e o esmaecimento vira NEUTRO, não apagado
        /const forte = semReferencia \|\| emDia;/,
      ],
    },
    registro_cardio: {
      arquivo: 'src/components/painel/Cardio.tsx',
      provas: [
        // BarraMinutos (barra de razão) e BlocosSessoes (blocos tracejados esperando) vivem
        // ambos dentro do ramo `meta != null` — sem meta, nenhum dos dois é montado.
        /\{meta == null \? \(/,
        /meta\.tipo === 'sessoes'\s*\n?\s*\? <BlocosSessoes/,
      ],
    },
    chama: {
      arquivo: 'src/components/painel/ChamaContador.tsx',
      provas: [
        // As chamas apagadas dos marcos à frente existem e são desenhadas a partir de
        // `proximos` — o desenho de alvo desta tela.
        // ⚠️ A janela `\{!modoDiario && \([\s\S]{0,400}Próximos marcos` saiu daqui: ela
        // ancorava em TÍTULO (que mudou para "Os marcos da chama" quando o "faltam N" saiu,
        // DF 2026-08-01) e media DISTÂNCIA em caracteres. O pareamento condição↔bloco agora
        // é provado por casamento de chaves em `modo-diario.test.ts` — aqui fica só a
        // existência do elemento visual.
        /^(?![\s\S]*estado="futuro")[\s\S]*$/,
        /^(?![\s\S]*proximos\.map)[\s\S]*$/,
      ],
    },
  };

  it('todo `sem_alvo` declara também as provas VISUAIS', () => {
    expect(Object.keys(PROVAS_VISUAIS).sort()).toEqual([...RECURSOS_SEM_ALVO].sort());
  });

  for (const [recurso, { arquivo, provas }] of Object.entries(PROVAS_VISUAIS)) {
    it(`\`${recurso}\` — o desenho de alvo está guardado`, () => {
      const src = FONTE(arquivo);
      for (const re of provas) expect(re.test(src), `${arquivo} :: ${re}`).toBe(true);
    });
  }
});

/**
 * 🔎 O QUE ESTA ASSERÇÃO NÃO COBRE (declarado de propósito — silêncio aqui viraria falsa
 * confiança, que é exatamente o que deixou os sete passarem):
 *
 *  - **Prosa.** O cartão "Como seu plano evolui" não era elemento nenhum: era um parágrafo.
 *    Nenhum detector visual o pega, e o léxico do futuro também não — foi a LEITURA DOS
 *    PRINTS que o revelou. Quem cobre isso é `pressupoePrescricao`.
 *  - **Estado atrás de interação.** Modais, folhas, sub-abas do Histórico e telas que só
 *    aparecem com dado específico (ex.: `modoForca` já ligado numa conta antiga).
 *  - **Composição em runtime.** Um desenho montado por CSS externo, por classe do
 *    `globals.css` ou por biblioteca não aparece no fonte do componente.
 *  - **Arquivos compartilhados fora da tabela.** A regra absoluta só roda em `ModoDiario.tsx`;
 *    nos demais a prova é a existência do guard, não a ausência do desenho.
 *
 * A rede real para desenho é o smoke sobre o DOM renderizado (4 detectores geométricos nas
 * seis abas), que roda fora da suíte unitária.
 */
