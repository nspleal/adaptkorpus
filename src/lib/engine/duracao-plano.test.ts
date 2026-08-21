/**
 * 🔒 C1 — adaptador plano→fórmula canônica. Prova as fronteiras do modelo real: isometria pelo
 * hold (nunca 40 s), reps a 40 s, dado ausente ⇒ NAO_AVALIADO (sem 1/90), bilateral por default.
 */
import { describe, expect, it } from 'vitest';
import { avaliarDuracaoResistida, itensResistidosDeSlots } from './duracao-plano';
import { EXERCISES } from '../data/exercises';
import { faixaSegundos } from './isometricos';

const byId = (id: string) => EXERCISES.find((e) => e.id === id)!;
const supino = byId('e1'); // reps (empurrar)
const prancha = byId('e7'); // isométrico (hold em segundos)

describe('C1 adaptador · execução por tipo', () => {
  it('exercício de REPETIÇÕES usa 40 s/série', () => {
    const { itens } = itensResistidosDeSlots([{ exercicio: supino, series: 4, descansoSeg: 90 }], 'avancado');
    expect(itens[0]).toMatchObject({ execucao: { tipo: 'REPETICOES', segundosEstimadosPorSerie: 40 } });
  });

  it('ISOMÉTRICO usa o HOLD do nível (nunca 40 s)', () => {
    const holdAvancado = faixaSegundos('e7', 'avancado')!.min; // 70
    expect(holdAvancado).toBe(70);
    const { itens } = itensResistidosDeSlots([{ exercicio: prancha, series: 3, descansoSeg: 60 }], 'avancado');
    expect(itens[0]).toMatchObject({ execucao: { tipo: 'ISOMETRIA', holdSegundosPorSerie: 70 } });
    // e a duração reflete o hold: 3×70 exec + 2×60 descanso = 330 (não 240 que 40 s daria).
    const r = avaliarDuracaoResistida([{ exercicio: prancha, series: 3, descansoSeg: 60 }], 'avancado');
    expect(r.duracaoMinimaEstimadaSegundos).toBe(330);
  });

  it('NUNCA marca unilateral (o modelo não tem o campo) — bilateral por default', () => {
    const { itens } = itensResistidosDeSlots([{ exercicio: supino, series: 4, descansoSeg: 90 }], 'avancado');
    expect((itens[0] as { unilateralDoisLados?: boolean }).unilateralDoisLados).toBeUndefined();
  });
});

describe('C1 adaptador · dado ausente ⇒ NAO_AVALIADO (sem fallback 1/90)', () => {
  it('série ausente em qualquer slot ⇒ sessão inteira NAO_AVALIADO', () => {
    const r = avaliarDuracaoResistida(
      [{ exercicio: supino, series: 4, descansoSeg: 90 }, { exercicio: supino, descansoSeg: 90 }],
      'intermediario', 3600,
    );
    expect(r.estadoCalculo).toBe('NAO_AVALIADO');
    expect(r.motivosNaoAvaliados.join(' ')).toMatch(/séries/);
  });

  it('descanso ausente ⇒ NAO_AVALIADO', () => {
    const r = avaliarDuracaoResistida([{ exercicio: supino, series: 4 }], 'intermediario', 3600);
    expect(r.estadoCalculo).toBe('NAO_AVALIADO');
    expect(r.motivosNaoAvaliados.join(' ')).toMatch(/descanso/);
  });

  it('plano completo ⇒ CALCULADO com faixa e classificação', () => {
    const r = avaliarDuracaoResistida(
      [{ exercicio: supino, series: 4, descansoSeg: 60 }, { exercicio: supino, series: 4, descansoSeg: 90 }],
      'intermediario', 1800,
    );
    expect(r.estadoCalculo).toBe('CALCULADO');
    // exec 8×40=320 + descanso 3×60+3×90=450 = MIN 770; transição = 60 (1º, não-último) → MAX 830.
    expect(r.duracaoMinimaEstimadaSegundos).toBe(770);
    expect(r.duracaoMaximaEstimadaSegundos).toBe(830);
    expect(r.estadoLimite).toBe('DENTRO_DO_LIMITE');
  });
});
