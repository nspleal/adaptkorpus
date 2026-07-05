import { describe, expect, it } from 'vitest';
import { exerciciosComCarga, serieCargaPorExercicio } from './cargas-serie';
import type { SessaoHistorico } from './treino-historico';

/**
 * Regressão do bug "a curva de cargas nunca aparece": a série é por SESSÃO (não por dia),
 * então várias sessões do mesmo exercício no MESMO dia geram vários pontos — antes
 * colapsavam num só e o cartão ficava preso em "Registre mais sessões…".
 */
const ex = (id: string, nome: string, kg: number | null, over: Partial<SessaoHistorico['exercicios'][number]> = {}) => ({
  id, nome, loaded: true, custom: false, fb: null,
  sets: kg == null ? [] : [{ reps: '10', kg: String(kg) }], ...over,
});
const sess = (dataISO: string, n: number, ...exs: SessaoHistorico['exercicios']): SessaoHistorico => ({
  dia: 'Treino', series: exs.length, volumeKg: 0, feedback: {}, exercicios: exs, n, dataISO,
});

describe('serieCargaPorExercicio — um ponto por sessão (não por dia)', () => {
  it('BUG CORRIGIDO: 3 sessões no MESMO dia → 3 pontos (antes colapsava em 1)', () => {
    const h = [
      sess('2026-07-04', 3, ex('e11', 'Supino com halteres', 24)),
      sess('2026-07-04', 2, ex('e11', 'Supino com halteres', 22)),
      sess('2026-07-04', 1, ex('e11', 'Supino com halteres', 20)),
    ];
    expect(serieCargaPorExercicio(h, 'e11')).toEqual([20, 22, 24]); // ordenado por n dentro do dia
  });

  it('dias distintos → ordem cronológica por data', () => {
    const h = [
      sess('2026-07-04', 3, ex('e11', 'Supino', 24)),
      sess('2026-07-01', 1, ex('e11', 'Supino', 20)),
      sess('2026-07-03', 2, ex('e11', 'Supino', 22)),
    ];
    expect(serieCargaPorExercicio(h, 'e11')).toEqual([20, 22, 24]);
  });

  it('maior carga da sessão vence entre as séries; sessões sem kg viram 0 pontos', () => {
    const h = [
      sess('2026-07-04', 2, { ...ex('e11', 'Supino', null), sets: [{ reps: '8', kg: '18' }, { reps: '6', kg: '25' }] }),
      sess('2026-07-05', 3, ex('e11', 'Supino', null)), // sem kg → não entra
    ];
    expect(serieCargaPorExercicio(h, 'e11')).toEqual([25]);
  });

  it('uma sessão só → 1 ponto (o cartão ainda pede mais — honesto, precisa de ≥2 p/ linha)', () => {
    const h = [sess('2026-07-04', 1, ex('e11', 'Supino', 20))];
    expect(serieCargaPorExercicio(h, 'e11')).toHaveLength(1);
  });
});

describe('exerciciosComCarga — só lista o que é plotável', () => {
  it('exclui exercício logado SEM nenhuma carga (antes aparecia no seletor com série vazia)', () => {
    const h = [
      sess('2026-07-04', 2, ex('e11', 'Supino com halteres', 20), ex('e116', 'Remada invertida', null)),
      sess('2026-07-05', 3, ex('e116', 'Remada invertida', null)),
    ];
    expect(exerciciosComCarga(h)).toEqual([{ id: 'e11', nome: 'Supino com halteres' }]);
  });

  it('exclui personalizados (sem id estável) e não-carga; dedup por id', () => {
    const h = [
      sess('2026-07-04', 2, ex('e11', 'Supino', 20), { ...ex('', 'Meu exercício', 30), custom: true }),
      sess('2026-07-05', 3, ex('e11', 'Supino', 22)),
    ];
    expect(exerciciosComCarga(h)).toEqual([{ id: 'e11', nome: 'Supino' }]);
  });
});
