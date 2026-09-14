import {avaliarDuracaoResistida} from './duracao-plano';
import type {DiaTreino,NivelExperiencia,SlotExercicio} from './treino-types';

/** Decisões do autor 14/09/2026, transmitidas pela coordenação: o maior grupo
 * é operacional (quantidade removível), nunca uma hierarquia anatômica.
 * Atua sobre o plano concreto; não realoca nem aumenta séries de sobreviventes. */
export function reduzirEstruturaPorTempo(
 dia:DiaTreino,nivel:NivelExperiencia,limiteSeg:number|undefined,
 adicionais:ReadonlySet<SlotExercicio>,outrosDias:readonly SlotExercicio[]=[],
):{dia:DiaTreino;removidos:SlotExercicio[];incompativel:boolean;naoAvaliado:boolean}{
 const slots=[...dia.slots],removidos:SlotExercicio[]=[];
 const resultado=()=>avaliarDuracaoResistida(slots,nivel,limiteSeg);
 if(limiteSeg===undefined)return {dia:{...dia,slots},removidos,incompativel:false,naoAvaliado:resultado().estadoCalculo==='NAO_AVALIADO'};
 const cabe=()=>{const r=resultado();return r.estadoCalculo==='CALCULADO'&&(r.duracaoMaximaEstimadaSegundos??Infinity)<=limiteSeg;};
 const removivel=(s:SlotExercicio)=>s.exercicio.grupoPrimario!=null
  &&slots.filter(x=>x.exercicio.grupoPrimario===s.exercicio.grupoPrimario).length>1
  &&(s.padrao!=='empurrar'||[...outrosDias,...slots].filter(x=>x.padrao==='empurrar').length>1)
  &&(s.padrao!=='puxar'||[...outrosDias,...slots].filter(x=>x.padrao==='puxar').length>[...outrosDias,...slots].filter(x=>x.padrao==='empurrar').length)
  &&(s.padrao!=='dobradica_quadril'||[...outrosDias,...slots].filter(x=>x.padrao==='dobradica_quadril').length>1);
 let anterior:string|undefined;let turnoMaior=true;
 while(!cabe()&&resultado().estadoCalculo==='CALCULADO'){
  // O único do grupo não sai, nem quando foi adicionado pelo foco.
  let alvo=[...slots].reverse().find(s=>adicionais.has(s)&&removivel(s));
  if(!alvo){
   const grupos=[...new Set(slots.filter(removivel).map(s=>s.exercicio.grupoPrimario!))];
   const tamanho=(g:string)=>slots.filter(s=>s.exercicio.grupoPrimario===g&&removivel(s)).length;
   grupos.sort((a,b)=>tamanho(b)-tamanho(a)||a.localeCompare(b));
   const g=turnoMaior?grupos[0]:grupos.find(g=>g!==anterior)??grupos[0];
   if(!g)break;
   alvo=[...slots].reverse().find(s=>s.exercicio.grupoPrimario===g&&!adicionais.has(s)&&removivel(s));
   if(!alvo)break;
   anterior=g;turnoMaior=!turnoMaior;
  }
  slots.splice(slots.indexOf(alvo),1);removidos.push(alvo);
 }
 const r=resultado();
 return {dia:{...dia,slots},removidos,incompativel:r.estadoCalculo==='CALCULADO'&&!cabe(),naoAvaliado:r.estadoCalculo==='NAO_AVALIADO'};
}
