/**
 * REGRESSÃO D13 — auditoria 2026-09-11, snapshot a40f8af36cca9ce6b86919ed8869dff7e6a0a050.
 *
 * CONTRATO DOCUMENTAL (cofre NOVO, HEAD 847af19afc070ee9d43b83d63f378c55ce801814,
 * `wiki/motor-treino-deload-v1.md`, claim `motor-treino-deload-v1--004`, estado `confirmed`):
 *   "Prescrição do deload: −40–50% do volume (corta ~metade das séries) e/ou −10% de carga."
 * e `wiki/motor-treino-mesociclo-decisoes-v2.md` claim --002: mesociclo = 5 semanas de rampa
 * + 1 de deload (a semana 6).
 *
 * MEDIDO: em perfis de sessão curta (10 min), a semana 6 entrega VOLUME IGUAL OU MAIOR que a
 * semana 5. A redução de `seriesPorExercicio` (introduzida por D2) barateia cada slot, e o
 * orçamento de slots do dia responde COLOCANDO MAIS EXERCÍCIOS — o corte por exercício é
 * anulado (e às vezes revertido) pelo acréscimo de slots. `rotina.semana.deload` continua
 * `true`: a pessoa é informada de que está em semana de alívio.
 *
 * A evidência de D2 mediu um único perfil (S5 96 → S6 48). O efeito não é geral.
 *
 * FALHA no snapshot auditado. Não corrige código.
 */
import { describe, expect, it } from 'vitest';
import { gerarTreino } from '@/lib/engine';
import type { PerfilTreino } from '@/lib/engine';
import { EXERCISES_SEED } from '@/lib/data/seed';
import { diasPadrao, type Weekday } from '@/lib/semana';

const base = (over: Partial<PerfilTreino>): PerfilTreino => ({
  pesoKg: 75, alturaCm: 175, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'saude', nivelExperiencia: 'iniciante', equipamento: 'academia',
  diasDisponiveis: 3, treinoDias: diasPadrao(3) as Weekday[], tempoPorSessaoMin: 60,
  ...over,
});

const volumeSemanal = (p: PerfilTreino, semana: 5 | 6) => {
  const rot = gerarTreino(p, { exercises: EXERCISES_SEED, semanaCiclo: { semana } }).rotina!;
  return {
    series: rot.dias.reduce((n, d) => n + d.slots.reduce((m, s) => m + (s.series ?? 0), 0), 0),
    slots: rot.dias.reduce((n, d) => n + d.slots.length, 0),
    deload: rot.semana?.deload === true,
  };
};

/** Casos medidos na varredura (todos com sessão de 10 min). */
const CASOS: { nome: string; p: PerfilTreino }[] = [
  { nome: 'iniciante/saude/casa/10min/3d', p: base({ nivelExperiencia: 'iniciante', objetivo: 'saude', equipamento: 'casa', equipamentosCasa: [], tempoPorSessaoMin: 10, diasDisponiveis: 3, treinoDias: diasPadrao(3) as Weekday[] }) },
  { nome: 'iniciante/massa/casa/10min/4d', p: base({ nivelExperiencia: 'iniciante', objetivo: 'massa', equipamento: 'casa', equipamentosCasa: [], tempoPorSessaoMin: 10, diasDisponiveis: 4, treinoDias: diasPadrao(4) as Weekday[] }) },
  { nome: 'avancado/emagrecimento/academia/10min/6d', p: base({ nivelExperiencia: 'avancado', objetivo: 'emagrecimento', equipamento: 'academia', tempoPorSessaoMin: 10, diasDisponiveis: 6, treinoDias: diasPadrao(6) as Weekday[] }) },
  { nome: 'avancado/emagrecimento/casa/10min/6d', p: base({ nivelExperiencia: 'avancado', objetivo: 'emagrecimento', equipamento: 'casa', equipamentosCasa: [], tempoPorSessaoMin: 10, diasDisponiveis: 6, treinoDias: diasPadrao(6) as Weekday[] }) },
];

describe('REGRESSÃO D13 · a semana de deload precisa reduzir o volume entregue', () => {
  for (const c of CASOS) {
    it(`${c.nome}: S6 marcada como deload e com volume menor que S5`, () => {
      const s5 = volumeSemanal(c.p, 5);
      const s6 = volumeSemanal(c.p, 6);
      expect(s6.deload, 'semana 6 deve estar marcada como deload').toBe(true);
      expect(s5.series, 'pré-condição: a semana 5 tem volume').toBeGreaterThan(0);
      expect(
        s6.series,
        `S5=${s5.series} séries em ${s5.slots} slots; S6=${s6.series} séries em ${s6.slots} slots`,
      ).toBeLessThan(s5.series);
    });
  }

  it('varredura: nenhum perfil pode ter volume de deload >= volume da rampa', () => {
    const violacoes: string[] = [];
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const)
      for (const obj of ['emagrecimento', 'massa', 'saude'] as const)
        for (const eq of ['academia', 'casa', 'nenhum'] as const)
          for (const t of [10, 15, 20, 30, 45, 60, 90, 120])
            for (const d of [1, 2, 3, 4, 5, 6]) {
              const p = base({
                nivelExperiencia: nivel, objetivo: obj, equipamento: eq,
                ...(eq === 'casa' ? { equipamentosCasa: [] } : {}),
                tempoPorSessaoMin: t, diasDisponiveis: d, treinoDias: diasPadrao(d) as Weekday[],
              });
              const s5 = volumeSemanal(p, 5); const s6 = volumeSemanal(p, 6);
              if (s5.series > 0 && s6.series >= s5.series) {
                violacoes.push(`${nivel}/${obj}/${eq}/${t}min/${d}d S5=${s5.series} S6=${s6.series}`);
              }
            }
    expect(violacoes, `perfis sem redução no deload:\n${violacoes.join('\n')}`).toEqual([]);
  }, 300000);
});
