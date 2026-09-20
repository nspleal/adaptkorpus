import { aplicarExcecaoTrapezio } from './excecao-trapezio-iniciante';
import {completarPuxadasFullbody} from './fullbody-segunda-puxada';
import { preencherComplementaresAusentes } from './preencher-complementares';
import { adicionarSeriesCore } from './foco-core-adicional';
import { completarPosteriorDosado } from './complemento-posterior-dosado';
import { aplicarDoseReferenciada, contextoDaDose } from './referencia-dose';
import {adicionarBlocoFoco,realocarBaselineAosRecortes,realocarPernasReduzindoCore} from './bloco-foco-adicional';
import { consolidarPequenos } from './consolidar-pequenos';
// 🔒 Autoridade única do ajuste temporal: o montador chama a SEQUÊNCIA, nunca uma etapa
// solta. As etapas seguem exportadas no módulo para teste unitário.
import {reduzirDiaPorTempo,removerExtrasPorTempo} from './ajuste-tempo-estrutura';
/**
 * Montador de rotina de treino — v4: ALOCADOR POR VOLUME (leva B do
 * handoff-motor-volume-v4-2026-08-12; substitui o alocador por lista de padrões do v1).
 *
 * Fonte: parametros-motor-treino-adaptkorpus §"Passo 3" + §1.2 (bandas de volume) + DFs
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
import { aplicarDeload, dificuldadesLiberadas, seriesEmDeload } from './treino';
import { exercicioDisponivel, servePelaSelecaoAutomatica } from './equipamento';
import { alvoDaSemana } from './treino-mesociclo';
import { freqMaxPorGrupo, tetoSeriesDaRetomada, volumeDaRetomada } from './treino-retomada';
import { temCarga } from './equipamento';
import { classeDeDescanso, DESCANSO_PISO_DURO_SEG, descansoDoExercicio } from './descanso';
import { rirAlvoDaSemana } from './treino-mesociclo';
import { preferenciasEfetivas, type PreferenciasTreino } from './preferencias';
import { aplicarFoco, aplicarFocoCore, compensadoresPossiveis, decidirFoco, focoVigente, maxSemanalSemFoco, mev, ordenarComFoco, tetoPonderadoNaSessao, tetoSemanalCheio, tetoSemanalDoGrupo, tetoSeriesGrupoNaSessao, type DecisaoFoco, FOCO_SEMANAS } from './trilhos';
import { diagnosticarDia, otimizarCoberturaAnatomica } from './cobertura-anatomica';
import { gruposDoDia } from './cobertura-editor';
import { alocarSemana, creditoPonderadoDaSemana, GRUPOS_DISPENSAVEIS_FULLBODY_CURTO, GRUPOS_GRANDES, GRUPOS_PEQUENOS_PISO, orcamentoSlotsDoDia, PEQUENOS_PISO_DIRETO, PEQUENOS_TETO_DIRETO, PEQUENOS_TETO_DIRETO_PRIORIDADES, templatesDaSemana, type TemplateDia } from './alocador';
import { classificarCoberturaCatalogo, mensagemCoberturaCatalogo } from './cobertura-teto';
import { creditar, creditoAtual, gruposSemEspaco, MARCA_PODA_SESSAO, MARCA_PODA_TETO, podarExcessoPonderado, podarExcessoPonderadoNaSessao, seriesQueCabemNoTeto, type SlotPonderavel } from './teto-ponderado';
import { declararExcessoDeSessao, frasesDaExcecao, tentarAlternativasDeSessao, type AlternativaExaminada, type ExcecaoDeSessao } from './excecao-sessao';
import { secundariosDe } from './secundarios';
import { avaliarDuracaoSessao, FORMULA_DURACAO_VERSION } from './duracao-sessao';
import { avaliarDuracaoFinalDoDia, avaliarDuracaoResistida, execucaoResistidaDe } from './duracao-plano';
import { distribuirCardioDaRotina, fatosDistribuicaoCardioDaRotina } from './treino-cardio-semana';
import { avaliarInvariantes, executarReduceToFit, fatosReducao, type FatosReducao, type ItemPlanoTemporal, type Padrao } from './geracao-temporal';
import { TEMPO_EXECUCAO_SERIE_REPS_SEG } from './duracao-sessao';
import { faixaSegundos, repUnitDe } from './isometricos';
import { duracaoDoDiaDeCardio, MODALIDADE_PADRAO_DIA } from './dia-de-cardio';
import { ROTULO_GRUPO } from '../frequencia-grupos';
import { selecionarDivisao, contarRecortesEntregues } from './selecao-divisao';
import { distribuirGruposNoCalendario, distribuirComplementares, diasConsecutivos } from './calendario-grupos';
import { ehComplementar, ehDiaDisponivel } from './selecao-referencia';
import type { ModalidadeCardio } from './cardio';
import { DELOAD_SEMANAS_DEFAULT, DESCANSO_COMPOSTO_TETO_SEG, SERIES_MANUAIS_MAX } from './treino-constants';
import type { DiaCardio, DiaNaoAtendido, Faixa, FaseVolume, FatoCoberturaGrupo, FatoCorteTempo, FatoInvariantePadrao, FeedbackGrupo, NivelExperiencia, PerfilTreino, PrescricaoFITT, DiaTreino, PlanoFinalDia, ResultadoGeracaoRotina, RotinaSemanal, SemanaCiclo, SlotExercicio } from './treino-types';
import type { EquipamentoDisp, Exercise, ExecucaoLateralidade, GrupoPrimario, LocalExercicio, PadraoMovimento } from '../data/types';
import { ehBilateral, resolverExecucao } from '../data/lateralidade';
import { DIA_LABEL, ORDEM_SEMANA, diasPadrao, type Weekday } from '../semana';

/**
 * 🔒 O POOL ELEGÍVEL — autoridade ÚNICA do "este exercício pode entrar no seu plano?".
 *
 * Extraído do corpo de `montarRotina` sem mudar uma vírgula do critério: banidos e preteridos
 * fora, equipamento (modelo 2 níveis) e dificuldade liberada valendo, ordem estável
 * (tier↑, id). Existe como função porque DOIS consumidores fora do montador precisam do
 * MESMO conjunto — a atualização do desenho manual (que só preserva o que ainda cabe) e a
 * cobertura muscular do editor (que só sugere o que a pessoa realmente pode usar).
 *
 * 🔴 Uma segunda cópia deste filtro é o defeito que esta função existe para impedir: a tela
 * sugeriria um exercício que o motor recusa, ou preservaria um que ele descarta.
 */
export function poolElegivel(
  exercises: readonly Exercise[],
  perfil: Pick<PerfilTreino, 'equipamento' | 'equipamentosCasa' | 'nivelExperiencia'>,
  preferencias?: PreferenciasTreino,
): Exercise[] {
  const prefs = preferenciasEfetivas(
    { exercises, equipamento: perfil.equipamento, equipamentosCasa: perfil.equipamentosCasa, nivelExperiencia: perfil.nivelExperiencia },
    preferencias,
  );
  return poolDosExcluidos(exercises, perfil, new Set<string>([...prefs.banidos, ...prefs.preteridos]));
}

/** O filtro propriamente dito, com os excluídos JÁ resolvidos (o montador já os tem). */
function poolDosExcluidos(
  exercises: readonly Exercise[],
  perfil: Pick<PerfilTreino, 'equipamento' | 'equipamentosCasa' | 'nivelExperiencia'>,
  excluidos: ReadonlySet<string>,
): Exercise[] {
  const liberadas = new Set(dificuldadesLiberadas(perfil.nivelExperiencia));
  return exercises
    .filter((e) => !excluidos.has(e.id) && exercicioDisponivel(e, perfil.equipamento, perfil.equipamentosCasa) && liberadas.has(e.nivel))
    .slice()
    /**
     * 🔵 A lateralidade desempata DENTRO do tier (2026-09-19). O tier (familiaridade) continua
     * mandando; entre exercícios igualmente familiares, o bilateral vem primeiro — e é isso que
     * faz TODO caminho que pega "o primeiro do pool" (complementares, cobertura anatômica,
     * bloco de foco, exceções de sessão, full-body) herdar a preferência sem repeti-la em cada
     * um. Nenhum filtro muda: o unilateral continua no pool e continua entrando quando é o que
     * existe.
     */
    .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99)
      || (ehBilateral(a) ? 0 : 1) - (ehBilateral(b) ? 0 : 1)
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * 🔵 O POOL DA SELEÇÃO AUTOMÁTICA — o subconjunto do elegível que o MOTOR pode escolher
 * sozinho (2026-09-19). Hoje ele tira uma coisa só: o improviso doméstico de quem treina em
 * ACADEMIA (ver `servePelaSelecaoAutomatica`).
 *
 * 🔒 Um ponto de derivação só, e ele é o `pool` que o montador passa adiante: alocador,
 * complementares, cobertura anatômica, bloco de foco, exceções de sessão e full-body recebem
 * TODOS este pool. É o que impede um fallback de reintroduzir o que a regra acabou de tirar.
 *
 * 🔒 O elegível COMPLETO continua existindo e continua sendo a autoridade do desenho manual:
 * o que a pessoa escolheu a dedo não é apagado por uma regra de seleção automática.
 */
function poolDaSelecaoAutomatica(pool: readonly Exercise[], equipamento: EquipamentoDisp): Exercise[] {
  return pool.filter((e) => servePelaSelecaoAutomatica(e, equipamento));
}

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
  /** Flag estritamente interna: monta uma tentativa resistida, sem finalizar/distribuir cardio. */
  tentativaTemporalInterna?: true;
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

/** Padrões independentes que o adaptador temporal exige de toda realocação. */
const COBERTURA_TEMPORAL_OBRIGATORIA = ['puxar', 'empurrar', 'agachar'] as const;

/**
 * 🔴 D13 — a última semana de RAMPA do mesociclo: o plano-base com que a semana de deload se
 * compara. Derivada da constante do deload, não um número novo.
 */
const SEMANA_BASE_DO_DELOAD = (DELOAD_SEMANAS_DEFAULT - 1) as OpcoesSemana['semana'];

/** Capacidade ENTREGUE por um plano = maior nº de slots de um dia (a régua do reduce-to-fit). */
function capacidadeEntregue(plano: RotinaSemanal): number {
  return Math.max(0, ...plano.dias.map((d) => d.slots.length));
}

/** 🔒 C1 §6 — um dia estoura o LIMITE OPERACIONAL (B+480) mesmo com o descanso no piso? */
export function precisaReduzir(rotina: RotinaSemanal, nivel: NivelExperiencia, orcamentoSeg: number): boolean {
  return rotina.dias.some((d) => {
    const r = avaliarDuracaoResistida(d.slots, nivel, orcamentoSeg);
    return r.estadoCalculo === 'CALCULADO'
      && (r.estadoLimite === 'ACIMA_DO_LIMITE_OPERACIONAL' || r.estadoLimite === 'LIMITE_INDETERMINADO');
  });
}

