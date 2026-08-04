/**
 * Montador de rotina de treino (Bloco B) — v1 determinístico.
 * Fonte: parametros-motor-treino-evokorpus §"Passo 3".
 *
 * Garantias (travadas na spec):
 *  - dias de força = min(dias_disponíveis, teto do nível); excedente → cardio/recuperação;
 *  - split por dias; cada padrão/grupo ≥ 2×/sem quando há ≥ 2 dias;
 *  - puxar ≥ empurrar (saúde do ombro); dobradiça presente; core 2–3×; cardio por objetivo;
 *  - seleção respeita equipamento/local + dificuldade liberada; nº de exercícios cabe no tempo;
 *  - determinístico (ordena por tier↑ depois id; rotaciona p/ variar).
 */
import { dificuldadesLiberadas } from './treino';
import { exercicioDisponivel } from './equipamento';
import { alvoDaSemana } from './treino-mesociclo';
import { freqMaxPorGrupo, tetoSeriesDaRetomada, volumeDaRetomada } from './treino-retomada';
import { temCarga } from './equipamento';
import { DESCANSO_PISO_DURO_SEG, descansoDoExercicio, descansoDoPadrao } from './descanso';
import { rirAlvoDaSemana } from './treino-mesociclo';
import { preferenciasEfetivas, type PreferenciasTreino } from './preferencias';
import { duracaoDoDiaDeCardio, MODALIDADE_PADRAO_DIA } from './dia-de-cardio';
import { DESCANSO_COMPOSTO_TETO_SEG } from './treino-constants';
import type { DiaCardio, Faixa, FeedbackGrupo, PerfilTreino, PrescricaoFITT, DiaTreino, RotinaSemanal, SemanaCiclo, SlotExercicio } from './treino-types';
import type { EquipamentoDisp, Exercise, GrupoPrimario, LocalExercicio, PadraoMovimento } from '../data/types';

/** Locais acessíveis por disponibilidade de equipamento. */
export function locaisPermitidos(equip: EquipamentoDisp): LocalExercicio[] {
  if (equip === 'nenhum') return ['casa_sem'];
  if (equip === 'casa') return ['casa_sem', 'casa_com'];
  return ['casa_sem', 'casa_com', 'academia'];
}

interface DiaSpec {
  nome: string;
  padroes: PadraoMovimento[];
}

const FB: PadraoMovimento[] = ['empurrar', 'puxar', 'agachar', 'dobradica_quadril', 'core'];
const UPPER: PadraoMovimento[] = ['empurrar', 'puxar', 'isolado', 'core'];
const LOWER: PadraoMovimento[] = ['agachar', 'dobradica_quadril', 'core'];
const PUSH: PadraoMovimento[] = ['empurrar', 'isolado', 'core'];
const PULL: PadraoMovimento[] = ['puxar', 'isolado', 'core'];
const LEGS: PadraoMovimento[] = ['agachar', 'dobradica_quadril', 'core'];

/** Split por dias de força agendados (3 dias depende do nível). */
function montarSplit(diasForca: number, nivel: PerfilTreino['nivelExperiencia']): { split: string; dias: DiaSpec[] } {
  switch (diasForca) {
    case 1:
      return { split: 'Full-body', dias: [{ nome: 'Full-body', padroes: FB }] };
    case 2:
      return { split: 'Full-body ×2', dias: [{ nome: 'Full-body A', padroes: FB }, { nome: 'Full-body B', padroes: FB }] };
    case 3:
      return nivel === 'iniciante'
        ? { split: 'Full-body ×3', dias: [{ nome: 'Full-body A', padroes: FB }, { nome: 'Full-body B', padroes: FB }, { nome: 'Full-body C', padroes: FB }] }
        : { split: 'Upper / Lower / Full', dias: [{ nome: 'Upper', padroes: UPPER }, { nome: 'Lower', padroes: LOWER }, { nome: 'Full-body', padroes: FB }] };
    case 4:
      return { split: 'Upper / Lower ×2', dias: [{ nome: 'Upper A', padroes: UPPER }, { nome: 'Lower A', padroes: LOWER }, { nome: 'Upper B', padroes: UPPER }, { nome: 'Lower B', padroes: LOWER }] };
    case 5:
      return { split: 'PPL + Upper/Lower', dias: [{ nome: 'Push', padroes: PUSH }, { nome: 'Pull', padroes: PULL }, { nome: 'Legs', padroes: LEGS }, { nome: 'Upper', padroes: UPPER }, { nome: 'Lower', padroes: LOWER }] };
    default: // 6
      return { split: 'Push / Pull / Legs ×2', dias: [{ nome: 'Push A', padroes: PUSH }, { nome: 'Pull A', padroes: PULL }, { nome: 'Legs A', padroes: LEGS }, { nome: 'Push B', padroes: PUSH }, { nome: 'Pull B', padroes: PULL }, { nome: 'Legs B', padroes: LEGS }] };
  }
}

