/**
 * Montador de rotina de treino — v4: ALOCADOR POR VOLUME (leva B do
 * handoff-motor-volume-v4-2026-08-12; substitui o alocador por lista de padrões do v1).
 *
 * Fonte: parametros-motor-treino-evokorpus §"Passo 3" + §1.2 (bandas de volume) + DFs
 * ①②③ de 2026-08-12 (contagem ponderada · cobertura · divisões).
 *
 * Garantias (travadas na spec):
 *  - dias de força = min(dias_disponíveis, teto do nível); excedente → cardio/recuperação;
 *  - slots do dia = orçamento de TEMPO (`orcamentoSlotsDoDia`); cada slot vai ao grupo com
 *    maior DÉFICIT PONDERADO do template do dia (`alocarSemana`);
 *  - puxar ≥ empurrar (saúde do ombro); dobradiça presente; core 2–3×/semana;
 *  - pequenos com ≥ 1 exercício direto/semana (DF②); lombar/antebraço só por indireto;
 *  - seleção respeita equipamento/local + dificuldade liberada + banimentos/trocas (v3);
 *  - as SÉRIES continuam vindo da rampa do mesociclo (`alvoDaSemana`) — o alocador muda
 *    onde elas moram, não a progressão (armadilha 7 do handoff);
 *  - determinístico (ordena por tier↑ depois id; rotaciona por grupo p/ variar).
 */
import { dificuldadesLiberadas } from './treino';
import { exercicioDisponivel } from './equipamento';
import { alvoDaSemana } from './treino-mesociclo';
import { freqMaxPorGrupo, tetoSeriesDaRetomada, volumeDaRetomada } from './treino-retomada';
import { temCarga } from './equipamento';
import { DESCANSO_PISO_DURO_SEG, descansoDoExercicio, descansoDoPadrao } from './descanso';
import { rirAlvoDaSemana } from './treino-mesociclo';
import { preferenciasEfetivas, type PreferenciasTreino } from './preferencias';
import { aplicarFoco, aplicarFocoCore, compensadoresPossiveis, decidirFoco, focoVigente, mev, ordenarComFoco, tetoSeriesGrupoNaSessao, type DecisaoFoco } from './trilhos';
import { alocarSemana, creditoPonderadoDaSemana, GRUPOS_GRANDES, GRUPOS_PEQUENOS_PISO, orcamentoSlotsDoDia, PEQUENOS_PISO_DIRETO, PEQUENOS_TETO_DIRETO, PEQUENOS_TETO_DIRETO_PRIORIDADES, templatesDaSemana } from './alocador';
import { classificarCoberturaCatalogo, mensagemCoberturaCatalogo } from './cobertura-teto';
import { avaliarDuracaoSessao, FORMULA_DURACAO_VERSION } from './duracao-sessao';
import { avaliarDuracaoResistida, execucaoResistidaDe } from './duracao-plano';
import { distribuirCardioDaRotina } from './treino-cardio-semana';
import { avaliarInvariantes, type Padrao } from './geracao-temporal';
import { TEMPO_EXECUCAO_SERIE_REPS_SEG } from './duracao-sessao';
import { faixaSegundos, repUnitDe } from './isometricos';
import { duracaoDoDiaDeCardio, MODALIDADE_PADRAO_DIA } from './dia-de-cardio';
import type { ModalidadeCardio } from './cardio';
import { DESCANSO_COMPOSTO_TETO_SEG } from './treino-constants';
import type { DiaCardio, Faixa, FeedbackGrupo, NivelExperiencia, PerfilTreino, PrescricaoFITT, DiaTreino, ResultadoGeracaoRotina, RotinaSemanal, SemanaCiclo, SlotExercicio } from './treino-types';
import type { EquipamentoDisp, Exercise, ExecucaoLateralidade, GrupoPrimario, LocalExercicio, PadraoMovimento } from '../data/types';
import { resolverExecucao } from '../data/lateralidade';

/** Locais acessíveis por disponibilidade de equipamento. */
export function locaisPermitidos(equip: EquipamentoDisp): LocalExercicio[] {
  if (equip === 'nenhum') return ['casa_sem'];
  if (equip === 'casa') return ['casa_sem', 'casa_com'];
  return ['casa_sem', 'casa_com', 'academia'];
}

/** Core: invariante 2–3×/semana (travado na spec). */
const CORE_MIN = 2;
const CORE_MAX = 3;

/**
 * Semana do mesociclo passada ao montador (v2 — DF 2026-07-08): dirige a RAMPA de volume
 * por grupo (séries por slot) e o descanso efetivo do composto. Ausente = comportamento v1.
 */
export interface OpcoesSemana {
  semana: SemanaCiclo;
  /** Feedback agregado por grupo muscular (v2 §6): 'segura' congela o incremento do grupo. */
  feedbackGrupos?: ReadonlyMap<GrupoPrimario, FeedbackGrupo>;
  /**
   * Rampa de RETOMADA ativa (Leva 2, Bloco 3). Quando presente, ela SUPERSEDE a rampa do
   * mesociclo: o volume por grupo passa a ser `volumeReferencia × fator`, que pode (e deve)
   * cair ABAIXO do piso da banda — o estado que o motor não tinha.
   */
  retomada?: {
    /** Semana da rampa (1-based). */
    semana: number;
    fator: number;
    /** Volume-alvo da última semana efetivamente treinada. */
    volumeReferencia: number;
    /**
     * B5 SUSPENSA (§9 das lacunas): exercícios que a pessoa já executava. O efeito protetor
     * da sessão repetida é específico do exercício — rotacionar na volta remove justamente
     * a proteção. Reusa o trilho de isenção dos favoritos.
     */
    exerciciosRecentes?: ReadonlySet<string>;
  };
  /**
   * 🔒 C1 — usado APENAS pela recursão interna do reduce-to-fit (override do autor 2026-08-20):
   * substitui o teto de slots por dia da tabela `orcamentoSlotsDoDia`. Presente ⇒ é uma
   * tentativa de redução (não re-reduz, evita recursão infinita). Não faz parte da API pública.
   */
  budgetSlotsOverride?: number;
}

/**
 * 🔴 OS DIAS EXCEDENTES VIRAM DIAS DE CARDIO (spec §🏃, leva própria de 2026-08-01).
 *
 * O Passo 3 sempre mandou "dias excedentes → cardio/recuperação"; o motor CONTAVA os dias e
 * não construía nada, e era isso que mantinha a entrada unificada de cardio dormente desde
 * a Leva 2.
 *
 * 🔒 Só regra travada, recombinada — nenhum número novo entra por esta porta:
 *  · duração = **meta semanal ÷ nº de dias excedentes**, arredondada ao múltiplo de 5 mais
 *    próximo com **empate para CIMA** (150 ÷ 4 = 37,5 → 40), e **limitada a 90 min/dia**;
 *  · **emagrecimento usa o PISO da faixa** (`min`), nunca o teto — 150 ÷ 3 = 50 min/dia
 *    contra 300 ÷ 3 = 100, fator 2 sem base;
 *  · **massa é meta em SESSÕES**: `minutos: null`, porque dizer um número seria inventar.
 *
 * ⚠️ A virada "batidas as sessões → recuperação" NÃO mora aqui: depende de quantas sessões
 * de cardio a pessoa já registrou nesta semana, e o montador é PURO — não vê histórico.
 * Ela vive onde o histórico está (`conteudoDoDiaExcedente`, chamado pelo Painel).
 */
