/**
 * Motor de treino — prescrição FITT + progressão (dupla progressão) + deload.
 * Fonte: parametros-motor-treino-adaptkorpus (DFs travadas 2026-06-28). Caminho PERMITIR/RESTRINGIR.
 */
import {
  DELOAD_REDUCAO_VOLUME,
  DELOAD_SEMANAS_DEFAULT,
  DIFICULDADE_LIBERADA,
  FITT_OBJETIVO,
  FREQ_POR_GRUPO_MIN,
  INCREMENTO_CARGA,
  MODO_FORCA_REPS,
  PISO_ABSOLUTO_REPS,
  PISO_REPS_COM_CARGA,
  REDUCAO_CARGA_DIFICIL,
  RIR_MIN_GLOBAL,
  RIR_MIN_INICIANTE,
  VOLUME_NIVEL,
} from './treino-constants';
import type {
  AcaoProgressao,
  EstadoExercicio,
  Faixa,
  Feedback,
  NivelExperiencia,
  PerfilTreino,
  PrescricaoFITT,
  ResultadoGateTreino,
} from './treino-types';
import type { Exercise, NivelExercicio } from '../data/types';
import { DECREMENTO_SEG, INCREMENTO_SEG, PISO_HOLD_SEG, faixaSegundos, repUnitDe } from './isometricos';
import { indiceBase } from './modificacoes-isometricos';
import { temCargaProgressivel } from './equipamento';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Dificuldades de exercício liberadas pelo nível (escada da biblioteca A1). */
export function dificuldadesLiberadas(nivel: NivelExperiencia): NivelExercicio[] {
  return DIFICULDADE_LIBERADA[nivel];
}

/**
 * 🔵 A REFERÊNCIA DE SESSÕES DE FORÇA POR SEMANA — 2 a 3 (iniciante), 3 a 4 (intermediário),
 * 4 a 6 (avançado). O número vem do cofre (`motor-treino-volume-e-frequencia-por-nivel`, claims
 * --002 a --004 e --007), e continua sendo dele.
 *
 * 🔴 O PAPEL MUDOU EM 2026-09-20, por decisão do autor — e só o papel. Até 19/09 este número
 * CORTAVA a agenda (`min(dias_disponiveis, teto)`, claim --010: o excedente virava
 * cardio/recuperação). Em 19/09 o corte passou a ser DITO; a revisão recusou, porque dizer não
 * atende quem marcou sete dias e recebeu cinco sessões. Agora todo dia marcado para musculação
 * vira sessão, e este número orienta a escolha em vez de apagá-la: é ele que a tela mostra como
 * RECOMENDAÇÃO antes de a pessoa escolher os dias, e é ele que `cobertura-teto` usa para medir o
 * pico do nível. Nenhum caminho do motor o usa mais para descartar um dia escolhido.
 *
 * ⚠️ Decisão de PRODUTO tomada na candidata de 20/09, ainda NÃO arquivada no cofre: enquanto
 * não voltar de lá, a página citada acima segue descrevendo a regra antiga do claim --010.
 *
 * 🔒 O volume semanal NÃO acompanha o número de dias: quem limita continua sendo o alvo por
 * grupo, a poda semanal, o teto por sessão e o teto por exercício.
 */
export function tetoSessoesForca(nivel: NivelExperiencia): number {
  return VOLUME_NIVEL[nivel].sessoesForca.max;
}

/**
 * Gera a prescrição FITT. NÃO chamar com gate ROTEAR (fail-safe → erro).
 * Usa o objetivo EFETIVO (RESTRINGIR já redirecionou emagrecimento → saúde no gate).
 */
