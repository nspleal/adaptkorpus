import { ehComplementar, ehDiaDePernas, ehDiaDisponivel } from './selecao-referencia';
import type {Exercise,GrupoPrimario} from '../data/types';
import {ORDEM_SEMANA,type Weekday} from '../semana';
import {secundariosDe} from './secundarios';
import type {DiaTreino,SlotExercicio} from './treino-types';

/** Autor14/09: adição ao baseline, não transferência. Pool já elegível no montador.
 * Séries/descanso/hold são materializados pelo chamador, na autoridade existente.
 *
 * `solicitados` é a INTENÇÃO (quantos extras esta montagem pediu). Quem entrega é o
 * `adicionais`, e o tempo ainda pode remover parte dele depois — a tela precisa dos
 * dois números para não anunciar o que não ficou no plano. */
export function adicionarBlocoFoco(
 base:readonly DiaTreino[],agenda:readonly Weekday[],grupos:readonly GrupoPrimario[],
 pool:readonly Exercise[],favoritos:ReadonlySet<string>,
):{dias:DiaTreino[];adicionais:Set<SlotExercicio>;adaptados:GrupoPrimario[];faltantes:GrupoPrimario[];solicitados:number}{
 const dias=base.map(d=>({...d,slots:[...d.slots]})),adicionais=new Set<SlotExercicio>();
 const adaptados:GrupoPrimario[]=[],faltantes:GrupoPrimario[]=[];
 let solicitados=0;
 const tem=(d:DiaTreino,g:GrupoPrimario)=>d.slots.some(s=>s.exercicio.grupoPrimario===g);
 const consecutivo=(a:Weekday,b:Weekday)=>{const delta=Math.abs(ORDEM_SEMANA.indexOf(a)-ORDEM_SEMANA.indexOf(b));return delta===1||delta===6;};
 // Um dia conserva um direto por grupo, salvo o segundo costas já validado no baseline.
 if(agenda.length===1)for(const d of dias){const vistos=new Map<GrupoPrimario,number>();d.slots=d.slots.filter(s=>{const g=s.exercicio.grupoPrimario;if(!g||(vistos.get(g)??0)>=(g==='costas'?2:1))return false;vistos.set(g,(vistos.get(g)??0)+1);return true;});}
 const admiteComplementar=(d:DiaTreino,g:GrupoPrimario)=>{
  if(!ehComplementar(g))return true;
  const gs=d.slots.map(s=>s.exercicio.grupoPrimario).filter((x):x is GrupoPrimario=>x!=null);
  const dedicado=ehDiaDisponivel(gs);
  const local=g==='panturrilha'?ehDiaDePernas(gs):dedicado||gs.some(x=>['peito','costas','ombros','biceps','triceps'].includes(x));
  return local&&(dedicado||!gs.some(ehComplementar));
 };
 for(const g of grupos){
  const existentes=dias.filter(d=>tem(d,g));
  let destino:DiaTreino|undefined;
  if(agenda.length===1)destino=dias[0];
  else if(grupos.length>1)destino=existentes[0]; // agregado:1 por componente no recorte correspondente
  else if(existentes.length>=2)destino=existentes[1];
  if(destino&&!admiteComplementar(destino,g))destino=undefined;
  if(!destino){
   const compativeis=dias.filter(d=>admiteComplementar(d,g)&&!tem(d,g)&&d.diaId&&!existentes.some(e=>e.diaId&&consecutivo(d.diaId!,e.diaId)));
   const afinidade=(d:DiaTreino)=>d.slots.filter(s=>secundariosDe(s.exercicio).includes(g)||pool.some(e=>e.grupoPrimario===g&&secundariosDe(e).includes(s.exercicio.grupoPrimario!))).length;
   destino=compativeis.sort((a,b)=>(a.slots.length===0?-1:b.slots.length===0?1:afinidade(b)-afinidade(a)))[0];
  }
  if(!destino){destino=existentes.find(d=>admiteComplementar(d,g));if(destino)adaptados.push(g);}
  if(!destino){solicitados+=agenda.length===1?1:grupos.length>1?1:2;faltantes.push(g);continue;}
  const quantidade=agenda.length===1?Math.max(0,2-destino.slots.filter(s=>s.exercicio.grupoPrimario===g).length):grupos.length>1?1:2;
  solicitados+=quantidade;
  const usados=new Set(destino.slots.map(s=>s.exercicio.id));
  /**
   * 🔵 DECISÃO DO AUTOR 2026-09-16 (P-03) — REPETIR NA SEMANA É PERMITIDO; VARIEDADE É
   * PREFERÊNCIA, NÃO OBRIGAÇÃO.
   *
   * Medido na revisão: 68 % dos blocos repetiam, na mesma semana, um exercício já
   * prescrito, porque `usados` só deduplica o DIA de destino. O autor manteve a repetição
   * permitida em dias compatíveis e mandou apenas **buscar** alternativa quando houver uma
   * adequada — sem obrigatoriedade e sem usar opção inadequada só para variar. Por isso a
   * semana entra como CRITÉRIO DE ORDENAÇÃO, nunca como filtro: se o único elegível já
   * está na semana, ele entra do mesmo jeito.
   *
   * 🔒 Duplicar DENTRO do mesmo dia continua impedido (`usados`, filtro duro).
   * 🔒 Favorito continua na frente: a isenção de variedade do B5 é decisão anterior e não
   *    foi revogada — a variedade é o desempate DEPOIS dela.
   * 🔒 «Adequado» é exatamente o que o pool já diz (equipamento, nível, banimentos):
   *    nenhuma pesquisa regional e nenhuma equivalência nova entram nesta conta.
   */
  const naSemana=new Set(dias.flatMap(d=>d.slots.map(s=>s.exercicio.id)));
  const opcoes=pool.filter(e=>e.grupoPrimario===g&&!usados.has(e.id))
   .sort((a,b)=>Number(favoritos.has(b.id))-Number(favoritos.has(a.id))
    ||Number(naSemana.has(a.id))-Number(naSemana.has(b.id)));
  const limiteComplementar=ehComplementar(g)&&!ehDiaDisponivel(destino.slots.map(s=>s.exercicio.grupoPrimario).filter((x):x is GrupoPrimario=>x!=null))?1:quantidade;
  let entregues=0;
  /**
   * 🔴 REVISÃO INDEPENDENTE 15/09 (D-03) — A GUARDA PUXAR/EMPURRAR SAIU DAQUI.
   *
   * Ela recusava qualquer extra de `empurrar` quando a semana já tinha
   * `empurrar >= puxar` — ou seja, **a semana equilibrada já bloqueava** —, e nunca
   * restringia `puxar`. Medido na varredura da revisão: os 200 planos com "não foi
   * possível completar o bloco" eram peito (72), tríceps (64) e posterior (64), sem
   * um único grupo de puxar; e, fora do bloqueio total, ela ainda trocava em silêncio
   * o composto de empurrar por um isolado.
   *
   * Decisão da coordenação: o balanceamento é referência do plano SEM foco; o
   * desequilíbrio que vem dos extras autorizados é consequência aceita do foco, e não
   * se compensa tirando de outro grupo. O aviso semanal de puxar/empurrar passou a ser
   * medido só sobre o baseline, no montador.
   *
   * (O caso `posterior` NÃO vinha daqui: no equipamento `casa` o pool elegível tem um
   * único exercício, então a falta é de catálogo e o aviso já era honesto.)
   */
  for(const e of opcoes){
   if(entregues>=Math.min(quantidade,limiteComplementar))break;
   const s:SlotExercicio={padrao:e.padraoMovimento,exercicio:e,...(favoritos.has(e.id)?{incluidoPorPreferencia:true}:{})};destino.slots.push(s);adicionais.add(s);entregues++;
  }
  if(entregues<quantidade)faltantes.push(g);
 }
 return {dias,adicionais,adaptados,faltantes,solicitados};
}

