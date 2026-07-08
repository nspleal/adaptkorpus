import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { aplicarDeload, estadoAposHistorico, estadoInicial, feedbackRefinado, precisaDeload, prescreverTreino, progredirExercicio } from './treino';
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
const supino: Exercise = { id: 'e_sup', nomePt: 'Supino', grupoMuscular: 'peito', grupoPrimario: 'peito', padraoMovimento: 'empurrar', nivel: 'intermediario', tipo: 'forca_hipertrofia', equipamento: 'academia', local: 'academia', comoFazer: '' };
const agacho: Exercise = { id: 'e_agacho', nomePt: 'Agachamento', grupoMuscular: 'quadriceps', grupoPrimario: 'quadriceps', padraoMovimento: 'agachar', nivel: 'iniciante', tipo: 'forca_hipertrofia', equipamento: 'nenhum', local: 'casa_sem', comoFazer: '' };
// Isométrico: id 'e7' (Prancha) está em REP_UNIT_SEGUNDOS → progride em segundos.
const prancha: Exercise = { id: 'e7', nomePt: 'Prancha', grupoMuscular: 'core', grupoPrimario: 'core', padraoMovimento: 'core', nivel: 'iniciante', tipo: 'forca_hipertrofia', equipamento: 'nenhum', equipamentoDetalhe: 'Peso corporal', local: 'casa_sem', comoFazer: '' };

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

describe('progressão de segundos (isométricos)', () => {
  // Prancha iniciante → faixa de segundos 20–40 (cofre §Faixas por nível).
  const p = prescrever({ objetivo: 'saude', nivelExperiencia: 'iniciante' });
  function hold(over: Partial<EstadoExercicio> = {}): EstadoExercicio {
    return { exercicioId: 'e7', modo: 'peso_corporal', series: p.seriesPorExercicio.min, repsAlvo: 20, variacaoNivel: 0, rirAlvo: p.rir.min, dificeisSeguidos: 0, ...over };
  }

  it('na medida → +5 s dentro da faixa (não +1)', () => {
    expect(progredirExercicio(hold({ repsAlvo: 20 }), 'na_medida', p, prancha).proximo.repsAlvo).toBe(25);
    expect(progredirExercicio(hold({ repsAlvo: 30 }), 'na_medida', p, prancha).proximo.repsAlvo).toBe(35);
  });

  it('na medida → nunca ultrapassa o teto da faixa (40 s)', () => {
    expect(progredirExercicio(hold({ repsAlvo: 38 }), 'na_medida', p, prancha).proximo.repsAlvo).toBe(40);
    expect(progredirExercicio(hold({ repsAlvo: 40 }), 'na_medida', p, prancha).proximo.repsAlvo).toBe(40);
  });

  it('fácil → +1 série até o teto, depois sobe modificação e reseta ao piso (20 s)', () => {
    const r1 = progredirExercicio(hold({ series: p.seriesPorExercicio.min }), 'facil', p, prancha);
    expect(r1.proximo.series).toBe(p.seriesPorExercicio.min + 1);
    const r2 = progredirExercicio(hold({ series: p.seriesPorExercicio.max, repsAlvo: 40, variacaoNivel: 0 }), 'facil', p, prancha);
    expect(r2.proximo.variacaoNivel).toBe(1);
    expect(r2.proximo.series).toBe(p.seriesPorExercicio.min);
    expect(r2.proximo.repsAlvo).toBe(20); // reset ao piso da faixa de segundos
  });

  it('difícil 2× → −5 s (piso da faixa); se furaria, desce 1 modificação', () => {
    const r1 = progredirExercicio(hold({ repsAlvo: 30 }), 'dificil', p, prancha);
    expect(r1.proximo.dificeisSeguidos).toBe(1);
    const r2 = progredirExercicio(r1.proximo, 'dificil', p, prancha);
    expect(r2.proximo.repsAlvo).toBe(25); // 30 − 5
    // perto do piso: 22 − 5 = 17 < 20 → desce modificação, volta ao teto
    const d1 = progredirExercicio(hold({ repsAlvo: 22 }), 'dificil', p, prancha);
    const d2 = progredirExercicio(d1.proximo, 'dificil', p, prancha);
    expect(d2.proximo.variacaoNivel).toBe(0); // max(0, 0−1)
    expect(d2.proximo.repsAlvo).toBe(40); // reconstrói do teto
  });
});

