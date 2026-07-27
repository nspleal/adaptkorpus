import { describe, expect, it } from 'vitest';
import {
  descansoMinimoSeg, estadoRetomada, faixaDaPausa, freqMaxPorGrupo, irvComCarga,
  irvRespeitaTeto, naJanelaFit, rirAlvoDaRetomada, seriesMaxComCarga, seriesMaxSemCarga,
  tetoSeriesDaRetomada, volumeDaRetomada,
} from './treino-retomada';
import { isoMaisDias } from './treino-mesociclo';
import { VOLUME_NIVEL, RIR_ALVO_POR_SEMANA } from './treino-constants';

/**
 * Rampa de retomada — testes ancorados na spec travada (cofre §"Rampa de retomada",
 * DF 2026-07-27). É feature de SEGURANÇA: cada número aqui vem da diretriz CSCCa/NSCA 2019
 * ou de uma derivação registrada no cofre.
 */
const HOJE = '2026-07-27';
const ha = (dias: number) => isoMaisDias(HOJE, -dias);

describe('gatilho e faixas (14/15 · 56/57)', () => {
  it('≤ 14 dias → NADA muda (e o app não diz nada)', () => {
    expect(faixaDaPausa(0)).toBeNull();
    expect(faixaDaPausa(14)).toBeNull();
    expect(estadoRetomada({ datasSessaoResistida: [ha(14)], hojeISO: HOJE })).toBeNull();
  });

  it('15–56 → rampa CURTA (2 semanas); 57+ → rampa LONGA (4 semanas)', () => {
    expect(faixaDaPausa(15)).toBe('curta');
    expect(faixaDaPausa(56)).toBe('curta');
    expect(faixaDaPausa(57)).toBe('longa');
    expect(estadoRetomada({ datasSessaoResistida: [ha(15)], hojeISO: HOJE })?.faixa).toBe('curta');
    expect(estadoRetomada({ datasSessaoResistida: [ha(57)], hojeISO: HOJE })?.faixa).toBe('longa');
  });

  it('quem nunca treinou NÃO está em retomada (é começo, não volta)', () => {
    expect(estadoRetomada({ datasSessaoResistida: [], hojeISO: HOJE })).toBeNull();
  });
});

describe('fatores NÃO compostos, sobre o volume de referência', () => {
  it('curta = 0,50 · 0,70; longa = 0,50 · 0,70 · 0,80 · 0,90', () => {
    // pausa fechada: voltou a treinar e as semanas correm da volta
    const curta = (semana: number) => estadoRetomada({
      datasSessaoResistida: [ha(40), ha(7 * (semana - 1))], hojeISO: HOJE,
    });
    expect(curta(1)?.fator).toBe(0.5);
    expect(curta(2)?.fator).toBe(0.7);
    // a pessoa volta e SEGUE treinando (senão ela está em pausa nova, não na semana N)
    const longa = (semana: number) => {
      const volta = 7 * (semana - 1);
      const depois = [];
      for (let d = volta; d >= 0; d -= 7) depois.push(ha(d));
      return estadoRetomada({ datasSessaoResistida: [ha(200), ...depois], hojeISO: HOJE });
    };
    expect([1, 2, 3, 4].map((s) => longa(s)?.fator)).toEqual([0.5, 0.7, 0.8, 0.9]);
    expect([1, 2, 3, 4].map((s) => longa(s)?.semana)).toEqual([1, 2, 3, 4]);
  });

  it('a semana 2 é 70% da REFERÊNCIA, não 70% da semana 1 (não composto)', () => {
    const referencia = 16;
    expect(volumeDaRetomada(referencia, 0.7)).toBe(11); // 11,2 → 11
    expect(volumeDaRetomada(volumeDaRetomada(referencia, 0.5), 0.7)).toBe(5); // composto daria 5
  });
});

describe('🔴 volume ABAIXO do piso da banda (o estado que o motor não tinha)', () => {
  it('massa/intermediário: a rampa entrega MENOS que a semana 1 do mesociclo', () => {
    const banda = VOLUME_NIVEL.intermediario.volumePorGrupoSemana.massa; // {13, 16}
    const piso = banda.min; // 13 — o que "recuar para a semana 1" entregaria (−19%)
    const rampa = volumeDaRetomada(banda.max, 0.5); // 8
    expect(rampa).toBeLessThan(piso); // se isto falhar, entregamos ~40% da redução devida
    expect(rampa).toBe(8);
  });

  it('arredonda para BAIXO — erro sempre para o lado seguro (3→1, 5→2, 7→3)', () => {
    expect(volumeDaRetomada(3, 0.5)).toBe(1);
    expect(volumeDaRetomada(5, 0.5)).toBe(2);
    expect(volumeDaRetomada(7, 0.5)).toBe(3);
  });

  it('nunca zera: o piso absoluto do volume é 1 série', () => {
    expect(volumeDaRetomada(1, 0.5)).toBe(1);
    expect(volumeDaRetomada(0, 0.5)).toBe(1);
  });
});

