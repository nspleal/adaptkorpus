import { it, expect } from 'vitest';
import { completarPosteriorDosado } from './complemento-posterior-dosado';
import { EXERCISES } from '../data/exercises';
import type { DiaTreino, SlotExercicio } from './treino-types';
import { creditoPonderadoDaSemana } from './alocador';
import { diretosDoExercicio } from './cobertura-anatomica';
const ex=(id:string)=>EXERCISES.find(e=>e.id===id)!;
const slot=(id:string,series:number):SlotExercicio=>({exercicio:ex(id),padrao:ex(id).padraoMovimento,series,descansoSeg:120});
function executar(dias:DiaTreino[], slotsMax=2, tempo=true) {
 completarPosteriorDosado({dias,pool:[ex('e64')],min:2,max:4,slotsMax,
  tetoSemana:()=>16,tetoDia:12,materializar:(e,series)=>slot(e.id,series),cabeNoTempo:()=>tempo});
}
it('compensa flexão de joelho no outro posterior e conserva todos os créditos e alvos',()=>{
 const dias:DiaTreino[]=[{nome:'Pernas',slots:[slot('e80',2),slot('e81',2)]}];
 const credito=creditoPonderadoDaSemana(dias[0]!.slots);
 const alvos=new Set(dias[0]!.slots.flatMap(s=>[...diretosDoExercicio(s.exercicio.id)]));
 executar(dias);
 expect(dias[0]!.slots.map(s=>[s.exercicio.id,s.series])).toEqual([['e64',2],['e81',4]]);
 const depois=creditoPonderadoDaSemana(dias[0]!.slots);
 for(const [g,n] of credito)expect(depois.get(g)).toBeGreaterThanOrEqual(n);
 const novos=new Set(dias[0]!.slots.flatMap(s=>[...diretosDoExercicio(s.exercicio.id)]));
 for(const a of alvos)expect(novos.has(a)).toBe(true);
 expect(novos.has('fc')).toBe(true);
});
it('dois hinges no teto não podem ceder crédito de glúteos quando não há slot',()=>{
 const dias:DiaTreino[]=[{nome:'Pernas',slots:[slot('e80',4),slot('e81',4)]}];
 const antes=structuredClone(dias);executar(dias);expect(dias).toEqual(antes);
});
it('adiciona elegível com folga sem cobrar terceiros, e recusa quando não cabe no tempo',()=>{
 const dias:DiaTreino[]=[{nome:'Pernas',slots:[slot('e80',4),slot('e81',4)]}];
 const antes=structuredClone(dias);executar(dias,3,false);expect(dias).toEqual(antes);
 executar(dias,3);expect(dias[0]!.slots.map(s=>[s.exercicio.id,s.series])).toEqual([['e80',4],['e81',4],['e64',2]]);
});
