import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino } from './treino-types';

/**
 * Invariante travado do cofre (parametros-motor-treino-evokorpus, "Core 2–3×/semana"):
 * quando a semana COMPORTA a frequência (≥ 3 dias de treino), o montador prescreve core
 * entre 2 e 3 vezes — nunca menos, nunca mais. (Com 1–2 dias a frequência de 2× é
 * fisicamente inatingível — 1 sessão não vira 2 dias distintos — então o piso não se aplica.)
 *
 * Substitui o antigo `test_core_bug.test.ts` (raiz do repo, fora do `include` do vitest e sem
 * `expect`), que documentava uma hipótese que NÃO se reproduz: no cenário extremo (avançado, 6
 * dias, 20 min) o core sai 3×, dentro da faixa.
 */
const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const NIVEIS = ['iniciante', 'intermediario', 'avancado'] as const;
const OBJETIVOS = ['massa', 'emagrecimento', 'saude'] as const;
const EQUIPS = ['nenhum', 'casa', 'academia'] as const;

const coreDaRotina = (perfil: PerfilTreino): number => {
  const rot = montarRotina(prescreverTreino(perfil, avaliarGateTreino(perfil)), perfil, EXERCISES);
  return rot.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === 'core').length, 0);
};

describe('frequência de core (invariante travado: 2–3×/semana quando ≥ 3 dias)', () => {
  it('core ∈ [2,3] em TODOS os cenários com 3–6 dias de treino', () => {
    const violacoes: string[] = [];
    for (const nivelExperiencia of NIVEIS)
      for (const objetivo of OBJETIVOS)
        for (const equipamento of EQUIPS)
          for (const diasDisponiveis of [3, 4, 5, 6])
            for (const tempoPorSessaoMin of [20, 30, 45, 60]) {
              const core = coreDaRotina({ pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo, nivelExperiencia, equipamento, diasDisponiveis, tempoPorSessaoMin });
              if (core < 2 || core > 3) violacoes.push(`${nivelExperiencia}/${objetivo}/${equipamento}/${diasDisponiveis}d/${tempoPorSessaoMin}min → core ${core}×`);
            }
    expect(violacoes).toEqual([]);
  });

  it('cenário extremo do achado antigo (avançado · 6 dias · 20 min) fica na faixa', () => {
    const core = coreDaRotina({ pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa', nivelExperiencia: 'avancado', equipamento: 'academia', diasDisponiveis: 6, tempoPorSessaoMin: 20 });
    expect(core).toBeGreaterThanOrEqual(2);
    expect(core).toBeLessThanOrEqual(3);
  });
});
