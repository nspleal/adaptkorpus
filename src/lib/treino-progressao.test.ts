import { describe, expect, it } from 'vitest';
import { avaliarGateTreino, prescreverTreino } from '@/lib/engine';
import type { Exercise } from '@/lib/data/types';
import type { PerfilTreino } from '@/lib/engine';
import type { SessaoHistorico } from '@/lib/treino-historico';
import { exercicioEfetivo, precisaDeloadDoHistorico, progressoDosExercicios } from './treino-progressao';
import { EXERCISES } from '@/lib/data/exercises';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({ pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'saude', nivelExperiencia: 'iniciante', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60, ...over });
const prescricao = (over: Partial<PerfilTreino> = {}) => { const p = perfil(over); return prescreverTreino(p, avaliarGateTreino(p)); };

const prancha: Exercise = { id: 'e7', nomePt: 'Prancha', grupoMuscular: 'core', grupoPrimario: 'core', padraoMovimento: 'core', nivel: 'iniciante', tipo: 'forca_hipertrofia', equipamento: 'nenhum', equipamentoDetalhe: 'Peso corporal', local: 'casa_sem', comoFazer: '' };
const supino: Exercise = { id: 'e_sup', nomePt: 'Supino', grupoMuscular: 'peito', grupoPrimario: 'peito', padraoMovimento: 'empurrar', nivel: 'iniciante', tipo: 'forca_hipertrofia', equipamento: 'academia', equipamentoDetalhe: 'Barra', local: 'academia', comoFazer: '' };
const byId = (id: string) => ({ e7: prancha, e_sup: supino }[id]);

let seq = 0;
function sessao(dataISO: string, exs: { id: string; fb: 'facil' | 'na_medida' | 'dificil'; kg?: string }[], manual = false): SessaoHistorico {
  seq += 1;
  const feedback = Object.fromEntries(exs.map((e) => [e.id, e.fb]));
  return {
    dia: 'Treino', series: exs.length, volumeKg: 0, feedback, n: seq, dataISO, ...(manual ? { manual: true } : {}),
    exercicios: exs.map((e) => ({ id: e.id, nome: e.id, loaded: e.kg != null, fb: e.fb, sets: [{ reps: '10', kg: e.kg ?? '' }] })),
  };
}

describe('progressoDosExercicios (deriva o alvo do histórico)', () => {
  const p = prescricao({ nivelExperiencia: 'iniciante' }); // Prancha faixa 20–40 s

  it('hold: dois "na medida" (guiada + manual) sobem o alvo 20 → 30 s', () => {
    // histórico mais-recente-primeiro (como lerHistorico devolve) e datas fora de ordem
    const hist = [sessao('2026-07-02', [{ id: 'e7', fb: 'na_medida' }], true), sessao('2026-07-01', [{ id: 'e7', fb: 'na_medida' }])];
    const prog = progressoDosExercicios(hist, p, byId);
    expect(prog.e7!.estado.repsAlvo).toBe(30);
    expect(prog.e7!.ultimaAcao).toMatch(/\+5 s/);
  });

  it('carga: "fácil" sugere +2,5% da carga LOGADA', () => {
    const hist = [sessao('2026-07-01', [{ id: 'e_sup', fb: 'facil', kg: '40' }])];
    const prog = progressoDosExercicios(hist, p, byId);
    expect(prog.e_sup!.estado.cargaKg).toBeCloseTo(41, 3);
  });

  it('ordem cronológica real, não ordem de inserção', () => {
    // sessão mais nova primeiro na lista, mas "na medida" acontece DEPOIS do "difícil"
    const hist = [sessao('2026-07-05', [{ id: 'e7', fb: 'na_medida' }]), sessao('2026-07-01', [{ id: 'e7', fb: 'dificil' }])];
    const prog = progressoDosExercicios(hist, p, byId);
    // difícil (1ª, segura) → depois na medida (+5): 20 → 25
    expect(prog.e7!.estado.repsAlvo).toBe(25);
  });

  it('exercício personalizado (id vazio) é ignorado', () => {
    const hist = [sessao('2026-07-01', [{ id: '', fb: 'facil' }])];
    expect(progressoDosExercicios(hist, p, byId)).toEqual({});
  });

  it('escada: com exercises+equipamento, popula proximaVariacao (e7 Prancha → e146)', () => {
    const hist = [sessao('2026-07-01', [{ id: 'e7', fb: 'na_medida' }])];
    const resolver = (id: string) => EXERCISES.find((e) => e.id === id);
    const prog = progressoDosExercicios(hist, p, resolver, EXERCISES, 'casa');
    expect(prog.e7!.proximaVariacao).toEqual({ id: 'e146', nome: 'Prancha com toque no ombro' });
  });

  it('escada respeita equipamento: e116 → chin-up (barra) some p/ casa-sem', () => {
    const hist = [sessao('2026-07-01', [{ id: 'e116', fb: 'na_medida' }])];
    const resolver = (id: string) => EXERCISES.find((e) => e.id === id);
    expect(progressoDosExercicios(hist, p, resolver, EXERCISES, 'nenhum').e116!.proximaVariacao).toBeNull();
    expect(progressoDosExercicios(hist, p, resolver, EXERCISES, 'casa').e116!.proximaVariacao).toEqual({ id: 'e22', nome: 'Barra fixa supinada (chin-up)' });
  });

  it('sem exercises/equipamento → proximaVariacao ausente (retrocompat)', () => {
    const hist = [sessao('2026-07-01', [{ id: 'e7', fb: 'na_medida' }])];
    expect(progressoDosExercicios(hist, p, byId).e7!.proximaVariacao ?? null).toBeNull();
  });
});

