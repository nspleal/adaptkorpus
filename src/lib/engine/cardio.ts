/**
 * Cardio — MET, classe, kcal líquida e meta semanal (Leva 2 · Bloco 1, DF 2026-07-27).
 *
 * Cofre: `conceitos/parametros-motor-treino-adaptkorpus` §Cardio (spec TRAVADA) +
 * `outputs/pesquisa-cardio-met-2026-07-27` (procedência de cada MET, Compendium of
 * Physical Activities). A tabela 1.1 do motor já prescrevia cardio por objetivo — o app é
 * que não deixava registrar. Este módulo é PURO e determinístico: sem relógio, sem rede.
 *
 * 🔴 O MET é CONSTANTE INTERNA: nunca aparece na interface, nem em tooltip (trava do
 * handoff de design). O que a pessoa vê é a frase do talk test.
 * 🟢 A kcal NUNCA volta para a dieta: alvo de 2000 continua 2000. É informação, não
 * orçamento — é esta condição que sustenta a trava do "fitness honesto".
 */
import type { Objetivo } from './types';

export type ModalidadeCardio = 'caminhada' | 'corrida' | 'bike' | 'pular_corda' | 'lutas' | 'outro';
export type IntensidadeCardio = 'leve' | 'moderado' | 'vigoroso';

export const MODALIDADES_CARDIO: readonly ModalidadeCardio[] =
  ['caminhada', 'corrida', 'bike', 'pular_corda', 'lutas', 'outro'] as const;

export const ROTULO_MODALIDADE: Record<ModalidadeCardio, string> = {
  caminhada: 'Caminhada',
  corrida: 'Corrida/trote',
  bike: 'Bike',
  pular_corda: 'Pular corda',
  lutas: 'Lutas',
  outro: 'Outro',
};

/** Talk test — a intensidade é AUTORRELATADA pela respiração (o app não tem sensor de FC). */
export const ROTULO_INTENSIDADE: Record<IntensidadeCardio, string> = {
  leve: 'Leve',
  moderado: 'Moderado',
  vigoroso: 'Vigoroso',
};
export const DESCRICAO_INTENSIDADE: Record<IntensidadeCardio, string> = {
  leve: 'Consigo conversar normalmente',
  moderado: 'Falo frases de 3 a 5 palavras por respiração',
  vigoroso: 'Poucas palavras antes de precisar respirar',
};

/**
 * MET central por par modalidade × intensidade — 🔒 um número só, nunca faixa
 * (DF 2026-07-26, item 3 modificado pelo autor: "sempre a média entre eles").
 * `pular_corda` NÃO tem "leve" (não há dado); `outro` usa os valores da caminhada,
 * e a tela diz que é aproximação.
 */
export const MET_CARDIO: Record<ModalidadeCardio, Partial<Record<IntensidadeCardio, number>>> = {
  caminhada: { leve: 2.3, moderado: 4.3, vigoroso: 5.8 },
  corrida: { leve: 7.5, moderado: 8.5, vigoroso: 9.3 },
  bike: { leve: 3.8, moderado: 5.5, vigoroso: 7.4 },
  pular_corda: { moderado: 9.0, vigoroso: 11.0 },
  lutas: { leve: 5.3, moderado: 7.5, vigoroso: 10.3 },
  outro: { leve: 2.3, moderado: 4.3, vigoroso: 5.8 },
};

/**
 * 🔒 REGISTRO DE CARDIO UNIFICADO (DF 2026-07-27): o item de cardio da ROTINA, ao ser
 * concluído na sessão guiada, abre ESTE mesmo registro — e este mapa é o "pré-preenchendo o
 * que der". Existe UM único caminho de registro, alcançado de dois lugares: contar duas
 * vezes deixa de ser algo evitado por regra e passa a ser impossível por construção.
 *
 * Só entram os pares em que a modalidade é inequívoca. O resto cai em `outro` de propósito:
 * "Caminhada do fazendeiro" é carregamento com carga, não caminhada (MET 4,3 seria mentira);
 * burpee, polichinelo, escalador e thruster são trabalho intervalado de peso corporal, sem
 * entrada própria na tabela travada. Errar a modalidade é errar o MET, e o MET é a conta.
 */
