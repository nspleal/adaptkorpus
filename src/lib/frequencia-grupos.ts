/**
 * Frequência por grupo muscular (Leva 2 · Bloco 2, DF 2026-07-26/27).
 *
 * Era o pedido nº 8 do beta, esclarecido: o testador quer **quantas vezes cada grupo
 * muscular foi treinado**. 🔒 É AGREGAÇÃO sobre dado que já existe (`grupoPrimario` nos 163
 * exercícios + o histórico de sessões) — não há coleta nova. PURO e determinístico:
 * `hojeISO` entra por parâmetro.
 *
 * 🔴 As 4 CORREÇÕES OBRIGATÓRIAS do cofre estão codificadas aqui. Todas têm a mesma
 * assinatura: sem elas a tela diria "abaixo da referência" para quem fez exatamente o que
 * o motor mandou — numa feature cujo valor inteiro é dar significado a um número.
 *   1. a régua é CONDICIONAL a ≥ 2 dias de força (`reguaDoPadrao` devolve `null` com 1 dia);
 *   2. o padrão `cardio` NÃO usa o 2× — usa o alvo do objetivo;
 *   3. "4 semanas" = as 4 últimas semanas FECHADAS, sem a corrente (`janelaSemanasFechadas`);
 *   4. a régua pertence ao PADRÃO, não ao grupo — e o rótulo diz isso (`ROTULO_REGUA`).
 */
import type { Exercise, GrupoPrimario, PadraoMovimento } from '@/lib/data/types';
import type { Objetivo } from '@/lib/engine';
import { semanaDe } from '@/lib/cardio-semana';

export interface SessaoParaFrequencia {
  dataISO: string;
  tipo?: string;
  exercicios: readonly { id: string }[];
}

/**
 * 🔒 Ordem ANATÔMICA e FIXA — nunca por contagem (ordenar por contagem é o caminho curto
 * para virar ranking). Os 18 valores vêm do CATÁLOGO REAL (`data/exercises.ts`), não da
 * tabela do pacote de design: o cofre registra a procedência e manda que, havendo
 * divergência, **o catálogo mande**. (A tabela do cofre lista obliquos/abdutores/pescoco/
 * serratil, que o catálogo não usa; ele usa core/pernas/corpo-inteiro/cardio.)
 */
export const REGIOES: readonly { titulo: string; grupos: readonly GrupoPrimario[] }[] = [
  { titulo: 'Superior', grupos: ['peito', 'costas', 'ombros', 'trapezio', 'biceps', 'triceps', 'antebraco'] },
  { titulo: 'Tronco', grupos: ['abdomen', 'core', 'lombar'] },
  { titulo: 'Inferior', grupos: ['gluteos', 'quadriceps', 'posterior', 'adutores', 'panturrilha', 'pernas'] },
  { titulo: 'Outros', grupos: ['corpo-inteiro', 'cardio'] },
];

export const GRUPOS_ORDEM: readonly GrupoPrimario[] = REGIOES.flatMap((r) => r.grupos);

export const ROTULO_GRUPO: Record<string, string> = {
  peito: 'Peito', costas: 'Costas', ombros: 'Ombros', trapezio: 'Trapézio', biceps: 'Bíceps',
  triceps: 'Tríceps', antebraco: 'Antebraço', abdomen: 'Abdômen', core: 'Core', lombar: 'Lombar',
  gluteos: 'Glúteos', quadriceps: 'Quadríceps', posterior: 'Posterior', adutores: 'Adutores',
  panturrilha: 'Panturrilhas', pernas: 'Pernas', 'corpo-inteiro': 'Corpo inteiro', cardio: 'Cardio',
};

export const PADROES: readonly PadraoMovimento[] = [
  'empurrar', 'puxar', 'agachar', 'dobradica_quadril', 'core', 'isolado', 'cardio',
];

export const ROTULO_PADRAO: Record<string, string> = {
  empurrar: 'Empurrar', puxar: 'Puxar', agachar: 'Agachar', dobradica_quadril: 'Dobradiça de quadril',
  core: 'Core', isolado: 'Isolado', cardio: 'Cardio',
};

/** 🔒 A referência é ≥ 2× por PADRÃO DE MOVIMENTO (tabela 1.3) — nunca por músculo. */
export const REFERENCIA_PADRAO = 2;
/** 🔒 Correção 4: o rótulo atribui a régua ao PADRÃO, não ao grupo. */
export const ROTULO_REGUA = `${REFERENCIA_PADRAO}× — referência dos padrões`;
/** Escala fixa 0–4× (a marca fica sempre no mesmo ponto; acima disso a barra enche sem estourar). */
export const ESCALA_MAX = 4;

// --- Janelas ------------------------------------------------------------------

export interface Janela { inicioISO: string; fimISO: string }

const DIA_MS = 86_400_000;
const desloca = (iso: string, dias: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);

/** A semana corrente (segunda→domingo). */
export function janelaSemana(hojeISO: string): Janela {
  return semanaDe(hojeISO);
}

/**
 * 🔴 Correção 3: "4 semanas" = as 4 últimas semanas **FECHADAS**, SEM a corrente. Incluir a
 * semana parcial daria 5 baldes com rótulo de 4 e puxaria toda média para baixo —
 * fabricando "abaixo da referência" justamente na leitura que existe para suavizar ruído.
 */
