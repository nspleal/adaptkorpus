import type { ReferenciaDose } from './referencia-dose';
/**
 * Tipos do motor de TREINO (FITT).
 * Fonte: conceitos/parametros-motor-treino-adaptkorpus (DFs travadas 2026-06-28).
 * Roda após o gate de saúde (herdado). Determinístico, sem IA em runtime.
 */
import type { PreferenciasTreino } from './preferencias';
import type { FocoGrupo } from './trilhos';
import type { ModalidadeCardio } from './cardio';
import type { FlagsSaude, Objetivo } from './types';
import type { ResultadoDuracao } from './duracao-sessao';
import type { FatosReducao } from './geracao-temporal';
import type { DistribuicaoCardioSemanal, EntradaDistribuicaoSemana, LinhagemParcela } from './distribuicao-cardio-semana';
import type { EquipamentoCasa, EquipamentoDisp, Exercise, ExecucaoLateralidade, GrupoPrimario, PadraoMovimento } from '../data/types';
import type { Weekday } from '../semana';

/**
 * 🔒 C1 — RESULTADO DA GERAÇÃO TEMPORAL do plano vivo (spec §2/§6), o discriminante que SUBSTITUI o
 * booleano isolado `duracaoIncompativel`. `duracaoIncompativel` continua exposto (compat de UI/teste)
 * mas é DERIVADO deste discriminante — não é mais fonte independente.
 *  - CERTIFICADO: todo dia cabe em B+480 (musculação) após a adaptação;
 *  - NAO_AVALIADO_ENTREGAVEL: algum dia é NAO_AVALIADO — entregue com motivos, nunca certificado;
 *  - ENTREGUE_SEM_CERTIFICACAO: o dia FOI medido e NÃO cabe, e ainda assim é entregue;
 *  - INCOMPATIVEL: nem o menor plano com cobertura coube (MAX > limite operacional);
 *  - ERRO_ALOCADOR: o plano realocado violou um invariante (rede de segurança do alocador vivo).
 *
 * 🔴 D3 (diagnóstico 2026-09-10, §6.4) — por que ENTREGUE_SEM_CERTIFICACAO existe. O plano do
 * editor guiado é *soft* por política declarada: não é reduzido, não perde exercício, não é
 * bloqueado. Só que o terminal do ramo manual olhava apenas `motivosNaoAvaliados` e devolvia
 * CERTIFICADO para um dia que o próprio motor mediu em 9 h 52 contra um orçamento de 1 h —
 * contradição interna no mesmo objeto.
 *
 * 🔒 Nenhum dos três terminais existentes dizia a verdade deste caso: CERTIFICADO afirma que
 * cabe; NAO_AVALIADO_ENTREGAVEL afirma que não foi avaliado (foi); INCOMPATIVEL afirma que nem
 * o menor plano com cobertura coube — capacidade que o caminho manual **nunca mede**, porque
 * por política ele não reduz. Este quarto estado afirma só o que foi medido: entregue, medido,
 * não cabe. `diasAcimaDoLimite` são os índices em `duracaoDias` — a tela aponta o dia sem
 * recalcular nada.
 *
 * 🔴 D12 (auditoria 2026-09-11) — "PODE ULTRAPASSAR" NÃO É "ULTRAPASSOU".
 *
 * O guard de D3 só rebaixava `ACIMA_DO_LIMITE_OPERACIONAL`, e o ramo manual não passa por
 * `precisaReduzir` — que no ramo automático trata `LIMITE_INDETERMINADO` como motivo para
 * REDUZIR. O mesmo estado significava "reduza" num produtor e "certificado" no outro: um dia
 * medido em `min 3840 / max 4200` contra limite `4080` recebia 🟢 *"a duração calculada está
 * dentro dos limites"* enquanto o crítico dizia, na mesma tela, que o dia levava 53 min.
 *
 * 🔒 A condição de certificação passou a ser UMA só, nos dois produtores: `CERTIFICADO` exige
 * todo dia em `DENTRO_DO_LIMITE` ou `DENTRO_DA_TOLERANCIA` (a tolerância de +480 s que já
 * existia segue valendo — ela não é incerteza, é folga medida).
 *
 * ⚠️ `diasPodemUltrapassar` é um campo PRÓPRIO justamente para a frase não mentir:
 * `LIMITE_INDETERMINADO` é `min ≤ limite < max` — o dia pode caber. Reaproveitar
 * `diasAcimaDoLimite` afirmaria excesso onde só há incerteza.
 */