/** 🔒 C1 §5.5 — anexa a certificação canônica por dia ao plano final (autoridade do "cabe?"). */
function certificarDuracao(rotina: RotinaSemanal, nivel: NivelExperiencia, orcamentoSeg: number | undefined, limiteEstrito = false): RotinaSemanal {
  const duracaoResistidaDias = rotina.dias.map((d) => avaliarDuracaoResistida(d.slots, nivel, orcamentoSeg, limiteEstrito));
  return { ...rotina, duracaoResistidaDias, duracaoDias: duracaoResistidaDias };
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
   * 🔒 C1.1-B — DIAS OFERECIDOS PELO USUÁRIO PARA CARDIO: dias reais da semana. É a menor
   * fronteira funcional nova — transiente
   * por geração, NÃO uma preferência permanente do perfil. Distinto de `diasDisponiveis` (contagem).
   * Cardio próprio pode vir após musculação; parcela redistribuída nunca cai em dia de treino.
   * Entra, em ordem canônica, no `canonical_input_hash` da distribuição.
   */
  diasOferecidosCardio: readonly (Weekday | number)[] = [],
): RotinaSemanal {
  const avisos: string[] = [];
  /** 🔴 D16 — fatos estruturais dos avisos de cobertura desta montagem (paralelos à prosa). */
  const fatosCobertura: FatoCoberturaGrupo[] = [];
  const fatosInvariantes: FatoInvariantePadrao[] = [];
  /**
   * 🔢 v4 — GUARD DE COBERTURA (handoff B1.5): a pergunta que o motor nunca fez — "este grupo
   * foi coberto?" — vira verificação. Grupo GRANDE abaixo do MEV em contagem PONDERADA
   * (direto 1,0 + secundário 0,5) ⇒ aviso honesto. Fora da retomada (lá o volume baixo é a
   * feature) e só com séries decididas (ramo do ciclo).
   *
   * 🔵 2026-09-15 — virou FUNÇÃO, para poder ser REMEDIDA.
   *
   * No desenho manual a escolha de séries da pessoa só é aplicada junto da certificação de
   * duração, muito depois desta medição — que via, portanto, as séries da rampa e não as
   * entregues. Medido: plano idêntico ao automático, motor dizendo `costas 12 · quadríceps 8 ·
   * glúteos 6 · ombros 12` e crítico dizendo `10 · 6 · 5 · 10`. Enquanto o editor não mostrava
   * os avisos do motor isso passava despercebido; ao mostrá-los, a mesma medição apareceria na
   * tela com dois números — o eco que D16 existe para fechar. Remedir na origem resolve sem
   * criar um segundo sistema de avisos.
   */
  const medirCobertura = (dias: readonly DiaTreino[]) => {
    if (!semanaCiclo) return;
    // Substitui a medição anterior: dois pares para o mesmo grupo seriam o eco que D16 proíbe.
    for (const antigo of fatosCobertura.splice(0)) {
      const i = avisos.indexOf(antigo.aviso);
      if (i >= 0) avisos.splice(i, 1);
    }
    const ponderado = creditoPonderadoDaSemana(dias.flatMap((d) => d.slots));
    const objetivoEf = prescricao.objetivoEfetivo ?? perfil.objetivo;
    const piso = mev(perfil.nivelExperiencia, objetivoEf);
    for (const g of GRUPOS_GRANDES) {
      if ((ponderado.get(g) ?? 0) < piso) {
        // Catálogo-limitado (não alcança nem no teto, e um item do checklist fecha) ⇒ a
        // frase que aponta o equipamento mínimo. Senão (orçamento/estrutural) ⇒ a de sempre.
        const cat = classificarCoberturaCatalogo(exercises, g, perfil.nivelExperiencia, objetivoEf, perfil.equipamento, perfil.equipamentosCasa);
        const texto = cat ? mensagemCoberturaCatalogo(cat) : `Atenção: o volume de ${g} ficou abaixo do mínimo desta semana.`;
        avisos.push(texto);
        /**
         * 🔴 D16 — o FATO viaja junto do aviso. Sem ele, a única forma de saber se o crítico
         * está dizendo a mesma coisa seria comparar frases — e frase igual não prova fato
         * igual, nem frase diferente prova fato diferente.
         */
        fatosCobertura.push({
          grupo: g, semana: semanaCiclo.semana, escopo: 'semana', metrica: 'series_ponderadas',
          limiar: 'mev', alvo: piso, valor: ponderado.get(g) ?? 0, causa: cat ? 'catalogo' : 'orcamento', aviso: texto,
        });
      }
    }
  };
  // B5 suspensa na retomada: os exercícios já executados entram no MESMO trilho de isenção
  // dos favoritos (mecanismo existente), para o montador preferi-los em vez de rotacionar.
  const recentes = semanaCiclo?.retomada?.exerciciosRecentes;
  /**
   * 🔒 D2/D9 — deload AGENDADO da semana 6. A retomada o exclui de propósito: ela já é um
   * estado de volume reduzido e somar os dois é o corte duplo. Único lugar do motor onde a
   * semana 6 é reconhecida como deload; a tela lê o resultado, não a condição.
   */
  const deloadAgendado = semanaCiclo != null && !semanaCiclo.retomada
    && semanaCiclo.semana === DELOAD_SEMANAS_DEFAULT;
  /**
   * 🔴 A FAIXA DA SEMANA — UMA AUTORIDADE, UMA MOEDA (decisão do autor 2026-09-16).
   *
   * Até `f035d6c` o mesmo `volumePorGrupoSemana` era cobrado em DUAS moedas dentro do
   * mesmo motor: PONDERADA no alocador (`alvoPonderado`), no guard de cobertura e no
   * crítico do editor; DIRETA na rampa (`alvoDaSemana`) e no bloco do foco. Medido em
   * `3d86cbf`: 212 de 3 888 combinações entregavam um grande acima do MRV **sem foco
   * nenhum** (costas 21 contra 20 em avançado/massa; 14 contra 12 em avançado/saúde).
   *
   * 🔵 A decisão vigente fecha a ambiguidade: **o MRV é ponderado** — série direta 1,0 e
   * indireta 0,5 (`PESO_SECUNDARIO`) —, para todos os grupos, no baseline e no foco. A
   * rampa continua sendo a INTENÇÃO (quantas diretas o grupo mira na semana); o teto é
   * uma restrição GLOBAL, porque o crédito indireto de um grupo depende dos slots dos
   * outros. Por isso ele é cobrado UMA vez, depois que todas as séries estão decididas
   * (`podarExcessoPonderado`): um cap por grupo dentro do laço da rampa dependeria da
   * ordem em que os grupos são visitados — seria uma terceira conta, não a canônica.
   *
   * 🔒 Nenhum número novo: a faixa é a que `aplicarDeload` e `volumeDaRetomada` já
   * produzem. Esta constante é só o ÚNICO ponto onde ela é lida — a poda do baseline, o
   * teto dos extras do foco e o `faixaVolumeSemana` publicado leem daqui.
   */
  const faixaDaSemana: Faixa = semanaCiclo?.retomada
    ? { min: volumeDaRetomada(semanaCiclo.retomada.volumeReferencia, semanaCiclo.retomada.fator), max: prescricao.volumePorGrupoSemana.max }
    : (deloadAgendado ? aplicarDeload(prescricao) : prescricao).volumePorGrupoSemana;
  /**
   * 🔒 O PISO por exercício nesta semana — o limite de até onde a poda pode descer.
   * Na retomada o piso operacional é 1 por slot (é com 1 que `repartir` começa, e o alvo
   * da fase fica ABAIXO do piso da banda por definição); usar o `sMin` do nível ali
   * impediria qualquer poda e ainda afirmaria um piso que a fase não tem.
   */
  const sMinDaSemana = semanaCiclo?.retomada
    ? 1
    : (deloadAgendado ? aplicarDeload(prescricao) : prescricao).seriesPorExercicio.min;
  // 🎛️ v3 · Bloco A: revalidadas AQUI, na montagem — equipamento e nível mudam no perfil, e
  // preferência que deixou de caber é ignorada na geração (o plano sai correto) sem ser
  // apagada do perfil: se a pessoa recuperar o equipamento, ela volta a valer sozinha.
  /** 🎛️ v3 · Bloco B — o foco vigente (fora da janela de 4–6 semanas, não existe). */
  const focoSolicitado = focoVigente(perfil.foco) ? perfil.foco : undefined;
  const automatico = !perfil.rotinaCustom;
  // Autor14/09: o automático adiciona ao baseline, não usa a cascata de cessão.
  const foco = focoSolicitado?.compensa && !automatico
    ? {...focoSolicitado,compensa:focoSolicitado.compensa} : undefined;
  const agregado = !focoSolicitado && perfil.focoAgregado && perfil.focoAgregado.semana >= 1
    && perfil.focoAgregado.semana <= FOCO_SEMANAS.max ? perfil.focoAgregado.grupo : undefined;
  const prioritarios: GrupoPrimario[] = focoSolicitado ? [focoSolicitado.grupo] : agregado === 'bracos'
    ? ['biceps', 'triceps'] : agregado === 'pernas' ? ['quadriceps', 'posterior'] : [];
  if (perfil.foco && perfil.focoAgregado) avisos.push('Há duas escolhas de foco no perfil recebido. Usamos apenas uma prioridade por vez; confira sua preferência.');
  /**
   * 🔵 OS TETOS DESTA SEMANA — TRÊS números, uma leitura só (decisão do autor 2026-09-17).
   *
   * 🔴 O que muda: `faixaDaSemana.max` deixa de ser teto. Ele é a FAIXA DESEJADA que a rampa
   * mira; quem limita é `tetoSemanalGrupo` (por grupo) e `tetoDaSessao` (por dia). Máximo
   * permitido não é meta: nada aqui empurra volume para cima só porque cabe.
   *
   *  · **semanal, sem foco** = teto cheio − 3 (hipertrofia: 10 · 16 · 18);
   *  · **semanal, em foco**  = teto cheio (13 · 19 · 21) — e só para quem a pessoa nomeou:
   *    um extra de peito NÃO libera ombros ou tríceps a usarem os tetos cheios deles;
   *  · **por sessão**        = 12 ponderadas por grupo, todos os níveis, com ou sem foco,
   *    sem margem nenhuma. Os dois valem AO MESMO TEMPO.
   *
   * 🔒 FASE: só o deload declara teto menor (a banda que `aplicarDeload` já produz — nenhum
   * percentual novo). `tetoSemanalDoGrupo` toma o MENOR dos dois; a margem de 3 já foi
   * aplicada uma vez ao derivar o máximo sem foco e NÃO é subtraída de novo da dose reduzida.
   *
   * 🔒 RETOMADA: a fase não aplica o bloco do foco (ver o `bloco` adiante), então ninguém
   * alcança o teto cheio nela — `emFoco` entra vazio, e os guarda-corpos próprios da retomada
   * (frequência, IRV, alvo do grupo) continuam intactos por cima.
   */
  const objetivoDoVolume = prescricao.objetivoEfetivo ?? perfil.objetivo;
  const gruposEmFoco: GrupoPrimario[] = semanaCiclo?.retomada ? [] : prioritarios;
  const tetoSemanalGrupo = tetoSemanalDoGrupo({
    nivel: perfil.nivelExperiencia,
    objetivo: objetivoDoVolume,
    emFoco: gruposEmFoco,
    ...(deloadAgendado ? { tetoDaFase: faixaDaSemana.max } : {}),
  });
  /**
   * Teto PONDERADO por grupo NA SESSÃO — o mesmo para todos os grupos, em foco ou não.
   *
   * 🔴 `null` fora da hipertrofia: `saude` e `emagrecimento` têm política própria e o teto
   * de sessão deles continua sendo o direto `semanal ÷ frequência real`, cobrado dentro da
   * repartição da rampa. Medido quando este ramo não existia: `avancado/saude/S6` perdia
   * séries para um teto ponderado de 6 que a política daquele objetivo nunca declarou.
   */
  const tetoDaSessao = tetoPonderadoNaSessao(perfil.nivelExperiencia, objetivoDoVolume);
  /** Os três números, como a tela vai lê-los (o menor entre nível e fase, já resolvido). */
  const tetosPublicados = {
    semFoco: Math.min(maxSemanalSemFoco(perfil.nivelExperiencia, objetivoDoVolume), deloadAgendado ? faixaDaSemana.max : Number.POSITIVE_INFINITY),
    cheio: Math.min(tetoSemanalCheio(perfil.nivelExperiencia, objetivoDoVolume), deloadAgendado ? faixaDaSemana.max : Number.POSITIVE_INFINITY),
    sessao: tetoDaSessao,
    gruposEmFoco,
  };
  /**
   * 🔵 A VOZ ÚNICA DA EXCEÇÃO AO TETO POR SESSÃO (2026-09-17, 2ª volta).
   *
   * 🔑 Um ponto de emissão só, chamado pelos DOIS produtores de plano (o automático e o
   * desenho da pessoa). Dois `push` separados diriam o mesmo fato em dois lugares — e um
   * deles envelheceria sozinho, que é exatamente o que D16 e o tripwire de
   * `veredito-motor` existem para impedir.
   *
   * 🔒 O que muda entre os chamadores não é a frase: é QUE alternativa existia. No
   * automático o motor pôde trocar exercício e mudar de dia (e o registro dessas tentativas
   * vem em `alternativas`); no desenho da pessoa não pôde nenhuma das duas, porque os
   * exercícios e os dias são escolha dela.
   */
  const dizerExcecaoDeSessao = <S extends SlotPonderavel>(
    dias: readonly { nome: string; slots: S[] }[],
    extra?: { alternativas?: Map<string, AlternativaExaminada[]>; dosadoPelaPessoa?: (slot: S) => boolean },
  ): ExcecaoDeSessao[] => {
    if (tetoDaSessao == null) return [];
    const excecoes = declararExcessoDeSessao({ dias, teto: tetoDaSessao, ...extra });
    for (const f of frasesDaExcecao(excecoes, (g) => ROTULO_GRUPO[g] ?? g)) avisos.push(f);
    return excecoes;
  };
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
  const diasDaAgenda = perfil.treinoDias && perfil.treinoDias.length > 0
    ? ORDEM_SEMANA.filter((dia) => perfil.treinoDias!.includes(dia))
    : diasPadrao(Math.max(0, Math.floor(perfil.diasDisponiveis)));
  const dias = diasDaAgenda.length;
  const teto = prescricao.sessoesForcaSemana.max;
  const diasForca = dias < 1 ? 0 : Math.min(dias, teto);
  const diaComplementar = automatico ? diasDaAgenda.slice(diasForca).find(d =>
    !diasOferecidosCardio.includes(d) && !diasOferecidosCardio.includes(ORDEM_SEMANA.indexOf(d))) : undefined;
  const diasCardioRecuperacao = Math.max(0, dias - diasForca - Number(diaComplementar != null));
  /** As sessões de força ocupam os primeiros dias efetivamente escolhidos, na semana real. */
  const diasForcaDaSemana = [...diasDaAgenda.slice(0, diasForca), ...(diaComplementar ? [diaComplementar] : [])];

  if (diasForca === 0) {
    return { diasForcaAgendados: 0, diasCardioRecuperacao, split: '—', dias: [], diasCardio: montarDiasCardio(diasCardioRecuperacao, prescricao.cardio, perfil.cardioFavorito), cardio: prescricao.cardio, avisos: ['Sem dias disponíveis para treino de força.'] };
  }

  // Pool elegível: equipamento (modelo 2 níveis — checklist de casa) + dificuldade
  // liberada. Ordenado (tier↑, depois id). 🔒 Mesma função que a tela consome.
  /** Elegível COMPLETO — a autoridade do desenho manual (o que a pessoa pode ter no plano). */
  const poolDoPerfil = poolDosExcluidos(exercises, perfil, excluidos);
  /** O que o MOTOR pode escolher sozinho. Tudo abaixo daqui seleciona a partir DELE. */
  const pool = poolDaSelecaoAutomatica(poolDoPerfil, perfil.equipamento);

  // ── 🔢 v4 — templates por GRUPO + orçamento de slots por tempo (DFs ①②③) ──
  const divisao = perfil.divisaoPreferida ?? 'auto';
  const baseDivisao = templatesDaSemana(diasForca, perfil.nivelExperiencia, divisao);
  const perfilBase = automatico ? {...perfil,foco:undefined,focoAgregado:undefined} : perfil;
  const selecao = selecionarDivisao(baseDivisao, perfilBase, automatico ? undefined : agregado, !!semanaCiclo?.retomada, CORE_MAX);
  // O dia dedicado não muda a divisão nem a recuperação das sessões principais.
  const calendarizar = (ts: readonly TemplateDia[], focos: readonly GrupoPrimario[], preservar = false) => {
    const base = distribuirGruposNoCalendario(ts, diasDaAgenda.slice(0, diasForca), focos, Math.min(CORE_MIN, diasForca), preservar);
    if (!diaComplementar) return base;
    const dedicado: TemplateDia = { nome: 'Complementares', grupos: ['core', 'antebraco'] };
    const originais = [...base.dias.map(d => ({...d, grupos:[...d.grupos]})), dedicado];
    const novos = [...base.dias.map(d => ({...d, grupos:[...d.grupos]})), {...dedicado}];
    distribuirComplementares(novos, originais, diasForcaDaSemana, Math.min(CORE_MIN, diasForca));
    return {...base, dias: novos};
  };
  const calendario = calendarizar(selecao.dias, automatico ? [] : prioritarios, selecao.preservarRecortes);
  const selecaoFoco = automatico && agregado === 'pernas'
    ? selecionarDivisao(baseDivisao, perfil, agregado, !!semanaCiclo?.retomada, CORE_MAX) : selecao;
  const calendarioFoco = selecaoFoco === selecao ? calendario
    : calendarizar(selecaoFoco.dias,prioritarios,selecaoFoco.preservarRecortes);
  const recortesFoco = selecaoFoco === selecao ? undefined : calendarioFoco.dias;
  const templates = calendario.dias;
  const split = diasForca === 1 ? 'Full-body' : templates.every((t, i) => t.nome === selecao.dias[i]?.nome) ? selecao.split : 'Distribuição pela agenda';
  if (calendario.limitado) avisos.push('A agenda limita a repetição dos grupos. Priorizamos a recuperação; o foco e a distribuição desejada podem não ser atendidos integralmente.');
  // 🔒 C1 — o teto de slots vem da tabela f(tempo), MAS o reduce-to-fit (override 2) pode pedir
  // menos slots reexecutando o alocador; aí o override manda (nunca acima da tabela).
  const budgetDaTabela = Math.min(
    semanaCiclo?.budgetSlotsOverride ?? Number.POSITIVE_INFINITY,
    automatico && diasForca === 1 ? 10 : orcamentoSlotsDoDia(perfil.limiteTempoTreino === 'sem_limite' ? 75 : perfil.tempoPorSessaoMin),
  );
  /**
   * 🔴 D13 (auditoria 2026-09-11) — O CORTE DE SÉRIES NÃO PODE SER ANULADO POR MAIS EXERCÍCIOS.
   *
   * Medido em 42 dos 1.458 perfis varridos: a semana 6 entregava volume IGUAL OU MAIOR que a
   * semana 5 com `semana.deload = true` na tela (pior caso: 20 séries em 5 slots → 32 séries
   * em 16 slots). O mecanismo não é o `aplicarDeload` — é a interação dele com o reduce-to-fit:
   * séries menores baratearam cada slot, o dia passou a caber com a capacidade CHEIA da tabela
   * e o alocador recolocou exercícios. O corte por exercício era devolvido em cardinalidade.
   *
   * 🔒 O PLANO-BASE COMPARÁVEL, declarado: as MESMAS entradas e restrições (perfil, biblioteca,
   * favoritos, preferências, execuções, oferta de cardio), mudando só a semana do mesociclo
   * para a última de RAMPA. A capacidade terminal dele passa a ser o teto da semana de deload.
   * Assim a estrutura fica onde a spec já a queria — *"mesmos slots, mesmos dias; só as séries
   * rampam"* — e a redução das séries chega inteira ao volume entregue.
   *
   * ⚠️ Um TETO, não um alvo: o reduce-to-fit da semana de deload continua livre para reduzir
   * mais se precisar, e nenhuma banda percentual é imposta à saída. Capacidade-base zero (não
   * há plano-base com o que comparar) não cria teto nenhum.
   */
  const rotinaBaseDoDeload = deloadAgendado
    && perfil.rotinaCustom == null
    && semanaCiclo != null
    && semanaCiclo.budgetSlotsOverride == null
    && !semanaCiclo.tentativaTemporalInterna
    ? montarRotina(
        prescricao, perfil, exercises, favoritos,
        { ...semanaCiclo, semana: SEMANA_BASE_DO_DELOAD },
        preferencias, escolhasExecucao, diasOferecidosCardio,
      )
    : null;
  const capacidadeBaseDoDeload=rotinaBaseDoDeload?capacidadeEntregue(rotinaBaseDoDeload):0;
  const budgetPorDia = Math.min(
    budgetDaTabela,
    capacidadeBaseDoDeload > 0 ? capacidadeBaseDoDeload : Number.POSITIVE_INFINITY,
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
  // O desenho manual passa pelo mesmo finalizador C1 do plano automático. A construção
  // acontece cedo; a certificação/distribuição vem depois, quando as funções canônicas existem.
  let diasUsuarioCustom: DiaTreino[] | null = null;
  const avisosCustom: string[] = [];
  /** 🔴 D14 — dias do desenho manual que ficaram sem exercício elegível (antes, sumiam). */
  const diasNaoAtendidosCustom: DiaNaoAtendido[] = [];
  if (custom && custom.dias.length > 0) {
    if (prioritarios.length > 0) avisosCustom.push('Foco atualizado: considere priorizar os exercícios escolhidos. A ordem do seu treino foi preservada.');
    const indisponiveis = [...new Set(custom.dias.flatMap(d => d.exercicioIds))].filter(id => !poolDoPerfil.some(e => e.id === id));
    if (indisponiveis.length) avisosCustom.push(`Exercícios do desenho não elegíveis no perfil atual: ${indisponiveis.join(', ')}. As escolhas salvas foram preservadas; revise equipamento e restrições.`);
    const porId = new Map(poolDoPerfil.map((e) => [e.id, e]));
    const diasUsuario = custom.dias
      .map((d, customIdx) => ({
        nome: d.nome,
        // Novo desenho persiste o dia; legado deriva uma única vez da agenda existente.
        diaId: d.diaId ?? diasForcaDaSemana[customIdx],
        slots: d.exercicioIds
          .map((id) => porId.get(id))
          .filter((e): e is Exercise => e != null && e.padraoMovimento !== 'cardio')
          .map((e) => ({
            padrao: e.padraoMovimento,
            exercicio: e,
            ...(favoritos.has(e.id) ? { incluidoPorPreferencia: true } : {}),
            // A escolha lateral segue o mesmo fio do plano automático até o adaptador temporal.
            ...(e.execucoesPermitidas != null && escolhasExecucao.has(e.id)
              ? { execucaoSelecionada: resolverExecucao(e.id, e.execucao, escolhasExecucao.get(e.id)) }
              : {}),
          })),
      }));
    /**
     * 🔴 D14 — o dia que a pessoa DESENHOU e ficou sem exercício elegível já era descartado
     * aqui, em silêncio: ela montava o dia, recarregava e ele simplesmente não estava mais lá.
     * Ele continua fora das sessões entregues (não há sessão vazia para iniciar), mas agora é
     * DECLARADO, com motivo, em vez de sumir.
     */
    diasNaoAtendidosCustom.push(...diasUsuario
      .filter((d) => d.slots.length === 0)
      .map((d) => ({ nome: d.nome, ...(d.diaId ? { diaId: d.diaId } : {}), motivo: 'DESENHO_VAZIO' as const })));
    const diasUsuarioComExercicio = diasUsuario.filter((d) => d.slots.length > 0);
    if (diasUsuarioComExercicio.length > 0 || custom.dias.some(d => d.exercicioIds.length > 0)) {
      // O teto vigente orienta a recomendação; não apaga o desenho manual.
      const cortados = diasUsuarioComExercicio.slice(diasForca);
      const mantidos = diasUsuarioComExercicio;
      if (cortados.length > 0) {
        avisosCustom.push(`Seu treino tem ${diasUsuarioComExercicio.length} dias e o seu nível comporta ${diasForca} por semana — os ${cortados.length} dias excedem a recomendação atual. Seu desenho foi preservado.`);
      }
      // DF②: exercícios, ordem e quantidade do usuário ficam intactos. O caminho canônico
      // certifica duração e recomenda cardio mais abaixo; nunca aplica reduce-to-fit ao manual.
      diasUsuarioCustom = mantidos;
    }
  }

  const tetoPequenos = divisao === 'prioridades' ? PEQUENOS_TETO_DIRETO_PRIORIDADES : PEQUENOS_TETO_DIRETO;
  const argsAloc = {
    templates,
    prioritarios: selecao.prioritarios,
    pisoPonderado: selecao.preservarRecortes ? banda.min : undefined,
    complementosPorDia: templates.map((t,d)=>selecao.prioritarios?.some(g=>t.grupos.includes(g))
      ? [...GRUPOS_GRANDES,...GRUPOS_PEQUENOS_PISO].filter(g=>!t.grupos.includes(g)
        && !templates.some((outro,i)=>i!==d&&outro.grupos.includes(g)&&diasConsecutivos(diasForcaDaSemana[d]!,diasForcaDaSemana[i]!)))
      : []),
    budgetPorDia,
    pool,
    favoritos: favoritosEfetivos,
    alvoPonderado,
    seriesPlanejamento: prescricao.seriesPorExercicio.max,
    tetoSlotsSemana: (g: GrupoPrimario) => diasForca === 1 ? 1 : ((GRUPOS_PEQUENOS_PISO as readonly string[]).includes(g) ? tetoPequenos : Number.POSITIVE_INFINITY),
    /**
     * 🔵 O TETO DE SESSÃO CHEGA NA COMPOSIÇÃO, não só na dose (decisão 2026-09-17).
     *
     * Cada slot carrega no mínimo `seriesPorExercicio.min`, então o PISO ponderado do dia
     * (direta 1,0 + indireta 0,5, todas no piso) é o menor valor que aquele dia pode ter.
     * Se o dia nascer acima de `tetoDaSessao` já no piso, nenhuma poda o conserta sem furar o
     * piso por exercício — e o excesso ficaria. Medido em avançado 6d/90min: 5 slots de peito
     * no mesmo dia (15 contra 12) e, depois de limitar a 4, ainda 14 pelo indireto do tríceps.
     *
     * 🔒 Não é dose: nenhum slot muda de séries por causa disto. E fora da hipertrofia não há
     * teto de sessão declarado, então também não há teto na composição.
     */
    ...(tetoDaSessao == null ? {} : { tetoPonderadoDia: { teto: tetoDaSessao, seriesPiso: prescricao.seriesPorExercicio.min } }),
    coreMin: CORE_MIN,
    coreMax: CORE_MAX,
    // Disponibilidade é teto: não acrescentar slots só para preencher o dia.
    preencherAteOrcamento: false,
    respeitarGruposDoDia: true,
    /**
     * 🔁 A variação vem do PERFIL, como `divisaoPreferida` e `foco`: é entrada, não estado
     * interno. Ela só desloca o início da rotação dentro do pool já elegível — nenhum filtro,
     * invariante, teto ou reserva muda. Ausente/0 ⇒ a alocação canônica de sempre.
     */
    ...(perfil.variacaoTreino ? { variacao: perfil.variacaoTreino } : {}),
  };
  let diasAlocados = alocarSemana(argsAloc);
  let transferenciaFoco: { de: GrupoPrimario; para: GrupoPrimario } | undefined;
  let relatoTransferenciaFoco = { executada: false, recusadaPeloEquilibrio: false };

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
      /**
       * 🔒 C6 — O DEGRAU ② SÓ VALE SE O SLOT REALMENTE MUDOU DE MÃO.
       *
       * O alocador recusa a troca que derrubaria `puxar ≥ empurrar` (saúde do ombro). Quando
       * recusa, a alocação volta idêntica à passada neutra — e declarar `slot`/"+1 exercício"
       * aqui seria a tela MENTINDO sobre o que o motor fez, que é justamente o que a DF B2
       * (2026-08-14) existe para impedir. Então a cascata desce ao degrau ③ com o motivo
       * certo, como a DF de 2026-08-17 manda: "se quebraria, entrega ORDEM".
       */
      const transferencia = { de: compensadorValido, para: foco.grupo };
      transferenciaFoco = transferencia;
      diasAlocados = alocarSemana({
        ...argsAloc, transferirSlot: transferencia, relatoTransferencia: relatoTransferenciaFoco,
      });
      // A decisão só é confirmada após a eventual segunda alocação de cobertura.
    }
  }

  const padroesTemporaisDaAlocacao = (alocados: typeof diasAlocados): Set<Padrao> => new Set(
    alocados.flatMap((d) => d.slots.map((s) => {
      const p = s.exercicio.padraoMovimento;
      return p === 'dobradica_quadril' ? 'agachar' : p === 'cardio' ? 'core' : p;
    })),
  );
  const coberturaTemporalCompleta = (alocados: typeof diasAlocados): boolean => {
    const presentes = padroesTemporaisDaAlocacao(alocados);
    return COBERTURA_TEMPORAL_OBRIGATORIA.every((p) => presentes.has(p));
  };
  // A alocação normal continua sendo a primeira escolha. Somente quando ela falha na cobertura
  // obrigatória, refazemos a semana com reserva coverage-first; isso evita reordenar planos já válidos.
  if (!coberturaTemporalCompleta(diasAlocados)) {
    relatoTransferenciaFoco = { executada: false, recusadaPeloEquilibrio: false };
    diasAlocados = alocarSemana({
      ...argsAloc,
      ...(transferenciaFoco ? { transferirSlot: transferenciaFoco, relatoTransferencia: relatoTransferenciaFoco } : {}),
      coberturaTemporalObrigatoria: COBERTURA_TEMPORAL_OBRIGATORIA,
    });
  }

  // DF B2: "+1 exercício" descreve uma transferência efetiva na alocação final.
  // Não inferimos a causa específica quando nenhuma troca foi executada.
  if (transferenciaFoco && !relatoTransferenciaFoco.executada) {
    decisaoFoco = {
      degrau: 'ordem', series: 0, moveSlot: false,
      motivo: relatoTransferenciaFoco.recusadaPeloEquilibrio
        ? 'equilibrio_puxar_empurrar' : 'transferencia_nao_realizada',
    };
  }

  /**
   * 🔒 O ORÇAMENTO DIÁRIO — AUTORIDADE ÚNICA DOS DOIS CAMINHOS.
   *
   * `undefined` quando a pessoa escolheu **75+** (`limiteTempoTreino: 'sem_limite'`): aí não
   * existe orçamento a estourar, e portanto não há o que degradar.
   *
   * 🔴 Conserto 2026-09-15: o caminho do DESENHO DA PESSOA (o editor guiado, logo abaixo)
   * calculava o seu próprio orçamento como `tempoPorSessaoMin * 60` e ignorava o 75+, que o
   * caminho automático já respeitava. Consequência medida em 17 de 34 cenários: abrir o editor
   * sobre um plano 75+ e salvar sem editar nada rebaixava o descanso do dia inteiro — `e16`
   * saía de 4 × 150 s no plano para 4 × 90 s na prévia, e era isso que seria gravado. Os dois
   * caminhos continuam com a sua própria mecânica de degradação; o que passa a ser um só é o
   * FATO de haver ou não limite.
   */
  const limiteDiarioSegundos = perfil.limiteTempoTreino === 'sem_limite'
    ? undefined
    : perfil.tempoPorSessaoMin * 60;

  /**
   * 🦴 COBERTURA ANATÔMICA E COMPLEMENTARIDADE MECÂNICA (mapa dos 168 ids) ────────────────
   *
   * 🔒 AQUI, e não dentro de `alocarSemana`: quando esta linha roda, a alocação FINAL já está
   * escolhida — a passada neutra, a decisão da cascata do foco, a eventual transferência de
   * slot e a eventual realocação coverage-first já aconteceram e já foram lidas. Nada do que
   * o passe faz pode voltar a alimentar uma decisão tomada antes dele.
   *
   * 🔴 O defeito que isto fecha, medido: com o passe dentro do alocador, a 1ª passada já saía
   * trocada, e `coberturaTemporalCompleta` — que lê `padraoMovimento` dos exercícios — via
   * outra semana e disparava uma realocação que não teria acontecido. Em foco/ombros 4d/60 o
   * dia "Peito + Tríceps" terminava com dois desenvolvimentos (180 s) no lugar de duas
   * elevações laterais (90 s), a degradação de descanso descia um degrau e o dia mudava de
   * 12 880 s para 12 500 s. Ninguém autorizou a cobertura anatômica a mexer no foco.
   *
   * Dentro de cada slot, troca o exercício por outro do MESMO grupo quando ele aborda um alvo
   * direto do dia ainda descoberto, ou traz uma tarefa mecânica que o grupo ainda não tem
   * naquele dia. Não cria slot, série, tempo ou descanso.
   *
   * 🔵 A ALTERNATIVA DE OUTRA CLASSE É RECALCULADA, NÃO REPROVADA (correção 2026-09-17).
   *
   * Até aqui o passe só aceitava troca de ASSINATURA DE CUSTO idêntica, e a complementaridade
   * real quase nunca tem a mesma classe: a flexora que abre a cabeça curta do bíceps femoral é
   * ISOLADA ao lado de uma dobradiça, o encolhimento que abre o trapézio superior é ISOLADO ao
   * lado de remadas, a abdução que abre glúteo médio e mínimo é ISOLADA ao lado da extensão de
   * quadril. Todas descansam outro tanto — e quase todas são MAIS BARATAS.
   *
   * Agora, quando a assinatura difere, o passe pergunta à autoridade de duração se o dia
   * ficaria mais caro, nos TRÊS níveis de degradação. Comparar os três (e não só "cabe no
   * orçamento") é o que garante, por construção, que nada do que vem depois se mexe: a
   * degradação escolhida por `degradarAteCaber` não pode subir, `reduzirDiaPorTempo` não pode
   * passar a cortar séries, e a certificação final não pode mudar de lado.
   */
  const rirAlvoDaTroca = prescricao.rirAlvoSemana ?? rirAlvoDaSemana(prescricao.rir, semanaCiclo?.semana ?? 1);
  /**
   * 🔒 Memo por CONJUNTO de ids + degradação. A duração de um dia não depende de quem
   * perguntou nem de quantas vezes: o passe avalia o mesmo "antes" a cada candidato, e sem
   * isto a montagem ficava lenta o bastante para estourar o tempo dos testes de dose do
   * editor. A chave é o conteúdo, então o memo nunca devolve resposta de outro dia.
   */
  const memoCusto = new Map<string, number>();
  const custoDoDiaParaCobertura = (exercicios: readonly Exercise[], degradacao: 0 | 1 | 2): number => {
    const chave = `${degradacao}|${exercicios.map((e) => e.id).join(',')}`;
    const cache = memoCusto.get(chave);
    if (cache !== undefined) return cache;
    const valor = avaliarDuracaoSessao({
      itens: exercicios.map((e) => ({
        tipo: 'RESISTIDO' as const,
        series: prescricao.seriesPorExercicio.max,
        descansoEntreSeriesSeg: descansoDoExercicio({
          exercicio: e, rirAlvo: rirAlvoDaTroca, modoForca: prescricao.modoForca === true,
          semanaRampa: semanaCiclo?.retomada?.semana ?? null, degradacao,
        }) ?? 0,
        execucao: execucaoResistidaDe(e, perfil.nivelExperiencia),
        unilateralDoisLados: resolverExecucao(e.id, e.execucao) === 'UNILATERAL_DOIS_LADOS',
        tecnica: { tipo: 'SEM_TECNICA' as const },
      })),
    }).duracaoMaximaEstimadaSegundos ?? Number.POSITIVE_INFINITY;
    memoCusto.set(chave, valor);
    return valor;
  };
  const trocasAnatomicas = otimizarCoberturaAnatomica(
    diasAlocados.map((dia, d) => ({ grupos: templates[d]!.grupos, slots: dia.slots })),
    (g, favorito) => pool.filter((e) => e.grupoPrimario === g && e.padraoMovimento !== 'cardio'
      && favoritosEfetivos.has(e.id) === favorito),
    {
      seriesPlanejamento: prescricao.seriesPorExercicio.max,
      // O passe conclui o baseline antes dos extras: a seleção não depende do foco.
      // As guardas de custo, crédito, função e favoritos continuam valendo.
      gruposPreservados: [],
      /**
       * 🔒 "Não ficou mais caro" nos TRÊS níveis, e não "ainda cabe". A diferença importa: um
       * dia que ainda cabe pode ter consumido a folga que a rampa e a poda usariam depois.
       * A comparação é sempre feita, inclusive em 75+ (sem orçamento não há o que estourar,
       * mas um dia mais longo continua sendo um dia mais longo).
       */
      custoDoDiaNaoAumenta: (d, depois) => {
        const antes = diasAlocados[d]!.slots.map((s) => s.exercicio);
        return ([0, 1, 2] as const).every((deg) =>
          custoDoDiaParaCobertura(depois, deg) <= custoDoDiaParaCobertura(antes, deg));
      },
      /**
       * 🔵 A ADIÇÃO CONTROLADA (decisão do autor, 2026-09-17): as TRÊS margens, cada uma
       * respondida pela autoridade que já existe.
       *
       * 🔒 Fora do ciclo normal ela não roda. Na RETOMADA o volume é deliberadamente cortado
       * (50–70%) e um exercício a mais desfaria a rampa; no DELOAD o plano-base já vem podado
       * ao teto da semana cheia, e acrescentar ali seria a redução dupla que a política
       * proíbe. Nos dois casos o passe continua trocando — só não acrescenta.
       */
      ...(semanaCiclo?.retomada || deloadAgendado ? {} : {
        adicao: {
          /** ESTRUTURA: o orçamento de slots do dia é o mesmo do alocador, sem exceção. */
          slotsLivres: (d: number) => Math.max(0, budgetPorDia - diasAlocados[d]!.slots.length),
          // Core usa séries adicionais depois do baseline. Sua cobertura pode receber
          // um slot dentro das margens, independentemente da escolha de foco.
          gruposPreservados: [],
          /**
           * ESTRUTURA DO GRUPO: os MESMOS tetos de slots por semana que `alocarSemana`
           * recebeu — `tetoSlotsSemana` para os pequenos e `CORE_MAX` para o core. Frequência
           * e recuperação continuam sendo decisão do alocador, e a cobertura não as revisa.
           */
          cabeNoTetoDeSlots: (novo: Exercise, d: number) => {
            const g = novo.grupoPrimario;
            if (!g) return false;
            const jaTem = diasAlocados.flatMap((x) => x.slots).filter((s) => s.grupo === g).length;
            const teto = g === 'core'
              ? CORE_MAX
              : (GRUPOS_PEQUENOS_PISO as readonly string[]).includes(g) ? tetoPequenos : Number.POSITIVE_INFINITY;
            if (jaTem + 1 > teto) return false;
            /**
             * 🔵 UM COMPLEMENTAR POR DIA (decisão do autor, 2026-09-19) — a mesma régua do
             * alocador: core, panturrilha e antebraço entram uma vez por dia, e o dia que não é
             * dedicado a eles comporta um só. Medido antes desta trava: a adição punha um segundo
             * core no dia "Braços + Core" (quadrado lombar) — dois complementares no mesmo dia.
             */
            if (ehComplementar(g)) {
              if (!templates[d]!.grupos.includes(g)) return false;
              const slotsDoDia = diasAlocados[d]!.slots;
              if (slotsDoDia.some((s) => s.grupo === g)) return false;
              if (!ehDiaDisponivel(templates[d]!.grupos) && slotsDoDia.some((s) => ehComplementar(s.grupo))) return false;
            }
            return true;
          },
          /**
           * TEMPO: o dia tem de continuar cabendo no MESMO degrau de descanso. Não basta
           * "ainda cabe": se o exercício a mais empurrasse o dia para o degrau seguinte, o
           * descanso de todos os outros slots cairia — que é exatamente o efeito colateral
           * que a cobertura não tem direito de comprar.
           */
          cabeNoTempo: (d: number, depois: readonly Exercise[]) => {
            if (limiteDiarioSegundos === undefined) return true;
            const degrauMinimo = (exs: readonly Exercise[]): 0 | 1 | 2 | null => {
              for (const deg of [0, 1, 2] as const) {
                if (custoDoDiaParaCobertura(exs, deg) <= limiteDiarioSegundos) return deg;
              }
              return null;
            };
            const antes = degrauMinimo(diasAlocados[d]!.slots.map((s) => s.exercicio));
            const agora = degrauMinimo(depois);
            return agora !== null && antes !== null && agora <= antes;
          },
          /**
           * VOLUME: crédito ponderado (direto 1,0 + indireto 0,5) do exercício novo somado ao
           * que a semana e o dia já têm, contra os MESMOS tetos que a poda usa. Nenhum grupo
           * é reduzido para abrir espaço — se não couber, o exercício não entra.
           */
          cabeNoVolume: (d: number, novo: Exercise) => {
            const s = prescricao.seriesPorExercicio.max;
            const comSeries = (slots: readonly { exercicio: Exercise }[]) =>
              creditoPonderadoDaSemana(slots.map((x) => ({ exercicio: x.exercicio, series: s })));
            const semana = comSeries(diasAlocados.flatMap((x) => x.slots));
            const sessao = comSeries(diasAlocados[d]!.slots);
            const doNovo = creditoPonderadoDaSemana([{ exercicio: novo, series: s }]);
            for (const [g, n] of doNovo) {
              if ((semana.get(g) ?? 0) + n > tetoSemanalGrupo(g)) return false;
              if (tetoDaSessao != null && (sessao.get(g) ?? 0) + n > tetoDaSessao) return false;
            }
            return true;
          },
        },
      }),
    },
  );
  /**
   * 🔒 Slot pedido que a cobertura PREENCHEU deixa de ser slot vazio — e o dia não pode
   * continuar dizendo que ficou curto. Sem isto, o plano acrescentaria o exercício e ainda
   * assim avisaria "este dia ficou mais curto de propósito", que é o motor mentindo sobre o
   * que ele mesmo fez.
   */
  for (const t of trocasAnatomicas) {
    if (t.de !== null) continue;
    const dia = diasAlocados[t.dia]!;
    dia.naoPreenchidos = Math.max(0, dia.naoPreenchidos - 1);
    if (dia.naoPreenchidos === 0) dia.motivoCurto = null;
  }
  void trocasAnatomicas;

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
  /**
   * 🔒 `desenhoDaPessoa` é DECLARADO pelo chamador, não deduzido.
   *
   * 🔴 Revisão independente 14/09 (fragilidade registrada): a versão anterior decidia isso
   * comparando `diasTreino !== diasUsuarioCustom` — identidade de REFERÊNCIA de um parâmetro
   * que esta mesma função reatribui quatro vezes mais abaixo (deload, realocação, fase A e
   * bloco). Hoje todas as reatribuições ficam DEPOIS do bloco da retomada e a comparação
   * acerta; mover qualquer uma para cima faria a rampa parar de ler a escolha EM SILÊNCIO,
   * sem teste que pegasse. Uma flag do chamador não tem esse acoplamento.
   */

  function montarSaida(diasTreino: DiaTreino[], split: string, desenhoDaPessoa = false): RotinaSemanal {
    let focoCoreAdicional: { solicitadas: number; entregues: number } | undefined;
    /** Os recortes do foco de pernas que de fato valeram (para o motivo dos complementares). */
    let recortesEntreguesDoFoco: readonly { grupos: readonly GrupoPrimario[] }[] | undefined;
    let blocoFoco: RotinaSemanal['blocoFoco'];
    /**
     * 🔵 A EXCEÇÃO AO TETO POR SESSÃO (decisão de 2026-09-17, 2ª volta) — o que SOBROU depois
     * de esgotadas as alternativas, publicado com o plano. Vazio é o caso normal.
     */
    let excecoesDeSessao: ExcecaoDeSessao[] = [];
    /** Extras do foco que sobreviveram: o invariante puxar≥empurrar é do BASELINE. */
    const extrasDoFoco = new Set<SlotExercicio>();
    // Um dia: todos os grupos diretos vigentes, um exercício por grupo antes
    // de distribuir séries. Crédito indireto não substitui esta cobertura.
    if (automatico && diasForca === 1 && diasTreino[0]) {
      const dia = diasTreino[0];
      const grupos = [...GRUPOS_GRANDES, ...GRUPOS_PEQUENOS_PISO.filter(g => !ehComplementar(g)), ...templates[0]!.grupos.filter(ehComplementar)];
      const vistos = new Set<GrupoPrimario>();
      dia.slots = dia.slots.filter(s => {
        const g = s.exercicio.grupoPrimario;
        if (!g || vistos.has(g)) return false;
        vistos.add(g); return true;
      });
      for (const g of grupos) if (!vistos.has(g)) {
        const saldoPuxar = dia.slots.filter(s => s.padrao === 'puxar').length
          - dia.slots.filter(s => s.padrao === 'empurrar').length;
        const ex = pool.find(e => e.grupoPrimario === g
          && (e.padraoMovimento !== 'empurrar' || saldoPuxar > 0));
        if (ex) dia.slots.push({exercicio: ex, padrao: ex.padraoMovimento});
        else avisos.push(`Sem exercício elegível para ${ROTULO_GRUPO[g]} no full-body.`);
      }
    }
    // --- Orçamento de tempo: DEGRADAÇÃO do descanso p/ a sessão caber -----------
    // v4: o nº de slots vem da tabela f(tempo) (`orcamentoSlotsDoDia`); o que o orçamento
    // decide aqui é o NÍVEL DE DEGRADAÇÃO do descanso (regra 3 — cede ISOLADO até 60 s,
    // depois COMPOSTO até 90 s; cobertura > descanso). A mecânica de descanso por classe
    // (armadilha 2 do handoff) fica intocada — muda só quem pede a degradação.
    let descansoEfetivo: Faixa = prescricao.descansoCompostoSeg;
    const nivelDegradacaoDia: (0 | 1 | 2)[] = diasTreino.map(() => 0);
    if (semanaCiclo && !automatico) {
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

      /**
       * 🔒 SÉRIES DO DIA PARA A ESTIMATIVA — as DECLARADAS pelo desenho, quando existem.
       *
       * 🔴 Conserto 2026-09-15 (2ª causa da divergência plano × editor): `custoDia` projetava
       * `sPlan` para TODOS os slots, enquanto o caminho automático decide a degradação sobre as
       * séries REAIS de cada slot. Num desenho com 4+3+3+3+3 séries, estimar 4 em cada um
       * inflava o dia em 4 séries inteiras, o dia "não cabia" e o descanso descia um degrau —
       * abrir o editor sobre o plano e salvar sem editar rebaixava 180 s para 120 s no dia de
       * costas do perfil real. `seriesPorExercicio` é a escolha que o próprio desenho carrega e
       * que o motor vai aplicar logo abaixo: usá-la não é regra nova, é parar de estimar o que
       * já está decidido. Sem declaração, continua valendo `sPlan`.
       */
      const seriesDeclaradas = (dia: DiaTreino, s: SlotExercicio): number => {
        const desenho = custom?.dias.find((d, k) => (d.diaId ?? diasForcaDaSemana[k]) === dia.diaId);
        const n = desenho?.seriesPorExercicio?.[s.exercicio.id];
        const valida = Number.isInteger(n) && (n as number) >= 1 && (n as number) <= SERIES_MANUAIS_MAX;
        if (!valida) return sPlan;
        // 🔒 A MESMA redução que o bloco de recuperação aplica à escolha mais abaixo: o editor
        // manda a dose ANTES do deload (é o que a pessoa vê e edita), e o dia vai rodar com a
        // dose reduzida. Estimar pela dose cheia degradaria o descanso de um dia que cabe.
        return deloadAgendado ? seriesEmDeload(n as number) : (n as number);
      };

      // 🔒 C1 §5.4 — a estimativa de PLANEJAMENTO não mantém aritmética própria: projeta itens
      // (séries declaradas ou sPlan, execução por tipo, descanso por padrão no nível de
      // degradação) e chama a MESMA fórmula canônica, usando a MAX da faixa (o pior caso de
      // ocupação do dia). Ela decide só a DEGRADAÇÃO; a CERTIFICAÇÃO do plano final roda sobre
      // as séries/descansos reais.
      const custoDia = (dia: DiaTreino, slots: readonly SlotExercicio[], nivel: 0 | 1 | 2): number => {
        const itens = slots.map((s) => ({
          tipo: 'RESISTIDO' as const,
          series: seriesDeclaradas(dia, s),
          descansoEntreSeriesSeg: descansoDoExercicio({ exercicio: s.exercicio,
            rirAlvo, modoForca: prescricao.modoForca === true, semanaRampa, degradacao: nivel,
          }) ?? 0,
          execucao: execucaoResistidaDe(s.exercicio, perfil.nivelExperiencia),
          // O planejamento usa a mesma lateralidade curada da certificação final:
          // somente DOIS_LADOS dobra o tempo de execução, antes de decidir degradar
          // descanso ou reduzir a capacidade.
          unilateralDoisLados:
            resolverExecucao(s.exercicio.id, s.exercicio.execucao, s.execucaoSelecionada) === 'UNILATERAL_DOIS_LADOS',
          tecnica: { tipo: 'SEM_TECNICA' as const },
        }));
        return avaliarDuracaoSessao({ itens }).duracaoMaximaEstimadaSegundos ?? Number.POSITIVE_INFINITY;
      };

      /**
       * 🟡 EXCEÇÃO NOMEADA, durante a rampa: o piso do FIT é INVIOLÁVEL, então não há
       * degradação (o volume da retomada já está cortado 50–70% — sobra tempo).
       */
      for (let i = 0; i < diasTreino.length; i += 1) {
        // 🟡 Sem rampa e COM orçamento: degrada até caber. Em 75+ não há orçamento — e o que
        // não tem limite não tem por que ceder descanso (mesma leitura do caminho automático).
        if (semanaRampa != null || limiteDiarioSegundos === undefined) break;
        const dia = diasTreino[i]!;
        let nivel: 0 | 1 | 2 = 0;
        while (nivel < 2 && custoDia(dia, dia.slots, nivel) > limiteDiarioSegundos) nivel = (nivel + 1) as 1 | 2;
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
     * Decisão de produto 13/09: braços/ombros antes dos demais; manual conserva ordem.
     *
     * 🔴 Revisão independente 15/09 (D-02) — A REORDENAÇÃO SAIU DAQUI PARA O FIM DA MONTAGEM.
     *
     * Ela rodava ANTES da rampa de volume, e a rampa distribui as séries em round-robin na
     * ordem (dia, slot): reordenar antes fazia o mesmo baseline receber uma divisão de séries
     * diferente só por existir um foco — e, com o teto estrito, uma divisão diferente muda o
     * dia que estoura e o exercício que sai. Era mais um caminho pelo qual o foco cobrava de
     * terceiros. Agora a ordem é decidida uma única vez, no fim, já com o bloco no dia (a
     * mesma regra, o mesmo `ordenarComFoco`).
     */

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
    // clampado a seriesPorExercicio {min..max}.
    //
    // 🔴 D2/D9 (diagnóstico 2026-09-10, §6.3): a semana 6 PULAVA este bloco inteiro e saía sem
    // séries — `NAO_AVALIADO_ENTREGAVEL` com um motivo "séries ausente" por slot, `duracaoDias`
    // toda em `NAO_AVALIADO`, e o número exibido decidido por `lib/series-treino · seriesDoSlot`
    // com régua PRÓPRIA (`ceil(base/2)` ≈ −50 %). O comentário antigo apostava em `aplicarDeload`
    // — que, medido, **não tinha nenhum chamador de produção**. Eram duas autoridades, e a que
    // valia era a da tela.
    //
    // 🔒 Agora a redução acontece UMA vez e AQUI: a banda da semana 6 é a banda da prescrição
    // passada por `aplicarDeload` (`DELOAD_REDUCAO_VOLUME = 0.45`, a constante já registrada —
    // nenhum percentual novo). A retomada continua supersedendo o mesociclo: ela já é um deload,
    // e somar os dois seria o corte duplo que o ramo antigo temia.
    const ret = semanaCiclo?.retomada;
    if (semanaCiclo) {
      const { semana, feedbackGrupos } = semanaCiclo;
      // A banda da ALOCAÇÃO vem da prescrição — como a do orçamento de tempo acima. Uma
      // banda literal em qualquer um dos dois pontos seria número solto fora do cofre. Na
      // semana de deload é a MESMA prescrição passada por `aplicarDeload` — um único ponto
      // de redução, as duas réguas de volume juntas.
      const prescricaoDaSemana = deloadAgendado ? aplicarDeload(prescricao) : prescricao;
      const banda = prescricaoDaSemana.volumePorGrupoSemana;
      const sMin = prescricaoDaSemana.seriesPorExercicio.min;
      const sMax = prescricaoDaSemana.seriesPorExercicio.max;
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
       * 🔵 A REPARTIÇÃO NÃO DEPENDE DA ORDEM DE EXIBIÇÃO (correção 2026-09-17).
       *
       * 🔴 O defeito medido: a rampa reparte em round-robin na ordem (dia, slot) e o ramo
       * automático REORDENA os slots depois (`reordenarPeloFoco`, movido para o fim da
       * montagem pela revisão D-02). O editor persiste a ordem FINAL; ao reabrir, a mesma
       * rampa roda sobre a outra permutação e o mesmo total do grupo cai em slots
       * diferentes. Medido neste candidato: `qui/e54=1 e41=2` no plano contra `e54=2 e41=1`
       * no editor — total idêntico, série trocada de exercício.
       *
       * 🔒 O conserto é ordenar por IDENTIDADE (dia, id do exercício), não por posição: o
       * dia continua sendo o primeiro critério (ele é do plano, não da tela) e, dentro dele,
       * dois planos com os mesmos exercícios repartem igual, na ordem que a tela quiser
       * mostrar. Nada aqui muda QUANTO o grupo recebe — só qual slot recebe cada série.
       *
       * 🔵 O DESEMPATE POR SECUNDÁRIOS (2026-09-17, 2ª volta) — medido, não estético.
       *
       * ⚠️ Ordenar só por `id` é estável, mas arbitrário quanto ao que o slot ENTREGA: a
       * sobra do round-robin passava a cair num exercício sem secundário grande, e o crédito
       * indireto de um terceiro caía 0,5 junto. Varredura A/B de 22 680 combinações (3
       * inventários × 3 objetivos × 3 níveis × 1–7 dias × 5 tempos × 2 limites × 6 semanas ×
       * com/sem foco), comparando a ordem por posição com a ordem por identidade:
       * **255 células ganharam um aviso de grupo abaixo do mínimo** e só 2 perderam.
       *
       * 🔒 Com o desempate por número de secundários GRANDES antes do `id`, a mesma varredura
       * dá **0 avisos novos e 319 a menos** contra a ordem por identidade pura, e 40 a mais
       * contra 106 a menos em relação à ordem por posição — melhor que as duas, e continua
       * independente da ordem de exibição, porque a chave só olha para o exercício.
       *
       * 🔴 Ele NÃO muda quanto o grupo recebe: é desempate DENTRO do mesmo grupo, entre
       * slots do mesmo dia. O que muda é qual exercício carrega a série sobrando — e, com
       * ela, o crédito indireto que essa série espalha.
       */
      const secGrandes = (s: SlotExercicio) => secundariosDe(s.exercicio).filter((g: GrupoPrimario) => (GRUPOS_GRANDES as readonly string[]).includes(g)).length;
      for (const arr of porGrupo.values()) {
        arr.sort((a, b) => (diaDoSlot.get(a) ?? 0) - (diaDoSlot.get(b) ?? 0)
          || secGrandes(b) - secGrandes(a)
          || (a.exercicio.id < b.exercicio.id ? -1 : a.exercicio.id > b.exercicio.id ? 1 : 0));
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

      /**
       * 🔴 RETOMADA — A ESCOLHA MANUAL É TETO DA RAMPA, NÃO REFÉM DA POSIÇÃO DELA.
       *
       * Medido no candidato `5d81d227` (validação de coordenação, 14/09): a rampa reparte o
       * volume do grupo em round-robin na ordem (dia, slot) e o ramo automático REORDENA os
       * slots depois (`reordenarPeloFoco`, movido para o fim da montagem pela revisão D-02).
       * O desenho que a pessoa vê — e que o editor persiste — está na ordem final; ao reabrir,
       * a mesma rampa roda sobre a OUTRA permutação e devolve o mesmo total do grupo repartido
       * em outros slots. O `min(escolhida, série do slot)` do aplicador manual guardava então o
       * MENOR de duas permutações: ombros `3/3/2/3` contra `3/3/3/2` saía `3/3/2/2` — uma série
       * sumia por acidente de ordenação, em 36 de 96 contextos de rampa.
       *
       * 🔒 A intenção entra AQUI, como teto do slot ao lado do teto de IRV. Os três
       * guarda-corpos da retomada seguem intactos (frequência por grupo, teto por slot,
       * volume-alvo do grupo). Sem escolha válida o teto é o de sempre.
       *
       * 🔴 Revisão independente 14/09 — A ESCOLHA SÓ FALA PELO PRÓPRIO SLOT.
       *
       * Medido no candidato `cf88f9b`: entrar como teto sem mais nada fazia a folga liberada
       * por um slot reduzido voltar ao round-robin e SUBIR um slot sobre o qual a pessoa não
       * disse nada — em 121 casos medidos (`seg/e130 2→1` levava `seg/e100 1→2`, total 85
       * intacto). É exatamente a compensação de total em outro exercício que o contrato
       * vigente (`min(escolhida, série do slot)`, em `5d81d227`) nunca fez. O slot SEM
       * escolha passa a ser limitado pela repartição que ele teria se ninguém tivesse falado
       * — ver `repartir` abaixo.
       *
       * 🔴 Revisão independente 14/09 — E SÓ FALA NO DESENHO DA PESSOA.
       *
       * `custom` existe também quando o desenho não tem exercício elegível nenhum e a
       * montagem cai no plano ALOCADO (`diasUsuarioCustom == null`). Medido no candidato:
       * uma escolha velha guardada nesse desenho vazio cortava o plano alocado de `3/3/3/2`
       * para `1/1/1/1` — intenção manual aplicada a um plano que a pessoa não desenhou. O
       * aplicador manual (`seriesDefinidasPeloUsuario`) nunca roda nesse caminho; este
       * também não deve. Os DOIS fallbacks existem e são distintos: desenho com dias SEM
       * `exercicioIds` cai no plano ALOCADO (`diasUsuarioCustom == null`); desenho com ids
       * INELEGÍVEIS fica no ramo manual com zero dias (`diasUsuarioCustom === []`, ver o
       * `||` da construção). Nem um nem outro é desenho da pessoa para efeito de dose.
       */
      const escolhaManualDoSlot = (s: SlotExercicio): number | undefined => {
        if (!custom || !desenhoDaPessoa) return undefined;
        const diaId = diasTreino[diaDoSlot.get(s) ?? 0]?.diaId;
        const desenho = custom.dias.find((d, i) => (d.diaId ?? diasForcaDaSemana[i]) === diaId);
        const escolhida = desenho?.seriesPorExercicio?.[s.exercicio.id];
        // Mesma trava de TAMANHO do aplicador manual; o aviso continua lá, uma vez só.
        return typeof escolhida === 'number' && Number.isInteger(escolhida)
          && escolhida >= 1 && escolhida <= SERIES_MANUAIS_MAX ? escolhida : undefined;
      };

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
          // 🔒 C2 — a unidade é SESSÃO, não slot: "1× por sessão em que o grupo apareceu, não
          // por exercício" (DF 2026-07-27, a mesma data da tabela FIT), e é o que este motor
          // já declara em `geracao-temporal` ("frequência é presença em dias distintos, nunca
          // nº de slots"). Cortar pela contagem de slots tirava exercício de grupo que já
          // estava dentro do teto — e ainda atribuía a perda à frequência.
          const diasDoGrupo = [...new Set(todos.map((s) => diaDoSlot.get(s) ?? 0))].sort((a, b) => a - b);
          const diasMantidos = new Set(Number.isFinite(fMax) ? diasDoGrupo.slice(0, fMax) : diasDoGrupo);
          const slots = todos.filter((s) => diasMantidos.has(diaDoSlot.get(s) ?? 0));
          for (const s of todos) if (!diasMantidos.has(diaDoSlot.get(s) ?? 0)) descartar.add(s);
          const n = slots.length;
          if (n === 0) continue;
          const tetoIRV = slots.map((s) => {
            const comCarga = temCarga(s.exercicio);
            const reps = (s.padrao === 'isolado' ? prescricao.repsIsolado : prescricao.repsComposto).max;
            // %1RM estimado por Epley invertido (mesma leitura do %1RM que a sessão exibe);
            // sem carga o IRV é incomputável → teto fixo de 3 (DF 2026-07-27).
            return tetoSeriesDaRetomada({ comCarga, reps, pct1rm: 30 / (30 + reps) });
          });
          const escolha = slots.map((s) => escolhaManualDoSlot(s));
          /** O round-robin de sempre: piso 1 por slot, teto por slot, ordem (dia, slot). */
          const repartir = (tetos: readonly number[]): number[] => {
            const series = slots.map(() => 1); // piso operacional: 1 série por exercício
            let restante = Math.max(0, alvoGrupo - n);
            let i = 0;
            let travas = 0;
            while (restante > 0 && travas < n) {
              if (series[i]! < tetos[i]!) { series[i]!++; restante--; travas = 0; } else { travas++; }
              i = (i + 1) % n;
            }
            return series;
          };
          const cota = repartir(tetoIRV);
          // Automático permanece na repartição original. Só o desenho pode usar fotografia.
          const doses = desenhoDaPessoa ? aplicarDoseReferenciada(slots.map((s, k) => {
            const diaId = diasTreino[diaDoSlot.get(s) ?? 0]?.diaId;
            const desenho = custom?.dias.find((d, i) => (d.diaId ?? diasForcaDaSemana[i]) === diaId);
            return { id: s.exercicio.id, escolha: escolha[k], referencia: desenho?.referenciaDose };
          }), cota, tetoIRV, alvoGrupo, contextoDaDose(ret)!) : cota;
          slots.forEach((s, k) => { s.series = doses[k]!; });
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
         * documento).
         *
         * 🔵 2026-09-17 — em HIPERTROFIA o número deixou de sair de `semanal ÷ frequência` e
         * passou a ser fixo (12 ponderadas). Aqui ele entra como teto DIRETO da repartição —
         * uma pré-filtragem barata, porque série direta ≤ série ponderada. A conta ponderada
         * de verdade (com o crédito indireto dos outros grupos do dia) é cobrada UMA vez,
         * depois que todas as séries estão decididas, por `podarExcessoPonderadoNaSessao`:
         * dentro deste laço ela dependeria da ordem em que os grupos são visitados.
         *
         * 🔒 Fora da hipertrofia nada muda: a frequência REAL do grupo nesta semana (nº de
         * dias com slot dele) continua dividindo o teto semanal — full-body 3× divide por 3.
         */
        const diasDoGrupo = new Set(slots.map((s) => diaDoSlot.get(s) ?? 0)).size;
        const tetoSessao = tetoSeriesGrupoNaSessao(perfil.nivelExperiencia, objetivoDoVolume, Math.max(1, diasDoGrupo));
        const noDia = new Map<number, number>();
        for (const s of slots) noDia.set(diaDoSlot.get(s) ?? 0, (noDia.get(diaDoSlot.get(s) ?? 0) ?? 0) + sMin);
        if (alvo > base) {
          /**
           * 🔵 AVISO REMOVIDO em 2026-09-17 (2ª volta) — **a faixa desejada não é meta
           * obrigatória no topo**.
           *
           * 🔑 O que a frase antiga dizia: *"Semana 3: alvo de 16 séries para posterior não
           * cabe em 3 exercício(s) — planejadas 12."* Medida na varredura das 756 células,
           * ela saía **1 355 vezes — e em 1 300 delas o grupo terminava DENTRO da faixa
           * desejada** (um intermediário com 12 numa faixa de 10–14, um iniciante com 6
           * numa de 6–10). Era insuficiência anunciada por não se ter chegado ao topo, que
           * é exatamente o que a decisão proíbe.
           *
           * 🔒 E ela comparava MOEDAS DIFERENTES: `alvo` é ponderado (a rampa mira a conta
           * canônica) e `tetoGrupo` é `slots × sMax`, série DIRETA. Posterior "12 contra 16"
           * entregava 15 ponderadas — a diferença real era 1, não 4.
           *
           * 🔒 O déficit de verdade continua com voz, e com o critério pertinente: o guard
           * de cobertura (`medirCobertura`) mede o volume PONDERADO entregue contra o MEV,
           * separa causa de catálogo de causa de orçamento e publica o fato — uma voz por
           * fato (D16). A distinção entre faixa desejada, meta adaptada, volume entregue e
           * teto continua publicada em `faixaVolumeSemana` e `tetoVolumeSemana`.
           */
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

    if(automatico){
      // Autor14/09: as séries do baseline já foram decididas pela rampa. A adição
      // não redistribui essas séries; o deload continua reduzindo uma única vez.
      /**
       * ⚠️ `seriesAntesDoCorteDeTempo` é ZERADO aqui, de propósito. Os dias vêm da montagem
       * interna da semana CHEIA, que já rodou a própria fase A; herdar aquela referência faria
       * o corte da semana 6 aparecer como "4 → 1" — medido —, somando ao tempo uma redução que
       * foi do DELOAD. A fase A desta semana registra os seus próprios cortes, contra a dose
       * já reduzida, e cada causa fica com o que é dela.
       */
      if(rotinaBaseDoDeload) diasTreino=rotinaBaseDoDeload.dias.map(d=>({...d,slots:d.slots.map(s=>({...s,seriesAntesDoDeload:s.series,seriesAntesDoCorteDeTempo:undefined,series:seriesEmDeload(s.series??0)}))}));
      /**
       * 🔒 O AJUSTE DO PLANO-BASE TAMBÉM É DITO NA SEMANA 6.
       *
       * Medido na varredura desta correção: em 40 das 3 888 células — todas S6 — o volume
       * entregue caiu e NENHUMA frase saiu. A razão: quem podou foi a montagem interna do
       * plano-base (`rotinaBaseDoDeload`), cujos avisos são descartados; na semana 6 a poda
       * não tem mais nada a cortar e fica calada. Quem abre o app direto na semana 6 nunca
       * viu a frase da semana 5, e a redução ficaria sem causa na tela — exatamente o defeito
       * que o relato de 15/09 descreve, de outro lado.
       *
       * 🔒 Sem nomear grupo: os nomes são da semana CHEIA, e repeti-los aqui afirmaria da
       * semana 6 um corte que não aconteceu nela.
       */
      if(rotinaBaseDoDeload?.avisos.some(a=>a.includes(MARCA_PODA_TETO)))avisos.push('O plano-base desta semana de deload já vinha ajustado para não passar do máximo de volume da semana cheia. Por isso alguns grupos entram com menos séries do que a rampa pediria, antes mesmo da redução do deload.');
      const rirAlvo=prescricao.rirAlvoSemana??rirAlvoDaSemana(prescricao.rir,semanaCiclo?.semana??1);
      const limiteDia=limiteDiarioSegundos;
      /** Descanso pela autoridade única (`descansoDoExercicio`), no nível pedido. */
      const aplicarDescanso=(d:DiaTreino,degradacao:0|1|2)=>{
        for(const slot of d.slots){
          const descanso=descansoDoExercicio({exercicio:slot.exercicio,rirAlvo,modoForca:prescricao.modoForca,semanaRampa:semanaCiclo?.retomada?.semana,degradacao});
          if(descanso!=null)slot.descansoSeg=descanso;
        }
      };
      const cabeNoDia=(d:DiaTreino)=>{
        if(limiteDia===undefined)return true;
        const m=avaliarDuracaoResistida(d.slots,perfil.nivelExperiencia,limiteDia);
        return m.estadoCalculo!=='CALCULADO'||(m.duracaoMaximaEstimadaSegundos??Infinity)<=limiteDia;
      };
      /**
       * Decisão de produto 13/09: braços/ombros antes dos demais; manual conserva ordem.
       * A regra é a mesma de sempre — mudou só QUANDO ela roda (antes da decisão de tempo,
       * porque a ordem muda a duração do dia pela transição do último item).
       */
      const reordenarPeloFoco=(dias:readonly DiaTreino[])=>{
        if(!(prioritarios.length>0&&focoSolicitado?.grupo!=='core'))return;
        const antes=agregado!=null||prioritarios.some(g=>['biceps','triceps','ombros'].includes(g));
        for(const dia of dias){
          dia.slots=antes
            ? [
              ...dia.slots.filter(s=>prioritarios.includes(s.exercicio.grupoPrimario!)),
              ...dia.slots.filter(s=>!prioritarios.includes(s.exercicio.grupoPrimario!)),
            ]
            : ordenarComFoco(dia.slots,prioritarios[0]!,{
              classe:sl=>sl.padrao==='isolado'||sl.padrao==='core'?'isolado':'composto',
              grupo:sl=>sl.exercicio.grupoPrimario??null,
            });
        }
      };
      /** Regra 3 (cobertura > descanso longo): degrada o descanso até o dia caber. */
      const degradarAteCaber=(d:DiaTreino, apenas?: ReadonlySet<SlotExercicio>):0|1|2=>{
        const preservados = new Map(d.slots.filter(s => apenas && !apenas.has(s)).map(s => [s, s.descansoSeg]));
        let nivel:0|1|2=0;
        for(const deg of [0,1,2] as const){
          nivel=deg;aplicarDescanso(d,deg);
          for (const [s, descanso] of preservados) s.descansoSeg = descanso;
          if(cabeNoDia(d))break;
        }
        return nivel;
      };
      /**
       * 🔴 FASE A (revisão independente 15/09 — D-01/D-02) — A DECISÃO TEMPORAL DO
       * BASELINE NÃO CONHECE O FOCO.
       *
       * Antes, degradação e corte rodavam sobre o plano JÁ com os extras. Duas
       * consequências medidas: (a) um extra sozinho no seu grupo virava irremovível e o
       * dia cedia um exercício do BASELINE — foco de bíceps custava 3 séries de costas em
       * 243 das 3.456 combinações varridas; (b) as contagens semanais de `removivel`
       * enxergavam os extras de outro dia, então extras na segunda mudavam o corte da
       * quinta e o grupo focado podia terminar com ganho líquido ZERO enquanto a tela
       * anunciava +4 séries.
       *
       * Rodando a fase sobre o baseline puro — e fixando aqui o nível de degradação do
       * dia —, exercícios, séries e descanso dos demais grupos saem idênticos ao plano
       * SEM FOCO das mesmas entradas, por construção. O foco não tem como cobrar deles.
       */
      /**
       * Os recortes de pernas são REDISTRIBUIÇÃO do baseline (decisão 3), não o bloco
       * adicional: eles entram antes da fase temporal, como sempre entraram. O que a
       * revisão exige separar é a ADIÇÃO — e ela vem depois, na fase B.
       * A conta de volume por grupo dos dois arranjos é comparada abaixo, para que a
       * redistribuição nunca custe séries em silêncio.
       */
      /**
       * 🔵 P-01 (decisão do autor 2026-09-16) — a dispensa ordenada mora DENTRO da fase A,
       * que é a fase que NÃO conhece o foco. Assim a mesma retirada acontece no plano sem
       * foco das mesmas entradas: a existência de um foco nunca provoca retirada adicional
       * do baseline para acomodar os extras dele (D-01/D-02 seguem valendo).
       */
      const dispensadosNoFullbody:GrupoPrimario[]=[];
      /** Relatos consolidados da sequência — a comunicação é por PLANO, nunca por exercício. */
      const relatoReducao={series:0,minimas:0,redundantes:0,acima:[] as {nome:string;seg:number}[],foraDaPolitica:new Set<number>()};
      /**
       * 🔵 POLÍTICA FINAL 2026-09-17 — a fase A executa a SEQUÊNCIA ÚNICA por dia.
       * E1 (descanso) fica aqui porque depende da prescrição; E3..E6 vivem em
       * `reduzirDiaPorTempo`, que é a autoridade única do ajuste estrutural.
       *
       * 🔒 A dispensa (E5) só é habilitada no full-body de um dia — a exceção que o autor
       * ampliou com glúteos e mandou NÃO generalizar para outras divisões.
       * 🔒 A redução de séries vale só no automático com tempo limitado: com `limiteDia`
       * indefinido (75+) a função sai intacta, e o manual não passa por este ramo.
       */
      const aplicarFaseA=(dias:DiaTreino[],registrar=false):{dias:DiaTreino[];degradacao:(0|1|2)[];incompativeis:string[]}=>{
        const saida=[...dias],degradacao:(0|1|2)[]=dias.map(()=>0),incompativeis:string[]=[];
        for(let i=0;i<saida.length;i++){
          const d=saida[i]!;
          degradacao[i]=degradarAteCaber(d); // E1
          const ajuste=reduzirDiaPorTempo(d,perfil.nivelExperiencia,limiteDia,{
            outrosDias:saida.filter((_,j)=>j!==i).flatMap(x=>x.slots),
            permitirDispensa:diasForca===1,
            ordemDispensa:GRUPOS_DISPENSAVEIS_FULLBODY_CURTO,
          });
          saida[i]=ajuste.dia;
          if(!registrar){if(!ajuste.cabe&&!ajuste.naoAvaliado)incompativeis.push(d.nome);continue;}
          /**
           * 🔒 A PROCEDÊNCIA DO CORTE, no slot. `seriesReduzidas` (E3) e `seriesMinimas` (E6)
           * vêm da sequência que de fato rodou; o primeiro `de` de cada exercício é o número
           * de antes. Guardado no slot para que o editor explique a dose que exibe sem ter
           * de deduzir nada de uma diferença entre números.
           */
          for(const op of [...ajuste.seriesReduzidas,...ajuste.seriesMinimas]){
            const alvo=ajuste.dia.slots.find(sl=>sl.exercicio.id===op.exercicioId);
            if(alvo&&alvo.seriesAntesDoCorteDeTempo==null)alvo.seriesAntesDoCorteDeTempo=op.de;
          }
          relatoReducao.series+=new Set(ajuste.seriesReduzidas.map(s=>s.exercicioId)).size;
          relatoReducao.minimas+=ajuste.seriesMinimas.length;
          relatoReducao.redundantes+=ajuste.redundantesRetirados.length;
          for(const g of ajuste.gruposDispensados)if(!dispensadosNoFullbody.includes(g))dispensadosNoFullbody.push(g);
          for(const n of ajuste.quantidadesForaDaPolitica)relatoReducao.foraDaPolitica.add(n);
          if(ajuste.cabe||ajuste.naoAvaliado)continue;
          incompativeis.push(d.nome);
          // Decisão 3, último item: entregar a versão reduzida COM a duração estimada.
          if(ajuste.duracaoSeg!=null)relatoReducao.acima.push({nome:d.nome,seg:ajuste.duracaoSeg});
        }
        return {dias:saida,degradacao,incompativeis};
      };
      const usaRecortes=!!recortesFoco && !rotinaBaseDoDeload && !semanaCiclo?.retomada;
      const faseA=aplicarFaseA(diasTreino,true);
      diasTreino=faseA.dias;
      const degradacaoDoDia=faseA.degradacao;
      /**
       * 🔵 COMUNICAÇÃO (política final 2026-09-17) — SÓ O QUE FOI FEITO, UMA VEZ CADA.
       *
       * Uma mensagem por tipo de ajuste, agregada no plano inteiro: nada por exercício e
       * nada por dia. Cada uma só é emitida quando o ajuste correspondente aconteceu de
       * fato — o contador vem da sequência, não de uma suposição sobre ela.
       */
      const plural=(n:number,um:string,varios:string)=>n===1?um:varios;
      if(relatoReducao.series>0)avisos.push(`Para caber em ${perfil.tempoPorSessaoMin} min, reduzimos séries progressivamente, até o piso de 2, em ${relatoReducao.series} ${plural(relatoReducao.series,'exercício','exercícios')}.`);
      if(relatoReducao.redundantes>0)avisos.push(`Também retiramos ${relatoReducao.redundantes} ${plural(relatoReducao.redundantes,'exercício repetido','exercícios repetidos')} de ${plural(relatoReducao.redundantes,'grupo que continua coberto','grupos que continuam cobertos')} no mesmo dia.`);
      /**
       * 🔵 P-01 — a retirada é NOMEADA. O aviso diz o que saiu e por quê, e nada no plano
       * pode afirmar cobertura direta completa depois disso (o aviso de cobertura ausente
       * dos pequenos continua sendo emitido à parte, mais abaixo).
       */
      if(dispensadosNoFullbody.length)avisos.push(`Para caber em ${perfil.tempoPorSessaoMin} min nesta sessão única, o plano ficou sem exercício direto de ${dispensadosNoFullbody.map(g=>ROTULO_GRUPO[g]).join(', ')}. Os demais grupos foram preservados; a cobertura direta desta semana não está completa.`);
      // Última etapa da sequência: a série cai, o exercício fica.
      if(relatoReducao.minimas>0)avisos.push(`Como último ajuste do tempo, ${relatoReducao.minimas} ${plural(relatoReducao.minimas,'exercício de bíceps, tríceps ou ombros ficou','exercícios de bíceps, tríceps ou ombros ficaram')} com 1 série. Os exercícios foram mantidos.`);
      if(faseA.incompativeis.length)avisos.push(dispensadosNoFullbody.length
        // Depois da dispensa a frase antiga seria falsa: os dispensados perderam o único.
        ? `Estrutura incompatível com o tempo disponível em ${faseA.incompativeis.join(', ')}, mesmo depois das reduções possíveis; preservamos o único exercício dos demais grupos.`
        : `Estrutura incompatível com o tempo disponível em ${faseA.incompativeis.join(', ')}; preservamos o único exercício de cada grupo.`);
      /**
       * 🔒 Decisão 2 + último item da decisão 3: as reduções FICAM mesmo sem serem
       * suficientes, e o plano é entregue reduzido — com a DURAÇÃO ESTIMADA e sem
       * certificado de que cabe. Nada é restaurado só porque o plano segue incompatível.
       */
      if(relatoReducao.acima.length)avisos.push(`Mesmo com os ajustes, a estimativa ainda passa do seu tempo: ${relatoReducao.acima.map(a=>`${a.nome} ~${Math.round(a.seg/60)} min`).join(', ')} (seu limite é ${perfil.tempoPorSessaoMin} min). Entregamos a versão reduzida; não dá para afirmar que ela cabe.`);
      /**
       * 🔴 FASE B — O BLOCO ADICIONAL ENTRA POR ÚLTIMO E SAI PRIMEIRO.
       * Só extras são removidos aqui, e todos eles podem sair (o tempo pode eliminar o
       * bloco inteiro). O descanso dos extras usa o MESMO nível de degradação já fixado
       * pelo baseline: a adição também não encurta o descanso de quem já estava no plano.
       */
      /**
       * 🟠 A PODA DO BASELINE — LIGADA (decisão do autor 2026-09-16).
       *
       * Até `f035d6c` este ponto só DOCUMENTAVA o excesso: 212 de 3 888 combinações
       * entregavam um grande acima do MRV **sem foco nenhum**, e a correção ficou parada
       * porque o teto era lido em duas moedas (ver `faixaDaSemana`, no topo desta função).
       * A decisão fechou a moeda em PONDERADA, e o excesso do baseline deixa de ser um
       * estado aceito: ele é um defeito do montador e é corrigido aqui.
       *
       * 🔒 Roda NESTE ponto — depois da rampa e da fase A, ANTES do bloco do foco — e a
       * ordem é contrato, não conveniência:
       *  · o foco precisa enxergar o baseline JÁ corrigido, senão herdaria folga falsa e
       *    gastaria com extras um teto que o baseline já tinha estourado;
       *  · e nada do baseline pode ser cortado por causa dos extras (D-01/D-02): a poda roda
       *    sobre o plano SEM extras, então seu resultado é idêntico ao do plano sem foco das
       *    mesmas entradas — a existência de um foco nunca a provoca nem a agrava.
       *
       * 🔒 Ela tira série só dos slots DIRETOS do grupo que estourou (nenhum terceiro paga
       * por um teto que não é dele) e nunca abaixo de `sMinDaSemana`. Quem não tem como
       * ceder entra em `irredutíveis`: o excesso FICA e o crítico continua dizendo —
       * silenciar aqui esconderia no montador o que o editor existe para mostrar.
       *
       * 🔒 E ela é DITA. A redução de volume de um grupo é exatamente o tipo de mudança que
       * a casa não faz calada (D-01/D-02: "o custo é dito, nunca silencioso").
       */
      /**
       * 🔵 ANTES DE PODAR, TENTAR — decisão do autor de 2026-09-17 (2ª volta).
       *
       * 🔑 A ordem importa e foi medida: a TROCA de exercício não custa série a ninguém
       * (mesmo grupo, mesmo padrão, mesma assinatura de custo), enquanto a poda custa. Rodar
       * a tentativa primeiro entrega mais volume pelo mesmo teto — no caso medido
       * (`avançado/6d/45 min`, posterior 13 num dia) ela devolve séries que a poda tiraria.
       *
       * 🔒 A busca é finita e declarada (`excecao-sessao.ts`): nenhum candidato entra sem
       * passar pelos dois tetos, pelo piso da faixa e pelo relógio do dia — e todos os
       * examinados ficam registrados, com o motivo, para a exceção que sobrar.
       */
      const tentativa = tetoDaSessao == null
        ? { trocas: [] as { dia: number; de: string; para: string; porCausaDe: GrupoPrimario }[], alternativas: new Map<string, AlternativaExaminada[]>() }
        : tentarAlternativasDeSessao({
          dias: diasTreino, teto: tetoDaSessao, pool, tetoSemanal: tetoSemanalGrupo,
          pisoSemanal: faixaDaSemana.min,
          cabeNoTempo: (_dia, slots) => cabeNoDia({ ...diasTreino[_dia]!, slots: [...slots] }),
        });
      if (tentativa.trocas.length > 0) {
        /**
         * 🔒 A TROCA É DITA (D-01/D-02: o custo é dito, nunca silencioso). Trocar o exercício
         * que a pessoa vai ver é mudança visível, e o motivo dela é o teto do dia.
         */
        const quantas = tentativa.trocas.length;
        const gruposDitos = [...new Set(tentativa.trocas.map(t => ROTULO_GRUPO[t.porCausaDe]))].join(', ');
        avisos.push(`Trocamos ${quantas} ${plural(quantas, 'exercício', 'exercícios')} por ${plural(quantas, 'outro equivalente', 'outros equivalentes')} do mesmo grupo e do mesmo tempo, para ${gruposDitos} ${plural(1, 'não passar', 'não passarem')} do máximo de um treino só sem perder séries. O volume de todos os grupos ficou como estava.`);
      }
      const podaBaseline = podarExcessoPonderado(diasTreino.flatMap(d => d.slots), tetoSemanalGrupo, sMinDaSemana);
      if (podaBaseline.podados.length > 0) {
        const quantas = podaBaseline.podados.reduce((n, p) => n + p.series, 0);
        /**
         * 🔒 O NÚMERO É POR GRUPO (2026-09-17). Com a margem de 3, dois grupos podados na
         * mesma semana podem ter tetos diferentes (o focado 19, o outro 16) — um número só
         * na frase afirmaria de um o limite do outro.
         */
        const nomeados = podaBaseline.podados.map(p => `${ROTULO_GRUPO[p.grupo]} (${tetoSemanalGrupo(p.grupo)})`).join(', ');
        avisos.push(`Ajustamos o volume de ${nomeados} ${MARCA_PODA_TETO}, somando diretas e indiretas: ${quantas} ${plural(quantas, 'série saiu', 'séries saíram')} ${plural(podaBaseline.podados.length, 'do próprio grupo', 'dos próprios grupos')}. Nenhum outro exercício foi alterado.`);
      }
      /**
       * 🔵 E O TETO POR SESSÃO, na mesma passada de correção (decisão 2026-09-17).
       *
       * 🔒 Os dois limites valem SIMULTANEAMENTE e nenhum substitui o outro: um iniciante com
       * 11 séries num dia respeita o teto do dia (12) e viola o máximo semanal (10); um
       * intermediário em foco com 13 num dia respeita o semanal (19) e viola o do dia. Por
       * isso a poda semanal roda primeiro e esta roda logo em seguida, sobre o resultado dela.
       *
       * 🔒 Aqui não há margem de 3 e não há exceção de foco — o teto do dia é o mesmo para
       * todos os grupos, e o crédito indireto conta igual.
       */
      const podaSessao = tetoDaSessao == null
        ? { podados: [], irredutiveis: [] }
        : podarExcessoPonderadoNaSessao(diasTreino.map(d => d.slots), tetoDaSessao, sMinDaSemana);
      if (podaSessao.podados.length > 0) {
        const quantas = podaSessao.podados.reduce((n, p) => n + p.series, 0);
        const nomeados = [...new Set(podaSessao.podados.map(p => ROTULO_GRUPO[p.grupo]))].join(', ');
        avisos.push(`Ajustamos o volume de ${nomeados} ${MARCA_PODA_SESSAO} (${tetoDaSessao} séries por grupo num mesmo dia, somando diretas e indiretas): ${quantas} ${plural(quantas, 'série saiu', 'séries saíram')} ${plural(podaSessao.podados.length, 'do próprio grupo', 'dos próprios grupos')}. O volume da semana continua distribuído nos outros dias.`);
      }
      /**
       * 🔵 O QUE SOBROU É A EXCEÇÃO — e ela é DITA antes da confirmação (2026-09-17, 2ª volta).
       *
       * 🔒 A decisão substituiu a obrigação absoluta de 12 por sessão: 12 continua sendo o
       * limite normal de montagem, e o excesso só é aceito depois que trocar exercício, mudar
       * de dia e reduzir séries falharam — cada tentativa registrada em `alternativas`. Aqui
       * o que resta ganha número, grupo, dia e causa, e o plano deixa de poder ser
       * apresentado como "dentro de todos os limites".
       *
       * 🔒 Nenhum limite SEMANAL é flexibilizado por isto: a poda semanal já rodou acima e
       * continua dura.
       */
      excecoesDeSessao = dizerExcecaoDeSessao(diasTreino, { alternativas: tentativa.alternativas });
      /**
       * 🔒 SEM frase para `irredutiveis` NESTE caminho — e isto foi MEDIDO, não suposto.
       * Na varredura das 3 888 combinações o caso não ocorre nenhuma vez: o alocador já mira
       * `banda.max` na conta ponderada, então sempre há série direta acima do piso de onde
       * tirar. Escrever a frase aqui seria aviso morto na tela, que a casa recusa (e que o
       * tripwire de `veredito-motor.test.ts` cobra). No desenho da PESSOA o caso é real — as
       * séries dela são intocáveis — e a frase existe lá, com caso. Quando o excesso fica,
       * quem diz é o crítico do editor (`acima_do_maximo`), como sempre disse.
       */
      // Autor 17/09: só a dose já distribuída permite avaliar a compensação real.
      // O teto do baseline não depende do foco. Deload herda a semana cheia; retomada não cresce.
      if (!rotinaBaseDoDeload && !deloadAgendado && !semanaCiclo?.retomada) {
        const consolidados = consolidarPequenos({
          dias: diasTreino, maxSeries: prescricao.seriesPorExercicio.max, tetoSemana: tetoSemanalGrupo,
          cabe: (antes, depois) => {
            const a = avaliarDuracaoResistida(antes, perfil.nivelExperiencia).duracaoMaximaEstimadaSegundos;
            const b = avaliarDuracaoResistida(depois, perfil.nivelExperiencia).duracaoMaximaEstimadaSegundos;
            const creditoAntes = creditoPonderadoDaSemana(antes);
            return a != null && b != null && (limiteDia == null || b <= limiteDia)
              && [...creditoPonderadoDaSemana(depois)].every(([g, n]) => n <= (tetoDaSessao ?? Infinity) || n <= (creditoAntes.get(g) ?? 0));
          },
        });
        if (consolidados) avisos.push(`Consolidamos ${consolidados} exercício(s) redundante(s) de braços nos exercícios mantidos do mesmo dia, preservando séries totais, crédito dos grupos e cobertura identificada. A duração foi recalculada com os descansos dos exercícios mantidos.`);
        const complementosPosterior = completarPosteriorDosado({
          dias: diasTreino, pool, min: sMinDaSemana, max: prescricao.seriesPorExercicio.max,
          slotsMax: budgetPorDia,
          tetoSemana: g => Math.min(tetoSemanalGrupo(g), maxSemanalSemFoco(perfil.nivelExperiencia, objetivoDoVolume)),
          tetoDia: tetoDaSessao ?? 12,
          materializar: (e, series, d) => ({
            exercicio: e, padrao: e.padraoMovimento, series,
            descansoSeg: descansoDoExercicio({ exercicio: e, rirAlvo, modoForca: prescricao.modoForca,
              degradacao: degradacaoDoDia[d] ?? 0 }) ?? 0,
            ...(repUnitDe(e.id) === 'segundos' ? { holdSeg: faixaSegundos(e.id, perfil.nivelExperiencia)?.min } : {}),
          }),
          cabeNoTempo: (slots) => {
            // O full-body de um dia conserva um posterior; não anunciar uma adição que o bloco removeria.
            if (diasForca === 1 && slots.filter(s => s.exercicio.grupoPrimario === 'posterior').length > 1) return false;
            const medida = avaliarDuracaoResistida(slots, perfil.nivelExperiencia, limiteDia);
            return medida.estadoCalculo === 'CALCULADO' && (limiteDia === undefined
              || (medida.duracaoMaximaEstimadaSegundos ?? Infinity) <= limiteDia);
          },
        });
        for (const mudanca of complementosPosterior) {
          const soma = (slots: readonly SlotExercicio[]) => slots.reduce((n, slot) => n + (slot.series ?? 0), 0);
          const novos = mudanca.depois.filter(s => !mudanca.antes.some(a => a.exercicio.id === s.exercicio.id));
          const retirados = mudanca.antes.filter(s => !mudanca.depois.some(a => a.exercicio.id === s.exercicio.id));
          const segundos = (slots: readonly SlotExercicio[]) => avaliarDuracaoResistida(slots, perfil.nivelExperiencia).duracaoMaximaEstimadaSegundos;
          const antes = segundos(mudanca.antes), depois = segundos(mudanca.depois);
          const custo = antes != null && depois != null ? ` Variação estimada: ${Math.round((depois - antes) / 60)} min.` : '';
          avisos.push(`Cobertura de posteriores em ${diasTreino[mudanca.dia]!.nome}: ${novos.map(s => s.exercicio.nomePt).join(', ')}${retirados.length ? ` substitui ${retirados.map(s => s.exercicio.nomePt).join(', ')}` : ' adicionado'}. Mais ${soma(mudanca.depois) - soma(mudanca.antes)} série(s) no próprio grupo, preservando o crédito semanal dos demais.${custo}`);
        }
      }
      if(diasForca===1&&!rotinaBaseDoDeload&&!deloadAgendado&&!semanaCiclo?.retomada&&diasTreino[0]){
        const tentativa=completarPuxadasFullbody({dia:diasTreino[0],pool,nivel:perfil.nivelExperiencia,
          limiteSeg:limiteDia,maxSlots:budgetPorDia,minSeries:limiteDia==null?sMinDaSemana:Math.min(2,sMinDaSemana),
          tetoSemana:tetoSemanalGrupo,tetoDia:tetoDaSessao??Infinity,
          materializar:(e,series,deg)=>({exercicio:e,padrao:e.padraoMovimento,series,
            descansoSeg:descansoDoExercicio({exercicio:e,rirAlvo,modoForca:prescricao.modoForca,degradacao:deg})??0,
            ...(favoritosEfetivos.has(e.id)?{incluidoPorPreferencia:true}:{})})});
        if(tentativa.aplicado)diasTreino[0]=tentativa.dia;
        if(tentativa.necessario)avisos.push(tentativa.aplicado
          ? 'Full-body de um dia: incluímos um segundo exercício de costas para equilibrar puxar e empurrar, preservando os grupos principais; dose e descanso foram ajustados aos limites da sessão.'
          : 'Full-body de um dia: o segundo exercício de costas necessário para conciliar o desenvolvimento com puxar ≥ empurrar não coube nos limites ou nas opções elegíveis. Mantivemos o plano anterior, sem retirar grupos principais.');
      }
      if (!rotinaBaseDoDeload && !deloadAgendado && !semanaCiclo?.retomada) {
        aplicarExcecaoTrapezio({perfil, dias:diasTreino, pool,
          materializar:(exercicio,slot)=>({...slot,exercicio,padrao:exercicio.padraoMovimento,
            descansoSeg:descansoDoExercicio({exercicio,rirAlvo,modoForca:prescricao.modoForca,degradacao:0})??0})});
      }
      const preencherFolgasComplementares = () => {
       if (!rotinaBaseDoDeload && !deloadAgendado && !semanaCiclo?.retomada && diasForca > 1) {
        preencherComplementaresAusentes({
          dias: diasTreino, pool: [...pool].sort((a,b)=>Number(favoritosEfetivos.has(b.id))-Number(favoritosEfetivos.has(a.id))),
          slotsMax: budgetPorDia, minSeries: limiteDia == null ? sMinDaSemana : Math.min(2,sMinDaSemana),
          tetoSemana: tetoSemanalGrupo, tetoDia: tetoDaSessao ?? Infinity,
          // Decisão do autor 20/09: só quem declarou "sem limite de tempo" ganha o slot extra
          // da panturrilha, e só quando o dia de pernas já gastou o orçamento nos principais.
          slotExtraPanturrilha: perfil.limiteTempoTreino === 'sem_limite',
          materializar: (e,d,deg) => ({exercicio:e,padrao:e.padraoMovimento,series:prescricao.seriesPorExercicio.max,
            descansoSeg:descansoDoExercicio({exercicio:e,rirAlvo,modoForca:prescricao.modoForca,degradacao:Math.max(degradacaoDoDia[d]??0,limiteDia==null?0:deg) as 0|1|2})??0,
            ...(favoritosEfetivos.has(e.id)?{incluidoPorPreferencia:true}:{}),
            ...(repUnitDe(e.id)==='segundos'?{holdSeg:faixaSegundos(e.id,perfil.nivelExperiencia)?.min}:{})}),
          cabeNoTempo: slots => {const m=avaliarDuracaoResistida(slots,perfil.nivelExperiencia);
            return m.estadoCalculo==='CALCULADO' && (limiteDia===undefined||(m.duracaoMaximaEstimadaSegundos??Infinity)<=limiteDia);},
        });
      }
      };
      preencherFolgasComplementares();
      // A ênfase só redistribui o baseline já finalizado. Não provoca nova poda,
      // troca de exercício nem mudança de descanso nos grupos que não foram focados.
      if (usaRecortes) {
        const tentativaRecortes = realocarBaselineAosRecortes(diasTreino, recortesFoco!);
        const maxAntes = new Map<GrupoPrimario, number>();
        for (const d of diasTreino) for (const [g, n] of creditoPonderadoDaSemana(d.slots)) {
          maxAntes.set(g, Math.max(maxAntes.get(g) ?? 0, n));
        }
        const aceitaRecortes = (dias:readonly DiaTreino[]) => dias.every(d =>
          d.slots.length <= budgetPorDia && cabeNoDia(d)
          && [...creditoPonderadoDaSemana(d.slots)].every(([g,n]) => n <= Math.max(tetoDaSessao ?? Infinity, maxAntes.get(g) ?? 0)));
        const cabe = !tentativaRecortes.adaptado && aceitaRecortes(tentativaRecortes.dias);
        const comCoreReduzido = !cabe && automatico && agregado==='pernas' && diasDaAgenda.length===4
          ? realocarPernasReduzindoCore(diasTreino,recortesFoco!,aceitaRecortes) : null;
        if (cabe || comCoreReduzido) {
          diasTreino = comCoreReduzido ?? tentativaRecortes.dias;
          recortesEntreguesDoFoco = recortesFoco!;
          // A redistribuição pode abrir capacidade nas pernas. Só adição: não
          // retira nem muda séries, descanso ou exercícios de nenhum slot retido.
          preencherFolgasComplementares();
          if(comCoreReduzido)avisos.push('Para separar as duas sessões de pernas em foco nos quatro dias escolhidos, reduzimos core de duas para uma sessão. Antebraço e todos os exercícios dos demais grupos foram preservados; mantivemos um complementar por dia.');
        } else {
          avisos.push('Mantivemos a distribuição disponível: separar os recortes de pernas não coube nos limites da sessão preservando todos os exercícios, séries e descansos.');
        }
      }
      if (prioritarios.includes('core') && !rotinaBaseDoDeload && !deloadAgendado && !semanaCiclo?.retomada) {
        focoCoreAdicional = adicionarSeriesCore({
          dias: diasTreino, solicitado: 2, tetoPorExercicio: prescricao.seriesPorExercicio.max,
          aceita: (dias, dia) => {
            const semana = creditoPonderadoDaSemana(dias.flatMap(d => d.slots));
            if ([...semana].some(([g, n]) => n > tetoSemanalGrupo(g))) return false;
            if ([...creditoPonderadoDaSemana(dias[dia]!.slots).values()].some(n => n > (tetoDaSessao ?? 12))) return false;
            const medida = avaliarDuracaoResistida(dias[dia]!.slots, perfil.nivelExperiencia, limiteDia);
            return medida.estadoCalculo === 'CALCULADO'
              && (limiteDia === undefined || (medida.duracaoMaximaEstimadaSegundos ?? Infinity) <= limiteDia);
          },
        });
        avisos.push(focoCoreAdicional.entregues > 0
          ? `Foco de core: ${focoCoreAdicional.entregues} série(s) adicional(is) nos exercícios existentes, sem retirar séries de outros grupos.`
          // Decisão do autor (2026-09-19): substitui a compensação 1:1 e a recusa de salvamento
          // da v3.1. Sem folga, a preferência fica salva e o plano diz que nada foi aplicado.
          : 'Foco de core salvo, mas nenhum extra foi aplicado por falta de espaço nos limites do treino (séries por exercício, volume e tempo).');
      }
      const bloco=rotinaBaseDoDeload ? {dias:diasTreino,adicionais:new Set<SlotExercicio>(),adaptados:[] as GrupoPrimario[],faltantes:[] as GrupoPrimario[],solicitados:0} : adicionarBlocoFoco(diasTreino,diasForcaDaSemana,semanaCiclo?.retomada?[]:prioritarios.filter(g=>g!=='core'),pool,favoritosEfetivos);
      diasTreino=bloco.dias;
      /**
       * 🔴 O BLOCO DO FOCO RESPEITA O MRV (correção 2026-09-15) — o defeito do relato.
       *
       * O cofre travou a resolução em 2026-07-31 (`motor-treino-grupo-em-foco-x-mrv`, claims
       * --005/--010/--011): *"o foco sobe até o MRV do nível e PARA"*, *"o teto duro continua
       * duro"*, e elevar o teto durante o foco foi RECUSADO — *"transformaria o único
       * guarda-corpo de volume em algo negociável"*. O bloco adicional entrava com 2 séries
       * fixas sem consultar ninguém: peito 13 → 17 contra teto 16 (o caso da captura), e até 20
       * em 4d/75min/S4. Os 0,5 indiretos desses extras ainda levavam OMBROS — que o usuário não
       * focou — a 17 e 18.
       *
       * 🔵 A instrução vigente desta correção (2026-09-15) manda respeitar o MRV inclusive nos
       * extras, e SUBSTITUI neste ponto a exceção de 14/09 que os autorizava a ultrapassá-lo.
       * A exceção anterior foi uma decisão deliberada, não um engano de transcrição: ela vale
       * como histórico e está registrada no caso de `etapa3-foco-tempo.test.ts`.
       *
       * 🔒 O contrato do bloco fica intacto: o treino normal é montado primeiro, o extra entra
       * noutro dia, e **nada do baseline é retirado para o extra caber**. O que muda é só
       * quanto o extra pode somar: o nominal continua 2 × 2 e é cortado pela folga real até o
       * teto, na conta canônica (direto 1,0 + indireto 0,5, todos os grandes afetados). Folga
       * zero ⇒ o extra NÃO entra — o degrau que a mesma DF já previa: *"quem já está no topo
       * não ganha volume; ganha ORDEM"* (claim --006), entregue por `reordenarPeloFoco`.
       */
      const nominalDoExtra=deloadAgendado?seriesEmDeload(2):2;
      /**
       * 🔵 O EXTRA DO FOCO MEDE-SE CONTRA OS DOIS TETOS (decisão 2026-09-17).
       *
       * 🔒 Semanal: o grupo EM FOCO pode ir até o teto cheio (13/19/21) — é a única exceção
       * da margem de 3, e ela é DO GRUPO: o crédito indireto que o extra deposita num
       * terceiro continua medido contra o teto SEM foco desse terceiro (`tetoSemanalGrupo`
       * já sabe quem está em foco).
       * 🔒 Por sessão: 12 ponderadas no DIA em que o extra cai. Sem margem, sem exceção de
       * foco. `10 + 9 = 19` na semana pode caber; `13` numa sessão não pode — e é esta
       * segunda conta que faz a diferença.
       */
      const creditoBaseline=creditoAtual(diasTreino.flatMap(d=>d.slots).filter(s=>!bloco.adicionais.has(s)));
      const diaDoAdicional=new Map<SlotExercicio,number>();
      diasTreino.forEach((d,i)=>{for(const slot of d.slots)diaDoAdicional.set(slot,i);});
      const creditoDoDia=diasTreino.map(d=>creditoAtual(d.slots.filter(s=>!bloco.adicionais.has(s))));
      const extrasRecusados=new Set<SlotExercicio>();
      const bloqueadores=new Set<GrupoPrimario>();
      /** 🔒 QUAL limite barrou — a tela precisa dizer a restrição, não só o grupo. */
      let barrouSemana=false;
      let barrouSessao=false;
      let extrasAparados=0;
      for(const adicional of bloco.adicionais){
        const dia=diaDoAdicional.get(adicional)??0;
        const noDia=creditoDoDia[dia]??creditoAtual([]);
        const cabeNaSemana=seriesQueCabemNoTeto(adicional.exercicio,nominalDoExtra,creditoBaseline,tetoSemanalGrupo);
        const cabeNaSessao=tetoDaSessao==null?nominalDoExtra:seriesQueCabemNoTeto(adicional.exercicio,nominalDoExtra,noDia,tetoDaSessao);
        const cabem=Math.min(cabeNaSemana,cabeNaSessao);
        if(cabem<=0){
          if(cabeNaSemana<=0){
            barrouSemana=true;
            for(const g of gruposSemEspaco(adicional.exercicio,creditoBaseline,tetoSemanalGrupo))bloqueadores.add(g);
          }
          if(cabeNaSessao<=0&&tetoDaSessao!=null){
            barrouSessao=true;
            for(const g of gruposSemEspaco(adicional.exercicio,noDia,tetoDaSessao))bloqueadores.add(g);
          }
          extrasRecusados.add(adicional);continue;
        }
        if(cabem<nominalDoExtra)extrasAparados+=1;
        adicional.series=cabem;
        creditar(creditoBaseline,adicional.exercicio,cabem);
        creditar(noDia,adicional.exercicio,cabem);
        const hold=repUnitDe(adicional.exercicio.id)==='segundos'?faixaSegundos(adicional.exercicio.id,perfil.nivelExperiencia)?.min:undefined;
        if(hold!=null)adicional.holdSeg=hold;
        if(escolhasExecucao.has(adicional.exercicio.id))adicional.execucaoSelecionada=resolverExecucao(adicional.exercicio.id,adicional.exercicio.execucao,escolhasExecucao.get(adicional.exercicio.id));
      }
      let relatarRecusaVolume = () => {};
      if(extrasRecusados.size>0){
        // O extra recusado sai do plano E do conjunto de adicionais: a partir daqui ele nunca
        // existiu, e o dia volta a ser o do plano sem foco pelo caminho já existente.
        for(const d of diasTreino)d.slots=d.slots.filter(s=>!extrasRecusados.has(s));
        for(const s of extrasRecusados)bloco.adicionais.delete(s);
        /**
         * 🔒 A frase nomeia QUEM barrou, não quem foi barrado.
         *
         * Dois casos diferentes, e dizer o errado seria afirmar o que não é verdade:
         *  · o próprio grupo focado está no topo ⇒ a frase é sobre ele;
         *  · um TERCEIRO está no topo e recebe crédito indireto do exercício do foco (medido:
         *    peito em 18/20 barrado por ombros em 19,5/20) ⇒ a frase nomeia o terceiro e diz
         *    por que ele entra na conta.
         * Num foco agregado (pernas) um componente pode entrar e o outro não; por isso a lista
         * sai dos extras REALMENTE recusados, nunca de `prioritarios`.
         */
        relatarRecusaVolume = () => {
        const recusados=[...new Set([...extrasRecusados].map(s=>s.exercicio.grupoPrimario).filter((g):g is GrupoPrimario=>g!=null))];
        const terceiros=[...bloqueadores].filter(g=>!recusados.includes(g));
        /**
         * 🔒 A RESTRIÇÃO É NOMEADA, não só o grupo (2026-09-17). São limites diferentes, com
         * números diferentes, e dizer "o máximo do seu nível" quando quem mordeu foi o teto
         * do DIA mandaria a pessoa mexer na semana inteira para consertar um dia só.
         */
        const qual=(g:GrupoPrimario)=>barrouSemana&&!barrouSessao
          ? {em:`no máximo desta semana`,de:`do máximo desta semana`,n:`(${tetoSemanalGrupo(g)} séries, somando diretas e indiretas)`}
          : !barrouSemana&&barrouSessao
            ? {em:`no máximo de um treino só`,de:`do máximo de um treino só`,n:`(${tetoDaSessao} séries por grupo num mesmo dia, somando diretas e indiretas)`}
            : {em:`nos limites desta semana`,de:`dos limites desta semana`,n:`(${tetoSemanalGrupo(g)} na semana e ${tetoDaSessao} num mesmo dia, somando diretas e indiretas)`};
        /**
         * 🔴 ENTREGA PARCIAL NÃO É RECUSA TOTAL (2026-09-17, 3ª volta).
         *
         * ⚠️ O defeito: este ramo roda quando ALGUM extra foi recusado, e as duas frases
         * afirmavam que o bloco do foco NÃO ENTROU. Quando só parte dele é recusada, o que
         * sobrou continua no plano e em `bloco.adicionais` — e a pessoa lia "não entrou"
         * olhando para um exercício de foco que está lá.
         *
         * 🔒 MEDIDO, não suposto: varredura de 5 184 combinações (3 objetivos × 3 níveis ×
         * 4 agendas × 3 durações × 2 limites × 4 semanas × 6 focos) no candidato `49dab05`.
         * A frase sai em 153 células; em **13** delas `adicionais` não estava vazio —
         * `massa/avançado/6d/45min/limitado` com foco em glúteos (S1, S3, S5) e
         * `emagrecimento/avançado/6d/S1` com foco em peito e em glúteos, nas quatro
         * combinações de tempo e limite.
         *
         * 🔒 A correção é de COMUNICAÇÃO. Dose, alocador e regras do foco não são tocados: o
         * que entrou continua exatamente o que entrava. Muda o que se diz sobre isso, e o
         * número dito vem da entrega real (`bloco.adicionais`), não da intenção
         * (`solicitados`) — a distinção que `treino-types` já declara.
         */
        const entregues=diasTreino.flatMap(d=>d.slots.filter(s=>bloco.adicionais.has(s)));
        const seriesEntregues=entregues.reduce((n,s)=>n+(s.series??0),0);
        const quantoEntrou=`${entregues.length} ${plural(entregues.length,'exercício','exercícios')}, com ${seriesEntregues} ${plural(seriesEntregues,'série','séries')}`;
        if(terceiros.length===0){
          const q=qual(recusados[0]!);
          avisos.push(entregues.length>0
            ? `O bloco do foco entrou só em parte — ${quantoEntrou}. O resto não coube: o volume de ${recusados.map(g=>ROTULO_GRUPO[g]).join(', ')} já está ${q.em} do seu nível ${q.n}.`
            : `O volume de ${recusados.map(g=>ROTULO_GRUPO[g]).join(', ')} já está ${q.em} do seu nível ${q.n}. Nesta semana o foco entra na ORDEM dos exercícios, não em séries a mais.`);
        } else {
          const q=qual(terceiros[0]!);
          avisos.push(entregues.length>0
            ? `O bloco do foco entrou só em parte — ${quantoEntrou}. Somar mais ${recusados.map(g=>ROTULO_GRUPO[g]).join(', ')} levaria ${terceiros.map(g=>ROTULO_GRUPO[g]).join(', ')} acima ${q.de} do seu nível ${q.n}, porque esses exercícios também trabalham esse grupo de forma indireta.`
            : `O bloco do foco não entrou: somar ${recusados.map(g=>ROTULO_GRUPO[g]).join(', ')} aqui levaria ${terceiros.map(g=>ROTULO_GRUPO[g]).join(', ')} acima ${q.de} do seu nível ${q.n}, porque esses exercícios também trabalham esse grupo de forma indireta. Nesta semana o foco entra na ORDEM dos exercícios.`);
        }
        };
      }
      if(extrasAparados>0)avisos.push('O bloco do foco entrou com menos séries do que o previsto para não passar dos limites de volume desta semana — nem o da semana, nem o de um treino só.');
      if(semanaCiclo?.retomada&&prioritarios.length)avisos.push('Retomada: mantivemos os limites desta fase; o bloco adicional do foco não foi aplicado.');
      if(bloco.adaptados.length)avisos.push('Segunda exposição adaptada à sessão existente do foco para respeitar a recuperação entre os dias escolhidos.');
      if(bloco.faltantes.length)avisos.push(bloco.faltantes.some(ehComplementar)
        ? 'Não foi possível completar o bloco adicional do foco nos dias compatíveis, respeitando um exercício complementar por dia misto.'
        : 'Não foi possível completar o bloco adicional do foco com os exercícios elegíveis neste plano.');
      /**
       * 🔴 REVALIDAÇÃO 16/09 — A ORDEM É DECIDIDA ANTES DA PERGUNTA "CABE?".
       *
       * A fórmula canônica (C1 §4) cobra TRANSIÇÃO de todo item resistido menos o último:
       * trocar quem fica por último muda a duração do dia pela diferença entre os dois
       * descansos. A reordenação por foco rodava DEPOIS desta fase, então o dia era medido
       * numa ordem que não era a entregue. Medido em 3.456 combinações: **56 planos iam de
       * CERTIFICADO a INCOMPATIVEL** só por causa disso — o foco derrubando a certificação
       * de um baseline que cabia, sem aviso e sem nada ser removido (88 no candidato
       * `badcea47`). A reordenação passou a acontecer aqui, antes de degradar e de podar.
       */
      const ordemSemFoco=diasTreino.map(d=>d.slots.filter(s=>!bloco.adicionais.has(s)));
      reordenarPeloFoco(diasTreino);
      /** Relato consolidado da fase B: uma mensagem por tipo, nunca uma por dia. */
      const extrasRemovidos={dias:[] as string[],descansoEncurtado:[] as string[]};
      for(let i=0;i<diasTreino.length;i++){
        const d=diasTreino[i]!;
        /** 🔒 A ordem é PREFERÊNCIA, não garantia: se ela sozinha estoura um dia que cabia,
         *  o dia volta à ordem do plano sem foco. O baseline não paga pela preferência. */
        const restaurar=()=>{d.slots=[...ordemSemFoco[i]!];aplicarDescanso(d,degradacaoDoDia[i]??0);};
        if(!d.slots.some(s=>bloco.adicionais.has(s))){if(!cabeNoDia(d))restaurar();continue;}
        /**
         * E1 → E2 da sequência, na letra: o DESCANSO cede primeiro — até o piso permitido,
         * que continua sendo o da classe (e os 120 s do critério documental) —, e só depois
         * saem os EXTRAS. O baseline não é tocado aqui: ele já foi decidido na fase A, sem
         * conhecer o foco, e extras que não cabem saem antes de provocar qualquer nova
         * redução nele.
         */
        const degradacaoComBloco=degradarAteCaber(d,bloco.adicionais);
        const ajuste=removerExtrasPorTempo(d,perfil.nivelExperiencia,limiteDia,bloco.adicionais);
        diasTreino[i]=ajuste.dia;
        if(ajuste.removidos.length)extrasRemovidos.dias.push(d.nome);
        if(ajuste.dia.slots.some(s=>bloco.adicionais.has(s))){
          if(degradacaoComBloco>(degradacaoDoDia[i]??0))extrasRemovidos.descansoEncurtado.push(d.nome);
        } else {
          // Bloco inteiro removido ⇒ o dia volta a ser exatamente o do plano SEM FOCO —
          // ordem e descanso inclusive. Nada do baseline paga por um extra que nem ficou.
          const diaSemBloco=ajuste.dia;
          diaSemBloco.slots=[...ordemSemFoco[i]!];
          aplicarDescanso(diaSemBloco,degradacaoDoDia[i]??0);
        }
      }
      relatarRecusaVolume();
      if(extrasRemovidos.dias.length){
        const entregues=diasTreino.flatMap(d=>d.slots.filter(s=>bloco.adicionais.has(s)));
        const series=entregues.reduce((n,s)=>n+(s.series??0),0);
        const entrega=entregues.length>0
          ? `O bloco do foco entrou só em parte — ${entregues.length} ${plural(entregues.length,'exercício','exercícios')}, com ${series} ${plural(series,'série','séries')}.`
          : 'O bloco do foco não entrou: os extras não couberam no tempo disponível.';
        avisos.push(`Bloco do foco reduzido pelo tempo disponível em ${extrasRemovidos.dias.join(', ')}. ${entrega}`);
      }
      if(extrasRemovidos.descansoEncurtado.length)avisos.push(`Para caber o bloco do foco, o descanso de ${extrasRemovidos.descansoEncurtado.join(', ')} foi encurtado até o piso permitido.`);
      // 🔒 A marca vai NO SLOT, do mesmo Set que decidiu a adição: quem avaliar o plano
      // depois (crítico do editor, tela do plano salvo) lê a procedencia real em vez de
      // tentar adivinhar pelo grupo focado — um peitoral do baseline não é extra.
      for(const d of diasTreino)for(const s of d.slots)if(bloco.adicionais.has(s)){extrasDoFoco.add(s);s.extraDoFoco=true;}
      /**
       * 🔵 O EXTRA DO FOCO CABE NOS EXERCÍCIOS QUE JÁ EXISTEM (2026-09-20).
       *
       * 🔴 Resíduo do PR #18: no caso relatado o dia de braços terminava com CINCO tríceps —
       * quatro de baseline e o extra do bloco de foco. As 14 séries do grupo cabem em QUATRO
       * exercícios (teto 4/exercício do intermediário): o quinto existia só para carregar
       * dose. A consolidação de `consolidarPequenos` roda ANTES do bloco de foco, então nunca
       * via o extra. Aqui ela roda de novo, depois que o extra existe e está marcado.
       *
       * 🔒 Só o extra é candidato, e só sai quando sua FUNÇÃO e TODOS os seus alvos
       * documentais continuam cobertos, a dose inteira cabe nos mantidos do mesmo grupo e
       * nenhum crédito, teto ou tempo piora — as mesmas provas de sempre. O que o bloco de
       * foco pediu foi DOSE; a dose continua entregue, dentro de menos exercícios.
       */
      if (!rotinaBaseDoDeload && !deloadAgendado && !semanaCiclo?.retomada) {
        const extrasAntes = diasTreino.reduce((n, d) => n + d.slots.filter(x => x.extraDoFoco).length, 0);
        const consolidadosDoFoco = consolidarPequenos({
          dias: diasTreino, maxSeries: prescricao.seriesPorExercicio.max, tetoSemana: tetoSemanalGrupo,
          somenteExtraDoFoco: true,
          cabe: (antes, depois) => {
            const a = avaliarDuracaoResistida(antes, perfil.nivelExperiencia).duracaoMaximaEstimadaSegundos;
            const b = avaliarDuracaoResistida(depois, perfil.nivelExperiencia).duracaoMaximaEstimadaSegundos;
            const creditoAntes = creditoPonderadoDaSemana(antes);
            return a != null && b != null && (limiteDia == null || b <= limiteDia)
              && [...creditoPonderadoDaSemana(depois)].every(([g, n]) => n <= (tetoDaSessao ?? Infinity) || n <= (creditoAntes.get(g) ?? 0));
          },
        });
        if (consolidadosDoFoco) {
          const extrasDepois = diasTreino.reduce((n, d) => n + d.slots.filter(x => x.extraDoFoco).length, 0);
          /**
           * 🔒 A consolidação CLONA os slots do dia (`{...s}`), então as referências guardadas
           * em `bloco.adicionais`/`extrasDoFoco` deixam de apontar para os slots vivos. Sem
           * re-sincronizar, um extra que SOBREVIVEU passaria a contar como baseline nos relatos
           * — foi o que o contrato de `regressao-sequencia-reducao` pegou. A marca `extraDoFoco`
           * viaja no clone e é ela que reconstrói os dois conjuntos.
           */
          bloco.adicionais.clear(); extrasDoFoco.clear();
          for (const d of diasTreino) for (const x of d.slots) if (x.extraDoFoco) { bloco.adicionais.add(x); extrasDoFoco.add(x); }
          bloco.solicitados = Math.max(0, bloco.solicitados - (extrasAntes - extrasDepois));
          avisos.push(`O extra do foco coube nos exercícios que o dia já tinha: ${consolidadosDoFoco} exercício(s) a menos, com as mesmas séries, o mesmo crédito de cada grupo e a mesma cobertura identificada. A duração foi recalculada com os descansos dos exercícios mantidos.`);
        }
      }
      if (prioritarios.some(g => g !== 'core')) {
        const anteriores = rotinaBaseDoDeload?.blocoFoco?.adicionais ?? [];
        const entregues = diasTreino.flatMap(d => d.slots.filter(s => bloco.adicionais.has(s)
            || anteriores.some(a => a.diaId === d.diaId && a.exercicioId === s.exercicio.id))
            .map(s => ({diaId: d.diaId, exercicioId: s.exercicio.id, series: s.series ?? 0})));
        blocoFoco = {
          grupos: prioritarios.filter(g => g !== 'core'),
          // Intenção × entrega: a tela não pode anunciar o que o tempo removeu depois.
          solicitados: rotinaBaseDoDeload ? (rotinaBaseDoDeload.blocoFoco?.solicitados ?? entregues.length) : bloco.solicitados,
          adicionais: entregues,
          adaptado: bloco.adaptados.length > 0 || rotinaBaseDoDeload?.blocoFoco?.adaptado === true,
        };
      }
    }

    // (a reordenação por foco mora agora dentro do ramo automático, em `reordenarPeloFoco`,
    //  chamada ANTES da decisão de tempo — ver o comentário da fase B.)

    // Cobertura direta dos pequenos usa o piso já vigente do alocador.
    const diretos = (g: GrupoPrimario) => diasTreino.reduce((n, d) => n + d.slots.filter(s => s.exercicio.grupoPrimario === g).length, 0);
    const complementaresAusentes = GRUPOS_PEQUENOS_PISO.filter(g => !ehComplementar(g) && diretos(g) < PEQUENOS_PISO_DIRETO);
    if (complementaresAusentes.length) avisos.push(`Cobertura direta ausente neste plano: ${complementaresAusentes.map(g => ROTULO_GRUPO[g]).join(', ')}.`);
    /**
     * 🔵 OS COMPLEMENTARES QUE NÃO ENTRARAM SÃO DITOS (decisão do autor, 2026-09-19).
     *
     * Panturrilha e antebraço têm prioridade inferior aos grupos principais e entram um por
     * dia (panturrilha no dia de pernas; antebraço num dia de superiores sem outro
     * complementar). Quando não há dia que os comporte — ou o tempo da sessão não deixa slot
     * além do trabalho principal — o plano diz o impedimento em vez de omiti-los. Só no
     * automático com mais de um dia: no desenho da pessoa os exercícios são escolha dela, e o
     * full-body de um dia tem o caminho próprio (a dispensa nomeada por tempo).
     */
    if (automatico && !desenhoDaPessoa) {
      /** Os dias EFETIVOS: os recortes do foco de pernas, quando foram eles que valeram. */
      const diasEfetivos = recortesEntreguesDoFoco ?? templates;
      const motivoDoComplementar = (g: 'panturrilha' | 'antebraco' | 'core'): string | null => {
        if (diretos(g) > 0) return null;
        if (!pool.some((e) => e.grupoPrimario === g && e.padraoMovimento !== 'cardio')) return 'sem exercício elegível no seu equipamento e nível';
        if (!diasEfetivos.some((t) => t.grupos.includes(g))) {
          return g === 'panturrilha'
            ? 'não há dia de pernas disponível dentro do limite de um complementar por dia'
            : 'não há dia de superiores ou dedicado disponível dentro do limite de um complementar por dia';
        }
        const destinos = diasTreino.filter((_, i) => diasEfetivos[i]?.grupos.includes(g));
        if (destinos.length && destinos.every(d => d.slots.length >= budgetPorDia)) {
          return 'os dias compatíveis atingiram o limite de exercícios da sessão; o trabalho principal foi preservado';
        }
        return 'não coube nos limites de volume, tempo e distribuição do plano, preservando o trabalho principal';
      };
      for (const g of ['panturrilha', 'antebraco', 'core'] as const) {
        const motivo = motivoDoComplementar(g);
        if (motivo) avisos.push(`${ROTULO_GRUPO[g]} não entrou neste plano: ${motivo}.`);
      }
    }
    const focoAusente = prioritarios.filter(g => diretos(g) === 0);
    if (!custom && focoAusente.length) avisos.push(`O foco não foi atendido integralmente: sem exercício direto de ${focoAusente.map(g => ROTULO_GRUPO[g]).join(', ')} neste plano.`);

    // Invariantes (verificação + aviso honesto, sem afrouxar segurança).
    const contaPadrao = (p: PadraoMovimento) => diasTreino.reduce((n, d) => n + d.slots.filter((s) => s.padrao === p).length, 0);
    /**
     * 🔴 Revisão 15/09 (D-03) — o alvo puxar ≥ empurrar é do PLANO SEM FOCO. O bloco
     * adicional é autorizado a desequilibrar (foi decisão da coordenação não recusar um
     * extra por isso, nem compensá-lo em outro grupo), então medir o alvo com os extras
     * dentro acusaria um desequilíbrio que o baseline não tem.
     */
    const contaPadraoBaseline = (p: PadraoMovimento) =>
      diasTreino.reduce((n, d) => n + d.slots.filter((s) => s.padrao === p && !extrasDoFoco.has(s)).length, 0);
    if (contaPadraoBaseline('puxar') < contaPadraoBaseline('empurrar')) {
      const frase = 'Atenção: volume de puxar ficou abaixo do de empurrar (alvo: puxar ≥ empurrar).';
      avisos.push(frase);
      /**
       * 🔒 O FATO vai junto da frase. O crítico do editor diz o mesmo desequilíbrio com os
       * números (*"mais exercícios de empurrar (8) que de puxar (0)"*); sem o fato, a tela só
       * poderia deduplicar comparando texto — e os dois textos são diferentes de propósito.
       * Com o fato, `unificarAvisos` suprime esta linha quando o crítico já falou, e a mantém
       * quando o crítico não está na tela.
       */
      fatosInvariantes.push({
        invariante: 'puxar_maior_igual_empurrar', escopo: 'baseline',
        puxar: contaPadraoBaseline('puxar'), empurrar: contaPadraoBaseline('empurrar'), aviso: frase,
      });
    }
    if (diasForca >= 2 && contaPadrao('dobradica_quadril') < 1) {
      avisos.push('Atenção: padrão de dobradiça/quadril (cadeia posterior) não foi coberto.');
    }
    if (automatico && !desenhoDaPessoa && contaPadrao('core') < CORE_MIN) {
      avisos.push(`Core em ${contaPadrao('core')} sessão(ões): frequência menor nesta semana para respeitar os dias disponíveis, os limites da sessão e um complementar por dia misto.`);
    } else if (diasForca >= 2 && (contaPadrao('core') < CORE_MIN || contaPadrao('core') > CORE_MAX)) {
      avisos.push('Atenção: core fora da faixa de 2–3×/semana.');
    }
    if (budgetPorDia <= 3) {
      avisos.push('Tempo por sessão curto: priorizamos os exercícios fundamentais.');
    }
    /**
     * 🔵 A SEMANA DE ALÍVIO SE EXPLICA (2026-09-17, 2ª volta) — e agora de verdade.
     *
     * ⚠️ Isto nasceu de uma passagem acidental que a limpeza do item 2 expôs: o contrato
     * *"a redução planejada do deload é explicada"* (`editor-avisos-e-paridade`) vinha
     * passando porque a semana 6 emitia a frase `alvo de N séries para X não cabe em M
     * exercício(s)` — que não fala de deload nenhum e comparava moedas diferentes. Retirada
     * a frase errada, a semana 6 ficou SEM explicação nenhuma no editor, e o contrato caiu —
     * corretamente. A explicação que faltava é esta, e ela não depende de nenhuma outra.
     *
     * 🔒 Linguagem de processo, sem promessa de resultado e sem número que possa divergir da
     * dose entregue: a faixa desta semana já vai publicada em `faixaVolumeSemana`.
     */
    if (deloadAgendado) {
      avisos.push('Esta é a semana de alívio do ciclo: o volume é reduzido de propósito, e por isso os grupos aparecem abaixo do que vinham entregando. Não é um déficit do plano — é a fase. No próximo ciclo a dose cheia volta.');
    }

    /**
     * 🔢 v4 — GUARD DE COBERTURA (handoff B1.5): a pergunta que o motor nunca fez — "este
     * grupo foi coberto?" — vira verificação. Grupo GRANDE abaixo do MEV em contagem
     * PONDERADA (direto 1,0 + secundário 0,5) ⇒ aviso honesto. Fora da retomada (lá o
     * volume baixo é a feature) e só com séries decididas (ramo do ciclo).
     */
    if (semanaCiclo && !ret && semanaCiclo.semana !== 6) medirCobertura(diasTreino);

    /**
     * 🔴 D14 — DIA VAZIO NÃO É SESSÃO ENTREGUE. Ele sai de `dias` (e portanto da certificação
     * de duração, que media 0 s e dizia "cabe") e passa a ser declarado em
     * `diasNaoAtendidos`, com o mesmo motivo que o aviso do motor já nomeia. O dia pedido pela
     * pessoa NÃO some do plano: some da contagem de entrega.
     */
    /**
     * 🔵 P-04 (decisão do autor 2026-09-16) — O RESUMO DA SEMANA REFLETE O QUE FOI PRESCRITO.
     *
     * `semana.descansoCompostoSeg` é o escalar legado que a tela usa como referência (e como
     * fallback do slot sem `descansoSeg`, em `Painel.tsx`). Depois da etapa 3 ele só subia ao
     * teto de 180 s no caminho NÃO automático, então o automático publicava a faixa da
     * prescrição enquanto os slots traziam outros números — o campo dizia uma coisa e os
     * exercícios diziam outra (P-04 da revisão).
     *
     * 🔒 A saída aqui é REPRESENTAR A FAIXA REAL, nunca uniformizar os exercícios para a tela
     * concordar: min e max dos descansos efetivamente prescritos aos slots de classe composta
     * (COMPOSTO e POTENCIA degradam juntos). As diferenças legítimas por classe, força
     * pesada, fase do ciclo e ajuste temporal continuam intactas — elas é que produzem a
     * faixa. Sem slot composto com descanso decidido (chamada v1, cardio puro), fica o valor
     * anterior, que é o único que existe.
     */
    const descansosCompostosDoPlano = diasTreino.flatMap((d) => d.slots
      .filter((s) => s.descansoSeg != null && classeDeDescanso(s.exercicio) !== 'ISOLADO' && classeDeDescanso(s.exercicio) !== 'NAO_SE_APLICA')
      .map((s) => s.descansoSeg!));
    const descansoCompostoDaSemana: Faixa = descansosCompostosDoPlano.length > 0
      ? { min: Math.min(...descansosCompostosDoPlano), max: Math.max(...descansosCompostosDoPlano) }
      : descansoEfetivo;
    const diasEntregues = diasTreino.filter((d) => d.slots.length > 0);
    /**
     * 🔴 OS CORTES POR TEMPO QUE SOBREVIVERAM ATÉ A ENTREGA (2026-09-16).
     *
     * 🔒 `para` vem do plano ENTREGUE, não do instante do corte: entre a fase A e aqui
     * ainda rodam a poda do MRV e a remoção de extras por tempo. Um fato cujo `para` não
     * fosse a dose exibida seria pior que nenhum — a tela atribuiria ao tempo um número que
     * outra regra decidiu.
     *
     * 🔒 Só entra quem de fato ENCOLHEU (`para < de`). Se algo devolveu a série, não há
     * corte a explicar.
     */
    const cortesDeTempo = (dias: readonly DiaTreino[]): FatoCorteTempo[] => dias.flatMap((d) =>
      d.slots.flatMap((sl) => {
        const de = sl.seriesAntesDoCorteDeTempo;
        const para = sl.series;
        if (de == null || para == null || para >= de) return [];
        return [{
          ...(d.diaId ? { diaId: d.diaId } : {}),
          exercicioId: sl.exercicio.id, de, para, limiteMin: perfil.tempoPorSessaoMin,
        }];
      }));
    const diasNaoAtendidos: DiaNaoAtendido[] = diasTreino
      .filter((d) => d.slots.length === 0)
      .map((d) => ({
        nome: d.nome,
        ...(d.diaId ? { diaId: d.diaId } : {}),
        motivo: d.motivoDoCorte ?? ('DESENHO_VAZIO' as const),
        ...(d.slotsNaoPreenchidos != null ? { slotsPedidos: d.slotsNaoPreenchidos } : {}),
      }));
    /**
     * 🔵 O DIA ESCOLHIDO QUE NÃO VIROU TREINO É DITO (relato 2026-09-19).
     *
     * 🔴 O defeito que isto fecha, medido: perfil intermediário marcando os SETE dias recebia
     * um plano de segunda a sexta e NENHUMA frase sobre sábado e domingo — e o Editar perfil
     * ainda rotulava os sete como "Treino". A pessoa lia "mudei os dias e o treino não mudou".
     * A regra em si é do cofre (`motor-treino-volume-e-frequencia-por-nivel`, claims --007 e
     * --010: `min(dias_disponiveis, teto)`, excedente → cardio/recuperação); o que faltava era
     * DIZÊ-LA. Nada é redistribuído aqui: o dia continua sendo cardio/recuperação.
     *
     * 🔒 Dia já declarado em `diasNaoAtendidos` não entra: ele tem motivo próprio e frase
     * própria, e repetir seria a mesma verdade contada duas vezes.
     */
    const jaDeclarados = new Set(diasNaoAtendidos.flatMap((d) => (d.diaId ? [d.diaId] : [])));
    const comSessao = new Set(diasEntregues.flatMap((d) => (d.diaId ? [d.diaId] : [])));
    const semForca = diasDaAgenda.filter((d) => !comSessao.has(d) && !jaDeclarados.has(d));
    if (semForca.length > 0) {
      const nomes = semForca.map((d) => DIA_LABEL[d].full);
      const lista = nomes.length === 1 ? nomes[0]! : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
      const Lista = lista.charAt(0).toUpperCase() + lista.slice(1);
      const ficaram = semForca.length === 1 ? 'ficou' : 'ficaram';
      avisos.push(desenhoDaPessoa
        ? `Você marcou ${diasDaAgenda.length} dias e o seu treino cobre ${comSessao.size}. ${Lista} ${ficaram} sem sessão: `
          + 'o app não reescreve o seu desenho. Monte esses dias em "Montar meu treino" ou peça um treino novo.'
        : `Você marcou ${diasDaAgenda.length} dias e o plano usou ${comSessao.size}: o seu nível comporta `
          + `${teto} sessões de força por semana${diaComplementar ? ', mais um dia dedicado aos complementares' : ''}. `
          + `${Lista} ${ficaram} como cardio/recuperação — não movemos nem repetimos uma sessão para preencher.`);
    }
    return {
      diasForcaAgendados: diasEntregues.length,
      diasCardioRecuperacao,
      diasCardio: montarDiasCardio(diasCardioRecuperacao, prescricao.cardio, perfil.cardioFavorito),
      split,
      dias: diasEntregues,
      ...(diasNaoAtendidos.length > 0 ? { diasNaoAtendidos } : {}),
      ...(blocoFoco ? {blocoFoco} : {}),
      ...(focoCoreAdicional ? {focoCoreAdicional} : {}),
      // 🔒 B2: o ramo que agiu vai junto do plano — a tela não recalcula nem adivinha.
      ...(foco && decisaoFoco && diretos(foco.grupo) > 0
        ? { foco: { grupo: foco.grupo, compensa: foco.compensa, degrau: decisaoFoco.degrau, motivo: decisaoFoco.motivo, series: decisaoFoco.series } }
        : {}),
      cardio: prescricao.cardio,
      avisos,
      /**
       * 🔵 AS REGIÕES QUE FICARAM PENDENTES, com o motivo (item 6 do pedido de 2026-09-17).
       *
       * 🔒 NÃO vai para `avisos`: isto é diagnóstico, não alerta — não bloqueia salvamento,
       * não muda o veredito e não entra no tripwire de famílias de aviso. Vai publicado junto
       * do plano pela mesma razão da exceção de sessão: prévia, plano salvo e editor leem a
       * MESMA lista, em vez de cada tela recalcular a sua.
       *
       * 🔒 Os grupos do dia saem de `gruposDoDia` — a MESMA função que a cobertura do editor
       * usa —, e não do template. É o que garante que o plano e o editor nunca digam coisas
       * diferentes sobre o mesmo dia.
       */
      ...(() => {
        const pendencias = diasEntregues.map((d) => diagnosticarDia({
          nome: d.nome,
          grupos: gruposDoDia(d.slots.map((s) => s.exercicio)),
          escolhidos: d.slots.map((s) => s.exercicio),
          elegiveis: pool,
          slotsDisponiveis: budgetPorDia,
          espaco: {
            slotsLivres: Math.max(0, budgetPorDia - d.slots.length),
            cabeNoTempo: (novo) => {
              if (limiteDiarioSegundos === undefined) return true;
              const exs = [...d.slots.map((s) => s.exercicio), novo];
              return ([0, 1, 2] as const).some((deg) => custoDoDiaParaCobertura(exs, deg) <= limiteDiarioSegundos);
            },
            cabeNoVolume: (novo) => {
              const s = prescricao.seriesPorExercicio.max;
              const semana = creditoPonderadoDaSemana(diasEntregues.flatMap((x) => x.slots)
                .map((x) => ({ exercicio: x.exercicio, series: s })));
              for (const [g, n] of creditoPonderadoDaSemana([{ exercicio: novo, series: s }])) {
                if ((semana.get(g) ?? 0) + n > tetoSemanalGrupo(g)) return false;
              }
              return true;
            },
            // A MESMA pergunta que o passe faz na hora de decidir, e não uma segunda régua.
            trocaNaoEncarece: (sai, entra) => {
              const antes = d.slots.map((x) => x.exercicio);
              const depois = antes.map((e) => (e === sai ? entra : e));
              return ([0, 1, 2] as const).every((deg) =>
                custoDoDiaParaCobertura(depois, deg) <= custoDoDiaParaCobertura(antes, deg));
            },
          },
        })).filter((d) => d.naoIdentificados.length > 0 || d.redundanciasMecanicas.length > 0);
        return pendencias.length > 0 ? { coberturaAnatomica: pendencias } : {};
      })(),
      ...(fatosCobertura.length > 0 ? { fatosCobertura: [...fatosCobertura] } : {}),
      ...(fatosInvariantes.length > 0 ? { fatosInvariantes: [...fatosInvariantes] } : {}),
      ...(cortesDeTempo(diasEntregues).length > 0 ? { fatosCorteTempo: cortesDeTempo(diasEntregues) } : {}),
      /**
       * 🔵 A EXCEÇÃO DO TETO POR SESSÃO, publicada com o plano (2026-09-17, 2ª volta).
       *
       * 🔒 Vai junto do plano de propósito: a mesma lista serve à prévia (antes da
       * confirmação), ao plano salvo e ao editor. Recalcular em cada tela seria a segunda
       * verdade de sempre — e a prévia e o plano poderiam discordar sobre o que a pessoa
       * está aceitando.
       */
      ...(excecoesDeSessao.length > 0 ? { excecoesDeSessao } : {}),
      /**
       * 🔴 A FAIXA QUE VALE NESTA SEMANA, PUBLICADA (correção 2026-09-15).
       *
       * O crítico do editor comparava o volume de uma semana de DELOAD (ou de retomada) com o
       * piso TERMINAL do mesociclo e dizia "abaixo da faixa mínima **desta semana**" — 6 de 6
       * grupos acusados na semana em que o motor reduz o volume de propósito, e o montador,
       * que sabe disso, se cala (o guard pula `semana === 6` e a retomada).
       *
       * 🔒 Nenhum número novo: `deload` é a banda que `aplicarDeload` já produz e a rampa já
       * usa; `retomada` é o alvo de `volumeDaRetomada`, que já decide as séries do grupo — e o
       * teto continua o da banda, porque a retomada nunca elevou teto nenhum. Quem consome
       * (Painel e Editor) lê daqui em vez de recalcular: uma autoridade só.
       */
      ...(semanaCiclo
        ? {
          faseVolume: (semanaCiclo.retomada ? 'retomada' : deloadAgendado ? 'deload' : 'normal') as FaseVolume,
          faixaVolumeSemana: faixaDaSemana,
          /**
           * 🔵 Os TETOS, publicados ao lado da faixa desejada (2026-09-17). Sem eles o editor
           * teria de recalcular a margem de 3 por conta própria — a segunda verdade de
           * sempre — e não teria como distinguir "acima do que o app monta sozinho" de
           * "acima do teto".
           */
          tetoVolumeSemana: tetosPublicados,
        }
        : {}),
      // Metadados do mesociclo (v2) — spread condicional preserva a saída v1 byte a byte.
      ...(semanaCiclo
        ? { semana: { numero: semanaCiclo.semana, deload: semanaCiclo.semana === 6, descansoCompostoSeg: descansoCompostoDaSemana } }
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
  const cortePorSelecao = perfil.equipamento === 'academia' && selecao.preservarRecortes;
  const porCatalogo = diasAlocados.filter((d) => d.naoPreenchidos > 0 && d.motivoCurto === 'catalogo');
  if (porCatalogo.length > 0) {
    const quais = porCatalogo.map((d) => d.nome).join(', ');
    avisos.push(cortePorSelecao
      ? `A seleção compatível com o plano limita estes dias: ${quais}. Não acrescentamos variantes apenas para ocupar o tempo disponível.`
      : `Seu equipamento disponível limita ${porCatalogo.length === 1 ? 'este dia' : 'estes dias'}: ${quais}. Com o que você marcou no perfil, não há exercício novo para acrescentar sem repetir o que já está lá.`);
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

  const diasTreino: DiaTreino[] = diasAlocados.map((d, treinoIdx) => ({
    nome: d.nome,
    diaId: diasForcaDaSemana[treinoIdx],
    // Quantos slots o template pediu e NENHUM grupo pôde preencher — o número que sustenta
    // o aviso acima. Exposto para o guard poder ancorar no corte de fato, e não em "o dia
    // veio abaixo do orçamento" (que também acontece por reserva não honrada, inclusive em
    // academia, e não é corte por catálogo).
    ...(d.naoPreenchidos > 0 ? { slotsNaoPreenchidos: d.naoPreenchidos } : {}),
    // 🔴 D14 — a causa viaja com o dia: o mesmo `motivoCurto` que decide qual aviso sai.
    ...(d.naoPreenchidos > 0 && d.motivoCurto === 'catalogo' ? { motivoDoCorte: cortePorSelecao ? 'SELECAO_COMPATIVEL' as const : 'EQUIPAMENTO' as const } : {}),
    ...(d.naoPreenchidos > 0 && d.motivoCurto === 'teto' ? { motivoDoCorte: 'TETO_SEMANAL' as const } : {}),
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
  const limiteCertificacao = perfil.limiteTempoTreino === 'sem_limite' ? undefined : orcamentoSeg;

  /**
   * 🔒 C1 §6.7/§7.8 — VALIDAÇÃO DOS TRÊS INVARIANTES do plano REALOCADO, contra as entradas
   * INDEPENDENTES (equipamento do perfil e cobertura obrigatória), reusando `avaliarInvariantes`
   * do orquestrador canônico. Roda SÓ depois de uma realocação do reduce-to-fit: é a rede que
   * transforma "o alocador preserva por construção" numa AFIRMAÇÃO VERIFICADA em runtime.
   * Violou ⇒ `ERRO_ALOCADOR{INVARIANTE_VIOLADO}` e o laço encerra — nunca se classifica um plano
   * estruturalmente inválido como incompatibilidade temporal nem se continua reduzindo a partir dele.
   */
  const violacoesDaRealocacao = (r: RotinaSemanal): string[] => {
    const permitidos = new Set<string>(
      locaisPermitidos(perfil.equipamento).flatMap((l) => (l === 'academia' ? ['academia'] : l === 'casa_com' ? ['casa_com'] : ['casa_sem'])),
    );
    // `dobradica_quadril` conta como cobertura de membro inferior (`agachar`); `cardio` não é slot
    // resistido e não chega aqui. O mapa é explícito para o compilador provar a totalidade.
    const PARA_PADRAO: Record<PadraoMovimento, Padrao> = {
      puxar: 'puxar', empurrar: 'empurrar', agachar: 'agachar',
      dobradica_quadril: 'agachar', isolado: 'isolado', core: 'core', cardio: 'core',
    };
    /**
     * 🔴 REVISÃO INDEPENDENTE 15/09 (D-03) — COBERTURA E puxar ≥ empurrar SÃO DO BASELINE.
     *
     * Tirar a guarda de `bloco-foco-adicional` não bastava: o invariante rodava sobre o
     * plano INTEIRO, então um extra de `empurrar` autorizado derrubava o plano em
     * `ERRO_ALOCADOR{INVARIANTE_VIOLADO}` — a mesma recusa, um degrau acima. A decisão da
     * coordenação é que o balanceamento é referência do plano SEM FOCO e que o
     * desequilíbrio vindo dos extras autorizados é consequência aceita, sem compensar em
     * outro grupo. Então cobertura e equilíbrio são medidos no baseline.
     *
     * Equipamento continua valendo para TODO slot entregue: um extra fora da allowlist é
     * defeito de elegibilidade, não desequilíbrio de padrão.
     */
    const extras = new Set((r.blocoFoco?.adicionais ?? []).map((a) => `${a.diaId ?? ''}|${a.exercicioId}`));
    const item = (s: SlotExercicio) => ({
      diaId: 'verificacao',
      id: s.exercicio.id,
      padrao: PARA_PADRAO[s.padrao],
      grupo: s.exercicio.grupoPrimario ?? 'na',
      equipamento: s.exercicio.local,
      series: s.series ?? 1,
      descansoSeg: s.descansoSeg ?? 0,
      execucao: { tipo: 'REPETICOES' as const, segundosEstimadosPorSerie: TEMPO_EXECUCAO_SERIE_REPS_SEG },
    });
    const baseline = r.dias.flatMap((d) => d.slots.filter((s) => !extras.has(`${d.diaId ?? ''}|${s.exercicio.id}`)));
    const doFoco = r.dias.flatMap((d) => d.slots.filter((s) => extras.has(`${d.diaId ?? ''}|${s.exercicio.id}`)));
    const violacoes = avaliarInvariantes(
      baseline.map(item),
      // cobertura obrigatória da spec §8 (fixture 21) + allowlist REAL de locais do perfil.
      { coberturaObrigatoria: COBERTURA_TEMPORAL_OBRIGATORIA, equipamentosDisponiveis: [...permitidos] },
    ).violacoes;
    for (const s of doFoco) {
      if (!permitidos.has(s.exercicio.local)) violacoes.push(`equipamento fora da allowlist: ${s.exercicio.id} (${s.exercicio.local})`);
    }
    return violacoes;
  };

  /** Dia de um treino é explícito quando disponível; posição na agenda só atende rotinas legadas. */
  const diaIdDaRotina = (dia: DiaTreino, treinoIdx: number): Weekday =>
    dia.diaId ?? diasForcaDaSemana[treinoIdx] ?? ORDEM_SEMANA[treinoIdx % ORDEM_SEMANA.length]!;

  /** Converte o plano real em fatos de redução com identidade estável por dia/exercício/ocorrência. */
  const itensTemporaisDaRotina = (r: RotinaSemanal): ItemPlanoTemporal[] => {
    const PARA_PADRAO: Record<PadraoMovimento, Padrao> = {
      puxar: 'puxar', empurrar: 'empurrar', agachar: 'agachar',
      dobradica_quadril: 'agachar', isolado: 'isolado', core: 'core', cardio: 'core',
    };
    return r.dias.flatMap((dia, treinoIdx) => {
      const diaId = diaIdDaRotina(dia, treinoIdx);
      const ocorrencias = new Map<string, number>();
      return dia.slots.map((slot) => {
        const ocorrencia = ocorrencias.get(slot.exercicio.id) ?? 0;
        ocorrencias.set(slot.exercicio.id, ocorrencia + 1);
        return {
          diaId,
          id: `${diaId}:${slot.exercicio.id}:${ocorrencia}`,
          padrao: PARA_PADRAO[slot.padrao],
          grupo: slot.exercicio.grupoPrimario ?? `padrao:${slot.padrao}`,
          equipamento: slot.exercicio.local,
          series: slot.series ?? 0,
          descansoSeg: slot.descansoSeg ?? 0,
          // Fato de redução não inventa hold: ausência fica 0 neste artefato não-certificador.
          execucao: repUnitDe(slot.exercicio.id) === 'segundos'
            ? { tipo: 'ISOMETRIA', holdSegundosPorSerie: slot.holdSeg ?? 0 }
            : { tipo: 'REPETICOES', segundosEstimadosPorSerie: TEMPO_EXECUCAO_SERIE_REPS_SEG },
          unilateralDoisLados: slot.execucaoSelecionada === 'UNILATERAL_DOIS_LADOS',
        };
      });
    });
  };

  /** Materializa o único plano final por dia e deriva dele as vistas consumidas pelo produto. */
  const materializarPlanoFinal = (
    r: RotinaSemanal,
    distribuicaoCardio: NonNullable<RotinaSemanal['distribuicaoCardio']>,
    diasCardioSemDuracao: ReadonlySet<Weekday>,
  ): Pick<RotinaSemanal, 'planoFinalPorDia' | 'duracaoDias' | 'diasCardio'> => {
    const blocoPorDia = new Map(distribuicaoCardio.blocosPorDia.map((b) => [b.diaId, b]));
    const modalidade = perfil.cardioFavorito ?? MODALIDADE_PADRAO_DIA;
    const treinoIdxPorDia = new Map(r.dias.map((dia, treinoIdx) => [diaIdDaRotina(dia, treinoIdx), treinoIdx]));
    const planoFinalPorDia: PlanoFinalDia[] = ORDEM_SEMANA.map((diaId, ordemNoHorizonte) => {
      const treinoIdx = treinoIdxPorDia.get(diaId);
      const treino = treinoIdx == null ? undefined : r.dias[treinoIdx];
      const bloco = blocoPorDia.get(diaId);
      const cardioSemDuracao = diasCardioSemDuracao.has(diaId);
      const cardio: DiaCardio | undefined = bloco
        ? {
            nome: 'Cardio', padrao: 'cardio', modalidade,
            minutos: bloco.duracaoTotalSegundos / 60,
            diaId, ordemNoHorizonte, duracaoSegundos: bloco.duracaoTotalSegundos,
            linhagens: bloco.linhagens,
          }
        : cardioSemDuracao
          ? { nome: 'Cardio', padrao: 'cardio', modalidade, minutos: null, diaId, ordemNoHorizonte }
          : undefined;
      const duracao = avaliarDuracaoFinalDoDia(
        treino?.slots ?? [], perfil.nivelExperiencia, limiteCertificacao, bloco?.duracaoTotalSegundos ?? 0,
        cardioSemDuracao, automatico,
      );
      const tipo: PlanoFinalDia['tipo'] = treino
        ? (cardio ? 'TREINO_E_CARDIO' : 'TREINO')
        : (cardio ? 'CARDIO' : 'VAZIO');
      return {
        diaId, ordemNoHorizonte, tipo,
        ...(treino && treinoIdx != null ? { treinoIdx } : {}),
        ...(cardio ? { cardio } : {}),
        duracao,
      };
    });

    const duracaoDias = r.dias.map((_, treinoIdx) =>
      planoFinalPorDia.find((dia) => dia.treinoIdx === treinoIdx)!.duracao);
    // A visão consumida pelo produto nasce dos blocos positivos e, quando a prescrição é
    // qualitativa, de um item explícito sem duração. Ausência de número nunca vira ausência de plano.
    const diasCardio = planoFinalPorDia.flatMap((d) => d.cardio ? [d.cardio] : []);
    return { planoFinalPorDia, duracaoDias, diasCardio };
  };

  /** Finaliza UMA vez: distribuição e duração final só rodam depois de escolhido o terminal. */
  const finalizar = (
    r: RotinaSemanal,
    rg: ResultadoGeracaoRotina,
    baseline: RotinaSemanal = r,
  ): RotinaSemanal => {
    const fatos: FatosReducao = fatosReducao(itensTemporaisDaRotina(baseline), itensTemporaisDaRotina(r));
    // Atendimento é medido no terminal, depois de séries, restrições e redução temporal.
    const intencao = !custom ? selecaoFoco.intencao : undefined;
    const recortesEntregues = intencao ? contarRecortesEntregues(intencao.recortes,
      r.dias.map(d => d.slots.flatMap(s => s.exercicio.grupoPrimario ? [s.exercicio.grupoPrimario] : []))) : 0;
    const distribuicao = intencao ? {
      planejada: intencao.nome, recortesPlanejados: intencao.recortes.length, recortesEntregues,
      limitadaPeloCalendario: calendarioFoco.limitado, adaptada: intencao.adaptada,
      atendida: !calendarioFoco.limitado && !intencao.adaptada && recortesEntregues === intencao.recortes.length,
    } : undefined;
    if (distribuicao && !distribuicao.atendida) avisos.push(
      `Distribuição planejada (${distribuicao.planejada}) não atendida integralmente. `
      + (distribuicao.limitadaPeloCalendario ? 'A recuperação entre os dias disponíveis exige adaptar a organização. ' : '')
      + (distribuicao.adaptada ? 'Mantivemos a organização vigente para o nível ou a retomada. ' : '')
      + `Recortes principais entregues: ${recortesEntregues} de ${distribuicao.recortesPlanejados}. Confira os limites de cobertura do plano.`,
    );
    if (rg.tipo === 'ERRO_ALOCADOR') {
      return { ...r, distribuicao, avisos: [...avisos], fatosReducao: fatos, resultadoGeracao: rg };
    }

    const diasResistidos = r.duracaoResistidaDias ?? r.duracaoDias ?? [];
    const oferecidos = ORDEM_SEMANA.filter((dia, indice) =>
      diasOferecidosCardio.includes(dia) || diasOferecidosCardio.includes(indice));
    const cardioPrescritoPorDiaSegundos =
      prescricao.cardio.tipo === 'minutos_semana' && oferecidos.length > 0
        ? duracaoDoDiaDeCardio(prescricao.cardio.min, oferecidos.length) * 60
        : 0;
    const entradaCardioViva = {
      diasComMusculacao: r.dias.map((dia, treinoIdx) => ({
        diaId: diaIdDaRotina(dia, treinoIdx),
        duracao: diasResistidos[treinoIdx]!,
      })),
      diasOferecidosCardio: oferecidos,
      orcamentoSegundos: limiteCertificacao,
      ...(perfil.limiteTempoTreino === 'sem_limite' ? { semLimite: true } : {}),
      cardioPrescritoPorDiaSegundos,
      aggregateId: 'rotina-cardio',
      expectedRevision: 0,
      formulaVersion: FORMULA_DURACAO_VERSION,
    };
    const fatosDistribuicaoCardio = fatosDistribuicaoCardioDaRotina(entradaCardioViva);
    const distribuicaoCardio = distribuirCardioDaRotina(entradaCardioViva);
    const diasCardioSemDuracao = prescricao.cardio.tipo === 'sessoes_moderadas'
      ? new Set(oferecidos)
      : new Set<Weekday>();
    const final = materializarPlanoFinal(r, distribuicaoCardio, diasCardioSemDuracao);
    /**
     * 🔴 D4 — A PERDA É DITA. O corte pelo orçamento de cada dia já acontecia e já era
     * medido; o que faltava era sair do objeto e virar número e frase. Medido no SHA
     * `34b2ede`: oferta de 4 dias prescrevia 160 min e entregava 123, sem aviso nenhum.
     *
     * 🔒 Nada é redistribuído para consertar o número: cardio só vai a dia OFERECIDO, e
     * oferecer por conta própria seria prescrever em dia que a pessoa não deu. A conta é dita
     * como está.
     */
    const prescritoSegundos = fatosDistribuicaoCardio.prescricoesCardio
      .reduce((n, p) => n + (p.duracaoPrescritaSegundos > 0 ? p.duracaoPrescritaSegundos : 0), 0);
    const entregueSegundos = distribuicaoCardio.blocosPorDia
      .reduce((n, b) => n + b.duracaoTotalSegundos, 0);
    const cardioSemana = prescritoSegundos > 0
      ? { prescritoSegundos, entregueSegundos, faltanteSegundos: Math.max(0, prescritoSegundos - entregueSegundos) }
      : undefined;
    if (cardioSemana && cardioSemana.faltanteSegundos > 0) {
      const min = (seg: number) => Math.round(seg / 60);
      avisos.push(
        `Cardio: o plano pede ${min(cardioSemana.prescritoSegundos)} min nesta semana e couberam `
        + `${min(cardioSemana.entregueSegundos)} min nos dias que você ofereceu — faltam `
        + `${min(cardioSemana.faltanteSegundos)} min. O cardio entra só em dia que você ofereceu e `
        + `nunca tira tempo da musculação.`,
      );
    }
    /**
     * 🔴 D3 — a INVARIANTE do certificado, num único ponto que cobre os DOIS produtores
     * (alocador automático e editor guiado): `CERTIFICADO` afirma *"todo dia cabe"*, então um
     * dia MEDIDO acima do limite operacional o desqualifica. O plano continua entregue e
     * intacto — o que muda é o rótulo, e ele passa a nomear os dias que estouram.
     *
     * No caminho automático isto nunca deve morder (o `reduceToFit` degrada até caber); é o
     * ramo manual, que por política não reduz, quem produz o caso. Se um dia morder no
     * automático, o rótulo honesto é este e não o falso verde.
     */
    const acimaDoLimite = (final.duracaoDias ?? [])
      .map((d, i) => (d.estadoLimite === 'ACIMA_DO_LIMITE_OPERACIONAL' ? i : -1))
      .filter((i) => i >= 0);
    /**
     * 🔴 D12 — a CONDIÇÃO DE CERTIFICAÇÃO, unificada. `precisaReduzir` (o ramo automático) já
     * tratava `LIMITE_INDETERMINADO` como "não cabe"; o guard aqui não. Agora os dois dizem a
     * mesma coisa — e a frase separa o que foi medido do que ficou em aberto.
     */
    const podemUltrapassar = (final.duracaoDias ?? [])
      .map((d, i) => (d.estadoLimite === 'LIMITE_INDETERMINADO' ? i : -1))
      .filter((i) => i >= 0);
    const rgCertificado: ResultadoGeracaoRotina =
      rg.tipo === 'CERTIFICADO' && (acimaDoLimite.length > 0 || podemUltrapassar.length > 0)
        ? {
            tipo: 'ENTREGUE_SEM_CERTIFICACAO',
            diasAcimaDoLimite: acimaDoLimite,
            ...(podemUltrapassar.length > 0 ? { diasPodemUltrapassar: podemUltrapassar } : {}),
          }
        : rg;
    const resultadoFinal: ResultadoGeracaoRotina =
      prescricao.cardio.tipo === 'sessoes_moderadas' && oferecidos.length > 0 && rgCertificado.tipo !== 'INCOMPATIVEL'
        ? {
            tipo: 'NAO_AVALIADO_ENTREGAVEL',
            ...(acimaDoLimite.length > 0 ? { diasAcimaDoLimite: acimaDoLimite } : {}),
            // 🔴 D12 — estado combinado: cardio sem duração E dia que pode estourar. Os dois
            // fatos convivem no mesmo terminal; suprimir um deles é escolher qual verdade contar.
            ...(podemUltrapassar.length > 0 ? { diasPodemUltrapassar: podemUltrapassar } : {}),
            motivos: [...new Set([
              ...(rgCertificado.tipo === 'NAO_AVALIADO_ENTREGAVEL' ? rgCertificado.motivos : []),
              'CARDIO_SEM_DURACAO',
            ])],
          }
        : rgCertificado;
    return {
      ...r, ...final, limiteTempoEstrito: automatico, limiteTempoTreino: perfil.limiteTempoTreino ?? 'limitado', distribuicao, fatosReducao: fatos, fatosDistribuicaoCardio, distribuicaoCardio, resultadoGeracao: resultadoFinal,
      ...(cardioSemana ? { cardioSemana } : {}),
      avisos: [...avisos],
      ...(resultadoFinal.tipo === 'INCOMPATIVEL' ? { duracaoIncompativel: true } : {}),
    };
  };

  if (diasUsuarioCustom != null) {
    // A alocação automática acima só preparou os helpers compartilhados. Nenhum aviso ou foco
    // dela pode vazar para a rotina manual, cujo único conteúdo é a decisão do usuário.
    avisos.length = 0;
    avisos.push(...avisosCustom);
    decisaoFoco = null;
    compensadorValido = null;
    // 🔒 O ÚNICO chamador que é o desenho da pessoa. A dose escolhida vale só aqui.
    const saidaCustom = montarSaida(diasUsuarioCustom, 'Meu treino', true);
    const naoAtendidosCustom = [...(saidaCustom.diasNaoAtendidos ?? []), ...diasNaoAtendidosCustom];
    const rotinaCustomEstrutural = {
      ...saidaCustom,
      // 🔴 D14 — a contagem de entrega vem de `montarSaida`, que já excluiu o dia vazio. O
      // override antigo (`diasUsuarioCustom.length`) contava o dia desenhado, não o entregue.
      // E o dia NÃO ATENDIDO não vira dia de recuperação: seria a redistribuição silenciosa.
      diasCardioRecuperacao: Math.max(0, dias - diasUsuarioCustom.length - naoAtendidosCustom.length),
      ...(naoAtendidosCustom.length > 0 ? { diasNaoAtendidos: naoAtendidosCustom } : {}),
    };
    // Author request 2026-09-10 supersedes the old editor's non-editable sets.
    // Apply before duration certification; recovery never increases its assigned volume.
    //
    // Deload reduz a escolha manual pela constante do motor, uma única vez.
    // Retomada mantém seu teto específico. O desenho original permanece intacto.
    for (const dia of rotinaCustomEstrutural.dias) {
      const desenho = custom?.dias.find((d, i) => (d.diaId ?? diasForcaDaSemana[i]) === dia.diaId);
      for (const slot of dia.slots) {
        const escolhidas = desenho?.seriesPorExercicio?.[slot.exercicio.id];
        // Sem escolha para este exercício: o motor decide, e não há nada a dizer.
        if (escolhidas == null) continue;
        /**
         * 🔴 D3 — entrada inválida é RECUSADA e DITA. Antes o `continue` engolia o valor: a
         * pessoa digitava, o número sumia, o plano vinha com outro e nada explicava. O teto é
         * de TAMANHO (`SERIES_MANUAIS_MAX`), não uma regra de treino — por isso a frase nomeia
         * a trava em vez de fingir fundamento fisiológico.
         */
        if (!Number.isInteger(escolhidas) || escolhidas < 1 || escolhidas > SERIES_MANUAIS_MAX) {
          avisos.push(`Séries de ${slot.exercicio.nomePt}: ${escolhidas} não é um número inteiro de 1 a ${SERIES_MANUAIS_MAX} — mantivemos a quantidade calculada pelo app para este exercício.`);
          continue;
        }
        // Retomada limita pelo estágio de recuperação. Deload reduz a escolha do usuário
        // pela mesma constante da prescrição; limitá-la ao automático cortava 99 para 2.
        slot.series = semanaCiclo?.retomada
          ? Math.min(escolhidas, slot.series ?? escolhidas)
          : deloadAgendado ? seriesEmDeload(escolhidas) : escolhidas;
        slot.seriesDefinidasPeloUsuario = true;
      }
    }
    /**
     * 🟠 O TETO PONDERADO NO DESENHO DA PESSOA — e SÓ sobre o que o APP dosou.
     *
     * 🔒 A instrução vigente (2026-09-16) manda valer o MRV ponderado "para todos os grupos,
     * no baseline e no foco", e manda não alterar em silêncio treino manual salvo. As duas
     * coisas cabem juntas porque num desenho manual convivem DOIS tipos de número: a série que
     * a pessoa digitou (`seriesDefinidasPeloUsuario`, aplicada no laço logo acima) e a série que
     * o app calculou pela rampa para o exercício que ela não dosou. A poda alcança apenas o
     * segundo: o app corrige o número do app. O da pessoa fica onde ela pôs — e se for ele que
     * estoura, o grupo cai em `irredutíveis` e o crítico continua dizendo, que é o comportamento
     * que o editor já tem hoje.
     *
     * 🔒 O crédito é calculado sobre TODOS os slots — filtrar a entrada daria um total falso.
     * Quem filtra é o predicado `podavel`, que decide só de quem se pode tirar.
     *
     * 🔒 E é DITA: a mesma frase do caminho automático, nunca uma mudança calada.
     */
    {
      const dosadoPeloApp = (s: SlotPonderavel) => !(s as SlotExercicio).seriesDefinidasPeloUsuario;
      const podaCustom = podarExcessoPonderado(
        rotinaCustomEstrutural.dias.flatMap((d) => d.slots),
        tetoSemanalGrupo,
        sMinDaSemana,
        dosadoPeloApp,
      );
      const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
      if (podaCustom.podados.length > 0) {
        const quantas = podaCustom.podados.reduce((n, x) => n + x.series, 0);
        const nomeados = podaCustom.podados.map((x) => `${ROTULO_GRUPO[x.grupo]} (${tetoSemanalGrupo(x.grupo)})`).join(', ');
        avisos.push(`Ajustamos o volume de ${nomeados} ${MARCA_PODA_TETO}, somando diretas e indiretas: ${quantas} ${plural(quantas, 'série saiu', 'séries saíram')} de ${plural(quantas, 'exercício', 'exercícios')} que o app dosou. As séries que você escolheu ficaram como estão.`);
      }
      /**
       * 🔵 O TETO POR SESSÃO no desenho da pessoa — mesma trava, mesmo recorte.
       *
       * 🔒 Alcança SÓ o que o app dosou (`dosadoPeloApp`). A série que a pessoa digitou fica
       * onde ela pôs: o app corrige o número do app. Se for o dela que estoura, o grupo cai
       * em `irredutíveis` e quem diz é o crítico — nunca um corte calado.
       */
      const podaCustomSessao = tetoDaSessao == null
        ? { podados: [] as { grupo: GrupoPrimario; series: number; dia: number }[] }
        : podarExcessoPonderadoNaSessao(
          rotinaCustomEstrutural.dias.map((d) => d.slots),
          tetoDaSessao,
          sMinDaSemana,
          dosadoPeloApp,
        );
      if (podaCustomSessao.podados.length > 0) {
        const quantas = podaCustomSessao.podados.reduce((n, x) => n + x.series, 0);
        const nomeados = [...new Set(podaCustomSessao.podados.map((x) => ROTULO_GRUPO[x.grupo]))].join(', ');
        avisos.push(`Ajustamos o volume de ${nomeados} ${MARCA_PODA_SESSAO} (${tetoDaSessao} séries por grupo num mesmo dia, somando diretas e indiretas): ${quantas} ${plural(quantas, 'série saiu', 'séries saíram')} de ${plural(quantas, 'exercício', 'exercícios')} que o app dosou. As séries que você escolheu ficaram como estão.`);
      }
      /**
       * 🔵 A EXCEÇÃO AO TETO POR SESSÃO NO DESENHO DA PESSOA (2026-09-17, 2ª volta).
       *
       * 🔒 Aqui NÃO se troca exercício nem se muda de dia: os exercícios e os dias são
       * escolha dela, e mexer neles seria refazer o desenho por baixo dos panos. A única
       * alternativa disponível era reduzir a série que o APP dosou — e ela já rodou acima.
       * O que sobra é declarado com o mesmo formato do caminho automático, para a prévia e o
       * editor lerem de uma fonte só.
       */
      const excecoesCustom = dizerExcecaoDeSessao(rotinaCustomEstrutural.dias, { dosadoPelaPessoa: (s) => !dosadoPeloApp(s) });
      if (excecoesCustom.length > 0) rotinaCustomEstrutural.excecoesDeSessao = excecoesCustom;
      /**
       * 🔒 SEM frase para `irredutiveis` — D16, uma voz por fato.
       *
       * ⚠️ Medido no QA desta correção: com o desenho todo em 6 séries, a tela mostrava
       * TRÊS linhas do crítico (*"Peito está acima do volume máximo do seu nível (24 contra
       * 16 séries)"*, idem costas e ombros) e, logo abaixo, uma quarta frase nossa dizendo o
       * mesmo com menos informação. O crítico já é a autoridade sobre o excesso que FICA, com
       * o número por grupo; a nossa só teria a acrescentar que o app não mexeu no que a
       * pessoa digitou — que é o esperado num desenho manual, não notícia.
       * Quando a poda AGE, aí sim ela fala: é a frase logo acima.
       */
    }
    /**
     * 🔵 2026-09-15 — a cobertura é REMEDIDA aqui, com as séries que a pessoa de fato escolheu.
     * A medição do meio da montagem via a rampa; esta vê o plano entregue. Mesma função, mesma
     * régua, mesmos limiares — só o momento muda.
     */
    if (semanaCiclo && !semanaCiclo.retomada && semanaCiclo.semana !== 6) {
      medirCobertura(rotinaCustomEstrutural.dias);
      /**
       * ⚠️ A rotina guarda uma CÓPIA dos fatos (`[...fatosCobertura]`) do instante em que foi
       * construída; a remedição acima é posterior. Sem refazer a cópia, `avisos` (por
       * referência) ficaria certo e `fatosCobertura` errado — e a deduplicação do D16, que
       * compara `valor`, falharia CALADA: a tela mostraria a mesma medição duas vezes, com
       * números diferentes. Foi o que o QA desta correção mediu aos 30 min.
       */
      rotinaCustomEstrutural.fatosCobertura = fatosCobertura.length > 0 ? [...fatosCobertura] : undefined;
    }
    const rotinaCustomCertificada = certificarDuracao(rotinaCustomEstrutural, perfil.nivelExperiencia, limiteCertificacao);
    const motivos = [...new Set((rotinaCustomCertificada.duracaoDias ?? []).flatMap((d) => d.motivosNaoAvaliados))];
    // Manual é soft: duração vira informação do crítico, nunca remove exercício nem bloqueia.
    return finalizar(
      rotinaCustomCertificada,
      motivos.length > 0
        ? { tipo: 'NAO_AVALIADO_ENTREGAVEL', motivos }
        : { tipo: 'CERTIFICADO', capacidadeTerminal: budgetPorDia },
    );
  }

  // A montagem estrutural precede a avaliação temporal. Um plano que viola cobertura,
  // equipamento ou puxar >= empurrar nunca recebe `duracaoDias` calculada: primeiro ele é
  // rejeitado pelo contrato do alocador; só um plano estruturalmente válido pode ser medido.
  // 🔒 Plano ALOCADO — é o fallback (desenho com dias sem `exercicioIds`), não o desenho da
  // pessoa: `false` explícito para que nenhuma escolha guardada alcance este caminho.
  const rotinaEstrutural = montarSaida(diasTreino, split, false);
  const violacoesBaseline = violacoesDaRealocacao(rotinaEstrutural);

  if (violacoesBaseline.length > 0) {
    if (semanaCiclo?.tentativaTemporalInterna) return rotinaEstrutural;
    return finalizar(rotinaEstrutural, {
      tipo: 'ERRO_ALOCADOR', motivo: 'INVARIANTE_VIOLADO',
      capacidadeTestada: budgetPorDia, violacoesInvariantes: violacoesBaseline,
    });
  }

  const rotina = certificarDuracao(rotinaEstrutural, perfil.nivelExperiencia, limiteCertificacao, automatico);

  // Uma tentativa interna devolve somente o plano resistido refeito; o pai escolhe o terminal e
  // finaliza uma única vez (sem cardio/hash de candidatos intermediários).
  if (semanaCiclo?.tentativaTemporalInterna) return rotina;

  if (!semanaCiclo) {
    const motivos = [...new Set((rotina.duracaoDias ?? []).flatMap((d) => d.motivosNaoAvaliados))];
    // Mesmo a geração v1 passa pela materialização canônica. Sem oferta, minutos de cardio
    // produzem zero blocos — evita um primeiro render legado antes do recompute semanal do Painel.
    return finalizar(rotina, motivos.length > 0
      ? { tipo: 'NAO_AVALIADO_ENTREGAVEL', motivos }
      : { tipo: 'CERTIFICADO', capacidadeTerminal: budgetPorDia });
  }

  if(automatico){
    const resultados=rotina.duracaoDias??[];
    const motivos=[...new Set(resultados.flatMap(d=>d.motivosNaoAvaliados))];
    if(motivos.length)return finalizar(rotina,{tipo:'NAO_AVALIADO_ENTREGAVEL',motivos});
    const excede=perfil.limiteTempoTreino!=='sem_limite'&&resultados.some(d=>(d.duracaoMaximaEstimadaSegundos??Infinity)>orcamentoSeg);
    return finalizar(rotina,excede?{tipo:'INCOMPATIVEL',capacidadeMinimaTestada:capacidadeEntregue(rotina)}:{tipo:'CERTIFICADO',capacidadeTerminal:capacidadeEntregue(rotina)});
  }

  const temporal = executarReduceToFit<RotinaSemanal, NonNullable<RotinaSemanal['duracaoDias']>>({
    capacidadeInicial: budgetPorDia,
    capacidadeMinima: 0,
    // A escada de descanso já é percorrida dentro de `montarSaida`; cada capacidade chama uma
    // montagem fresca, portanto nunca herda descanso degradado da capacidade anterior.
    niveisDescanso: 1,
    alocar: (capacidade) => {
      if (capacidade === budgetPorDia) return { tipo: 'PLANO', plano: rotina };
      const plano = montarRotina(
        prescricao, perfil, exercises, favoritos,
        { ...semanaCiclo, budgetSlotsOverride: capacidade, tentativaTemporalInterna: true },
        preferencias, escolhasExecucao, diasOferecidosCardio,
      );
      // O limite real é comportamental: se uma redução do baseline válido já não consegue manter
      // os invariantes, o alocador declara que não existe plano menor. Não se publica a tentativa
      // inválida nem se finge que `ceil(cobertura/dias)` descreve o alocador concreto.
      if (violacoesBaseline.length === 0 && violacoesDaRealocacao(plano).length > 0) {
        return { tipo: 'SEM_PLANO_MENOR' };
      }
      return { tipo: 'PLANO', plano };
    },
    // Capacidade semanal = maior nº de slots de qualquer dia, nunca soma plana da semana.
    cardinalidade: (plano) => Math.max(0, ...plano.dias.map((d) => d.slots.length)),
    classificar: (plano, _capacidade) => {
      // Precedência normativa: cardinalidade (no orquestrador) → invariantes → duração.
      // Vale também para o baseline: plano inicial inválido nunca recebe selo temporal verde.
      const violacoes = violacoesDaRealocacao(plano);
      if (violacoes.length > 0) return { tipo: 'ERRO_ALOCADOR', motivo: 'INVARIANTE_VIOLADO', violacoesInvariantes: violacoes };
      const excede = precisaReduzir(plano, perfil.nivelExperiencia, orcamentoSeg);
      const resultados = plano.duracaoDias ?? [];
      if (resultados.some((d) => d.estadoCalculo === 'NAO_AVALIADO')) return { tipo: 'NAO_AVALIADO', resultado: resultados };
      if (excede) return { tipo: 'EXCEDE', resultado: resultados };
      return { tipo: 'CERTIFICADO', resultado: resultados };
    },
  });

  if (temporal.tipo === 'ERRO_ALOCADOR') {
    const rg: ResultadoGeracaoRotina = {
      tipo: 'ERRO_ALOCADOR', motivo: temporal.motivo, capacidadeTestada: temporal.capacidadeTestada,
      violacoesInvariantes: temporal.violacoesInvariantes ?? [],
      ...(temporal.cardinalidadeRecebida != null ? { cardinalidadeRecebida: temporal.cardinalidadeRecebida } : {}),
    };
    return finalizar(temporal.planoTerminal ?? rotina, rg, rotina);
  }
  if (temporal.tipo === 'NAO_AVALIADO_ENTREGAVEL') {
    const motivos = [...new Set(temporal.resultado.flatMap((d) => d.motivosNaoAvaliados))];
    return finalizar(temporal.planoTerminal, { tipo: 'NAO_AVALIADO_ENTREGAVEL', motivos }, rotina);
  }
  if (temporal.tipo === 'CERTIFICADO') {
    return finalizar(temporal.planoTerminal, { tipo: 'CERTIFICADO', capacidadeTerminal: temporal.capacidadeTerminal }, rotina);
  }
  const terminal = temporal.planoTerminal ?? rotina;
  return finalizar(terminal, { tipo: 'INCOMPATIVEL', capacidadeMinimaTestada: temporal.capacidadeMinimaTestada }, rotina);
}
