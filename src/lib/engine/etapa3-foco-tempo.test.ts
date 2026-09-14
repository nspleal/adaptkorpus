import {describe,it,expect} from 'vitest';
import {gerarTreino} from './index';
import {EXERCISES} from '../data/exercises';
import {ORDEM_SEMANA,type Weekday} from '../semana';
import type {PerfilTreino,RotinaSemanal} from './treino-types';
import {altaExigenciaDocumental,descansoDoExercicio} from './descanso';
import {GRUPOS_GRANDES,GRUPOS_PEQUENOS_PISO} from './alocador';
const base:PerfilTreino={pesoKg:80,alturaCm:180,idade:30,flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false},objetivo:'massa',nivelExperiencia:'avancado',equipamento:'academia',diasDisponiveis:3,tempoPorSessaoMin:75,limiteTempoTreino:'sem_limite'};
const agendas:Weekday[][]=[['seg'],['dom','seg'],['seg','qui'],['seg','qua','sex'],['seg','ter','qui','sex'],['seg','ter','qua','sex','sab'],['seg','ter','qua','qui','sex','sab'],[...ORDEM_SEMANA]];
const run=(agenda:Weekday[],over:Partial<PerfilTreino>={},semana:1|5|6=1)=>gerarTreino({...base,...over,treinoDias:agenda,diasDisponiveis:agenda.length},{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
const slots=(r:RotinaSemanal)=>r.dias.flatMap(d=>d.slots);
describe('etapa3: plano concreto',()=>{
 it('um dia cobre cada grupo direto uma vez; foco tem dois exercícios no total',()=>{
  for(const foco of [undefined,{grupo:'peito' as const,compensa:'triceps' as const,semana:1}]){
   const r=run(['seg'],{foco});
   const grupos=slots(r).map(s=>s.exercicio.grupoPrimario);
   for(const g of [...GRUPOS_GRANDES,...GRUPOS_PEQUENOS_PISO,'core'])expect(grupos.filter(x=>x===g).length,g).toBe(g===foco?.grupo?2:1);
   expect(grupos).not.toContain('lombar');expect(grupos).not.toContain('antebraco');
  }
 });
 it.each(agendas)('sem limite preserva o baseline dos outros grupos e recuperação em %j',(...agenda)=>{
  const dias=agenda as Weekday[];
  const neutro=run(dias),foco=run(dias,{foco:{grupo:'peito',compensa:'triceps',semana:1}});
  for(const d of neutro.dias)expect(foco.dias.find(f=>f.diaId===d.diaId)?.slots.filter(s=>s.exercicio.grupoPrimario!=='peito')).toEqual(d.slots.filter(s=>s.exercicio.grupoPrimario!=='peito'));
  expect(foco.resultadoGeracao?.tipo).not.toBe('ERRO_ALOCADOR');
  for(const a of foco.dias)for(const b of foco.dias){
   const delta=Math.abs(ORDEM_SEMANA.indexOf(a.diaId!)-ORDEM_SEMANA.indexOf(b.diaId!));
   if(delta===1||delta===6)expect(a.slots.some(s=>b.slots.some(t=>t.exercicio.grupoPrimario===s.exercicio.grupoPrimario))).toBe(false);
  }
 });
 it('pernas: recortes reaproveitam todo o baseline de outros grupos, mais2 exercícios totais',()=>{
  for(const agenda of agendas.slice(3)){
   const a=run(agenda),b=run(agenda,{focoAgregado:{grupo:'pernas',semana:1}});
   const assinatura=(r:RotinaSemanal)=>slots(r).filter(s=>!['quadriceps','posterior'].includes(s.exercicio.grupoPrimario!)).map(s=>`${s.exercicio.id}:${s.series}`).sort();
   expect(assinatura(b)).toEqual(assinatura(a));expect(b.blocoFoco?.adicionais).toHaveLength(2);
   expect(b.blocoFoco?.adicionais.every(s=>s.series===2)).toBe(true);
  }
 });
 it('extras podem exceder MRV conforme decisão explícita14/09, sem compensação',()=>{
  const a=run(['seg','ter','qui','sex'],{nivelExperiencia:'intermediario'},5);
  const b=run(['seg','ter','qui','sex'],{nivelExperiencia:'intermediario',foco:{grupo:'peito',compensa:'triceps',semana:1}},5);
  const n=(r:RotinaSemanal)=>slots(r).filter(s=>s.exercicio.grupoPrimario==='peito').reduce((n,s)=>n+s.series!,0);
  expect(n(b)).toBe(n(a)+4);expect(n(b)).toBeGreaterThan(16);
 });
 it('corte local conserva o equilíbrio semanal, com foco em dia de puxar',()=>{
  for(const semana of [1,5,6] as const){
   const r=run(['seg','qua','sex'],{tempoPorSessaoMin:20,limiteTempoTreino:'limitado',foco:{grupo:'peito',compensa:'triceps',semana:1}},semana);
   expect(r.resultadoGeracao?.tipo).not.toBe('ERRO_ALOCADOR');
   expect(slots(r).filter(s=>s.padrao==='puxar').length).toBeGreaterThanOrEqual(slots(r).filter(s=>s.padrao==='empurrar').length);
  }
 });
 it('certificado limitado respeita teto estrito; sem limite não é uma sentinela numérica',()=>{
  for(const agenda of agendas)for(const tempo of [20,60,75,90]){
   const r=run(agenda,{tempoPorSessaoMin:tempo,limiteTempoTreino:'limitado'});
   if(r.resultadoGeracao?.tipo==='CERTIFICADO')for(const d of r.duracaoDias??[])expect(d.duracaoMaximaEstimadaSegundos!).toBeLessThanOrEqual(tempo*60);
  }
  expect(run(['seg'],{tempoPorSessaoMin:20}).dias).toEqual(run(['seg'],{tempoPorSessaoMin:75}).dias);
 });
 it('exigência documental preserva piso120 em todos os níveis de degradação e FIT',()=>{
  for(const ex of EXERCISES.filter(altaExigenciaDocumental))for(const degradacao of [0,1,2] as const)for(const semanaRampa of [undefined,1,2]){
   expect(descansoDoExercicio({exercicio:ex,rirAlvo:4,degradacao,semanaRampa})!,ex.id).toBeGreaterThanOrEqual(120);
   if(degradacao===0)expect(descansoDoExercicio({exercicio:ex,rirAlvo:4,degradacao,semanaRampa})!,ex.id).toBeGreaterThanOrEqual(180);
  }
 });
});