export function prescreverTreino(
  perfil: PerfilTreino,
  gate: ResultadoGateTreino,
): PrescricaoFITT {
  if (gate.comportamento === 'ROTEAR') {
    throw new Error('prescreverTreino não pode ser chamado com gate ROTEAR — nenhum treino é gerado.');
  }
  const obj = gate.objetivoEfetivo;
  const nivel = perfil.nivelExperiencia;
  const base = FITT_OBJETIVO[obj];
  const vol = VOLUME_NIVEL[nivel];

  // RIR: piso global 1; iniciante nunca abaixo de 2.
  const rirMin = Math.max(base.rir.min, nivel === 'iniciante' ? RIR_MIN_INICIANTE : RIR_MIN_GLOBAL);

  // Modo força (v2, DF 2026-07-08): preset opt-in SÓ interm./avançado — compostos travados
  // em 6 reps (nunca < 6 nem > 6), progressão só por carga (→ 6RM); isolados mantêm a faixa
  // v1. Iniciante IGNORA o flag (mantém RIR ≥ 2, sem 6RM real).
  const modoForca = perfil.modoForca === true && nivel !== 'iniciante';

  // Reps com carga começam em 6 (defensivo; as faixas da spec já respeitam).
  const repsComposto: Faixa = modoForca
    ? { min: MODO_FORCA_REPS, max: MODO_FORCA_REPS }
    : { min: Math.max(base.repsComposto.min, PISO_REPS_COM_CARGA), max: base.repsComposto.max };

  return {
    ...(modoForca ? { modoForca: true as const } : {}),
    objetivoEfetivo: obj,
    nivel,
    repsComposto,
    repsIsolado: { ...base.repsIsolado },
    rir: { min: rirMin, max: base.rir.max },
    descansoCompostoSeg: { ...base.descansoCompostoSeg },
    descansoIsoladoSeg: { ...base.descansoIsoladoSeg },
    seriesPorExercicio: { ...vol.seriesPorExercicio },
    volumePorGrupoSemana: { ...vol.volumePorGrupoSemana[obj] },
    freqPorGrupoMin: FREQ_POR_GRUPO_MIN,
    sessoesForcaSemana: { ...vol.sessoesForca },
    cardio: base.cardio,
    semFalhaIniciante: nivel === 'iniciante',
    pisoRepsComCarga: PISO_REPS_COM_CARGA,
  };
}

/** Faixa de reps aplicável ao exercício (isolado vs composto). */
function faixaReps(exercicio: Exercise, p: PrescricaoFITT): Faixa {
  return exercicio.padraoMovimento === 'isolado' ? p.repsIsolado : p.repsComposto;
}

/** Grande composto inferior (incremento de carga maior). */
function ehInferiorGrandeComposto(exercicio: Exercise): boolean {
  return (
    (exercicio.padraoMovimento === 'agachar' || exercicio.padraoMovimento === 'dobradica_quadril') &&
    exercicio.tipo === 'forca_hipertrofia'
  );
}

/**
 * Progressão por feedback (dupla progressão). Função PURA e determinística.
 * `opts.temDor` aciona o re-check de runtime: pausa o movimento + aviso (NÃO ROTEAR).
 */
