import { describe, expect, it } from 'vitest';
import { paraRotinaCustom, weekdaysSaoUnicos, type DiaEditavel } from './EditorTreino';

const dia = (nome: string, weekdayIdx: number): DiaEditavel => ({
  nome,
  weekdayIdx,
  exercicios: [{ id: nome } as never],
});

describe('EditorTreino · agenda manual', () => {
  it('não considera dois cartões no mesmo dia como agenda válida', () => {
    expect(weekdaysSaoUnicos([dia('A', 0), dia('B', 0)])).toBe(false);
    expect(weekdaysSaoUnicos([dia('A', 0), dia('B', 2)])).toBe(true);
  });

  it('persiste o dia canônico junto com os ids escolhidos', () => {
    expect(paraRotinaCustom([dia('A', 0), dia('B', 4)])).toEqual({
      origem: 'usuario',
      dias: [
        { nome: 'A', diaId: 'seg', exercicioIds: ['A'] },
        { nome: 'B', diaId: 'sex', exercicioIds: ['B'] },
      ],
    });
  });
});
