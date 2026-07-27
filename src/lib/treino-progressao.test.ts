import { describe, expect, it } from 'vitest';
import { avaliarGateTreino, prescreverTreino } from '@/lib/engine';
import type { Exercise } from '@/lib/data/types';
import type { PerfilTreino } from '@/lib/engine';
import type { SessaoHistorico } from '@/lib/treino-historico';
import { sessoesResistidas, sessoesTreino } from '@/lib/treino-historico';
import { semanaDoCiclo } from '@/lib/engine';
import { exercicioEfetivo, exerciciosRecentes, feedbackAgregadoPorGrupo, precisaDeloadDoHistorico, progressoDosExercicios, retomadaDoHistorico, sinaisFadigaDoHistorico } from './treino-progressao';
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

  it('agendado: a cada 6 semanas (42 dias) desde a 1ª sessão — TODOS os níveis (v2 universal, DF 2026-07-08)', () => {
    const hist = [recente('na_medida', '2026-06-20')]; // 42 dias antes de 2026-08-01
    expect(precisaDeloadDoHistorico(hist, 'intermediario', '2026-08-01')).toBe(true);
    // v2: o mesociclo é universal — iniciante também deloada no agendado
    expect(precisaDeloadDoHistorico(hist, 'iniciante', '2026-08-01')).toBe(true);
  });

  it('sem fadiga e fora da semana agendada → sem alívio; histórico vazio → false', () => {
    expect(precisaDeloadDoHistorico([recente('na_medida', '2026-07-01')], 'intermediario', '2026-07-08')).toBe(false);
    expect(precisaDeloadDoHistorico([], 'intermediario', '2026-07-08')).toBe(false);
  });

  it('salvaguarda B2: calibração NÃO ancora o deload agendado (filtrar via sessoesTreino)', () => {
    // Calibração no dia 06-20 (42 dias antes de 08-01) + 1ª sessão REAL no 06-23 (39 dias).
    const hist = [
      recente('na_medida', '2026-06-23'),
      sessaoCalibracao('2026-06-20', [{ id: 'e_sup', calibracao: { reps: 10 } }]),
    ];
    // Cru → âncora na calibração (6 semanas) dispararia; filtrado → âncora na 1ª sessão (5 semanas) não.
    expect(precisaDeloadDoHistorico(hist, 'intermediario', '2026-08-01')).toBe(true);
    expect(precisaDeloadDoHistorico(sessoesTreino(hist), 'intermediario', '2026-08-01')).toBe(false);
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

// ── v2 (DF 2026-07-08): autorregulação por RIR + fadiga + agregação por grupo ──
describe('autorregulação por RIR numérico no fold (v2 §3)', () => {
  const p = prescricao({ nivelExperiencia: 'intermediario', objetivo: 'massa' }); // composto 6–12, rir.min 1

  function sessaoRir(dataISO: string, fb: 'facil' | 'na_medida' | 'dificil', sets: { reps: string; kg: string; rir?: string }[], rirAlvo?: number): SessaoHistorico {
    seq += 1;
    return {
      dia: 'Treino', series: sets.length, volumeKg: 0, feedback: { e_sup: fb }, n: seq, dataISO,
      ...(rirAlvo != null ? { rirAlvo } : {}),
      exercicios: [{ id: 'e_sup', nome: 'Supino', loaded: true, fb, sets }],
    };
  }

  it('reps acima do topo + RIR acima do alvo refinam "na medida" → +carga', () => {
    // 13 reps (topo 12) com RIR 3 (alvo 2) → 'facil' → +2,5% da carga logada (40 → 41)
    const hist = [sessaoRir('2026-07-01', 'na_medida', [{ reps: '13', kg: '40', rir: '3' }], 2)];
    const prog = progressoDosExercicios(hist, p, byId);
    expect(prog.e_sup!.estado.cargaKg).toBeCloseTo(41, 3);
  });

  it('RIR abaixo do alvo refina "na medida" → difícil (1ª segura; pisos respeitados)', () => {
    const hist = [sessaoRir('2026-07-01', 'na_medida', [{ reps: '8', kg: '40', rir: '0' }], 2)];
    const prog = progressoDosExercicios(hist, p, byId);
    expect(prog.e_sup!.estado.dificeisSeguidos).toBe(1); // 1º difícil → segura
    expect(prog.e_sup!.estado.repsAlvo).toBeGreaterThanOrEqual(6); // piso intacto
  });

  it('sem RIR numérico o feedback qualitativo segue mandando (retrocompat)', () => {
    const hist = [sessaoRir('2026-07-01', 'na_medida', [{ reps: '10', kg: '40' }])];
    const prog = progressoDosExercicios(hist, p, byId);
    expect(prog.e_sup!.estado.cargaKg).toBe(40); // consolida, sem +carga
    expect(prog.e_sup!.estado.dificeisSeguidos).toBe(0);
  });
});

describe('sinaisFadigaDoHistorico + sinal_fadiga (v2 §2)', () => {
  it('botão de fadiga (tipo sinal_fadiga) nos últimos 7 dias dispara o sinal reativo', () => {
    const fadiga: SessaoHistorico = { dia: 'Sinal de fadiga', series: 0, volumeKg: 0, feedback: {}, exercicios: [], n: 999, dataISO: '2026-07-05', tipo: 'sinal_fadiga' };
    expect(sinaisFadigaDoHistorico([fadiga], '2026-07-08')).toBe(true);
    expect(sinaisFadigaDoHistorico([fadiga], '2026-07-20')).toBe(false); // sinal antigo (> 7 d) não conta
  });

  it('sinal_fadiga NÃO conta como dia de treino (fora de sessoesTreino)', () => {
    const fadiga: SessaoHistorico = { dia: 'Sinal de fadiga', series: 0, volumeKg: 0, feedback: {}, exercicios: [], n: 999, dataISO: '2026-07-05', tipo: 'sinal_fadiga' };
    const treino = sessao('2026-07-04', [{ id: 'e_sup', fb: 'na_medida' }]);
    expect(sessoesTreino([fadiga, treino])).toEqual([treino]);
  });

  it('≥3 "difícil" em ~2 semanas segue disparando (regra do v1 preservada)', () => {
    const hist = [sessao('2026-07-01', [{ id: 'e_sup', fb: 'dificil' }]), sessao('2026-06-30', [{ id: 'e7', fb: 'dificil' }]), sessao('2026-06-29', [{ id: 'e_sup', fb: 'dificil' }])];
    expect(sinaisFadigaDoHistorico(hist, '2026-07-03')).toBe(true);
    expect(sinaisFadigaDoHistorico(hist.slice(0, 2), '2026-07-03')).toBe(false);
  });
});

describe('feedbackAgregadoPorGrupo (v2 §6)', () => {
  it("≥2 'difícil' no MESMO grupo em ≤7 dias → 'segura'; 1 só → ausente ('ok')", () => {
    const hist = [sessao('2026-07-07', [{ id: 'e_sup', fb: 'dificil' }]), sessao('2026-07-05', [{ id: 'e_sup', fb: 'dificil' }, { id: 'e7', fb: 'dificil' }])];
    const m = feedbackAgregadoPorGrupo(hist, '2026-07-08', byId);
    expect(m.get('peito')).toBe('segura'); // supino 2× difícil
    expect(m.get('core')).toBeUndefined(); // prancha 1× só
  });

  it("'difícil' há mais de 7 dias não conta (janela = semana corrente do ciclo)", () => {
    const hist = [sessao('2026-06-25', [{ id: 'e_sup', fb: 'dificil' }]), sessao('2026-06-24', [{ id: 'e_sup', fb: 'dificil' }])];
    expect(feedbackAgregadoPorGrupo(hist, '2026-07-08', byId).size).toBe(0);
  });

  it('determinístico com hojeISO injetado; entradas de evento (calibração/fadiga) ficam fora', () => {
    const fadiga: SessaoHistorico = { dia: 'Sinal de fadiga', series: 0, volumeKg: 0, feedback: { e_sup: 'dificil' }, exercicios: [], n: 998, dataISO: '2026-07-07', tipo: 'sinal_fadiga' };
    const hist = [fadiga, sessao('2026-07-06', [{ id: 'e_sup', fb: 'dificil' }])];
    const a = feedbackAgregadoPorGrupo(hist, '2026-07-08', byId);
    const b = feedbackAgregadoPorGrupo(hist, '2026-07-08', byId);
    expect([...a.entries()]).toEqual([...b.entries()]);
    expect(a.get('peito')).toBeUndefined(); // só 1 difícil de sessão real
  });
});

// ── Leva 1B (DF 2026-07-26): a evidência anterior à âncora não conta ──────────
describe('sinaisFadigaDoHistorico com `desde` — impede o alívio reativo de se re-disparar', () => {
  const fadigaEm = (dataISO: string): SessaoHistorico => ({
    dia: 'Sinal de fadiga', series: 0, volumeKg: 0, feedback: {}, exercicios: [], n: 900, dataISO, tipo: 'sinal_fadiga',
  });

  it('🔴 loop: o sinal que disparou o alívio NÃO re-dispara outro quando ele termina', () => {
    // Sinal no dia 0 → alívio de 7 dias → âncora nova = dia 7 (fim do alívio).
    const hist = [fadigaEm('2026-07-01')];
    // Sem o corte, no dia 7 o sinal ainda está na janela de 7 dias → alívio eterno.
    expect(sinaisFadigaDoHistorico(hist, '2026-07-08')).toBe(true);
    // Com a âncora do fim do alívio como corte, ele para de contar.
    expect(sinaisFadigaDoHistorico(hist, '2026-07-08', '2026-07-08')).toBe(false);
  });

  it('mesmo corte vale para os "difícil" da janela de 14 dias', () => {
    const hist = [
      sessao('2026-07-01', [{ id: 'e_sup', fb: 'dificil' }]),
      sessao('2026-07-02', [{ id: 'e_sup', fb: 'dificil' }]),
      sessao('2026-07-03', [{ id: 'e_sup', fb: 'dificil' }]),
    ];
    expect(sinaisFadigaDoHistorico(hist, '2026-07-05')).toBe(true);
    expect(sinaisFadigaDoHistorico(hist, '2026-07-05', '2026-07-04')).toBe(false);
  });

  it('evidência POSTERIOR à âncora continua valendo (o gatilho não morre)', () => {
    const hist = [fadigaEm('2026-07-10')];
    expect(sinaisFadigaDoHistorico(hist, '2026-07-12', '2026-07-08')).toBe(true);
  });

  it('âncora mais antiga que a janela não alarga a janela (14 d continua o teto)', () => {
    const hist = [sessao('2026-06-01', [{ id: 'e_sup', fb: 'dificil' }]),
      sessao('2026-06-02', [{ id: 'e_sup', fb: 'dificil' }]),
      sessao('2026-06-03', [{ id: 'e_sup', fb: 'dificil' }])];
    expect(sinaisFadigaDoHistorico(hist, '2026-07-05', '2026-01-01')).toBe(false);
  });
});

describe('sessão MANUAL move o relógio igual à guiada (DF 2026-07-02)', () => {
  it('sessoesTreino preserva manual:true → a data chega em semanaDoCiclo', () => {
    const manual = { ...sessao('2026-01-06', [{ id: 'e_sup', fb: 'na_medida' }]), manual: true };
    const datas = sessoesTreino([manual]).map((s) => s.dataISO);
    expect(datas).toEqual(['2026-01-06']);
    // âncora 2026-01-05: a sessão cai no bucket 0 → na semana seguinte o ciclo está na 2.
    expect(semanaDoCiclo('2026-01-05', '2026-01-13', datas)).toBe(2);
  });
});

// ── Leva 2 · Bloco 3: rampa derivada + cardio não move o relógio ─────────────
describe('retomadaDoHistorico — derivada, e o CARDIO não encerra a pausa', () => {
  const treino = (dataISO: string): SessaoHistorico => sessao(dataISO, [{ id: 'e_sup', fb: 'na_medida' }]);
  const cardioEm = (dataISO: string): SessaoHistorico => ({
    dia: 'Cardio', series: 0, volumeKg: 0, feedback: {}, exercicios: [], n: 800, dataISO, tipo: 'cardio',
  });

  it('pausa de 30 dias → rampa curta; ≤ 14 dias → nada', () => {
    expect(retomadaDoHistorico([treino('2026-06-27')], '2026-07-27')?.faixa).toBe('curta');
    expect(retomadaDoHistorico([treino('2026-07-20')], '2026-07-27')).toBeNull();
  });

  it('🔴 quem passou 3 semanas SÓ pedalando ainda entra na rampa', () => {
    const hist = [treino('2026-06-27'), cardioEm('2026-07-10'), cardioEm('2026-07-20')];
    const r = retomadaDoHistorico(hist, '2026-07-27');
    expect(r?.ativa).toBe(true);
    expect(r?.faixa).toBe('curta'); // o cardio não zerou a contagem
  });

  it('🔴 cardio NÃO entra no balde do relógio do mesociclo (protege o fix 9ebf1bd)', () => {
    const hist = [treino('2026-01-05'), cardioEm('2026-01-06'), cardioEm('2026-01-08')];
    // resistidas = só o treino → a semana do ciclo não anda com pedalada
    expect(sessoesResistidas(hist).map((s) => s.dataISO)).toEqual(['2026-01-05']);
    const semCardio = semanaDoCiclo('2026-01-05', '2026-01-13', ['2026-01-05']);
    const comCardio = semanaDoCiclo('2026-01-05', '2026-01-13', sessoesResistidas(hist).map((s) => s.dataISO));
    expect(comCardio).toBe(semCardio);
  });

  it('mas o cardio CONTA como dia de treino (Chama) — sessoesTreino o inclui', () => {
    const hist = [treino('2026-01-05'), cardioEm('2026-01-06')];
    expect(sessoesTreino(hist)).toHaveLength(2);
  });

  it('exerciciosRecentes alimenta a suspensão da B5 com o que a pessoa já fazia', () => {
    const hist = [treino('2026-06-20'), treino('2026-06-22')];
    expect([...exerciciosRecentes(hist)]).toEqual(['e_sup']);
  });
});