/** Redistribui o baseline entre recortes já decididos pelo seletor. Não corta séries
 * nem exercícios. Se um grupo/ID não couber, conserva integralmente o baseline. */
export function realocarBaselineAosRecortes(
 base:readonly DiaTreino[],recortes:readonly {nome:string;grupos:readonly GrupoPrimario[]}[],
):{dias:DiaTreino[];adaptado:boolean;descartados:SlotExercicio[]}{
 if(base.length!==recortes.length)return {dias:[...base],adaptado:true,descartados:[]};
 const dias=base.map((d,i)=>({...d,nome:recortes[i]!.nome,slots:[] as SlotExercicio[]}));
 const descartados:SlotExercicio[]=[];
 for(let i=0;i<base.length;i++)for(const slot of base[i]!.slots){
  const g=slot.exercicio.grupoPrimario;
  const destinos=recortes.flatMap((r,k)=>g&&r.grupos.includes(g)&&!dias[k]!.slots.some(s=>s.exercicio.id===slot.exercicio.id)?[k]:[]);
  destinos.sort((a,b)=>Number(b===i)-Number(a===i)||dias[a]!.slots.filter(s=>s.exercicio.grupoPrimario===g).length-dias[b]!.slots.filter(s=>s.exercicio.grupoPrimario===g).length||a-b);
  const destino=destinos[0];
  // Nenhum grupo é descartado para forçar a separação dos recortes.
  if(destino==null){
   return {dias:[...base],adaptado:true,descartados:[]};
  }
  dias[destino]!.slots.push(slot);
 }
 return {dias,adaptado:false,descartados};
}