export const MODALIDADE_POR_EXERCICIO: Readonly<Record<string, ModalidadeCardio>> = {
  e24: 'corrida',      // Corrida na esteira
  e150: 'corrida',     // Corrida no lugar (joelho alto)
  e29: 'bike',         // Bicicleta ergométrica
  e92: 'pular_corda',  // Pular corda
};

/** Modalidade sugerida para um exercício de cardio da rotina (default: `outro`). */
export function modalidadeDoExercicio(exercicioId: string): ModalidadeCardio {
  return MODALIDADE_POR_EXERCICIO[exercicioId] ?? 'outro';
}

/** Intensidades oferecidas por modalidade — "leve" SOME em pular corda, sem erro. */
export function intensidadesDe(modalidade: ModalidadeCardio): IntensidadeCardio[] {
  const tabela = MET_CARDIO[modalidade];
  return (['leve', 'moderado', 'vigoroso'] as const).filter((i) => tabela[i] != null);
}

/** MET do par; `null` quando o par não existe (ex.: pular corda leve). */
export function metDe(modalidade: ModalidadeCardio, intensidade: IntensidadeCardio): number | null {
  return MET_CARDIO[modalidade][intensidade] ?? null;
}

/**
 * 🔴 A CLASSE SAI DO MET, NUNCA DO RÓTULO autorrelatado (correção achada na verificação do
 * cofre): `MET < 3` → não conta · `3 ≤ MET < 6` → 1× · `MET ≥ 6` → 2×. Somar pelo balde
 * autorrelatado subcontaria metade dos minutos de quem faz "corrida leve" (7,5) ou
 * "pular corda moderado" (9,0), que são objetivamente vigorosos.
 */
export function classeDoMet(met: number): 0 | 1 | 2 {
  if (!Number.isFinite(met) || met < 3) return 0;
  return met < 6 ? 1 : 2;
}

/** Minutos que a sessão acrescenta à meta (leve = 0 · 1× = duração · 2× = duração × 2). */
export function minutosNaMeta(met: number, minutos: number): number {
  if (!Number.isFinite(minutos) || minutos <= 0) return 0;
  return Math.round(minutos) * classeDoMet(met);
}

/**
 * Gasto LÍQUIDO (`(MET − 1) × 3,5 × peso × min / 200`) — nunca bruto: o PAL do GET já
 * embute o treino, e mostrar o bruto DUPLICARIA o que a dieta já contou.
 * ⚠️ Altura não entra (a fórmula com altura é a de TMB, outra coisa).
 */
export function kcalLiquida(met: number, pesoKg: number, minutos: number): number {
  if (![met, pesoKg, minutos].every(Number.isFinite) || minutos <= 0 || pesoKg <= 0) return 0;
  return Math.max(0, ((met - 1) * 3.5 * pesoKg * minutos) / 200);
}

/** Piso de exibição da estimativa: abaixo de 10 kcal a tela diz "menos de 10 kcal", NUNCA 0
 *  (uma sessão curta de pessoa leve dá 4 kcal — exibir 0 seria falso). */
export const KCAL_PISO_EXIBICAO = 10;

export type KcalExibida = { piso: true } | { piso: false; kcal: number };

/** Estimativa como a tela mostra: arredondada à DEZENA (número exato sem fingir precisão
 *  de unidade) ou o piso "menos de 10 kcal". A palavra "estimativa" fica na copy. */
export function kcalExibida(kcal: number): KcalExibida {
  if (!Number.isFinite(kcal) || kcal < KCAL_PISO_EXIBICAO) return { piso: true };
  return { piso: false, kcal: Math.round(kcal / 10) * 10 };
}

// --- Meta semanal por objetivo (tabela 1.1) -----------------------------------

export const META_MINUTOS_SAUDE = 150;
export const META_MINUTOS_EMAGRECIMENTO: readonly [number, number] = [150, 300];
export const META_SESSOES_MASSA: readonly [number, number] = [1, 2];

