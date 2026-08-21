/**
 * Ponto de entrada do motor determinístico do App Evokorpus.
 *
 * Orquestra: gate de saúde → (se PERMITIR/PISAR/RESTRINGIR) dieta → montagem do cardápio.
 * Postura fail-safe: ROTEAR → nenhum plano é gerado.
 */
export * from './types';
export * from './constants';
export * from './formulas';
export { avaliarGateSaude } from './health-gate';
export { gerarPlanoDieta } from './diet';
export {
  montarCardapioDia,
  type RestricoesUsuario,
  type CardapioDia,
  type CardapioItem,
  type StatusMontagem,
} from './assembler';

// --- Treino (FITT) ---
export * from './treino-types';
export {
  prescreverTreino,
  progredirExercicio,
  estadoInicial,
  estadoAposHistorico,
  precisaDeload,
  aplicarDeload,
  dificuldadesLiberadas,
  feedbackRefinado,
} from './treino';
// --- Mesociclo v2 (DF 2026-07-08) ---
export {
  semanaDoCiclo, alvoDaSemana, rirAlvoDaSemana, estadoDoCiclo, isoMaisDias,
  type EstadoCiclo,
} from './treino-mesociclo';
export type { EventoProgressao, EventoTreino, EventoCalibracao } from './treino';
export { ACAO_RECALIBRADO } from './treino';
export * from './isometricos';
export { avaliarGateTreino } from './treino-gate';
export { montarRotina, locaisPermitidos, type OpcoesSemana } from './treino-montador';

// --- Equipamento (modelo 2 níveis — DF 2026-07-04) ---
export { EQUIPAMENTOS_CASA, ROTULO_EQUIPAMENTO_CASA, exercicioDisponivel } from './equipamento';

// --- Escadas de dificuldade (progressão vertical / hint "sobe de variação") ---
export {
  ESCADAS_DIFICULDADE, escadaComNomes, localizarNaEscada, posicaoNaEscada,
  sugerirProximaVariacao, sugerirVariacaoAnterior, type Degrau, type DegrauComNome,
} from './escadas';

// --- Modificações dos isométricos (B1 — Corpo C da calibração) ---
export {
  MODIFICACOES_ISOMETRICOS, indiceBase, modificacoesDe, temModificacoes,
  type ModificacaoIsometrico,
} from './modificacoes-isometricos';

// --- CAS · núcleo puro (C1, decisão do autor "Escolha A") ---
export {
  canonicalInputHash, decidirPreCommit,
  type ChaveCommit, type ComandoCommit, type SnapshotAtual, type ResultadoCommit, type PreCommit,
} from './cas';
export { FORMULA_DURACAO_VERSION } from './duracao-sessao';

// --- Substituição (F.2) ---
export * from './substituicao-types';
export {
  substituirPrato, substituirExercicio,
  listarSubstituicoesPrato, listarSubstituicoesExercicio,
} from './substituicao';

import { montarCardapioDia, type RestricoesUsuario, type CardapioDia } from './assembler';
import { gerarPlanoDieta } from './diet';
import { avaliarGateSaude } from './health-gate';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina, type OpcoesSemana as OpcoesSemanaMontador } from './treino-montador';
import type { Exercise, Food, Recipe } from '../data/types';
import type { PerfilUsuario, PlanoDieta, ResultadoGate } from './types';
import type {
  PerfilTreino,
  PrescricaoFITT,
  ResultadoGateTreino,
  RotinaSemanal,
} from './treino-types';

export interface ResultadoMotor {
  gate: ResultadoGate;
  /** null quando o gate é ROTEAR (nenhum plano gerado — orienta profissional). */
  plano: PlanoDieta | null;
  /** null quando não há plano ou quando não foram passados pratos para montar. */
  cardapio: CardapioDia | null;
}

/**
 * Executa o pipeline completo de dieta. Função PURA e determinística.
 * `recipes`/`foodsById` são opcionais: sem eles, calcula só o alvo (sem montar cardápio).
 */
export function gerarDieta(
  perfil: PerfilUsuario,
  opcoes?: {
    recipes?: readonly Recipe[];
    foodsById?: ReadonlyMap<string, Food>;
    restricoes?: RestricoesUsuario;
  },
): ResultadoMotor {
  const gate = avaliarGateSaude(perfil);

  if (gate.comportamento === 'ROTEAR') {
    return { gate, plano: null, cardapio: null };
  }

  const plano = gerarPlanoDieta(perfil, gate);

  let cardapio: CardapioDia | null = null;
  if (opcoes?.recipes && opcoes.foodsById) {
    cardapio = montarCardapioDia(
      plano,
      opcoes.recipes,
      opcoes.foodsById,
      opcoes.restricoes ?? { alergenos: [], preferencia: null },
    );
  }

  return { gate, plano, cardapio };
}

export interface ResultadoTreino {
  gate: ResultadoGateTreino;
  /** null quando o gate é ROTEAR (nenhum treino gerado — orienta profissional). */
  prescricao: PrescricaoFITT | null;
  /** null quando não há prescrição ou quando a biblioteca não foi passada. */
  rotina: RotinaSemanal | null;
}

/**
 * Executa o pipeline completo de treino. Função PURA e determinística.
 * `exercises` é opcional: sem ele, devolve só a prescrição FITT (sem montar a rotina).
 */
export function gerarTreino(
  perfil: PerfilTreino,
  opcoes?: {
    exercises?: readonly Exercise[];
    favoritos?: ReadonlySet<string>;
    /** Semana do mesociclo (v2): liga a rampa de volume por grupo no montador. */
    semanaCiclo?: OpcoesSemanaMontador;
  },
): ResultadoTreino {
  const gate = avaliarGateTreino(perfil);

  if (gate.comportamento === 'ROTEAR') {
    return { gate, prescricao: null, rotina: null };
  }

  const prescricao = prescreverTreino(perfil, gate);
  const rotina = opcoes?.exercises
    ? montarRotina(prescricao, perfil, opcoes.exercises, opcoes.favoritos, opcoes.semanaCiclo)
    : null;

  return { gate, prescricao, rotina };
}

// --- Rampa de retomada (Leva 2 · Bloco 3, DF 2026-07-27) ---
export {
  estadoRetomada, faixaDaPausa, volumeDaRetomada, irvComCarga, irvRespeitaTeto,
  seriesMaxComCarga, seriesMaxSemCarga, tetoSeriesDaRetomada, freqMaxPorGrupo,
  descansoMinimoSeg, naJanelaFit, rirAlvoDaRetomada, aplicarRetomada, metaCardioDaRetomada,
  type EstadoRetomada, type FaixaRetomada,
} from './treino-retomada';