export type ResultadoGeracaoRotina =
  | { tipo: 'CERTIFICADO'; capacidadeTerminal: number }
  | { tipo: 'NAO_AVALIADO_ENTREGAVEL'; motivos: string[]; diasAcimaDoLimite?: number[]; diasPodemUltrapassar?: number[] }
  | { tipo: 'ENTREGUE_SEM_CERTIFICACAO'; diasAcimaDoLimite: number[]; diasPodemUltrapassar?: number[] }
  | { tipo: 'INCOMPATIVEL'; capacidadeMinimaTestada: number }
  | {
      tipo: 'ERRO_ALOCADOR';
      motivo: 'INVARIANTE_VIOLADO' | 'CAPACIDADE_REPETIDA' | 'CARDINALIDADE_ACIMA_DA_CAPACIDADE';
      capacidadeTestada: number;
      violacoesInvariantes: string[];
      cardinalidadeRecebida?: number;
    };

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
 * Guarda o desenho e as escolhas explícitas de séries. Na retomada, o editor também
 * registra uma referência versionada da dose realmente exibida, por dia e exercício.
 * Essa referência conserva os donos das séries entre edições no mesmo contexto;
 * contexto incompatível ou dose acima dos tetos exige novo cálculo pelo motor.
 * Reps, RIR, descanso, rampa e deload continuam sob autoridade do motor.
 */
