import { describe, expect, it } from 'vitest';
import {
  DIAS_PARA_SAIR_DA_FAIXA, FAIXA_INICIAL, HISTERESE_FRACAO, HISTERESE_KG,
  INTERVALO_MIN_RECOMPUTO_DIAS, JANELA_SUAVIZACAO_DIAS, MIN_REGISTROS_SUAVIZACAO,
  aplicarHistereseFaixa, deveRecomputar, naJanela, pesoEfetivo, pesoSuavizado,
  type FaixaProtetiva, type Pesagem,
} from './peso-suavizado';
import { calcularIMC } from './formulas';

/**
 * Peso suavizado — spec travada no cofre §⚖️ (DF 2026-07-31).
 * Os números vêm da spec, nunca do que o código devolve.
 */

/** Constrói uma série a partir de "dias atrás" — legível e sem relógio. */
const dia = (n: number): string => {
  const base = Date.parse('2026-07-31T00:00:00Z');
  return new Date(base - n * 86_400_000).toISOString().slice(0, 10);
};
const HOJE = dia(0);
const serie = (...vals: [number, number][]): Pesagem[] =>
  vals.map(([diasAtras, kg]) => ({ dataISO: dia(diasAtras), kg }));

describe('constantes da spec', () => {
  it('janela 7 dias · mínimo 3 registros · histerese 1 kg ou 1,5% · 1×/semana · 14 dias p/ sair', () => {
    expect(JANELA_SUAVIZACAO_DIAS).toBe(7);
    expect(MIN_REGISTROS_SUAVIZACAO).toBe(3);
    expect(HISTERESE_KG).toBe(1);
    expect(HISTERESE_FRACAO).toBe(0.015);
    expect(INTERVALO_MIN_RECOMPUTO_DIAS).toBe(7);
    expect(DIAS_PARA_SAIR_DA_FAIXA).toBe(14);
  });
});

describe('média móvel — a janela e o mínimo de registros', () => {
  it('média de 3 registros na janela', () => {
    expect(pesoSuavizado(serie([0, 61.0], [1, 62.0], [2, 63.0]), HOJE)).toBe(62);
  });

  /** 🔒 ACEITE: uma pesagem isolada NÃO muda o alvo. */
  it('1 ou 2 registros → null (o motor mantém o valor vigente)', () => {
    expect(pesoSuavizado(serie([0, 61.4]), HOJE)).toBeNull();
    expect(pesoSuavizado(serie([0, 61.4], [1, 61.6]), HOJE)).toBeNull();
    expect(pesoSuavizado([], HOJE)).toBeNull();
  });

  it('e `pesoEfetivo` devolve o VIGENTE quando não há suavizado', () => {
    expect(pesoEfetivo(serie([0, 61.4]), HOJE, 70)).toBe(70);
    expect(pesoEfetivo([], HOJE, 70)).toBe(70);
    // Com 3 registros o suavizado VENCE o vigente (spec §4).
    expect(pesoEfetivo(serie([0, 61], [1, 61], [2, 61]), HOJE, 70)).toBe(61);
  });

  it('só conta o que está DENTRO da janela de 7 dias', () => {
    // 3 registros, mas dois com 7+ dias → só 1 na janela → null.
    expect(pesoSuavizado(serie([0, 61], [7, 80], [8, 80]), HOJE)).toBeNull();
    expect(naJanela(serie([0, 61], [6, 62], [7, 63]), HOJE)).toHaveLength(2);
  });

  it('ignora data inválida e valor não-finito, sem quebrar', () => {
    const suja: Pesagem[] = [
      { dataISO: 'nao-e-data', kg: 61 },
      { dataISO: dia(0), kg: Number.NaN },
      ...serie([0, 61], [1, 62], [2, 63]),
    ];
    expect(pesoSuavizado(suja, HOJE)).toBe(62);
  });

  it('arredonda a uma casa (precisão da balança, não ruído)', () => {
    expect(pesoSuavizado(serie([0, 61.11], [1, 61.12], [2, 61.13]), HOJE)).toBe(61.1);
  });

  /**
   * 🔴 O SEXTO consumidor: `health-gate.ts:26` devolve tudo `NaN` com peso fora de 30–300.
   * A média de valores já validados NUNCA sai do envelope — não pode extrapolar.
   */
  it('nunca produz valor fora do envelope dos registros (não extrapola)', () => {
    const casos: Pesagem[][] = [
      serie([0, 30], [1, 30], [2, 30]),
      serie([0, 300], [1, 300], [2, 300]),
      serie([0, 30], [1, 300], [2, 165]),
      serie([0, 59], [1, 61], [2, 60]),
    ];
    for (const s of casos) {
      const v = pesoSuavizado(s, HOJE)!;
      const kgs = s.map((p) => p.kg);
      expect(v).toBeGreaterThanOrEqual(Math.min(...kgs));
      expect(v).toBeLessThanOrEqual(Math.max(...kgs));
      // E, por consequência, dentro da faixa de plausibilidade do gate.
      expect(v).toBeGreaterThanOrEqual(30);
      expect(v).toBeLessThanOrEqual(300);
    }
  });
});