export function progredirExercicio(
  estado: EstadoExercicio,
  feedback: Feedback,
  prescricao: PrescricaoFITT,
  exercicio: Exercise,
  opts?: { temDor?: boolean },
): AcaoProgressao {
  // Re-check de runtime — dor (≠ DOMS) / lesão nova → pausa localizada + aviso.
  if (opts?.temDor) {
    return {
      acao: 'pausa por dor/lesão',
      proximo: estado,
      pausadoPorDor: true,
      aviso: 'Sentiu dor (≠ dor muscular tardia)? Pausamos este movimento. Procure um profissional.',
    };
  }

  // Isométricos: mesma dupla progressão, unidade = segundos (cofre §Isométricos). A faixa vem das
  // bandas por nível e o passo é ±5 s (análogo a ±1/±2 reps); o alvo mora em `repsAlvo` (genérico).
  const esSeg = repUnitDe(exercicio.id) === 'segundos';
  const faixa = esSeg ? (faixaSegundos(exercicio.id, prescricao.nivel) ?? faixaReps(exercicio, prescricao)) : faixaReps(exercicio, prescricao);
  const piso = faixa.min; // reset sempre ao piso da faixa
  const teto = faixa.max;
  const passoUp = esSeg ? INCREMENTO_SEG : 1;   // "na medida" sobe dentro da faixa
  const passoDown = esSeg ? DECREMENTO_SEG : 2; // "difícil 2×" desce dentro da faixa

  if (feedback === 'facil') {
    if (estado.modo === 'carga') {
      const incr = ehInferiorGrandeComposto(exercicio)
        ? INCREMENTO_CARGA.inferiorComposto
        : INCREMENTO_CARGA.superiorIsolado;
      const novaCarga = round1((estado.cargaKg ?? 0) * (1 + incr));
      return {
        acao: `+${incr * 100}% carga, reset reps ao piso (${piso})`,
        proximo: { ...estado, cargaKg: novaCarga, repsAlvo: piso, dificeisSeguidos: 0 },
      };
    }
    // peso corporal: +1 série até o teto → sobe variação (reset séries + reps)
    if (estado.series < prescricao.seriesPorExercicio.max) {
      return {
        acao: '+1 série (peso corporal)',
        proximo: { ...estado, series: estado.series + 1, dificeisSeguidos: 0 },
      };
    }
    return {
      acao: 'sobe 1 variação (degrau de dificuldade), reset séries e reps',
      proximo: {
        ...estado,
        variacaoNivel: (estado.variacaoNivel ?? 0) + 1,
        series: prescricao.seriesPorExercicio.min,
        repsAlvo: piso,
        dificeisSeguidos: 0,
      },
    };
  }

  if (feedback === 'na_medida') {
    if (estado.modo === 'peso_corporal') {
      // reps/segundos sobem dentro da faixa (é aqui que o peso corporal / hold progride)
      return {
        acao: esSeg ? `+${passoUp} s dentro da faixa` : '+1 rep dentro da faixa',
        proximo: { ...estado, repsAlvo: Math.min(estado.repsAlvo + passoUp, teto), dificeisSeguidos: 0 },
      };
    }
    return { acao: 'repete (consolida)', proximo: { ...estado, dificeisSeguidos: 0 } };
  }

  // feedback === 'dificil'
  const seguidos = estado.dificeisSeguidos + 1;
  if (seguidos >= 2) {
    if (estado.modo === 'carga') {
      const novaCarga = round1((estado.cargaKg ?? 0) * (1 - REDUCAO_CARGA_DIFICIL));
      return {
        acao: '−10% carga e reconstrói',
        proximo: { ...estado, cargaKg: novaCarga, repsAlvo: piso, dificeisSeguidos: 0 },
      };
    }
    // peso corporal: −1–2 reps (ou −5 s no hold), ou desce 1 variação/modificação se furaria o piso
    if (estado.repsAlvo - passoDown >= piso) {
      return {
        acao: esSeg ? `−${passoDown} s` : '−2 reps',
        proximo: { ...estado, repsAlvo: estado.repsAlvo - passoDown, dificeisSeguidos: 0 },
      };
    }
    return {
      acao: 'desce 1 variação',
      proximo: {
        ...estado,
        variacaoNivel: Math.max(0, (estado.variacaoNivel ?? 0) - 1),
        repsAlvo: teto,
        dificeisSeguidos: 0,
      },
    };
  }
  // 1ª "difícil": segura
  return { acao: 'segura (mira fechar a faixa)', proximo: { ...estado, dificeisSeguidos: seguidos } };
}


/** Evento de treino: o feedback do exercício naquela sessão + a maior carga logada (se houve). */
export interface EventoTreino {
  tipo?: undefined;
  fb: Feedback;
  /** Só no modo carga: a maior carga (kg) efetivamente logada na sessão (base do próximo alvo). */
  cargaMaxKg?: number;
}

/**
 * Evento de CALIBRAÇÃO manual ("Muito fácil" — cofre parametros-motor-treino DF #11/#13,
 * 2026-07-04). Grava a NOVA BASE do exercício como evento no histórico (B2: alvo segue
 * sendo função pura do histórico). Exatamente uma das três formas:
 *  - carga:        { cargaKg, reps }
 *  - peso corporal: { degrauId, reps }  (degrau da escada assumido — B3; também usado
 *                    pela adoção explícita "Assumir este degrau")
 *  - isométrico:   { modificacaoIdx, segundos }  (índice na escada de modificações — B1)
 * Salvaguarda travada: a calibração ZERA `dificeisSeguidos` (base nova invalida a
 * estagnação antiga).
 */
export interface EventoCalibracao {
  tipo: 'calibracao';
  cargaKg?: number;
  reps?: number;
  degrauId?: string;
  modificacaoIdx?: number;
  segundos?: number;
}

export type EventoProgressao = EventoTreino | EventoCalibracao;

/** Rótulo de `ultimaAcao` da calibração — NÃO casa com os rótulos de progressão/regressão
 *  (o hint "meta recalibrada" da UI deriva dele; B7: some quando o próximo feedback chega). */
export const ACAO_RECALIBRADO = 'recalibrado (base manual)';

