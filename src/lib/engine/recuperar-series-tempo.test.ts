import {expect,it} from 'vitest';
import {recuperarSeriesPorTempo,registrarCortesTemporais} from './recuperar-series-tempo';
import {EXERCISES} from '../data/exercises';
import {gerarTreino} from './index';
import type {PerfilTreino} from './treino-types';
import {avaliarDuracaoResistida} from './duracao-plano';
import type {DiaTreino,SlotExercicio} from './treino-types';
const slot=(id:string,series:number,original?:number):SlotExercicio=>{const exercicio=EXERCISES.find(e=>e.id===id)!;return {exercicio,padrao:exercicio.padraoMovimento,series,descansoSeg:120,...(original?{seriesAntesDoCorteDeTempo:original}:{})};};
const dia=(slots:SlotExercicio[]):DiaTreino=>({nome:'Teste',slots});
const run=(dias:DiaTreino[],cortes=registrarCortesTemporais(dias),limiteSeg=99999,tetoSemana=(_:string)=>99,tetoSessao=99)=>recuperarSeriesPorTempo({dias,cortes,nivel:'intermediario',limiteSeg,tetoSemana,tetoSessao});
it.each([
 {dias:3,tempo:20,semana:5 as const},
 {dias:4,tempo:10,semana:3 as const},
])('avisos de cortes contam a composição final: $dias dias/$tempo min/S$semana', ({dias,tempo,semana}) => {
 const p:PerfilTreino={pesoKg:80,alturaCm:178,idade:30,objetivo:'massa',nivelExperiencia:'iniciante',equipamento:'academia',diasDisponiveis:dias,tempoPorSessaoMin:tempo,limiteTempoTreino:'limitado',
  flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false}};
 const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
 const cortados=r.dias.flatMap(d=>d.slots).filter(s=>(s.seriesAntesDoCorteDeTempo??0)>(s.series??0));
 const uma=cortados.filter(s=>s.series===1);
 expect(uma.length).toBeGreaterThan(0);
 expect(r.fatosCorteTempo).toHaveLength(cortados.length);
 const avisos=r.avisos.filter(a=>a.includes('reduzimos séries em'));
 expect(avisos).toHaveLength(1);
 expect(avisos[0]).toContain(`reduzimos séries em ${cortados.length} exercício(s)`);
 expect(r.avisos.filter(a=>a.startsWith('Após os ajustes,'))).toEqual([`Após os ajustes, ${uma.length} desses exercícios estão com 1 série.`]);
 expect(r.avisos.join(' ')).not.toContain('Entregamos a versão reduzida');
});
it('recupera só o saldo temporal, sem devolver a redução posterior por volume',()=>{
 const temporal=[dia([slot('e1',2,4)])],cortes=registrarCortesTemporais(temporal);
 const podado=[dia([slot('e1',1,4)])],foto=structuredClone(podado);
 const r=run(podado,cortes);
 expect(r.dias[0]!.slots[0]!.series).toBe(3); // 1 + duas temporais; a quarta foi cortada por volume.
 expect(r.dias[0]!.slots[0]!.seriesAntesDoCorteDeTempo).toBeUndefined();
 expect(podado).toEqual(foto);
});
it('não reinsere exercícios retirados nem transfere saldo a uma substituição',()=>{
 const cortes=registrarCortesTemporais([dia([slot('e1',2,4),slot('e19',2,4)])]);
 const r=run([dia([slot('e10',2)])],cortes);
 expect(r.dias[0]!.slots.map(s=>[s.exercicio.id,s.series])).toEqual([['e10',2]]);
});
it('créditos indiretos limitam recuperação tanto na semana como na sessão',()=>{
 const dias=[dia([slot('e1',1,4),slot('e67',1)])];
 for(const escopo of ['semana','sessao']){
  const r=run(dias,undefined,99999,g=>escopo==='semana'&&g==='triceps'?1.5:99,escopo==='sessao'?1.5:99);
  expect(r.dias[0]!.slots[0]!.series).toBe(1);
  expect(r.recuperadas).toEqual([]);
 }
});
it('prioriza principal sobre secundário e complementar, sem encurtar descanso para recuperar',()=>{
 const dias=[dia([slot('e73',1,4),slot('e19',1,4),slot('e1',1,4)])];
 const medido=dia([slot('e73',1),slot('e19',1),slot('e1',2)]);
 const limite=avaliarDuracaoResistida(medido.slots,'intermediario').duracaoMaximaEstimadaSegundos!;
 const r=run(dias,undefined,limite);
 expect(r.recuperadas[0]).toEqual({dia:0,id:'e1',series:1});
 expect(r.dias[0]!.slots.map(s=>s.series)).toEqual([1,1,2]);
 expect(r.dias[0]!.slots.every(s=>s.descansoSeg===120)).toBe(true);
 expect(avaliarDuracaoResistida(r.dias[0]!.slots,'intermediario').duracaoMaximaEstimadaSegundos).toBeLessThanOrEqual(limite);
});
it('não modifica dose sem corte temporal nem ultrapassa dose original',()=>{
 const r=run([dia([slot('e1',2),slot('e19',2,3)])]);
 expect(r.dias[0]!.slots.map(s=>s.series)).toEqual([2,3]);
});