function montarDiasCardio(quantos: number, meta: PrescricaoFITT['cardio'], modalidade: ModalidadeCardio = MODALIDADE_PADRAO_DIA): DiaCardio[] {
  if (quantos < 1) return [];
  // 🔒 O PISO da faixa é o alvo (`min`), e é o mesmo número que `metaCardioSemanal` usa.
  // 🔒 A MESMA função do conteúdo do dia: divide, arredonda (empate p/ cima) e aplica o
  // teto de 90. Dividir aqui por conta própria faria o teto valer num caminho e não no outro.
  const minutos = meta.tipo === 'minutos_semana' ? duracaoDoDiaDeCardio(meta.min, quantos) : null;
  return Array.from({ length: quantos }, (_, i) => ({
    nome: quantos > 1 ? `Cardio ${i + 1}` : 'Cardio',
    padrao: 'cardio' as const,
    modalidade,
    minutos: minutos != null && minutos > 0 ? minutos : null,
  }));
}

/**
 * 🔒 C1 — piso de slots por dia da tabela `orcamentoSlotsDoDia` (o degrau ≤20 min). Abaixo
 * disto a cobertura (core, puxar≥empurrar, dobradiça) não se sustenta; é o "menor plano com
 * cobertura" do override 2. Se nem ele couber, o motor devolve incompatibilidade estruturada.
 */
const BUDGET_MIN_COBERTURA = 3;

/** 🔒 C1 §6 — um dia estoura o LIMITE OPERACIONAL (B+480) mesmo com o descanso no piso? */
export function precisaReduzir(rotina: RotinaSemanal, nivel: NivelExperiencia, orcamentoSeg: number): boolean {
  return rotina.dias.some((d) => {
    const r = avaliarDuracaoResistida(d.slots, nivel, orcamentoSeg);
    return r.estadoCalculo === 'CALCULADO'
      && (r.estadoLimite === 'ACIMA_DO_LIMITE_OPERACIONAL' || r.estadoLimite === 'LIMITE_INDETERMINADO');
  });
}

/** 🔒 C1 §5.5 — anexa a certificação canônica por dia ao plano final (autoridade do "cabe?"). */
function certificarDuracao(rotina: RotinaSemanal, nivel: NivelExperiencia, orcamentoSeg: number): RotinaSemanal {
  return { ...rotina, duracaoDias: rotina.dias.map((d) => avaliarDuracaoResistida(d.slots, nivel, orcamentoSeg)) };
}

/**
 * Monta a rotina semanal. Função PURA e determinística.
 */