/** Tempo estimado por exercício (s) = séries × (execução ~40s + descanso). */
function tempoPorExercicioSeg(p: PrescricaoFITT): number {
  return p.seriesPorExercicio.min * (40 + p.descansoCompostoSeg.min);
}

/** Padrões fundamentais (puxar SEMPRE antes de empurrar → sustenta puxar ≥ empurrar). */
const FUNDAMENTAIS: PadraoMovimento[] = ['puxar', 'empurrar', 'agachar', 'dobradica_quadril'];
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
function montarDiasCardio(quantos: number, meta: PrescricaoFITT['cardio']): DiaCardio[] {
  if (quantos < 1) return [];
  // 🔒 O PISO da faixa é o alvo (`min`), e é o mesmo número que `metaCardioSemanal` usa.
  // 🔒 A MESMA função do conteúdo do dia: divide, arredonda (empate p/ cima) e aplica o
  // teto de 90. Dividir aqui por conta própria faria o teto valer num caminho e não no outro.
  const minutos = meta.tipo === 'minutos_semana' ? duracaoDoDiaDeCardio(meta.min, quantos) : null;
  return Array.from({ length: quantos }, (_, i) => ({
    nome: quantos > 1 ? `Cardio ${i + 1}` : 'Cardio',
    padrao: 'cardio' as const,
    modalidade: MODALIDADE_PADRAO_DIA,
    minutos: minutos != null && minutos > 0 ? minutos : null,
  }));
}

/**
 * Monta a rotina semanal. Função PURA e determinística.
 */
