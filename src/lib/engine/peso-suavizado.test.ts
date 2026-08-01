import { describe, expect, it } from 'vitest';
import {
  DIAS_PARA_SAIR_DA_FAIXA, FAIXA_INICIAL, HISTERESE_FRACAO, HISTERESE_KG,
  INTERVALO_MIN_RECOMPUTO_DIAS, JANELA_SUAVIZACAO_DIAS, MIN_REGISTROS_SUAVIZACAO,
  aplicarHistereseFaixa, deveRecomputar, naJanela, pesoEfetivo, pesoSuavizado, resolverPesoDoPlano,
  reancorar,
  type EstadoPesoPlano, type FaixaProtetiva, type Pesagem,
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
    const r = aplicarHistereseFaixa({ dentroDaFaixaHoje: true, anterior: FAIXA_INICIAL, hojeISO: HOJE, ancoraMedida: true });
    expect(r.ativa).toBe(true);
    expect(r.foraDesdeISO).toBeNull();
  });

  it('SAIR exige 14 dias fora da faixa', () => {
    // Dia 0: protegido. Sai da faixa hoje → começa a contar, mas continua protegido.
    let est = { ativa: true, foraDesdeISO: null as string | null, porMedicao: true };
    est = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: est, hojeISO: dia(14), ancoraMedida: true });
    expect(est.ativa).toBe(true);
    expect(est.foraDesdeISO).toBe(dia(14));

    // 13 dias depois: ainda protegido.
    est = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: est, hojeISO: dia(1), ancoraMedida: true });
    expect(est.ativa).toBe(true);

    // 14 dias depois: sai.
    est = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: est, hojeISO: dia(0), ancoraMedida: true });
    expect(est.ativa).toBe(false);
    expect(est.foraDesdeISO).toBeNull();
  });

  it('voltar para dentro ZERA a contagem (a carência recomeça)', () => {
    let est: FaixaProtetiva = { ativa: true, foraDesdeISO: dia(10), porMedicao: true }; // 10 dias fora
    est = aplicarHistereseFaixa({ dentroDaFaixaHoje: true, anterior: est, hojeISO: dia(3), ancoraMedida: true });
    expect(est.ativa).toBe(true);
    expect(est.foraDesdeISO).toBeNull(); // zerou
    // Agora sai de novo: precisa dos 14 completos outra vez.
    est = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: est, hojeISO: dia(2), ancoraMedida: true });
    est = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: est, hojeISO: dia(0), ancoraMedida: true });
    expect(est.ativa, 'saiu antes dos 14 dias').toBe(true);
  });

  it('quem nunca esteve protegido não entra em contagem', () => {
    const r = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: FAIXA_INICIAL, hojeISO: HOJE, ancoraMedida: true });
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
    let est = { ativa: true, foraDesdeISO: null as string | null, porMedicao: true };
    const trocas: boolean[] = [];
    // 21 dias alternando dentro/fora da faixa, um dia sim um dia não.
    for (let d = 20; d >= 0; d -= 1) {
      const dentro = d % 2 === 0;
      est = aplicarHistereseFaixa({ dentroDaFaixaHoje: dentro, anterior: est, hojeISO: dia(d), ancoraMedida: true });
      trocas.push(est.ativa);
    }
    // Nunca desligou: cada volta para dentro zerou a contagem dos 14.
    expect(new Set(trocas).size, 'a proteção oscilou').toBe(1);
    expect(trocas.every(Boolean)).toBe(true);
  });

  it('mas quem MELHOROU de verdade sai — depois dos 14 dias limpos', () => {
    let est = { ativa: true, foraDesdeISO: null as string | null, porMedicao: true };
    for (let d = 20; d >= 0; d -= 1) {
      est = aplicarHistereseFaixa({ dentroDaFaixaHoje: false, anterior: est, hojeISO: dia(d), ancoraMedida: true });
    }
    expect(est.ativa, 'não liberou nem depois de 21 dias fora').toBe(false);
  });
});

/* ══════════════════ resolverPesoDoPlano — as três camadas juntas ══════════════════ */

