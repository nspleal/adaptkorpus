import { describe, expect, it } from 'vitest';
import { gerarTreino } from '@/lib/engine';
import type { PerfilTreino } from '@/lib/engine';
import { EXERCISES_SEED } from '@/lib/data/seed';
import { diasPadrao, type Weekday } from '@/lib/semana';
import { seriesEmDeload } from './treino';
import { DELOAD_REDUCAO_VOLUME } from './treino-constants';

/**
 * 🔴 D13 (auditoria 2026-09-11 sobre `a40f8af`) — O VOLUME ENTREGUE, NÃO A CONSTANTE.
 *
 * `deload-fonte-unica.test.ts` (D2) provou que a CONSTANTE chega à prescrição, medindo um
 * perfil só (96 → 48 séries). A auditoria varreu 1.458 e achou 42 em que a semana 6 entregava
 * volume IGUAL OU MAIOR que a 5 — com `semana.deload = true` na tela. Pior caso medido:
 * **20 séries em 5 slots → 32 séries em 16 slots**.
 *
 * O mecanismo não era o `aplicarDeload`: séries menores barateavam o slot, o dia passava a
 * caber com a capacidade CHEIA da tabela e o reduce-to-fit devolvia em EXERCÍCIOS o que fora
 * cortado em séries.
 *
 * 🔒 PLANO-BASE COMPARÁVEL, declarado aqui e no montador: as mesmas entradas e restrições,
 * mudando só a semana do mesociclo para a última de RAMPA (5). A capacidade entregue por ele
 * é o TETO da semana de deload — nunca um alvo, e nunca uma banda percentual imposta à saída.
 */

const base = (o: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 75, alturaCm: 175, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'saude', nivelExperiencia: 'iniciante', equipamento: 'academia',
  diasDisponiveis: 3, treinoDias: diasPadrao(3) as Weekday[], tempoPorSessaoMin: 60, ...o,
});

const perfil = (nivel: PerfilTreino['nivelExperiencia'], objetivo: PerfilTreino['objetivo'], equipamento: PerfilTreino['equipamento'], tempo: number, dias: number) =>
  base({
    nivelExperiencia: nivel, objetivo, equipamento,
    ...(equipamento === 'casa' ? { equipamentosCasa: [] } : {}),
    tempoPorSessaoMin: tempo, diasDisponiveis: dias, treinoDias: diasPadrao(dias) as Weekday[],
  });

function medir(p: PerfilTreino, semana: 5 | 6) {
  const r = gerarTreino(p, { exercises: EXERCISES_SEED, semanaCiclo: { semana } }).rotina!;
  return {
    series: r.dias.reduce((n, d) => n + d.slots.reduce((m, s) => m + (s.series ?? 0), 0), 0),
    slots: r.dias.reduce((n, d) => n + d.slots.length, 0),
    capacidade: Math.max(0, ...r.dias.map((d) => d.slots.length)),
    deload: r.semana?.deload === true,
    terminal: r.resultadoGeracao?.tipo,
  };
}

/** Grade representativa. A varredura completa dos 1.458 vive na regressão da auditoria. */
const GRADE: PerfilTreino[] = [];
for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const)
  for (const obj of ['emagrecimento', 'massa', 'saude'] as const)
    for (const eq of ['academia', 'casa', 'nenhum'] as const)
      for (const t of [10, 30, 60])
        for (const d of [1, 3, 6]) GRADE.push(perfil(nivel, obj, eq, t, d));

describe('D13 · a semana de deload não recompra em exercícios o que cortou em séries', () => {
  it('a capacidade entregue na semana 6 nunca passa a do plano-base (semana 5)', () => {
    const excesso = GRADE.map((p) => ({ p, s5: medir(p, 5), s6: medir(p, 6) }))
      .filter(({ s5, s6 }) => s6.capacidade > s5.capacidade)
      .map(({ p, s5, s6 }) => `${p.nivelExperiencia}/${p.objetivo}/${p.equipamento}/${p.tempoPorSessaoMin}min/${p.diasDisponiveis}d: ${s5.capacidade} → ${s6.capacidade}`);
    expect(excesso).toEqual([]);
  });

  it('o volume ENTREGUE cai sempre que havia volume a cortar', () => {
    const semCorte = GRADE.map((p) => ({ p, s5: medir(p, 5), s6: medir(p, 6) }))
      .filter(({ s5, s6 }) => s5.series > 0 && s6.series >= s5.series)
      .map(({ p, s5, s6 }) => `${p.nivelExperiencia}/${p.objetivo}/${p.equipamento}/${p.tempoPorSessaoMin}min/${p.diasDisponiveis}d: S5=${s5.series} S6=${s6.series}`);
    expect(semCorte).toEqual([]);
  });

  it('a semana 6 continua marcada como deload (o rótulo não foi comprado com silêncio)', () => {
    for (const p of GRADE.slice(0, 12)) expect(medir(p, 6).deload).toBe(true);
  });
});

