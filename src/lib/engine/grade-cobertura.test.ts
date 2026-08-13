/**
 * 🔢 v4 · leva B3 — A GRADE DAS 36 COMBINAÇÕES (handoff-motor-volume-v4-2026-08-12),
 * agora permanente: 3 níveis × 6 dias × 2 tempos, semana 3, massa/academia.
 *
 * O que ela trava (contra o mundo medido em 2026-08-12, onde 7 de 12 grupos tinham ZERO):
 *  · cobertura: com ≥ 2 dias, NENHUM dos 12 grupos fica a zero ponderado;
 *  · 1 dia é o limite estrutural declarado (6–7 slots não cobrem 12 grupos) — os zeros
 *    existem, são ≤ 3 e ficam DECLARADOS aqui em vez de escondidos na média;
 *  · o teto de slots segue a tabela f(tempo) — nenhum dia acima do orçamento;
 *  · a inversão morreu (iniciante ≤ intermediário ≤ avançado — prova fina no
 *    alocador.test.ts; aqui o smoke da grade completa).
 */
import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { creditoPonderadoDaSemana, orcamentoSlotsDoDia } from './alocador';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino } from './treino-types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const GRUPOS = ['peito', 'costas', 'ombros', 'quadriceps', 'posterior', 'gluteos', 'core', 'biceps', 'triceps', 'panturrilha', 'lombar', 'antebraco'] as const;

const rotina = (nivel: PerfilTreino['nivelExperiencia'], dias: number, tempo: number) => {
  const p: PerfilTreino = { pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa', nivelExperiencia: nivel, equipamento: 'academia', diasDisponiveis: dias, tempoPorSessaoMin: tempo };
  return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana: 3 });
};

describe('🔴 grade 3 níveis × 6 dias × {60, 180} min — cobertura ponderada', () => {
  it('🔑 com ≥ 2 dias, ZERO grupos a zero ponderado (antes: 7 de 12) — nas 30 combinações', () => {
    const falhas: string[] = [];
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
      for (const dias of [2, 3, 4, 5, 6]) {
        for (const tempo of [60, 180]) {
          const r = rotina(nivel, dias, tempo);
          const pond = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
          const zeros = GRUPOS.filter((g) => (pond.get(g) ?? 0) <= 0);
          if (zeros.length > 0) falhas.push(`${nivel}/${dias}d/${tempo}min: ${zeros.join(',')}`);
        }
      }
    }
    expect(falhas, `grupos a zero:\n${falhas.join('\n')}`).toEqual([]);
  });

  it('1 dia: os zeros são o limite estrutural, declarado — nunca mais que 3', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
      for (const tempo of [60, 180]) {
        const r = rotina(nivel, 1, tempo);
        const pond = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
        const zeros = GRUPOS.filter((g) => (pond.get(g) ?? 0) <= 0);
        expect(zeros.length, `${nivel}/1d/${tempo}min: ${zeros.join(',')}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('nenhum dia passa do orçamento f(tempo), na grade inteira', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
      for (const dias of [1, 2, 3, 4, 5, 6]) {
        for (const tempo of [60, 180]) {
          const r = rotina(nivel, dias, tempo);
          for (const d of r.dias) {
            expect(d.slots.length, `${nivel}/${dias}d/${tempo}min · ${d.nome}`).toBeLessThanOrEqual(orcamentoSlotsDoDia(tempo));
          }
        }
      }
    }
  });

  /**
   * 🔗 Âncora contra a medição de 2026-08-12 (relatorio-medicao-v3): o perfil da queixa
   * (int/massa/4d/60min) tinha 14 slots e 55 séries; o v4 entrega 24 slots. O par
   * discriminante da leva inteira, gravado como número.
   */
  it('int/massa/4d/60min: 24 slots onde havia 14', () => {
    const r = rotina('intermediario', 4, 60);
    expect(r.dias.reduce((n, d) => n + d.slots.length, 0)).toBe(24);
  });
});
