import { describe, expect, it } from 'vitest';
import { gerarTreino } from './index';
import { EXERCISES } from '../data/exercises';
import { creditoPonderadoDaSemana } from './alocador';
import { diretosDoExercicio } from './cobertura-anatomica';
import type { PerfilTreino, SemanaCiclo } from './treino-types';

const perfil: PerfilTreino = {
  pesoKg: 80, alturaCm: 180, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'massa', nivelExperiencia: 'iniciante', equipamento: 'academia', equipamentosCasa: [],
  diasDisponiveis: 4, treinoDias: ['seg', 'ter', 'qui', 'sex'],
  tempoPorSessaoMin: 30, limiteTempoTreino: 'limitado',
};
const plano = (semana: SemanaCiclo) => gerarTreino(perfil, { exercises: EXERCISES, semanaCiclo: { semana } }).rotina!;

describe('prioridade do bíceps sobre complementar em 4 dias/30 min', () => {
  it('mantém a rosca e as funções principais estáveis em S1–S5, sem exceder 30 min', () => {
    const semanas = ([1, 2, 3, 4, 5] as SemanaCiclo[]).map(plano);
    const ids = semanas[0]!.dias.map(d => d.slots.map(s => s.exercicio.id));
    for (const r of semanas) {
      expect(r.resultadoGeracao?.tipo).toBe('CERTIFICADO');
      expect(r.dias.map(d => d.slots.map(s => s.exercicio.id))).toEqual(ids);
      expect(r.dias.flatMap(d => d.slots).some(s => s.exercicio.id === 'e75')).toBe(true);
      expect(r.dias.flatMap(d => d.slots).some(s => diretosDoExercicio(s.exercicio.id).has('ts'))).toBe(true);
      expect(creditoPonderadoDaSemana(r.dias.flatMap(d => d.slots)).get('biceps')).toBeGreaterThanOrEqual(6);
      expect(r.duracaoDias?.every(d => d.estadoCalculo === 'CALCULADO'
        && d.duracaoMaximaEstimadaSegundos! <= 1800)).toBe(true);
    }
  });

  it.each([
    { semana: 3 as SemanaCiclo, biceps: 6.5, costas: 9.5, ombros: 8, seriesRosca: 3, descansoRosca: 90 },
    { semana: 5 as SemanaCiclo, biceps: 6.5, costas: 9.5, ombros: 8, seriesRosca: 2, descansoRosca: 90 },
  ])('preserva costas, ombros e seus descansos na semana $semana', dados => {
    const r = plano(dados.semana), slots = r.dias.flatMap(d => d.slots);
    const creditos = creditoPonderadoDaSemana(slots);
    expect(creditos.get('biceps')).toBe(dados.biceps);
    expect(creditos.get('costas')).toBe(dados.costas);
    expect(creditos.get('ombros')).toBe(dados.ombros);
    for (const [id, descanso] of [['e49', 180], ['e46', 180], ['e43', 180], ['e96', 180]] as const)
      expect(slots.find(s => s.exercicio.id === id)?.descansoSeg, id).toBe(descanso);
    const rosca = slots.find(s => s.exercicio.id === 'e75');
    expect(rosca?.series).toBe(dados.seriesRosca);
    expect(rosca?.descansoSeg).toBe(dados.descansoRosca);
  });

  it('não altera o desenho manual', () => {
    const dias = plano(3).dias.map(d => ({ nome: d.nome, diaId: d.diaId,
      exercicioIds: d.slots.filter(s => s.exercicio.id !== 'e75').map(s => s.exercicio.id) }));
    const manual = gerarTreino({ ...perfil, rotinaCustom: { origem: 'usuario', dias } },
      { exercises: EXERCISES, semanaCiclo: { semana: 3 } }).rotina!;
    expect(manual.dias.map(d => d.slots.map(s => s.exercicio.id))).toEqual(dias.map(d => d.exercicioIds));
  });
});
