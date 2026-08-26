import { describe, expect, it } from 'vitest';
import { perfilResumoSchema } from './perfil-resumo';

const BASE = {
  sexo: 'masculino',
  idade: 30,
  alturaCm: 180,
  pesoKg: 80,
  objetivo: 'saude',
  nivelAtividade: 'moderado',
  nivelExperiencia: 'intermediario',
  equipamento: 'academia',
  preferencia: null,
  alergenos: [],
  diasDisponiveis: 2,
  tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'qua'],
  naoCurto: [],
  pratosCansados: [],
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
} as const;

describe('rotinaCustom · um treino por dia', () => {
  it('rejeita dois treinos manuais no mesmo dia', () => {
    const resultado = perfilResumoSchema.safeParse({
      ...BASE,
      rotinaCustom: {
        origem: 'usuario',
        dias: [
          { nome: 'Manhã', diaId: 'seg', exercicioIds: ['e1'] },
          { nome: 'Tarde', diaId: 'seg', exercicioIds: ['e16'] },
        ],
      },
    });
    expect(resultado.success).toBe(false);
  });

  it('aceita dados legados sem dia explícito para migração compatível', () => {
    const resultado = perfilResumoSchema.safeParse({
      ...BASE,
      rotinaCustom: { origem: 'usuario', dias: [{ nome: 'Legado', exercicioIds: ['e1'] }] },
    });
    expect(resultado.success).toBe(true);
  });
});