export function montarRotina(
  prescricao: PrescricaoFITT,
  perfil: PerfilTreino,
  exercises: readonly Exercise[],
  /**
   * Exercícios FAVORITOS do usuário (DF #12, 2026-07-04): preferidos no slot cujo grupo
   * servem e ISENTOS da variedade B5 — aparecem em toda sessão em que couberem. Respeitam
   * os filtros duros (equipamento + dificuldade — favoritar NÃO fura o nível: acima do
   * liberado nem entra no pool), nunca furam as invariantes e não adicionam slot.
   */
  favoritos: ReadonlySet<string> = new Set(),
  semanaCiclo?: OpcoesSemana,
  /**
   * 🎛️ v3 · Bloco A — as preferências da pessoa, COMO ENTRADA (cofre §"A FORMA da edição
   * manual"). Elas entram pelo trilho dos favoritos, que é o único que já sobrevive ao
   * recompute: o preterido/banido sai do pool, o preferido entra como fixo. Nada aqui
   * remenda a saída — por isso a edição sobrevive a reload, virada de semana, rampa,
   * âncora de peso, favorito novo e edição de perfil.
   */
  preferencias: PreferenciasTreino | undefined = perfil.preferencias,
  /**
   * 🔒 C1 — ESCOLHA DE EXECUÇÃO por exercício (autor, 2026-08-21). Materialização da opção do
   * usuário para os exercícios com `execucoesPermitidas` (ex.: e72 rosca martelo: alternado ou
   * simultâneo). Mapa `id → execução escolhida`. Preservada no slot (`execucaoSelecionada`) e
   * honrada pelo adaptador de duração. Ausente ⇒ fallback neutro do catálogo (mesmo multiplicador).
   */
  escolhasExecucao: ReadonlyMap<string, ExecucaoLateralidade> = new Map(),
  /**
   * 🔒 C1 (autor 2026-08-21) — DIAS OFERECIDOS PELO USUÁRIO PARA CARDIO: conjunto ORDENADO de
   * ÍNDICES de dia (0-based no horizonte da semana). É a MENOR fronteira funcional nova — transiente
   * por geração, NÃO uma preferência permanente do perfil. Distinto de `diasDisponiveis` (contagem).
   * Um dia só recebe cardio se foi oferecido E não tem musculação; cardio nunca substitui treino.
   * Entra, em ordem canônica, no `canonical_input_hash` da distribuição.
   */
  diasOferecidosCardio: readonly number[] = [],
): RotinaSemanal {
  const avisos: string[] = [];
  // B5 suspensa na retomada: os exercícios já executados entram no MESMO trilho de isenção
  // dos favoritos (mecanismo existente), para o montador preferi-los em vez de rotacionar.
  const recentes = semanaCiclo?.retomada?.exerciciosRecentes;
  // 🎛️ v3 · Bloco A: revalidadas AQUI, na montagem — equipamento e nível mudam no perfil, e
  // preferência que deixou de caber é ignorada na geração (o plano sai correto) sem ser
  // apagada do perfil: se a pessoa recuperar o equipamento, ela volta a valer sozinha.
  /** 🎛️ v3 · Bloco B — o foco vigente (fora da janela de 4–6 semanas, não existe). */
  const foco = focoVigente(perfil.foco) ? perfil.foco : undefined;
  /**
   * 🔒 Declarados AQUI, antes de qualquer uso: o caminho do editor guiado chama `montarSaida`
   * antes do bloco de alocação, e o pipeline é compartilhado pelos dois produtores.
   * `compensadorValido` = o compensador só vale se DIVIDIR DIA com o focado (perfil herdado
   * cai no degrau ③, com a tela pedindo para reescolher).
   */
  let decisaoFoco: DecisaoFoco | null = null;
  let compensadorValido: GrupoPrimario | null = null;
  const prefs = preferenciasEfetivas(
    { exercises, equipamento: perfil.equipamento, equipamentosCasa: perfil.equipamentosCasa, nivelExperiencia: perfil.nivelExperiencia },
    preferencias,
  );
  const favoritosEfetivos = recentes && recentes.size > 0 || prefs.preferidos.size > 0
    ? new Set<string>([...favoritos, ...(recentes ?? []), ...prefs.preferidos])
    : favoritos;
  /** Fora do pool: banidos ("não quero mais") + preteridos ("prefiro X no lugar deste"). */
  const excluidos = new Set<string>([...prefs.banidos, ...prefs.preteridos]);
  const dias = Math.max(0, Math.floor(perfil.diasDisponiveis));
  const teto = prescricao.sessoesForcaSemana.max;
  const diasForca = dias < 1 ? 0 : Math.min(dias, teto);
  const diasCardioRecuperacao = Math.max(0, dias - diasForca);

  if (diasForca === 0) {
    return { diasForcaAgendados: 0, diasCardioRecuperacao, split: '—', dias: [], diasCardio: montarDiasCardio(diasCardioRecuperacao, prescricao.cardio, perfil.cardioFavorito), cardio: prescricao.cardio, avisos: ['Sem dias disponíveis para treino de força.'] };
  }

  // Pool elegível: equipamento (modelo 2 níveis — checklist de casa) + dificuldade
  // liberada. Ordenado (tier↑, depois id).
  const liberadas = new Set(dificuldadesLiberadas(perfil.nivelExperiencia));
  const pool = exercises
    .filter((e) => !excluidos.has(e.id) && exercicioDisponivel(e, perfil.equipamento, perfil.equipamentosCasa) && liberadas.has(e.nivel))
    .slice()
    .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // ── 🔢 v4 — templates por GRUPO + orçamento de slots por tempo (DFs ①②③) ──
  const divisao = perfil.divisaoPreferida ?? 'auto';
  const { split, dias: templates } = templatesDaSemana(diasForca, perfil.nivelExperiencia, divisao);
  // 🔒 C1 — o teto de slots vem da tabela f(tempo), MAS o reduce-to-fit (override 2) pode pedir
  // menos slots reexecutando o alocador; aí o override manda (nunca acima da tabela).
  const budgetPorDia = Math.min(
    semanaCiclo?.budgetSlotsOverride ?? Number.POSITIVE_INFINITY,
    orcamentoSlotsDoDia(perfil.tempoPorSessaoMin),
  );

  /**
   * Alvo PONDERADO de planejamento por grupo = TOPO da banda do nível/objetivo. O topo, e
   * não o alvo da semana, para a ESTRUTURA ficar estável no ciclo inteiro (mesmos slots,
   * mesmos dias — só as séries rampam; é a mesma razão do sPlan do orçamento de tempo).
   * Lombar/antebraço ficam FORA (DF②: só por indireto — alvo direto seria número inventado).
   */
  const banda = prescricao.volumePorGrupoSemana;
  const alvoPonderado = new Map<GrupoPrimario, number>();
  for (const g of [...GRUPOS_GRANDES, ...GRUPOS_PEQUENOS_PISO, 'core' as GrupoPrimario]) alvoPonderado.set(g, banda.max);
  /**
   * 🎛️ v4 — FOCO COMO BOOST DE DÉFICIT, CONDICIONADO À ENTREGA (handoff B1.6).
   *
   * O boost só existe quando o foco TEM série a entregar nesta semana (`deltaAplicado > 0`
   * do MESMO `aplicarFoco` que decide as séries): aí o grupo focado ganha prioridade de
   * déficit no planejamento (mira `banda.max + delta`) e o slot extra dá espaço para o
   * delta materializar em vez de morrer truncado por `n × sMax` — o defeito medido.
   *
   * 🔴 Quando o delta da semana é ZERO (grupo no MRV — semana 5), o boost NÃO acontece:
   * mover slot sem série a entregar mudaria o volume de OUTROS grupos por truncamento e
   * quebraria o invariante travado "o volume total da semana não cresce; o foco
   * redistribui". Quem está no topo ganha ORDEM, e ordem não mexe em slot.
   * Core fica fora (DF 2026-08-05: mecânica própria, slots intocados por construção).
   */
  /**
   * 🔒 O FOCO NÃO MEXE MAIS NO ALVO DA ALOCAÇÃO (cascata, DF 2026-08-14).
   *
   * O boost de déficit que vivia aqui subia o alvo do focado e o slot extra saía de QUEM
   * TIVESSE menos déficit — medido: `ombros −4 séries, −1 slot` num plano onde o usuário
   * pediu "mais costas, menos peito". A alocação agora roda NEUTRA, e a cascata decide
   * depois, com os números reais na mão (`decidirFoco`): só o par focado ↔ compensador muda.
   */

  /**
   * 🧭 O DESENHO DO USUÁRIO (editor guiado, DF② 2026-08-13) — quando existe, ele SUBSTITUI
   * a alocação e **nada mais muda**: descanso por classe, ordem do foco, rampa de séries,
   * retomada, invariantes e guard de cobertura rodam exatamente como no plano gerado. É o
   * que a DF② pede — *"igual ao motor normal, a única diferença é que foi o usuário que
   * fez o treino"* — e é o que evita um segundo pipeline para manter em dia.
   *
   * 🔒 Os filtros DUROS continuam valendo sobre a escolha do usuário: id fora do pool
   * (banido depois, equipamento perdido, acima do nível) é ignorado na geração e o plano
   * sai correto — o mesmo tratamento que a preferência que "deixou de caber" recebe desde
   * o v3, sem apagar nada do que a pessoa guardou.
   */
  const custom = perfil.rotinaCustom;
  if (custom && custom.dias.length > 0) {
    const porId = new Map(pool.map((e) => [e.id, e]));
    const diasUsuario = custom.dias
      .map((d) => ({
        nome: d.nome,
        slots: d.exercicioIds
          .map((id) => porId.get(id))
          .filter((e): e is Exercise => e != null && e.padraoMovimento !== 'cardio')
          .map((e) => ({
            padrao: e.padraoMovimento,
            exercicio: e,
            ...(favoritos.has(e.id) ? { incluidoPorPreferencia: true } : {}),
          })),
      }))
      .filter((d) => d.slots.length > 0);
    if (diasUsuario.length > 0) {
      // 🔒 O teto de sessões de força do NÍVEL continua valendo (trilho da §1.2). Quando
      // morde, o excedente é dito — nunca cortado em silêncio.
      const cortados = diasUsuario.slice(diasForca);
      const mantidos = diasUsuario.slice(0, diasForca);
      if (cortados.length > 0) {
        avisos.push(`Seu treino tem ${diasUsuario.length} dias e o seu nível comporta ${diasForca} por semana — os ${cortados.length} últimos ficaram fora desta semana.`);
      }
      // 🔒 C1 §5.5 + DF② — o plano do usuário também é CERTIFICADO pela canônica (mesmo
      // tratamento do gerado). NÃO reduz: o editor é SOFT (o crítico informa, nunca trava).
      return certificarDuracao(montarSaida(mantidos, 'Meu treino'), perfil.nivelExperiencia, perfil.tempoPorSessaoMin * 60);
    }
  }

  const tetoPequenos = divisao === 'prioridades' ? PEQUENOS_TETO_DIRETO_PRIORIDADES : PEQUENOS_TETO_DIRETO;
  const argsAloc = {
    templates,
    budgetPorDia,
    pool,
    favoritos: favoritosEfetivos,
    alvoPonderado,
    seriesPlanejamento: prescricao.seriesPorExercicio.max,
    tetoSlotsSemana: (g: GrupoPrimario) => ((GRUPOS_PEQUENOS_PISO as readonly string[]).includes(g) ? tetoPequenos : Number.POSITIVE_INFINITY),
    coreMin: CORE_MIN,
    coreMax: CORE_MAX,
    // DF③: o dia por tema das prioridades preenche até o orçamento (o usuário o comprou).
    preencherAteOrcamento: divisao === 'prioridades',
  };
  let diasAlocados = alocarSemana(argsAloc);

  /**
   * 🔒 A CASCATA DO FOCO, DECIDIDA COM OS NÚMEROS REAIS (DF 2026-08-14).
   *
   * Duas passadas de propósito: a 1ª aloca NEUTRA (o foco não mexe em déficit), e só então
   * existem os números que a decisão precisa — quantos slots cada lado tem de fato. Se a
   * cascata parar no degrau ② (slot), a 2ª passada refaz a alocação com a transferência
   * autorizada. Decidir antes de alocar era o que fazia o motor cobrar de terceiros.
   */
  compensadorValido = foco && compensadoresPossiveis(templates.map((t) => t.grupos), foco.grupo).includes(foco.compensa)
    ? foco.compensa
    : null;

  if (foco && foco.grupo !== 'core' && semanaCiclo && !semanaCiclo.retomada && semanaCiclo.semana !== 6) {
    const banda = prescricao.volumePorGrupoSemana;
    const sMaxAloc = prescricao.seriesPorExercicio.max;
    const sMinAloc = prescricao.seriesPorExercicio.min;
    const fb = semanaCiclo.feedbackGrupos;
    const efeito = aplicarFoco({
      alvoBase: alvoDaSemana(banda, semanaCiclo.semana, fb?.get(foco.grupo) ?? 'ok'),
      alvoCompensaBase: alvoDaSemana(banda, semanaCiclo.semana, fb?.get(foco.compensa) ?? 'ok'),
      nivel: perfil.nivelExperiencia,
      objetivo: prescricao.objetivoEfetivo ?? perfil.objetivo,
    });
    const contar = (g: GrupoPrimario) => diasAlocados.flatMap((d) => d.slots).filter((s) => s.grupo === g).length;
    const ehPequeno = (g: GrupoPrimario) => (GRUPOS_PEQUENOS_PISO as readonly string[]).includes(g);
    const nFoc = contar(foco.grupo);
    const alvoFoc = alvoDaSemana(banda, semanaCiclo.semana, fb?.get(foco.grupo) ?? 'ok');
    const alvoComp = alvoDaSemana(banda, semanaCiclo.semana, fb?.get(foco.compensa) ?? 'ok');
    const nComp = compensadorValido ? contar(compensadorValido) : 0;
    decisaoFoco = decidirFoco({
      delta: efeito.deltaAplicado,
      focado: {
        slots: nFoc,
        series: Math.min(alvoFoc, nFoc * sMaxAloc),
        // 🔑 O teto é o do PORTE: banda do nível para grande; 2 exercícios diretos para
        // pequeno. Aplicar a banda de 15–16 a uma panturrilha era o erro medido.
        tetoSeries: ehPequeno(foco.grupo) ? PEQUENOS_TETO_DIRETO * sMaxAloc : banda.max,
        tetoSlots: ehPequeno(foco.grupo) ? tetoPequenos : Number.POSITIVE_INFINITY,
      },
      compensador: compensadorValido
        ? {
            slots: nComp,
            series: Math.min(alvoComp, nComp * sMaxAloc),
            /**
             * 🔑 O piso é o do PORTE do compensador, e nunca acima do que ele cabe.
             *  · pequeno: o piso é o dele (`n × sMin`) — usar a MEV de GRANDE aqui era o mesmo
             *    erro que o autor apontou do outro lado: tríceps com 4 séries ficaria
             *    "abaixo do piso 13" para sempre e jamais poderia ceder;
             *  · grande: a MEV, mas limitada pela capacidade real (`n × sMax`) — ombros com 3
             *    slots cabe 12 e a MEV é 13; exigir 13 o congelaria como inelegível.
             * Cada slot já carrega `sMin`, então abaixo de `n × sMin` a cessão some na
             * distribuição e o 1:1 viraria nominal — esse é o piso duro dos dois portes.
             */
            pisoSeries: ehPequeno(compensadorValido)
              ? nComp * sMinAloc
              : Math.max(nComp * sMinAloc, Math.min(banda.min, nComp * sMaxAloc)),
            pisoSlots: ehPequeno(compensadorValido) ? PEQUENOS_PISO_DIRETO : 1,
          }
        : null,
      sMax: sMaxAloc,
    });
    if (decisaoFoco.moveSlot && compensadorValido) {
      diasAlocados = alocarSemana({ ...argsAloc, transferirSlot: { de: compensadorValido, para: foco.grupo } });
    }
  }

  /**
   * 🔒 O PIPELINE COMPARTILHADO — tudo o que vem DEPOIS de saber quais exercícios entram:
   * degradação de descanso por dia, ordem do foco, descanso definitivo por slot, rampa de
   * séries (mesociclo ou retomada), invariantes e guard de cobertura.
   *
   * 🔑 Ele é uma função porque há DOIS produtores de `dias` — o alocador v4 e o desenho do
   * usuário (editor guiado) — e a DF② manda que o segundo receba exatamente o mesmo
   * tratamento do primeiro. Um `if` no meio do corpo criaria o "ramo especial" que a DF
   * proíbe, e o segundo pipeline envelheceria sozinho.
   */
  function montarSaida(diasTreino: DiaTreino[], split: string): RotinaSemanal {
    // --- Orçamento de tempo: DEGRADAÇÃO do descanso p/ a sessão caber -----------
    // v4: o nº de slots vem da tabela f(tempo) (`orcamentoSlotsDoDia`); o que o orçamento
    // decide aqui é o NÍVEL DE DEGRADAÇÃO do descanso (regra 3 — cede ISOLADO até 60 s,
    // depois COMPOSTO até 90 s; cobertura > descanso). A mecânica de descanso por classe
    // (armadilha 2 do handoff) fica intocada — muda só quem pede a degradação.
    let descansoEfetivo: Faixa = prescricao.descansoCompostoSeg;
    const nivelDegradacaoDia: (0 | 1 | 2)[] = diasTreino.map(() => 0);
    if (semanaCiclo) {
      const sPlan = Math.min(
        prescricao.seriesPorExercicio.min + Math.ceil((banda.max - banda.min) / Math.max(1, prescricao.freqPorGrupoMin)),
        prescricao.seriesPorExercicio.max,
      );
      /**
       * 🔴 O RIR-ALVO DA SEMANA DO MESOCICLO (conserto 2026-08-04, item 2 do lote): a rampa
       * (`rirAlvoSemana`) vence; sem ela, manda a semana do ciclo — nunca a constante.
       */
      const rirAlvo = prescricao.rirAlvoSemana ?? rirAlvoDaSemana(prescricao.rir, semanaCiclo.semana);
      const semanaRampa = semanaCiclo.retomada?.semana ?? null;
      const orcamentoSeg = perfil.tempoPorSessaoMin * 60;

      // 🔒 C1 §5.4 — a estimativa de PLANEJAMENTO não mantém aritmética própria: projeta itens
      // (séries = sPlan, execução por tipo, descanso por padrão no nível de degradação) e chama
      // a MESMA fórmula canônica, usando a MAX da faixa (o pior caso de ocupação do dia). Ela
      // decide só a DEGRADAÇÃO; a CERTIFICAÇÃO do plano final roda sobre as séries/descansos reais.
      const custoDia = (slots: readonly SlotExercicio[], nivel: 0 | 1 | 2): number => {
        const itens = slots.map((s) => ({
          tipo: 'RESISTIDO' as const,
          series: sPlan,
          descansoEntreSeriesSeg: descansoDoPadrao(s.padrao, {
            rirAlvo, modoForca: prescricao.modoForca === true, semanaRampa, degradacao: nivel,
          }),
          execucao: execucaoResistidaDe(s.exercicio, perfil.nivelExperiencia),
          tecnica: { tipo: 'SEM_TECNICA' as const },
        }));
        return avaliarDuracaoSessao({ itens }).duracaoMaximaEstimadaSegundos ?? Number.POSITIVE_INFINITY;
      };

      /**
       * 🟡 EXCEÇÃO NOMEADA, durante a rampa: o piso do FIT é INVIOLÁVEL, então não há
       * degradação (o volume da retomada já está cortado 50–70% — sobra tempo).
       */
      for (let i = 0; i < diasTreino.length; i += 1) {
        if (semanaRampa != null) break;
        const slots = diasTreino[i]!.slots;
        let nivel: 0 | 1 | 2 = 0;
        while (nivel < 2 && custoDia(slots, nivel) > orcamentoSeg) nivel = (nivel + 1) as 1 | 2;
        nivelDegradacaoDia[i] = nivel;
      }

      /**
       * O `descansoEfetivo` da SEMANA virou LEGADO — quem manda agora é o `descansoSeg` de
       * cada slot. Ele fica exposto para a chamada v1 (sem `semanaCiclo`) e para a UI antiga.
       * O teto de 180 s só sobe quando TODOS os dias couberam com a faixa cheia (v2 §5).
       */
      const elegivel180 = prescricao.descansoCompostoSeg.max >= 120 || prescricao.modoForca === true;
      const coubeCheio = nivelDegradacaoDia.every((n) => n === 0);
      if (elegivel180 && coubeCheio) descansoEfetivo = { min: prescricao.descansoCompostoSeg.min, max: DESCANSO_COMPOSTO_TETO_SEG };
    }

    /**
     * 🎛️ v3 · Bloco B — A ORDEM DO FOCO, aplicada com os exercícios já escolhidos.
     *
     * 🔴 **Dentro da classe, sempre.** *"Vem primeiro na sessão"* sem a qualificação inverteria
     * composto → isolado quando o foco fosse num músculo pequeno, e fatigar o bíceps antes das
     * puxadas é **pré-exaustão** — técnica avançada que a seção vizinha decidiu não prescrever
     * por default.
     *
     * 🟢 Vale para TODO MUNDO, inclusive para quem não tem folga de volume: é justamente o que
     * o foco entrega a quem já está no MRV.
     *
     * 🔴 EXCETO CORE (DF 2026-08-05): a mecânica do core é SÓ séries nos slots existentes —
     * `ordem` não existe para core (reordenar 1 slot/sessão é inerte, e entrega inerte é
     * sucesso simulado). Reordenar aqui também quebraria o aceite travado "recusa ⇒ plano
     * INALTERADO".
     */
    if (foco && foco.grupo !== 'core') {
      for (const dia of diasTreino) {
        dia.slots = ordenarComFoco(dia.slots, foco.grupo, {
          classe: (sl) => (sl.padrao === 'isolado' || sl.padrao === 'core' ? 'isolado' : 'composto'),
          grupo: (sl) => sl.exercicio.grupoPrimario ?? null,
        });
      }
    }

    /**
     * 🔒 DESCANSO DEFINITIVO, POR SLOT (cofre §🕐). Agora que os exercícios estão escolhidos,
     * o valor vem de `descansoDoExercicio` — que enxerga o que o padrão não mostra:
     * `tipo: 'pliometrico'` e o override de força pesada (só composto COM carga).
     *
     * A UI passa a EXIBIR este número. A média `round((min+max)/2)` que ela calculava sai —
     * ela matava o deslocamento por RIR em silêncio.
     */
    if (semanaCiclo) {
      // Mesma derivação do orçamento (ver o bloco acima): a rampa vence; senão, a semana do ciclo.
      const rirAlvo = prescricao.rirAlvoSemana ?? rirAlvoDaSemana(prescricao.rir, semanaCiclo.semana);
      const semanaRampa = semanaCiclo.retomada?.semana ?? null;
      for (let i = 0; i < diasTreino.length; i += 1) {
        const dia = diasTreino[i]!;
        // A degradação aplicada no orçamento vale para os slots deste dia: se o dia coube só
        // com ISOLADO em 60 s, é 60 s que a pessoa vê — a tela não pode prometer o que o
        // orçamento não reservou.
        const degradacao: 0 | 1 | 2 = semanaRampa != null ? 0 : (nivelDegradacaoDia[i] ?? 0);
        dia.slots = dia.slots.map((s) => {
          // 🔒 1.3/1.4: a degradação entra AQUI, onde a classe é conhecida. O teto por padrão
          // não enxerga POTENCIA nem força pesada e cortaria os dois no piso do composto.
          const exato = descansoDoExercicio({
            exercicio: s.exercicio, rirAlvo,
            modoForca: prescricao.modoForca === true,
            semanaRampa, degradacao,
          });
          if (exato == null) return s; // cardio: não há série a descansar
          // 🔒 C1 — transporta o HOLD real prescrito ao plano (isométricos). O avaliador usa
          // ESTE valor; ausente ⇒ NAO_AVALIADO. `faixaSegundos.min` é a PRESCRIÇÃO de geração
          // (mesmo alvo de reset da progressão), materializada no plano — não um fallback do adaptador.
          const holdSeg = repUnitDe(s.exercicio.id) === 'segundos'
            ? faixaSegundos(s.exercicio.id, perfil.nivelExperiencia)?.min
            : undefined;
          return { ...s, descansoSeg: Math.max(exato, DESCANSO_PISO_DURO_SEG), ...(holdSeg != null ? { holdSeg } : {}) };
        });
      }
    }

    // --- Rampa de volume por grupo (v2 §1, DF 2026-07-08) ---------------------
    // Distribui o volume-alvo da SEMANA (dentro da banda da tabela 1.2 — sem tabela nova)
    // pelos slots de cada grupoPrimario, em round-robin determinístico na ordem (dia, slot),
    // clampado a seriesPorExercicio {min..max}. Semana 6 NÃO anota séries: o deload usa o
    // mecanismo existente (aplicarDeload + corte de séries na sessão) — evita corte duplo.
    const ret = semanaCiclo?.retomada;
    if (semanaCiclo && (ret || semanaCiclo.semana !== 6)) {
      const { semana, feedbackGrupos } = semanaCiclo;
      // A banda da ALOCAÇÃO vem da prescrição — como a do orçamento de tempo acima. Uma
      // banda literal em qualquer um dos dois pontos seria número solto fora do cofre.
      const banda = prescricao.volumePorGrupoSemana;
      const sMin = prescricao.seriesPorExercicio.min;
      const sMax = prescricao.seriesPorExercicio.max;
      const porGrupo = new Map<GrupoPrimario, SlotExercicio[]>();
      /** Dia de cada slot — o teto de séries do grupo NA SESSÃO precisa saber onde o slot mora. */
      const diaDoSlot = new Map<SlotExercicio, number>();
      for (let di = 0; di < diasTreino.length; di += 1) {
        for (const s of diasTreino[di]!.slots) {
          // 🔒 `grupoPrimario` é NULLABLE (DF 2026-07-27): cardio/corpo-inteiro não são grupo
          // muscular e não têm volume-alvo por grupo — ficam fora da rampa, por definição.
          const g = s.exercicio.grupoPrimario;
          if (g == null) continue;
          const arr = porGrupo.get(g) ?? [];
          arr.push(s);
          porGrupo.set(g, arr);
          diaDoSlot.set(s, di);
        }
      }

      /**
       * 🔴 B1a — O COMPENSADOR SÓ CEDE O QUE O FOCADO DE FATO RECEBE (medição 2026-08-14).
       *
       * O defeito medido: `aplicarFoco` decide um alvo para cada lado, e o laço abaixo os
       * aplicava INDEPENDENTEMENTE. Só que o alvo do focado é truncado pelos slots que ele
       * tem (`n × sMax`) — e o do compensador não era. Com foco em panturrilha (1 slot, teto
       * 4 séries, já saturado) o resultado medido foi: **peito −1, panturrilha +0, total da
       * semana 90 → 89**. O 1:1 travado na spec ("o foco redistribui; o total não cresce")
       * virava vazamento: o volume sumia do plano.
       *
       * 🔒 A conta agora é feita UMA vez, aqui, e nos dois lados: o que o focado ganha DEPOIS
       * do truncamento é exatamente o que o compensador cede. Ganho zero ⇒ cessão zero.
       */
      /**
       * 🔒 As séries seguem a DECISÃO DA CASCATA — fonte única (DF 2026-08-14). O que o
       * focado ganha é exatamente o que o compensador cede, e o degrau já garantiu que a
       * conta fecha sem cobrar de terceiros.
       */
      const movidoPeloFoco = decisaoFoco?.series ?? 0;

      // --- RETOMADA: supersede a rampa do mesociclo -----------------------------------
      // Volume = referência × fator, que CAI ABAIXO DO PISO DA BANDA (é o estado novo).
      // Além dele valem os dois guarda-corpos da regra FIT: frequência máxima por GRUPO na
      // semana e teto de séries por slot (IRV ≤ 30 com carga · 3 séries sem carga).
      if (ret) {
        const fMax = freqMaxPorGrupo(ret.semana);
        const alvoGrupo = volumeDaRetomada(ret.volumeReferencia, ret.fator);
        const descartar = new Set<SlotExercicio>();
        for (const grupo of [...porGrupo.keys()].sort()) {
          const todos = porGrupo.get(grupo)!;
          // Frequência por grupo/padrão: o excedente sai (os últimos dias cedem primeiro).
          const slots = todos.slice(0, Number.isFinite(fMax) ? fMax : todos.length);
          for (const s of todos.slice(slots.length)) descartar.add(s);
          const n = slots.length;
          if (n === 0) continue;
          const tetoSlot = slots.map((s) => {
            const comCarga = temCarga(s.exercicio);
            const reps = (s.padrao === 'isolado' ? prescricao.repsIsolado : prescricao.repsComposto).max;
            // %1RM estimado por Epley invertido (mesma leitura do %1RM que a sessão exibe);
            // sem carga o IRV é incomputável → teto fixo de 3 (DF 2026-07-27).
            return tetoSeriesDaRetomada({ comCarga, reps, pct1rm: 30 / (30 + reps) });
          });
          const series = slots.map(() => 1); // piso operacional: 1 série por exercício
          let restante = Math.max(0, alvoGrupo - n);
          let i = 0;
          let travas = 0;
          while (restante > 0 && travas < n) {
            if (series[i]! < tetoSlot[i]!) { series[i]!++; restante--; travas = 0; } else { travas++; }
            i = (i + 1) % n;
          }
          slots.forEach((s, k) => { s.series = series[k]!; });
        }
        if (descartar.size > 0) {
          for (const d of diasTreino) d.slots = d.slots.filter((s) => !descartar.has(s));
          avisos.push(`Retomada: frequência por grupo limitada a ${fMax}×/semana nesta fase.`);
        }
        avisos.push('Retomada: volume reduzido nesta semana — o peso de cada série continua o mesmo.');
      } else
      for (const grupo of [...porGrupo.keys()].sort()) {
        const slots = porGrupo.get(grupo)!;
        let alvo = alvoDaSemana(banda, semana, feedbackGrupos?.get(grupo) ?? 'ok');
        // 🎛️ v3 · Bloco B — FOCO: +2–4 séries no grupo focado, compensadas 1:1 em outro, e
        // 🔴 NUNCA acima do MRV (teto duro). Quem já está no topo não ganha volume — ganha
        // ORDEM, aplicada mais acima, DENTRO DA CLASSE.
        if (foco && (grupo === foco.grupo || grupo === foco.compensa)) {
          const baseFocado = alvoDaSemana(banda, semana, feedbackGrupos?.get(foco.grupo) ?? 'ok');
          const baseCompensa = alvoDaSemana(banda, semana, feedbackGrupos?.get(foco.compensa) ?? 'ok');
          const objetivoEfetivo = prescricao.objetivoEfetivo ?? perfil.objetivo;
          if (foco.grupo === 'core') {
            /**
             * 🔒 FOCO DE CORE — mecânica PRÓPRIA (cofre §Foco de CORE, DF 2026-08-05): séries
             * nos slots que já existem, com teto de **séries por exercício do nível** — não o
             * MRV semanal. Frequência (2–3×/sem) e montagem de dias ficam intocadas por
             * construção: nada neste caminho as toca.
             *
             * 🔴 Sem folga, o efeito é RECUSA — e aqui ela aparece como "não mexe em nada". A
             * recusa EXPLICADA para a pessoa é emitida na borda (Painel), que é quem tem tela.
             */
            const slotsCore = porGrupo.get('core')?.length ?? 0;
            const slotsCompensa = porGrupo.get(foco.compensa)?.length ?? 0;
            /**
             * ⚠️ EFETIVO nos DOIS lados, não só no core. O alvo do grupo é truncado pela
             * distribuição em `n × sMax`: usar o alvo cru faria o 1:1 virar NOMINAL — o core
             * ganharia a série e o compensador não perderia nenhuma, porque já estava no
             * próprio teto.
             */
            const seriesCoreAtuais = Math.min(baseFocado, slotsCore * sMax);
            const seriesCompensaAtuais = Math.min(baseCompensa, slotsCompensa * sMax);
            const efeito = aplicarFocoCore({
              nSlotsCore: slotsCore, seriesCoreAtuais, alvoCompensaBase: seriesCompensaAtuais,
              nivel: perfil.nivelExperiencia, objetivo: objetivoEfetivo,
              // 🔴 O piso real de quem compensa: cada slot já tem `sMin`, então abaixo de
              // `n × sMin` a redução seria absorvida pela distribuição e o 1:1 viraria nominal.
              pisoCompensa: slotsCompensa * sMin,
            });
            alvo = grupo === 'core' ? efeito.alvoCore : efeito.alvoCompensado;
          } else if (grupo === foco.compensa && compensadorValido !== foco.compensa) {
            // Compensador que não divide dia com o focado (perfil herdado): a cascata caiu no
            // degrau ③ e ele NÃO cede nada. A tela pede para reescolher — o motor não escolhe
            // outro por baixo dos panos.
            alvo = baseCompensa;
          } else if (grupo === foco.grupo) {
            alvo = baseFocado + movidoPeloFoco;
          } else {
            /**
             * ⚠️ EFETIVO, não bruto — a mesma lição já travada no ramo do core: o alvo do
             * compensador é truncado por `n × sMax`, então descontar do BRUTO não tira série
             * nenhuma quando ele já está no próprio teto. Medido: tríceps (1 slot, 4 séries,
             * alvo bruto 15) "cedia" 1 e continuava com 4 — o 1:1 virava nominal e o total
             * da semana CRESCIA, contra a promessa da tela.
             */
            const efetivoCompensa = Math.min(baseCompensa, slots.length * sMax);
            alvo = efetivoCompensa - movidoPeloFoco;
          }
        }
        const n = slots.length;
        const base = n * sMin;
        const tetoGrupo = n * sMax;
        const series = slots.map(() => sMin);
        /**
         * 🔢 v4 — O TETO DE SÉRIES DO GRUPO NA SESSÃO GANHA O CALL SITE (handoff B1.4).
         * `tetoSeriesGrupoNaSessao` existia desde o v3 e nenhuma linha de produção a chamava
         * (defeito E5 da medição: a "nota de coerência aritmética" da §1.2 nunca saiu do
         * documento). A frequência é a REAL do grupo nesta semana (nº de dias com slot dele),
         * não a constante — full-body 3× divide por 3.
         */
        const diasDoGrupo = new Set(slots.map((s) => diaDoSlot.get(s) ?? 0)).size;
        const tetoSessao = tetoSeriesGrupoNaSessao(perfil.nivelExperiencia, prescricao.objetivoEfetivo ?? perfil.objetivo, Math.max(1, diasDoGrupo));
        const noDia = new Map<number, number>();
        for (const s of slots) noDia.set(diaDoSlot.get(s) ?? 0, (noDia.get(diaDoSlot.get(s) ?? 0) ?? 0) + sMin);
        if (alvo > base) {
          // Aviso honesto SÓ p/ grupo que poderia cumprir o piso da banda mas não o alvo;
          // grupos estruturalmente sub-banda (teto < piso) ficam silenciosos, como na v1.
          if (alvo > tetoGrupo && tetoGrupo >= banda.min) {
            avisos.push(`Semana ${semana}: alvo de ${alvo} séries para ${grupo} não cabe em ${n} exercício(s) — planejadas ${tetoGrupo}.`);
          }
          let extra = Math.min(alvo, tetoGrupo) - base;
          let i = 0;
          let travas = 0;
          while (extra > 0 && travas < n) {
            const dia = diaDoSlot.get(slots[i]!) ?? 0;
            if (series[i]! < sMax && (noDia.get(dia) ?? 0) < tetoSessao) {
              series[i]!++;
              noDia.set(dia, (noDia.get(dia) ?? 0) + 1);
              extra--;
              travas = 0;
            } else {
              travas++;
            }
            i = (i + 1) % n;
          }
        }
        slots.forEach((s, i) => {
          s.series = series[i]!;
        });
      }
    }

    // Invariantes (verificação + aviso honesto, sem afrouxar segurança).
    const contaPadrao = (p: PadraoMovimento) => diasTreino.reduce((n, d) => n + d.slots.filter((s) => s.padrao === p).length, 0);
    if (contaPadrao('puxar') < contaPadrao('empurrar')) {
      avisos.push('Atenção: volume de puxar ficou abaixo do de empurrar (alvo: puxar ≥ empurrar).');
    }
    if (diasForca >= 2 && contaPadrao('dobradica_quadril') < 1) {
      avisos.push('Atenção: padrão de dobradiça/quadril (cadeia posterior) não foi coberto.');
    }
    if (diasForca >= 2 && (contaPadrao('core') < CORE_MIN || contaPadrao('core') > CORE_MAX)) {
      avisos.push('Atenção: core fora da faixa de 2–3×/semana.');
    }
    if (budgetPorDia <= 3) {
      avisos.push('Tempo por sessão curto: priorizamos os exercícios fundamentais.');
    }

    /**
     * 🔢 v4 — GUARD DE COBERTURA (handoff B1.5): a pergunta que o motor nunca fez — "este
     * grupo foi coberto?" — vira verificação. Grupo GRANDE abaixo do MEV em contagem
     * PONDERADA (direto 1,0 + secundário 0,5) ⇒ aviso honesto. Fora da retomada (lá o
     * volume baixo é a feature) e só com séries decididas (ramo do ciclo).
     */
    if (semanaCiclo && !ret && semanaCiclo.semana !== 6) {
      const ponderado = creditoPonderadoDaSemana(diasTreino.flatMap((d) => d.slots));
      const objetivoEf = prescricao.objetivoEfetivo ?? perfil.objetivo;
      const piso = mev(perfil.nivelExperiencia, objetivoEf);
      for (const g of GRUPOS_GRANDES) {
        if ((ponderado.get(g) ?? 0) < piso) {
          // Catálogo-limitado (não alcança nem no teto, e um item do checklist fecha) ⇒ a
          // frase que aponta o equipamento mínimo. Senão (orçamento/estrutural) ⇒ a de sempre.
          const cat = classificarCoberturaCatalogo(exercises, g, perfil.nivelExperiencia, objetivoEf, perfil.equipamento, perfil.equipamentosCasa);
          avisos.push(cat ? mensagemCoberturaCatalogo(cat) : `Atenção: o volume de ${g} ficou abaixo do mínimo desta semana.`);
        }
      }
    }

    return {
      diasForcaAgendados: diasForca,
      diasCardioRecuperacao,
      diasCardio: montarDiasCardio(diasCardioRecuperacao, prescricao.cardio, perfil.cardioFavorito),
      split,
      dias: diasTreino,
      // 🔒 B2: o ramo que agiu vai junto do plano — a tela não recalcula nem adivinha.
      ...(foco && decisaoFoco
        ? { foco: { grupo: foco.grupo, compensa: foco.compensa, degrau: decisaoFoco.degrau, motivo: decisaoFoco.motivo, series: decisaoFoco.series } }
        : {}),
      cardio: prescricao.cardio,
      avisos,
      // Metadados do mesociclo (v2) — spread condicional preserva a saída v1 byte a byte.
      ...(semanaCiclo
        ? { semana: { numero: semanaCiclo.semana, deload: semanaCiclo.semana === 6, descansoCompostoSeg: descansoEfetivo } }
        : {}),
    };
  }

  /**
   * 🔴 O CORTE É DITO (pedido-casa-dia-curto-2026-08-13). Quando o inventário da pessoa não
   * tem exercício para preencher um slot que o template pediu, o alocador já não engole o
   * slot — ele o CONTA, e aqui o número vira frase.
   *
   * 🔒 Copy educacional e honesta: diz o QUE limitou (o inventário declarado) sem prometer
   * resultado e **sem sugerir equipamento que a pessoa não marcou** — o app não vende, e
   * inventar item de compra seria prescrição de consumo travestida de dica.
   */
  const porCatalogo = diasAlocados.filter((d) => d.naoPreenchidos > 0 && d.motivoCurto === 'catalogo');
  if (porCatalogo.length > 0) {
    const quais = porCatalogo.map((d) => d.nome).join(', ');
    avisos.push(`Seu equipamento disponível limita ${porCatalogo.length === 1 ? 'este dia' : 'estes dias'}: ${quais}. Com o que você marcou no perfil, não há exercício novo para acrescentar sem repetir o que já está lá.`);
  }
  /**
   * A OUTRA causa, que existia em academia sem nunca ser dita (6 das 36 combinações da
   * grade — `Pull B` fechando em 4 de 6): não falta exercício, faltou espaço na SEMANA. Dizer
   * "equipamento" aqui seria falso; a frase nomeia o teto, que é a regra que de fato agiu.
   */
  const porTeto = diasAlocados.filter((d) => d.naoPreenchidos > 0 && d.motivoCurto === 'teto');
  if (porTeto.length > 0) {
    const quais = porTeto.map((d) => d.nome).join(', ');
    avisos.push(`${porTeto.length === 1 ? 'Este dia ficou' : 'Estes dias ficaram'} mais curto${porTeto.length === 1 ? '' : 's'} de propósito: ${quais}. Os grupos deste dia já alcançaram o volume semanal previsto — acrescentar mais aqui tiraria espaço da recuperação.`);
  }

  const diasTreino: DiaTreino[] = diasAlocados.map((d) => ({
    nome: d.nome,
    // Quantos slots o template pediu e NENHUM grupo pôde preencher — o número que sustenta
    // o aviso acima. Exposto para o guard poder ancorar no corte de fato, e não em "o dia
    // veio abaixo do orçamento" (que também acontece por reserva não honrada, inclusive em
    // academia, e não é corte por catálogo).
    ...(d.naoPreenchidos > 0 ? { slotsNaoPreenchidos: d.naoPreenchidos } : {}),
    slots: d.slots.map((s) => ({
      // O padrão do slot é o do EXERCÍCIO escolhido (o template agora é de grupos): tudo
      // que lê `slot.padrao` (classe de descanso, faixa de reps, ordem do foco) continua
      // coerente com o exercício de fato prescrito.
      padrao: s.exercicio.padraoMovimento,
      exercicio: s.exercicio,
      // Badge (B5, DF 2026-07-04): acende p/ TODO favorito DECLARADO que entrou no plano
      // (preferidos de troca e recentes da retomada usam o trilho, não a badge).
      ...(favoritos.has(s.exercicio.id) ? { incluidoPorPreferencia: true } : {}),
      // 🔒 C1 — ESCOLHA de execução (e72): materializa a opção do usuário no slot, quando o
      // exercício admite escolha. `resolverExecucao` valida (fail-safe); o adaptador a honra.
      ...(s.exercicio.execucoesPermitidas != null && escolhasExecucao.has(s.exercicio.id)
        ? { execucaoSelecionada: resolverExecucao(s.exercicio.id, s.exercicio.execucao, escolhasExecucao.get(s.exercicio.id)) }
        : {}),
    })),
  }));

  const orcamentoSeg = perfil.tempoPorSessaoMin * 60;

  /**
   * 🔒 C1 §6.7/§7.8 — VALIDAÇÃO DOS TRÊS INVARIANTES do plano REALOCADO, contra as entradas
   * INDEPENDENTES (equipamento do perfil e cobertura obrigatória), reusando `avaliarInvariantes`
   * do orquestrador canônico. Roda SÓ depois de uma realocação do reduce-to-fit: é a rede que
   * transforma "o alocador preserva por construção" numa AFIRMAÇÃO VERIFICADA em runtime.
   * Violou ⇒ `ERRO_ALOCADOR{INVARIANTE_VIOLADO}` e o laço encerra — nunca se classifica um plano
   * estruturalmente inválido como incompatibilidade temporal nem se continua reduzindo a partir dele.
   */
  const violacoesDaRealocacao = (r: RotinaSemanal): string[] => {
    const slots = r.dias.flatMap((d) => d.slots);
    if (slots.length === 0) return [];
    const permitidos = new Set<string>(
      locaisPermitidos(perfil.equipamento).flatMap((l) => (l === 'academia' ? ['academia'] : l === 'casa_com' ? ['casa_com'] : ['casa_sem'])),
    );
    // `dobradica_quadril` conta como cobertura de membro inferior (`agachar`); `cardio` não é slot
    // resistido e não chega aqui. O mapa é explícito para o compilador provar a totalidade.
    const PARA_PADRAO: Record<PadraoMovimento, Padrao> = {
      puxar: 'puxar', empurrar: 'empurrar', agachar: 'agachar',
      dobradica_quadril: 'agachar', isolado: 'isolado', core: 'core', cardio: 'core',
    };
    return avaliarInvariantes(
      slots.map((s) => ({
        id: s.exercicio.id,
        padrao: PARA_PADRAO[s.padrao],
        grupo: s.exercicio.grupoPrimario ?? 'na',
        equipamento: s.exercicio.local,
        series: s.series ?? 1,
        descansoSeg: s.descansoSeg ?? 0,
        execucao: { tipo: 'REPETICOES', segundosEstimadosPorSerie: TEMPO_EXECUCAO_SERIE_REPS_SEG },
      })),
      // cobertura obrigatória da spec §8 (fixture 21) + allowlist REAL de locais do perfil.
      { coberturaObrigatoria: ['puxar', 'empurrar', 'agachar'], equipamentosDisponiveis: [...permitidos] },
    ).violacoes;
  };

  /**
   * 🔒 C1 (autor 2026-08-21) — FINALIZAÇÃO: deriva o discriminante `resultadoGeracao` (a fonte única
   * que SUBSTITUI o booleano isolado `duracaoIncompativel`) e MATERIALIZA a distribuição semanal de
   * cardio nos dias oferecidos. Os QUATRO estados são alcançáveis pelo caminho vivo: CERTIFICADO,
   * NAO_AVALIADO_ENTREGAVEL, INCOMPATIVEL e ERRO_ALOCADOR (este via `violacoesInvariantes`, quando
   * uma REALOCAÇÃO devolve plano estruturalmente inválido). `duracaoIncompativel` vira VISTA derivada.
   */
  const finalizar = (
    r: RotinaSemanal,
    capacidade: number,
    incompativel: boolean,
    violacoesInvariantes?: string[],
  ): RotinaSemanal => {
    const diasDur = r.duracaoDias ?? [];
    let rg: ResultadoGeracaoRotina;
    if (violacoesInvariantes && violacoesInvariantes.length > 0) {
      // 🔒 precedência §6: invariante violado ANTES de avaliar duração — não vira NAO_AVALIADO
      // entregável nem incompatibilidade temporal.
      rg = { tipo: 'ERRO_ALOCADOR', motivo: 'INVARIANTE_VIOLADO', violacoesInvariantes };
    } else if (diasDur.some((d) => d.estadoCalculo === 'NAO_AVALIADO')) {
      // §6 ramo (c): NAO_AVALIADO não certifica nem entra em redução — entrega com motivos.
      const motivos = [...new Set(diasDur.flatMap((d) => d.motivosNaoAvaliados))];
      rg = { tipo: 'NAO_AVALIADO_ENTREGAVEL', motivos };
    } else if (incompativel) {
      rg = { tipo: 'INCOMPATIVEL', capacidadeMinimaTestada: capacidade };
    } else {
      rg = { tipo: 'CERTIFICADO', capacidadeTerminal: capacidade };
    }

    // Distribuição semanal de cardio nos dias OFERECIDOS (só quando há semana/ciclo — o v1 puro não
    // materializa cardio semanal). Cardio prescrito por dia oferecido = meta ÷ nº de oferecidos.
    let distribuicaoCardio;
    if (semanaCiclo) {
      const oferecidos = diasOferecidosCardio.filter((i) => Number.isInteger(i) && i >= 0 && i < dias);
      const cardioPrescritoPorDiaSegundos =
        prescricao.cardio.tipo === 'minutos_semana' && oferecidos.length > 0
          ? duracaoDoDiaDeCardio(prescricao.cardio.min, oferecidos.length) * 60
          : 0;
      distribuicaoCardio = distribuirCardioDaRotina({
        diasTotais: dias,
        diasForca,
        duracaoDias: diasDur,
        diasOferecidosCardio: oferecidos,
        orcamentoSegundos: orcamentoSeg,
        cardioPrescritoPorDiaSegundos,
        aggregateId: 'rotina-cardio',
        expectedRevision: 0,
        formulaVersion: FORMULA_DURACAO_VERSION,
      });
    }

    return {
      ...r,
      resultadoGeracao: rg,
      ...(rg.tipo === 'INCOMPATIVEL' ? { duracaoIncompativel: true } : {}),
      ...(distribuicaoCardio ? { distribuicaoCardio } : {}),
    };
  };

  const rotina = certificarDuracao(montarSaida(diasTreino, split), perfil.nivelExperiencia, orcamentoSeg);

  // 🔒 C1 §5.5/§6 (override do autor 2026-08-20): o gerador reavaliou o PLANO FINAL pela fórmula
  // canônica (acima). Se um dia ainda estoura o limite operacional (B+480) mesmo com o descanso
  // no piso, REDUZ exercícios reexecutando o alocador completo com menos slots — cobertura,
  // equipamento e puxar≥empurrar preservados pelo próprio alocador (não se apaga o último slot).
  // `budgetSlotsOverride` presente ⇒ esta já é uma tentativa de redução: não re-reduz (mas finaliza,
  // pois o pai pode adotá-la como plano final).
  if (semanaCiclo?.budgetSlotsOverride != null) {
    // 🔒 esta chamada É uma REALOCAÇÃO do reduce-to-fit ⇒ valida os três invariantes (§6.7).
    return finalizar(
      rotina, budgetPorDia,
      precisaReduzir(rotina, perfil.nivelExperiencia, orcamentoSeg),
      violacoesDaRealocacao(rotina),
    );
  }
  if (semanaCiclo && precisaReduzir(rotina, perfil.nivelExperiencia, orcamentoSeg)) {
    for (let b = budgetPorDia - 1; b >= BUDGET_MIN_COBERTURA; b -= 1) {
      const tentativa = montarRotina(prescricao, perfil, exercises, favoritos, { ...semanaCiclo, budgetSlotsOverride: b }, preferencias, escolhasExecucao, diasOferecidosCardio);
      // 🔒 §6 precedência: invariante violado ENCERRA o laço — não continua reduzindo a partir de
      // um plano estruturalmente inválido nem o classifica como incompatibilidade temporal.
      if (tentativa.resultadoGeracao?.tipo === 'ERRO_ALOCADOR') return tentativa;
      // a tentativa já vem FINALIZADA (resultadoGeracao); adota a primeira que certifica.
      if (tentativa.resultadoGeracao?.tipo === 'CERTIFICADO') return tentativa;
    }
    // Nem o menor plano com cobertura coube: devolve o menor FINALIZADO (INCOMPATIVEL se ainda excede).
    return montarRotina(prescricao, perfil, exercises, favoritos, { ...semanaCiclo, budgetSlotsOverride: BUDGET_MIN_COBERTURA }, preferencias, escolhasExecucao, diasOferecidosCardio);
  }
  return finalizar(rotina, budgetPorDia, false);
}