export function janelaSemanasFechadas(hojeISO: string, quantas = 4): Janela {
  const { inicioISO } = semanaDe(hojeISO);
  return { inicioISO: desloca(inicioISO, -7 * quantas), fimISO: desloca(inicioISO, -1) };
}

function naJanela(dataISO: string, j: Janela): boolean {
  return dataISO >= j.inicioISO && dataISO <= j.fimISO;
}

// --- Agregação ----------------------------------------------------------------

/** Entradas que não são treino nenhum (calibração / sinal de fadiga). */
const EVENTOS = new Set(['calibracao', 'sinal_fadiga']);

export interface Contagem {
  /** Sessões de treino consideradas na janela (denominador do "N treinos"). */
  sessoes: number;
  /** Sessões cujos exercícios NÃO puderam ser mapeados a nenhum grupo (registro manual
   *  livre). 🟡 Não entram na contagem, em SILÊNCIO — mas a copy do vazio precisa dizer
   *  por que a Chama conta o dia e esta tela não. */
  semGrupo: number;
  porGrupo: Record<string, number>;
  porPadrao: Record<string, number>;
}

/**
 * 🔒 Conta **1× por SESSÃO** em que o grupo apareceu — não por exercício, não por série.
 * 🔒 Sobre `grupoPrimario`, e só: não há campo de grupo secundário registrado, então a
 * proposta do design de contar o secundário não tem dado em que se apoiar.
 */
export function contarFrequencia(
  sessoes: readonly SessaoParaFrequencia[],
  janela: Janela,
  exercicioPorId: (id: string) => Exercise | undefined,
): Contagem {
  const porGrupo: Record<string, number> = {};
  const porPadrao: Record<string, number> = {};
  let total = 0;
  let semGrupo = 0;

  for (const s of sessoes) {
    if (s.tipo && EVENTOS.has(s.tipo)) continue;
    if (!naJanela(s.dataISO, janela)) continue;
    total += 1;

    const grupos = new Set<string>();
    const padroes = new Set<string>();
    if (s.tipo === 'cardio') {
      // A sessão de cardio não tem exercícios do catálogo — ela É o padrão cardio.
      grupos.add('cardio');
      padroes.add('cardio');
    } else {
      for (const e of s.exercicios) {
        const ex = exercicioPorId(e.id);
        if (!ex) continue;
        grupos.add(ex.grupoPrimario);
        padroes.add(ex.padraoMovimento);
      }
    }
    if (grupos.size === 0) { semGrupo += 1; continue; }
    for (const g of grupos) porGrupo[g] = (porGrupo[g] ?? 0) + 1;
    for (const p of padroes) porPadrao[p] = (porPadrao[p] ?? 0) + 1;
  }
  return { sessoes: total, semGrupo, porGrupo, porPadrao };
}

// --- Régua --------------------------------------------------------------------

export type Regua =
  /** Marca visível em `valor` vezes por semana. */
  | { tipo: 'vezes'; valor: number }
  /** Referência existe, mas é em MINUTOS (cardio saúde/emagrecimento) — sem marca aqui. */
  | { tipo: 'minutos'; alvo: number; max?: number }
  /** Sem régua: não renderizar marcador nem esmaecimento. */
  | null;

/**
 * 🔴 Correção 1: a régua é CONDICIONAL a ≥ 2 dias de força. A invariante do montador é
 * literal — "cada padrão ≥ 2×/semana **quando há ≥ 2 dias**" — e 1 dia de força = full-body
 * com frequência 1× ("mínimo efetivo — honesto"). Com 1 dia agendado a tela inteira
 * nasceria "abaixo" para um plano correto.
 *
 * 🔴 Correção 2: o padrão `cardio` NÃO usa o 2× — usa o alvo do OBJETIVO. Senão o usuário
 * de massa que fez a 1 sessão prescrita apareceria abaixo aqui **e em dia na tela de
 * cardio**, na mesma leva.
 */
export function reguaDoPadrao(args: {
  padrao: PadraoMovimento | string;
  diasForca: number;
  objetivo: Objetivo;
  /** Rampa de retomada ativa → cardio cai para 1 sessão (o piso da faixa). */
  retomadaAtiva?: boolean;
}): Regua {
  if (args.padrao === 'cardio') {
    if (args.retomadaAtiva || args.objetivo === 'massa') return { tipo: 'vezes', valor: 1 };
    return args.objetivo === 'emagrecimento'
      ? { tipo: 'minutos', alvo: 150, max: 300 }
      : { tipo: 'minutos', alvo: 150 };
  }
  return args.diasForca >= 2 ? { tipo: 'vezes', valor: REFERENCIA_PADRAO } : null;
}

/** Legenda que substitui a régua quando há só 1 dia de força agendado. */
export const LEGENDA_UM_DIA = 'com 1 dia por semana, 1× por padrão é o esperado';

/** Média por semana na janela de 4 semanas fechadas, com uma casa decimal. */
export function mediaPorSemana(total: number, semanas: number): number {
  if (semanas <= 0) return 0;
  return Math.round((total / semanas) * 10) / 10;
}

/** "3×" / "2,5×" — a contagem como a tela escreve (vírgula decimal em pt-BR). */
export function rotuloContagem(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}×`;
}
