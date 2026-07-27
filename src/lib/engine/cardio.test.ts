import { describe, expect, it } from 'vitest';
import {
  classeDoMet, intensidadesDe, kcalExibida, kcalLiquida, MET_CARDIO, metaCardioComRetomada,
  metaCardioSemanal, metaCumprida, metDe, minutosNaMeta, MODALIDADES_CARDIO, resumoCardioSemana,
  type RegistroCardio,
} from './cardio';

/**
 * Cardio — ancorado na spec TRAVADA do cofre (§Cardio, DF 2026-07-27) e na tabela MET de
 * `outputs/pesquisa-cardio-met-2026-07-27`. Cada número aqui é o número da spec.
 */

describe('tabela MET — um valor central por par (nunca faixa)', () => {
  it('os 5 pares da tabela travada', () => {
    expect(MET_CARDIO.caminhada).toEqual({ leve: 2.3, moderado: 4.3, vigoroso: 5.8 });
    expect(MET_CARDIO.corrida).toEqual({ leve: 7.5, moderado: 8.5, vigoroso: 9.3 });
    expect(MET_CARDIO.bike).toEqual({ leve: 3.8, moderado: 5.5, vigoroso: 7.4 });
    expect(MET_CARDIO.pular_corda).toEqual({ moderado: 9.0, vigoroso: 11.0 });
    expect(MET_CARDIO.lutas).toEqual({ leve: 5.3, moderado: 7.5, vigoroso: 10.3 });
  });

  it('pular corda tem só DOIS baldes — "leve" some da lista, sem erro', () => {
    expect(intensidadesDe('pular_corda')).toEqual(['moderado', 'vigoroso']);
    expect(metDe('pular_corda', 'leve')).toBeNull();
  });

  it('"outro" usa os valores da caminhada (a tela diz que é aproximação)', () => {
    expect(MET_CARDIO.outro).toEqual(MET_CARDIO.caminhada);
  });

  it('as 6 modalidades da spec, e só elas', () => {
    expect([...MODALIDADES_CARDIO]).toEqual(['caminhada', 'corrida', 'bike', 'pular_corda', 'lutas', 'outro']);
  });
});

describe('🔴 a classe sai do MET, NUNCA do rótulo autorrelatado', () => {
  it('os limiares: <3 não conta · 3–6 = 1× · ≥6 = 2×', () => {
    expect(classeDoMet(2.9)).toBe(0);
    expect(classeDoMet(3)).toBe(1);
    expect(classeDoMet(5.9)).toBe(1);
    expect(classeDoMet(6)).toBe(2);
  });

  // Os 3 casos que o critério de aceite nomeia — exatamente os que o rótulo enganaria.
  it('corrida "leve" (7,5) vale 2× — o rótulo diria 0', () => {
    expect(classeDoMet(metDe('corrida', 'leve')!)).toBe(2);
    expect(minutosNaMeta(7.5, 30)).toBe(60);
  });

  it('pular corda "moderado" (9,0) vale 2× — o rótulo diria 1×', () => {
    expect(classeDoMet(metDe('pular_corda', 'moderado')!)).toBe(2);
    expect(minutosNaMeta(9, 20)).toBe(40);
  });

  it('caminhada "vigorosa" (5,8) vale 1× — o rótulo diria 2×', () => {
    expect(classeDoMet(metDe('caminhada', 'vigoroso')!)).toBe(1);
    expect(minutosNaMeta(5.8, 30)).toBe(30);
  });

  it('caminhada leve (2,3) não avança a meta — movimento registrado, não falha', () => {
    expect(minutosNaMeta(metDe('caminhada', 'leve')!, 40)).toBe(0);
  });
});

describe('kcal LÍQUIDA, arredondada à dezena, com piso de exibição', () => {
  it('gasto líquido, não bruto: (MET − 1), não MET', () => {
    // caminhada moderada 30 min, 80 kg → líquido ~139 (o bruto seria ~181).
    const liq = kcalLiquida(4.3, 80, 30);
    expect(Math.round(liq)).toBe(139);
    expect(Math.round(kcalLiquida(4.3, 80, 30) + (3.5 * 80 * 30) / 200)).toBe(181);
  });

  it('exibe arredondado à dezena', () => {
    expect(kcalExibida(139)).toEqual({ piso: false, kcal: 140 });
    expect(kcalExibida(231.6)).toEqual({ piso: false, kcal: 230 });
  });

  it('🔒 abaixo de 10 kcal mostra o piso, NUNCA 0', () => {
    // caminhada moderada de 3 min numa pessoa de 50 kg → ~8,7 kcal.
    const curta = kcalLiquida(4.3, 50, 3);
    expect(curta).toBeLessThan(10);
    expect(kcalExibida(curta)).toEqual({ piso: true });
    expect(kcalExibida(9.99)).toEqual({ piso: true });
    expect(kcalExibida(10)).toEqual({ piso: false, kcal: 10 });
  });

  it('entradas degeneradas não viram NaN na tela', () => {
    expect(kcalLiquida(4.3, 80, 0)).toBe(0);
    expect(kcalLiquida(Number.NaN, 80, 30)).toBe(0);
    expect(kcalExibida(Number.NaN)).toEqual({ piso: true });
  });
});

