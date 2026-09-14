import {describe,it,expect} from 'vitest';
import {reduzirEstruturaPorTempo} from './ajuste-tempo-estrutura';
import {EXERCISES} from '../data/exercises';
import type {DiaTreino,SlotExercicio} from './treino-types';
const slot=(id:string):SlotExercicio=>{const exercicio=EXERCISES.find(e=>e.id===id)!;return {exercicio,padrao:exercicio.padraoMovimento,series:2,descansoSeg:120};};
const dia=(slots:SlotExercicio[]):DiaTreino=>({nome:'Teste',diaId:'seg',slots});
describe('corte concreto por orçamento — decisões14/09',()=>{
 it('remove extras antes de baseline, alterna maior removível/outro e preserva únicos',()=>{
  const base=['e9','e11','e14','e19','e72','e74'].map(slot),extra=slot('e55');
  const r=reduzirEstruturaPorTempo(dia([...base,extra]),'intermediario',1,new Set([extra]));
  expect(r.removidos[0]).toBe(extra);
  expect(r.removidos.slice(1).map(s=>s.exercicio.grupoPrimario)).toEqual(['biceps','peito','biceps','peito']);
  expect(r.dia.slots.map(s=>s.exercicio.grupoPrimario).sort()).toEqual(['biceps','peito']);
  expect(r.incompativel).toBe(true);expect(r.naoAvaliado).toBe(false);
  expect(base.every(s=>s.series===2)).toBe(true);
 });
 it('não corta o único exercício nem para retirar um extra',()=>{
  const extra=slot('e9');const r=reduzirEstruturaPorTempo(dia([extra]),'intermediario',1,new Set([extra]));
  expect(r.removidos).toEqual([]);expect(r.incompativel).toBe(true);
 });
 it('sem limite não corta; o número de minutos não serve de sentinela',()=>{
  const slots=['e9','e11','e14'].map(slot);const r=reduzirEstruturaPorTempo(dia(slots),'intermediario',undefined,new Set(slots));
  expect(r.dia.slots).toEqual(slots);expect(r.removidos).toEqual([]);expect(r.incompativel).toBe(false);
 });
 it('dado ausente permanece não avaliado, sem poda arbitrária',()=>{
  const s=slot('e9');delete s.series;const r=reduzirEstruturaPorTempo(dia([s,slot('e11')]),'intermediario',1,new Set());
  expect(r.naoAvaliado).toBe(true);expect(r.removidos).toEqual([]);
 });
});
