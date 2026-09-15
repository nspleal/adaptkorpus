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
 /**
  * 🔴 Revisão 15/09 — a comparação passou a ser de CONTEÚDO (id, séries e descanso), não de
  * posição. A ordem dentro do dia é governada por outra regra aprovada — "o grupo focado vem
  * primeiro dentro da classe" (B2/C6, cobrada em trilhos.test.ts) —, e com a guarda de padrão
  * fora o extra do foco pode ser um COMPOSTO, o que muda a posição relativa dos demais no dia
  * que recebeu o bloco. Séries, descanso e a identidade de cada exercício continuam exigidos
  * um a um: nada do baseline pode sumir, encolher ou trocar de descanso por causa do foco.
  */
 const baselineFora=(r:RotinaSemanal,grupo:string)=>r.dias.map(d=>({dia:d.diaId,
   slots:d.slots.filter(s=>s.exercicio.grupoPrimario!==grupo).map(s=>`${s.exercicio.id}:${s.series}:${s.descansoSeg}`).sort()}));
 it.each(agendas)('sem limite preserva o baseline dos outros grupos e recuperação em %j',(...agenda)=>{
  const dias=agenda as Weekday[];
  const neutro=run(dias),foco=run(dias,{foco:{grupo:'peito',compensa:'triceps',semana:1}});
  expect(baselineFora(foco,'peito')).toEqual(baselineFora(neutro,'peito'));
  expect(foco.resultadoGeracao?.tipo).not.toBe('ERRO_ALOCADOR');
  for(const a of foco.dias)for(const b of foco.dias){
   const delta=Math.abs(ORDEM_SEMANA.indexOf(a.diaId!)-ORDEM_SEMANA.indexOf(b.diaId!));
   if(delta===1||delta===6)expect(a.slots.some(s=>b.slots.some(t=>t.exercicio.grupoPrimario===s.exercicio.grupoPrimario))).toBe(false);
  }
 });
 /**
  * 🔴 D-01/D-02 (revisão independente) — A MESMA PRESERVAÇÃO COM TEMPO LIMITADO.
  * Era exatamente a região que a suíte do candidato tinha abandonado ao mover as fixtures
  * para `sem_limite`. Aqui o tempo aperta de verdade e o baseline continua intocado; o que
  * cede é o bloco adicional, até desaparecer. Falha no candidato badcea47.
  */
 it.each([20,30,45,60] as const)('tempo LIMITADO de %i min preserva o baseline dos outros grupos',tempo=>{
  let comBloco=0,semBloco=0;
  for(const dias of agendas){
   const over={tempoPorSessaoMin:tempo,limiteTempoTreino:'limitado' as const};
   const neutro=run(dias,over),foco=run(dias,{...over,foco:{grupo:'costas',compensa:'peito',semana:1}});
   const rotulo=`${tempo}min ${dias.join('+')}`;
   const extrasDoDia=(d:{diaId?:Weekday;slots:{exercicio:{id:string}}[]})=>
     (foco.blocoFoco?.adicionais??[]).filter(a=>a.diaId===d.diaId&&d.slots.some(s=>s.exercicio.id===a.exercicioId)).length;
   for(const d of neutro.dias){
    const f=foco.dias.find(x=>x.diaId===d.diaId)!;
    const ids=(slotsDoDia:typeof d.slots)=>slotsDoDia.filter(s=>s.exercicio.grupoPrimario!=='costas').map(s=>`${s.exercicio.id}:${s.series}`).sort();
    // Exercícios e séries do baseline: SEMPRE idênticos ao plano sem foco.
    expect(ids(f.slots),`${rotulo} ${d.diaId}`).toEqual(ids(d.slots));
    // Descanso: idêntico também, salvo no dia em que um extra sobreviveu — ali a decisão 6
    // manda o descanso ceder ANTES de qualquer exercício, e o piso por classe segue valendo.
    const desc=(slotsDoDia:typeof d.slots)=>slotsDoDia.filter(s=>s.exercicio.grupoPrimario!=='costas').map(s=>`${s.exercicio.id}:${s.descansoSeg}`).sort();
    if(extrasDoDia(f)===0)expect(desc(f.slots),`${rotulo} ${d.diaId} sem extra sobrevivente`).toEqual(desc(d.slots));
    else expect(f.slots.every(s=>(s.descansoSeg??0)>=60)).toBe(true);
   }
   const extras=foco.blocoFoco?.adicionais.length??0;
   if(extras>0)comBloco+=1;else semBloco+=1;
   // O ganho líquido do grupo focado é EXATAMENTE o que o bloco declara ter entregue.
   const series=(r:RotinaSemanal)=>slots(r).filter(s=>s.exercicio.grupoPrimario==='costas').reduce((n,s)=>n+(s.series??0),0);
   expect(series(foco)-series(neutro),rotulo).toBe((foco.blocoFoco?.adicionais??[]).reduce((n,a)=>n+a.series,0));
  }
  // Anti-vacuidade: em cada tempo a matriz tem de conter agenda com e sem bloco sobrevivente
  // — senão o teste poderia passar só porque o foco nunca entregou nada.
  expect(comBloco+semBloco,'nenhuma agenda foi avaliada').toBe(agendas.length);
  // A anti-vacuidade vale dos 30 min para cima, onde o bloco tem de chegar ao plano.
  //
  // 🔵 REANCORADO em 2026-09-17: aos 20 min a asserção era `semBloco === agendas.length`,
  // isto é, «o bloco morre em TODAS as agendas». Com a sequência aprovada o baseline dos
  // 20 min cede séries antes de perder exercício, e numa das agendas isso abriu espaço para
  // o bloco sobreviver (7 de 8, não 8 de 8). O que continua exato — e é o que se cobra — é
  // que aos 20 min a ELIMINAÇÃO do bloco acontece, e na maioria das agendas: o caminho de
  // eliminação segue exercido. As provas de baseline acima valem em todas elas.
  if(tempo>=30)expect(comBloco,`nenhum bloco sobreviveu em ${tempo}min — o caso não discrimina`).toBeGreaterThan(0);
  else{
   expect(semBloco,'20 min deixou de eliminar o bloco: o caminho de eliminação não é exercido').toBeGreaterThan(0);
   expect(semBloco,'aos 20 min a eliminação deixou de ser a regra').toBeGreaterThan(agendas.length/2);
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
 /**
  * 🔴 Revisão 15/09 (D-03) — o equilíbrio puxar/empurrar é do BASELINE.
  * Decisão da coordenação: o desequilíbrio que vem dos extras autorizados é consequência
  * aceita do foco e não se compensa em outro grupo. O que continua proibido é o baseline
  * desequilibrar por causa do foco — e é isso que se mede aqui, com o extra descontado.
  */
 it('corte local conserva o equilíbrio do baseline, com foco em dia de puxar',()=>{
  for(const semana of [1,5,6] as const){
   const r=run(['seg','qua','sex'],{tempoPorSessaoMin:20,limiteTempoTreino:'limitado',foco:{grupo:'peito',compensa:'triceps',semana:1}},semana);
   expect(r.resultadoGeracao?.tipo).not.toBe('ERRO_ALOCADOR');
   const extras=new Set((r.blocoFoco?.adicionais??[]).map(a=>`${a.diaId??''}|${a.exercicioId}`));
   const conta=(padrao:string,doFoco:boolean)=>r.dias.reduce((n,d)=>n+d.slots.filter(s=>s.padrao===padrao&&extras.has(`${d.diaId??''}|${s.exercicio.id}`)===doFoco).length,0);
   expect(conta('puxar',false)).toBeGreaterThanOrEqual(conta('empurrar',false));
   // E nada de excesso sem dono: todo `empurrar` a mais tem de vir do bloco adicional.
   const excesso=(conta('empurrar',false)+conta('empurrar',true))-(conta('puxar',false)+conta('puxar',true));
   if(excesso>0)expect(excesso).toBeLessThanOrEqual(conta('empurrar',true));
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