/** Exceção explícita do autor (19/09): no automático de quatro dias com foco em
 * pernas, duas sessões de core podem virar uma. Nenhum outro slot é retirado;
 * a tentativa só vale se o chamador confirmar tempo, capacidade e volume.
 */
export function realocarPernasReduzindoCore(
 base:readonly DiaTreino[],recortes:readonly {nome:string;grupos:readonly GrupoPrimario[]}[],
 aceita:(dias:readonly DiaTreino[])=>boolean,
):DiaTreino[]|null {
 if(base.length!==4||recortes.length!==4)return null;
 const cores=base.flatMap((d,i)=>d.slots.filter(s=>s.exercicio.grupoPrimario==='core').map(slot=>({dia:i,slot})));
 if(cores.length!==2||cores[0]!.dia===cores[1]!.dia)return null;
 // Preserva a preferência explícita se apenas uma das duas ocorrências for favorita.
 const ordem=[...cores].sort((a,b)=>Number(!!b.slot.incluidoPorPreferencia)-Number(!!a.slot.incluidoPorPreferencia));
 for(const manter of ordem){
  if(cores.some(c=>c!==manter&&c.slot.incluidoPorPreferencia))continue;
  const semCore=base.map(d=>({...d,slots:d.slots.filter(s=>s.exercicio.grupoPrimario!=='core')}));
  // Os ombros podem compartilhar qualquer dos dois recortes superiores. Distribuir
  // os slots existentes entre eles evita sobrecarregar só peito; não altera a dose.
  const rotas=recortes.map(r=>({...r,grupos:r.grupos.some(g=>g==='peito'||g==='costas')
   ?[...new Set([...r.grupos,'ombros' as const])]:r.grupos}));
  const tentativa=realocarBaselineAosRecortes(semCore,rotas);
  if(tentativa.adaptado)continue;
  const diasOmbros=tentativa.dias.filter(d=>d.slots.some(s=>s.exercicio.grupoPrimario==='ombros')).map(d=>d.diaId);
  if(diasOmbros.some((a,i)=>diasOmbros.slice(i+1).some(b=>{
   if(!a||!b)return true;const delta=Math.abs(ORDEM_SEMANA.indexOf(a)-ORDEM_SEMANA.indexOf(b));return delta===1||delta===6;
  })))continue;
  const candidatos=tentativa.dias.flatMap((d,i)=>{
   const gs=d.slots.map(s=>s.exercicio.grupoPrimario);
   return gs.some(g=>['peito','costas','ombros','biceps','triceps'].includes(g??''))
    &&!gs.some(g=>ehComplementar(g))?[i]:[];
  }).sort((a,b)=>Number(b===manter.dia)-Number(a===manter.dia)||a-b);
  for(const destino of candidatos){
   const dias=tentativa.dias.map((d,i)=>({...d,slots:i===destino?[...d.slots,manter.slot]:[...d.slots]}));
   const compativeis=dias.every(d=>{
    const gs=d.slots.map(s=>s.exercicio.grupoPrimario).filter((g):g is GrupoPrimario=>g!=null);
    return gs.filter(ehComplementar).length<=1&&(!gs.includes('panturrilha')||ehDiaDePernas(gs));
   });
   if(compativeis&&aceita(dias))return dias.map((d,i)=>({...d,nome:
    d.slots.some(s=>s.exercicio.grupoPrimario==='ombros')&&!recortes[i]!.grupos.includes('ombros')
     ?`${d.nome} + Ombros`:d.nome}));
  }
 }
 return null;
}
