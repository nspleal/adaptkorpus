import { expect, it } from 'vitest';
import { impedimentosDaGeracao } from './geracao-treino-aceitavel';
import { gerarTreino } from './engine';
import { EXERCISES } from './data/exercises';
import type { PerfilTreino } from './engine';

it('nomeia falta de composição sem certificar duração nem inventar alternativas',()=>{
  const p:PerfilTreino={pesoKg:80,alturaCm:180,idade:30,objetivo:'massa',nivelExperiencia:'iniciante',
    flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false},
    equipamento:'nenhum',equipamentosCasa:[],diasDisponiveis:1,treinoDias:['seg'],tempoPorSessaoMin:75,limiteTempoTreino:'sem_limite'};
  const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:3}});
  expect(r.rotina?.resultadoGeracao?.tipo).toBe('MINIMOS_NAO_ATENDIDOS');
  const motivos=impedimentosDaGeracao(r);
  expect(motivos.some(m=>m.includes('Bíceps'))).toBe(true);
  expect(motivos.some(m=>m.includes('Posterior'))).toBe(true);
  expect(r.gate.comportamento).not.toBe('ROTEAR');
});


it('separa piso no deload de incompatibilidade temporal, com duração calculada', () => {
  const p: PerfilTreino = { pesoKg: 75, alturaCm: 175, idade: 30, objetivo: 'massa', nivelExperiencia: 'iniciante',
    flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
    equipamento: 'academia', diasDisponiveis: 1, treinoDias: ['seg'], tempoPorSessaoMin: 10 };
  const r = gerarTreino(p, { exercises: EXERCISES, semanaCiclo: { semana: 6 } });
  expect(r.rotina?.resultadoGeracao?.tipo).toBe('INCOMPATIVEL');
  expect(r.rotina?.dias.flatMap(d => d.slots).map(s => s.series)).toEqual(Array(8).fill(1));
  expect(r.rotina?.avisos.some(a => a.startsWith('Piso de séries atingido:'))).toBe(true);
  const motivos = impedimentosDaGeracao(r);
  expect(motivos.join(' ')).toContain('mínima calculada 5 min 20 s');
  expect(motivos.join(' ')).toContain('máxima estimada 12 min 20 s');
  expect(motivos.join(' ')).toContain('Não foi possível reduzir adicionalmente');
});


it('erro real de composição não autoriza substituir o plano salvo',()=>{
 const p:PerfilTreino={pesoKg:80,alturaCm:180,idade:30,objetivo:'massa',nivelExperiencia:'iniciante',equipamento:'academia',diasDisponiveis:2,tempoPorSessaoMin:30,flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false}};
 const r=gerarTreino(p,{exercises:[],semanaCiclo:{semana:1}});
 expect(r.rotina?.resultadoGeracao?.tipo).toBe('ERRO_ALOCADOR');
 expect(impedimentosDaGeracao(r).length).toBeGreaterThan(0);
 expect(impedimentosDaGeracao(r).join(' ')).toContain('não foi aceita');
});