describe('precisaDeloadDoHistorico', () => {
  const recente = (fb: 'dificil' | 'na_medida', dataISO: string) => sessao(dataISO, [{ id: 'e_sup', fb }]);

  it('reativo: ≥3 "difícil" nas últimas ~2 semanas → alívio (qualquer nível)', () => {
    const hist = [recente('dificil', '2026-07-01'), recente('dificil', '2026-06-30'), recente('dificil', '2026-06-29')];
    expect(precisaDeloadDoHistorico(hist, 'iniciante', '2026-07-03')).toBe(true);
  });

  it('agendado: intermediário a cada 6 semanas (42 dias) desde a 1ª sessão', () => {
    const hist = [recente('na_medida', '2026-06-20')]; // 42 dias antes de 2026-08-01
    expect(precisaDeloadDoHistorico(hist, 'intermediario', '2026-08-01')).toBe(true);
    // iniciante nunca é agendado (só reativo)
    expect(precisaDeloadDoHistorico(hist, 'iniciante', '2026-08-01')).toBe(false);
  });

  it('sem fadiga e fora da semana agendada → sem alívio; histórico vazio → false', () => {
    expect(precisaDeloadDoHistorico([recente('na_medida', '2026-07-01')], 'intermediario', '2026-07-08')).toBe(false);
    expect(precisaDeloadDoHistorico([], 'intermediario', '2026-07-08')).toBe(false);
  });
});

// ── Calibração (B2/B3/B7) + descida (V8.3) — DF 2026-07-04 ──────────────────
function sessaoCalibracao(dataISO: string, exs: { id: string; calibracao: NonNullable<SessaoHistorico['exercicios'][number]['calibracao']> }[]): SessaoHistorico {
  seq += 1;
  return {
    dia: 'Calibração manual', series: 0, volumeKg: 0, feedback: {}, n: seq, dataISO, tipo: 'calibracao',
    exercicios: exs.map((e) => ({ id: e.id, nome: e.id, loaded: false, fb: null, sets: [], calibracao: e.calibracao })),
  };
}