describe('estadoAposHistorico (dobra pura sobre o histórico)', () => {
  const p = prescrever({ objetivo: 'saude', nivelExperiencia: 'iniciante' });

  it('sem eventos → estado inicial (alvo no piso da faixa)', () => {
    const { estado, ultimaAcao } = estadoAposHistorico(prancha, p, []);
    expect(estado).toEqual(estadoInicial(prancha, p));
    expect(estado.repsAlvo).toBe(20); // piso da faixa de segundos
    expect(ultimaAcao).toBeNull();
  });

  it('hold: dois "na medida" sobem o alvo 20 → 25 → 30 s', () => {
    const { estado } = estadoAposHistorico(prancha, p, [{ fb: 'na_medida' }, { fb: 'na_medida' }]);
    expect(estado.repsAlvo).toBe(30);
  });

  it('carga: "fácil" sugere +2,5% a partir da carga LOGADA (base = o que levantou)', () => {
    const { estado } = estadoAposHistorico(supino, p, [{ fb: 'facil', cargaMaxKg: 40 }]);
    expect(estado.cargaKg).toBeCloseTo(41, 3); // 40 × 1,025
    expect(estado.repsAlvo).toBe(p.repsComposto.min); // reset ao piso de reps
  });

  it('carga sem base logada → não sugere carga (cargaKg indefinida, nunca 0)', () => {
    const { estado } = estadoAposHistorico(supino, p, [{ fb: 'facil' }]);
    expect(estado.cargaKg).toBeUndefined();
  });
});