/** Estado inicial de um exercício (antes de qualquer sessão), pela prescrição e pelo tipo. */
export function estadoInicial(exercicio: Exercise, prescricao: PrescricaoFITT): EstadoExercicio {
  const esSeg = repUnitDe(exercicio.id) === 'segundos';
  const faixa = esSeg ? (faixaSegundos(exercicio.id, prescricao.nivel) ?? faixaReps(exercicio, prescricao)) : faixaReps(exercicio, prescricao);
  // Holds são time-only (peso corporal); com carga = academia/casa-com; senão peso corporal.
  const modo: EstadoExercicio['modo'] = temCargaProgressivel(exercicio) ? 'carga' : 'peso_corporal';
  return {
    exercicioId: exercicio.id,
    modo,
    series: prescricao.seriesPorExercicio.min,
    repsAlvo: faixa.min, // alvo dentro da faixa (reps OU segundos)
    ...(modo === 'peso_corporal' ? { variacaoNivel: 0 } : {}),
    rirAlvo: prescricao.rir.min,
    dificeisSeguidos: 0,
  };
}

/**
 * Estado ATUAL de um exercício = dobra pura de `progredirExercicio` sobre o histórico de eventos
 * (ordem cronológica). No modo carga, semeia `cargaKg` da carga logada da sessão ANTES de progredir
 * (base = o que a pessoa levantou). Determinística: mesmo histórico → mesmo alvo. Retorna também a
 * última ação (para o hint de evolução na UI). Nunca sugere carga 0 (base ausente → cargaKg indefinida).
 */
export function estadoAposHistorico(
  exercicio: Exercise,
  prescricao: PrescricaoFITT,
  eventos: readonly EventoProgressao[],
): { estado: EstadoExercicio; ultimaAcao: string | null } {
  let estado = estadoInicial(exercicio, prescricao);
  let ultimaAcao: string | null = null;
  for (const ev of eventos) {
    if (ev.tipo === 'calibracao') {
      estado = aplicarCalibracao(estado, ev, prescricao, exercicio);
      ultimaAcao = ACAO_RECALIBRADO;
      continue;
    }
    if (estado.modo === 'carga' && ev.cargaMaxKg != null && ev.cargaMaxKg > 0) {
      estado = { ...estado, cargaKg: ev.cargaMaxKg }; // base do próximo alvo = carga logada
    }
    const r = progredirExercicio(estado, ev.fb, prescricao, exercicio);
    estado = r.proximo;
    if (estado.cargaKg === 0) estado = { ...estado, cargaKg: undefined }; // sem base → sem sugestão
    ultimaAcao = r.acao;
  }
  return { estado, ultimaAcao };
}

/**
 * Aplica um evento de calibração ao estado (B2 — nova semente da dupla progressão).
 * Trilhos (cofre DF #11): com carga, reps clampadas ao piso do nível (iniciante 6;
 * demais 5 — o absoluto vale p/ todos; defesa em profundidade além da UI). Peso
 * corporal: o "piso" é a própria variação escolhida (reps livres ≥ 1). Isométrico:
 * segundos ≥ piso de registro (10 s). SEMPRE zera `dificeisSeguidos` (salvaguarda
 * travada) e volta as séries ao piso da prescrição quando a base muda de degrau.
 */
function aplicarCalibracao(
  estado: EstadoExercicio,
  ev: EventoCalibracao,
  prescricao: PrescricaoFITT,
  exercicio: Exercise,
): EstadoExercicio {
  const esSeg = repUnitDe(exercicio.id) === 'segundos';
  if (estado.modo === 'carga') {
    const pisoNivel = prescricao.nivel === 'iniciante' ? PISO_REPS_COM_CARGA : PISO_ABSOLUTO_REPS;
    return {
      ...estado,
      ...(ev.cargaKg != null && ev.cargaKg > 0 ? { cargaKg: round1(ev.cargaKg) } : {}),
      ...(ev.reps != null ? { repsAlvo: Math.max(pisoNivel, Math.round(ev.reps)) } : {}),
      dificeisSeguidos: 0,
    };
  }
  if (esSeg) {
    // Isométrico: nova modificação (índice absoluto na escada — B6: absoluto é o oficial;
    // variacaoNivel vira o offset derivado a partir da base).
    const base = indiceBase(exercicio.id);
    return {
      ...estado,
      ...(ev.segundos != null ? { repsAlvo: Math.max(PISO_HOLD_SEG, Math.round(ev.segundos)) } : {}),
      ...(ev.modificacaoIdx != null && base >= 0 ? { variacaoNivel: ev.modificacaoIdx - base } : {}),
      series: prescricao.seriesPorExercicio.min,
      dificeisSeguidos: 0,
    };
  }
  // Peso corporal: nova base = degrau assumido (B3 — o degrauId efetivo vive no evento e
  // é resolvido pelo adaptador/UI como overlay; aqui reancoramos alvo e séries).
  return {
    ...estado,
    ...(ev.reps != null ? { repsAlvo: Math.max(1, Math.round(ev.reps)) } : {}),
    series: prescricao.seriesPorExercicio.min,
    dificeisSeguidos: 0,
  };
}