export interface RotinaCustom {
  /** Sempre `'usuario'` — o campo existe para o plano dizer de onde veio, sem inferência. */
  origem: 'usuario';
  /** `diaId` explícito passou a ser gravado pelo editor. Ausente só em rotina legada; o montador deriva uma vez da agenda e preserva compatibilidade. */
  dias: { nome: string; diaId?: Weekday; exercicioIds: string[]; seriesPorExercicio?: Record<string, number>; referenciaDose?: ReferenciaDose }[];
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
  /** Prioridade de ordem/distribuição; sem delta de séries agregado. */
  focoAgregado?: { grupo: 'bracos' | 'pernas'; semana: number };
  equipamento: EquipamentoDisp;
  /** Checklist de equipamento de CASA (modelo 2 níveis, DF 2026-07-04). Vazio = "nenhum
   *  equipamento" (≡ antigo `nenhum`); ausente = chamada legada (casa antiga = tudo). */
  equipamentosCasa?: EquipamentoCasa[];
  /** Dias por semana que o usuário pode treinar (1–6). */
  diasDisponiveis: number;
  /** Agenda real da semana; ausente só para chamadas legadas que ainda usam a agenda padrão. */
  treinoDias?: readonly Weekday[];
  /** Tempo por sessão em minutos. */
  tempoPorSessaoMin: number;
  /** Ausente em perfis legados: conserva o limite numérico, sem inferir a escolha 75+. */
  limiteTempoTreino?: 'limitado' | 'sem_limite';
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

/**
 * A fase de volume da semana. `normal` = rampa do mesociclo; `deload` = semana 6 (banda de
 * `aplicarDeload`); `retomada` = rampa de volta (alvo de `volumeDaRetomada`, que supersede o
 * mesociclo). Nas duas últimas o volume baixo é a FEATURE, não um déficit.
 */
export type FaseVolume = 'normal' | 'deload' | 'retomada';

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
  /** Explicit manual choice (visual laboratory, author request 2026-09-10). */
  seriesDefinidasPeloUsuario?: boolean;
  /**
   * 🔒 PROCEDÊNCIA: este slot veio do BLOCO ADICIONAL do foco, não do baseline
   * (decisão do autor, 2026-09-16).
   *
   * ⚠️ É marcado pelo montador a partir do próprio `bloco.adicionais` — o mesmo Set que
   * decidiu a adição —, nunca deduzido do grupo nem do nome do exercício. Um exercício de
   * peito do baseline num plano com foco em peito NÃO é extra, e a marca sabe diferenciar.
   *
   * 🔒 Serve a UM uso só: tirar os extras da comparação `puxar ≥ empurrar`, que é um alvo
   * do plano SEM foco (D-03, 15/09). Os extras continuam sujeitos a MRV ponderado, tempo,
   * recuperação, equipamento e a todo o resto — nada aqui os isenta de nenhuma outra regra.
   */
  extraDoFoco?: boolean;
  /** Referência real antes do deload automático, para não reduzir duas vezes ao editar.
   * Metadado do plano entregue; não é um novo campo do desenho persistido. */
  seriesAntesDoDeload?: number;
  /**
   * 🔴 SÉRIES DESTE SLOT ANTES DO CORTE POR TEMPO (2026-09-16) — o que o APP tirou.
   *
   * ⚠️ Existe porque, ao abrir o editor, a dose já cortada é copiada para
   * `seriesPorExercicio` e passa a parecer escolha da pessoa. Sem esta referência, a única
   * saída seria atribuir o corte a ela — ou calar. É metadado do plano ENTREGUE, como
   * `seriesAntesDoDeload`: não vai para o desenho persistido e não é a dose exibida.
   *
   * 🔒 Marcado só na fase A do caminho automático, a partir do que `reduzirDiaPorTempo`
   * de fato executou (E3/E6). Nunca deduzido de uma diferença entre números.
   */
  seriesAntesDoCorteDeTempo?: number;
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
  /**
   * 🔒 C1 — HOLD prescrito (s) do slot ISOMÉTRICO, TRANSPORTADO ao plano final. O avaliador de
   * duração usa ESTE valor; ausente num isométrico ⇒ NAO_AVALIADO (proibido faixaSegundos.min
   * no adaptador). Ausente em não-isométrico é o normal (eles usam a constante de reps).
   */
  holdSeg?: number;
  /**
   * 🔒 C1 — ESCOLHA DE EXECUÇÃO materializada pelo usuário (autor, 2026-08-21). Presente só nos
   * exercícios com `execucoesPermitidas` (ex.: e72 rosca martelo). Preserva a opção do usuário
   * até o slot; o adaptador de duração a honra via `resolverExecucao`. Ausente ⇒ fallback neutro
   * do catálogo (todas as opções permitidas têm o mesmo multiplicador temporal). Nunca DOIS_LADOS.
   */
  execucaoSelecionada?: ExecucaoLateralidade;
}

export interface DiaTreino {
  /** Rótulo do dia (ex.: "Full-body", "Upper", "Push"). */
  nome: string;
  /** Dia real da semana. Um treino de força por dia nesta versão; sessão dupla terá identidade própria futura. */
  diaId?: Weekday;
  slots: SlotExercicio[];
  /**
   * 🔴 Slots que o template pediu e o catálogo disponível não pôde preencher
   * (pedido-casa-dia-curto-2026-08-13). Ausente quando o dia fechou completo. Existe para
   * que o corte seja AUDITÁVEL, não só dito em prosa: é neste número que o guard da grade
   * de casa ancora, e é dele que sai o aviso "seu equipamento disponível limita este dia".
   */
  slotsNaoPreenchidos?: number;
  /**
   * 🔴 D14 — QUAL regra deixou o dia curto, para o dia NÃO ATENDIDO poder dizer o porquê sem
   * a tela reconstruir a causa. Mesmo vocabulário dos dois avisos que o montador já emite.
   */
  motivoDoCorte?: 'EQUIPAMENTO' | 'SELECAO_COMPATIVEL' | 'TETO_SEMANAL';
}

