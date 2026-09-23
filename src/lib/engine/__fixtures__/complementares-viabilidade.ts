import type { GrupoPrimario } from '../../data/types';
import type { PerfilTreino, RotinaSemanal, SlotExercicio } from '../treino-types';
import { EXERCISES } from '../../data/exercises';
import { poolElegivel } from '../treino-montador';
import { creditoPonderadoDaSemana } from '../alocador';
import { descansoDoExercicio } from '../descanso';
import { avaliarDuracaoResistida } from '../duracao-plano';
import { faixaSegundos, repUnitDe } from '../isometricos';

/** Oráculo de teste independente do calendário e das mensagens do montador.
 * Procura ADIÇÃO viável sem remover/reduzir/reordenar principal. Não demonstra
 * impossibilidade de qualquer reformulação do plano ou troca de exercícios.
 */
export function adicoesComplementaresViaveis(r: RotinaSemanal, p: PerfilTreino, g: GrupoPrimario): string[] {
  const comp = ['core','panturrilha','antebraco'];
  const pool = poolElegivel(EXERCISES,p,p.preferencias).filter(e=>e.grupoPrimario===g && e.padraoMovimento!=='cardio');
  const possiveis:string[]=[];
  for (const d of r.dias) {
    const gs=d.slots.map(s=>s.exercicio.grupoPrimario);
    const dedicado=gs.length>0 && gs.every(x=>comp.includes(x??'')||x==='lombar');
    const local=g==='panturrilha' ? gs.some(x=>['quadriceps','posterior','gluteos'].includes(x??''))
      : dedicado || gs.some(x=>['peito','costas','ombros','biceps','triceps'].includes(x??''));
    if(!local || gs.includes(g) || (!dedicado&&gs.some(x=>comp.includes(x??''))))continue;
    for(const e of pool){
      // Usa o piso de duas séries e o menor descanso canônico; se até aqui não cabe,
      // uma dose maior com os mesmos exercícios não salva a adição.
      const novo:SlotExercicio={exercicio:e,padrao:e.padraoMovimento,series:2,
        descansoSeg:descansoDoExercicio({exercicio:e,rirAlvo:2,modoForca:p.modoForca,degradacao:2})??0,
        ...(repUnitDe(e.id)==='segundos'?{holdSeg:faixaSegundos(e.id,p.nivelExperiencia)?.min}:{})};
      const ss=[...d.slots,novo], lim=r.tetoVolumeSemana;
      const antesSemana=creditoPonderadoDaSemana(r.dias.flatMap(x=>x.slots));
      const antesDia=creditoPonderadoDaSemana(d.slots);
      const semana=creditoPonderadoDaSemana([...r.dias.flatMap(x=>x.slots),novo]);
      if(lim&&[...semana].some(([grupo,n])=>n>Math.max(antesSemana.get(grupo)??0,lim.gruposEmFoco.includes(grupo)?lim.cheio:lim.semFoco)))continue;
      if(lim?.sessao!=null&&[...creditoPonderadoDaSemana(ss)].some(([grupo,n])=>n>Math.max(antesDia.get(grupo)??0,lim.sessao!)))continue;
      const dur=avaliarDuracaoResistida(ss,p.nivelExperiencia);
      if(dur.estadoCalculo!=='CALCULADO')continue;
      if(p.limiteTempoTreino!=='sem_limite'&&(dur.duracaoMaximaEstimadaSegundos??Infinity)>p.tempoPorSessaoMin*60)continue;
      possiveis.push(`${d.diaId??d.nome}/${e.id}`);
    }
  }
  return possiveis;
}
