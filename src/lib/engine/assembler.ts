/**
 * Montador de cardápio (Bloco B) — v0 determinístico.
 *
 * Fonte: parametros-motor-dieta-evokorpus §"Montador" + motor-de-regras-deterministico.
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
 *     pratos distintos entre os slots, sem escalar porções nem relaxar proteína até o piso.
 *     Busca exaustiva determinística (banco finito; ~160k combinações no pior caso).
 */
import { macrosDePrato } from '../data/nutrition';
import { ESCALA_PORCAO } from './constants';
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

/** Compara candidatos pela ordem de prioridade travada. < 0 ⇒ `a` é melhor. */
function compararCandidatos(a: Candidato, b: Candidato, plano: PlanoDieta): number {
  // 1) Menor desvio calórico (fidelidade calórica primeiro).
  const devA = Math.abs(a.totais.kcal - plano.kcalAlvo);
  const devB = Math.abs(b.totais.kcal - plano.kcalAlvo);
  if (devA !== devB) return devA - devB;

  // 2) Macros secundário: proteína protegida (menor desvio do ponto de proteína).
  const protA = Math.abs(a.totais.proteinaG - plano.macros.proteinaG);
  const protB = Math.abs(b.totais.proteinaG - plano.macros.proteinaG);
  if (protA !== protB) return protA - protB;

  // 3) Chave final reprodutível: ordem lexicográfica sobre o conjunto de ids do dia.
  const chaveA = a.baseItens.map((i) => i.prato.id).sort().join('|');
  const chaveB = b.baseItens.map((i) => i.prato.id).sort().join('|');
  return chaveA < chaveB ? -1 : chaveA > chaveB ? 1 : 0;
}

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

  const macrosCache = new Map<string, RecipeMacros>();
  const macros = (r: Recipe): RecipeMacros => {
    let m = macrosCache.get(r.id);
    if (!m) {
      m = macrosDePrato(r, foodsById);
      macrosCache.set(r.id, m);
    }
    return m;
  };

  const porRefeicao = (ref: Refeicao): Recipe[] =>
    elegiveis.filter((r) => r.refeicoes.includes(ref));

  // "Não curto" (relaxável): por refeição, prefere pratos SEM os alimentos indesejados;
  // se isso esvaziar os candidatos daquela refeição, RELAXA (usa a lista cheia). É
  // preferência de gosto — nunca segurança, e o cardápio precisa fechar. Ordem preservada.
  const evitar = new Set(restricoes.excluirAlimentoIds ?? []);
  const preferir = (lista: Recipe[]): Recipe[] => {
    if (evitar.size === 0) return lista;
    const semIndesejado = lista.filter((r) => !r.itens.some((it) => evitar.has(it.alimentoId)));
    return semIndesejado.length > 0 ? semIndesejado : lista;
  };

  const cafes = preferir(porRefeicao('cafe'));
  const almocos = preferir(porRefeicao('almoco'));
  const jantares = preferir(porRefeicao('jantar'));
  const lanches: (Recipe | null)[] = [null, ...preferir(porRefeicao('lanche'))];

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

  let melhorNaJanela: Candidato | null = null;
  let melhorGeral: Candidato | null = null;

  for (const c of cafes) {
    for (const a of almocos) {
      if (a.id === c.id) continue;
      for (const j of jantares) {
        if (j.id === c.id || j.id === a.id) continue;
        for (const l of lanches) {
          if (l && (l.id === c.id || l.id === a.id || l.id === j.id)) continue;

          const baseItens: PratoBase[] = [
            { refeicao: 'cafe', prato: c, base: macros(c) },
            { refeicao: 'almoco', prato: a, base: macros(a) },
            { refeicao: 'jantar', prato: j, base: macros(j) },
          ];
          if (l) baseItens.push({ refeicao: 'lanche', prato: l, base: macros(l) });

          const totaisBase = somar(...baseItens.map((b) => b.base));
          // Passo 3 — ESCALAR: porção do dia escala para mirar a kcal-alvo (kcal é o alvo
          // mais protegido). Escala única do dia, limitada a faixa realista (ESCALA_PORCAO).
          const escala = totaisBase.kcal > 0
            ? clamp(plano.kcalAlvo / totaisBase.kcal, ESCALA_PORCAO.min, ESCALA_PORCAO.max)
            : ESCALA_PORCAO.max;
          const totais = escalar(totaisBase, escala);
          const cand: Candidato = { baseItens, escala, totais };

          if (!melhorGeral || compararCandidatos(cand, melhorGeral, plano) < 0) {
            melhorGeral = cand;
          }
          const dentro =
            totais.kcal >= plano.janela.minKcal && totais.kcal <= plano.janela.maxKcal;
          if (dentro && (!melhorNaJanela || compararCandidatos(cand, melhorNaJanela, plano) < 0)) {
            melhorNaJanela = cand;
          }
        }
      }
    }
  }

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
