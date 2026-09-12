/**
 * Montador de cardápio (Bloco B) — v0 determinístico.
 *
 * Fonte: parametros-motor-dieta-adaptkorpus §"Montador" + motor-de-regras-deterministico.
 *
 * Garantias implementadas (as travadas na spec):
 *   1. ALÉRGENO = filtro de segurança ABSOLUTO — nunca relaxado.
 *   2. Preferência (vegano/vegetariano) = filtro forte; cede ANTES do alérgeno (nunca o alérgeno).
 *   3. Mira a JANELA do objetivo; desempate = MENOR DESVIO CALÓRICO (fidelidade calórica primeiro).
 *   4. Macros como critério secundário (proteína protegida).
 *   5. Chave final reprodutível = ordem lexicográfica sobre o CONJUNTO de ids do dia.
 *
 * Limitações conscientes do v0 (Bloco B em progresso, documentadas honestamente):
 *   - Seleciona 1 prato por refeição (café/almoço/jantar obrigatórios; lanche opcional),
 *     pratos distintos entre os slots. Aplica UMA escala de porção por dia (mira a kcal-alvo,
 *     dentro de `ESCALA_PORCAO`), mas não relaxa proteína até o piso na montagem.
 *     Busca exaustiva determinística (banco finito; ~160k combinações no pior caso).
 */
import { macrosDePrato } from '../data/nutrition';
import { ESCALA_PORCAO } from './constants';
import { custoOrdena, nivelCustoPrato, somaCustoPrato, tetosEmOrdem, type Orcamento } from './orcamento';
import type {
  Alergeno,
  Food,
  Recipe,
  RecipeMacros,
  Refeicao,
} from '../data/types';
import type { PlanoDieta } from './types';

export interface RestricoesUsuario {
  /** Alérgenos do usuário — filtro ABSOLUTO. */
  alergenos: Alergeno[];
  /** Preferência alimentar (opcional). 'vegano' aceita só vegano; 'vegetariano' aceita veg + vegano. */
  preferencia?: 'vegano' | 'vegetariano' | null;
  /**
   * "Alimentos que não curto" — IDs de alimentos que o usuário prefere evitar. PREFERÊNCIA
   * RELAXÁVEL (nunca segurança): evitamos por refeição quando há alternativa; se filtrar
   * esvaziar os candidatos daquela refeição, relaxamos (o cardápio precisa fechar).
   */
  excluirAlimentoIds?: string[];
  /**
   * "Cansei deste prato" — IDs de PRATOS em descanso na rotação (cofre,
   * parametros-motor-substituicao-adaptkorpus §Variedade, DF 2026-07-01). Nível do PRATO, não do
   * alimento: cansaço de receita ≠ desgosto do ingrediente. PREFERÊNCIA RELAXÁVEL, idêntico ao
   * "não curto": evita o prato quando há alternativa; relaxa se esvaziar (o cardápio precisa
   * fechar). O prazo de descanso (21 dias) e o retorno automático vivem FORA do motor (usam
   * relógio) — o motor recebe só a lista já resolvida.
   */
  excluirPratoIds?: string[];
  /**
   * Orçamento (pedido nº 11 do beta). TETO, NUNCA ALVO: prefere a faixa e SOBE quando o piso
   * de proteína ou a janela de kcal não fecham. Ausente/`alto` = comportamento de hoje, byte
   * a byte — o custo nem entra na ordenação (cofre §`orcamento`, DF 2026-07-26).
   */
  orcamento?: Orcamento | null;
}

export type StatusMontagem = 'ok' | 'fora_da_janela' | 'sem_candidatos';

export interface CardapioItem {
  refeicao: Refeicao;
  prato: Recipe;
  /** Fator de escala aplicado às porções do prato (1 = porção-base do banco). */
  escala: number;
  /** Macros do prato JÁ escaladas (base × escala) — kcal somada da TACO, Δ=0. */
  macros: RecipeMacros;
}

export interface CardapioDia {
  status: StatusMontagem;
  itens: CardapioItem[];
  totais: RecipeMacros;
  /** Desvio absoluto entre kcal do cardápio e a kcal-alvo. */
  desvioKcal: number;
  /** Mensagem honesta quando não fecha (nunca afrouxa alérgeno). */
  nota?: string;
}

