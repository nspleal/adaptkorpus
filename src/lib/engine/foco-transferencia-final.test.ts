import { describe, expect, it, vi } from 'vitest';
import * as alocador from './alocador';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { EXERCISES } from '../data/exercises';
import { fraseDoFoco } from '../foco-copy';
import type { PerfilTreino } from './treino-types';

const perfil: PerfilTreino = {
  pesoKg: 80, alturaCm: 180, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia',
  diasDisponiveis: 3, tempoPorSessaoMin: 45, divisaoPreferida: 'prioridades',
};

//14/09: transferência automática superada por adição; original preservado na base.
describe('Foco adicional: plano e relato final',()=>{
 it('não solicita transferência; conserva o baseline dos outros grupos',()=>{
  const spy=vi.spyOn(alocador,'alocarSemana');
  try{
   for(const grupo of ['peito','ombros','triceps','biceps','costas'] as const){
    const p={...perfil,limiteTempoTreino:'sem_limite' as const,foco:{grupo,semana:1}};
    const r=montarRotina(prescreverTreino(p,avaliarGateTreino(p)),p,EXERCISES,new Set(),{semana:3});
    const neutro={...p,foco:undefined};const b=montarRotina(prescreverTreino(neutro,avaliarGateTreino(neutro)),neutro,EXERCISES,new Set(),{semana:3});
    const assinatura=(x:typeof r)=>x.dias.flatMap(d=>d.slots.filter(s=>s.exercicio.grupoPrimario!==grupo).map(s=>`${d.diaId}:${s.exercicio.id}:${s.series}`)).sort();
    expect(assinatura(r)).toEqual(assinatura(b));
    expect(r.blocoFoco?.grupos).toEqual([grupo]);
   }
   expect(spy.mock.calls.length).toBeGreaterThan(0);
   expect(spy.mock.calls.every(([a])=>!a.transferirSlot)).toBe(true);
  }finally{spy.mockRestore();}
 });
 /**
  * 🔴 L-01 (revisão independente 15/09) — a MESMA prova com tempo LIMITADO, a região que
  * ficou sem cobertura quando esta suíte migrou para `sem_limite`. Nos 45 min da fixture, o
  * candidato `badcea47` deixava terceiros pagarem pelo bloco; aqui a assinatura do baseline
  * sai idêntica e o ganho do grupo focado é exatamente o que o bloco declara ter entregue.
  */
 /**
  * 🔵 REANCORADO em 2026-09-17, por medição, não por conveniência.
  *
  * A prova do baseline (assinatura idêntica + ganho == bloco declarado) continua sendo feita
  * nos 45 min da fixture original, que é o regime apertado. O que mudou foi a
  * ANTI-VACUIDADE: com a sequência aprovada, o baseline dos 45 min passou a ceder SÉRIES em
  * vez de perder um exercício, e um exercício a mais no dia deixa menos folga para o bloco.
  * Medido nesta mesma fixture: 45 min entregava bloco em 3 de 5 grupos em `0a457709` e
  * entrega 0 de 5 agora; 60 min vai de 5 para 4; 75 e 90 min seguem em 5 de 5.
  *
  * Então a matriz cobre DOIS orçamentos limitados: 45 min (onde o bloco é eliminado) e
  * 60 min (onde ele sobrevive). Os dois lados são exigidos — o teste não pode passar por
  * ausência de caso em nenhum deles.
  */
 it('tempo LIMITADO: baseline intacto e ganho igual ao bloco entregue',()=>{
  let comBloco=0,semBloco=0;
  for(const tempoPorSessaoMin of [45,60]){
   for(const grupo of ['peito','ombros','triceps','biceps','costas'] as const){
    const p={...perfil,tempoPorSessaoMin,limiteTempoTreino:'limitado' as const,foco:{grupo,semana:1}};
    const r=montarRotina(prescreverTreino(p,avaliarGateTreino(p)),p,EXERCISES,new Set(),{semana:3});
    const neutro={...p,foco:undefined};
    const b=montarRotina(prescreverTreino(neutro,avaliarGateTreino(neutro)),neutro,EXERCISES,new Set(),{semana:3});
    const assinatura=(x:typeof r)=>x.dias.flatMap(d=>d.slots.filter(s=>s.exercicio.grupoPrimario!==grupo).map(s=>`${d.diaId}:${s.exercicio.id}:${s.series}`)).sort();
    expect(assinatura(r),`foco ${grupo} @${tempoPorSessaoMin}`).toEqual(assinatura(b));
    const serie=(x:typeof r)=>x.dias.flatMap(d=>d.slots).filter(s=>s.exercicio.grupoPrimario===grupo).reduce((n,s)=>n+(s.series??0),0);
    const entregue=(r.blocoFoco?.adicionais??[]).reduce((n,a)=>n+a.series,0);
    expect(serie(r)-serie(b),`foco ${grupo} @${tempoPorSessaoMin}: ganho ≠ bloco declarado`).toBe(entregue);
    if(entregue>0)comBloco+=1;else semBloco+=1;
   }
  }
  expect(comBloco,'nenhum bloco sobreviveu em regime limitado — o caso não discrimina').toBeGreaterThan(0);
  expect(semBloco,'nenhum bloco foi eliminado — o outro lado da prova sumiu').toBeGreaterThan(0);
 });
 it.each([20,75])('a frase relata só adicionais sobreviventes, tempo%i',tempoPorSessaoMin=>{
  const p={...perfil,tempoPorSessaoMin,foco:{grupo:'peito' as const,semana:1}};
  const r=montarRotina(prescreverTreino(p,avaliarGateTreino(p)),p,EXERCISES,new Set(),{semana:3});
  const n=r.blocoFoco!.adicionais.length;
  expect(fraseDoFoco(r)).toContain(n?`${n} exercício`:'não foi possível');
  expect(fraseDoFoco(r)).not.toMatch(/cedid/);
  for(const a of r.blocoFoco!.adicionais)expect(r.dias.find(d=>d.diaId===a.diaId)?.slots.some(s=>s.exercicio.id===a.exercicioId&&s.series===a.series)).toBe(true);
 });
});