/**
 * Deload — precisa nesta semana? v2 (DF 2026-07-08): o agendado é UNIVERSAL (mesociclo
 * de 6 semanas vale p/ todos os níveis, iniciante incluído — substitui o "iniciante só
 * reativo" do v1). O reativo (fadiga) segue valendo para qualquer nível e antecipa.
 */
export function precisaDeload(args: {
  nivel: NivelExperiencia;
  semanasDesdeUltimoDeload: number;
  sinaisFadiga: boolean;
}): boolean {
  if (args.sinaisFadiga) return true; // reativo (qualquer nível)
  return args.semanasDesdeUltimoDeload >= DELOAD_SEMANAS_DEFAULT;
}

/**
 * Autorregulação por RIR numérico (v2 §3): refina o feedback qualitativo com os números
 * registrados na sessão ANTES da dobra da dupla progressão — `progredirExercicio` fica
 * intocado (trilhos preservados; a regressão continua exigindo 2 "difícil" seguidos e a
 * carga nunca leva as reps abaixo do piso da faixa).
 *  - reps > topo da faixa E RIR > alvo → 'facil' (+carga)
 *  - reps < piso da faixa OU RIR < alvo → 'dificil' (segura / −carga com pisos)
 *  - modo força (faixa 6–6): as 6 saem NO RIR-alvo (≥) → 'facil' (+carga → 6RM)
 *  - senão → mantém o feedback qualitativo (que segue existindo como atalho).
 */
export function feedbackRefinado(args: {
  fb: Feedback;
  faixa: Faixa;
  rirAlvo: number;
  /** Maior nº de reps registrado nas séries da sessão (ausente = sem registro numérico). */
  repsMax?: number;
  /** Menor RIR numérico registrado nas séries da sessão (ausente = sem registro). */
  rirMin?: number;
  /** Prescrição em modo força (faixa travada em 6): +carga quando as 6 saem no alvo. */
  modoForca?: boolean;
}): Feedback {
  const { fb, faixa, rirAlvo, repsMax, rirMin, modoForca } = args;
  if ((repsMax != null && repsMax < faixa.min) || (rirMin != null && rirMin < rirAlvo)) return 'dificil';
  if (repsMax != null && rirMin != null) {
    if (modoForca && repsMax >= faixa.max && rirMin >= rirAlvo) return 'facil';
    if (repsMax > faixa.max && rirMin > rirAlvo) return 'facil';
  }
  return fb;
}

/**
 * Aplica a semana de deload à prescrição: −~45% do volume (carga −10% é por exercício).
 *
 * 🔴 D2 (diagnóstico 2026-09-10): a redução alcança as DUAS réguas de volume, não só a
 * semanal por grupo. Medido: reduzir apenas `volumePorGrupoSemana` deixa intocado todo grupo
 * cuja capacidade estrutural (`nº de slots × seriesPorExercicio.max`) já estava ABAIXO do
 * alvo — bíceps com 1 exercício continuava em 4 séries nas duas semanas. O corte agregado
 * caía para −28 %, fora da banda −40–50 % que o cofre registra
 * (`motor-treino-mesociclo-v2`, 2026-07-08).
 *
 * 🔒 Mesmo fator, uma única constante (`DELOAD_REDUCAO_VOLUME`), nenhum percentual novo.
 * O piso 1 não é escolha: é o menor inteiro que ainda é uma série.
 */
export function seriesEmDeload(series: number): number {
  return Math.max(1, Math.round(series * (1 - DELOAD_REDUCAO_VOLUME)));
}

export function aplicarDeload(p: PrescricaoFITT): PrescricaoFITT & { deload: true } {
  const reduzir = (f: Faixa): Faixa => ({
    min: seriesEmDeload(f.min),
    max: seriesEmDeload(f.max),
  });
  return {
    ...p,
    volumePorGrupoSemana: reduzir(p.volumePorGrupoSemana),
    seriesPorExercicio: reduzir(p.seriesPorExercicio),
    deload: true,
  };
}
