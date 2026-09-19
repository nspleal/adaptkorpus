import {gerarTreino} from './index';
import {avaliarDuracaoResistida} from './duracao-plano';
import type {PerfilTreino} from './treino-types';
import {preencherComplementaresAusentes} from './preencher-complementares';
import {describe,expect,it} from 'vitest';
import {EXERCISES} from '../data/exercises';
import {adicionarBlocoFoco,realocarPernasReduzindoCore} from './bloco-foco-adicional';
import {consolidarPequenos} from './consolidar-pequenos';
import {creditoPonderadoDaSemana,GRUPOS_GRANDES} from './alocador';
import {diretosDoExercicio,tracosMecanicos} from './cobertura-anatomica';
import type {DiaTreino,SlotExercicio} from './treino-types';
const slot=(id:string,series=3):SlotExercicio=>{const exercicio=EXERCISES.find(e=>e.id===id)!;return {exercicio,padrao:exercicio.padraoMovimento,series,descansoSeg:120};};
const dias=():DiaTreino[]=>[{nome:'Upper',diaId:'seg',slots:[slot('e9'),slot('e147')]},{nome:'Lower',diaId:'qui',slots:[slot('e3'),slot('e36')]}];
describe('continuação autorizada: complementares e foco',()=>{
 it.each(['panturrilha','antebraco'] as const)('foco em %s não fura um complementar por dia misto nem retira principal',g=>{
  const base=dias(),antes=structuredClone(base);
  const r=adicionarBlocoFoco(base,['seg','qui'],[g],EXERCISES,new Set());
  expect(r.adicionais.size).toBe(0);expect(r.faltantes).toContain(g);expect(r.solicitados).toBe(2);
  expect(r.dias).toEqual(antes);expect(base).toEqual(antes);
 });
 it('a exceção continua sendo o dia dedicado já escolhido',()=>{
  const base:DiaTreino[]=[...dias(),{nome:'Complementares',diaId:'sab',slots:[slot('e73'),slot('e147')]}];
  const r=adicionarBlocoFoco(base,['seg','qui','sab'],['antebraco'],EXERCISES,new Set());
  expect(r.adicionais.size).toBe(2);expect(r.dias).toHaveLength(3);
  expect(r.dias.slice(0,2)).toEqual(base.slice(0,2));
  expect([...r.adicionais].every(s=>r.dias[2]!.slots.includes(s))).toBe(true);
 });
});
describe('consolidação dos braços pela dose e cobertura, sem quota de exercícios',()=>{
 const montar=():DiaTreino[]=>[{nome:'Braços',diaId:'seg',slots:['e67','e68','e69','e70'].map(id=>slot(id))}];
 const alvos=(ss:SlotExercicio[])=>new Set(ss.flatMap(s=>[...diretosDoExercicio(s.exercicio.id)]));
 const tracos=(ss:SlotExercicio[])=>new Set(ss.flatMap(s=>[...tracosMecanicos(s.exercicio.id)]));
 it('o caso redundante cabe em menos exercícios sem perder dose, crédito ou cobertura',()=>{
  const ds=montar(),antes=structuredClone(ds[0]!.slots),cred=creditoPonderadoDaSemana(antes);
  expect(consolidarPequenos({dias:ds,maxSeries:4,tetoSemana:()=>100,cabe:()=>true})).toBeGreaterThan(0);
  const depois=ds[0]!.slots;expect(depois.reduce((n,s)=>n+s.series!,0)).toBe(12);
  for(const [g,n] of cred)expect(creditoPonderadoDaSemana(depois).get(g)??0,g).toBeGreaterThanOrEqual(n);
  for(const a of alvos(antes))expect(alvos(depois).has(a),a).toBe(true);
  for(const a of tracos(antes))expect(tracos(depois).has(a),a).toBe(true);
  expect(depois.every(s=>s.series!<=4)).toBe(true);
 });
 it.each(['dose','tempo','favoritos'] as const)('preserva quatro exercícios quando %s impede a consolidação',restricao=>{
  const ds=montar();if(restricao==='favoritos')ds[0]!.slots.forEach(s=>s.incluidoPorPreferencia=true);
  const antes=structuredClone(ds);
  expect(consolidarPequenos({dias:ds,maxSeries:restricao==='dose'?3:4,tetoSemana:()=>100,cabe:()=>restricao!=='tempo'})).toBe(0);
  expect(ds).toEqual(antes);
 });
});


