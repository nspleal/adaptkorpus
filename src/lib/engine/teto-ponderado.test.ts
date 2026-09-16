/**
 * 🔒 O TETO DURO NA CONTA CANÔNICA — testes de unidade.
 *
 * Ancoram o que o cofre travou em 2026-07-31 (`motor-treino-grupo-em-foco-x-mrv`, claims
 * --005/--010/--011): o MRV é teto duro, o foco sobe até ele e PARA, e quem já está no topo
 * ganha ORDEM, não volume. Aqui só a aritmética; o caminho real vive em `foco-teto-mrv`.
 */
import { describe, expect, it } from 'vitest';
import { creditoAtual, creditar, folgaAteOTeto, podarExcessoPonderado, seriesQueCabemNoTeto } from './teto-ponderado';
import { creditoPonderadoDaSemana } from './alocador';
import { EXERCISES } from '../data/exercises';
import { secundariosDe } from './secundarios';
import type { Exercise } from '../data/types';

const porId = (id: string): Exercise => {
  const e = EXERCISES.find((x) => x.id === id);
  if (!e) throw new Error(`exercício ${id} não existe no seed`);
  return e;
};
/** Um peitoral que também credita ombros — a ponte do crédito indireto que o defeito ignorava. */
const peitoComIndireto = EXERCISES.find((e) => e.grupoPrimario === 'peito' && secundariosDe(e).includes('ombros'))!;
/** Um peitoral sem nenhum secundário GRANDE, para separar direto de indireto. */
const peitoSemGrandeIndireto = EXERCISES.find(
  (e) => e.grupoPrimario === 'peito' && !secundariosDe(e).some((g) => ['costas', 'quadriceps', 'posterior', 'gluteos', 'ombros'].includes(g)),
);

describe('anti-vacuidade — o seed sustenta os casos', () => {
  it('existe peitoral que credita ombros de forma indireta', () => {
    expect(peitoComIndireto, 'sem esse exercício o teste de terceiro não prova nada').toBeTruthy();
    expect(secundariosDe(peitoComIndireto)).toContain('ombros');
  });
});

describe('seriesQueCabemNoTeto — o quanto o extra pode somar', () => {
  it('cabe inteiro quando há folga de sobra', () => {
    const credito = creditoAtual([]);
    expect(seriesQueCabemNoTeto(peitoComIndireto, 2, credito, 16)).toBe(2);
  });

  it('corta pelo DIRETO: peito em 15 com teto 16 só aceita 1', () => {
    const credito = new Map([['peito', 15]] as const) as Map<never, number>;
    expect(seriesQueCabemNoTeto(peitoComIndireto, 2, credito as never, 16)).toBe(1);
  });

  it('recusa quando o grupo já está NO teto — o degrau da ORDEM', () => {
    const credito = new Map([['peito', 16]] as const) as Map<never, number>;
    expect(seriesQueCabemNoTeto(peitoComIndireto, 2, credito as never, 16)).toBe(0);
  });

  it('🔴 corta pelo INDIRETO: peito com folga, mas ombros a 0,5 do teto', () => {
    // O defeito medido em `3d86cbf`: peito cabia, e o 0,5 de ombros levava um grupo que a
    // pessoa nem focou a 17 contra 16. A folga do terceiro tem de contar.
    const credito = new Map([['peito', 10], ['ombros', 15.5]] as const) as Map<never, number>;
    expect(seriesQueCabemNoTeto(peitoComIndireto, 2, credito as never, 16)).toBe(1);
    const semFolga = new Map([['peito', 10], ['ombros', 16]] as const) as Map<never, number>;
    expect(seriesQueCabemNoTeto(peitoComIndireto, 2, semFolga as never, 16)).toBe(0);
  });

  it('ignora grupos SEM faixa: bíceps/tríceps não têm teto para gastar', () => {
    if (!peitoSemGrandeIndireto) return; // o seed pode não ter; o caso acima já cobre o essencial
    const credito = new Map([['triceps', 99]] as const) as Map<never, number>;
    expect(seriesQueCabemNoTeto(peitoSemGrandeIndireto, 2, credito as never, 16)).toBe(2);
  });

  it('`creditar` soma na MESMA moeda de `creditoPonderadoDaSemana`', () => {
    const m = new Map<never, number>();
    creditar(m as never, peitoComIndireto, 3);
    const canonico = creditoPonderadoDaSemana([{ exercicio: peitoComIndireto, series: 3 }]);
    expect([...(m as never as Map<string, number>)].sort()).toEqual([...canonico].sort());
  });

  it('folgaAteOTeto devolve negativo quando já estourou', () => {
    const folga = folgaAteOTeto(new Map([['peito', 21]] as const) as never, 20);
    expect(folga.get('peito')).toBe(-1);
  });
});

