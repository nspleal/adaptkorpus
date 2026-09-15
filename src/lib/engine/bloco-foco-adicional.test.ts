import {describe,it,expect} from 'vitest';
import {adicionarBlocoFoco} from './bloco-foco-adicional';
import {EXERCISES} from '../data/exercises';
import type {DiaTreino} from './treino-types';
import type {Weekday} from '../semana';
const dia=(diaId:Weekday,ids:string[]):DiaTreino=>({nome:diaId,diaId,slots:ids.map(id=>{const exercicio=EXERCISES.find(e=>e.id===id)!;return {exercicio,padrao:exercicio.padraoMovimento,series:3,descansoSeg:120};})});
describe('bloco adicional, preserva baseline e calendário',()=>{
 it('duas exposições espaçadas, sem retirar nem alterar baseline',()=>{
  const base=[dia('seg',['e9','e19']),dia('qui',['e16','e17'])];const snapshot=JSON.stringify(base);
  const r=adicionarBlocoFoco(base,['seg','qui'],['peito'],EXERCISES,new Set());
  expect(r.adicionais.size).toBe(2);expect(r.dias[1]!.slots.filter(s=>s.exercicio.grupoPrimario==='peito')).toHaveLength(2);
  expect(JSON.stringify(base)).toBe(snapshot);for(let i=0;i<base.length;i++)for(const s of base[i]!.slots)expect(r.dias[i]!.slots).toContain(s);
 });
 it.each([['seg','ter'],['dom','seg']] as const)('consecutivos %s/%s adaptam ao dia existente',(...agenda)=>{
  const r=adicionarBlocoFoco([dia(agenda[0],['e9']),dia(agenda[1],['e19'])],agenda,['peito'],EXERCISES,new Set());
  expect(r.adaptados).toEqual(['peito']);expect(r.dias[0]!.slots).toHaveLength(3);expect(r.dias[1]!.slots).toHaveLength(1);
 });
 it('agregado mantém cada adicional no recorte correspondente e total2',()=>{
  const r=adicionarBlocoFoco([dia('seg',['e16']),dia('qui',['e80'])],['seg','qui'],['quadriceps','posterior'],EXERCISES,new Set());
  expect(r.adicionais.size).toBe(2);expect(r.dias[0]!.slots.every(s=>s.exercicio.grupoPrimario==='quadriceps')).toBe(true);expect(r.dias[1]!.slots.every(s=>s.exercicio.grupoPrimario==='posterior')).toBe(true);
 });
 it('um dia entrega foco2totais, outros1, sem acrescentar lombar/antebraço',()=>{
  const r=adicionarBlocoFoco([dia('seg',['e9','e11','e19','e72','e16'])],['seg'],['peito'],EXERCISES,new Set());
  const gs=r.dias[0]!.slots.map(s=>s.exercicio.grupoPrimario);expect(gs.filter(g=>g==='peito')).toHaveLength(2);expect(gs.filter(g=>g==='biceps')).toHaveLength(1);expect(gs).not.toContain('lombar');expect(gs).not.toContain('antebraco');
 });
});
