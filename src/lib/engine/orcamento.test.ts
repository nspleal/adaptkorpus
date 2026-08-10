/**
 * Leva H — orçamento na dieta (pedido nº 11 do beta: "a dieta esta muito cara tambem.
 * precisa ter opçao de limite de orçamento").
 *
 * Fonte: cofre, parametros-motor-dieta-evokorpus §`orcamento`/§`custoRelativo` (DF 2026-07-26);
 * handoff-leva-h-orcamento-2026-08-06.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { montarCardapioDia } from './assembler';
import { gerarDieta } from './index';
import { JANELA_OBJETIVO } from './constants';
import { nivelCustoPrato, somaCustoPrato, tetosEmOrdem, custoOrdena, TETO_PREFERIDO } from './orcamento';
import { RECIPES_SEED, FOODS_BY_ID_SEED } from '../data/seed';
import { CUSTO_RELATIVO } from '../data/custo-relativo';
import { macrosDePrato } from '../data/nutrition';
import type { PlanoDieta } from './types';
import type { Recipe } from '../data/types';
import type { FlagsSaude, PerfilUsuario } from './types';

const semFlags: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

function plano(kcal: number, piso: number, objetivo: 'emagrecimento' | 'saude' | 'massa'): PlanoDieta {
  const j = JANELA_OBJETIVO[objetivo];
  const get = kcal / ((j.min + j.max) / 2);
  return {
    comportamento: 'PERMITIR', kcalAlvo: kcal,
    macros: { proteinaG: piso, proteinaPisoG: piso, gorduraG: 0, carboidratoG: 0, kcalProteina: 0, kcalGordura: 0, kcalCarboidrato: 0 },
    janela: { minKcal: get * j.min, maxKcal: get * j.max },
    derivados: {} as PlanoDieta['derivados'], motivos: [], avisos: [],
  };
}

/** Os 6 de calibração do cofre (régua conservadora: menos espaço calórico para o mesmo piso). */
const CALIBRACAO = [
  { nome: 'F60', kcal: 1575, piso: 96, objetivo: 'emagrecimento' as const },
  { nome: 'F70', kcal: 1730, piso: 112, objetivo: 'emagrecimento' as const },
  { nome: 'M70', kcal: 2055, piso: 112, objetivo: 'emagrecimento' as const },
  { nome: 'M80', kcal: 2230, piso: 128, objetivo: 'emagrecimento' as const },
  { nome: 'M80manut', kcal: 2710, piso: 96, objetivo: 'saude' as const },
  { nome: 'M90massa', kcal: 3550, piso: 144, objetivo: 'massa' as const },
];
/** Os mesmos 6 cenários, mas pelos perfis REAIS — as kcal que o app de fato produz. */
const PERFIS_DO_GATE: { nome: string; p: PerfilUsuario }[] = [
  { nome: 'F60', p: { sexo: 'feminino', pesoKg: 60, alturaCm: 165, idade: 30, nivelAtividade: 'moderado', objetivo: 'emagrecimento', flagsSaude: semFlags } },
  { nome: 'F70', p: { sexo: 'feminino', pesoKg: 70, alturaCm: 165, idade: 30, nivelAtividade: 'moderado', objetivo: 'emagrecimento', flagsSaude: semFlags } },
  { nome: 'M70', p: { sexo: 'masculino', pesoKg: 70, alturaCm: 175, idade: 30, nivelAtividade: 'moderado', objetivo: 'emagrecimento', flagsSaude: semFlags } },
  { nome: 'M80', p: { sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado', objetivo: 'emagrecimento', flagsSaude: semFlags } },
  { nome: 'M80manut', p: { sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado', objetivo: 'saude', flagsSaude: semFlags } },
  { nome: 'M90massa', p: { sexo: 'masculino', pesoKg: 90, alturaCm: 185, idade: 30, nivelAtividade: 'intenso', objetivo: 'massa', flagsSaude: semFlags } },
];
const PADROES = [null, 'vegetariano', 'vegano'] as const;

describe('🔴 aceite 2 — o cardápio econômico é viável (o aceite fundador)', () => {
  it('3 padrões × 6 kcal de calibração fecham com orcamento=baixo', () => {
    const linhas: string[] = []; const falhas: string[] = [];
    for (const c of CALIBRACAO) for (const pref of PADROES) {
      const cardapio = montarCardapioDia(plano(c.kcal, c.piso, c.objetivo), RECIPES_SEED, FOODS_BY_ID_SEED, {
        alergenos: [], preferencia: pref, orcamento: 'baixo',
      });
      const nivel = Math.max(...cardapio.itens.map((i) => nivelCustoPrato(i.prato)));
      linhas.push(`${c.nome.padEnd(9)} ${(pref ?? 'onivoro').padEnd(12)} prot ${cardapio.totais.proteinaG.toFixed(1)}/${c.piso} · teto ≤${nivel} · ${cardapio.status}`);
      // Precisão exibida: o app mostra proteína em gramas inteiras (ver o predicado do montador).
      if (Math.round(cardapio.totais.proteinaG) < c.piso) falhas.push(`${c.nome}/${pref ?? 'onivoro'}: proteína ${cardapio.totais.proteinaG.toFixed(1)} < piso ${c.piso}`);
      if (cardapio.status !== 'ok') falhas.push(`${c.nome}/${pref ?? 'onivoro'}: status ${cardapio.status}`);
    }
    expect(falhas, `\n${linhas.join('\n')}\n`).toEqual([]);
  });

  /**
   * Acréscimo do autor (2026-08-06): a calibração do cofre é a régua CONSERVADORA (kcal
   * menores para o mesmo piso, porque proteína escala com o peso e não com a kcal). Este
   * teste prova que o aceite fecha também nos números que o app produz de fato.
   */
  it('fecha também nos 6 kcal QUE O GATE PRODUZ (não só na calibração do cofre)', () => {
    const falhas: string[] = [];
    for (const { nome, p } of PERFIS_DO_GATE) for (const pref of PADROES) {
      const r = gerarDieta(p, { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, restricoes: { alergenos: [], preferencia: pref, orcamento: 'baixo' } });
      const c = r.cardapio!;
      if (Math.round(c.totais.proteinaG) < Math.round(r.plano!.macros.proteinaPisoG)) falhas.push(`${nome}/${pref ?? 'onivoro'}: proteína ${c.totais.proteinaG.toFixed(1)} < piso ${r.plano!.macros.proteinaPisoG}`);
      if (c.status !== 'ok') falhas.push(`${nome}/${pref ?? 'onivoro'}: status ${c.status}`);
    }
    expect(falhas).toEqual([]);
  });
});

/**
 * 🔴 ACEITE 3 — TETO, NÃO ALVO. O cenário é sintético de propósito: com o catálogo real tudo
 * fecha no nível ≤2, então um teste sobre ele NÃO distinguiria mecanismo macio de filtro duro.
 * Aqui só existe UM prato capaz de alcançar o piso, e ele é de faixa 3.
 */
describe('🔴 aceite 3 — teto, não alvo: o prato caro ENTRA quando é o único que fecha', () => {
  const r = (id: string, refeicoes: Recipe['refeicoes'], itens: [string, number][]): Recipe => ({
    id, nome: id, refeicoes, tipo: 'onivoro', itens: itens.map(([alimentoId, gramas]) => ({ alimentoId, gramas })), contemAlergenos: [],
  });
  // a52 batata-doce e a71 banana são faixa 1 e quase sem proteína; a21 pintado é faixa 3 e o
  // único caminho até o piso.
  const CATALOGO: Recipe[] = [
    r('x1', ['cafe'], [['a71', 200]]),
    r('x2', ['almoco'], [['a52', 300]]),
    r('x3', ['jantar'], [['a52', 250], ['a71', 100]]),
    r('x9', ['almoco'], [['a21', 300]]),
  ];

  it('o catálogo de teste é o que eu penso que é (faixas 1,1,1,3)', () => {
    expect(nivelCustoPrato(CATALOGO[0]!)).toBe(1);
    expect(nivelCustoPrato(CATALOGO[1]!)).toBe(1);
    expect(nivelCustoPrato(CATALOGO[2]!)).toBe(1);
    expect(nivelCustoPrato(CATALOGO[3]!)).toBe(3);
    expect(CUSTO_RELATIVO.a21).toBe(3);
  });

  it('🔑 com orcamento=baixo, o prato de faixa 3 entra porque o piso exige', () => {
    const cardapio = montarCardapioDia(plano(1200, 80, 'saude'), CATALOGO, FOODS_BY_ID_SEED, {
      alergenos: [], preferencia: null, orcamento: 'baixo',
    });
    const ids = cardapio.itens.map((i) => i.prato.id);
    expect(ids, 'o prato de faixa 3 foi EXCLUÍDO — isso é filtro duro, não teto').toContain('x9');
    expect(Math.round(cardapio.totais.proteinaG)).toBeGreaterThanOrEqual(80);
  });

  it('e o mesmo catálogo, com piso que a faixa 1 alcança, NÃO usa o prato caro', () => {
    const cardapio = montarCardapioDia(plano(1200, 5, 'saude'), CATALOGO, FOODS_BY_ID_SEED, {
      alergenos: [], preferencia: null, orcamento: 'baixo',
    });
    expect(cardapio.itens.map((i) => i.prato.id), 'subiu de faixa sem precisar').not.toContain('x9');
  });
});

describe('🔴 aceite 4 — alérgeno é inviolável, mesmo sendo o barato', () => {
  it('alergia a soja + baixo: nenhum prato com soja, e o cardápio ainda fecha', () => {
    for (const c of CALIBRACAO) {
      const cardapio = montarCardapioDia(plano(c.kcal, c.piso, c.objetivo), RECIPES_SEED, FOODS_BY_ID_SEED, {
        alergenos: ['soja'], preferencia: 'vegano', orcamento: 'baixo',
      });
      for (const it of cardapio.itens) expect(it.prato.contemAlergenos, `${c.nome}: ${it.prato.id}`).not.toContain('soja');
      expect(cardapio.status, `${c.nome}`).not.toBe('sem_candidatos');
    }
  });

  it('a identidade alimentar também não cede ao custo', () => {
    for (const c of CALIBRACAO) {
      const cardapio = montarCardapioDia(plano(c.kcal, c.piso, c.objetivo), RECIPES_SEED, FOODS_BY_ID_SEED, {
        alergenos: [], preferencia: 'vegano', orcamento: 'baixo',
      });
      for (const it of cardapio.itens) expect(it.prato.tipo, `${c.nome}: ${it.prato.id}`).toBe('vegano');
    }
  });
});

/**
 * 🔴 ACEITE 5 — o teste que torna o deploy seguro: quem não escolheu nada não vê NADA mudar.
 * Medido byte a byte nos 18 cenários (6 perfis × 3 padrões) contra o resultado sem o campo.
 */
describe('🔴 aceite 5 — zero mudança com alto/sem escolha', () => {
  const assinatura = (orcamento: 'alto' | undefined) => {
    const out: string[] = [];
    for (const { nome, p } of PERFIS_DO_GATE) for (const pref of PADROES) {
      const c = gerarDieta(p, { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, restricoes: { alergenos: [], preferencia: pref, orcamento } }).cardapio!;
      out.push(`${nome}/${pref}|${c.status}|${c.itens.map((i) => `${i.refeicao}:${i.prato.id}`).join(',')}|${c.totais.kcal.toFixed(6)}|${c.totais.proteinaG.toFixed(6)}`);
    }
    return out;
  };
  // ⏱️ 36 montagens completas sobre o catálogo real (~4 s) contra o limite padrão de 5 s —
  // passava por pouco e estourou com a máquina carregada. Folga explícita: teste no fio do
  // limite é falha intermitente esperando a hora, e falha intermitente ensina a ignorar vermelho.
  it('`alto` e "sem campo" produzem cardápios idênticos', () => {
    expect(assinatura('alto')).toEqual(assinatura(undefined));
  }, 30_000);
  it('com `alto` o custo nem participa da ordenação', () => {
    expect(custoOrdena('alto')).toBe(false);
    expect(custoOrdena(undefined)).toBe(false);
    expect(custoOrdena(null)).toBe(false);
    expect(custoOrdena('baixo')).toBe(true);
    expect(custoOrdena('medio')).toBe(true);
  });
});

/**
 * 🔴 ACEITE 7 — Σ × max, o PAR DISCRIMINANTE.
 *
 * ⚠️ Este teste existe porque a mutação Σ→max SOBREVIVEU à primeira suíte. Sondado antes de
 * escrever: o desempate por custo é alcançável (decide 1340 vezes numa varredura de 108
 * cenários reais), então era guard fraco, não código morto.
 *
 * As duas regras só divergem numa forma específica: um prato com MUITOS ingredientes baratos
 * contra um prato com UM ingrediente caro.
 *   A = 4 ingredientes faixa 1  → max 1 · Σ 4
 *   B = 1 ingrediente  faixa 3  → max 3 · Σ 3
 * Σ prefere B; max prefere A. Opostos, pelo mesmo dado.
 *
 * Os dois pratos têm kcal e proteína IDÊNTICAS (resolvido numericamente sobre a paleta real:
 * 364,50 kcal e 39,15 g), então `dev` e `protDev` empatam por construção e a decisão CAI no
 * ordenador fino — que é exatamente o que se quer medir. O café só existe em faixa 3, o que
 * força o relaxamento até o teto 3 e põe A e B para competir no mesmo nível.
 */
describe('🔴 aceite 7 — Σ ordena (não o max): par discriminante', () => {
  const r = (id: string, refeicoes: Recipe['refeicoes'], itens: [string, number][]): Recipe => ({
    id, nome: id, refeicoes, tipo: 'onivoro', itens: itens.map(([alimentoId, gramas]) => ({ alimentoId, gramas })), contemAlergenos: [],
  });
  // ⚠️ Gramas resolvidas em precisão de bit para que kcal E proteína empatem EXATAMENTE
  // (`dev`/`protDev` comparam floats por igualdade). Se a paleta mudar, a pré-condição abaixo
  // falha com mensagem — re-resolver, nunca afrouxar para `toBeCloseTo`: um empate aproximado
  // não aciona o desempate por custo, e o teste passaria medindo outra coisa.
  const A = r('almA', ['almoco'], [['a26', 114.87610247795045], ['a52', 118.31583368332628], ['a71', 50], ['a54', 50]]); // 4 × faixa 1
  const B = r('almB', ['almoco'], [['a25', 150]]);                                              // 1 × faixa 3
  const CATALOGO: Recipe[] = [r('cafe1', ['cafe'], [['a25', 60]]), A, B, r('jan1', ['jantar'], [['a52', 200]])];

  it('o par é mesmo discriminante: mesmas kcal e proteína, Σ e max opostos', () => {
    // ⚠️ A pré-condição usa `macrosDePrato` — a função de PRODUÇÃO. Uma primeira versão deste
    // teste somava com `p * g / 100` enquanto o motor usa `p * (g/100)`: os dois diferem no
    // último bit, o empate que eu validava não era o empate que o motor via, e `protDev`
    // decidia antes do custo. Validar com a fórmula da produção é o que torna a pré-condição
    // verdadeira.
    const m = (x: Recipe) => macrosDePrato(x, FOODS_BY_ID_SEED);
    expect(m(A).kcal, 'kcal não empatam no bit — re-resolver as gramas').toBe(m(B).kcal);
    expect(m(A).proteinaG, 'proteína não empata no bit — re-resolver as gramas').toBe(m(B).proteinaG);
    expect(nivelCustoPrato(A)).toBe(1); expect(somaCustoPrato(A)).toBe(4);
    expect(nivelCustoPrato(B)).toBe(3); expect(somaCustoPrato(B)).toBe(3);
  });

  it('🔑 o desempate usa Σ — trocar por max escolhe o outro prato', () => {
    const cardapio = montarCardapioDia(plano(1000, 30, 'saude'), CATALOGO, FOODS_BY_ID_SEED, {
      alergenos: [], preferencia: null, orcamento: 'baixo',
    });
    const almoco = cardapio.itens.find((i) => i.refeicao === 'almoco')!;
    expect(almoco.prato.id, 'o ordenador fino virou `max` — a curadoria provou o aceite sobre Σ').toBe('almB');
  });

  /**
   * 🔑 O MESMO cenário com `alto` — e é aqui que o guard `ordenaPorCusto` fica observável.
   *
   * Sondado: remover esse guard (custo ordenando sempre) NÃO muda nenhum dos 18 cardápios
   * reais, então o aceite 5 sozinho não o protege — ele compara `alto` com "sem campo", e a
   * mutação afeta os dois igualmente. Neste par, onde o custo de fato decide, a diferença
   * aparece: sem orçamento escolhido o desempate tem de cair na CHAVE lexicográfica
   * (`almA` < `almB`), exatamente como antes desta leva.
   */
  it('🔑 com `alto`, o custo NÃO ordena — decide a chave lexicográfica', () => {
    const cardapio = montarCardapioDia(plano(1000, 30, 'saude'), CATALOGO, FOODS_BY_ID_SEED, {
      alergenos: [], preferencia: null, orcamento: 'alto',
    });
    const almoco = cardapio.itens.find((i) => i.refeicao === 'almoco')!;
    expect(almoco.prato.id, 'o custo entrou na ordenação sem orçamento escolhido').toBe('almA');
  });
});

describe('🔴 aceite 8 — determinismo nos 3 valores de orçamento', () => {
  it('mesma entrada → mesmo conjunto, em baixo/medio/alto', () => {
    for (const orcamento of ['baixo', 'medio', 'alto'] as const) {
      for (const c of CALIBRACAO.slice(0, 3)) {
        const args = { alergenos: [], preferencia: 'vegano' as const, orcamento };
        const a = montarCardapioDia(plano(c.kcal, c.piso, c.objetivo), RECIPES_SEED, FOODS_BY_ID_SEED, args);
        const b = montarCardapioDia(plano(c.kcal, c.piso, c.objetivo), RECIPES_SEED, FOODS_BY_ID_SEED, args);
        expect(a.itens.map((i) => i.prato.id)).toEqual(b.itens.map((i) => i.prato.id));
      }
    }
  });
});

describe('mecânica declarada do orçamento', () => {
  it('o relaxamento é por NÍVEL e começa no teto preferido', () => {
    expect(TETO_PREFERIDO).toEqual({ baixo: 1, medio: 2, alto: 3 });
    expect(tetosEmOrdem('baixo')).toEqual([1, 2, 3]);
    expect(tetosEmOrdem('medio')).toEqual([2, 3]);
    expect(tetosEmOrdem('alto')).toEqual([3]);
  });

  /** 🔒 max decide o NÍVEL (a curadoria provou o aceite sobre max); Σ só ORDENA. */
  it('nível = max dos ingredientes; Σ = soma simples, sem ponderar por gramas', () => {
    const prato: Recipe = { id: 't', nome: 't', refeicoes: ['almoco'], tipo: 'onivoro', contemAlergenos: [],
      itens: [{ alimentoId: 'a42', gramas: 500 }, { alimentoId: 'a25', gramas: 10 }] }; // a42=1, a25=3
    expect(nivelCustoPrato(prato)).toBe(3);
    expect(somaCustoPrato(prato)).toBe(4);
    // 500 g do barato + 10 g do caro dá o MESMO Σ que o inverso — Σ ordena, não estima custo.
    const invertido: Recipe = { ...prato, itens: [{ alimentoId: 'a42', gramas: 10 }, { alimentoId: 'a25', gramas: 500 }] };
    expect(somaCustoPrato(invertido)).toBe(somaCustoPrato(prato));
  });
});

/**
 * 🔴 COPY TRAVADA PELA DF (2026-07-26): teto, não alvo — e NADA de dinheiro.
 *
 * O dado é uma faixa relativa curada, com ±20–25% de arbitrariedade DECLARADA (47 dos 167
 * são julgamento sem base de preço). Ele não sustenta afirmação monetária nenhuma, então a
 * tela não exibe R$, não promete economia e não chama o cardápio de "barato".
 */
describe('🔒 copy do orçamento — sem dinheiro, sem promessa', () => {
  // ⚠️ Sem tirar comentários, o guard bate no próprio comentário que DOCUMENTA a proibição
  // (aconteceu). O que precisa estar limpo é o que chega à tela, não a explicação da regra.
  const fonteUI = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
  const TELAS = ['src/components/perfil/DiasEPreferencias.tsx', 'src/components/painel/EditarPerfil.tsx'];
  const PROIBIDO: readonly [RegExp, string][] = [
    [/R\$/, 'símbolo de moeda'],
    [/\breais\b/i, 'valor em reais'],
    [/card[áa]pio barato/i, '"cardápio barato"'],
    [/mais barato do mercado/i, 'superlativo de preço'],
    [/econom(ia|ize|iza)\s+de\s*R?\$?\s*\d/i, 'promessa de economia em dinheiro'],
    [/gaste? menos/i, 'promessa de gasto'],
    [/pre[çc]o m[ée]dio/i, 'estimativa de preço'],
  ];
  it('nenhuma tela do orçamento fala em dinheiro', () => {
    for (const t of TELAS) {
      const src = fonteUI(t);
      for (const [re, oque] of PROIBIDO) expect(re.test(src), `${t}: ${oque}`).toBe(false);
    }
  });

  it('a explicação existe UMA vez e diz o mecanismo certo (teto, não alvo)', () => {
    const src = fonteUI('src/components/perfil/DiasEPreferencias.tsx');
    expect(src, 'a explicação do teto sumiu').toMatch(/menor custo/i);
    expect(src, 'não diz que sobe quando precisa — viraria promessa de "só o barato"').toMatch(/s[óo] quando precisa/i);
    /**
     * 🔒 DF 2026-08-10. A medição do aceite 5 mostrou que `alto` e "sem preferência" produzem
     * cardápios IDÊNTICOS (0/18, byte a byte) — a diferença é só de registro (null = nunca
     * escolheu · alto = considerou e declinou o teto), útil para telemetria e irrelevante
     * para quem come. Os quatro botões ficam, mas a copy não pode sugerir que "Sem limite"
     * faz algo que "Sem preferência" não faz: a frase tem de cobrir os DOIS.
     */
    /**
     * ⚠️ Escopado à FRASE, não ao arquivo. A primeira versão afirmava `src.includes('Sem
     * limite')` sobre o arquivo inteiro — e passava por causa da DEFINIÇÃO do rótulo em
     * `ROTULO_ORCAMENTO`, não da explicação. Uma mutação que reduzia a frase a um só botão
     * sobrevivia. O guard tem de olhar onde a promessa é feita.
     */
    const i = src.indexOf('Priorizamos os itens de menor custo');
    expect(i, 'a explicação do teto sumiu — reancore este guard').toBeGreaterThan(-1);
    const frase = src.slice(i, src.indexOf('</p>', i));
    expect(frase, 'a promessa de inércia sumiu').toMatch(/cardápio fica como está hoje/i);
    for (const rotulo of ['Sem preferência', 'Sem limite'])
      expect(frase.includes(rotulo), `a explicação não cobre "${rotulo}" — a copy passa a sugerir diferença que não existe`).toBe(true);
  });

  it('o seletor não promete resultado nem usa superlativo', () => {
    const src = fonteUI('src/components/perfil/DiasEPreferencias.tsx');
    const i = src.indexOf('export function Orcamento');
    const bloco = src.slice(i, src.indexOf('export function PreferenciasAlimentares'));
    for (const re of [/garantid/i, /o melhor\b/i, /ideal para você/i, /otimiz/i])
      expect(re.test(bloco), `superlativo/promessa no seletor: ${re}`).toBe(false);
  });
});

/**
 * 🔴 REQUISITO DO AUTOR (2026-08-06), da classe "duas verdades para o mesmo número": o
 * predicado de "não fechou" do montador DEVE ler o MESMO `proteinaPisoG` que a substituição
 * usa como trava dura. Uma constante, duas superfícies.
 */
describe('🔒 piso de proteína: uma constante, duas superfícies', () => {
  const fonte = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

  it('montador e substituição leem `proteinaPisoG` do plano — nenhum tem piso próprio', () => {
    const asm = fonte('src/lib/engine/assembler.ts');
    const sub = fonte('src/lib/engine/substituicao.ts');
    expect(asm, 'o montador não lê o piso do plano — voltou a mirar sem obedecer').toMatch(/plano\.macros\.proteinaPisoG/);
    expect(sub, 'a substituição deixou de ler o piso do plano').toMatch(/macros\.proteinaPisoG/);
    // e nenhum dos dois carrega uma constante de piso paralela
    for (const [nome, src] of [['assembler', asm], ['substituicao', sub]] as const)
      expect(/const\s+\w*[Pp]iso\w*\s*=\s*[\d.]+/.test(src), `${nome} criou um piso literal próprio`).toBe(false);
  });

  it('o relaxamento decide pelo piso, não pelo alvo de proteína', () => {
    const asm = fonte('src/lib/engine/assembler.ts');
    const i = asm.indexOf('const fechou');
    expect(i, 'o predicado de fechamento sumiu — reancore este guard').toBeGreaterThan(-1);
    const bloco = asm.slice(i, i + 260);
    expect(bloco).toMatch(/pisoProteina/);
    expect(bloco, 'o predicado passou a usar o ALVO de proteína em vez do piso').not.toMatch(/alvoProt|macros\.proteinaG\b/);
  });
});
