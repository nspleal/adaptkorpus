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
}

export type StatusMontagem = 'ok' | 'fora_da_janela' | 'sem_candidatos';

export interface CardapioItem {
  refeicao: Refeicao;
  prato: Recipe;
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

interface Candidato {
  itens: CardapioItem[];
  totais: RecipeMacros;
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
  const chaveA = a.itens.map((i) => i.prato.id).sort().join('|');
  const chaveB = b.itens.map((i) => i.prato.id).sort().join('|');
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

  const cafes = porRefeicao('cafe');
  const almocos = porRefeicao('almoco');
  const jantares = porRefeicao('jantar');
  const lanches: (Recipe | null)[] = [null, ...porRefeicao('lanche')];

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

          const itens: CardapioItem[] = [
            { refeicao: 'cafe', prato: c },
            { refeicao: 'almoco', prato: a },
            { refeicao: 'jantar', prato: j },
          ];
          if (l) itens.push({ refeicao: 'lanche', prato: l });

          const totais = somar(...itens.map((i) => macros(i.prato)));
          const cand: Candidato = { itens, totais };

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
  const itensOrdenados = escolhido.itens
    .slice()
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