describe('preenchimento tardio mantém a autoridade anatômica e os limites',()=>{
 const pool=EXERCISES.filter(e=>['e4','e147'].includes(e.id));
 const executar=(favorito?:string,teto=100)=>{
  const ds:DiaTreino[]=[{nome:'Superior',diaId:'seg',slots:[slot('e9')]}];
  const original=structuredClone(ds[0]!.slots);
  preencherComplementaresAusentes({dias:ds,pool,slotsMax:2,minSeries:2,tetoSemana:()=>teto,tetoDia:teto,
   materializar:e=>({...slot(e.id),...(favorito===e.id?{incluidoPorPreferencia:true}:{})}),cabeNoTempo:()=>true});
  expect(ds[0]!.slots[0]).toEqual(original[0]);
  return ds[0]!.slots;
 };
 it('prefere cobertura adicional elegível ao primeiro ID do pool',()=>{
  const ss=executar();expect(ss.map(s=>s.exercicio.id)).toEqual(['e9','e147']);
  for(const a of diretosDoExercicio('e4'))expect(diretosDoExercicio(ss[1]!.exercicio.id).has(a)).toBe(true);
  expect(diretosDoExercicio(ss[1]!.exercicio.id).size).toBeGreaterThan(diretosDoExercicio('e4').size);
 });
 it('favorito elegível precede a preferência de cobertura',()=>{
  expect(executar('e4').map(s=>s.exercicio.id)).toEqual(['e9','e4']);
 });
 it('não compra cobertura com excesso de volume',()=>{
  expect(executar(undefined,1).map(s=>s.exercicio.id)).toEqual(['e9']);
 });
});


describe('exceção autorizada: core 2→1 apenas para recortes de pernas em quatro dias',()=>{
 const base=():DiaTreino[]=>[
  {nome:'Peito',diaId:'seg',slots:[slot('e9'),slot('e147')]},
  {nome:'Pernas',diaId:'ter',slots:[slot('e3'),slot('e80'),slot('e36')]},
  {nome:'Costas',diaId:'qui',slots:[slot('e49'),slot('e73')]},
  {nome:'Ombros',diaId:'sex',slots:[slot('e52'),slot('e4')]},
 ];
 const recortes=[{nome:'Peito + Ombros',grupos:['peito','ombros','core'] as const},
  {nome:'Quadríceps',grupos:['quadriceps','panturrilha'] as const},
  {nome:'Costas',grupos:['costas','antebraco'] as const},
  {nome:'Posteriores',grupos:['posterior','panturrilha'] as const}];
 const outros=(ds:readonly DiaTreino[])=>ds.flatMap(d=>d.slots).filter(s=>s.exercicio.grupoPrimario!=='core').sort((a,b)=>a.exercicio.id.localeCompare(b.exercicio.id));
 it('reduz só uma ocorrência de core, com antebraço e todos os outros slots byte-idênticos',()=>{
  const ds=base(),antes=structuredClone(ds);
  const r=realocarPernasReduzindoCore(ds,recortes,dd=>dd.every(d=>d.slots.length<=3))!;
  expect(r).not.toBeNull();expect(r).toHaveLength(4);expect(outros(r)).toEqual(outros(antes));
  expect(r.flatMap(d=>d.slots).filter(s=>s.exercicio.grupoPrimario==='core')).toHaveLength(1);
  expect(r.filter(d=>d.slots.some(s=>['quadriceps','posterior'].includes(s.exercicio.grupoPrimario??'')))).toHaveLength(2);
  for(const d of r)expect(d.slots.filter(s=>['core','antebraco','panturrilha'].includes(s.exercicio.grupoPrimario??'')).length).toBeLessThanOrEqual(1);
  expect(ds).toEqual(antes);
 });
 it('não aplica a exceção em três dias, com um core, ou quando os limites ainda não comportam',()=>{
  expect(realocarPernasReduzindoCore(base().slice(0,3),recortes.slice(0,3),()=>true)).toBeNull();
  const ds=base();ds[3]!.slots=ds[3]!.slots.filter(s=>s.exercicio.grupoPrimario!=='core');
  expect(realocarPernasReduzindoCore(ds,recortes,()=>true)).toBeNull();
  expect(realocarPernasReduzindoCore(base(),recortes,()=>false)).toBeNull();
 });
});