describe('histerese de recomputação — o plano não muda todo dia', () => {
  it('não recomputa abaixo do limiar', () => {
    // 70 kg → limiar = max(1, 70×0,015=1,05) = 1,05.
    expect(deveRecomputar({ suavizadoKg: 70.9, pesoDoPlanoKg: 70, ultimoRecomputoISO: null, hojeISO: HOJE })).toBe(false);
    expect(deveRecomputar({ suavizadoKg: 69.1, pesoDoPlanoKg: 70, ultimoRecomputoISO: null, hojeISO: HOJE })).toBe(false);
  });

  it('recomputa acima do limiar', () => {
    expect(deveRecomputar({ suavizadoKg: 71.5, pesoDoPlanoKg: 70, ultimoRecomputoISO: null, hojeISO: HOJE })).toBe(true);
    expect(deveRecomputar({ suavizadoKg: 61.4, pesoDoPlanoKg: 70, ultimoRecomputoISO: null, hojeISO: HOJE })).toBe(true);
  });

  /** O limiar é o MAIOR entre 1 kg e 1,5% — em peso alto, 1,5% manda. */
  it('em peso alto o 1,5% domina o 1 kg', () => {
    // 120 kg → limiar = max(1, 1,8) = 1,8. Uma variação de 1,2 kg NÃO recomputa.
    expect(deveRecomputar({ suavizadoKg: 121.2, pesoDoPlanoKg: 120, ultimoRecomputoISO: null, hojeISO: HOJE })).toBe(false);
    expect(deveRecomputar({ suavizadoKg: 122.0, pesoDoPlanoKg: 120, ultimoRecomputoISO: null, hojeISO: HOJE })).toBe(true);
  });

  it('em peso baixo o 1 kg domina o 1,5%', () => {
    // 50 kg → limiar = max(1, 0,75) = 1. Variação de 0,9 NÃO recomputa; 1,1 sim.
    expect(deveRecomputar({ suavizadoKg: 50.9, pesoDoPlanoKg: 50, ultimoRecomputoISO: null, hojeISO: HOJE })).toBe(false);
    expect(deveRecomputar({ suavizadoKg: 51.1, pesoDoPlanoKg: 50, ultimoRecomputoISO: null, hojeISO: HOJE })).toBe(true);
  });

  /** 🔒 ACEITE: no máximo 1× por semana, por maior que seja a diferença. */
  it('respeita 1×/semana mesmo com diferença enorme', () => {
    for (const d of [0, 1, 3, 6]) {
      expect(deveRecomputar({ suavizadoKg: 55, pesoDoPlanoKg: 70, ultimoRecomputoISO: dia(d), hojeISO: HOJE }), `${d}d`).toBe(false);
    }
    expect(deveRecomputar({ suavizadoKg: 55, pesoDoPlanoKg: 70, ultimoRecomputoISO: dia(7), hojeISO: HOJE })).toBe(true);
  });

  it('sem suavizado, nunca recomputa', () => {
    expect(deveRecomputar({ suavizadoKg: null, pesoDoPlanoKg: 70, ultimoRecomputoISO: null, hojeISO: HOJE })).toBe(false);
  });
});

describe('🔴 histerese ASSIMÉTRICA do gate — proteger rápido, liberar devagar', () => {
  it('ENTRAR é imediato', () => {
    const r = aplicarHistereseFaixa({ dentroDaFaixaHoje: true, anterior: FAIXA_INICIAL, hojeISO: HOJE });
    expect(r.ativa).toBe(true);
    expect(r.foraDesdeISO).toBeNull();
  });

  it('SAIR exige 14 dias fora da faixa', () => {
    // Dia 0: protegido. Sai da faixa hoje → começa a contar, mas continua protegido.
    let est = { ativa: true, foraDesdeISO: null as string | null };
    est = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: est, hojeISO: dia(14) });
    expect(est.ativa).toBe(true);
    expect(est.foraDesdeISO).toBe(dia(14));

    // 13 dias depois: ainda protegido.
    est = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: est, hojeISO: dia(1) });
    expect(est.ativa).toBe(true);

    // 14 dias depois: sai.
    est = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: est, hojeISO: dia(0) });
    expect(est.ativa).toBe(false);
    expect(est.foraDesdeISO).toBeNull();
  });

  it('voltar para dentro ZERA a contagem (a carência recomeça)', () => {
    let est: FaixaProtetiva = { ativa: true, foraDesdeISO: dia(10) }; // 10 dias fora
    est = aplicarHistereseFaixa({ dentroDaFaixaHoje: true, anterior: est, hojeISO: dia(3) });
    expect(est.ativa).toBe(true);
    expect(est.foraDesdeISO).toBeNull(); // zerou
    // Agora sai de novo: precisa dos 14 completos outra vez.
    est = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: est, hojeISO: dia(2) });
    est = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: est, hojeISO: dia(0) });
    expect(est.ativa, 'saiu antes dos 14 dias').toBe(true);
  });

  it('quem nunca esteve protegido não entra em contagem', () => {
    const r = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: FAIXA_INICIAL, hojeISO: HOJE });
    expect(r).toEqual(FAIXA_INICIAL);
  });
});

