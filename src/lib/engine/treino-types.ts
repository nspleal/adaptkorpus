/**
 * Tipos do motor de TREINO (FITT).
 * Fonte: conceitos/parametros-motor-treino-evokorpus (DFs travadas 2026-06-28).
 * Roda após o gate de saúde (herdado). Determinístico, sem IA em runtime.
 */
import type { PreferenciasTreino } from './preferencias';
import type { FocoGrupo } from './trilhos';
import type { ModalidadeCardio } from './cardio';
import type { FlagsSaude, Objetivo } from './types';
import type { ResultadoDuracao } from './duracao-sessao';
import type { EquipamentoCasa, EquipamentoDisp, Exercise, GrupoPrimario, PadraoMovimento } from '../data/types';

export type NivelExperiencia = 'iniciante' | 'intermediario' | 'avancado';

/**
 * 🎛️ v4 · DF③ (2026-08-12) — a divisão de treino como ESCOLHA do usuário:
 *  · `auto` (default) — o padrão por dias disponíveis (o comportamento de sempre);
 *  · `superior-inferior` — força Sup/Inf onde os dias permitirem;
 *  · `prioridades` — divisão por prioridades (ex.: dia de braços completo).
 * Ausente ≡ `auto`.
 */
export type DivisaoPreferida = 'auto' | 'superior-inferior' | 'prioridades';

/**
 * 🧭 A ROTINA MONTADA PELO USUÁRIO (editor guiado — DF② de 2026-08-13).
 *
 * 🔒 Guarda **só o desenho**: quais exercícios, em que dia, em que ordem. Séries, reps,
 * RIR, descanso, rampa e deload continuam do MOTOR — literal do autor: *"igual ao motor
 * normal, a única diferença é que foi o usuário que fez o treino"*. Guardar o plano inteiro
 * congelaria a pessoa fora de todo conserto futuro do motor (a lição do v3 · Bloco A:
 * *override não é só uma segunda verdade — é segunda verdade que envelhece sozinha*).
 *
 * 🔑 É por isso que ela cabe em ~380 bytes (medido, 6 dias × 7 slots) contra ~18 KB do
 * plano serializado: o que se persiste é a DECISÃO, não o resultado dela.
 */
export interface RotinaCustom {
  /** Sempre `'usuario'` — o campo existe para o plano dizer de onde veio, sem inferência. */
  origem: 'usuario';
  dias: { nome: string; exercicioIds: string[] }[];
}

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
   * 🧭 Editor guiado — o desenho do usuário. Ausente = o gerador monta (comportamento de
   * sempre, byte a byte). Presente = o montador usa ESTES exercícios e o resto do pipeline
   * (descanso, foco, rampa, retomada, avisos) roda **sem ramo especial**.
   */
  rotinaCustom?: RotinaCustom;
  /**
   * Modo força (preset opt-in, v2 — cofre parametros-motor-treino §"v2 — decisões travadas",
   * DF 2026-07-08): alvo FIXO de 6 reps nos compostos com carga, progride só por carga (→ 6RM).
   * Só intermediário/avançado — para iniciante o flag é IGNORADO (RIR ≥ 2 intacto).
   */
  modoForca?: boolean;
  /**
   * 🏃 C2 — modalidade preferida de cardio (DF: a spec já previa modalidade escolhida; o
   * campo faltava). Ausente = `MODALIDADE_PADRAO_DIA` (caminhada), o default de sempre.
   */
  cardioFavorito?: ModalidadeCardio;
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
  /**
   * 🔴 Slots que o template pediu e o catálogo disponível não pôde preencher
   * (pedido-casa-dia-curto-2026-08-13). Ausente quando o dia fechou completo. Existe para
   * que o corte seja AUDITÁVEL, não só dito em prosa: é neste número que o guard da grade
   * de casa ancora, e é dele que sai o aviso "seu equipamento disponível limita este dia".
   */
  slotsNaoPreenchidos?: number;
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
  /**
   * 🔒 B2 — QUAL RAMO DO FOCO AGIU (DF 2026-08-14). A tela DIZ o degrau; trocar o foco e não
   * ver nada é indistinguível de quebrado — foi o que transformou o 1º teste do autor em
   * ambiguidade. Ausente quando não há foco vigente.
   */
  foco?: {
    grupo: GrupoPrimario;
    compensa: GrupoPrimario;
    degrau: 'serie' | 'slot' | 'ordem';
    motivo: 'folga' | 'slot_do_compensador' | 'delta_zero' | 'sem_dia_comum' | 'compensador_no_piso' | 'focado_no_teto';
    /** Séries que mudaram de mão (0 no degrau `ordem`). */
    series: number;
  };
  /** Metadados do mesociclo (v2) — ausente em chamadas v1 (sem semana). */
  semana?: {
    numero: SemanaCiclo;
    deload: boolean;
    /** Descanso do composto EFETIVO da rotina (teto ~180 s quando o tempo permite — v2 §5). */
    descansoCompostoSeg: Faixa;
  };
  /**
   * 🔒 C1 — CERTIFICAÇÃO de duração do plano gerado, uma entrada por dia de força, pela fórmula
   * canônica (`avaliarDuracaoSessao`). A autoridade sobre "cabe no tempo?" é ESTA, não a tabela
   * de slots. Ausente em chamadas v1 sem séries/descanso materializados. Apresentação = C4.
   */
  duracaoDias?: ResultadoDuracao[];
  /**
   * 🔒 C1 (override do autor 2026-08-20) — nem o menor plano com cobertura coube no tempo: o
   * shortfall é DITO, nunca escondido. O motor não emite o plano excedente como se fosse conforme.
   */
  duracaoIncompativel?: boolean;
}
