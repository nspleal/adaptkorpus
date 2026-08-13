/**
 * Tipos do motor de TREINO (FITT).
 * Fonte: conceitos/parametros-motor-treino-evokorpus (DFs travadas 2026-06-28).
 * Roda após o gate de saúde (herdado). Determinístico, sem IA em runtime.
 */
import type { PreferenciasTreino } from './preferencias';
import type { FocoGrupo } from './trilhos';
import type { ModalidadeCardio } from './cardio';
import type { FlagsSaude, Objetivo } from './types';
import type { EquipamentoCasa, EquipamentoDisp, Exercise, PadraoMovimento } from '../data/types';

export type NivelExperiencia = 'iniciante' | 'intermediario' | 'avancado';

/**
 * 🎛️ v4 · DF③ (2026-08-12) — a divisão de treino como ESCOLHA do usuário:
 *  · `auto` (default) — o padrão por dias disponíveis (o comportamento de sempre);
 *  · `superior-inferior` — força Sup/Inf onde os dias permitirem;
 *  · `prioridades` — divisão por prioridades (ex.: dia de braços completo).
 * Ausente ≡ `auto`.
 */
export type DivisaoPreferida = 'auto' | 'superior-inferior' | 'prioridades';

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
  /**
   * 🎛️ v3 · Bloco A — preferências de treino, lidas pelo montador como ENTRADA.
   * Opcional: ausente = comportamento anterior, byte a byte.
   */
  preferencias?: PreferenciasTreino;
  /**
   * 🎛️ v3 · Bloco B — o GRUPO EM FOCO (pedido nº 4 do beta). Vive no perfil, como as
   * preferências: é entrada do gerador, não remendo na saída.
   */
  foco?: FocoGrupo;
  equipamento: EquipamentoDisp;
  /** Checklist de equipamento de CASA (modelo 2 níveis, DF 2026-07-04). Vazio = "nenhum
   *  equipamento" (≡ antigo `nenhum`); ausente = chamada legada (casa antiga = tudo). */
  equipamentosCasa?: EquipamentoCasa[];
  /** Dias por semana que o usuário pode treinar (1–6). */
  diasDisponiveis: number;
  /** Tempo por sessão em minutos. */
  tempoPorSessaoMin: number;
  /** 🎛️ v4 · DF③ — divisão preferida. Ausente = `auto` (padrão por dias disponíveis). */
  divisaoPreferida?: DivisaoPreferida;
  /**
   * Modo força (preset opt-in, v2 — cofre parametros-motor-treino §"v2 — decisões travadas",
   * DF 2026-07-08): alvo FIXO de 6 reps nos compostos com carga, progride só por carga (→ 6RM).
   * Só intermediário/avançado — para iniciante o flag é IGNORADO (RIR ≥ 2 intacto).
   */
  modoForca?: boolean;
}

// --- Mesociclo (v2 — DF 2026-07-08) -----------------------------------------

/** Semana do mesociclo: 1–5 = rampa de volume; 6 = deload (semana de alívio). */
export type SemanaCiclo = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Sinal agregado de feedback por grupo muscular (v2 §6): 'segura' = o grupo acumulou
 * "difícil" recente e NÃO recebe o incremento da semana (alvo = semana anterior).
 */
export type FeedbackGrupo = 'ok' | 'segura';

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
  /** Modo força ativo (v2): compostos travados em 6 reps, progressão só por carga. */
  modoForca?: true;
  /** RIR-alvo da semana do ciclo (v2 §3: rampa 3→1). Ausente = prescrição fora do ciclo. */
  rirAlvoSemana?: number;
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
  /**
   * Séries planejadas pela RAMPA da semana do mesociclo (v2 §1). Ausente = chamada v1
   * (a UI usa o min da prescrição / estado da progressão).
   */
  series?: number;
  /**
   * 🔒 Descanso entre séries DESTE exercício, em segundos (cofre §🕐, DF 2026-07-31).
   *
   * Ausente = chamada v1 (sem `semanaCiclo`), em que a UI ainda cai na faixa da prescrição.
   * Quando presente, é o valor FINAL — já com a classe do exercício, o deslocamento pelo
   * RIR-alvo, o piso do FIT da rampa e a degradação por orçamento de tempo aplicados. A UI
   * **exibe, não recalcula**: a média `round((min+max)/2)` que ela fazia matava o
   * deslocamento em silêncio.
   */
  descansoSeg?: number;
}

export interface DiaTreino {
  /** Rótulo do dia (ex.: "Full-body", "Upper", "Push"). */
  nome: string;
  slots: SlotExercicio[];
}

/**
 * 🔴 O DIA EXCEDENTE, EMITIDO (Leva própria do 3.4, 2026-08-01). Um item de cardio: a
 * MODALIDADE (default caminhada) e a duração do dia. `minutos: null` = meta em sessões
 * (massa), em que dizer um número seria inventar o que a spec não dá.
 *
 * ⚠️ Por que MODALIDADE e não exercício da biblioteca: **não existe "Caminhada" no
 * catálogo.** Os 14 de `padrao: 'cardio'` não incluem a modalidade default — o `e109`
 * "Caminhada do fazendeiro" é carregamento com carga, e o próprio `cardio.ts` o exclui de
 * propósito. Emitir um exercício obrigaria o montador a escolher algo que NÃO é o default;
 * a modalidade é também o vocabulário que o registro unificado consome.
 */
export interface DiaCardio {
  nome: string;
  padrao: 'cardio';
  modalidade: ModalidadeCardio;
  /** Duração do dia, já dividida e arredondada. `null` = meta em sessões (massa). */
  minutos: number | null;
}

export interface RotinaSemanal {
  diasForcaAgendados: number;
  diasCardioRecuperacao: number;
  split: string;
  dias: DiaTreino[];
  /**
   * 🔒 ARRAY PRÓPRIO, nunca dentro de `dias` — e isso é o que torna dois dos três guards
   * IMPOSSÍVEIS por construção, em vez de vigiados:
   *  · `iniciarSessaoGuiada(idx)` indexa `dias`; não existindo índice de cardio ali, a
   *    telemetria `sessao_iniciada` não tem como disparar para cardio (guard ②);
   *  · `concluirSessao` nunca recebe um dia de cardio, então nada entra no balde de
   *    `sessoesResistidas` e o relógio do mesociclo não se move (guard ③).
   * Misturar os dois arrays devolveria as duas travas para o campo do cuidado.
   */
  diasCardio: DiaCardio[];
  cardio: CardioPrescricao;
  avisos: string[];
  /** Metadados do mesociclo (v2) — ausente em chamadas v1 (sem semana). */
  semana?: {
    numero: SemanaCiclo;
    deload: boolean;
    /** Descanso do composto EFETIVO da rotina (teto ~180 s quando o tempo permite — v2 §5). */
    descansoCompostoSeg: Faixa;
  };
}
