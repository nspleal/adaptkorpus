import {expect,it} from 'vitest';
import {gerarTreino} from './index';
import {EXERCISES} from '../data/exercises';
import {fraseDoFoco} from '../foco-copy';
import type {PerfilTreino} from './treino-types';
const p:PerfilTreino={pesoKg:80,alturaCm:180,idade:30,objetivo:'massa',nivelExperiencia:'intermediario',equipamento:'academia',diasDisponiveis:4,tempoPorSessaoMin:45,limiteTempoTreino:'limitado',divisaoPreferida:'prioridades',flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false}};
it('dose consolidada é relatada por receptor, separada do exercício adicional real',()=>{
 // Controle medido: um adicional e duas séries consolidadas no mesmo ciclo.
 const positivo:PerfilTreino={...p,nivelExperiencia:'iniciante',diasDisponiveis:5,divisaoPreferida:'auto'};
 const base=gerarTreino(positivo,{exercises:EXERCISES,semanaCiclo:{semana:1}}).rotina!;
 const r=gerarTreino({...positivo,focoAgregado:{grupo:'bracos',semana:1}},{exercises:EXERCISES,semanaCiclo:{semana:1}}).rotina!;
 expect(r.blocoFoco!.adicionais).toHaveLength(1);
 expect(r.blocoFoco!.consolidados!.reduce((n,a)=>n+a.series,0)).toBe(2);
 expect(r.blocoFoco!.solicitados).toBe(2);
 for(const a of r.blocoFoco!.consolidados!){
 const antes=base.dias.find(d=>d.diaId===a.diaId)!.slots.find(s=>s.exercicio.id===a.exercicioId)!;
 const depois=r.dias.find(d=>d.diaId===a.diaId)!.slots.find(s=>s.exercicio.id===a.exercicioId)!;
 expect(depois.series!-antes.series!).toBe(a.series);
 expect(depois.extraDoFoco).not.toBe(true);
 }
 expect(fraseDoFoco(r)).toContain('2 série(s) adicionais nos exercícios existentes');
 expect(fraseDoFoco(r)).not.toContain('não foi possível');
 expect(r.blocoFoco!.adicionais[0]!.series).toBe(2);
});
it('consolidação e deload não inventam dose além do ganho líquido entregue',()=>{
 for(const semana of [1,2,3,4,5,6] as const){
 const base=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
 const r=gerarTreino({...p,foco:{grupo:'biceps',semana:1}},{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
 const soma=(x:typeof r)=>x.dias.flatMap(d=>d.slots).filter(s=>s.exercicio.grupoPrimario==='biceps').reduce((n,s)=>n+(s.series??0),0);
 const entrega=[...(r.blocoFoco?.adicionais??[]),...(r.blocoFoco?.consolidados??[])].reduce((n,a)=>n+a.series,0);
 expect(entrega,`semana ${semana}`).toBe(soma(r)-soma(base));
 }
});