export function montarRotina(
  prescricao: PrescricaoFITT,
  perfil: PerfilTreino,
  exercises: readonly Exercise[],
  /**
   * Exercícios FAVORITOS do usuário (DF #12, 2026-07-04): preferidos no slot cujo padrão
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
): RotinaSemanal {
  const avisos: string[] = [];
  // B5 suspensa na retomada: os exercícios já executados entram no MESMO trilho de isenção
  // dos favoritos (mecanismo existente), para o montador preferi-los em vez de rotacionar.
  const recentes = semanaCiclo?.retomada?.exerciciosRecentes;
  // 🎛️ v3 · Bloco A: revalidadas AQUI, na montagem — equipamento e nível mudam no perfil, e
  // preferência que deixou de caber é ignorada na geração (o plano sai correto) sem ser
  // apagada do perfil: se a pessoa recuperar o equipamento, ela volta a valer sozinha.
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
    return { diasForcaAgendados: 0, diasCardioRecuperacao, split: '—', dias: [], diasCardio: montarDiasCardio(diasCardioRecuperacao, prescricao.cardio), cardio: prescricao.cardio, avisos: ['Sem dias disponíveis para treino de força.'] };
  }

  // Pool elegível: equipamento (modelo 2 níveis — checklist de casa) + dificuldade
  // liberada. Ordenado (tier↑, depois id).
  const liberadas = new Set(dificuldadesLiberadas(perfil.nivelExperiencia));
  const pool = exercises
    .filter((e) => !excluidos.has(e.id) && exercicioDisponivel(e, perfil.equipamento, perfil.equipamentosCasa) && liberadas.has(e.nivel))
    .slice()
    .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Índice de rotação por padrão (varia exercícios entre os dias). Favoritos ficam num
  // trilho próprio, ISENTOS da rotação (DF #12): preenchem primeiro, todo dia que couber,
  // em ordem estável (o pool já vem em tier↑, id) — determinístico, sem estado escondido.
  const porPadrao = new Map<PadraoMovimento, Exercise[]>();       // não-favoritos (rotacionam)
  const favsPorPadrao = new Map<PadraoMovimento, Exercise[]>();   // favoritos (fixos)
  for (const e of pool) {
    const alvo = favoritosEfetivos.has(e.id) ? favsPorPadrao : porPadrao;
    const arr = alvo.get(e.padraoMovimento) ?? [];
    arr.push(e);
    alvo.set(e.padraoMovimento, arr);
  }
  const cursor = new Map<PadraoMovimento, number>();
  function escolher(padrao: PadraoMovimento, usadosDia: Set<string>): Exercise | null {
    // 1) favoritos do padrão, todo dia, sem repetir no MESMO dia (dois slots iguais no dia
    //    ainda variam); a variedade entre sessões não se aplica a eles.
    for (const f of favsPorPadrao.get(padrao) ?? []) {
      if (!usadosDia.has(f.id)) { usadosDia.add(f.id); return f; }
    }
    // 2) rotação normal sobre os não-favoritos (comportamento original).
    const arr = porPadrao.get(padrao);
    if (!arr || arr.length === 0) return null;
    const i = cursor.get(padrao) ?? 0;
    cursor.set(padrao, i + 1);
    return arr[i % arr.length]!;
  }

  const { split, dias: spec } = montarSplit(diasForca, perfil.nivelExperiencia);

  // --- Orçamento de tempo + descanso efetivo do composto -------------------
  // v1: custo = séries mín × (execução ~40 s + descanso mín).
  // v2 (semana passada): custo ESTÁVEL no ciclo inteiro, dimensionado p/ o pior caso da
  // rampa (evita a rotina encolher no meio do ciclo), e o teto do descanso do composto
  // sobe p/ ~180 s QUANDO o tempo permite (v2 §5) — i.e., só se não reduzir o nº de
  // exercícios que o descanso base comportaria (tempo é o limitante; cobertura > descanso).
  let descansoEfetivo: Faixa = prescricao.descansoCompostoSeg;
  /**
   * 🔒 ORÇAMENTO DE TEMPO — SOMA ITEM A ITEM (cofre §🕐 Bloco 3, DF 2026-07-31).
   *
   * O que saiu: `cap(rest) = tempo / (sPlan × (40 + média_da_faixa))` — **um** descanso
   * multiplicado pelo total de séries. Com descansos diferentes por exercício essa conta
   * erra nas DUAS direções: subestima a sessão cheia de composto e superestima a de
   * acessório. O erro é invisível — a sessão só "não fecha" na vida real.
   *
   * O que entrou: cada padrão do dia custa `sPlan × (40 + descanso da CLASSE dele)`, e o dia
   * recebe padrões enquanto a soma couber. Um dia de composto passa a comportar menos
   * exercícios que um de acessório, que é o ponto.
   *
   * ⚠️ Aqui a estimativa usa a classe do PADRÃO, não do exercício — na hora do orçamento os
   * exercícios ainda não foram escolhidos. O valor definitivo por slot é calculado depois da
   * escolha (`descansoDoExercicio`), que é quem enxerga pliométrico e força pesada.
   */
  const capDiaPorTempo: number[] = [];
  /**
   * Nível de degradação REALMENTE usado em cada dia (0/1/2). Distinto de "coube ou não":
   * um dia que fechou cedendo só o ISOLADO fica no nível 1, e os compostos dele mantêm a
   * faixa cheia. Passar 2 direto rebaixaria composto sem necessidade — cobertura > descanso,
   * mas só o mínimo necessário de descanso é cedido.
   */
  const nivelDegradacaoDia: (0 | 1 | 2)[] = [];
  if (semanaCiclo) {
    const banda = prescricao.volumePorGrupoSemana;
    const sPlan = Math.min(
      prescricao.seriesPorExercicio.min + Math.ceil((banda.max - banda.min) / Math.max(1, prescricao.freqPorGrupoMin)),
      prescricao.seriesPorExercicio.max,
    );
    /**
     * 🔴 O RIR-ALVO DA SEMANA DO MESOCICLO (conserto 2026-08-04, item 2 do lote).
     *
     * O defeito medido: o fallback era `prescricao.rir.min` — uma CONSTANTE. `rirAlvoSemana`
     * só é preenchido pela retomada (`aplicarRetomada`), então fora da rampa o deslocamento
     * por RIR recebia sempre o mesmo número e o descanso NUNCA se movia dentro da faixa.
     * Resultado em produção: **2 valores** (composto 180 · isolado 120, os TOPOS das duas
     * faixas) idênticos da semana 1 à 5 — exatamente o *"o tempo de descanso sempre ser o
     * mesmo"* que a spec §🕐 existe para consertar.
     *
     * `rirAlvoDaSemana` já existia, exportada e testada — e **nenhuma linha de produção a
     * chamava**. A leva B construiu a função e não a ligou. 🔑 A precedência fica: a rampa
     * (`rirAlvoSemana`) vence, como antes; sem ela, manda a semana do ciclo.
     */
    const rirAlvo = prescricao.rirAlvoSemana ?? rirAlvoDaSemana(prescricao.rir, semanaCiclo.semana);
    const semanaRampa = semanaCiclo.retomada?.semana ?? null;
    const orcamentoSeg = perfil.tempoPorSessaoMin * 60;

    /** Custo de UM slot deste padrão, com o descanso da classe já degradado ao nível dado. */
    const custoSlot = (padrao: PadraoMovimento, nivelDegradacao: 0 | 1 | 2): number =>
      sPlan * (40 + descansoDoPadrao(padrao, {
        rirAlvo,
        modoForca: prescricao.modoForca === true,
        semanaRampa,
        degradacao: nivelDegradacao,
      }));

    /** Quantos padrões deste dia cabem no orçamento, no nível de degradação dado. */
    const cabem = (padroes: readonly PadraoMovimento[], nivel: 0 | 1 | 2): number => {
      let soma = 0;
      let n = 0;
      for (const p of padroes) {
        const c = custoSlot(p, nivel);
        if (soma + c > orcamentoSeg) break;
        soma += c;
        n += 1;
      }
      return Math.max(1, n); // ao menos 1 exercício — sessão vazia não é resposta
    };

    /**
     * 🔒 Ordem de degradação (regra 3): cede ISOLADO até 60 s, depois COMPOSTO até 90 s, e
     * só então o nº de exercícios. Nunca se corta exercício para dar descanso mais longo aos
     * outros — cobertura > descanso.
     *
     * 🟡 EXCEÇÃO NOMEADA, durante a rampa: o piso do FIT é INVIOLÁVEL, então não há
     * degradação e quem cede é o nº de exercícios. Inversão consciente: na rampa o volume já
     * está cortado 50–70% (sobra tempo) e a rampa É feature de segurança — o risco
     * documentado é rabdomiólise, não desconforto.
     */
    for (const d of spec) {
      const alvo = d.padroes.length;
      let n = cabem(d.padroes, 0);
      let nivel: 0 | 1 | 2 = 0;
      if (n < alvo && semanaRampa == null) {
        const n1 = cabem(d.padroes, 1);       // cede ISOLADO → 60 s
        if (n1 > n) { n = n1; nivel = 1; }
        if (n < alvo) {
          const n2 = cabem(d.padroes, 2);     // só então cede COMPOSTO → 90 s
          if (n2 > n) { n = n2; nivel = 2; }
        }
      }
      capDiaPorTempo.push(n);
      nivelDegradacaoDia.push(nivel);
    }

    /**
     * O `descansoEfetivo` da SEMANA virou LEGADO — quem manda agora é o `descansoSeg` de
     * cada slot. Ele fica exposto para a chamada v1 (sem `semanaCiclo`) e para a UI antiga.
     *
     * ⚠️ A sensibilidade ao tempo é preservada de propósito: o teto de 180 s só sobe quando
     * TODOS os dias couberam com a faixa cheia. Sem esta condição, uma sessão de 30 min
     * anunciaria 180 s enquanto o orçamento reservou menos — "tempo é o limitante" é regra
     * do v2 §5, e ela não morre só porque o cálculo mudou de forma.
     */
    const elegivel180 = prescricao.descansoCompostoSeg.max >= 120 || prescricao.modoForca === true;
    const coubeCheio = nivelDegradacaoDia.every((n) => n === 0);
    if (elegivel180 && coubeCheio) descansoEfetivo = { min: prescricao.descansoCompostoSeg.min, max: DESCANSO_COMPOSTO_TETO_SEG };
  }
  const maxExercicios = semanaCiclo
    ? Math.max(...capDiaPorTempo, 1)
    : Math.max(1, Math.floor((perfil.tempoPorSessaoMin * 60) / tempoPorExercicioSeg(prescricao)));

  // --- Alocador semanal de padrões -----------------------------------------
  // Distribui os padrões pelos dias (respeitando o template e a capacidade por tempo),
  // garantindo por construção: dobradiça presente, puxar ≥ empurrar, e core ∈ [2,3].
  const temPool = (p: PadraoMovimento) => (porPadrao.get(p)?.length ?? 0) + (favsPorPadrao.get(p)?.length ?? 0) > 0;
  // 🔒 Cap POR DIA: com a soma por item cada dia tem seu próprio limite, porque a
  // composição (quantos compostos × quantos acessórios) muda o custo. Antes era um escalar
  // igual para todos — a origem exata do erro "subestima composto, superestima acessório".
  const capDia = spec.map((d, i) => Math.min(d.padroes.length, capDiaPorTempo[i] ?? maxExercicios));
  const capTotal = capDia.reduce((a, b) => a + b, 0);
  const escolhidos: PadraoMovimento[][] = spec.map(() => []);
  let alocados = 0;
  const conta = (p: PadraoMovimento) => escolhidos.reduce((n, arr) => n + arr.filter((x) => x === p).length, 0);

  /** Coloca 1 slot do padrão no melhor dia. Guarda: empurrar nunca ultrapassa puxar. */
  function place(pat: PadraoMovimento): boolean {
    if (alocados >= capTotal || !temPool(pat)) return false;
    if (pat === 'empurrar' && conta('empurrar') >= conta('puxar')) return false; // puxar ≥ empurrar
    const cands = spec
      .map((d, i) => ({ i, d }))
      .filter(({ i, d }) => d.padroes.includes(pat) && escolhidos[i]!.length < capDia[i]!);
    if (cands.length === 0) return false;
    cands.sort((a, b) => {
      const aTem = escolhidos[a.i]!.includes(pat) ? 1 : 0;
      const bTem = escolhidos[b.i]!.includes(pat) ? 1 : 0;
      if (aTem !== bTem) return aTem - bTem; // prefere dia sem esse padrão (espalha)
      if (escolhidos[a.i]!.length !== escolhidos[b.i]!.length) return escolhidos[a.i]!.length - escolhidos[b.i]!.length;
      return a.i - b.i;
    });
    escolhidos[cands[0]!.i]!.push(pat);
    alocados++;
    return true;
  }

  // 1) Presença dos fundamentais (puxar antes de empurrar).
  for (const pat of FUNDAMENTAIS) place(pat);
  // 2) Core até o piso de 2× (invariante).
  while (conta('core') < CORE_MIN && place('core')) {
    /* repete */
  }
  // 3) Frequência: fundamentais + isolado; core só até o teto de 3×. Até encher.
  let progrediu = true;
  while (alocados < capTotal && progrediu) {
    progrediu = false;
    for (const pat of FUNDAMENTAIS) progrediu = place(pat) || progrediu;
    progrediu = place('isolado') || progrediu;
    if (conta('core') < CORE_MAX) progrediu = place('core') || progrediu;
  }

  const diasTreino: DiaTreino[] = spec.map((d, i) => {
    const slots: SlotExercicio[] = [];
    const usadosDia = new Set<string>(); // favoritos não repetem no MESMO dia
    for (const padrao of escolhidos[i]!) {
      const ex = escolher(padrao, usadosDia);
      // Badge (B5, DF 2026-07-04): acende p/ TODO favorito que entrou no plano.
      if (ex) slots.push({ padrao, exercicio: ex, ...(favoritos.has(ex.id) ? { incluidoPorPreferencia: true } : {}) });
    }
    return { nome: d.nome, slots };
  });

  /**
   * 🔒 DESCANSO DEFINITIVO, POR SLOT (cofre §🕐). Agora que os exercícios estão escolhidos,
   * o valor vem de `descansoDoExercicio` — que enxerga o que o padrão não mostra:
   * `tipo: 'pliometrico'` (o e151 é `padraoMovimento: cardio` e mesmo assim tem descanso) e
   * o override de força pesada (só composto COM carga).
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
        /**
         * 🔻 O teto por PADRÃO saiu daqui (correções 1.3/1.4, 2026-07-31).
         *
         * Ele era o valor efetivamente exibido — o `min` fazia dele o limitante em todos os
         * casos — e o padrão **não enxerga classe**: `POTENCIA` (o `e151` é
         * `padrao: 'cardio'`) e força pesada eram cortados no piso do composto. Era por isso
         * que a força pesada ia a 90 s.
         *
         * Agora quem degrada é `descansoDoExercicio`, que conhece a classe. O orçamento
         * segue usando `descansoDoPadrao` para PLANEJAR (é o que existe antes da escolha), e
         * os dois compartilham o mesmo `degradar` — a divergência que resta é justamente a
         * que as correções mandam preservar: onde a classe real pede mais, ela recebe mais.
         */
        return { ...s, descansoSeg: Math.max(exato, DESCANSO_PISO_DURO_SEG) };
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
    const sMin = prescricao.seriesPorExercicio.min;
    const sMax = prescricao.seriesPorExercicio.max;
    const banda = prescricao.volumePorGrupoSemana;
    const porGrupo = new Map<GrupoPrimario, SlotExercicio[]>();
    for (const d of diasTreino) {
      for (const s of d.slots) {
        // 🔒 `grupoPrimario` é NULLABLE (DF 2026-07-27): cardio/corpo-inteiro não são grupo
        // muscular e não têm volume-alvo por grupo — ficam fora da rampa, por definição.
        const g = s.exercicio.grupoPrimario;
        if (g == null) continue;
        const arr = porGrupo.get(g) ?? [];
        arr.push(s);
        porGrupo.set(g, arr);
      }
    }

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
      const alvo = alvoDaSemana(banda, semana, feedbackGrupos?.get(grupo) ?? 'ok');
      const n = slots.length;
      const base = n * sMin;
      const teto = n * sMax;
      const series = slots.map(() => sMin);
      if (alvo > base) {
        // Aviso honesto SÓ p/ grupo que poderia cumprir o piso da banda mas não o alvo;
        // grupos estruturalmente sub-banda (teto < piso) ficam silenciosos, como na v1.
        if (alvo > teto && teto >= banda.min) {
          avisos.push(`Semana ${semana}: alvo de ${alvo} séries para ${grupo} não cabe em ${n} exercício(s) — planejadas ${teto}.`);
        }
        let extra = Math.min(alvo, teto) - base;
        let i = 0;
        while (extra > 0) {
          if (series[i]! < sMax) {
            series[i]!++;
            extra--;
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
  if (maxExercicios < 3) {
    avisos.push('Tempo por sessão curto: priorizamos os exercícios fundamentais.');
  }

  return {
    diasForcaAgendados: diasForca,
    diasCardioRecuperacao,
    diasCardio: montarDiasCardio(diasCardioRecuperacao, prescricao.cardio),
    split,
    dias: diasTreino,
    cardio: prescricao.cardio,
    avisos,
    // Metadados do mesociclo (v2) — spread condicional preserva a saída v1 byte a byte.
    ...(semanaCiclo
      ? { semana: { numero: semanaCiclo.semana, deload: semanaCiclo.semana === 6, descansoCompostoSeg: descansoEfetivo } }
      : {}),
  };
}
