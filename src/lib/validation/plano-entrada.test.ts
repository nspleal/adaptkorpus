import { describe, expect, it } from 'vitest';
import { entradaPlanoVisivelSchema } from './plano-entrada';

const entradaValida = {
  pesoEfetivoKg: 80,
  diasOferecidosCardio: ['seg', 'qua'],
  semanaCiclo: {
    semana: 2,
    feedbackGrupos: [['peito', 'ok'], ['costas', 'segura']],
  },
  escolhasExecucao: [['ex-1', 'BILATERAL'], ['ex-2', 'UNILATERAL_DOIS_LADOS']],
};

describe('entradaPlanoVisivelSchema — fronteira sem ambiguidades', () => {
  it('aceita coleções distintas que o normalizador pode reconstruir sem perda', () => {
    expect(entradaPlanoVisivelSchema.safeParse(entradaValida).success).toBe(true);
  });

  it('rejeita dia de cardio duplicado antes de Set', () => {
    const recebido = { ...entradaValida, diasOferecidosCardio: ['seg', 'seg'] };
    expect(entradaPlanoVisivelSchema.safeParse(recebido).success).toBe(false);
  });

  it('rejeita feedback duplicado antes de Map, inclusive quando os valores discordam', () => {
    const recebido = {
      ...entradaValida,
      semanaCiclo: { ...entradaValida.semanaCiclo, feedbackGrupos: [['peito', 'ok'], ['peito', 'segura']] },
    };
    expect(entradaPlanoVisivelSchema.safeParse(recebido).success).toBe(false);
  });

  it('rejeita escolha de execução duplicada antes de Map', () => {
    const recebido = { ...entradaValida, escolhasExecucao: [['ex-1', 'BILATERAL'], ['ex-1', 'UNILATERAL_DOIS_LADOS']] };
    expect(entradaPlanoVisivelSchema.safeParse(recebido).success).toBe(false);
  });

  it('rejeita exercício recente duplicado antes de Set', () => {
    const recebido = {
      ...entradaValida,
      semanaCiclo: {
        ...entradaValida.semanaCiclo,
        retomada: { semana: 1, fator: 0.5, volumeReferencia: 12, exerciciosRecentes: ['e1', 'e1'] },
      },
    };
    expect(entradaPlanoVisivelSchema.safeParse(recebido).success).toBe(false);
  });
});
