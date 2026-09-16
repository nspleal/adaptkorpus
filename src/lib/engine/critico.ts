/**
 * 🧭 O CRÍTICO DO EDITOR — placar, recomendações e avisos (handoff-editor-guiado-2026-08-13).
 *
 * 🔑 A leitura que barateia tudo, verbatim do handoff: **o crítico do editor É a conta do
 * alocador v4**. Este módulo NÃO tem conta própria de volume — ele chama
 * `creditoPonderadoDaSemana` (o mesmo 1,0/0,5 da DF① de 2026-08-12) e as bandas de
 * `trilhos` (`mev`/`mrv`). Uma segunda implementação seria uma segunda verdade para o mesmo
 * número — a classe que o cofre já nomeou no piso de proteína.
 *
 * 🔒 DF① (2026-08-13): **avisos NÃO travam**. Aqui não existe `bloqueia`: o retorno é
 * texto + severidade, e quem consome exibe. Os únicos bloqueios do produto continuam o
 * gate de saúde e o piso legal de reps com carga — nenhum dos dois mora neste arquivo.
 *
 * 🔒 A §1.2 dizia que o número "deixa de ser alvo do gerador e vira **teto do editor**".
 * É aqui que isso acontece — inclusive `INTERVALO_MIN_HORAS_MESMO_GRUPO`, que existia com
 * ZERO call sites desde o v3 e ganha o seu no aviso de dias consecutivos.
 *
 * PURO e determinístico: sem relógio, sem rede, sem estado.
 */
import type { Exercise, GrupoPrimario } from '../data/types';
import type { Faixa, FaseVolume, NivelExperiencia, RotinaSemanal } from './treino-types';
import type { Objetivo } from './types';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './alocador';
import { INTERVALO_MIN_HORAS_MESMO_GRUPO, mev, mrv } from './trilhos';
import { avaliarDuracaoFinalDoDia } from './duracao-plano';
import { FORMULA_DURACAO_VERSION, type ResultadoDuracao } from './duracao-sessao';
import { validarDistribuicaoCardioSemana } from './distribuicao-cardio-semana';
import { duracaoDoDiaDeCardio } from './dia-de-cardio';
import { fatosDistribuicaoCardioDaRotina } from './treino-cardio-semana';
import { ROTULO_GRUPO } from '../frequencia-grupos';
import { ORDEM_SEMANA, diasPadrao, type Weekday } from '../semana';

/** Um dia do desenho, como o editor o entrega: o rótulo e os exercícios escolhidos. */
export interface DiaDoEditor {
  nome: string;
  exercicios: readonly Exercise[];
  /**
   * Séries planejadas por exercício (do MOTOR — o usuário não edita). 🔒 C1: os elementos
   * podem ser `undefined` (o motor não anotou — ex.: deload, corpo-inteiro). O PLACAR usa o
   * piso `ctx.seriesPadrao`; o critério de TEMPO abstém-se (NAO_AVALIADO) — nunca inventa.
   */
  series?: readonly (number | undefined)[];
  /** Descanso por exercício, em segundos (do motor). 🔒 C1: elemento `undefined` ⇒ tempo NAO_AVALIADO. */
  descansoSeg?: readonly (number | undefined)[];
  /** 🔒 C1: HOLD (s) por exercício isométrico, transportado do motor. Ausente num isométrico ⇒ NAO_AVALIADO. */
  holdSeg?: readonly (number | undefined)[];
  /** Bloco contínuo FINAL do dia automático; ausente/0 no plano editado ou sem cardio. */
  cardioSegundos?: number;
}

export type StatusGrupo = 'na_banda' | 'abaixo_mev' | 'acima_mrv' | 'sem_estimulo';

export interface LinhaPlacar {
  grupo: GrupoPrimario;
  rotulo: string;
  /** Séries PONDERADAS da semana (direto 1,0 + secundário 0,5) — a conta do alocador v4. */
  ponderado: number;
  status: StatusGrupo;
  /** A banda do nível/objetivo, para a tela mostrar o alvo sem recalcular. */
  mev: number;
  mrv: number;
}

export type SeveridadeAviso = 'recomendacao' | 'risco';

