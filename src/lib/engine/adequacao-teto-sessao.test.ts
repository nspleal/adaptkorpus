import { expect, it } from 'vitest';
import { gerarTreino } from './index';
import { EXERCISES } from '../data/exercises';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './alocador';
import { podarExcessoPonderadoNaSessao } from './teto-ponderado';
import type { PerfilTreino, SlotExercicio } from './treino-types';
import { maxSemanalSemFoco } from './trilhos';

it('teto de sessão: para assim que cabe, preserva IDs e séries de terceiros', () => {
 const slot = (id: string, series: number): SlotExercicio => { const exercicio = EXERCISES.find(e=>e.id===id)!; return {exercicio,padrao:exercicio.padraoMovimento,series}; };
 const slots = [slot('e57',3),slot('e60',3),slot('e28',13)];
 const antes = slots.map(s=>({...s}));
 const r = podarExcessoPonderadoNaSessao([slots], g=>g==='gluteos'?12:99,1);
 expect(r.podados).toEqual([{grupo:'gluteos',series:1,dia:0}]);
 expect(slots.map(s=>s.exercicio.id)).toEqual(antes.map(s=>s.exercicio.id));
 expect(slots.map(s=>s.series)).toEqual([2,3,13]);
 expect(creditoPonderadoDaSemana(slots).get('gluteos')).toBe(11.5);
});

for(const n of [3,4,5]) it(`avançado ${n}d: teto de sessão e semana sem retirar funções ou exercícios mínimos`,()=>{
 const p: PerfilTreino={pesoKg:80,alturaCm:180,idade:30,objetivo:'massa',nivelExperiencia:'avancado',equipamento:'academia',diasDisponiveis:n,treinoDias:(['seg','ter','qua','qui','sex'] as const).slice(0,n),tempoPorSessaoMin:75,limiteTempoTreino:'limitado',flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false}};
 const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:1}}).rotina!;
 expect(r.resultadoGeracao?.tipo).toBe('CERTIFICADO');
 const pernas=r.dias.find(d=>d.slots.some(s=>s.exercicio.grupoPrimario==='quadriceps'))!;
 // A composição agora depende da divisão; o teste puro acima discrimina a poda de 3 para 2.
 expect(pernas).toBeDefined();
 for(const g of ['quadriceps','posterior','gluteos'])expect(pernas.slots.filter(s=>s.exercicio.grupoPrimario===g).length).toBeGreaterThanOrEqual(2);
 const semana=creditoPonderadoDaSemana(r.dias.flatMap(d=>d.slots));
 for(const g of GRUPOS_GRANDES)expect(semana.get(g)??0,g).toBeLessThanOrEqual(maxSemanalSemFoco(p.nivelExperiencia,p.objetivo));
 for(const d of r.dias)for(const g of GRUPOS_GRANDES)expect(creditoPonderadoDaSemana(d.slots).get(g)??0,`${d.nome}/${g}`).toBeLessThanOrEqual(12);
 expect(r.excecoesDeSessao??[]).toEqual([]);
 for(const d of r.duracaoDias!)expect(d.duracaoMaximaEstimadaSegundos).toBeLessThanOrEqual(4500);
});


it.each([60,90])('extras de peito em %i min respeitam tríceps sem cortar o baseline',tempo=>{
 const p:PerfilTreino={pesoKg:80,alturaCm:180,idade:30,objetivo:'massa',nivelExperiencia:'intermediario',equipamento:'academia',diasDisponiveis:4,treinoDias:['seg','ter','qui','sex'],divisaoPreferida:'prioridades',tempoPorSessaoMin:tempo,limiteTempoTreino:'limitado',flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false}};
 const base=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:3}}).rotina!;
 const foco=gerarTreino({...p,foco:{grupo:'peito',semana:1}},{exercises:EXERCISES,semanaCiclo:{semana:3}}).rotina!;
 expect(foco.resultadoGeracao?.tipo).toBe('CERTIFICADO');
 if(tempo===90)expect(foco.blocoFoco!.adicionais.length).toBeGreaterThan(0);
 else expect(foco.blocoFoco!.adicionais).toEqual([]);
 for(const d of foco.dias)for(const [g,n] of creditoPonderadoDaSemana(d.slots))expect(n,`${d.nome}/${g}`).toBeLessThanOrEqual(12);
 const assinatura=(r:typeof base)=>r.dias.map(d=>[d.diaId,d.slots.filter(s=>!s.extraDoFoco).map(s=>[s.exercicio.id,s.series,s.descansoSeg]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);
 expect(assinatura(foco)).toEqual(assinatura(base));
 if(tempo===60)expect(foco.avisos.some(a=>a.includes('Tríceps')&&a.includes('máximo'))).toBe(true);
});


it('adequação sem troca mantém IDs do ciclo e descansos ajustados de Upper/Lower',()=>{
 const p:PerfilTreino={pesoKg:80,alturaCm:180,idade:30,objetivo:'massa',nivelExperiencia:'intermediario',equipamento:'academia',diasDisponiveis:2,tempoPorSessaoMin:60,flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false}};
 const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:3}}).rotina!;
 expect(r.avisos.some(a=>a.startsWith('Trocamos'))).toBe(false);
 for(const semana of [1,2,4,5] as const){
  const x=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
  expect(x.dias.map(d=>d.slots.map(s=>s.exercicio.id))).toEqual(r.dias.map(d=>d.slots.map(s=>s.exercicio.id)));
 }
 expect(r.resultadoGeracao?.tipo).toBe('CERTIFICADO');
 expect(r.duracaoDias).toHaveLength(2);
 for(const d of r.duracaoDias!)expect(d.duracaoMaximaEstimadaSegundos).toBeLessThanOrEqual(3600);
 for(const d of r.dias)for(const s of d.slots)expect(s.descansoSeg).toBeGreaterThanOrEqual(60);
 const pernas=r.dias.find(d=>d.slots.some(s=>s.exercicio.grupoPrimario==='quadriceps'))!;
 for(const g of ['quadriceps','posterior','gluteos'])expect(pernas.slots.filter(s=>s.exercicio.grupoPrimario===g).length).toBeGreaterThanOrEqual(2);
});
