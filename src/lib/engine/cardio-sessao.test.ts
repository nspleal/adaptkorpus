/**
 * 🔒 C1 — cardio na origem (primitiva única) + classificação de cardio EDITADO no avaliador.
 * Fixtures da §8 da especificação (D756366D): 5, 14, 27, 28, 33, 37, 46, 29 (automático).
 */
import { describe, expect, it } from 'vitest';
import {
  calcularUsosCardioNaOrigem,
  capacidadeCardioDoDia,
  type CapacidadeCardio,
  type PrescricaoCardioDia,
} from './cardio-sessao';
import { avaliarDuracaoSessao, type ItemDuracao } from './duracao-sessao';

const cap = (segundos: number): CapacidadeCardio => ({ tipo: 'CALCULAVEL', segundos });
const presc = (id: string, ordem: number, dur: number): PrescricaoCardioDia => ({
  prescricaoId: id,
  ordemPrescricao: ordem,
  duracaoPrescritaSegundos: dur,
});
// item isométrico como "bloco" resistido de execução exata (hold = execução por série).
const iso = (hold: number, series = 1, descanso = 0): ItemDuracao => ({
  tipo: 'RESISTIDO',
  series,
  descansoEntreSeriesSeg: descanso,
  execucao: { tipo: 'ISOMETRIA', holdSegundosPorSerie: hold },
  tecnica: { tipo: 'SEM_TECNICA' },
});
const cardio = (d: number): ItemDuracao => ({ tipo: 'CONTINUO', duracaoTotalSegundos: d });

describe('C1 cardio · capacidadeCardioDoDia (§4.2)', () => {
  it('dia exclusivo de cardio: capacidade = B', () => {
    expect(capacidadeCardioDoDia({ temMusculacao: false, orcamentoSegundos: 3600, maxResistidaSegundos: null }))
      .toEqual({ tipo: 'CALCULAVEL', segundos: 3600 });
  });
  it('dia com musculação: capacidade = max(B - MAX_RESISTIDA, 0)', () => {
    expect(capacidadeCardioDoDia({ temMusculacao: true, orcamentoSegundos: 2700, maxResistidaSegundos: 2400 }))
      .toEqual({ tipo: 'CALCULAVEL', segundos: 300 });
    expect(capacidadeCardioDoDia({ temMusculacao: true, orcamentoSegundos: 2700, maxResistidaSegundos: 3000 }))
      .toEqual({ tipo: 'CALCULAVEL', segundos: 0 });
  });
  it('B ausente ou MAX_RESISTIDA incalculável ⇒ INCALCULAVEL', () => {
    expect(capacidadeCardioDoDia({ temMusculacao: true, orcamentoSegundos: undefined, maxResistidaSegundos: 100 }).tipo).toBe('INCALCULAVEL');
    expect(capacidadeCardioDoDia({ temMusculacao: true, orcamentoSegundos: 2700, maxResistidaSegundos: null }).tipo).toBe('INCALCULAVEL');
  });
});

describe('C1 cardio · calcularUsosCardioNaOrigem (primitiva única §4.2)', () => {
  it('fixture 5: cardio exclusivo 5400 com B=3600 é adaptado para 3600 (restante 1800)', () => {
    const r = calcularUsosCardioNaOrigem(cap(3600), [presc('p', 0, 5400)]);
    expect(r.usos[0]!.duracaoUsadaNaSessaoSegundos).toBe(3600);
    expect(r.usos[0]!.restanteAposOrigemSegundos).toBe(1800);
    expect(r.cardioOrigemNoDiaSegundos).toBe(3600);
  });

  it('fixture 14/27: musculação deixa 300; cardio 900 usa 300, preserva restante 600', () => {
    const r = calcularUsosCardioNaOrigem(cap(300), [presc('p', 0, 900)]);
    expect(r.usos[0]!.duracaoUsadaNaSessaoSegundos).toBe(300);
    expect(r.usos[0]!.restanteAposOrigemSegundos).toBe(600);
  });

  it('fixture 33: capacidade 0 (resistida ocupa tudo) ⇒ uso 0, restante 900', () => {
    const r = calcularUsosCardioNaOrigem(cap(0), [presc('p', 0, 900)]);
    expect(r.usos[0]!.duracaoUsadaNaSessaoSegundos).toBe(0);
    expect(r.usos[0]!.restanteAposOrigemSegundos).toBe(900);
  });

  it('fixture 46: duas prescrições no mesmo dia COMPARTILHAM a capacidade em ordem crescente', () => {
    const r = calcularUsosCardioNaOrigem(cap(3600), [presc('p1', 0, 2400), presc('p2', 1, 2400)]);
    expect(r.usos.find((u) => u.prescricaoId === 'p1')!.duracaoUsadaNaSessaoSegundos).toBe(2400);
    const p2 = r.usos.find((u) => u.prescricaoId === 'p2')!;
    expect(p2.duracaoUsadaNaSessaoSegundos).toBe(1200); // não 2400 (proibido B integral por prescrição)
    expect(p2.restanteAposOrigemSegundos).toBe(1200);
    expect(r.cardioOrigemNoDiaSegundos).toBe(3600);
  });

  it('a ordem de consumo segue ordem_prescricao, não a ordem do array', () => {
    const r = calcularUsosCardioNaOrigem(cap(1000), [presc('tarde', 1, 800), presc('manha', 0, 800)]);
    // manhã (ordem 0) consome primeiro: 800; tarde (ordem 1) recebe só 200.
    expect(r.usos.find((u) => u.prescricaoId === 'manha')!.duracaoUsadaNaSessaoSegundos).toBe(800);
    expect(r.usos.find((u) => u.prescricaoId === 'tarde')!.duracaoUsadaNaSessaoSegundos).toBe(200);
  });

  it('capacidade INCALCULÁVEL ⇒ uso 0 e prescrição inteira vira saldo (fixture 29/44 automático)', () => {
    const r = calcularUsosCardioNaOrigem({ tipo: 'INCALCULAVEL', motivo: 'ORCAMENTO_AUSENTE' }, [presc('p', 0, 300)]);
    expect(r.usos[0]!.duracaoUsadaNaSessaoSegundos).toBe(0);
    expect(r.usos[0]!.restanteAposOrigemSegundos).toBe(300);
  });

  it('domínio inválido (duração <= 0 ou fracionária) ⇒ prescrição não alocada, com motivo', () => {
    const r = calcularUsosCardioNaOrigem(cap(1000), [presc('bad', 0, 0), presc('frac', 1, 10.5)]);
    expect(r.temPrescricaoInvalida).toBe(true);
    for (const u of r.usos) expect(u.duracaoUsadaNaSessaoSegundos).toBe(0);
  });
});

