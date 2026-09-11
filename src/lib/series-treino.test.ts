import { describe, expect, it } from 'vitest';
import { seriesDoSlot } from './series-treino';
import { contarSeriesPorGrupo } from '@/components/painel/ResumoSeries';
import { paraRotinaCustom } from '@/components/painel/EditorTreino';
import { EXERCISES } from './data/exercises';
import { montarRotina } from './engine/treino-montador';
import { prescreverTreino } from './engine/treino';
import { avaliarGateTreino } from './engine/treino-gate';
import type { PerfilTreino } from './engine/treino-types';

const perfil: PerfilTreino = { pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false }, objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 3, tempoPorSessaoMin: 60 };

describe('Séries manuais e resumo de treino', () => {
  it('persiste somente escolhas de exercícios que continuam no dia', () => {
    const ex = EXERCISES.find((e) => e.id === 'e1')!;
    const rotina = paraRotinaCustom([{ nome: 'A', weekdayIdx: 0, exercicios: [ex], seriesPorExercicio: { e1: 7, removido: 8 } }]);
    expect(rotina.dias[0]?.seriesPorExercicio).toEqual({ e1: 7 });
  });
  it.each([1, 7])('preserva %s séries após serialização e recomputação em semanas distintas', (series) => {
    const p: PerfilTreino = { ...perfil, rotinaCustom: { origem: 'usuario', dias: [{ nome: 'A', diaId: 'seg', exercicioIds: ['e1'], seriesPorExercicio: { e1: series } }] } };
    for (const semana of [1, 4] as const) {
      const carregado = JSON.parse(JSON.stringify(p));
      const prescricao = prescreverTreino(carregado, avaliarGateTreino(carregado));
      const rotina = montarRotina(prescricao, carregado, EXERCISES, new Set(), { semana });
      const slot = rotina.dias[0]!.slots[0]!;
      expect(slot.series).toBe(series);
      expect(seriesDoSlot(slot)).toBe(series);
      expect(rotina.duracaoDias?.length).toBeGreaterThan(0);
    }
  });
  /**
   * 🔴 D9 — a expectativa MUDOU de lugar, não de conteúdo. O alívio continua reduzindo a
   * escolha manual sem apagá-la; quem reduz agora é o MOTOR (`treino-montador`, ramo do
   * editor guiado, mesma regra de teto já usada pela retomada), e `seriesDoSlot` virou o
   * espelho do que ele decidiu. O caso antigo passava um `deload` para a tela — a segunda
   * régua que este lote removeu.
   */
  it('o alívio reduz a escolha manual no MOTOR, e a escolha segue guardada', () => {
    const p: PerfilTreino = { ...perfil, rotinaCustom: { origem: 'usuario', dias: [{ nome: 'A', diaId: 'seg', exercicioIds: ['e1'], seriesPorExercicio: { e1: 7 } }] } };
    const prescricao = prescreverTreino(p, avaliarGateTreino(p));
    const normal = montarRotina(prescricao, p, EXERCISES, new Set(), { semana: 1 }).dias[0]!.slots[0]!;
    const alivio = montarRotina(prescricao, p, EXERCISES, new Set(), { semana: 6 }).dias[0]!.slots[0]!;
    expect(seriesDoSlot(normal)).toBe(7);
    expect(seriesDoSlot(alivio)).toBeLessThan(7);
    expect(alivio.seriesDefinidasPeloUsuario, 'a escolha manual foi apagada').toBe(true);
    // A escolha guardada no perfil é a fonte e não foi tocada.
    expect(p.rotinaCustom!.dias[0]!.seriesPorExercicio!.e1).toBe(7);
  });
  it('inclui os cinco grupos relatados e distingue séries diretas das indiretas', () => {
    for (const grupo of ['antebraco', 'biceps', 'triceps', 'core', 'lombar'] as const) {
      const ex = EXERCISES.find((e) => e.grupoPrimario === grupo)!;
      expect(ex).toBeDefined();
      const resumo = contarSeriesPorGrupo([{ exercicio: ex, series: 3 }]);
      expect(resumo.find((linha) => linha.grupo === grupo)?.diretas).toBe(3);
    }
    const supino = EXERCISES.find((e) => e.id === 'e1')!;
    const resumo = contarSeriesPorGrupo([{ exercicio: supino, series: 4 }]);
    expect(resumo.find((linha) => linha.grupo === 'triceps')?.indiretas).toBe(4);
    expect(resumo.find((linha) => linha.grupo === 'triceps')?.diretas).toBe(0);
  });
});
