import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import type { GrupoPrimario } from '../data/types';
import type { DiaTreino, SlotExercicio } from './treino-types';
import { adequarSessaoPorTempo, MINIMOS_TEMPO } from './adequacao-tempo-politica';

// Fixtures estruturais: identidades repetidas não são seleção do catálogo.
const slot = (grupo: GrupoPrimario, series = 4): SlotExercicio => ({
  exercicio: { ...EXERCISES.find(e => e.id === 'e9')!, grupoPrimario: grupo },
  padrao: 'isolado', series, descansoSeg: 180,
});
const dia = (slots: SlotExercicio[]): DiaTreino => ({ nome: 'Fixture', diaId: 'seg', slots });

describe('política por sessão, antes da integração ao montador', () => {
  it.each(['upper', 'lower', 'full-body'] as const)('%s mantém todos os mínimos e chega a uma série sem prometer caber', tipo => {
    const slots = Object.entries(MINIMOS_TEMPO[tipo]).flatMap(([g, n]) => Array.from({ length: n + 1 }, () => slot(g as GrupoPrimario)));
    const r = adequarSessaoPorTempo({ dia: dia(slots), nivel: 'iniciante', limiteSeg: 1, tipo, gruposObrigatorios: [], podeRetirar: () => true });
    for (const [g, n] of Object.entries(MINIMOS_TEMPO[tipo])) expect(r.dia.slots.filter(s => s.exercicio.grupoPrimario === g)).toHaveLength(n);
    expect(r.dia.slots.every(s => s.series === 1 && s.descansoSeg === 60)).toBe(true);
    expect(r.faltas).toEqual([]);
    expect(r.duracao.duracaoMaximaEstimadaSegundos).toBeGreaterThan(1);
  });
  it('segmentada usa regra B, preserva descansos e não aumenta séries menores que três', () => {
    const slots = [slot('peito', 2), ...Array.from({ length: 3 }, () => slot('peito')), ...Array.from({ length: 3 }, () => slot('triceps')), slot('core')];
    const r = adequarSessaoPorTempo({ dia: dia(slots), nivel: 'iniciante', limiteSeg: 1, tipo: 'segmentada', gruposObrigatorios: ['peito', 'triceps'], podeRetirar: () => true });
    expect(r.dia.slots.filter(s => s.exercicio.grupoPrimario === 'peito')).toHaveLength(2);
    expect(r.dia.slots.filter(s => s.exercicio.grupoPrimario === 'triceps')).toHaveLength(1);
    expect(r.dia.slots.every(s => s.series === 1 && s.descansoSeg === 180)).toBe(true);
    expect(r.removidos[0]!.exercicio.grupoPrimario).toBe('core');
    expect(r.series.every(s => s.para < s.de)).toBe(true);
  });
  it('não remove uma função protegida para chegar ao mínimo', () => {
    const r = adequarSessaoPorTempo({ dia: dia([slot('peito'), slot('peito'), slot('peito')]), nivel: 'iniciante', limiteSeg: 1, tipo: 'upper', gruposObrigatorios: [], podeRetirar: () => false });
    expect(r.dia.slots).toHaveLength(3);
    expect(r.faltas.map(f => f.grupo)).toEqual(['costas', 'ombros', 'biceps', 'triceps']);
  });
});
