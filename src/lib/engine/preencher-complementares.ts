import type { Exercise, GrupoPrimario } from '../data/types';
import type { DiaTreino, SlotExercicio } from './treino-types';
import { creditoPonderadoDaSemana } from './alocador';
import { diretosDoExercicio } from './cobertura-anatomica';
import { ehComplementar, ehDiaDePernas, ehDiaDisponivel } from './selecao-referencia';

/** Reexamina folgas depois da dose, sem remover/mover/reduzir nenhum slot.
 * Só completa grupos ausentes; não aumenta frequência nem preenche o dia por quota.
 * Entre opções que cabem, preserva favorito e prioriza alvos documentais ausentes.
 *
 * 🔵 O OITAVO SLOT DA PANTURRILHA (decisão do autor, 2026-09-20 — resíduo do PR #18).
 *
 * 🔴 O defeito medido: em 284 de 336 perfis varridos a panturrilha não entrava, e em TODOS
 * eles o dia de pernas estava cheio. O orçamento de slots é uma função do TEMPO
 * (`orcamentoSlotsDoDia`), mas para quem declarou "sem limite de tempo" o motor nem avalia
 * limite (`estadoLimite: NAO_AVALIADO`) — e o orçamento continuava valendo como se houvesse
 * limite. No caso relatado os três grupos de pernas precisam dos sete slots para alcançar o
 * mínimo da faixa (quadríceps 3 exercícios × 4 séries = 12; com dois exercícios o teto por
 * exercício só permite 8, abaixo do mínimo 10), então a panturrilha não tinha como entrar
 * sem tirar série de um grupo principal.
 *
 * 🔒 A exceção autorizada, e só ela: quando o usuário marcou **sem limite de tempo** e o dia
 * de pernas já usou todo o orçamento com trabalho principal, esse dia pode receber UM slot
 * além do orçamento, **exclusivamente para a panturrilha**. Nenhuma série sai de outro
 * grupo; tetos semanal, por sessão e por exercício continuam conferidos aqui; a duração
 * estimada é recalculada e exibida como for, mesmo acima do tempo informado. Não vale para
 * perfil com tempo limitado, não vale para outro complementar e não toca desenho manual.
 */
export function preencherComplementaresAusentes(args: {
  dias: DiaTreino[]; pool: readonly Exercise[]; slotsMax: number; minSeries: number;
  tetoSemana: (g: GrupoPrimario) => number; tetoDia: number;
  /** Exceção autorizada: um slot além do orçamento, só para a panturrilha, só em 'sem limite de tempo'. */
  slotExtraPanturrilha?: boolean;
  materializar: (e: Exercise, dia: number, degradacao: 0|1|2) => SlotExercicio;
  cabeNoTempo: (slots: readonly SlotExercicio[]) => boolean;
}): number {
  const pendentes: GrupoPrimario[] = ['panturrilha','core','antebraco'].filter(g =>
    !args.dias.some(d=>d.slots.some(s=>s.exercicio.grupoPrimario===g))) as GrupoPrimario[];
  let adicionados=0;
  while(pendentes.length){
    const antes=creditoPonderadoDaSemana(args.dias.flatMap(d=>d.slots));
    const opcoes=pendentes.map(g=>({g,candidatos:args.dias.flatMap((d,i)=>{
      const gs=d.slots.map(s=>s.exercicio.grupoPrimario).filter((x):x is GrupoPrimario=>x!=null);
      const dedicado=ehDiaDisponivel(gs);
      const local=g==='panturrilha'?ehDiaDePernas(gs):dedicado||gs.some(x=>['peito','costas','ombros','biceps','triceps'].includes(x));
      const extraAutorizado=args.slotExtraPanturrilha===true&&g==='panturrilha'&&ehDiaDePernas(gs);
      const tetoDoDia=extraAutorizado?args.slotsMax+1:args.slotsMax;
      if(!local||d.slots.length>=tetoDoDia||(!dedicado&&gs.some(ehComplementar)))return [];
      const creditoDia=creditoPonderadoDaSemana(d.slots);
      return args.pool.filter(e=>e.grupoPrimario===g && e.padraoMovimento!=='cardio').flatMap(e=>{
        const nominal=args.materializar(e,i,0);
        const tempoNominal=args.cabeNoTempo([...d.slots,nominal]);
        const tentativas=([0,1,2] as const).map(deg=>args.materializar(e,i,deg));
        for(let series=nominal.series!-1;series>=args.minSeries;series--){
          tentativas.push({...args.materializar(e,i,2),series,...(!tempoNominal?{seriesAntesDoCorteDeTempo:nominal.series}:{})});
        }
        for(const slot of tentativas){
          const ss=[...d.slots,slot];
          const semana=creditoPonderadoDaSemana([...args.dias.flatMap(x=>x.slots),slot]);
          if([...semana].some(([grupo,n])=>n>Math.max(args.tetoSemana(grupo),antes.get(grupo)??0)))continue;
          if([...creditoPonderadoDaSemana(ss)].some(([grupo,n])=>n>Math.max(args.tetoDia,creditoDia.get(grupo)??0)))continue;
          if(!args.cabeNoTempo(ss))continue;
          return [{dia:i,slot}];
        }
        return [];
      });
    })})).filter(x=>x.candidatos.length>0).sort((a,b)=>a.candidatos.length-b.candidatos.length);
    const escolha=opcoes[0];if(!escolha)break;
    const jaAbordados=new Set(args.dias.flatMap(d=>d.slots.flatMap(s=>[...diretosDoExercicio(s.exercicio.id)])));
    const ganho=(s:SlotExercicio)=>[...diretosDoExercicio(s.exercicio.id)].filter(a=>!jaAbordados.has(a)).length;
    escolha.candidatos.sort((a,b)=>Number(!!b.slot.incluidoPorPreferencia)-Number(!!a.slot.incluidoPorPreferencia)
      ||ganho(b.slot)-ganho(a.slot));
    const c=escolha.candidatos[0]!;args.dias[c.dia]!.slots.push(c.slot);adicionados++;
    pendentes.splice(pendentes.indexOf(escolha.g),1);
  }
  return adicionados;
}