export interface ItemCritico {
  /** Vocabulário FECHADO — cada motivo é copy de tela e chave de telemetria. */
  codigo:
    | 'trocar_um_por_outro'
    | 'grupo_abaixo_do_minimo'
    | 'dias_consecutivos'
    | 'acima_do_maximo'
    | 'sessao_longa'
    | 'puxar_menor_que_empurrar';
  severidade: SeveridadeAviso;
  /** Frase pronta para a tela — linguagem de sugestão/educação, nunca de resultado. */
  texto: string;
  /**
   * 🔴 D16 (auditoria 2026-09-11) — O FATO, não só a frase. O mesmo fato ("grupo X abaixo do
   * mínimo desta semana") era dito por dois sistemas, com números diferentes em cada um.
   * Para decidir se duas falas são a MESMA, é preciso comparar grupo, semana, escopo, métrica
   * e limiar — comparar texto acharia igualdade onde não há e diferença onde não importa.
   * Ausente nos itens que não descrevem volume por grupo.
   */
  fato?: {
    semana?: number;
    valor?: number;
    grupo: GrupoPrimario;
    escopo: 'semana';
    metrica: 'series_ponderadas';
    limiar: 'mev' | 'mrv';
    alvo: number;
  };
}

export interface Avaliacao {
  placar: LinhaPlacar[];
  /** 🟡 Sugestões derivadas do déficit — nunca prescrição. */
  recomendacoes: ItemCritico[];
  /** 🔴 Riscos, com o porquê. **Não travam** (DF①). */
  avisos: ItemCritico[];
  /** Prova independente de que o crítico recompôs o mesmo plano automático final. */
  convergenciaPlanoFinal?: {
    estado: 'CONVERGIU' | 'DIVERGIU';
    /** Omissões, duplicações e identidades inválidas não podem virar verde por lista vazia. */
    motivosEstruturais: string[];
    dias: Array<{
      diaId: string;
      converge: boolean;
      gerador: ResultadoDuracao;
      critico: ResultadoDuracao;
    }>;
  };
}

export interface ContextoCritico {
  semana?: number;
  nivel: NivelExperiencia;
  objetivo: Objetivo;
  /** Minutos por sessão do perfil — o aviso de sessão longa compara com isto. */
  tempoPorSessaoMin: number;
  limiteTempoTreino?: 'limitado' | 'sem_limite';
  /**
   * Dias da semana em que cada dia do desenho cai, na MESMA ordem de `dias` (índice
   * Seg=0…Dom=6). Ausente = o aviso de dias consecutivos não é emitido (sem agenda não há
   * como afirmar intervalo — e afirmar sem base é o que este arquivo existe para evitar).
   */
  diasDaSemanaIdx?: readonly number[];
  /** Séries usadas no PLACAR quando o motor ainda não anotou (piso do nível). */
  seriesPadrao?: number;
  /**
   * 🔴 A FAIXA REALMENTE APLICÁVEL a esta semana (correção 2026-09-15), publicada pelo motor
   * em `RotinaSemanal.faixaVolumeSemana`. Ausente ⇒ a faixa terminal do nível/objetivo, que é
   * o comportamento de sempre nas semanas de rampa (onde as duas coincidem).
   *
   * ⚠️ Não é um número novo: no deload é a banda de `aplicarDeload` que a própria rampa usa;
   * na retomada é o alvo de `volumeDaRetomada`, com o teto da banda intacto. Recalcular aqui
   * seria a segunda verdade que este arquivo existe para não criar.
   */
  faixaSemanal?: Faixa;
  /**
   * 🔒 A FASE. Em `deload` e `retomada` o volume baixo é a FEATURE e o guard de cobertura do
   * montador (`treino-montador.ts`, `semana !== 6 && !retomada`) já não fala — o crítico passa
   * a respeitar o mesmo contrato, em vez de acusar 6 déficits na semana de alívio.
   *
   * 🔴 O que NÃO muda com a fase: `acima_do_maximo`, sessão longa, dias consecutivos e
   * puxar/empurrar seguem sendo avaliados. Suprimir o mínimo não é desligar o crítico.
   */
  faseVolume?: FaseVolume;
}

/**
 * Entradas do crítico automático que não podem nascer do plano avaliado. O horizonte vem do perfil
 * que disparou a geração; assim, um agregado final truncado não consegue certificar a si próprio ao
 * truncar também fatos, contadores e distribuição.
 */
export interface ContextoCriticoAutomatico extends ContextoCritico {
  diasNoHorizonteEsperado: number;
  /** Oferta transitória que disparou a geração; nunca pode ser aprendida do agregado avaliado. */
  diasOferecidosCardioEsperados: readonly (Weekday | number)[];
  /** Agenda real fornecida pelo perfil; ausente só para leitura de agregados legados. */
  diasTreinoEsperados?: readonly Weekday[];
}