describe('IRV ≤ 30 — guarda-corpo DURO (teste determinístico exigido pelo aceite)', () => {
  it('com carga: séries × reps × %1RM ≤ 30', () => {
    expect(irvComCarga(3, 10, 0.73)).toBeCloseTo(21.9, 5);
    expect(irvRespeitaTeto(3, 10, 0.73)).toBe(true);
    // o perfil que a própria diretriz deixava passar na semana 2 (IRV ≈ 36): o teto corta
    expect(irvRespeitaTeto(5, 10, 0.73)).toBe(false);
    expect(seriesMaxComCarga(10, 0.73)).toBe(4);
    expect(irvRespeitaTeto(seriesMaxComCarga(10, 0.73), 10, 0.73)).toBe(true);
  });

  it('SEM carga o IRV é incomputável → teto fixo de 3 séries por grupo/sessão', () => {
    expect(seriesMaxSemCarga()).toBe(3);
    expect(tetoSeriesDaRetomada({ comCarga: false })).toBe(3);
    // é a população de risco dos casos da fonte (peso corporal até a fadiga)
    expect(tetoSeriesDaRetomada({ comCarga: false, reps: 40 })).toBe(3);
  });

  it('o teto com carga nunca desce abaixo de 1 série (entrada absurda não zera a sessão)', () => {
    expect(seriesMaxComCarga(100, 0.9)).toBe(1);
    expect(seriesMaxComCarga(0, 0)).toBe(1);
  });
});

describe('regra FIT: frequência, descanso e janela de 2 semanas', () => {
  it('frequência por GRUPO: máx 3 na semana 1, 4 na semana 2, livre depois', () => {
    expect(freqMaxPorGrupo(1)).toBe(3);
    expect(freqMaxPorGrupo(2)).toBe(4);
    expect(freqMaxPorGrupo(3)).toBe(Infinity);
  });

  it('descanso mínimo 120 s / 90 s — ELEVA o mínimo do isolado (v1: 60–90 s)', () => {
    expect(descansoMinimoSeg(1)).toBe(120);
    expect(descansoMinimoSeg(2)).toBe(90);
    expect(descansoMinimoSeg(3)).toBe(0);
    expect(descansoMinimoSeg(1)).toBeGreaterThan(90); // acima do teto do isolado do v1
  });

  it('a janela FIT (e a suspensão da B5) vale nas 2 primeiras semanas', () => {
    expect(naJanelaFit(1)).toBe(true);
    expect(naJanelaFit(2)).toBe(true);
    expect(naJanelaFit(3)).toBe(false);
  });
});

describe('🔴 RIR-alvo na rampa = 3, nunca o RIR da semana em que parou', () => {
  it('quem parou na semana 5 (RIR 1) volta com RIR 3, não 1', () => {
    const rirDaSemana5 = RIR_ALVO_POR_SEMANA[4]; // 1 — o valor que o erro entregaria
    expect(rirDaSemana5).toBe(1);
    expect(rirAlvoDaRetomada(1)).toBe(3); // piso global 1 (interm./avançado)
    expect(rirAlvoDaRetomada(1)).toBeGreaterThan(rirDaSemana5);
  });

  it('o piso do nível continua valendo (iniciante nunca abaixo de 2; saúde 2)', () => {
    expect(rirAlvoDaRetomada(2)).toBe(3);
    expect(rirAlvoDaRetomada(4)).toBe(4); // piso maior que 3 vence
  });
});

describe('derivação sem estado novo (gatilho = pausa mais recente)', () => {
  it('pausa AINDA ABERTA → semana 1, à espera da volta', () => {
    const r = estadoRetomada({ datasSessaoResistida: [ha(30)], hojeISO: HOJE })!;
    expect(r).toMatchObject({ ativa: true, faixa: 'curta', semana: 1, pausaAberta: true });
  });

  it('depois da volta, as semanas correm da 1ª sessão de volta', () => {
    // pausa de 40 d; voltou há 8 dias → semana 2 da rampa curta
    const r = estadoRetomada({ datasSessaoResistida: [ha(48), ha(8)], hojeISO: HOJE })!;
    expect(r.semana).toBe(2);
    expect(r.fator).toBe(0.7);
    expect(r.pausaAberta).toBe(false);
  });

  it('rampa CONCLUÍDA → null (o ciclo recomeça no piso, não emenda na semana 3)', () => {
    // curta = 2 semanas; voltou há 15 dias e seguiu treinando → a rampa terminou
    expect(estadoRetomada({ datasSessaoResistida: [ha(55), ha(15), ha(8), ha(1)], hojeISO: HOJE })).toBeNull();
  });

  it('parar de novo DURANTE a rampa recalcula sozinho pela pausa mais recente', () => {
    // pausa antiga longa, voltou, parou 20 d de novo, voltou hoje → curta, semana 1
    const r = estadoRetomada({ datasSessaoResistida: [ha(200), ha(150), ha(20), ha(0)], hojeISO: HOJE })!;
    expect(r.faixa).toBe('curta');
    expect(r.semana).toBe(1);
    expect(r.fator).toBe(0.5);
  });

  it('treino contínuo (sem pausa acima do gatilho) → sem rampa', () => {
    const datas = [0, 3, 7, 10, 14, 17, 21].map((d) => ha(d));
    expect(estadoRetomada({ datasSessaoResistida: datas, hojeISO: HOJE })).toBeNull();
  });

  it('determinístico: ordem das datas e duplicatas não mudam o resultado', () => {
    const a = estadoRetomada({ datasSessaoResistida: [ha(48), ha(8)], hojeISO: HOJE });
    const b = estadoRetomada({ datasSessaoResistida: [ha(8), ha(48), ha(8)], hojeISO: HOJE });
    expect(a).toEqual(b);
  });
});