it('caminho real: quatro dias, duas pernas, core 2→1 e principais preservados',()=>{
 const p:PerfilTreino={pesoKg:80,alturaCm:180,idade:30,flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false},objetivo:'massa',nivelExperiencia:'intermediario',equipamento:'academia',diasDisponiveis:4,treinoDias:['seg','ter','qui','sex'],tempoPorSessaoMin:75,limiteTempoTreino:'limitado'};
 const run=(perfil:PerfilTreino)=>gerarTreino(perfil,{exercises:EXERCISES,semanaCiclo:{semana:1}}).rotina!;
 const antes=run(p),depois=run({...p,focoAgregado:{grupo:'pernas',semana:1}});
 const core=(r:typeof antes)=>r.dias.filter(d=>d.slots.some(s=>s.exercicio.grupoPrimario==='core')).length;
 expect(core(antes)).toBe(2);expect(core(depois)).toBe(1);
 const assinatura=(r:typeof antes)=>r.dias.flatMap(d=>d.slots).filter(s=>!s.extraDoFoco&&!['core','panturrilha','quadriceps','posterior'].includes(s.exercicio.grupoPrimario??'')).map(s=>JSON.stringify([s.exercicio.id,s.series,s.descansoSeg])).sort();
 expect(assinatura(depois)).toEqual(assinatura(antes));
 for(const g of ['quadriceps','posterior']){
  const dose=(r:typeof antes)=>r.dias.flatMap(d=>d.slots).filter(s=>!s.extraDoFoco&&s.exercicio.grupoPrimario===g).reduce((n,s)=>n+s.series!,0);
  expect(dose(depois),g).toBe(dose(antes));
 }
 expect(depois.dias).toHaveLength(4);
 expect(depois.dias.filter(d=>d.slots.some(s=>['quadriceps','posterior'].includes(s.exercicio.grupoPrimario??'')))).toHaveLength(2);
 expect(depois.avisos.some(a=>a.startsWith('Para separar as duas sessões de pernas'))).toBe(true);
 // Limites independentes da decisão de aceitar a realocação: medir o plano entregue.
 const teto=depois.tetoVolumeSemana!;
 for(const [g,n] of creditoPonderadoDaSemana(depois.dias.flatMap(d=>d.slots)))
  expect(n,`semana/${g}`).toBeLessThanOrEqual(teto.gruposEmFoco.includes(g)?teto.cheio:teto.semFoco);
 for(const d of depois.dias){
  const m=avaliarDuracaoResistida(d.slots,p.nivelExperiencia);
  expect(m.estadoCalculo).toBe('CALCULADO');
  expect(m.duracaoMaximaEstimadaSegundos).toBeLessThanOrEqual(p.tempoPorSessaoMin*60);
  for(const [g,n] of creditoPonderadoDaSemana(d.slots))if(GRUPOS_GRANDES.includes(g))expect(n,`${d.diaId}/${g}`).toBeLessThanOrEqual(teto.sessao!);
 }
 // A mesma escolha de foco sobre um desenho manual não autoriza reduzir seu core.
 const desenho={origem:'usuario' as const,dias:antes.dias.map(d=>({nome:d.nome,diaId:d.diaId,
  exercicioIds:d.slots.map(s=>s.exercicio.id),seriesPorExercicio:Object.fromEntries(d.slots.map(s=>[s.exercicio.id,s.series!]))}))};
 const manual=run({...p,rotinaCustom:desenho,focoAgregado:{grupo:'pernas',semana:1}});
 expect(core(manual)).toBe(2);
 expect(manual.dias.map(d=>d.slots.map(s=>[s.exercicio.id,s.series])))
  .toEqual(antes.dias.map(d=>d.slots.map(s=>[s.exercicio.id,s.series])));
 expect(manual.avisos.some(a=>a.startsWith('Para separar as duas sessões de pernas'))).toBe(false);

 for(const d of depois.dias){
  const gs=d.slots.map(s=>s.exercicio.grupoPrimario??'');
  expect(gs.filter(g=>['core','antebraco','panturrilha'].includes(g)).length).toBeLessThanOrEqual(1);
  if(gs.includes('panturrilha'))expect(gs.some(g=>['quadriceps','posterior','gluteos'].includes(g))).toBe(true);
 }
});
