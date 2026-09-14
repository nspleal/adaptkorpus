import {describe,it,expect} from 'vitest';
import {freqMaxPorGrupo} from './treino-retomada';
import {creditoPonderadoDaSemana} from './alocador';
import {gerarTreino} from './index';
import {EXERCISES} from '../data/exercises';
import {ORDEM_SEMANA, type Weekday} from '../semana';
import type {PerfilTreino} from './treino-types';
const base:PerfilTreino={pesoKg:80,alturaCm:180,idade:30,flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false},objetivo:'massa',nivelExperiencia:'avancado',equipamento:'academia',diasDisponiveis:3,tempoPorSessaoMin:90};
const agendas:Record<number,Weekday[]>={1:['seg'],2:['seg','qui'],3:['seg','qua','sex'],4:['seg','ter','qui','sex'],5:['seg','ter','qua','sex','sab'],6:['seg','ter','qua','qui','sex','sab'],7:[...ORDEM_SEMANA]};
function run(n:number,f?:'bracos'|'pernas'|'peito'|'costas'|'antebraco',over:Partial<PerfilTreino>={}){return gerarTreino({...base,diasDisponiveis:n,treinoDias:agendas[n],...(f==='bracos'||f==='pernas'?{focoAgregado:{grupo:f,semana:1}}:f?{foco:{grupo:f,compensa:f==='peito'?'costas':'peito',semana:1}}:{}),...over},{exercises:EXERCISES,semanaCiclo:{semana:1}}).rotina!;}
const grupos=(r:ReturnType<typeof run>)=>r.dias.map(d=>d.slots.map(s=>s.exercicio.grupoPrimario));
describe('etapa2: possibilidades na saída final',()=>{
 it('3 sem foco: peito/tríceps, costas/bíceps e pernas com ombros',()=>{
  const gs=grupos(run(3));expect(gs.filter(g=>g.includes('quadriceps')||g.includes('posterior'))).toHaveLength(1);
  expect(gs.some(g=>g.includes('peito')&&g.includes('triceps')&&!g.includes('costas'))).toBe(true);
  expect(gs.flat()).toContain('ombros');
 });
 it('3 braços: bíceps antes de peito e tríceps antes de costas',()=>{
  const r=run(3,'bracos'),gs=grupos(r);
  expect(gs.some(g=>g[0]==='biceps'&&g.includes('peito')&&!g.includes('costas'))).toBe(true);
  expect(gs.some(g=>g[0]==='triceps'&&g.includes('costas')&&!g.includes('peito'))).toBe(true);
  expect(gs.flat()).toEqual(expect.arrayContaining(['quadriceps','posterior','ombros']));
 });
 it.each([4,5,6])('%i peito/costas: sessões reais do foco e diferença estrutural',n=>{
  const p=grupos(run(n,'peito')),c=grupos(run(n,'costas'));
  expect(p.filter(g=>g.includes('peito'))).toHaveLength(2);
  expect(c.filter(g=>g.includes('costas'))).toHaveLength(2);
  expect(p).not.toEqual(c);
  for(const g of [p,c])expect(g.flat()).toEqual(expect.arrayContaining(['peito','costas','quadriceps','posterior','ombros','biceps','triceps']));
 });
 it.each([4,5])('%i pernas: duas ênfases e dois superiores separados',n=>{
  const gs=grupos(run(n,'pernas'));
  expect(gs.filter(g=>g.includes('quadriceps')||g.includes('posterior'))).toHaveLength(2);
  expect(gs.some(g=>g.includes('peito')&&!g.includes('costas'))).toBe(true);
  expect(gs.some(g=>g.includes('costas')&&!g.includes('peito'))).toBe(true);
  expect(gs.flat()).toContain('ombros');
 });
 it('6 pernas: duas sessões inferiores abrangentes, diferentes do neutro',()=>{
  const f=grupos(run(6,'pernas'));expect(f.filter(g=>g.includes('quadriceps')&&g.includes('posterior'))).toHaveLength(2);expect(f).not.toEqual(grupos(run(6)));
 });
 it('antebraço: bloco direto com foco explícito, sem novo dia exclusivo',()=>{
  const f=grupos(run(4,'antebraco'));expect(f.some(g=>g.includes('antebraco')&&g.length>1)).toBe(true);
  expect(grupos(run(4)).flat()).not.toContain('antebraco');
 });
});

