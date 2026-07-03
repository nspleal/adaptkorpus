import { describe, expect, it } from 'vitest';
import { avaliarGateTreino, prescreverTreino } from '@/lib/engine';
import type { Exercise } from '@/lib/data/types';
import type { PerfilTreino } from '@/lib/engine';
import type { SessaoHistorico } from '@/lib/treino-historico';
import { precisaDeloadDoHistorico, progressoDosExercicios } from './treino-progressao';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({ pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'saude', nivelExperiencia: 'iniciante', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60, ...over });
const prescricao = (over: Partial<PerfilTreino> = {}) => { const p = perfil(over); return prescreverTreino(p, avaliarGateTreino(p)); };

const prancha: Exercise = { id: 'e7', nomePt: 'Prancha', grupoMuscular: 'core', padraoMovimento: 'core', nivel: 'iniciante', tipo: 'forca_hipertrofia', equipamento: 'nenhum', equipamentoDetalhe: 'Peso corporal', local: 'casa_sem', comoFazer: '' };
const supino: Exercise = { id: 'e_sup', nomePt: 'Supino', grupoMuscular: 'peito', padraoMovimento: 'empurrar', nivel: 'iniciante', tipo: 'forca_hipertrofia', equipamento: 'academia', equipamentoDetalhe: 'Barra', local: 'academia', comoFazer: '' };
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