/**
 * 🔴 D14 (auditoria 2026-09-11) — O DIA PEDIDO QUE NÃO VIROU SESSÃO.
 *
 * Medido no snapshot `a40f8af`: `dias[0] = { nome: "Push", slots: [], slotsNaoPreenchidos: 3 }`
 * era contado em `diasForcaAgendados`, recebia `duracaoDias[0] = {CALCULADO, DENTRO_DO_LIMITE,
 * min 0, max 0}` e o plano inteiro saía `CERTIFICADO` 🟢 — um dia de 0 s sustentando o selo de
 * que "cabe nos limites", e uma sessão vazia oferecida para iniciar.
 *
 * 🔒 O dia continua VISÍVEL e o motivo continua DITO (o aviso do motor já nomeava o dia). O que
 * muda é que ele deixa de ser contado como entrega: sai de `dias`, sai de `diasForcaAgendados`
 * e sai da certificação de duração. Nada é redistribuído para preencher — cardio não ocupa o
 * dia, e exercício fora do equipamento declarado continua fora.
 */
/**
 * 🔴 D16 — um grupo abaixo do piso de volume da semana, como FATO. `causa` distingue as duas
 * frases que o motor pode emitir: `catalogo` aponta o equipamento que fecharia a conta (é
 * informação que só o motor tem), `orcamento` é a frase genérica — a que o crítico repete com
 * números. Diferenças legítimas se preservam porque estão no fato, não na prosa.
 */
export interface FatoCoberturaGrupo {
  grupo: GrupoPrimario;
  semana: SemanaCiclo;
  escopo: 'semana';
  metrica: 'series_ponderadas';
  limiar: 'mev';
  alvo: number;
  valor?: number;
  causa: 'catalogo' | 'orcamento';
  /** O texto exato que foi para `rotina.avisos` — a chave de remoção, sem reescrever nada. */
  aviso: string;
}

/**
 * 🔴 O FATO por trás do aviso de invariante de padrão (2026-09-16) — para a tela
 * deduplicar por DADO, nunca por frase. As duas falas são diferentes de propósito: a do
 * motor nomeia o alvo, a do crítico traz os números.
 */
export interface FatoInvariantePadrao {
  invariante: 'puxar_maior_igual_empurrar';
  /** O recorte medido. `baseline` = sem os extras do bloco do foco (D-03, 15/09). */
  escopo: 'baseline';
  puxar: number;
  empurrar: number;
  /** O texto exato que foi para `rotina.avisos` — a chave de remoção, sem reescrever nada. */
  aviso: string;
}

/**
 * 🔴 UM CORTE POR TEMPO, por exercício (2026-09-16) — o que o app reduziu para o dia
 * caber no limite do perfil, com o número de antes e o de agora.
 *
 * 🔒 `para` é lido do plano ENTREGUE, não do momento do corte: se algo depois (a poda do
 * MRV, a remoção de extras) mexeu no mesmo slot, o fato acompanha a dose real. Um fato que
 * não corresponde à dose exibida não é publicado.
 */
export interface FatoCorteTempo {
  diaId?: Weekday;
  exercicioId: string;
  /** Séries antes do corte por tempo. */
  de: number;
  /** Séries entregues — a dose que a tela mostra. */
  para: number;
  /** O limite de tempo por sessão que motivou o corte, em minutos. */
  limiteMin: number;
}

export interface DiaNaoAtendido {
  nome: string;
  diaId?: Weekday;
  /** `DESENHO_VAZIO` = o desenho manual daquele dia ficou sem exercício elegível. */
  motivo: 'EQUIPAMENTO' | 'SELECAO_COMPATIVEL' | 'TETO_SEMANAL' | 'DESENHO_VAZIO';
  /** Quantos slots o template pediu e ninguém pôde preencher (quando o motor mediu). */
  slotsPedidos?: number;
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
  /** Identidade do dia no horizonte canônico C1. Ausente apenas na visão legada sem semana. */
  diaId?: string;
  /** Posição do dia no horizonte canônico. Permite à agenda anexar cardio ao dia exato. */
  ordemNoHorizonte?: number;
  /** Duração exata materializada. `minutos` é somente a projeção de apresentação. */
  duracaoSegundos?: number;
  /** Proveniência das parcelas consolidadas no único bloco do dia. */
  linhagens?: readonly LinhagemParcela[];
}

