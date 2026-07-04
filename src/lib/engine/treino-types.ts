/**
 * Tipos do motor de TREINO (FITT).
 * Fonte: conceitos/parametros-motor-treino-evokorpus (DFs travadas 2026-06-28).
 * Roda após o gate de saúde (herdado). Determinístico, sem IA em runtime.
 */
import type { FlagsSaude, Objetivo } from './types';
import type { EquipamentoDisp, Exercise, PadraoMovimento } from '../data/types';

export type NivelExperiencia = 'iniciante' | 'intermediario' | 'avancado';

/** Vocabulário do gate de treino (sem PISAR — esse é só da dieta). */
export type ComportamentoTreino = 'ROTEAR' | 'RESTRINGIR' | 'PERMITIR';

/** Entrada do motor de treino (após autenticação + consentimento). */
export interface PerfilTreino {
  // Entradas de triagem (gate herdado):
  pesoKg: number;
  alturaCm: number;
  idade: number;
  flagsSaude: FlagsSaude;
  // Entradas do motor de treino:
  objetivo: Objetivo;
  nivelExperiencia: NivelExperiencia;
  equipamento: EquipamentoDisp;
  /** Dias por semana que o usuário pode treinar (1–6). */
  diasDisponiveis: number;
  /** Tempo por sessão em minutos. */
  tempoPorSessaoMin: number;
}

export interface ResultadoGateTreino {
  comportamento: ComportamentoTreino;
  /** RESTRINGIR redireciona emagrecimento → 'saude' (treino conservador). */
  objetivoEfetivo: Objetivo;
  motivos: string[];
  avisos: string[];
  derivados: { imc: number };
}

export interface Faixa {
  min: number;
  max: number;
}

/** Prescrição de cardio (depende do objetivo). */
export type CardioPrescricao =
  | { tipo: 'minutos_semana'; min: number; max: number }
  | { tipo: 'sessoes_moderadas'; min: number; max: number };

/** Prescrição FITT consolidada (já com trilhos de segurança aplicados). */
export interface PrescricaoFITT {
  objetivoEfetivo: Objetivo;
  nivel: NivelExperiencia;
  repsComposto: Faixa;
  repsIsolado: Faixa;
  /** RIR-alvo já com o piso do iniciante aplicado. */
  rir: Faixa;
  descansoCompostoSeg: Faixa;
  descansoIsoladoSeg: Faixa;
  seriesPorExercicio: Faixa;
  /** Séries efetivas por grupo muscular por semana. */
  volumePorGrupoSemana: Faixa;
  /** Frequência mínima por grupo (cai p/ 1 só com 1 dia). */
  freqPorGrupoMin: number;
  /** Teto/alvo de sessões de força do nível. */
  sessoesForcaSemana: Faixa;
  cardio: CardioPrescricao;
  /** Iniciante nunca treina até a falha. */
  semFalhaIniciante: boolean;
  /** Piso de reps com carga (faixas começam em 6; nunca < 5). */
  pisoRepsComCarga: number;
}

// --- Progressão (dupla progressão dirigida por feedback) ---------------------

export type Feedback = 'facil' | 'na_medida' | 'dificil';
export type ModoCarga = 'carga' | 'peso_corporal';

export interface EstadoExercicio {
  exercicioId: string;
  modo: ModoCarga;
  series: number;
  /** Reps-alvo atual (dentro da faixa). */
  repsAlvo: number;
  /** Só no modo 'carga'. */
  cargaKg?: number;
  /** Só no modo 'peso_corporal': degrau de dificuldade na escada da biblioteca. */
  variacaoNivel?: number;
  rirAlvo: number;
  /** "difícil" consecutivos no mesmo exercício. */
  dificeisSeguidos: number;
}

export interface AcaoProgressao {
  /** Descrição legível da ação tomada. */
  acao: string;
  proximo: EstadoExercicio;
  /** true se a ação foi pausar o movimento por dor/lesão (re-check de runtime). */
  pausadoPorDor?: boolean;
  aviso?: string;
}

// --- Montador de rotina ------------------------------------------------------

export interface SlotExercicio {
  padrao: PadraoMovimento;
  exercicio: Exercise;
  /** true quando o exercício é FAVORITO do usuário e entrou no plano (badge "Favorito" —
   *  B5, DF 2026-07-04: acende para todo favorito que entrou no plano). */
  incluidoPorPreferencia?: boolean;
}

export interface DiaTreino {
  /** Rótulo do dia (ex.: "Full-body", "Upper", "Push"). */
  nome: string;
  slots: SlotExercicio[];
}

export interface RotinaSemanal {
  diasForcaAgendados: number;
  diasCardioRecuperacao: number;
  split: string;
  dias: DiaTreino[];
  cardio: CardioPrescricao;
  avisos: string[];
}