describe('C1 cardio · classificação de cardio EDITADO no avaliador (§4.4)', () => {
  it('fixture 28: cardio manual 3000, B=2700 ⇒ ACIMA / CARDIO_EXCEDE, sem tolerância, não bloqueia', () => {
    const r = avaliarDuracaoSessao({ itens: [cardio(3000)], orcamentoSegundos: 2700, origemPlano: 'EDITADO' });
    expect(r.estadoCalculo).toBe('CALCULADO');
    expect(r.estadoLimite).toBe('ACIMA_DO_LIMITE_OPERACIONAL');
    expect(r.motivosLimite).toContain('CARDIO_EXCEDE_TEMPO_DISPONIVEL');
    expect(r.estadoLimite).not.toBe('DENTRO_DA_TOLERANCIA');
  });

  it('fixture 37: resistida 2400–3000, B=2700, cardio editado 100 ⇒ INDETERMINADO / CARDIO_PODE_EXCEDER', () => {
    // minResistida = 600+1800 = 2400; transição = 600 ⇒ maxResistida = 3000.
    const itens: ItemDuracao[] = [iso(600, 1, 600), iso(1800, 1, 0), cardio(100)];
    const r = avaliarDuracaoSessao({ itens, orcamentoSegundos: 2700, origemPlano: 'EDITADO' });
    expect(r.estadoLimite).toBe('LIMITE_INDETERMINADO');
    expect(r.motivosLimite).toContain('CARDIO_PODE_EXCEDER_TEMPO_DISPONIVEL');
  });

  it('fixture 14 automático: resistida 2400 + cardio adaptado 300 = 2700 ⇒ DENTRO_DO_LIMITE (sem excesso)', () => {
    const itens: ItemDuracao[] = [iso(2400, 1, 0), cardio(300)];
    const r = avaliarDuracaoSessao({ itens, orcamentoSegundos: 2700, origemPlano: 'AUTOMATICO' });
    expect(r.estadoLimite).toBe('DENTRO_DO_LIMITE');
    expect(r.motivosLimite).not.toContain('CARDIO_EXCEDE_TEMPO_DISPONIVEL');
  });

  it('fixture 14 variante automático: resistida 3000 usa a tolerância; cardio 0 ⇒ DENTRO_DA_TOLERANCIA', () => {
    const itens: ItemDuracao[] = [iso(3000, 1, 0)]; // cardio 0 ⇒ não materializa item contínuo
    const r = avaliarDuracaoSessao({ itens, orcamentoSegundos: 2700, origemPlano: 'AUTOMATICO' });
    expect(r.estadoLimite).toBe('DENTRO_DA_TOLERANCIA'); // só a musculação ocupa +480
  });

  it('mutação-guard: o AUTOMATICO nunca recebe as cláusulas de cardio editado', () => {
    // mesmo bloco de cardio "grande", mas AUTOMATICO ⇒ segue a ordenação genérica, não CARDIO_EXCEDE.
    const r = avaliarDuracaoSessao({ itens: [cardio(3000)], orcamentoSegundos: 2700, origemPlano: 'AUTOMATICO' });
    expect(r.motivosLimite).not.toContain('CARDIO_EXCEDE_TEMPO_DISPONIVEL');
  });
});
