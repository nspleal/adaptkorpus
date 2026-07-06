import { describe, expect, it } from 'vitest';
import { novaSessaoDe, sessoesTreino, type SessaoHistorico } from './treino-historico';
import { diasDeTreino } from './chama';

/**
 * Salvaguarda travada do B2 (cofre DF #13, 2026-07-04): evento de calibração NÃO conta
 * como dia de treino (Chama/marcos) nem alimenta o gráfico de Cargas.
 */
const base = { dia: 'Treino', series: 3, volumeKg: 0, feedback: {}, exercicios: [] };

describe('sessoesTreino — calibração fora da Chama e das Cargas', () => {
  it('filtra entradas tipo calibracao; treino normal (com e sem tipo) passa', () => {
    const hist: SessaoHistorico[] = [
      { ...base, n: 1, dataISO: '2026-07-01' },
      { ...base, n: 2, dataISO: '2026-07-02', tipo: 'calibracao', dia: 'Calibração manual', series: 0 },
      { ...base, n: 3, dataISO: '2026-07-03', manual: true },
    ];
    expect(sessoesTreino(hist).map((s) => s.n)).toEqual([1, 3]);
  });

  it('Chama: calibração em data NOVA não vira dia de treino', () => {
    const hist: SessaoHistorico[] = [
      { ...base, n: 1, dataISO: '2026-07-01' },
      { ...base, n: 2, dataISO: '2026-07-02', tipo: 'calibracao', dia: 'Calibração manual', series: 0 },
    ];
    expect(diasDeTreino(sessoesTreino(hist).map((s) => s.dataISO))).toBe(1);
    // sem o filtro seriam 2 — é exatamente o que a salvaguarda impede
    expect(diasDeTreino(hist.map((s) => s.dataISO))).toBe(2);
  });
});

describe('novaSessaoDe — a recém-gravada é a de maior n (write-through p/ o servidor)', () => {
  it('acha o max n independente da ordem do array; vazio → null', () => {
    const hist: SessaoHistorico[] = [
      { ...base, n: 2, dataISO: '2026-07-02' },
      { ...base, n: 5, dataISO: '2026-07-01' }, // registrada por último (n máximo), data antiga
      { ...base, n: 3, dataISO: '2026-07-03' },
    ];
    expect(novaSessaoDe(hist)?.n).toBe(5);
    expect(novaSessaoDe([])).toBeNull();
  });
});