const rotulo = (g: GrupoPrimario) => ROTULO_GRUPO[g] ?? g;

/** Horas entre dois dias da semana consecutivos no ciclo (wrap incluído). */
function horasEntre(a: number, b: number): number {
  const d = (b - a + 7) % 7;
  return d * 24;
}

/**
 * O PLACAR da semana: séries ponderadas por grupo × banda do nível.
 * Só os GRANDES entram no placar por default — são os que a DF② põe "na banda"; os
 * pequenos têm piso de presença, não faixa, e apareceriam sempre "abaixo" sem significar
 * nada (a lição da régua de frequência: número sem significado vira ruído).
 */
export function placarDaSemana(dias: readonly DiaDoEditor[], ctx: ContextoCritico): LinhaPlacar[] {
  const slots = dias.flatMap((d) => d.exercicios.map((e, i) => ({
    exercicio: e,
    series: d.series?.[i] ?? ctx.seriesPadrao ?? 1,
  })));
  const ponderado = creditoPonderadoDaSemana(slots);
  // A faixa da SEMANA quando o motor a publicou; a do nível quando não há fase a considerar.
  // Nas semanas normais as duas são a mesma — por isso a rampa não muda de comportamento.
  const piso = ctx.faixaSemanal?.min ?? mev(ctx.nivel, ctx.objetivo);
  const teto = ctx.faixaSemanal?.max ?? mrv(ctx.nivel, ctx.objetivo);
  return GRUPOS_GRANDES.map((g) => {
    const v = Math.round((ponderado.get(g) ?? 0) * 10) / 10;
    const status: StatusGrupo = v <= 0 ? 'sem_estimulo' : v < piso ? 'abaixo_mev' : v > teto ? 'acima_mrv' : 'na_banda';
    return { grupo: g, rotulo: rotulo(g), ponderado: v, status, mev: piso, mrv: teto };
  });
}

/**
 * 🟡 As RECOMENDAÇÕES. A principal é o exemplo literal do autor — *"tente adicionar um de
 * peito a mais e diminuir um de ombro"* —, derivada do déficit: existe grupo acima do alvo
 * E grupo abaixo ⇒ sugere mover UM exercício. Linguagem de sugestão ("tente"), nunca de
 * prescrição nem de resultado.
 */
export function recomendacoes(placar: readonly LinhaPlacar[], semana?: number, fase: FaseVolume = 'normal'): ItemCritico[] {
  const itens: ItemCritico[] = [];
  const acima = [...placar].filter((l) => l.status === 'acima_mrv').sort((a, b) => b.ponderado - a.ponderado);
  /**
   * 🔒 Em `deload` e `retomada` o volume reduzido é a PRESCRIÇÃO, não um déficit — é o mesmo
   * contrato que faz o montador pular o guard de cobertura nessas fases. Sem isto, a semana de
   * alívio abria com 6 acusações e contradizia a própria copy do editor ("nas fases de
   * recuperação, o volume pode ser reduzido"). A sugestão de TROCA cai junto: ela nasce do
   * déficit, e sugerir remanejar exercício durante a recuperação é o conselho oposto ao da fase.
   */
  const abaixo = fase === 'normal'
    ? [...placar].filter((l) => l.status === 'abaixo_mev' || l.status === 'sem_estimulo')
      .sort((a, b) => a.ponderado - b.ponderado)
    : [];

  if (acima.length > 0 && abaixo.length > 0) {
    itens.push({
      codigo: 'trocar_um_por_outro',
      severidade: 'recomendacao',
      texto: `Tente trocar 1 exercício de ${acima[0]!.rotulo.toLowerCase()} por 1 de ${abaixo[0]!.rotulo.toLowerCase()} — assim a semana fica mais equilibrada entre os grupos.`,
    });
  }
  for (const l of abaixo) {
    // Já coberto pela sugestão de troca? A frase específica ainda ajuda: ela nomeia a faixa.
    itens.push({
      codigo: 'grupo_abaixo_do_minimo',
      severidade: 'recomendacao',
      texto: `${l.rotulo} está abaixo da faixa mínima desta semana (${l.ponderado} de ${l.mev} séries).`,
      fato: { grupo: l.grupo, semana, valor: l.ponderado, escopo: 'semana', metrica: 'series_ponderadas', limiar: 'mev', alvo: l.mev },
    });
  }
  return itens;
}

