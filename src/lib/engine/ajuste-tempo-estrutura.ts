import {avaliarDuracaoResistida} from './duracao-plano';
import type {DiaTreino,NivelExperiencia,SlotExercicio} from './treino-types';

/** Decisões do autor 14/09/2026, transmitidas pela coordenação: o maior grupo
 * é operacional (quantidade removível), nunca uma hierarquia anatômica.
 * Atua sobre o plano concreto; não realoca nem aumenta séries de sobreviventes.
 *
 * 🔴 REVISÃO INDEPENDENTE 15/09 (D-01/D-02) — ESTA FUNÇÃO NÃO ENXERGA O FOCO.
 * Ela recebia o conjunto `adicionais` e tentava tirar extras primeiro, mas pelo
 * mesmo filtro `removivel`: um extra sozinho no seu grupo naquele dia virava
 * irremovível (`length>1` falhava) e o corte caía no BASELINE — o foco de bíceps
 * chegava a custar 3 séries de costas. E como as guardas de padrão contam
 * `outrosDias`, extras colocados na segunda mudavam o corte da quinta.
 * O chamador agora roda esta fase sobre o baseline PURO e trata os extras
 * depois, em `removerExtrasPorTempo`. Com isso o plano dos demais grupos sai
 * idêntico ao plano SEM FOCO das mesmas entradas, por construção. */
export function reduzirEstruturaPorTempo(
 dia:DiaTreino,nivel:NivelExperiencia,limiteSeg:number|undefined,
 outrosDias:readonly SlotExercicio[]=[],
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
  // O único exercício de cada grupo do baseline não sai: é a cobertura aprovada.
  const grupos=[...new Set(slots.filter(removivel).map(s=>s.exercicio.grupoPrimario!))];
  const tamanho=(g:string)=>slots.filter(s=>s.exercicio.grupoPrimario===g&&removivel(s)).length;
  grupos.sort((a,b)=>tamanho(b)-tamanho(a)||a.localeCompare(b));
  const g=turnoMaior?grupos[0]:grupos.find(g=>g!==anterior)??grupos[0];
  if(!g)break;
  const alvo=[...slots].reverse().find(s=>s.exercicio.grupoPrimario===g&&removivel(s));
  if(!alvo)break;
  anterior=g;turnoMaior=!turnoMaior;
  slots.splice(slots.indexOf(alvo),1);removidos.push(alvo);
 }
 const r=resultado();
 return {dia:{...dia,slots},removidos,incompativel:r.estadoCalculo==='CALCULADO'&&!cabe(),naoAvaliado:r.estadoCalculo==='NAO_AVALIADO'};
}

/**
 * 🔴 REVISÃO 15/09 (D-01) — O BLOCO ADICIONAL É O ÚLTIMO A ENTRAR E O PRIMEIRO A SAIR.
 *
 * Decisão da coordenação: «o tempo pode eliminar integralmente o bloco adicional» e
 * «não retire exercícios do baseline para preservar extras». Aqui **todo** extra é
 * removível — inclusive quando é o único exercício do seu grupo naquele dia, porque
 * esse grupo só existe ali por causa do foco e não faz parte da cobertura aprovada.
 * Remove do fim para o começo (o último acrescentado cede primeiro) e nunca toca em
 * um slot que não esteja em `extras`.
 *
 * Dado ausente não autoriza poda: com duração não calculada o dia sai intacto e a
 * certificação diz `NAO_AVALIADO` — a mesma postura de `reduzirEstruturaPorTempo`.
 */
export function removerExtrasPorTempo(
 dia:DiaTreino,nivel:NivelExperiencia,limiteSeg:number|undefined,
 extras:ReadonlySet<SlotExercicio>,
):{dia:DiaTreino;removidos:SlotExercicio[];cabe:boolean}{
 const slots=[...dia.slots],removidos:SlotExercicio[]=[];
 const cabe=()=>{
  if(limiteSeg===undefined)return true;
  const r=avaliarDuracaoResistida(slots,nivel,limiteSeg);
  return r.estadoCalculo!=='CALCULADO'||(r.duracaoMaximaEstimadaSegundos??Infinity)<=limiteSeg;
 };
 while(!cabe()){
  let alvo:SlotExercicio|undefined;
  for(let i=slots.length-1;i>=0;i-=1)if(extras.has(slots[i]!)){alvo=slots[i];break;}
  if(!alvo)break; // só restou baseline: o excesso não vem do foco e não se cobra dele
  slots.splice(slots.indexOf(alvo),1);removidos.push(alvo);
 }
 return {dia:{...dia,slots},removidos,cabe:cabe()};
}