describe('resolverPesoDoPlano — suavização + histerese de recomputo + carência da faixa', () => {
  /** Faixa protetiva de mentira, mas com FORMA de gate: abaixo de um corte, protege. */
  const abaixoDe = (corte: number) => (kg: number) => kg < corte;
  const nunca = () => false;

  it('sem âncora e com janela cheia, o plano NASCE no suavizado — evento de MIGRAÇÃO', () => {
    const r = resolverPesoDoPlano({
      pesagens: serie([0, 61.0], [1, 61.4], [2, 61.2]),
      hojeISO: HOJE, pesoPerfilKg: 70, anterior: null, emFaixaProtetiva: nunca,
    });
    expect(r.pesoKg).toBe(61.2);
    expect(r.evento).toBe('migracao');
    expect(r.estado.ancoraKg).toBe(61.2);
    expect(r.estado.ancoraDesdeISO).toBe(HOJE);
  });

  /** 🔒 ACEITE: < 3 registros usa o valor VIGENTE — e isso não é migração nenhuma. */
  it('sem janela suficiente, cai no peso do perfil e não marca evento', () => {
    const r = resolverPesoDoPlano({
      pesagens: serie([0, 61.0], [1, 61.4]),
      hojeISO: HOJE, pesoPerfilKg: 70, anterior: null, emFaixaProtetiva: nunca,
    });
    expect(r.pesoKg).toBe(70);
    expect(r.evento).toBeNull();
  });

  it('migração NÃO é marcada quando o suavizado bate com o peso do perfil', () => {
    const r = resolverPesoDoPlano({
      pesagens: serie([0, 70], [1, 70], [2, 70]),
      hojeISO: HOJE, pesoPerfilKg: 70, anterior: null, emFaixaProtetiva: nunca,
    });
    expect(r.pesoKg).toBe(70);
    expect(r.evento).toBeNull();
  });

  /** 🔒 ACEITE: uma pesagem isolada não muda o alvo — nem via recomputo. */
  it('com âncora fixada ontem, um tranco de 3 kg NÃO move o plano (falta a semana)', () => {
    const anterior = {
      ancoraKg: 61.2, ancoraDesdeISO: dia(1), ancoraMedida: true, faixa: FAIXA_INICIAL, pesoNaFaixaKg: null, reancoraISO: null,
    };
    const r = resolverPesoDoPlano({
      pesagens: serie([0, 64.2], [1, 64.2], [2, 64.2]),
      hojeISO: HOJE, pesoPerfilKg: 70, anterior, emFaixaProtetiva: nunca,
    });
    expect(r.pesoKg).toBe(61.2);
    expect(r.evento).toBeNull();
    expect(r.estado.ancoraDesdeISO, 'a âncora não pode rejuvenescer sem se mover').toBe(dia(1));
  });

  it('passada a semana E vencido o limiar, a âncora anda — evento de RECOMPUTO', () => {
    const anterior = {
      ancoraKg: 61.2, ancoraDesdeISO: dia(8), ancoraMedida: true, faixa: FAIXA_INICIAL, pesoNaFaixaKg: null, reancoraISO: null,
    };
    const r = resolverPesoDoPlano({
      pesagens: serie([0, 64.2], [1, 64.2], [2, 64.2]),
      hojeISO: HOJE, pesoPerfilKg: 70, anterior, emFaixaProtetiva: nunca,
    });
    expect(r.pesoKg).toBe(64.2);
    expect(r.evento).toBe('recomputo');
    expect(r.estado.ancoraDesdeISO).toBe(HOJE);
  });

  it('passada a semana mas SEM vencer o limiar, nada anda', () => {
    const anterior = {
      ancoraKg: 61.2, ancoraDesdeISO: dia(30), ancoraMedida: true, faixa: FAIXA_INICIAL, pesoNaFaixaKg: null, reancoraISO: null,
    };
    const r = resolverPesoDoPlano({
      pesagens: serie([0, 61.5], [1, 61.5], [2, 61.5]), // 0,3 kg < max(1; 0,918)
      hojeISO: HOJE, pesoPerfilKg: 70, anterior, emFaixaProtetiva: nunca,
    });
    expect(r.pesoKg).toBe(61.2);
    expect(r.evento).toBeNull();
  });

  /**
   * 🔒 ACEITE (o que a MEDIÇÃO obrigou a travar): a média sozinha NÃO impede o gate de
   * oscilar — ela só reduz a frequência. É a carência de 14 dias que segura o portão. Aqui
   * a âncora sai da faixa e mesmo assim o plano continua sendo gerado com o peso de dentro.
   */
  it('ao SAIR da faixa, o plano continua no peso de dentro durante a carência', () => {
    const anterior = {
      ancoraKg: 59.9, ancoraDesdeISO: dia(8), ancoraMedida: true,
      faixa: { ativa: true, foraDesdeISO: null, porMedicao: true }, pesoNaFaixaKg: 59.9, reancoraISO: null,
    };
    const r = resolverPesoDoPlano({
      pesagens: serie([0, 61.0], [1, 61.0], [2, 61.0]),
      hojeISO: HOJE, pesoPerfilKg: 70, anterior, emFaixaProtetiva: abaixoDe(60),
    });
    expect(r.estado.ancoraKg, 'a âncora anda normalmente').toBe(61);
    expect(r.estado.faixa.ativa, 'a proteção não pode cair no mesmo dia').toBe(true);
    expect(r.estado.faixa.foraDesdeISO).toBe(HOJE);
    expect(r.pesoKg, 'o plano tem de continuar sendo gerado no peso protegido').toBe(59.9);
  });

  it('cumpridos os 14 dias, a carência acaba e o plano passa a usar a âncora', () => {
    const anterior = {
      ancoraKg: 61.0, ancoraDesdeISO: dia(20), ancoraMedida: true,
      faixa: { ativa: true, foraDesdeISO: dia(DIAS_PARA_SAIR_DA_FAIXA), porMedicao: true }, pesoNaFaixaKg: 59.9, reancoraISO: null,
    };
    const r = resolverPesoDoPlano({
      pesagens: serie([0, 61.0], [1, 61.0], [2, 61.0]),
      hojeISO: HOJE, pesoPerfilKg: 70, anterior, emFaixaProtetiva: abaixoDe(60),
    });
    expect(r.estado.faixa.ativa).toBe(false);
    expect(r.estado.pesoNaFaixaKg).toBeNull();
    expect(r.pesoKg).toBe(61);
  });

  it('ENTRAR na faixa é imediato — sem carência nenhuma', () => {
    const r = resolverPesoDoPlano({
      pesagens: serie([0, 59.5], [1, 59.5], [2, 59.5]),
      hojeISO: HOJE, pesoPerfilKg: 70, anterior: null, emFaixaProtetiva: abaixoDe(60),
    });
    expect(r.estado.faixa.ativa).toBe(true);
    expect(r.estado.pesoNaFaixaKg).toBe(59.5);
    expect(r.pesoKg).toBe(59.5);
  });

  /**
   * O caso que junta tudo: série ruidosa em torno do corte, 30 dias. Com as três camadas,
   * o COMPORTAMENTO do gate não pode piscar uma única vez.
   */
  it('30 dias de série ruidosa em torno do corte → zero oscilação do gate', () => {
    const corte = 60;
    const emFaixa = abaixoDe(corte);
    // Ruído ±1,2 kg em torno de 60,0 — cruza o corte quase todo dia.
    const ruido = [-1.2, 0.9, -0.6, 1.1, -1.0, 0.4, 0.8, -0.9, 1.2, -0.3];
    const pesagens: Pesagem[] = [];
    for (let d = 34; d >= 0; d -= 1) pesagens.push({ dataISO: dia(d), kg: 60 + ruido[d % 10]! });

    let estado = null as null | ReturnType<typeof resolverPesoDoPlano>['estado'];
    const protegido: boolean[] = [];
    for (let d = 29; d >= 0; d -= 1) {
      const r = resolverPesoDoPlano({
        pesagens, hojeISO: dia(d), pesoPerfilKg: 70, anterior: estado, emFaixaProtetiva: emFaixa,
      });
      estado = r.estado;
      protegido.push(emFaixa(r.pesoKg));
    }
    const viradas = protegido.filter((v, i) => i > 0 && v !== protegido[i - 1]).length;
    expect(viradas, `o gate piscou ${viradas} vezes`).toBe(0);
    // ⚠️ Anti-vacuidade nº 1: "nunca protegeu" também dá zero viradas e não provaria nada.
    expect(protegido[0], 'o caso precisa começar protegido').toBe(true);

    // Anti-vacuidade: a MESMA série, lida crua (última pesagem), pisca muito.
    const cru = pesagens.slice(-30).map((p) => emFaixa(p.kg));
    const viradasCru = cru.filter((v, i) => i > 0 && v !== cru[i - 1]).length;
    expect(viradasCru, 'a série crua precisa oscilar, senão o caso não discrimina').toBeGreaterThanOrEqual(5);
  });

  it('IMC de verdade: o corte 18,5 lido pelo gate não vira ruído com a série ruidosa', () => {
    // Ancorado no motor real: 1,70 m e IMC 18,5 → 53,465 kg.
    const alturaCm = 170;
    const emFaixa = (kg: number) => calcularIMC(kg, alturaCm) < 18.5;
    expect(emFaixa(53.4), 'o caso precisa começar DENTRO da faixa').toBe(true);
    expect(emFaixa(53.6)).toBe(false);
    const pesagens: Pesagem[] = [];
    for (let d = 20; d >= 0; d -= 1) pesagens.push({ dataISO: dia(d), kg: d % 2 === 0 ? 53.3 : 53.7 });
    let estado = null as null | ReturnType<typeof resolverPesoDoPlano>['estado'];
    const protegido: boolean[] = [];
    for (let d = 14; d >= 0; d -= 1) {
      const r = resolverPesoDoPlano({
        pesagens, hojeISO: dia(d), pesoPerfilKg: 70, anterior: estado, emFaixaProtetiva: emFaixa,
      });
      estado = r.estado;
      protegido.push(emFaixa(r.pesoKg));
    }
    expect(new Set(protegido).size, 'o gate piscou com IMC real').toBe(1);
  });
});