/** Um dia do plano automático FINAL, depois de redução, distribuição e materialização do cardio. */
export interface PlanoFinalDia {
  diaId: string;
  ordemNoHorizonte: number;
  tipo: 'TREINO' | 'CARDIO' | 'TREINO_E_CARDIO' | 'VAZIO';
  /** Índice em `RotinaSemanal.dias`; ausente em dia sem musculação. */
  treinoIdx?: number;
  /** Bloco contínuo positivo ou item qualitativo explícito (`minutos:null`, duração ausente). */
  cardio?: DiaCardio;
  /** Avaliação canônica do dia inteiro, inclusive cardio materializado. */
  duracao: ResultadoDuracao;
}

export interface RotinaSemanal {
  limiteTempoEstrito?: boolean;
  limiteTempoTreino?: 'limitado' | 'sem_limite';
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
   * 🔴 D16 (auditoria 2026-09-11) — o FATO por trás de cada aviso de cobertura de grupo. Existe
   * para que a apresentação possa decidir se o crítico está dizendo a MESMA coisa comparando
   * grupo, semana, escopo, métrica e limiar — e não comparando frases.
   */
  fatosCobertura?: FatoCoberturaGrupo[];
  /** 🔒 Fatos dos invariantes de padrão emitidos nesta rotina (hoje: puxar ≥ empurrar). */
  fatosInvariantes?: FatoInvariantePadrao[];
  /**
   * 🔒 Os cortes por TEMPO que o app fez neste plano, por exercício. O editor usa isto
   * para explicar a dose que exibe sem atribuir à pessoa um corte automático. Ausente =
   * nenhum corte (ou caminho sem fase A) — e aí a tela não inventa histórico.
   */
  fatosCorteTempo?: FatoCorteTempo[];
  /**
   * 🔴 A FASE DE VOLUME desta semana e a FAIXA que ela realmente aplica (correção 2026-09-15).
   *
   * Existe porque o crítico do editor usava sempre a faixa TERMINAL do mesociclo e dizia
   * "faixa mínima **desta semana**" — o que é falso no deload (a banda é a de `aplicarDeload`)
   * e na retomada (o alvo é `volumeDaRetomada`). Publicar aqui mantém UMA autoridade: a tela
   * lê o que o motor decidiu, em vez de refazer a conta com outro número.
   *
   * 🔒 `faseVolume` também diz quando a AUSÊNCIA de volume é a feature: em `deload` e
   * `retomada` o guard de cobertura do montador já se cala, e o crítico passa a se calar
   * junto — só para o aviso de MÍNIMO. O máximo continua valendo em todas as fases.
   */
  faseVolume?: FaseVolume;
  faixaVolumeSemana?: Faixa;
  /** Comparação da intenção de divisão com o terminal, não com um candidato intermediário. */
  distribuicao?: { planejada: string; recortesPlanejados: number; recortesEntregues: number; limitadaPeloCalendario: boolean; adaptada: boolean; atendida: boolean };
  /**
   * 🔴 D14 — dias da agenda que NÃO viraram sessão. Ausente quando todos foram atendidos.
   * `dias.length + diasNaoAtendidos.length + diasCardioRecuperacao` = agenda SOLICITADA;
   * `dias.length` = entrega EFETIVA. São contas diferentes de propósito.
   */
  diasNaoAtendidos?: DiaNaoAtendido[];
  /**
   * 🔒 B2 — QUAL RAMO DO FOCO AGIU (DF 2026-08-14). A tela DIZ o degrau; trocar o foco e não
   * ver nada é indistinguível de quebrado — foi o que transformou o 1º teste do autor em
   * ambiguidade. Ausente quando não há foco vigente.
   */
  /** Adição automática14/09: entrega concreta, separada da transferência legada.
   *
   * 🔴 Revisão 15/09 — INTENÇÃO × ENTREGA em campos separados. `solicitados` é quanto
   * esta montagem pediu; `adicionais` é o que SOBREVIVEU ao corte temporal. A tela
   * anunciava "2 exercícios adicionais" contando a intenção, inclusive quando o tempo
   * já tinha removido um deles. `adicionais.length < solicitados` ⇒ entrega parcial. */
  blocoFoco?: {
    grupos: GrupoPrimario[];
    solicitados: number;
    adicionais: {diaId?: Weekday; exercicioId: string; series: number}[];
    adaptado: boolean;
  };
  foco?: {
    grupo: GrupoPrimario;
    compensa: GrupoPrimario;
    degrau: 'serie' | 'slot' | 'ordem';
    motivo: 'folga' | 'slot_do_compensador' | 'delta_zero' | 'sem_dia_comum' | 'compensador_no_piso' | 'focado_no_teto' | 'equilibrio_puxar_empurrar' | 'transferencia_nao_realizada';
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
  /** Faixa somente resistida, congelada antes da distribuição; insumo da capacidade de cardio. */
  duracaoResistidaDias?: ResultadoDuracao[];
  /**
   * 🔒 C1 (override do autor 2026-08-20) — nem o menor plano com cobertura coube no tempo: o
   * shortfall é DITO, nunca escondido. DERIVADO de `resultadoGeracao.tipo === 'INCOMPATIVEL'`
   * (não é mais fonte independente — a fonte é o discriminante abaixo).
   */
  duracaoIncompativel?: boolean;
  /**
   * 🔒 C1 (autor 2026-08-21) — discriminante da geração temporal do plano vivo (substitui o booleano
   * isolado). Fonte única do "cabe / não avaliado / incompatível / erro de alocador".
   */
  resultadoGeracao?: ResultadoGeracaoRotina;
  /**
   * 🔒 C1 (autor 2026-08-21) — DISTRIBUIÇÃO SEMANAL DE CARDIO nos dias OFERECIDOS pelo usuário,
   * materializada pela primitiva canônica (`construirDistribuicaoCardioSemana`): contratos por
   * prescrição (prescrito/usado/destinos/descarte) + blocos por dia + hash canônico das entradas
   * (inclusive os dias oferecidos). Não substitui `diasCardio` (visão de UI existente); é a visão
   * C1-canônica, auditável e determinística. Ausente em chamadas sem semana/oferta de cardio.
   */
  distribuicaoCardio?: DistribuicaoCardioSemanal;
  /** Fatos independentes usados pelo crítico para reconstruir e validar a distribuição observada. */
  fatosDistribuicaoCardio?: EntradaDistribuicaoSemana;
  /**
   * 🔴 D4 (2026-09-10) — PLANEJADO, ENTREGUE e FALTANTE da semana de cardio, em segundos.
   *
   * A perda já era medida (`duracaoDescartadaSegundos` por contrato) e nunca virava número
   * legível nem frase: a meta caía abaixo do piso semanal em silêncio, e o cartão do Painel
   * chamava de "prescrito" a soma do ENTREGUE — a barra fechava 123/123 com prescrição de 160.
   *
   * `faltante = max(0, prescrito − entregue)` fecha a conta por construção. O detalhe por
   * prescrição continua em `distribuicaoCardio.contratosPorPrescricao[].duracaoDescartadaSegundos`.
   * Ausente quando a meta não é em minutos (massa) ou nenhum dia foi oferecido.
   */
  cardioSemana?: {
    prescritoSegundos: number;
    entregueSegundos: number;
    faltanteSegundos: number;
  };
  /**
   * 🔒 C1.1-D F19 — diferença factual entre o baseline e o plano terminal: slots removidos,
   * volume e frequência por dias reais. Não decide a política de volume/frequência (C2/C3).
   */
  fatosReducao?: FatosReducao;
  /**
   * Fonte de verdade temporal do plano automático: horizonte terminal após todas as transformações.
   * `dias`, `diasCardio` e `duracaoDias` são vistas de compatibilidade derivadas deste objeto quando
   * a distribuição semanal C1 existe.
   */
  planoFinalPorDia?: PlanoFinalDia[];
}
