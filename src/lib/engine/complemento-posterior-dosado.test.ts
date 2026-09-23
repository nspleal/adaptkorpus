import { it, expect } from 'vitest';
import { completarCoberturaDosada } from './completar-cobertura-dosada';
import { EXERCISES } from '../data/exercises';
import type { DiaTreino, SlotExercicio } from './treino-types';
import { creditoPonderadoDaSemana } from './alocador';
import { diretosDoExercicio } from './cobertura-anatomica';
it('recupera trapézio cedendo só crédito indireto, sem perder dose direta, puxada ou remada', () => {
 const dias: DiaTreino[] = [
  {nome:'Upper A',slots:[slot('e49',1),slot('e46',3),slot('e72',3)]},
  {nome:'Upper B',slots:[slot('e49',1),slot('e46',1),slot('e75',3)]},
 ];
 const antes=structuredClone(dias);
 const executarCobertura=(cabeNoTempo:()=>boolean,tetoDia=12)=>completarCoberturaDosada({
  dias,pool:[ex('e97')],min:2,max:3,slotsMax:3,
  tetoSemana:g=>g==='costas'?6:10,tetoDia,
  materializar:(e,n)=>slot(e.id,n),cabeNoTempo,
 });
 expect(executarCobertura(()=>false)).toEqual([]);
 expect(dias).toEqual(antes);
 expect(executarCobertura(()=>true,3)).toEqual([]);
 expect(dias).toEqual(antes);
 expect(executarCobertura(()=>true)).toHaveLength(1);
 const ss=dias.flatMap(d=>d.slots),c=creditoPonderadoDaSemana(ss);
 expect(ss.filter(s=>s.exercicio.grupoPrimario==='costas').reduce((n,s)=>n+s.series!,0)).toBe(6);
 expect(ss.filter(s=>s.exercicio.grupoPrimario==='biceps').reduce((n,s)=>n+s.series!,0)).toBe(6);
 expect(creditoPonderadoDaSemana(antes.flatMap(d=>d.slots)).get('biceps')).toBe(8);
 expect(c.get('biceps')).toBe(7.5);
 expect(ss.some(s=>s.exercicio.id==='e97')).toBe(true);
 for(const d of dias){
  expect(d.slots.some(s=>s.exercicio.id==='e49')).toBe(true);
  expect(d.slots.some(s=>s.exercicio.id==='e46')).toBe(true);
  expect(d.slots.every(s=>s.series!>=1&&s.descansoSeg===120)).toBe(true);
 }
 expect(executarCobertura(()=>true)).toEqual([]); // Uma só adição para o alvo semanal.
});
const ex=(id:string)=>EXERCISES.find(e=>e.id===id)!;
const slot=(id:string,series:number):SlotExercicio=>({exercicio:ex(id),padrao:ex(id).padraoMovimento,series,descansoSeg:120});
function executar(dias:DiaTreino[], slotsMax=2, tempo=true) {
 completarCoberturaDosada({dias,pool:[ex('e64')],min:2,max:4,slotsMax,
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