export type MetaCardio =
  /** 🔒 Saúde e emagrecimento em MINUTOS (`max` presente = faixa recomendada). */
  | { tipo: 'minutos'; alvo: number; max?: number }
  /** 🔒 Massa em CONTAGEM DE SESSÕES — o §1.1 define "1–2 sessões" e converter isso em
   *  minutos seria inventar número. */
  | { tipo: 'sessoes'; alvo: number; max?: number };

/**
 * Meta da semana. 🔒 `ROTEAR` → `null`: quem o gate encaminhou a profissional REGISTRA mas
 * NÃO RECEBE META — exibir meta a quem o gate excluiu seria orientação de exercício.
 */
export function metaCardioSemanal(objetivo: Objetivo, roteado: boolean): MetaCardio | null {
  if (roteado) return null;
  if (objetivo === 'massa') return { tipo: 'sessoes', alvo: META_SESSOES_MASSA[0], max: META_SESSOES_MASSA[1] };
  if (objetivo === 'emagrecimento') {
    return { tipo: 'minutos', alvo: META_MINUTOS_EMAGRECIMENTO[0], max: META_MINUTOS_EMAGRECIMENTO[1] };
  }
  return { tipo: 'minutos', alvo: META_MINUTOS_SAUDE };
}

/**
 * Meta escalada pela RAMPA DE RETOMADA — 🔒 "a meta de cardio cai pelo mesmo fator, na
 * mesma semana" (costura do design com a Peça C). Deixar a meta intacta faria quem volta de
 * 60 dias ver o treino cortado pela metade e o app ainda pedindo 150 min. A rampa foi
 * escrita para condicionamento: o cardio é o caso mais literal dela.
 *
 * Massa continua CONTAGEM (nunca vira barra) e cai para o piso da faixa: 1 sessão.
 */
export function metaCardioComRetomada(meta: MetaCardio | null, fator: number | null): MetaCardio | null {
  if (!meta || fator == null || !Number.isFinite(fator) || fator >= 1) return meta;
  if (meta.tipo === 'sessoes') return { tipo: 'sessoes', alvo: Math.max(1, Math.floor(meta.alvo * fator)) };
  return {
    tipo: 'minutos',
    alvo: Math.round(meta.alvo * fator),
    ...(meta.max != null ? { max: Math.round(meta.max * fator) } : {}),
  };
}

// --- Agregação da semana ------------------------------------------------------

export interface RegistroCardio {
  modalidade: ModalidadeCardio;
  intensidade: IntensidadeCardio;
  minutos: number;
  met: number;
  kcal: number;
}

export interface ResumoCardioSemana {
  /** Minutos que contam para a meta (leve = 0, vigoroso em dobro). */
  minutosNaMeta: number;
  /** Sessões que contam para a meta — as de classe ≥ 1 (a leve é movimento registrado). */
  sessoesNaMeta: number;
  /** Estimativa somada da semana (kcal brutas do arredondamento; a exibição arredonda). */
  kcal: number;
  /** Sessões que avançam a meta, na ordem recebida. */
  contam: RegistroCardio[];
  /** 🔒 Atividade LEVE — "movimento registrado", seção própria, SEM enquadrar como falha. */
  leves: RegistroCardio[];
}

/** Agrega uma semana de registros. Pura: quem filtra a janela é o chamador (o relógio
 *  fica na UI, padrão de `semana.ts`). */
export function resumoCardioSemana(registros: readonly RegistroCardio[]): ResumoCardioSemana {
  const contam: RegistroCardio[] = [];
  const leves: RegistroCardio[] = [];
  let min = 0;
  let kcal = 0;
  for (const r of registros) {
    kcal += r.kcal;
    if (classeDoMet(r.met) === 0) { leves.push(r); continue; }
    contam.push(r);
    min += minutosNaMeta(r.met, r.minutos);
  }
  return { minutosNaMeta: min, sessoesNaMeta: contam.length, kcal, contam, leves };
}

/** A meta foi cumprida? (`>=` do alvo — 300 NÃO é teto: passar dele não dispara nada.) */
export function metaCumprida(meta: MetaCardio | null, resumo: ResumoCardioSemana): boolean {
  if (!meta) return false;
  return meta.tipo === 'sessoes' ? resumo.sessoesNaMeta >= meta.alvo : resumo.minutosNaMeta >= meta.alvo;
}