describe('podarExcessoPonderado — o excesso do BASELINE', () => {
  const slotsDePeito = (series: number[]) => series.map((n) => ({ exercicio: peitoComIndireto, series: n }));

  it('anti-vacuidade: sem excesso não poda nada', () => {
    const slots = slotsDePeito([4, 4]);
    const r = podarExcessoPonderado(slots, 16, 2);
    expect(r.podados).toEqual([]);
    expect(slots.map((s) => s.series)).toEqual([4, 4]);
  });

  it('🔴 poda até caber, tirando do slot com MAIS séries', () => {
    // 5 slots × 4 = 20 diretos; teto 18 ⇒ precisa devolver 2.
    const slots = slotsDePeito([4, 4, 4, 4, 4]);
    const r = podarExcessoPonderado(slots, 18, 2);
    expect(creditoPonderadoDaSemana(slots).get('peito')).toBeLessThanOrEqual(18);
    expect(r.podados).toEqual([{ grupo: 'peito', series: 2 }]);
    // O corte se distribui em vez de zerar um exercício.
    expect(slots.map((s) => s.series).sort()).toEqual([3, 3, 4, 4, 4]);
  });

  it('🔒 nunca desce abaixo do piso por exercício do nível', () => {
    const slots = slotsDePeito([3, 3, 3, 3, 3, 3]);
    const r = podarExcessoPonderado(slots, 4, 3);
    expect(slots.every((s) => (s.series ?? 0) >= 3), 'furou o piso do nível').toBe(true);
    expect(r.irredutiveis).toContain('peito');
  });

  it('🔒 nenhum terceiro paga: só o grupo que estourou perde série', () => {
    const costas = EXERCISES.find((e) => e.grupoPrimario === 'costas')!;
    const slots = [...slotsDePeito([4, 4, 4, 4, 4]), { exercicio: costas, series: 4 }];
    const antesCostas = slots[5]!.series;
    podarExcessoPonderado(slots, 18, 2);
    expect(slots[5]!.series, 'costas pagou por um teto que não é dele').toBe(antesCostas);
  });

  /**
   * 🔒 O predicado `podavel` — o que protege a dose que a PESSOA escolheu no seu desenho.
   * O crédito continua sendo do plano INTEIRO (filtrar a entrada daria um total falso);
   * o predicado só decide de quem se pode tirar.
   */
  it('🔒 slot protegido não cede série — mas continua contando no crédito', () => {
    const slots = slotsDePeito([4, 4, 4, 4, 4]);
    const protegido = slots[0]!;
    const r = podarExcessoPonderado(slots, 18, 2, (s) => s !== protegido);
    expect(protegido.series, 'a dose protegida foi alterada').toBe(4);
    expect(creditoPonderadoDaSemana(slots).get('peito')).toBeLessThanOrEqual(18);
    // O corte inteiro saiu dos outros quatro: 20 − 2 = 18, com o protegido intacto.
    expect(slots.map((s) => s.series).sort()).toEqual([3, 3, 4, 4, 4]);
    expect(r.podados).toEqual([{ grupo: 'peito', series: 2 }]);
  });

  it('🔒 se TUDO está protegido, o excesso fica e vira `irredutiveis` — nada some calado', () => {
    const slots = slotsDePeito([4, 4, 4, 4, 4]);
    const r = podarExcessoPonderado(slots, 18, 2, () => false);
    expect(slots.map((s) => s.series), 'mexeu em dose protegida').toEqual([4, 4, 4, 4, 4]);
    expect(r.podados).toEqual([]);
    expect(r.irredutiveis).toContain('peito');
  });

  /**
   * ⚠️ REGRESSÃO do QA desta correção: com TODO o plano protegido, o orçamento de voltas era
   * `0 séries podáveis + 1` — uma volta só — e a função devolvia apenas o PRIMEIRO grupo
   * estourado. Na tela, com peito, costas e ombros a 24 contra 16, `irredutiveis` vinha com
   * peito sozinho. Cada grupo irredutível consome uma volta, e o orçamento tem de contá-las.
   */
  it('🔴 TRÊS grupos estourados e tudo protegido: os três entram em `irredutiveis`', () => {
    const costas = EXERCISES.find((e) => e.grupoPrimario === 'costas')!;
    const ombros = EXERCISES.find((e) => e.grupoPrimario === 'ombros')!;
    const slots = [
      ...slotsDePeito([6, 6, 6, 6]),
      { exercicio: costas, series: 24 },
      { exercicio: ombros, series: 24 },
    ];
    const r = podarExcessoPonderado(slots, 16, 2, () => false);
    expect(r.podados).toEqual([]);
    expect([...r.irredutiveis].sort()).toEqual(['costas', 'ombros', 'peito']);
  });

  it('termina mesmo com entrada absurda (sem laço infinito)', () => {
    const slots = slotsDePeito([4, 4, 4]);
    expect(() => podarExcessoPonderado(slots, 0, 0)).not.toThrow();
    expect(slots.every((s) => (s.series ?? 0) >= 0)).toBe(true);
  });

  it('o crédito indireto conta na poda (não só o direto)', () => {
    // 4 diretos de peito (16) + 1 exercício que credita peito de forma indireta.
    const indireto = EXERCISES.find((e) => e.grupoPrimario !== 'peito' && secundariosDe(e).includes('peito'));
    if (!indireto) return;
    const slots = [...slotsDePeito([4, 4, 4, 4]), { exercicio: indireto, series: 4 }];
    podarExcessoPonderado(slots, 16, 2);
    expect(creditoPonderadoDaSemana(slots).get('peito')).toBeLessThanOrEqual(16);
    // o slot indireto é de OUTRO grupo: não é ele que paga
    expect(slots[4]!.series).toBe(4);
  });

  it('usa exatamente `creditoPonderadoDaSemana` como régua (sem fórmula paralela)', () => {
    const slots = slotsDePeito([4, 4, 4, 4, 4]);
    podarExcessoPonderado(slots, 17, 2);
    const canonico = creditoPonderadoDaSemana(slots).get('peito') ?? 0;
    expect(canonico).toBeLessThanOrEqual(17);
    // e não podou mais do que o necessário
    expect(canonico).toBeGreaterThan(16);
  });
});

describe('o seed tem os ids usados pelos testes de caminho real', () => {
  it('e1 e e10 existem (o bloco do foco do relato)', () => {
    expect(porId('e1').grupoPrimario).toBe('peito');
    expect(porId('e10').grupoPrimario).toBe('peito');
  });
});
