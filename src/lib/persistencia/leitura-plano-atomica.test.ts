import { describe, expect, it } from 'vitest';
import { leituraAtomicaDoPlanoCas } from './leitura-plano-atomica';

const perfil = {
  sexo: 'masculino',
  idade: 30,
  alturaCm: 180,
  pesoKg: 80,
  objetivo: 'massa',
  nivelAtividade: 'moderado',
  nivelExperiencia: 'avancado',
  equipamento: 'academia',
  preferencia: null,
  alergenos: [],
  diasDisponiveis: 3,
  tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'qua', 'sex'],
  naoCurto: [],
  pratosCansados: [],
  flagsSaude: {
    gestacaoAmamentacao: false,
    renal: false,
    cardiaca: false,
    lesao: false,
    diabetes: false,
  },
};

const opcoes = {
  pesoEfetivoKg: 79,
  diasOferecidosCardio: ['ter', 'qui'],
  semanaCiclo: { semana: 2, feedbackGrupos: [] },
  escolhasExecucao: [],
};

describe('leitura atomica do plano CAS', () => {
  it('usa perfil e opções do mesmo payload versionado', () => {
    const leitura = leituraAtomicaDoPlanoCas({
      revision: 8,
      payload: { entrada: { perfil, opcoes } },
    });

    expect(leitura).toEqual({
      perfil,
      revision: 8,
      entradaPlano: opcoes,
    });
  });

  it('falha fechada para payload incompleto, sem misturar tabelas separadas', () => {
    expect(leituraAtomicaDoPlanoCas({ revision: 8, payload: { entrada: { perfil } } })).toBeNull();
    expect(leituraAtomicaDoPlanoCas({ revision: 8, payload: { entrada: { perfil: { ...perfil, idade: 12 }, opcoes } } })).toBeNull();
    expect(leituraAtomicaDoPlanoCas({ revision: 0, payload: { entrada: { perfil, opcoes } } })).toBeNull();
  });
});
