import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { avaliarDuracaoResistida } from './duracao-plano';
import { adequarInicioFullUpperLower } from './adequacao-tempo-inicial';
import type { DiaTreino, SlotExercicio } from './treino-types';

const slot = (id: string): SlotExercicio => {
  const exercicio = EXERCISES.find(e => e.id === id)!;
  return { exercicio, padrao: exercicio.padraoMovimento, series: 3, descansoSeg: 180, holdSeg: 30 };
};
const dia = (...slots: SlotExercicio[]): DiaTreino => ({ nome: 'Upper', diaId: 'seg', slots });
const segundos = (d: DiaTreino) => avaliarDuracaoResistida(d.slots, 'iniciante').duracaoMaximaEstimadaSegundos!;

describe('decisão 20/09: descanso antes de complementares em FB/UL', () => {
  it('preserva o complementar quando reduzir descanso basta, sem alterar séries ou entrada', () => {
    const principal = slot('e9'), complementar = slot('e4');
    const entrada = dia(principal, complementar), snapshot = structuredClone(entrada);
    const limite = segundos(dia(principal, { ...complementar, descansoSeg: 90 }));
    const r = adequarInicioFullUpperLower(entrada, 'iniciante', limite);
    expect(r.removidos).toEqual([]);
    expect(r.dia.slots).toEqual([principal, { ...complementar, descansoSeg: 90 }]);
    expect(segundos(r.dia)).toBe(limite);
    expect(entrada).toEqual(snapshot);
  });
  it('só retira o último complementar depois de esgotar descansos, parando quando couber', () => {
    const a = slot('e9'), b = slot('e4'), c = slot('e73');
    const noPiso = [a, b].map(s => ({ ...s, descansoSeg: 60 }));
    const r = adequarInicioFullUpperLower(dia(a, b, c), 'iniciante', segundos(dia(...noPiso)));
    expect(r.removidos.map(s => s.exercicio.id)).toEqual(['e73']);
    expect(r.dia.slots).toEqual(noPiso);
    expect(r.descansos.map(s => s.para)).toEqual([60, 60, 60]);
  });
  it('usa o maior descanso que cabe, não força 60 s', () => {
    const entrada = dia(slot('e9'));
    const desejado = dia({ ...entrada.slots[0]!, descansoSeg: 143 });
    const limite = segundos(desejado);
    const r = adequarInicioFullUpperLower(entrada, 'iniciante', limite);
    expect(r.dia.slots[0]!.descansoSeg).toBe(143);
    expect(segundos(r.dia)).toBe(limite);
    expect(segundos(dia({ ...r.dia.slots[0]!, descansoSeg: 144 }))).toBeGreaterThan(limite);
  });
  it('não atravessa 60 s nem corta principal quando descanso não basta', () => {
    const r = adequarInicioFullUpperLower(dia(slot('e9')), 'iniciante', 1);
    expect(r.dia.slots).toHaveLength(1);
    expect(r.dia.slots[0]!.descansoSeg).toBe(60);
    expect(r.dia.slots[0]!.series).toBe(3);
    expect(r.duracao.duracaoMaximaEstimadaSegundos).toBeGreaterThan(1);
  });
  it('não altera sessão que cabe, ilimitada ou sem dados de duração', () => {
    const entrada = dia(slot('e9'), slot('e4'));
    for (const limite of [undefined, segundos(entrada)]) {
      expect(adequarInicioFullUpperLower(entrada, 'iniciante', limite).dia).toEqual(entrada);
    }
    delete entrada.slots[0]!.series;
    const r = adequarInicioFullUpperLower(entrada, 'iniciante', 1);
    expect(r.dia).toEqual(entrada);
    expect(r.duracao.estadoCalculo).toBe('NAO_AVALIADO');
  });
});