/* ══════════════════ Reancoragem manual (Editar perfil) ══════════════════ */

describe('🔒 editar o perfil REANCORA — e não abre porta dos fundos no gate', () => {
  const nunca = () => false;
  const abaixoDe = (corte: number) => (kg: number) => kg < corte;
  const resolver = (pesagens: Pesagem[], hoje: string, anterior: EstadoPesoPlano | null, faixa: (kg: number) => boolean = nunca) =>
    resolverPesoDoPlano({ pesagens, hojeISO: hoje, pesoPerfilKg: 70, anterior, emFaixaProtetiva: faixa });

  /**
   * 🔴 O DEFEITO QUE A REGRA CORRIGIDA FECHA: com a redação antiga ("o suavizado vence
   * quando existe"), quem digitasse 65 com três pesagens em 61,4 continuaria em 61,4 — a
   * correção manual era inócua e não havia saída nenhuma.
   */
  it('o valor digitado vale NA HORA, mesmo com janela cheia discordando', () => {
    const pesagens = serie([0, 61.4], [1, 61.2], [2, 61.6]);
    const antes = resolver(pesagens, HOJE, null);
    expect(antes.pesoKg, 'sem edição, a série manda').toBe(61.4);

    const est = reancorar(antes.estado, 65, HOJE);
    expect(est.ancoraKg).toBe(65);
    expect(est.reancoraISO).toBe(HOJE);
    // E resolver logo em seguida NÃO desfaz a edição: as pesagens são todas anteriores.
    expect(resolver(pesagens, HOJE, est).pesoKg).toBe(65);
  });

  it('a série NÃO retoma com pesagens anteriores à edição, por mais que sejam', () => {
    const est = reancorar(null, 65, dia(3));
    // Seis pesagens, todas de ANTES da edição — nenhuma conta.
    const antigas = serie([4, 61], [5, 61], [6, 61], [7, 61], [8, 61], [9, 61]);
    const r = resolver(antigas, dia(0), est);
    expect(r.pesoKg).toBe(65);
    expect(r.estado.reancoraISO, 'a marca não pode cair sem registro novo').toBe(dia(3));
  });

  it('com ≥ 3 pesagens POSTERIORES, a série retoma — sem esperar mais uma semana', () => {
    const est = reancorar(null, 65, dia(4));
    const novas = serie([1, 61.4], [2, 61.2], [3, 61.6]); // todas depois de dia(4)
    const r = resolver(novas, dia(0), est);
    expect(r.pesoKg).toBe(61.4);
    expect(r.evento).toBe('recomputo');
    expect(r.estado.reancoraISO, 'a marca cai quando a série volta').toBeNull();
  });

  it('duas posteriores ainda não bastam (o mínimo de 3 continua valendo)', () => {
    const est = reancorar(null, 65, dia(4));
    const r = resolver(serie([1, 61.4], [2, 61.2]), dia(0), est);
    expect(r.pesoKg).toBe(65);
    expect(r.estado.reancoraISO).toBe(dia(4));
  });

  it('retomada que CONCORDA com o digitado não move o plano (limiar continua valendo)', () => {
    const est = reancorar(null, 61.5, dia(4));
    const r = resolver(serie([1, 61.4], [2, 61.4], [3, 61.4]), dia(0), est);
    expect(r.pesoKg, 'diferença de 0,1 kg não justifica recomputo').toBe(61.5);
    expect(r.estado.reancoraISO, 'mas a série já retomou').toBeNull();
  });

  /**
   * 🔴 A PORTA DOS FUNDOS. Digitar um número move o peso do PLANO; sair de faixa protetiva
   * continua exigindo os 14 dias. Sem esta linha, o gate teria uma saída por teclado — e o
   * gate é a única parte que não pode ter porta dos fundos (spec §4, 2026-07-31).
   */
  it('reancorar NÃO encurta a carência de saída da faixa protetiva', () => {
    const dentro = abaixoDe(60);
    // Estado: protegido, com o peso de dentro pinado.
    const est0: EstadoPesoPlano = {
      ancoraKg: 59.5, ancoraDesdeISO: dia(20), ancoraMedida: true,
      faixa: { ativa: true, foraDesdeISO: null, porMedicao: true }, pesoNaFaixaKg: 59.5, reancoraISO: null,
    };
    const est1 = reancorar(est0, 70, dia(10)); // a pessoa digita 70
    expect(est1.faixa.ativa, 'a faixa atravessa a reancoragem intacta').toBe(true);
    expect(est1.pesoNaFaixaKg, 'o pino também').toBe(59.5);

    // No dia seguinte à edição: o plano continua no peso protegido.
    const d1 = resolver([], dia(9), est1, dentro);
    expect(d1.estado.faixa.ativa).toBe(true);
    expect(d1.pesoKg, 'o teclado não abriu o portão').toBe(59.5);

    // 13 dias depois da saída: ainda protegido.
    let est = d1.estado;
    for (let d = 8; d >= 1; d -= 1) est = resolver([], dia(d), est, dentro).estado;
    expect(est.faixa.ativa, 'liberou antes dos 14 dias').toBe(true);

    // No 14º dia contado a partir da saída, a carência acaba — e aí o 70 vale.
    const fim = resolver([], dia(-5), est, dentro);
    expect(fim.estado.faixa.ativa).toBe(false);
    expect(fim.pesoKg).toBe(70);
  });

  it('anti-vacuidade: FORA de faixa protetiva, o digitado vale imediatamente', () => {
    const est0: EstadoPesoPlano = {
      ancoraKg: 61.4, ancoraDesdeISO: dia(20), ancoraMedida: true, faixa: FAIXA_INICIAL, pesoNaFaixaKg: null, reancoraISO: null,
    };
    const r = resolver([], dia(10), reancorar(est0, 70, dia(10)), abaixoDe(60));
    expect(r.pesoKg).toBe(70);
    expect(r.estado.faixa.ativa).toBe(false);
  });
});

