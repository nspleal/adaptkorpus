import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { verificarDistribuicaoComplementares } from './__fixtures__/complementares-contrato';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino } from './treino-types';

/** Autor 19/09: o limite de um complementar por dia misto prevalece sobre core 2x.
 * Esta grade verifica localização, limite, frequência máxima e aviso da frequência
 * menor. A viabilidade de adicionar um grupo omitido é verificada separadamente
 * em grade-cobertura.test.ts, sem depender do aviso do motor.
 */
const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const NIVEIS = ['iniciante', 'intermediario', 'avancado'] as const;
const OBJETIVOS = ['massa', 'emagrecimento', 'saude'] as const;
const EQUIPS = ['nenhum', 'casa', 'academia'] as const;

const coreDaRotina = (perfil: PerfilTreino): number => {
  const rot = montarRotina(prescreverTreino(perfil, avaliarGateTreino(perfil)), perfil, EXERCISES);
  verificarDistribuicaoComplementares(rot);
  return rot.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === 'core').length, 0);
};

describe('frequência e distribuição de complementares conforme decisão de 19/09', () => {
  it('limite e localização em todos os cenários; frequência menor é informada', () => {
    const violacoes: string[] = [];
    for (const nivelExperiencia of NIVEIS)
      for (const objetivo of OBJETIVOS)
        for (const equipamento of EQUIPS)
          for (const diasDisponiveis of [3, 4, 5, 6])
            for (const tempoPorSessaoMin of [20, 30, 45, 60]) {
              const core = coreDaRotina({ pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo, nivelExperiencia, equipamento, diasDisponiveis, tempoPorSessaoMin });
              if (core > 3) violacoes.push(`${nivelExperiencia}/${objetivo}/${equipamento}/${diasDisponiveis}d/${tempoPorSessaoMin}min → core ${core}×`);
            }
    expect(violacoes).toEqual([]);
  });

  it('cenário extremo do achado antigo (avançado · 6 dias · 20 min) fica na faixa', () => {
    const core = coreDaRotina({ pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa', nivelExperiencia: 'avancado', equipamento: 'academia', diasDisponiveis: 6, tempoPorSessaoMin: 20 });
    // Frequência mínima cede à localização e ao limite por dia, verificados acima.
    expect(core).toBeLessThanOrEqual(3);
  });
});