/**
 * 🔴 Os AVISOS — risco explicado, e **nada aqui trava** (DF①).
 *
 * A copy diz o PORQUÊ e para no mecanismo: "pode prejudicar a recuperação" é o limite do
 * que se pode afirmar sem procedência. Nada de resultado prometido nem de comportamento
 * atribuído à pessoa.
 */
export function avisos(
  dias: readonly DiaDoEditor[],
  placar: readonly LinhaPlacar[],
  ctx: ContextoCritico,
): ItemCritico[] {
  const itens: ItemCritico[] = [];

  // ① Mesmo grupo em dias próximos demais — o call site que faltava desde o v3.
  if (ctx.diasDaSemanaIdx && ctx.diasDaSemanaIdx.length === dias.length) {
    const porGrupo = new Map<GrupoPrimario, number[]>();
    dias.forEach((d, i) => {
      const idx = ctx.diasDaSemanaIdx![i]!;
      for (const g of new Set(d.exercicios.map((e) => e.grupoPrimario).filter((g): g is GrupoPrimario => g != null))) {
        porGrupo.set(g, [...(porGrupo.get(g) ?? []), idx]);
      }
    });
    for (const [g, idxs] of [...porGrupo].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const ordenados = [...idxs].sort((a, b) => a - b);
      const colado = ordenados.some((x, i) => {
        const prox = ordenados[(i + 1) % ordenados.length]!;
        return ordenados.length > 1 && horasEntre(x, prox) < INTERVALO_MIN_HORAS_MESMO_GRUPO;
      });
      if (colado) {
        itens.push({
          codigo: 'dias_consecutivos',
          severidade: 'risco',
          texto: `${rotulo(g)} aparece em dias seguidos. O intervalo recomendado entre sessões do mesmo grupo é de ${INTERVALO_MIN_HORAS_MESMO_GRUPO} horas — treinar antes disso pode prejudicar a recuperação.`,
        });
      }
    }
  }

  // ② Grupo acima do MRV do nível (conta ponderada — a mesma do placar).
  for (const l of placar.filter((x) => x.status === 'acima_mrv')) {
    itens.push({
      codigo: 'acima_do_maximo',
      severidade: 'risco',
      texto: `${l.rotulo} está acima do volume máximo do seu nível (${l.ponderado} contra ${l.mrv} séries). Volume acima do que você recupera tende a atrapalhar, não somar.`,
    });
  }

  // ③ Sessão estourando o tempo — pela FÓRMULA CANÔNICA C1 (`avaliarDuracaoResistida`), a
  //    MESMA do gerador, sobre o plano final (séries e descanso REAIS por slot). 🔒 Sem
  //    fallback silencioso 1 série / 90 s: faltou dado ⇒ NAO_AVALIADO e o crítico NÃO afirma
  //    que cabe. O editor é SOFT — isto informa, nunca trava (DF①).
  const orcamentoSeg = ctx.limiteTempoTreino==='sem_limite'?undefined:ctx.tempoPorSessaoMin * 60;
  dias.forEach((d, i) => {
    const slots = d.exercicios.map((ex, k) => ({ exercicio: ex, series: d.series?.[k], descansoSeg: d.descansoSeg?.[k], holdSeg: d.holdSeg?.[k] }));
    const r = avaliarDuracaoFinalDoDia(slots, ctx.nivel, orcamentoSeg, d.cardioSegundos ?? 0);
    if (orcamentoSeg!==undefined && r.estadoCalculo === 'CALCULADO' && r.estadoLimite !== 'DENTRO_DO_LIMITE') {
      const min = Math.round(r.duracaoMaximaEstimadaSegundos! / 60);
      itens.push({
        codigo: 'sessao_longa',
        severidade: 'risco',
        texto: `${d.nome || `Dia ${i + 1}`} deve levar até cerca de ${min} min, acima dos ${ctx.tempoPorSessaoMin} min que você marcou no perfil.`,
      });
    }
  });

  // ④ Desequilíbrio puxar < empurrar (saúde do ombro — invariante do motor desde o v1).
  const conta = (p: string) => dias.reduce((n, d) => n + d.exercicios.filter((e) => e.padraoMovimento === p).length, 0);
  if (conta('puxar') < conta('empurrar')) {
    itens.push({
      codigo: 'puxar_menor_que_empurrar',
      severidade: 'risco',
      texto: `Sua semana tem mais exercícios de empurrar (${conta('empurrar')}) que de puxar (${conta('puxar')}). Manter puxar ao menos igual a empurrar ajuda a equilibrar o ombro.`,
    });
  }

  return itens;
}