describe('🔒 ACEITE — série ruidosa em torno de um corte NÃO faz o gate oscilar', () => {
  /**
   * O caso da spec, verbatim: 61,0 · 63,5 · 61,2 … em torno de um corte de IMC. Sem
   * suavização + histerese, isso seria "RESTRINGIR na terça e livre na quinta" — o gate
   * viraria ruído, e ninguém confia num portão que abre e fecha sozinho.
   */
  const ALTURA = 180; // IMC 18,5 → 59,94 kg · IMC 16 → 51,84 kg

  /**
   * 🔑 MEDIDO, e o resultado corrige o que eu ia afirmar: a média **amortece** a oscilação,
   * mas **não a elimina** quando a média verdadeira cai EM CIMA do corte.
   *
   * Série 61,0 · 58,5 · 61,2 · 58,8 · 61,1 · 59,0 · 60,9 com 1,80 m — o corte de IMC 18,5 é
   * 59,94 kg e o suavizado passeia por 59,9 / 60,0 / 60,1 / 60,2 / 60,3. Cru, o lado do
   * corte muda TODO dia; suavizado, muda uma vez em cinco janelas. É redução real de ruído,
   * não imunidade.
   *
   * 🔒 Quem GARANTE o aceite ("série ruidosa não faz o gate oscilar") é a **histerese
   * assimétrica**, não a média — e é por isso que a spec pede as duas. Afirmar que a média
   * basta seria vender uma proteção que ela não dá.
   */
  it('a média AMORTECE a oscilação do valor cru (mas não a elimina no corte)', () => {
    const s = serie([0, 61.0], [1, 58.5], [2, 61.2], [3, 58.8], [4, 61.1], [5, 59.0], [6, 60.9]);
    const viradasCru = s
      .map((p) => calcularIMC(p.kg, ALTURA) < 18.5)
      .reduce((n, v, i, arr) => (i > 0 && v !== arr[i - 1] ? n + 1 : n), 0);

    const suav: boolean[] = [];
    for (let d = 4; d >= 0; d -= 1) {
      const v = pesoSuavizado(s, dia(d));
      if (v != null) suav.push(calcularIMC(v, ALTURA) < 18.5);
    }
    const viradasSuav = suav.reduce((n, v, i, arr) => (i > 0 && v !== arr[i - 1] ? n + 1 : n), 0);

    expect(viradasCru, 'a série crua precisa oscilar, senão o caso não discrimina').toBeGreaterThanOrEqual(5);
    expect(viradasSuav, 'a média não amorteceu nada').toBeLessThan(viradasCru);
  });

  /**
   * E o cinto de segurança: MESMO que o suavizado cruzasse, a histerese assimétrica só
   * libera depois de 14 dias fora. Simula 21 dias de série ruidosa.
   */
  it('com a histerese, a proteção NÃO pisca nem no pior caso', () => {
    let est = { ativa: true, foraDesdeISO: null as string | null };
    const trocas: boolean[] = [];
    // 21 dias alternando dentro/fora da faixa, um dia sim um dia não.
    for (let d = 20; d >= 0; d -= 1) {
      const dentro = d % 2 === 0;
      est = aplicarHistereseFaixa({ dentroDaFaixaHoje: dentro, anterior: est, hojeISO: dia(d) });
      trocas.push(est.ativa);
    }
    // Nunca desligou: cada volta para dentro zerou a contagem dos 14.
    expect(new Set(trocas).size, 'a proteção oscilou').toBe(1);
    expect(trocas.every(Boolean)).toBe(true);
  });

  it('mas quem MELHOROU de verdade sai — depois dos 14 dias limpos', () => {
    let est = { ativa: true, foraDesdeISO: null as string | null };
    for (let d = 20; d >= 0; d -= 1) {
      est = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: est, hojeISO: dia(d) });
    }
    expect(est.ativa, 'não liberou nem depois de 21 dias fora').toBe(false);
  });
});
