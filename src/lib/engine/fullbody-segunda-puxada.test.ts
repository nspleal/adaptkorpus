import {describe,it,expect} from 'vitest';
import {gerarTreino} from './index';
import {EXERCISES} from '../data/exercises';
import {papelReferencia,ehComplementar} from './selecao-referencia';
import {creditoPonderadoDaSemana,GRUPOS_GRANDES} from './alocador';
import {maxSemanalSemFoco,tetoSeriesGrupoNaSessao} from './trilhos';
import type {PerfilTreino} from './treino-types';
const perfil=(tempo=60):PerfilTreino=>({pesoKg:80,alturaCm:180,idade:30,flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false},objetivo:'massa',nivelExperiencia:'intermediario',equipamento:'academia',equipamentosCasa:[],diasDisponiveis:1,treinoDias:['qua'],tempoPorSessaoMin:tempo,limiteTempoTreino:'limitado'});
const run=(p:PerfilTreino)=>gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:3}}).rotina!;
describe('author: second back exercise in automatic one-day full-body',()=>{
 it('keeps complementary pulling functions, main groups, time and volume',()=>{
  const p=perfil(),r=run(p),ss=r.dias[0]!.slots,backs=ss.filter(s=>s.exercicio.grupoPrimario==='costas');
  expect(backs).toHaveLength(2);
  expect(new Set(backs.map(s=>papelReferencia(s.exercicio))).size).toBe(2);
  expect(ss.filter(s=>s.padrao==='puxar').length).toBeGreaterThanOrEqual(ss.filter(s=>s.padrao==='empurrar').length);
  for(const g of ['peito','costas','ombros','quadriceps','posterior','gluteos','biceps','triceps'])expect(ss.some(s=>s.exercicio.grupoPrimario===g),g).toBe(true);
  expect(ss.filter(s=>s.exercicio.grupoPrimario&&ehComplementar(s.exercicio.grupoPrimario)).length).toBeLessThanOrEqual(1);
  const c=creditoPonderadoDaSemana(ss);
  for(const g of GRUPOS_GRANDES)expect(c.get(g)??0,g).toBeLessThanOrEqual(Math.min(maxSemanalSemFoco(p.nivelExperiencia,p.objetivo),tetoSeriesGrupoNaSessao(p.nivelExperiencia,p.objetivo)));
  expect(r.duracaoDias?.[0]?.estadoCalculo).toBe('CALCULADO');
  expect(r.duracaoDias![0]!.duracaoMaximaEstimadaSegundos!).toBeLessThanOrEqual(3600);
 });
 it('uses the allowed second back without a phantom posterior addition when time is unlimited',()=>{
  const r=run({...perfil(75),limiteTempoTreino:'sem_limite'}),ss=r.dias[0]!.slots;
  expect(ss.filter(s=>s.exercicio.grupoPrimario==='costas')).toHaveLength(2);
  expect(ss.filter(s=>s.exercicio.grupoPrimario==='posterior')).toHaveLength(1);
  expect(r.avisos.some(a=>a.startsWith('Cobertura de posteriores')&&a.includes('adicionado'))).toBe(false);
  expect(ss.filter(s=>s.padrao==='puxar').length).toBeGreaterThanOrEqual(ss.filter(s=>s.padrao==='empurrar').length);
 });
 it('reports infeasibility without forcing a second back into a tight session',()=>{
  const r=run(perfil(30));expect(r.dias[0]!.slots.filter(s=>s.exercicio.grupoPrimario==='costas')).toHaveLength(1);
  expect(r.avisos.some(a=>a.includes('Mantivemos o plano anterior'))).toBe(true);
  expect(r.duracaoDias![0]!.duracaoMaximaEstimadaSegundos!).toBeLessThanOrEqual(1800);
 });
 it('does not redesign a manual one-day plan',()=>{
  const ids=['e45','e11','e41','e28','e80','e57','e72','e67'];
  const r=run({...perfil(120),rotinaCustom:{origem:'usuario',dias:[{nome:'Manual',diaId:'qua',exercicioIds:ids}]}});
  expect(r.dias[0]!.slots.map(s=>s.exercicio.id)).toEqual(ids);
  expect(r.avisos.some(a=>a.startsWith('Full-body de um dia:'))).toBe(false);
 });
});


describe('main arm slots precede deferred core reservations',()=>{
 it.each([4,5] as const)('%i selected days at 30 minutes retain both arm groups',dias=>{
  const p={...perfil(30),diasDisponiveis:dias,treinoDias:(dias===4?['seg','ter','qui','sex']:['seg','ter','qua','qui','sex']) as PerfilTreino['treinoDias']};
  const r=run(p),ss=r.dias.flatMap(d=>d.slots);
  for(const g of ['biceps','triceps'])expect(ss.some(s=>s.exercicio.grupoPrimario===g),g).toBe(true);
  expect(r.duracaoDias!.every(d=>d.estadoCalculo==='CALCULADO'&&d.duracaoMaximaEstimadaSegundos!<=1800)).toBe(true);
  expect(r.dias.every(d=>d.slots.filter(s=>!ehComplementar(s.exercicio.grupoPrimario)).length===0||d.slots.filter(s=>ehComplementar(s.exercicio.grupoPrimario)).length<=1)).toBe(true);
 });
});

describe('Upper curto preserva grandes antes do piso condicionado dos braços',()=>{
 it.each(['iniciante','intermediario','avancado'] as const)('%s, dois dias/30min: supino, puxada, remada e ombros',nivel=>{
  const r=run({...perfil(30),nivelExperiencia:nivel,diasDisponiveis:2,treinoDias:['seg','qui']});
  const ss=r.dias[0]!.slots;
  for(const g of ['peito','costas','ombros'])expect(ss.some(s=>s.exercicio.grupoPrimario===g),g).toBe(true);
  expect(ss.filter(s=>s.padrao==='puxar').length).toBeGreaterThanOrEqual(ss.filter(s=>s.padrao==='empurrar').length);
  expect(r.duracaoDias!.every(d=>d.estadoCalculo==='CALCULADO'&&d.duracaoMaximaEstimadaSegundos!<=1800)).toBe(true);
 });
});