describe('etapa2: contratos no seletor atual, sem fixture histórica',()=>{
 it('banda ponderada no caso intermediário de 4 dias é preservada',()=>{
  const r=run(4,undefined,{nivelExperiencia:'intermediario',tempoPorSessaoMin:60});
  const creditos=creditoPonderadoDaSemana(r.dias.flatMap(d=>d.slots));
  for(const g of ['peito','costas'] as const)expect(creditos.get(g)).toBeLessThanOrEqual(16);
 });
 it('manual preserva ids, ordem, dia e séries apesar de foco/agenda diferentes',()=>{
  const rotinaCustom={origem:'usuario' as const,dias:[{nome:'Meu',diaId:'sex' as const,exercicioIds:['e1','e11'],seriesPorExercicio:{e1:3,e11:2}}]};
  const r=run(1,'bracos',{rotinaCustom});expect(r.dias).toHaveLength(1);
  expect(r.dias[0]!.diaId).toBe('sex');expect(r.dias[0]!.slots.map(s=>[s.exercicio.id,s.series])).toEqual([['e1',3],['e11',2]]);
  expect(r.distribuicao).toBeUndefined();expect(rotinaCustom.dias[0]!.exercicioIds).toEqual(['e1','e11']);
 });
 it('7 dias conserva teto de força e oferece recuperação',()=>{
  const r=run(7,'peito');expect(r.dias.length).toBeLessThanOrEqual(6);expect(r.diasCardioRecuperacao).toBeGreaterThanOrEqual(1);
  expect(grupos(r).filter(g=>g.includes('peito'))).toHaveLength(2);
 });
 it('focos individuais, restrições e equipamento: presença real ou limite dito',()=>{
  for(const grupo of ['ombros','biceps','triceps','quadriceps','posterior','gluteos','panturrilha','core','antebraco'] as const)
  for(const n of [1,2,3,4,5,6,7])for(const equipamento of ['academia','nenhum'] as const){
   const r=run(n,undefined,{equipamento,tempoPorSessaoMin:20,foco:{grupo,compensa:'peito',semana:1},preferencias:{banidos:['e1'],trocas:[]}});
   expect(r.dias.flatMap(d=>d.slots).some(s=>s.exercicio.id==='e1')).toBe(false);
   if(!grupos(r).flat().includes(grupo))expect(r.avisos.some(a=>a.includes('foco não foi atendido'))).toBe(true);
   if(r.distribuicao&&!r.distribuicao.atendida)expect(r.avisos.some(a=>a.startsWith('Distribuição planejada'))).toBe(true);
  }
 });
 it('deload reduz volume real com as divisões novas, todos os níveis/dias/focos',()=>{
  for(const n of [1,2,3,4,5,6,7])for(const nivelExperiencia of ['iniciante','intermediario','avancado'] as const)
  for(const f of [undefined,'bracos','pernas','peito'] as const){
   const perfil={...base,diasDisponiveis:n,treinoDias:agendas[n],nivelExperiencia,...(f==='bracos'||f==='pernas'?{focoAgregado:{grupo:f,semana:1}}:f?{foco:{grupo:f,compensa:'ombros' as const,semana:1}}:{})};
   const a=gerarTreino(perfil,{exercises:EXERCISES,semanaCiclo:{semana:5}}).rotina!;
   const b=gerarTreino(perfil,{exercises:EXERCISES,semanaCiclo:{semana:6}}).rotina!;
   const soma=(r:typeof a)=>r.dias.flatMap(d=>d.slots).reduce((v,s)=>v+(s.series??0),0);
   expect(soma(b),JSON.stringify({n,nivelExperiencia,f})).toBeLessThan(soma(a));
  }
 });
 it('retomada mantém frequência por sessão e sinaliza adaptação',()=>{
  const r=gerarTreino({...base,diasDisponiveis:6,treinoDias:agendas[6],focoAgregado:{grupo:'bracos',semana:1}},{exercises:EXERCISES,semanaCiclo:{semana:3,retomada:{semana:1,fator:0.5,volumeReferencia:14}}}).rotina!;
  const gs=grupos(r);for(const g of new Set(gs.flat()))expect(gs.filter(xs=>xs.includes(g)).length).toBeLessThanOrEqual(freqMaxPorGrupo(1));
  expect(r.distribuicao).toMatchObject({adaptada:true,atendida:false});
 });
});