/** A avaliação completa — o que a tela consome, no editor e no plano salvo (DF②). */
export function avaliarSemana(dias: readonly DiaDoEditor[], ctx: ContextoCritico): Avaliacao {
  const placar = placarDaSemana(dias, ctx);
  return { placar, recomendacoes: recomendacoes(placar, ctx.semana, ctx.faseVolume ?? 'normal'), avisos: avisos(dias, placar, ctx) };
}

/** Compara resultados sem depender da identidade do objeto nem de serialização incidental. */
function duracoesIguais(a: ResultadoDuracao, b: ResultadoDuracao): boolean {
  return a.estadoCalculo === b.estadoCalculo
    && a.estadoLimite === b.estadoLimite
    && a.orcamentoSegundos === b.orcamentoSegundos
    && a.limiteOperacionalSegundos === b.limiteOperacionalSegundos
    && a.duracaoMinimaEstimadaSegundos === b.duracaoMinimaEstimadaSegundos
    && a.duracaoMaximaEstimadaSegundos === b.duracaoMaximaEstimadaSegundos
    && a.formulaVersion === b.formulaVersion
    && JSON.stringify(a.componentes ?? null) === JSON.stringify(b.componentes ?? null)
    && JSON.stringify(a.motivosNaoAvaliados) === JSON.stringify(b.motivosNaoAvaliados)
    && JSON.stringify(a.motivosLimite) === JSON.stringify(b.motivosLimite);
}

/**
 * Crítico real do plano AUTOMÁTICO final. Ele recebe a rotina terminal, reconstrói os itens de cada dia
 * e chama a fórmula canônica por sua própria fronteira; nunca reutiliza `duracao` como cálculo.
 */