describe('meta semanal por objetivo (tabela 1.1)', () => {
  it('saúde = 150 min', () => {
    expect(metaCardioSemanal('saude', false)).toEqual({ tipo: 'minutos', alvo: 150 });
  });

  it('emagrecimento = faixa 150–300 min', () => {
    expect(metaCardioSemanal('emagrecimento', false)).toEqual({ tipo: 'minutos', alvo: 150, max: 300 });
  });

  it('🔒 massa = CONTAGEM DE SESSÕES (1–2), nunca minutos', () => {
    expect(metaCardioSemanal('massa', false)).toEqual({ tipo: 'sessoes', alvo: 1, max: 2 });
  });

  it('🔒 ROTEAR: registra, mas NÃO recebe meta', () => {
    expect(metaCardioSemanal('saude', true)).toBeNull();
    expect(metaCardioSemanal('massa', true)).toBeNull();
  });
});

describe('meta durante a rampa de retomada (cai pelo mesmo fator do treino)', () => {
  it('saúde: 150 → 75 (0,50) e 105 (0,70)', () => {
    expect(metaCardioComRetomada({ tipo: 'minutos', alvo: 150 }, 0.5)).toEqual({ tipo: 'minutos', alvo: 75 });
    expect(metaCardioComRetomada({ tipo: 'minutos', alvo: 150 }, 0.7)).toEqual({ tipo: 'minutos', alvo: 105 });
  });

  it('emagrecimento: a faixa escala junto (150–300 → 75–150)', () => {
    expect(metaCardioComRetomada({ tipo: 'minutos', alvo: 150, max: 300 }, 0.5))
      .toEqual({ tipo: 'minutos', alvo: 75, max: 150 });
  });

  it('rampa longa: 0,80 → 120 e 0,90 → 135', () => {
    expect(metaCardioComRetomada({ tipo: 'minutos', alvo: 150 }, 0.8)).toEqual({ tipo: 'minutos', alvo: 120 });
    expect(metaCardioComRetomada({ tipo: 'minutos', alvo: 150 }, 0.9)).toEqual({ tipo: 'minutos', alvo: 135 });
  });

  it('🔒 massa continua CONTAGEM e cai para 1 sessão (o piso da faixa)', () => {
    const m = metaCardioComRetomada({ tipo: 'sessoes', alvo: 1, max: 2 }, 0.5);
    expect(m).toEqual({ tipo: 'sessoes', alvo: 1 });
  });

  it('sem rampa a meta não muda', () => {
    const base = { tipo: 'minutos', alvo: 150, max: 300 } as const;
    expect(metaCardioComRetomada(base, null)).toEqual(base);
    expect(metaCardioComRetomada(base, 1)).toEqual(base);
    expect(metaCardioComRetomada(null, 0.5)).toBeNull();
  });
});

describe('resumo da semana', () => {
  const reg = (modalidade: RegistroCardio['modalidade'], intensidade: RegistroCardio['intensidade'], minutos: number): RegistroCardio => {
    const met = metDe(modalidade, intensidade)!;
    return { modalidade, intensidade, minutos, met, kcal: kcalLiquida(met, 80, minutos) };
  };

  it('soma minutos com o vigoroso em dobro e separa o movimento leve', () => {
    const r = resumoCardioSemana([
      reg('bike', 'moderado', 40),        // 5,5 → 1× → 40
      reg('corrida', 'vigoroso', 20),     // 9,3 → 2× → 40
      reg('caminhada', 'moderado', 30),   // 4,3 → 1× → 30
      reg('caminhada', 'leve', 25),       // 2,3 → 0  → movimento registrado
    ]);
    expect(r.minutosNaMeta).toBe(110);
    expect(r.sessoesNaMeta).toBe(3);
    expect(r.leves).toHaveLength(1);
    expect(r.contam).toHaveLength(3);
  });

  it('a semana vazia é zero, não NaN', () => {
    const r = resumoCardioSemana([]);
    expect(r).toMatchObject({ minutosNaMeta: 0, sessoesNaMeta: 0, kcal: 0 });
  });

  it('meta cumprida: minutos por >= e massa por contagem de sessões', () => {
    const r = resumoCardioSemana([reg('bike', 'moderado', 150)]);
    expect(metaCumprida({ tipo: 'minutos', alvo: 150 }, r)).toBe(true);
    expect(metaCumprida({ tipo: 'sessoes', alvo: 1, max: 2 }, r)).toBe(true);
    expect(metaCumprida(null, r)).toBe(false);
  });

  it('passar de 300 não dispara nada (300 não é teto)', () => {
    const r = resumoCardioSemana([reg('corrida', 'vigoroso', 200)]); // 400 min na meta
    expect(r.minutosNaMeta).toBe(400);
    expect(metaCumprida({ tipo: 'minutos', alvo: 150, max: 300 }, r)).toBe(true);
  });

  it('só o movimento leve → a meta segue em zero, e isso não é falha', () => {
    const r = resumoCardioSemana([reg('caminhada', 'leve', 60)]);
    expect(r.minutosNaMeta).toBe(0);
    expect(r.sessoesNaMeta).toBe(0);
    expect(r.leves).toHaveLength(1);
    expect(r.kcal).toBeGreaterThan(0); // a estimativa existe; só não avança a meta
  });
});