describe('deload', () => {
  it('agendado a cada 6 semanas p/ TODOS os níveis (mesociclo universal, v2 DF 2026-07-08); reativo imediato', () => {
    expect(precisaDeload({ nivel: 'intermediario', semanasDesdeUltimoDeload: 6, sinaisFadiga: false })).toBe(true);
    expect(precisaDeload({ nivel: 'intermediario', semanasDesdeUltimoDeload: 3, sinaisFadiga: false })).toBe(false);
    expect(precisaDeload({ nivel: 'iniciante', semanasDesdeUltimoDeload: 6, sinaisFadiga: false })).toBe(true); // v2: universal
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

// ── Modo força (v2 §4, DF 2026-07-08): preset opt-in interm./avançado ─────────
describe('modo força (preset opt-in)', () => {
  it('interm./avançado: compostos travam em 6–6; isolados mantêm a faixa v1', () => {
    const p = prescrever({ objetivo: 'massa', nivelExperiencia: 'avancado', modoForca: true });
    expect(p.modoForca).toBe(true);
    expect(p.repsComposto).toEqual({ min: 6, max: 6 });
    expect(p.repsIsolado).toEqual({ min: 8, max: 15 }); // decisão 2026-07-08: só compostos
  });

  it('iniciante NÃO acessa: flag ignorado, faixa e RIR ≥ 2 do v1 intactos', () => {
    const p = prescrever({ objetivo: 'massa', nivelExperiencia: 'iniciante', modoForca: true });
    expect(p.modoForca).toBeUndefined();
    expect(p.repsComposto).toEqual({ min: 6, max: 12 });
    expect(p.rir.min).toBe(2);
  });

  it('progride SÓ por carga: fácil → +carga com reps de volta a 6; nunca < 6 nem > 6', () => {
    const p = prescrever({ objetivo: 'massa', nivelExperiencia: 'avancado', modoForca: true });
    const e: EstadoExercicio = { exercicioId: 'e_sup', modo: 'carga', series: 3, repsAlvo: 6, cargaKg: 100, rirAlvo: 1, dificeisSeguidos: 0 };
    const facil = progredirExercicio(e, 'facil', p, supino);
    expect(facil.proximo.cargaKg).toBeCloseTo(102.5, 3);
    expect(facil.proximo.repsAlvo).toBe(6);
    const dificil2 = progredirExercicio({ ...e, dificeisSeguidos: 1 }, 'dificil', p, supino);
    expect(dificil2.proximo.cargaKg).toBeCloseTo(90, 3); // −10%, reps seguem em 6
    expect(dificil2.proximo.repsAlvo).toBe(6);
    expect(estadoInicial(supino, p).repsAlvo).toBe(6);
  });
});

// ── Autorregulação por RIR numérico (v2 §3): refina o gatilho, trilhos intactos ──
describe('feedbackRefinado (RIR numérico por série)', () => {
  const faixa = { min: 6, max: 12 };

  it('reps > topo E RIR > alvo → fácil (+carga)', () => {
    expect(feedbackRefinado({ fb: 'na_medida', faixa, rirAlvo: 2, repsMax: 13, rirMin: 3 })).toBe('facil');
  });

  it('reps < piso OU RIR < alvo → difícil (segura/−carga com pisos)', () => {
    expect(feedbackRefinado({ fb: 'na_medida', faixa, rirAlvo: 2, repsMax: 5, rirMin: 3 })).toBe('dificil');
    expect(feedbackRefinado({ fb: 'facil', faixa, rirAlvo: 2, repsMax: 10, rirMin: 1 })).toBe('dificil');
  });

  it('sem registro numérico (ou dentro da faixa/alvo) → mantém o feedback qualitativo', () => {
    expect(feedbackRefinado({ fb: 'na_medida', faixa, rirAlvo: 2 })).toBe('na_medida');
    expect(feedbackRefinado({ fb: 'dificil', faixa, rirAlvo: 2, repsMax: 10, rirMin: 2 })).toBe('dificil');
    expect(feedbackRefinado({ fb: 'facil', faixa, rirAlvo: 2, repsMax: 13 })).toBe('facil'); // só reps, sem RIR → não infere +carga
  });

  it('modo força (faixa 6–6): as 6 saem NO RIR-alvo (≥) → fácil (+carga → 6RM)', () => {
    const f6 = { min: 6, max: 6 };
    expect(feedbackRefinado({ fb: 'na_medida', faixa: f6, rirAlvo: 1, repsMax: 6, rirMin: 1, modoForca: true })).toBe('facil');
    expect(feedbackRefinado({ fb: 'na_medida', faixa: f6, rirAlvo: 1, repsMax: 6, rirMin: 0, modoForca: true })).toBe('dificil'); // abaixo do alvo
    expect(feedbackRefinado({ fb: 'na_medida', faixa: f6, rirAlvo: 1, repsMax: 6, rirMin: 1 })).toBe('na_medida'); // sem o preset, 6 no alvo não infere
  });
});

// ── Calibração manual (B2 — DF 2026-07-04): evento no histórico re-semeia a base ──
describe('estadoAposHistorico — evento de calibração (cofre DF #11/#13)', () => {
  it('carga: {cargaKg 20, reps 8} re-semeia e zera dificeisSeguidos; próximo "fácil" progride DA nova base', () => {
    const p = prescrever();
    const r = estadoAposHistorico(supino, p, [
      { fb: 'dificil' }, // 1º difícil → dificeisSeguidos = 1
      { tipo: 'calibracao', cargaKg: 20, reps: 8 },
    ]);
    expect(r.estado.cargaKg).toBe(20);
    expect(r.estado.repsAlvo).toBe(8);
    expect(r.estado.dificeisSeguidos).toBe(0); // salvaguarda travada
    expect(r.ultimaAcao).toBe('recalibrado (base manual)');
    // próximo "fácil" parte da base calibrada: +2,5% de 20 = 20,5 kg, reps ao piso (6)
    const r2 = estadoAposHistorico(supino, p, [
      { tipo: 'calibracao', cargaKg: 20, reps: 8 },
      { fb: 'facil' },
    ]);
    expect(r2.estado.cargaKg).toBe(20.5);
    expect(r2.estado.repsAlvo).toBe(6);
    expect(r2.ultimaAcao).not.toBe('recalibrado (base manual)'); // B7: hint se consome
  });

  it('carga: clamp defensivo — iniciante nunca abaixo de 6; demais nunca abaixo de 5 (pisos travados)', () => {
    const pIni = prescrever({ nivelExperiencia: 'iniciante' });
    const rIni = estadoAposHistorico(supino, pIni, [{ tipo: 'calibracao', cargaKg: 30, reps: 3 }]);
    expect(rIni.estado.repsAlvo).toBe(6); // PISO_REPS_COM_CARGA
    const pInt = prescrever({ nivelExperiencia: 'intermediario' });
    const rInt = estadoAposHistorico(supino, pInt, [{ tipo: 'calibracao', cargaKg: 30, reps: 3 }]);
    expect(rInt.estado.repsAlvo).toBe(5); // PISO_ABSOLUTO_REPS
  });

  it('isométrico: {modificacaoIdx, segundos} re-semeia segundos (piso 10 s) + offset da base', () => {
    const p = prescrever({ nivelExperiencia: 'iniciante', equipamento: 'nenhum' });
    const r = estadoAposHistorico(prancha, p, [{ tipo: 'calibracao', modificacaoIdx: 3, segundos: 30 }]);
    expect(r.estado.repsAlvo).toBe(30);
    // base da Prancha = idx 2 ("Prancha padrão"); idx 3 ("Pés elevados") → offset +1
    expect(r.estado.variacaoNivel).toBe(1);
    expect(r.estado.series).toBe(p.seriesPorExercicio.min);
    const rPiso = estadoAposHistorico(prancha, p, [{ tipo: 'calibracao', modificacaoIdx: 2, segundos: 4 }]);
    expect(rPiso.estado.repsAlvo).toBe(10); // PISO_HOLD_SEG
  });

  it('peso corporal: {degrauId, reps} re-semeia reps e séries ao piso; zera streak de difícil', () => {
    const p = prescrever({ nivelExperiencia: 'iniciante', equipamento: 'nenhum' });
    const r = estadoAposHistorico(agacho, p, [
      { fb: 'dificil' },
      { tipo: 'calibracao', degrauId: 'e78', reps: 6 },
    ]);
    expect(r.estado.repsAlvo).toBe(6);
    expect(r.estado.series).toBe(p.seriesPorExercicio.min);
    expect(r.estado.dificeisSeguidos).toBe(0);
  });

  it('fixture legado (só eventos de treino) → comportamento byte-idêntico ao anterior', () => {
    const p = prescrever();
    const antes = estadoAposHistorico(supino, p, [{ fb: 'facil', cargaMaxKg: 40 }, { fb: 'na_medida' }]);
    expect(antes.estado.cargaKg).toBe(41); // +2,5% de 40 (regressão do Bloco B)
    expect(antes.ultimaAcao).toBe('repete (consolida)');
  });
});
