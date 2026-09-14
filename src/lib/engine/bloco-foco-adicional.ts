import type {Exercise,GrupoPrimario} from '../data/types';
import {ORDEM_SEMANA,type Weekday} from '../semana';
import {secundariosDe} from './secundarios';
import type {DiaTreino,SlotExercicio} from './treino-types';

/** Autor14/09: adição ao baseline, não transferência. Pool já elegível no montador.
 * Séries/descanso/hold são materializados pelo chamador, na autoridade existente. */
export function adicionarBlocoFoco(
 base:readonly DiaTreino[],agenda:readonly Weekday[],grupos:readonly GrupoPrimario[],
 pool:readonly Exercise[],favoritos:ReadonlySet<string>,
):{dias:DiaTreino[];adicionais:Set<SlotExercicio>;adaptados:GrupoPrimario[];faltantes:GrupoPrimario[]}{
 const dias=base.map(d=>({...d,slots:[...d.slots]})),adicionais=new Set<SlotExercicio>();
 const adaptados:GrupoPrimario[]=[],faltantes:GrupoPrimario[]=[];
 const tem=(d:DiaTreino,g:GrupoPrimario)=>d.slots.some(s=>s.exercicio.grupoPrimario===g);
 const consecutivo=(a:Weekday,b:Weekday)=>{const delta=Math.abs(ORDEM_SEMANA.indexOf(a)-ORDEM_SEMANA.indexOf(b));return delta===1||delta===6;};
 // A exceção de um dia conserva apenas um direto de cada grupo já representado.
 if(agenda.length===1)for(const d of dias){const vistos=new Set<GrupoPrimario>();d.slots=d.slots.filter(s=>{const g=s.exercicio.grupoPrimario;if(!g||vistos.has(g))return false;vistos.add(g);return true;});}
 for(const g of grupos){
  const existentes=dias.filter(d=>tem(d,g));
  let destino:DiaTreino|undefined;
  if(agenda.length===1)destino=dias[0];
  else if(grupos.length>1)destino=existentes[0]; // agregado:1 por componente no recorte correspondente
  else if(existentes.length>=2)destino=existentes[1];
  if(!destino){
   const compativeis=dias.filter(d=>!tem(d,g)&&d.diaId&&!existentes.some(e=>e.diaId&&consecutivo(d.diaId!,e.diaId)));
   const afinidade=(d:DiaTreino)=>d.slots.filter(s=>secundariosDe(s.exercicio).includes(g)||pool.some(e=>e.grupoPrimario===g&&secundariosDe(e).includes(s.exercicio.grupoPrimario!))).length;
   destino=compativeis.sort((a,b)=>(a.slots.length===0?-1:b.slots.length===0?1:afinidade(b)-afinidade(a)))[0];
  }
  if(!destino){destino=existentes[0];if(destino)adaptados.push(g);}
  if(!destino){faltantes.push(g);continue;}
  const quantidade=agenda.length===1?Math.max(0,2-destino.slots.filter(s=>s.exercicio.grupoPrimario===g).length):grupos.length>1?1:2;
  const usados=new Set(destino.slots.map(s=>s.exercicio.id));
  const opcoes=pool.filter(e=>e.grupoPrimario===g&&!usados.has(e.id)).sort((a,b)=>Number(favoritos.has(b.id))-Number(favoritos.has(a.id)));
  let entregues=0;
  for(const e of opcoes){
   if(entregues>=quantidade)break;
   const todos=dias.flatMap(d=>d.slots);
   if(e.padraoMovimento==='empurrar'&&todos.filter(s=>s.padrao==='empurrar').length>=todos.filter(s=>s.padrao==='puxar').length)continue;
   const s:SlotExercicio={padrao:e.padraoMovimento,exercicio:e,...(favoritos.has(e.id)?{incluidoPorPreferencia:true}:{})};destino.slots.push(s);adicionais.add(s);entregues++;
  }
  if(entregues<quantidade)faltantes.push(g);
 }
 return {dias,adicionais,adaptados,faltantes};
}

/** Redistribui o baseline entre recortes já decididos pelo seletor. Não corta séries
 * nem exercícios. Se um grupo/ID não couber, conserva integralmente o baseline. */
export function realocarBaselineAosRecortes(
 base:readonly DiaTreino[],recortes:readonly {nome:string;grupos:readonly GrupoPrimario[]}[],
):{dias:DiaTreino[];adaptado:boolean}{
 if(base.length!==recortes.length)return {dias:[...base],adaptado:true};
 const dias=base.map((d,i)=>({...d,nome:recortes[i]!.nome,slots:[] as SlotExercicio[]}));
 for(let i=0;i<base.length;i++)for(const slot of base[i]!.slots){
  const g=slot.exercicio.grupoPrimario;
  const destinos=recortes.flatMap((r,k)=>g&&r.grupos.includes(g)&&!dias[k]!.slots.some(s=>s.exercicio.id===slot.exercicio.id)?[k]:[]);
  destinos.sort((a,b)=>Number(b===i)-Number(a===i)||dias[a]!.slots.filter(s=>s.exercicio.grupoPrimario===g).length-dias[b]!.slots.filter(s=>s.exercicio.grupoPrimario===g).length||a-b);
  const destino=destinos[0];
  if(destino==null)return {dias:[...base],adaptado:true};
  dias[destino]!.slots.push(slot);
 }
 return {dias,adaptado:false};
}
