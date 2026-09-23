import type { DiaTreino, NivelExperiencia } from './treino-types';
import type { GrupoPrimario } from '../data/types';
import { creditoPonderadoDaSemana } from './alocador';
import { GRUPOS_COM_FAIXA_SEMANAL } from './grupos-volume';
import { PRINCIPAIS_TEMPO, SECUNDARIOS_TEMPO } from './adequacao-tempo-politica';
import { avaliarDuracaoResistida } from './duracao-plano';

export type CorteTemporal = { dia: number; id: string; original: number; retiradas: number };
/** Capturar imediatamente após o corte temporal, ANTES de qualquer poda de volume. */
export const registrarCortesTemporais = (dias: readonly DiaTreino[]): CorteTemporal[] => dias.flatMap((d,dia) => d.slots.flatMap(s => {
  const original=s.seriesAntesDoCorteDeTempo;
  return original!=null && original>(s.series??0) ? [{dia,id:s.exercicio.id,original,retiradas:original-(s.series??0)}] : [];
}));

/** Somente devoluções; nenhuma retirada, troca de exercício ou mudança de descanso.
 * O saldo é de cortes POR TEMPO, separado das reduções posteriores por volume.
 * Slots retirados/substituídos não são recriados. Ordem: principais, secundários, complementares.
 */
export function recuperarSeriesPorTempo(args: {
  dias: readonly DiaTreino[]; cortes: readonly CorteTemporal[]; nivel: NivelExperiencia;
  limiteSeg: number; tetoSemana: (g: GrupoPrimario) => number; tetoSessao: number;
}) {
  const dias=args.dias.map(d=>({...d,slots:d.slots.map(s=>({...s}))}));
  const recuperadas: {dia:number;id:string;series:number}[]=[];
  const ordem=(g:GrupoPrimario|null|undefined)=>g&&PRINCIPAIS_TEMPO.includes(g)?0:g&&SECUNDARIOS_TEMPO.includes(g)?1:2;
  const candidatos=args.cortes.map(c=>({...c,slot:dias[c.dia]?.slots.find(s=>s.exercicio.id===c.id)}))
    .filter(c=>c.slot!=null).sort((a,b)=>ordem(a.slot!.exercicio.grupoPrimario)-ordem(b.slot!.exercicio.grupoPrimario)||a.dia-b.dia);
  for(const c of candidatos){
    const s=c.slot!,d=dias[c.dia]!;let devolvidas=0;
    while(devolvidas<c.retiradas && (s.series??0)<c.original){
      const antes=s.series??0;s.series=antes+1;
      const semana=creditoPonderadoDaSemana(dias.flatMap(x=>x.slots)),sessao=creditoPonderadoDaSemana(d.slots);
      const m=avaliarDuracaoResistida(d.slots,args.nivel);
      const cabe=m.estadoCalculo==='CALCULADO' && m.duracaoMaximaEstimadaSegundos!<=args.limiteSeg
        && GRUPOS_COM_FAIXA_SEMANAL.every(g=>(semana.get(g)??0)<=args.tetoSemana(g))
        && [...sessao.values()].every(n=>n<=args.tetoSessao);
      if(!cabe){s.series=antes;break;}devolvidas++;
    }
    if(devolvidas)recuperadas.push({dia:c.dia,id:c.id,series:devolvidas});
    // O marcador daqui para frente descreve só o corte temporal ainda vigente.
    const restante=Math.min(c.retiradas-devolvidas,Math.max(0,c.original-(s.series??0)));
    if(restante===0)delete s.seriesAntesDoCorteDeTempo;
    else s.seriesAntesDoCorteDeTempo=(s.series??0)+restante;
  }
  return {dias,recuperadas};
}