export function avaliarRotinaAutomaticaFinal(rotina: RotinaSemanal, ctx: ContextoCriticoAutomatico): Avaliacao {
  const finais = rotina.planoFinalPorDia ?? [];
  const motivosEstruturais: string[] = [];
  const fatosInformados = rotina.fatosDistribuicaoCardio;
  const distribuicao = rotina.distribuicaoCardio;
  if (!fatosInformados) motivosEstruturais.push('fatos independentes da distribuição ausentes');
  if (!distribuicao) motivosEstruturais.push('distribuição de cardio observada ausente');
  const horizonteExternoValido = Number.isSafeInteger(ctx.diasNoHorizonteEsperado)
    && ctx.diasNoHorizonteEsperado >= 0;
  const horizonteEsperado = horizonteExternoValido ? ctx.diasNoHorizonteEsperado : 0;
  if (!horizonteExternoValido) {
    motivosEstruturais.push(`horizonte externo inválido: ${String(ctx.diasNoHorizonteEsperado)}`);
  }
  if (fatosInformados && fatosInformados.diasHorizonte.length !== horizonteEsperado) {
    motivosEstruturais.push(`horizonte dos fatos diverge da entrada externa: ${fatosInformados.diasHorizonte.length} != ${horizonteEsperado}`);
  }
  const orcamentoSeg = ctx.limiteTempoTreino==='sem_limite'?undefined:ctx.tempoPorSessaoMin * 60;
  // Reconstrói os campos DERIVADOS a partir dos slots e do contexto do crítico. Dos fatos publicados
  // não lê horizonte nem oferta: os dois são entradas externas à saída que está sob julgamento.
  const ofertaExterna = [...ctx.diasOferecidosCardioEsperados];
  const ofertaExternaValida = ofertaExterna.every((d) =>
    (typeof d === 'number' && Number.isSafeInteger(d) && d >= 0 && d < ORDEM_SEMANA.length)
    || (typeof d === 'string' && ORDEM_SEMANA.includes(d as Weekday)))
    && new Set(ofertaExterna).size === ofertaExterna.length;
  if (!ofertaExternaValida) motivosEstruturais.push('oferta externa de cardio inválida');
  const oferecidos = ofertaExternaValida
    ? ORDEM_SEMANA.filter((dia, indice) => ofertaExterna.includes(dia) || ofertaExterna.includes(indice))
    : [];
  // Agregado anterior ao C1.1-B não carregava a agenda. Só nesse caso de compatibilidade,
  // recompomos a agenda padrão a partir dos contadores publicados; o caminho vivo sempre injeta
  // `diasTreinoEsperados` a partir do perfil e nunca aprende a agenda da saída auditada.
  const agendaExterna = [...(ctx.diasTreinoEsperados
    ?? diasPadrao(rotina.dias.length + rotina.diasCardioRecuperacao))];
  const agendaExternaValida = agendaExterna.every((d) => ORDEM_SEMANA.includes(d))
    && new Set(agendaExterna).size === agendaExterna.length;
  if (!agendaExternaValida) motivosEstruturais.push('agenda externa de treino inválida');
  const diasTreino = agendaExternaValida
    ? [...agendaExterna].sort((a, b) => ORDEM_SEMANA.indexOf(a) - ORDEM_SEMANA.indexOf(b))
    : [];
  const diasForcaEsperados = diasTreino.slice(0, rotina.dias.length);
  if (diasForcaEsperados.length !== rotina.dias.length) {
    motivosEstruturais.push('agenda externa não comporta as sessões de força da rotina');
  }
  const oferecidosInformados = fatosInformados?.diasHorizonte
    .filter((d) => d.oferecido)
    .map((d) => d.diaId)
    .sort((a, b) => ORDEM_SEMANA.indexOf(a as Weekday) - ORDEM_SEMANA.indexOf(b as Weekday)) ?? [];
  if (JSON.stringify(oferecidosInformados) !== JSON.stringify(oferecidos)) {
    motivosEstruturais.push('oferta de cardio dos fatos diverge da entrada externa');
  }
  const duracaoResistidaCritico = rotina.dias.map((d) =>
    avaliarDuracaoFinalDoDia(d.slots, ctx.nivel, orcamentoSeg, 0, false, rotina.limiteTempoEstrito));
  const cardioPrescritoPorDiaSegundos = rotina.cardio.tipo === 'minutos_semana' && oferecidos.length > 0
      ? duracaoDoDiaDeCardio(rotina.cardio.min, oferecidos.length) * 60
    : 0;
  const fatosReconstruidos = fatosInformados
      ? fatosDistribuicaoCardioDaRotina({
        diasComMusculacao: diasForcaEsperados.map((diaId, treinoIdx) => ({
          diaId,
          duracao: duracaoResistidaCritico[treinoIdx]!,
        })),
        diasOferecidosCardio: oferecidos,
        orcamentoSegundos: orcamentoSeg,
    ...(ctx.limiteTempoTreino==='sem_limite'?{semLimite:true}:{}),
        cardioPrescritoPorDiaSegundos,
        aggregateId: 'rotina-cardio', expectedRevision: 0,
        formulaVersion: FORMULA_DURACAO_VERSION,
      })
    : undefined;
  if (fatosInformados && fatosReconstruidos
    && JSON.stringify(fatosInformados) !== JSON.stringify(fatosReconstruidos)) {
    motivosEstruturais.push('fatos publicados divergem da reconstrução independente');
  }
  if (fatosReconstruidos && distribuicao) {
    const validacao = validarDistribuicaoCardioSemana({ fatosBase: fatosReconstruidos, distribuicaoObservada: distribuicao });
    if (validacao.tipo === 'NAO_AVALIADA_ESTRUTURAL') {
      motivosEstruturais.push(...validacao.motivos.map((m) => `distribuição inválida: ${m}`));
    }
  }
  const forcaEsperada = fatosReconstruidos?.planosResistidosTerminais.filter((p) => p.temMusculacao).length
    ?? rotina.diasForcaAgendados;
  if (rotina.diasForcaAgendados !== forcaEsperada || rotina.dias.length !== forcaEsperada) {
    motivosEstruturais.push(`dias de força divergentes: fatos ${forcaEsperada}, contador ${rotina.diasForcaAgendados}, planos ${rotina.dias.length}`);
  }
  /**
   * 🔴 D14 — a agenda SOLICITADA se reparte em três, não em duas: sessões entregues, dias de
   * recuperação e dias NÃO ATENDIDOS. Sem a terceira parcela, o dia que ficou sem exercício
   * apareceria aqui como "recuperação" — que é justamente a redistribuição silenciosa que a
   * decisão proíbe.
   */
  const naoAtendidos = rotina.diasNaoAtendidos?.length ?? 0;
  if (rotina.diasCardioRecuperacao !== diasTreino.length - forcaEsperada - naoAtendidos) {
    motivosEstruturais.push(`dias de recuperação divergentes: agenda ${diasTreino.length - forcaEsperada - naoAtendidos}, contador ${rotina.diasCardioRecuperacao}`);
  }
  if (finais.length !== horizonteEsperado) {
    motivosEstruturais.push(`horizonte final: esperado ${horizonteEsperado}, recebido ${finais.length}`);
  }
  const ids = new Set<string>();
  const ordens = new Set<number>();
  const treinos = new Set<number>();
  const treinoIdxEsperadoPorDia = new Map(diasForcaEsperados.map((diaId, treinoIdx) => [diaId, treinoIdx]));
  const blocosCanonicos = new Map((distribuicao?.blocosPorDia ?? []).map((b) => [b.diaId, b]));
  for (const dia of finais) {
    const idEsperado = ORDEM_SEMANA[dia.ordemNoHorizonte];
    if (ids.has(dia.diaId)) motivosEstruturais.push(`dia_id duplicado: ${dia.diaId}`);
    if (ordens.has(dia.ordemNoHorizonte)) motivosEstruturais.push(`ordem duplicada: ${dia.ordemNoHorizonte}`);
    if (dia.diaId !== idEsperado) motivosEstruturais.push(`identidade divergente: ${dia.diaId} != ${idEsperado}`);
    if (dia.ordemNoHorizonte < 0 || dia.ordemNoHorizonte >= horizonteEsperado) {
      motivosEstruturais.push(`ordem fora do horizonte: ${dia.ordemNoHorizonte}`);
    }
    ids.add(dia.diaId);
    ordens.add(dia.ordemNoHorizonte);
    if (dia.treinoIdx != null) {
      if (treinos.has(dia.treinoIdx)) motivosEstruturais.push(`treino_idx duplicado: ${dia.treinoIdx}`);
      if (dia.treinoIdx < 0 || dia.treinoIdx >= rotina.dias.length) {
        motivosEstruturais.push(`treino_idx fora da rotina: ${dia.treinoIdx}`);
      }
      treinos.add(dia.treinoIdx);
    }
    const treinoIdxEsperado = treinoIdxEsperadoPorDia.get(dia.diaId as Weekday);
    if (dia.treinoIdx !== treinoIdxEsperado) {
      motivosEstruturais.push(`treino_idx divergente em ${dia.diaId}: ${String(dia.treinoIdx)} != ${String(treinoIdxEsperado)}`);
    }
    const tipoEsperado = dia.treinoIdx != null
      ? (dia.cardio ? 'TREINO_E_CARDIO' : 'TREINO')
      : (dia.cardio ? 'CARDIO' : 'VAZIO');
    if (dia.tipo !== tipoEsperado) motivosEstruturais.push(`tipo divergente em ${dia.diaId}: ${dia.tipo} != ${tipoEsperado}`);
    if (dia.cardio && (dia.cardio.diaId !== dia.diaId || dia.cardio.ordemNoHorizonte !== dia.ordemNoHorizonte)) {
      motivosEstruturais.push(`cardio fora do dia final: ${dia.diaId}`);
    }
    const bloco = blocosCanonicos.get(dia.diaId);
    const cardioQualitativoEsperado = rotina.cardio.tipo === 'sessoes_moderadas'
      && oferecidos.includes(dia.diaId as Weekday);
    if (dia.cardio) {
      if (cardioQualitativoEsperado) {
        if (dia.cardio.minutos !== null) {
          motivosEstruturais.push(`minutos de cardio qualitativo devem ser nulos em ${dia.diaId}`);
        }
        if (dia.cardio.duracaoSegundos != null || bloco) {
          motivosEstruturais.push(`cardio qualitativo ganhou duração/bloco em ${dia.diaId}`);
        }
      } else {
        if (!Number.isSafeInteger(dia.cardio.duracaoSegundos) || (dia.cardio.duracaoSegundos ?? 0) <= 0) {
          motivosEstruturais.push(`duração de cardio inválida em ${dia.diaId}`);
        }
        if (!bloco) {
          motivosEstruturais.push(`cardio final sem bloco canônico: ${dia.diaId}`);
        } else {
          if (dia.cardio.minutos !== bloco.duracaoTotalSegundos / 60) {
            motivosEstruturais.push(`minutos de cardio divergem da duração exata em ${dia.diaId}`);
          }
          if (dia.cardio.duracaoSegundos !== bloco.duracaoTotalSegundos) {
            motivosEstruturais.push(`duração de cardio diverge do bloco em ${dia.diaId}`);
          }
          if (JSON.stringify(dia.cardio.linhagens ?? []) !== JSON.stringify(bloco.linhagens)) {
            motivosEstruturais.push(`linhagem de cardio diverge do bloco em ${dia.diaId}`);
          }
        }
      }
    } else if (cardioQualitativoEsperado) {
      motivosEstruturais.push(`cardio qualitativo ausente do plano final: ${dia.diaId}`);
    } else if (bloco) {
      motivosEstruturais.push(`bloco canônico ausente do plano final: ${dia.diaId}`);
    }
  }
  for (let ordem = 0; ordem < horizonteEsperado; ordem += 1) {
    if (!ordens.has(ordem)) motivosEstruturais.push(`dia final ausente: ${ORDEM_SEMANA[ordem] ?? String(ordem)}`);
  }
  for (let treinoIdx = 0; treinoIdx < rotina.dias.length; treinoIdx += 1) {
    if (!treinos.has(treinoIdx)) motivosEstruturais.push(`treino final ausente: ${treinoIdx}`);
  }
  for (const bloco of blocosCanonicos.values()) {
    if (!Number.isSafeInteger(bloco.duracaoTotalSegundos) || bloco.duracaoTotalSegundos <= 0) {
      motivosEstruturais.push(`bloco canônico com duração inválida: ${bloco.diaId}`);
    }
    if (!ids.has(bloco.diaId)) motivosEstruturais.push(`bloco canônico fora do plano final: ${bloco.diaId}`);
  }
  const cardioProjetado = finais.flatMap((d) => d.cardio ? [d.cardio] : []);
  if (JSON.stringify(rotina.diasCardio) !== JSON.stringify(cardioProjetado)) {
    motivosEstruturais.push('diasCardio diverge da projeção do plano final');
  }
  if (!rotina.duracaoResistidaDias
    || rotina.duracaoResistidaDias.length !== duracaoResistidaCritico.length
    || rotina.duracaoResistidaDias.some((d, i) => !duracoesIguais(d, duracaoResistidaCritico[i]!))) {
    motivosEstruturais.push('duracaoResistidaDias diverge da reconstrução independente dos slots');
  }
  const duracaoFinalTreinos = rotina.dias.map((_, treinoIdx) =>
    finais.find((d) => d.treinoIdx === treinoIdx)?.duracao);
  if (!rotina.duracaoDias
    || rotina.duracaoDias.length !== duracaoFinalTreinos.length
    || duracaoFinalTreinos.some((d, i) => !d || !duracoesIguais(rotina.duracaoDias![i]!, d))) {
    motivosEstruturais.push('duracaoDias diverge da projeção do plano final');
  }
  const diasEditor: DiaDoEditor[] = rotina.dias.map((dia, treinoIdx) => {
    const final = finais.find((d) => d.treinoIdx === treinoIdx);
    return {
      nome: dia.nome,
      exercicios: dia.slots.map((s) => s.exercicio),
      series: dia.slots.map((s) => s.series),
      descansoSeg: dia.slots.map((s) => s.descansoSeg),
      holdSeg: dia.slots.map((s) => s.holdSeg),
      cardioSegundos: blocosCanonicos.get(final?.diaId ?? '')?.duracaoTotalSegundos,
    };
  });
  const base = avaliarSemana(diasEditor, ctx);
  const conferencias = finais.map((dia) => {
    const treino = dia.treinoIdx != null ? rotina.dias[dia.treinoIdx] : undefined;
    const cardioCanonicoSegundos = blocosCanonicos.get(dia.diaId)?.duracaoTotalSegundos ?? 0;
    const cardioQualitativoEsperado = rotina.cardio.tipo === 'sessoes_moderadas'
      && oferecidos.includes(dia.diaId as Weekday);
    const critico = avaliarDuracaoFinalDoDia(
      treino?.slots ?? [], ctx.nivel, orcamentoSeg, cardioCanonicoSegundos,
      cardioQualitativoEsperado, rotina.limiteTempoEstrito,
    );
    return { diaId: dia.diaId, converge: duracoesIguais(dia.duracao, critico), gerador: dia.duracao, critico };
  });
  const convergiu = motivosEstruturais.length === 0 && conferencias.every((d) => d.converge);
  return {
    ...base,
    convergenciaPlanoFinal: {
      estado: convergiu ? 'CONVERGIU' : 'DIVERGIU',
      motivosEstruturais,
      dias: conferencias,
    },
  };
}
