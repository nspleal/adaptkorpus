import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { aplicarDeload, precisaDeload, prescreverTreino, progredirExercicio } from './treino';
import type { EstadoExercicio, PerfilTreino } from './treino-types';
import type { FlagsSaude } from './types';
import type { Exercise } from '../data/types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
function perfil(over: Partial<PerfilTreino> = {}): PerfilTreino {
  return { pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60, ...over };
}
function prescrever(over: Partial<PerfilTreino> = {}) {
  const p = perfil(over);
  return prescreverTreino(p, avaliarGateTreino(p));
}
const supino: Exercise = { id: 'e_sup', nomePt: 'Supino', grupoMuscular: 'peito', padraoMovimento: 'empurrar', nivel: 'intermediario', tipo: 'forca_hipertrofia', equipamento: 'academia', local: 'academia', comoFazer: '' };
const agacho: Exercise = { id: 'e_agacho', nomePt: 'Agachamento', grupoMuscular: 'quadriceps', padraoMovimento: 'agachar', nivel: 'iniciante', tipo: 'forca_hipertrofia', equipamento: 'nenhum', local: 'casa_sem', comoFazer: '' };

describe('prescrição FITT', () => {
  it('massa/intermediário bate a spec', () => {
    const p = prescrever({ objetivo: 'massa', nivelExperiencia: 'intermediario' });
    expect(p.repsComposto).toEqual({ min: 6, max: 12 });
    expect(p.rir).toEqual({ min: 1, max: 3 });
    expect(p.descansoCompostoSeg).toEqual({ min: 90, max: 120 });
    expect(p.volumePorGrupoSemana).toEqual({ min: 13, max: 16 });
    expect(p.sessoesForcaSemana).toEqual({ min: 3, max: 4 });
    expect(p.cardio).toEqual({ tipo: 'sessoes_moderadas', min: 1, max: 2 });
    expect(p.semFalhaIniciante).toBe(false);
  });

  it('iniciante: piso de RIR = 2 (nunca < 2)', () => {
    const massa = prescrever({ objetivo: 'massa', nivelExperiencia: 'iniciante' });
    expect(massa.rir.min).toBe(2); // base 1 elevado p/ 2
    expect(massa.semFalhaIniciante).toBe(true);
    const saude = prescrever({ objetivo: 'saude', nivelExperiencia: 'iniciante' });
    expect(saude.rir).toEqual({ min: 2, max: 4 });
  });

  it('emagrecimento: cardio 150–300 min/sem; reps compostos começam em ≥ 6', () => {
    const p = prescrever({ objetivo: 'emagrecimento', nivelExperiencia: 'avancado' });
    expect(p.cardio).toEqual({ tipo: 'minutos_semana', min: 150, max: 300 });
    expect(p.repsComposto.min).toBeGreaterThanOrEqual(6);
    expect(p.volumePorGrupoSemana).toEqual({ min: 12, max: 16 });
  });

  it('lança erro se chamado com gate ROTEAR', () => {
    const p = perfil({ flagsSaude: { ...SEM, lesao: true } });
    expect(() => prescreverTreino(p, avaliarGateTreino(p))).toThrow();
  });
});

describe('progressão (dupla progressão)', () => {
  const p = prescrever({ objetivo: 'massa', nivelExperiencia: 'intermediario' }); // repsComposto 6-12

  function estado(over: Partial<EstadoExercicio> = {}): EstadoExercicio {
    return { exercicioId: 'e_sup', modo: 'carga', series: 3, repsAlvo: 12, cargaKg: 100, rirAlvo: 2, dificeisSeguidos: 0, ...over };
  }

  it('fácil + carga (superior/isolado) → +2,5%, reset ao piso', () => {
    const r = progredirExercicio(estado(), 'facil', p, supino);
    expect(r.proximo.cargaKg).toBeCloseTo(102.5, 3);
    expect(r.proximo.repsAlvo).toBe(6);
  });

  it('fácil + carga (inferior grande composto) → +5%', () => {
    const r = progredirExercicio(estado(), 'facil', p, agacho);
    expect(r.proximo.cargaKg).toBeCloseTo(105, 3);
  });

  it('fácil + peso corporal: +1 série até o teto, depois sobe variação', () => {
    const r1 = progredirExercicio(estado({ modo: 'peso_corporal', series: 2, cargaKg: undefined }), 'facil', p, agacho);
    expect(r1.proximo.series).toBe(3);
    const r2 = progredirExercicio(estado({ modo: 'peso_corporal', series: 4, variacaoNivel: 0, cargaKg: undefined }), 'facil', p, agacho);
    expect(r2.proximo.variacaoNivel).toBe(1);
    expect(r2.proximo.series).toBe(p.seriesPorExercicio.min);
  });

  it('na medida + peso corporal: +1 rep (até o teto)', () => {
    const r = progredirExercicio(estado({ modo: 'peso_corporal', repsAlvo: 8, cargaKg: undefined }), 'na_medida', p, agacho);
    expect(r.proximo.repsAlvo).toBe(9);
  });

  it('na medida + carga: repete', () => {
    const r = progredirExercicio(estado({ repsAlvo: 9 }), 'na_medida', p, supino);
    expect(r.proximo.repsAlvo).toBe(9);
    expect(r.proximo.cargaKg).toBe(100);
  });

  it('difícil 1ª segura; 2ª seguida com carga → −10% e reconstrói', () => {
    const r1 = progredirExercicio(estado(), 'dificil', p, supino);
    expect(r1.proximo.dificeisSeguidos).toBe(1);
    const r2 = progredirExercicio(r1.proximo, 'dificil', p, supino);
    expect(r2.proximo.cargaKg).toBeCloseTo(90, 3);
    expect(r2.proximo.repsAlvo).toBe(6);
    expect(r2.proximo.dificeisSeguidos).toBe(0);
  });

  it('dor → pausa o movimento + aviso (não ROTEAR)', () => {
    const r = progredirExercicio(estado(), 'na_medida', p, supino, { temDor: true });
    expect(r.pausadoPorDor).toBe(true);
    expect(r.aviso).toBeTruthy();
  });
});

describe('deload', () => {
  it('intermediário a cada 6 semanas; iniciante só reativo', () => {
    expect(precisaDeload({ nivel: 'intermediario', semanasDesdeUltimoDeload: 6, sinaisFadiga: false })).toBe(true);
    expect(precisaDeload({ nivel: 'intermediario', semanasDesdeUltimoDeload: 3, sinaisFadiga: false })).toBe(false);
    expect(precisaDeload({ nivel: 'iniciante', semanasDesdeUltimoDeload: 8, sinaisFadiga: false })).toBe(false);
    expect(precisaDeload({ nivel: 'iniciante', semanasDesdeUltimoDeload: 1, sinaisFadiga: true })).toBe(true);
  });

  it('aplicar deload reduz ~45% do volume', () => {
    const p = prescrever({ objetivo: 'massa', nivelExperiencia: 'avancado' }); // volume 16-20
    const d = aplicarDeload(p);
    expect(d.deload).toBe(true);
    expect(d.volumePorGrupoSemana.max).toBeLessThan(p.volumePorGrupoSemana.max);
    expect(d.volumePorGrupoSemana.max).toBe(Math.round(20 * 0.55));
  });
});