function preferenciaAceita(
  tipo: Recipe['tipo'],
  pref: RestricoesUsuario['preferencia'],
): boolean {
  if (!pref) return true;
  if (pref === 'vegano') return tipo === 'vegano';
  if (pref === 'vegetariano') return tipo === 'vegano' || tipo === 'vegetariano';
  return true;
}

function semAlergeno(recipe: Recipe, alergenos: readonly Alergeno[]): boolean {
  return !recipe.contemAlergenos.some((a) => alergenos.includes(a));
}

function porId(a: Recipe, b: Recipe): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function somar(...partes: RecipeMacros[]): RecipeMacros {
  return partes.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      proteinaG: acc.proteinaG + m.proteinaG,
      carboidratoG: acc.carboidratoG + m.carboidratoG,
      gorduraG: acc.gorduraG + m.gorduraG,
    }),
    { kcal: 0, proteinaG: 0, carboidratoG: 0, gorduraG: 0 },
  );
}

/** Escala linear das macros de um prato (kcal × porção; Δ=0). */
function escalar(m: RecipeMacros, s: number): RecipeMacros {
  return { kcal: m.kcal * s, proteinaG: m.proteinaG * s, carboidratoG: m.carboidratoG * s, gorduraG: m.gorduraG * s };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

interface PratoBase {
  refeicao: Refeicao;
  prato: Recipe;
  base: RecipeMacros;
}

interface Candidato {
  baseItens: PratoBase[];
  /** Escala única do dia (Passo 3 — "escalar pratos"): porções sobem/descem juntas. */
  escala: number;
  /** Totais JÁ escalados (escala × soma das porções-base). */
  totais: RecipeMacros;
}

/** Materializa os itens do cardápio com a escala aplicada (para exibição/troca). */
function materializar(c: Candidato): CardapioItem[] {
  return c.baseItens.map((b) => ({
    refeicao: b.refeicao,
    prato: b.prato,
    escala: c.escala,
    macros: escalar(b.base, c.escala),
  }));
}

// Ordem de prioridade TRAVADA do comparador de candidatos (implementada inline em
// `procurar`/`melhorDe`, sem alocação): 1) menor desvio calórico (fidelidade calórica
// primeiro) → 2) menor desvio de proteína (macro protegida) → 3) chave reprodutível:
// ordem lexicográfica sobre o CONJUNTO de ids do dia (só computada no empate).

const REFEICOES_OBRIGATORIAS: Refeicao[] = ['cafe', 'almoco', 'jantar'];

/**
 * Monta o cardápio do dia. Função PURA e determinística.
 * Nunca inclui prato com alérgeno do usuário, mesmo que isso impeça fechar a janela.
 */
export function montarCardapioDia(
  plano: PlanoDieta,
  recipes: readonly Recipe[],
  foodsById: ReadonlyMap<string, Food>,
  restricoes: RestricoesUsuario,
): CardapioDia {
  const elegiveis = recipes
    .filter((r) => semAlergeno(r, restricoes.alergenos))
    .filter((r) => preferenciaAceita(r.tipo, restricoes.preferencia))
    .slice()
    .sort(porId);

  // Orçamento: ausente = `alto` = sem restrição (ninguém ganha limite que não pediu).
  const orcamento: Orcamento = restricoes.orcamento ?? 'alto';
  const ordenaPorCusto = custoOrdena(orcamento);

  const macrosCache = new Map<string, RecipeMacros>();
  const macros = (r: Recipe): RecipeMacros => {
    let m = macrosCache.get(r.id);
    if (!m) {
      m = macrosDePrato(r, foodsById);
      macrosCache.set(r.id, m);
    }
    return m;
  };

  const porRefeicaoDe = (lista: readonly Recipe[], ref: Refeicao): Recipe[] =>
    lista.filter((r) => r.refeicoes.includes(ref));
  const porRefeicao = (ref: Refeicao): Recipe[] => porRefeicaoDe(elegiveis, ref);

  const faltando = REFEICOES_OBRIGATORIAS.filter((ref) => porRefeicao(ref).length === 0);
  if (faltando.length > 0) {
    return {
      status: 'sem_candidatos',
      itens: [],
      totais: { kcal: 0, proteinaG: 0, carboidratoG: 0, gorduraG: 0 },
      desvioKcal: Infinity,
      nota: `Sem pratos elegíveis para: ${faltando.join(', ')} (após filtros de alergia/preferência).`,
    };
  }

  // Busca combinatória (café × almoço × jantar × lanche opcional), pratos DISTINTOS.
  //
  // PERFORMANCE (base V2, 2026-07-01): com 96 pratos multi-slot a busca chega a ~2,3M
  // combinações — a versão ingênua (alocar itens + somar + comparar objetos por combinação)
  // levava ~1 s por cardápio. Este loop é o mesmo algoritmo com aritmética escalar
  // incremental e ZERO alocação no caminho quente; só os DOIS vencedores são materializados
  // no fim. A saída é BIT-IDÊNTICA à busca ingênua: mesma ordem de iteração, mesma
  // associatividade de soma (c→a→j→l), mesmo comparador estrito (desvio de kcal → desvio de
  // proteína → chave lexicográfica do conjunto de ids, computada só no empate).
  function procurar(cafes: Recipe[], almocos: Recipe[], jantares: Recipe[], lanches: (Recipe | null)[]) {
    const mC = cafes.map(macros), mA = almocos.map(macros), mJ = jantares.map(macros);
    const mL = lanches.map((l) => (l ? macros(l) : null));
    const alvoKcal = plano.kcalAlvo, alvoProt = plano.macros.proteinaG;
    const { minKcal, maxKcal } = plano.janela;

    interface Melhor { ci: number; ai: number; ji: number; li: number; escala: number; dev: number; protDev: number; custo: number; chave: string | null }
    // Σ de custo por prato, pré-computada por lista (a soma do conjunto é a soma das partes).
    const kC = cafes.map(somaCustoPrato), kA = almocos.map(somaCustoPrato), kJ = jantares.map(somaCustoPrato);
    const kL = lanches.map((l) => (l ? somaCustoPrato(l) : 0));
    let geral: Melhor | null = null;
    let naJanela: Melhor | null = null;

    const chaveDe = (ci: number, ai: number, ji: number, li: number): string => {
      const ids = [cafes[ci]!.id, almocos[ai]!.id, jantares[ji]!.id];
      const l = lanches[li];
      if (l) ids.push(l.id);
      return ids.sort().join('|');
    };
    // Substitui `b` só se o candidato for ESTRITAMENTE melhor (mesma semântica de
    // compararCandidatos(cand, melhor) < 0 da versão ingênua).
    /**
     * 🔒 CADEIA DE PRECEDÊNCIA TRAVADA (cofre §Ordem de precedência; error-hunt 2026-08-01):
     *   menor desvio calórico → macros (proteína) → CUSTO → chave final sobre o conjunto.
     * O custo NUNCA sobe acima dos macros: as duas ordens produzem cardápios diferentes, e a
     * posição foi decidida por DF — trocá-la é reabrir decisão travada.
     * Com `orcamento = alto` (ou ausente) `ordenaPorCusto` é falso e a cadeia fica idêntica à
     * de antes desta leva, byte a byte.
     */
    const melhorDe = (b: Melhor | null, ci: number, ai: number, ji: number, li: number, escala: number, dev: number, protDev: number, custo: number): Melhor => {
      if (!b) return { ci, ai, ji, li, escala, dev, protDev, custo, chave: null };
      if (dev !== b.dev) return dev < b.dev ? { ci, ai, ji, li, escala, dev, protDev, custo, chave: null } : b;
      if (protDev !== b.protDev) return protDev < b.protDev ? { ci, ai, ji, li, escala, dev, protDev, custo, chave: null } : b;
      if (ordenaPorCusto && custo !== b.custo) return custo < b.custo ? { ci, ai, ji, li, escala, dev, protDev, custo, chave: null } : b;
      const chave = chaveDe(ci, ai, ji, li);
      if (b.chave === null) b.chave = chaveDe(b.ci, b.ai, b.ji, b.li);
      return chave < b.chave ? { ci, ai, ji, li, escala, dev, protDev, custo, chave } : b;
    };

    for (let ci = 0; ci < cafes.length; ci++) {
      const cId = cafes[ci]!.id, kcalC = mC[ci]!.kcal, protC = mC[ci]!.proteinaG;
      for (let ai = 0; ai < almocos.length; ai++) {
        const aId = almocos[ai]!.id;
        if (aId === cId) continue;
        const kcalCA = kcalC + mA[ai]!.kcal, protCA = protC + mA[ai]!.proteinaG;
        for (let ji = 0; ji < jantares.length; ji++) {
          const jId = jantares[ji]!.id;
          if (jId === cId || jId === aId) continue;
          const kcalCAJ = kcalCA + mJ[ji]!.kcal, protCAJ = protCA + mJ[ji]!.proteinaG;
          for (let li = 0; li < lanches.length; li++) {
            const l = lanches[li];
            if (l && (l.id === cId || l.id === aId || l.id === jId)) continue;
            const kcalBase = l ? kcalCAJ + mL[li]!.kcal : kcalCAJ;
            const protBase = l ? protCAJ + mL[li]!.proteinaG : protCAJ;
            // Passo 3 — ESCALAR: porção do dia escala para mirar a kcal-alvo (kcal é o alvo
            // mais protegido). Escala única do dia, limitada à faixa realista (ESCALA_PORCAO).
            const escala = kcalBase > 0
              ? clamp(alvoKcal / kcalBase, ESCALA_PORCAO.min, ESCALA_PORCAO.max)
              : ESCALA_PORCAO.max;
            const kcal = kcalBase * escala;
            const dev = Math.abs(kcal - alvoKcal);
            const protDev = Math.abs(protBase * escala - alvoProt);
            const custo = kC[ci]! + kA[ai]! + kJ[ji]! + (l ? kL[li]! : 0);
            geral = melhorDe(geral, ci, ai, ji, li, escala, dev, protDev, custo);
            if (kcal >= minKcal && kcal <= maxKcal) naJanela = melhorDe(naJanela, ci, ai, ji, li, escala, dev, protDev, custo);
          }
        }
      }
    }

    // Materializa só os vencedores (mesma construção da versão ingênua: soma c→a→j→l).
    const montar = (b: Melhor | null): Candidato | null => {
      if (!b) return null;
      const baseItens: PratoBase[] = [
        { refeicao: 'cafe', prato: cafes[b.ci]!, base: mC[b.ci]! },
        { refeicao: 'almoco', prato: almocos[b.ai]!, base: mA[b.ai]! },
        { refeicao: 'jantar', prato: jantares[b.ji]!, base: mJ[b.ji]! },
      ];
      const l = lanches[b.li];
      if (l) baseItens.push({ refeicao: 'lanche', prato: l, base: mL[b.li]! });
      return { baseItens, escala: b.escala, totais: escalar(somar(...baseItens.map((x) => x.base)), b.escala) };
    };
    return { melhorNaJanela: montar(naJanela), melhorGeral: montar(geral) };
  }

  // Preferências relaxáveis de GOSTO — nunca segurança — e o cardápio PRECISA fechar. Duas
  // fontes, mesmo tratamento: "não curto" (nível do ALIMENTO) e "Cansei deste prato" (nível
  // do PRATO, cofre §Variedade). Estratégia determinística em dois passos: (1) tenta com as
  // listas filtradas; (2) se elas não formam um trio DISTINTO café/almoço/jantar (colisão
  // entre slots), relaxa por completo e tenta com as listas cheias. Best-effort que nunca
  // impede o cardápio de fechar.
  const evitarAlim = new Set(restricoes.excluirAlimentoIds ?? []);
  const evitarPrato = new Set(restricoes.excluirPratoIds ?? []);
  const temPreferencia = evitarAlim.size > 0 || evitarPrato.size > 0;
  const indesejado = (r: Recipe): boolean =>
    evitarPrato.has(r.id) || r.itens.some((it) => evitarAlim.has(it.alimentoId));
  const preferir = (lista: Recipe[]): Recipe[] => {
    if (!temPreferencia) return lista;
    const f = lista.filter((r) => !indesejado(r));
    return f.length > 0 ? f : lista; // relaxa por slot quando esvazia
  };
  const buscarEm = (lista: readonly Recipe[]) => {
    const lanchesBase = porRefeicaoDe(lista, 'lanche');
    let b = procurar(preferir(porRefeicaoDe(lista, 'cafe')), preferir(porRefeicaoDe(lista, 'almoco')), preferir(porRefeicaoDe(lista, 'jantar')), [null, ...preferir(lanchesBase)]);
    if (!b.melhorGeral && temPreferencia) {
      // as listas filtradas não fecharam um trio distinto → relaxa as preferências por completo.
      b = procurar(porRefeicaoDe(lista, 'cafe'), porRefeicaoDe(lista, 'almoco'), porRefeicaoDe(lista, 'jantar'), [null, ...lanchesBase]);
    }
    return b;
  };

  /**
   * 🔴 RELAXAMENTO POR NÍVEL — o coração do "teto, não alvo".
   *
   * Tenta fechar o dia no teto preferido; se o piso de proteína ou a janela de kcal não
   * fecharem, sobe o teto UM NÍVEL PARA O DIA INTEIRO e re-monta. Nunca prato a prato:
   * relaxar por prato tornaria o resultado dependente da ordem de busca e quebraria o
   * determinismo travado.
   *
   * 🔑 O predicado de "fechou" lê `plano.macros.proteinaPisoG` — a MESMA constante que a
   * substituição usa como trava dura (substituicao.ts). Uma constante, duas superfícies:
   * montar e substituir não podem discordar sobre o que é piso de proteína.
   */
  const pisoProteina = plano.macros.proteinaPisoG;
  let busca = buscarEm(elegiveis);
  for (const teto of tetosEmOrdem(orcamento)) {
    if (teto >= 3) { busca = buscarEm(elegiveis); break; }
    const noTeto = elegiveis.filter((r) => nivelCustoPrato(r) <= teto);
    const tentativa = buscarEm(noTeto);
    /**
     * ⚠️ A COMPARAÇÃO É NA PRECISÃO EXIBIDA, e isso não é frouxidão — é o único jeito
     * bem-posto de comparar. O montador MIRA a proteína (`protDev` acima), então quando o
     * alvo COINCIDE com o piso ele converge por baixo (95,999858 para 96). Um `>= piso`
     * estrito nunca seria satisfeito nesse caso, e o relaxamento subiria ao teto 3 SEMPRE —
     * "teto, não alvo" viraria "sempre o mais caro", silenciosamente. Medido nesta leva.
     *
     * A régua é a precisão em que o app mostra proteína: gramas inteiras. Um déficit invisível
     * na tela não é déficit; um déficit real (89,7 para um piso de 96) continua reprovando.
     */
    const fechou = tentativa.melhorNaJanela !== null
      && Math.round(tentativa.melhorNaJanela.totais.proteinaG) >= Math.round(pisoProteina);
    if (fechou) { busca = tentativa; break; }
  }
  const { melhorNaJanela, melhorGeral } = busca;

  // Fail-safe: pode não existir combinação de pratos DISTINTOS para as 3 refeições
  // obrigatórias mesmo havendo candidatos por slot (ex.: o único café = o único almoço).
  const escolhido = melhorNaJanela ?? melhorGeral;
  if (!escolhido) {
    return {
      status: 'sem_candidatos',
      itens: [],
      totais: { kcal: 0, proteinaG: 0, carboidratoG: 0, gorduraG: 0 },
      desvioKcal: Infinity,
      nota: 'Não há combinação de pratos distintos para café, almoço e jantar (após os filtros).',
    };
  }
  const desvioKcal = Math.abs(escolhido.totais.kcal - plano.kcalAlvo);
  // Ordem de exibição estável por refeição.
  const ordem: Refeicao[] = ['cafe', 'almoco', 'lanche', 'jantar'];
  const itensOrdenados = materializar(escolhido)
    .sort((x, y) => ordem.indexOf(x.refeicao) - ordem.indexOf(y.refeicao));

  if (melhorNaJanela) {
    return { status: 'ok', itens: itensOrdenados, totais: escolhido.totais, desvioKcal };
  }
  return {
    status: 'fora_da_janela',
    itens: itensOrdenados,
    totais: escolhido.totais,
    desvioKcal,
    nota: 'Com os filtros atuais, o banco de pratos não fechou dentro da janela do objetivo. Sinalizado — nenhum alérgeno foi afrouxado.',
  };
}