describe('D13 · os casos nomeados pela auditoria', () => {
  /** Os dois piores casos medidos, com o número de antes ao lado para a comparação não se perder. */
  const CASOS: { nome: string; p: PerfilTreino; antes: string; s5: number; s6: number }[] = [
    { nome: 'avancado/emagrecimento/casa/10min/6d', p: perfil('avancado', 'emagrecimento', 'casa', 10, 6), antes: '20 → 32', s5: 20, s6: 10 },
    { nome: 'avancado/emagrecimento/academia/10min/6d', p: perfil('avancado', 'emagrecimento', 'academia', 10, 6), antes: '24 → 36', s5: 24, s6: 12 },
    { nome: 'iniciante/saude/casa/10min/3d', p: perfil('iniciante', 'saude', 'casa', 10, 3), antes: '18 → 18', s5: 18, s6: 12 },
  ];

  it.each(CASOS)('$nome (antes: $antes)', ({ p }) => {
    const a = medir(p, 5);
    const b = medir(p, 6);
    // Calendário 13/09 pode alterar a composição; os números históricos ficam em CASOS.
    expect(a.series).toBeGreaterThan(0);
    expect(b.series).toBeGreaterThan(0);
    expect(b.series).toBeLessThan(a.series);
    expect(b.slots, 'a estrutura da semana de deload deixou de espelhar a da rampa').toBe(a.slots);
  });

  it('o caso que D2 mediu continua exatamente onde estava (96 → 48)', () => {
    const p = perfil('intermediario', 'massa', 'academia', 60, 4);
    expect(medir(p, 5).series).toBe(96);
    expect(medir(p, 6).series).toBe(48);
  });
});

describe('D13 · os casos de borda, tratados explicitamente', () => {
  it('S5 zero: sem plano-base não há teto a aplicar, e nada quebra', () => {
    const p = base({ diasDisponiveis: 0, treinoDias: [] as Weekday[] });
    expect(() => medir(p, 6)).not.toThrow();
    expect(medir(p, 5).series).toBe(0);
    expect(medir(p, 6).series).toBe(0);
  });

  it('arredondamento: o piso de 1 série é o único ponto em que um slot não encolhe', () => {
    expect(seriesEmDeload(1)).toBe(1);
    expect(seriesEmDeload(2)).toBe(1);
    expect(seriesEmDeload(3)).toBe(2);
    expect(seriesEmDeload(4)).toBe(2);
    // A regra geral que o piso preserva: um slot NUNCA cresce no deload.
    for (const s of [1, 2, 3, 4, 5, 6, 8, 10, 20, 99]) expect(seriesEmDeload(s)).toBeLessThanOrEqual(s);
  });

  it('inviabilidade: o teto não torna inviável uma semana que a rampa entregava', () => {
    const quebrou = GRADE.map((p) => ({ p, s5: medir(p, 5), s6: medir(p, 6) }))
      .filter(({ s5, s6 }) => s5.terminal === 'CERTIFICADO' && s6.terminal === 'INCOMPATIVEL')
      .map(({ p }) => `${p.nivelExperiencia}/${p.objetivo}/${p.equipamento}/${p.tempoPorSessaoMin}min/${p.diasDisponiveis}d`);
    expect(quebrou, 'o teto do plano-base criou inviabilidade onde não havia').toEqual([]);
  });

  it('o deload MANUAL continua sendo aplicado uma única vez sobre a escolha da pessoa', () => {
    const ESCOLHIDAS = 8;
    const ids = ['e14', 'e22', 'e16'];
    const p = base({
      diasDisponiveis: 1, treinoDias: ['seg'] as Weekday[], tempoPorSessaoMin: 90,
      nivelExperiencia: 'intermediario',
      rotinaCustom: {
        origem: 'usuario',
        dias: [{ nome: 'Meu treino', diaId: 'seg', exercicioIds: ids, seriesPorExercicio: Object.fromEntries(ids.map((i) => [i, ESCOLHIDAS])) }],
      },
    });
    const s6 = gerarTreino(p, { exercises: EXERCISES_SEED, semanaCiclo: { semana: 6 } }).rotina!;
    const series = s6.dias.flatMap((d) => d.slots.map((s) => s.series));
    expect(series.length).toBeGreaterThan(0);
    for (const s of series) {
      expect(s, 'a redução do deload foi aplicada duas vezes na escolha manual').toBe(seriesEmDeload(ESCOLHIDAS));
      expect(s).not.toBe(seriesEmDeload(seriesEmDeload(ESCOLHIDAS)));
    }
    // O desenho da pessoa continua inteiro: o deload corta séries, não exercícios.
    expect(s6.dias[0]!.slots.map((s) => s.exercicio.id)).toEqual(ids);
  });
});

describe('D13 · a banda do cofre é de PRESCRIÇÃO, e não vira exigência da saída', () => {
  /**
   * 🔒 O claim `motor-treino-deload-v1--004` prescreve −40–50 % do volume. A parcela ENTREGUE
   * sofre o orçamento de tempo do dia e o piso de 1 série, então ela LEGITIMAMENTE cai fora da
   * banda em parte dos perfis — a auditoria registrou isso como fato medido, não como defeito.
   * Este teste existe para que ninguém "conserte" a banda forçando a saída dentro dela: o que
   * se exige da saída é a REDUÇÃO, não um percentual.
   */
  it('a redução da prescrição usa a constante registrada, sem percentual novo', () => {
    expect(DELOAD_REDUCAO_VOLUME).toBe(0.45);
    expect(seriesEmDeload(20)).toBe(Math.round(20 * (1 - DELOAD_REDUCAO_VOLUME)));
  });

  it('existem perfis cuja redução ENTREGUE fica fora de −40–50 %, e isso não é defeito', () => {
    const razoes = GRADE.map((p) => ({ s5: medir(p, 5), s6: medir(p, 6) }))
      .filter(({ s5 }) => s5.series > 0)
      .map(({ s5, s6 }) => s6.series / s5.series);
    expect(razoes.length).toBeGreaterThan(0);
    expect(razoes.some((r) => r > 0.6 || r < 0.5), 'a saída foi forçada para dentro da banda').toBe(true);
    // O que vale para TODA saída é só isto: o deload entrega menos.
    expect(razoes.every((r) => r < 1)).toBe(true);
  });
});
