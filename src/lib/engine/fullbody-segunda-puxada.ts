import type {Exercise,GrupoPrimario} from '../data/types';
import type {DiaTreino,NivelExperiencia,SlotExercicio} from './treino-types';
import {creditoPonderadoDaSemana,GRUPOS_GRANDES} from './alocador';
import {diretosDoExercicio} from './cobertura-anatomica';
import {papelReferencia,rankReferencia} from './selecao-referencia';
import {reduzirDiaPorTempo} from './ajuste-tempo-estrutura';
import {podarExcessoPonderado} from './teto-ponderado';
import {avaliarDuracaoResistida} from './duracao-plano';

/** Autor 19/09: segundo costas só no full-body automático de um dia quando
 * necessário para puxar >= empurrar. Não dispensa grupos para encaixar a exceção.
 * O chamador protege manual, deload e retomada; o ajuste temporal é o canônico.
 */
export function completarPuxadasFullbody(args:{
 dia:DiaTreino;pool:readonly Exercise[];nivel:NivelExperiencia;limiteSeg?:number;
 maxSlots:number;minSeries:number;tetoSemana:(g:GrupoPrimario)=>number;tetoDia:number;
 materializar:(e:Exercise,series:number,deg:0|1|2)=>SlotExercicio;
}):{dia:DiaTreino;necessario:boolean;aplicado:boolean}{
 const {dia}=args;
 const saida=(necessario=false)=>({dia,necessario,aplicado:false});
 const costas=dia.slots.filter(s=>s.exercicio.grupoPrimario==='costas');
 const ombro=dia.slots.find(s=>s.exercicio.grupoPrimario==='ombros');
 if(costas.length!==1||!ombro)return saida();
 const alvos=diretosDoExercicio(ombro.exercicio.id);
 const ombros=ombro.padrao==='empurrar'?[ombro.exercicio]:ombro.incluidoPorPreferencia?[]:
  args.pool.filter(e=>e.grupoPrimario==='ombros'&&e.padraoMovimento==='empurrar'
   &&diretosDoExercicio(e.id).size>alvos.size&&[...alvos].every(a=>diretosDoExercicio(e.id).has(a)));
 if(!ombros.length)return saida();
 const n=(ss:readonly SlotExercicio[],p:string)=>ss.filter(s=>s.padrao===p).length;
 if(n(dia.slots,'puxar')>=n(dia.slots,'empurrar')+Number(ombro.padrao!=='empurrar'))return saida();
 const ids=new Set(dia.slots.map(s=>s.exercicio.id));
 const funcoes=new Set(costas.map(s=>papelReferencia(s.exercicio)));
 const opcoes=args.pool.filter(e=>e.grupoPrimario==='costas'&&e.padraoMovimento==='puxar'&&!ids.has(e.id))
  .sort((a,b)=>Number(funcoes.has(papelReferencia(a)))-Number(funcoes.has(papelReferencia(b)))||rankReferencia(a)-rankReferencia(b));
 const grupos=new Set(dia.slots.map(s=>s.exercicio.grupoPrimario));
 for(const om of ombros)for(const back of opcoes){
  for(const deg of [0,1,2] as const){
   const trial={...dia,slots:dia.slots.map(s=>({...s,...args.materializar(s===ombro?om:s.exercicio,s.series!,deg)}))};
   trial.slots.push(args.materializar(back,args.minSeries,deg));
   if(trial.slots.length>args.maxSlots)continue;
   podarExcessoPonderado(trial.slots,g=>Math.min(args.tetoSemana(g),args.tetoDia),args.minSeries);
   // Só o último degrau pode ceder séries; E1 precede E3, como no montador.
   const ajuste=deg===2?reduzirDiaPorTempo(trial,args.nivel,args.limiteSeg,{permitirDispensa:false}):null;
   const candidato=ajuste?.dia??trial;
   if(ajuste)for(const corte of [...ajuste.seriesReduzidas,...ajuste.seriesMinimas]){
    const sl=candidato.slots.find(s=>s.exercicio.id===corte.exercicioId);
    if(sl&&sl.seriesAntesDoCorteDeTempo==null)sl.seriesAntesDoCorteDeTempo=corte.de;
   }
   if([...grupos].some(g=>!candidato.slots.some(s=>s.exercicio.grupoPrimario===g)))continue;
   if(candidato.slots.filter(s=>s.exercicio.grupoPrimario==='costas').length!==2)continue;
   if(n(candidato.slots,'puxar')<n(candidato.slots,'empurrar'))continue;
   const credito=creditoPonderadoDaSemana(candidato.slots);
   if(GRUPOS_GRANDES.some(g=>(credito.get(g)??0)>Math.min(args.tetoSemana(g),args.tetoDia)))continue;
   const duracao=avaliarDuracaoResistida(candidato.slots,args.nivel);
   if(duracao.estadoCalculo!=='CALCULADO'||(args.limiteSeg!=null&&duracao.duracaoMaximaEstimadaSegundos!>args.limiteSeg))continue;
   return {dia:candidato,necessario:true,aplicado:true};
  }
 }
 return saida(true);
}
