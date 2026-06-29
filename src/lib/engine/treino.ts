/**
 * Motor de treino — prescrição FITT + progressão (dupla progressão) + deload.
 * Fonte: parametros-motor-treino-evokorpus (DFs travadas 2026-06-28). Caminho PERMITIR/RESTRINGIR.
 */
import {
  DELOAD_REDUCAO_VOLUME,
  DELOAD_SEMANAS_DEFAULT,
  DIFICULDADE_LIBERADA,
  FITT_OBJETIVO,
  FREQ_POR_GRUPO_MIN,
  INCREMENTO_CARGA,
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

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Dificuldades de exercício liberadas pelo nível (escada da biblioteca A1). */
export function dificuldadesLiberadas(nivel: NivelExperiencia): NivelExercicio[] {
  return DIFICULDADE_LIBERADA[nivel];
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

  // Reps com carga começam em 6 (defensivo; as faixas da spec já respeitam).
  const repsComposto: Faixa = { min: Math.max(base.repsComposto.min, PISO_REPS_COM_CARGA), max: base.repsComposto.max };

  return {
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

  const faixa = faixaReps(exercicio, prescricao);
  const piso = faixa.min; // reset sempre ao piso da faixa
  const teto = faixa.max;

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
      // reps sobem dentro da faixa (é aqui que o peso corporal progride em reps)
      return {
        acao: '+1 rep dentro da faixa',
        proximo: { ...estado, repsAlvo: Math.min(estado.repsAlvo + 1, teto), dificeisSeguidos: 0 },
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
    // peso corporal: −1–2 reps, ou desce 1 variação se furaria o piso
    if (estado.repsAlvo - 2 >= piso) {
      return {
        acao: '−2 reps',
        proximo: { ...estado, repsAlvo: estado.repsAlvo - 2, dificeisSeguidos: 0 },
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

// Guarda defensiva: o piso absoluto de reps (5) nunca é cruzado com carga.
// A progressão acima reseta sempre a `faixa.min` (≥ 6), então isto é só documentação/asserção.
export function repsRespeitaPisoAbsoluto(reps: number): boolean {
  return reps >= PISO_ABSOLUTO_REPS;
}

/** Deload — precisa nesta semana? */
export function precisaDeload(args: {
  nivel: NivelExperiencia;
  semanasDesdeUltimoDeload: number;
  sinaisFadiga: boolean;
}): boolean {
  if (args.sinaisFadiga) return true; // reativo (qualquer nível)
  if (args.nivel === 'iniciante') return false; // iniciante é só reativo, não agendado
  return args.semanasDesdeUltimoDeload >= DELOAD_SEMANAS_DEFAULT;
}

/** Aplica a semana de deload à prescrição: −~45% do volume (carga −10% é por exercício). */
export function aplicarDeload(p: PrescricaoFITT): PrescricaoFITT & { deload: true } {
  const fator = 1 - DELOAD_REDUCAO_VOLUME;
  return {
    ...p,
    volumePorGrupoSemana: {
      min: Math.max(1, Math.round(p.volumePorGrupoSemana.min * fator)),
      max: Math.max(1, Math.round(p.volumePorGrupoSemana.max * fator)),
    },
    deload: true,
  };
}