/* ══════════ Carência PROPORCIONAL À EVIDÊNCIA DA ENTRADA (spec §4, refinamento) ══════════ */

describe('🔻 a saída da faixa é proporcional à evidência que fez ENTRAR', () => {
  const abaixoDe = (corte: number) => (kg: number) => kg < corte;
  const resolver = (
    pesagens: Pesagem[], hoje: string, anterior: EstadoPesoPlano | null,
    faixa: (kg: number) => boolean,
  ) => resolverPesoDoPlano({ pesagens, hojeISO: hoje, pesoPerfilKg: 70, anterior, emFaixaProtetiva: faixa });

  it('entrada por TECLADO carimba `porMedicao: false`', () => {
    // Sem pesagem nenhuma: a âncora é a semente do perfil — teclado, não medição.
    const r = resolverPesoDoPlano({
      pesagens: [], hojeISO: HOJE, pesoPerfilKg: 45, anterior: null,
      emFaixaProtetiva: abaixoDe(60),
    });
    expect(r.estado.ancoraMedida).toBe(false);
    expect(r.estado.faixa).toEqual({ ativa: true, foraDesdeISO: null, porMedicao: false });
  });

  it('entrada por MEDIÇÃO carimba `porMedicao: true`', () => {
    const r = resolverPesoDoPlano({
      pesagens: serie([0, 59.5], [1, 59.5], [2, 59.5]), hojeISO: HOJE, pesoPerfilKg: 70,
      anterior: null, emFaixaProtetiva: abaixoDe(60),
    });
    expect(r.estado.ancoraMedida).toBe(true);
    expect(r.estado.faixa.porMedicao).toBe(true);
  });

  /**
   * 🔴 O CASO CONCRETO QUE OBRIGOU O REFINAMENTO: 45 kg digitado por engano num perfil de 70
   * (→ faixa protetiva). Como estava, corrigir para 70 no minuto seguinte deixava a pessoa
   * 14 dias sem plano — a trava que fecha a fuga por teclado punia o erro de digitação.
   */
  it('digitou errado → corrigiu → sai NA HORA', () => {
    const dentro = abaixoDe(60);
    const errado = resolverPesoDoPlano({
      pesagens: [], hojeISO: HOJE, pesoPerfilKg: 45, anterior: null, emFaixaProtetiva: dentro,
    });
    expect(errado.estado.faixa.ativa, 'o caso precisa começar protegido').toBe(true);

    const corrigido = resolver([], HOJE, reancorar(errado.estado, 70, HOJE), dentro);
    expect(corrigido.estado.faixa.ativa, 'segurou um erro de digitação').toBe(false);
    expect(corrigido.pesoKg, 'o plano tem de usar o valor corrigido na hora').toBe(70);
  });

  /**
   * 🔒 E A PORTA DOS FUNDOS, que continua fechada — é o mesmo gesto, com evidência atrás da
   * entrada: três pesagens em faixa protetiva e um número digitado para escapar.
   */
  it('entrou MEDIDO → digitar não abre: os 14 dias continuam valendo', () => {
    const dentro = abaixoDe(60);
    const medido = resolverPesoDoPlano({
      pesagens: serie([0, 59.5], [1, 59.5], [2, 59.5]), hojeISO: HOJE, pesoPerfilKg: 70,
      anterior: null, emFaixaProtetiva: dentro,
    });
    expect(medido.estado.faixa.porMedicao).toBe(true);

    // Digita 70 no dia seguinte.
    let est = reancorar(medido.estado, 70, dia(-1));
    const d1 = resolver([], dia(-1), est, dentro);
    expect(d1.estado.faixa.ativa, 'o teclado abriu o portão').toBe(true);
    expect(d1.pesoKg, 'o plano tem de continuar no peso protegido').toBe(59.5);

    // 13 dias fora: ainda protegido.
    est = d1.estado;
    for (let d = 2; d <= 13; d += 1) est = resolver([], dia(-d), est, dentro).estado;
    expect(est.faixa.ativa).toBe(true);

    // No 14º, a carência acaba — e só então o 70 vale.
    const fim = resolver([], dia(-15), est, dentro);
    expect(fim.estado.faixa.ativa).toBe(false);
    expect(fim.pesoKg).toBe(70);
  });

  it('se o valor corrigido cair em OUTRA faixa protetiva, a entrada é imediata de novo', () => {
    // Faixa dos dois lados: < 60 e > 100 (o gate real tem baixo peso E obesidade).
    const dentro = (kg: number) => kg < 60 || kg > 100;
    const errado = resolverPesoDoPlano({
      pesagens: [], hojeISO: HOJE, pesoPerfilKg: 45, anterior: null, emFaixaProtetiva: dentro,
    });
    const corrigido = resolver([], HOJE, reancorar(errado.estado, 130, HOJE), dentro);
    expect(corrigido.estado.faixa.ativa, 'a assimetria de ENTRADA não muda').toBe(true);
    expect(corrigido.estado.faixa.porMedicao, 'e a nova entrada também é por teclado').toBe(false);
    expect(corrigido.pesoKg).toBe(130);
  });

  it('a procedência ATRAVESSA os dias em que nada acontece', () => {
    const dentro = abaixoDe(60);
    let est = resolverPesoDoPlano({
      pesagens: serie([0, 59.5], [1, 59.5], [2, 59.5]), hojeISO: HOJE, pesoPerfilKg: 70,
      anterior: null, emFaixaProtetiva: dentro,
    }).estado;
    for (let d = 1; d <= 5; d += 1) est = resolver([], dia(-d), est, dentro).estado;
    expect(est.ancoraMedida, 'a âncora medida virou teclado sozinha').toBe(true);
    expect(est.faixa.porMedicao).toBe(true);
  });
});
