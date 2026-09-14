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
 it.each([20,75])('a frase relata só adicionais sobreviventes, tempo%i',tempoPorSessaoMin=>{
  const p={...perfil,tempoPorSessaoMin,foco:{grupo:'peito' as const,semana:1}};
  const r=montarRotina(prescreverTreino(p,avaliarGateTreino(p)),p,EXERCISES,new Set(),{semana:3});
  const n=r.blocoFoco!.adicionais.length;
  expect(fraseDoFoco(r)).toContain(n?`${n} exercício`:'não foi possível');
  expect(fraseDoFoco(r)).not.toMatch(/cedid/);
  for(const a of r.blocoFoco!.adicionais)expect(r.dias.find(d=>d.diaId===a.diaId)?.slots.some(s=>s.exercicio.id===a.exercicioId&&s.series===a.series)).toBe(true);
 });
});
