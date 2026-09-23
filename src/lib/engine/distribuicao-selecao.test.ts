import {describe,it,expect} from 'vitest';
import {contarRecortesEntregues} from './selecao-divisao';
import {gerarTreino} from './index';
import {EXERCISES} from '../data/exercises';
import type {PerfilTreino} from './treino-types';
import type {Weekday} from '../semana';
const base: PerfilTreino={pesoKg:80,alturaCm:180,idade:30,flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false},objetivo:'massa',nivelExperiencia:'avancado',equipamento:'academia',diasDisponiveis:3,tempoPorSessaoMin:90};
const gerar=(agenda:Weekday[],foco?:'bracos'|'pernas')=>gerarTreino({...base,treinoDias:agenda,diasDisponiveis:agenda.length,...(foco?{focoAgregado:{grupo:foco,semana:1}}:{})},{exercises:EXERCISES,semanaCiclo:{semana:1}}).rotina!;
const grupos=(d:ReturnType<typeof gerar>['dias'][number])=>d.slots.map(s=>s.exercicio.grupoPrimario);
const pernas=(d:ReturnType<typeof gerar>['dias'][number])=>grupos(d).some(g=>g==='quadriceps'||g==='posterior');
const assinatura=(r:ReturnType<typeof gerar>)=>r.dias.map(d=>({dia:d.diaId,ids:d.slots.map(s=>[s.exercicio.id,s.series]).sort()}));
describe('DIST-01/02: divisão escolhida e intenção na entrega real',()=>{
 it('dois dias espaçados: superiores/inferiores, sem duas sessões full-body',()=>{
  const r=gerar(['seg','qui']);expect(r.dias).toHaveLength(2);
  expect(r.dias.filter(pernas)).toHaveLength(1);
  expect(grupos(r.dias.find(d=>!pernas(d))!)).toEqual(expect.arrayContaining(['peito','costas']));
 });
 it('três dias: foco em pernas preserva a alternância aprovada e os superiores completos',()=>{
  for(const semana of [1,2] as const){
   const r=gerarTreino({...base,treinoDias:['seg','qua','sex'],focoAgregado:{grupo:'pernas',semana:1}},
    {exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
   expect(r.dias.filter(pernas)).toHaveLength(semana===1?1:2);
   for(const d of r.dias.filter(d=>!pernas(d)))
    expect(grupos(d)).toEqual(expect.arrayContaining(['peito','costas','ombros','biceps','triceps']));
   expect(r.blocoFoco?.grupos).toEqual(['quadriceps','posterior']);
  }
 });
 it('quatro dias com braços: bloco sem abandonar superiores/pernas/ombros',()=>{
  const r=gerar(['seg','ter','qui','sex'],'bracos');
  const especifica=r.dias.filter(d=>grupos(d).includes('biceps')&&grupos(d).includes('triceps')&&!grupos(d).includes('peito')&&!grupos(d).includes('costas')&&!pernas(d));
  expect(especifica).toHaveLength(0);
  expect(r.blocoFoco?.grupos).toEqual(['biceps','triceps']);
  expect(r.dias.flatMap(grupos)).toEqual(expect.arrayContaining(['peito','costas','quadriceps','posterior','ombros']));
  expect(assinatura(r)).not.toEqual(assinatura(gerar(['seg','ter','qui','sex'])));
  expect(r.avisos.some(a=>a.startsWith('Distribuição planejada'))).toBe(false);
 });
 it('três dias consecutivos mantêm Upper/Lower/Upper, sem prometer dois dias de pernas',()=>{
  const r=gerar(['seg','ter','qua'],'pernas');
  expect(r.dias.map(d=>d.nome)).toEqual(['Upper A','Lower A','Upper B']);
  expect(r.dias.filter(pernas)).toHaveLength(1);
  expect(r.avisos.some(a=>a.startsWith('Distribuição planejada'))).toBe(false);
 });
 it('equipamento impede braços no terminal: um exercício isolado não satisfaz a sessão',()=>{
  const r=gerarTreino({...base,equipamento:'nenhum',treinoDias:['seg','ter','qui','sex'],diasDisponiveis:4,focoAgregado:{grupo:'bracos',semana:1}},{exercises:EXERCISES,semanaCiclo:{semana:1}}).rotina!;
  expect(r.blocoFoco?.grupos).toEqual(['biceps','triceps']);
  expect(r.avisos.some(a=>a.includes('completar o bloco adicional'))).toBe(true);
 });
 it('duas ênfases exigem sessões distintas; full-body único não vale por duas',()=>{
  expect(contarRecortesEntregues([['quadriceps'],['posterior']],[['quadriceps','posterior']])).toBe(1);
  expect(contarRecortesEntregues([['quadriceps'],['posterior']],[['quadriceps'],['posterior']])).toBe(2);
 });
});