describe('calibração no adaptador (B2 — evento no histórico)', () => {
  const p = prescricao({ nivelExperiencia: 'intermediario' });
  const resolver = (id: string) => EXERCISES.find((e) => e.id === id);

  it('sessão calibração re-semeia a base; recalibrado=true (B7); some após o próximo feedback', () => {
    const hist1 = [sessaoCalibracao('2026-07-02', [{ id: 'e_sup', calibracao: { cargaKg: 22, reps: 8 } }])];
    const prog1 = progressoDosExercicios(hist1, p, byId);
    expect(prog1.e_sup!.estado.cargaKg).toBe(22);
    expect(prog1.e_sup!.estado.repsAlvo).toBe(8);
    expect(prog1.e_sup!.recalibrado).toBe(true);
    // treino DEPOIS da calibração → hint consumido (derivado)
    const hist2 = [sessao('2026-07-03', [{ id: 'e_sup', fb: 'na_medida' }]), ...hist1];
    const prog2 = progressoDosExercicios(hist2, p, byId);
    expect(prog2.e_sup!.recalibrado).toBe(false);
  });

  it('ordem cronológica: calibração entre dois treinos entra no lugar certo', () => {
    // difícil (01) → calibração 20kg (02) → fácil (03): fácil parte de 20 → 20,5
    const hist = [
      sessao('2026-07-03', [{ id: 'e_sup', fb: 'facil' }]),
      sessaoCalibracao('2026-07-02', [{ id: 'e_sup', calibracao: { cargaKg: 20, reps: 8 } }]),
      sessao('2026-07-01', [{ id: 'e_sup', fb: 'dificil' }]),
    ];
    const prog = progressoDosExercicios(hist, p, byId);
    expect(prog.e_sup!.estado.cargaKg).toBe(20.5);
  });

  it('degrauId → degrauAdotadoId + exercicioEfetivo (overlay B3) + hints ancorados no efetivo', () => {
    const pIni = prescricao({ nivelExperiencia: 'iniciante', equipamento: 'nenhum' });
    // e1 Flexão: assume o degrau e113 (Diamante) — PODE exceder a dificuldade liberada (anti-"conserto")
    const hist = [sessaoCalibracao('2026-07-01', [{ id: 'e1', calibracao: { degrauId: 'e113', reps: 6 } }])];
    const prog = progressoDosExercicios(hist, pIni, resolver, EXERCISES, 'nenhum');
    expect(prog.e1!.degrauAdotadoId).toBe('e113');
    expect(exercicioEfetivo('e1', prog, resolver)!.id).toBe('e113');
    expect(exercicioEfetivo('e1', prog, resolver)!.nomePt).toBe('Flexão diamante');
    // hint de subida agora parte do e113 → próximo degrau = e2 (pés elevados)
    expect(prog.e1!.proximaVariacao).toEqual({ id: 'e2', nome: 'Flexão com pés elevados' });
    // sem adoção → efetivo = planejado
    expect(exercicioEfetivo('e3', prog, resolver)!.id).toBe('e3');
  });

  it('entrada de calibração sem payload é inerte; entrada pausada sem fb não vira evento', () => {
    const semPayload: SessaoHistorico = { ...sessaoCalibracao('2026-07-01', []), exercicios: [{ id: 'e_sup', nome: 'Supino', loaded: false, fb: null, sets: [] }] };
    expect(progressoDosExercicios([semPayload], p, byId)).toEqual({});
    const pausada: SessaoHistorico = { ...sessao('2026-07-01', []), exercicios: [{ id: 'e_sup', nome: 'Supino', loaded: false, fb: null, sets: [], pausado: true }] };
    expect(progressoDosExercicios([pausada], p, byId)).toEqual({});
  });
});

describe('descida (V8.3 Estado 5) — sugereDescida + variacaoAnterior', () => {
  const resolver = (id: string) => EXERCISES.find((e) => e.id === id);
  const pIni = prescricao({ nivelExperiencia: 'iniciante', equipamento: 'nenhum' });

  it('2 "difícil" seguidos disparam a regressão → sugereDescida=true + degrau anterior', () => {
    // e78 Búlgaro (degrau 3 da escada agachar): −2 reps furaria o piso? faixa saúde 8–15,
    // alvo inicial 8 → 8−2=6 < 8 → regressão vira "desce 1 variação"... na prática qualquer
    // rótulo de regressão liga o gatilho; ancoramos o comportamento, não o rótulo exato.
    const hist = [
      sessao('2026-07-02', [{ id: 'e78', fb: 'dificil' }]),
      sessao('2026-07-01', [{ id: 'e78', fb: 'dificil' }]),
    ];
    const prog = progressoDosExercicios(hist, pIni, resolver, EXERCISES, 'nenhum');
    expect(prog.e78!.sugereDescida).toBe(true);
    expect(prog.e78!.variacaoAnterior).toEqual({ id: 'e16', nome: 'Afundo (avanço)' });
  });

  it('1 "difícil" só segura — sem descida; feedback seguinte limpa o gatilho', () => {
    const um = progressoDosExercicios([sessao('2026-07-01', [{ id: 'e78', fb: 'dificil' }])], pIni, resolver, EXERCISES, 'nenhum');
    expect(um.e78!.sugereDescida).toBe(false);
    const depois = progressoDosExercicios([
      sessao('2026-07-03', [{ id: 'e78', fb: 'na_medida' }]),
      sessao('2026-07-02', [{ id: 'e78', fb: 'dificil' }]),
      sessao('2026-07-01', [{ id: 'e78', fb: 'dificil' }]),
    ], pIni, resolver, EXERCISES, 'nenhum');
    expect(depois.e78!.sugereDescida).toBe(false);
  });

  it('base da escada (e3) → variacaoAnterior null (não há degrau abaixo)', () => {
    const hist = [sessao('2026-07-01', [{ id: 'e3', fb: 'na_medida' }])];
    const prog = progressoDosExercicios(hist, pIni, resolver, EXERCISES, 'nenhum');
    expect(prog.e3!.variacaoAnterior).toBeNull();
  });
});
