import {avaliarDuracaoResistida} from './duracao-plano';
import type {GrupoPrimario} from '../data/types';
import type {DiaTreino,NivelExperiencia,SlotExercicio} from './treino-types';

/**
 * ⏱️ AJUSTE TEMPORAL — AUTORIDADE ÚNICA.
 *
 * 🔵 POLÍTICA FINAL APROVADA 2026-09-17. Há **uma** sequência de redução, executada por
 * `reduzirDiaPorTempo`. As funções abaixo são as ETAPAS dela, exportadas para teste
 * unitário — nenhuma delas é chamada isoladamente pelo montador, justamente para não
 * existirem dois algoritmos concorrentes de ajuste temporal.
 *
 * ```
 * E1  descanso até os pisos vigentes            (no montador: depende da prescrição)
 * E2  extras do foco que não couberem           (`removerExtrasPorTempo`, fase B)
 * E3  exercícios com TRÊS séries passam a DUAS  (`reduzirTresParaDuas`)
 * E4  exercícios redundantes                    (`reduzirEstruturaPorTempo`)
 * E5  dispensar direto: core → antebraço → panturrilha → glúteos (`dispensarGruposPorTempo`)
 * E6  bíceps/tríceps/ombros a UMA série         (`reduzirBracosOmbrosParaUma`)
 * ```
 *
 * 🔒 **Pára assim que couber.** Toda etapa confere a duração ANTES de cada operação
 * atômica e depois dela; nenhum corte adicional acontece depois de o dia caber.
 *
 * 🔒 **E3 antes de E5**, por ordem do autor: tentar a redução de séries antes de excluir um
 * grupo inteiro. **E4 entre as duas** — decisão explicitada aqui: retirar um exercício
 * redundante perde variedade mas **conserva a cobertura** do grupo, então é mais leve do
 * que dispensar o último exercício de um grupo (E5) e mais pesado do que baixar séries (E3).
 *
 * 🔒 **Persistindo o excesso, nada é restaurado** (decisão 2): as reduções ficam, o dia é
 * entregue reduzido e o chamador diz a duração estimada. Aproximar do limite escolhido é o
 * objetivo, mesmo quando não se chega nele.
 */

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

/**
 * 🔵 DECISÃO DO AUTOR 2026-09-16 (P-01) — DISPENSA ORDENADA NO FULL-BODY CURTO.
 *
 * O autor REJEITOU trocar cobertura direta por indireta. O que ele autorizou foi outra
 * coisa: quando a sessão única não cabe nem com o descanso no piso e nem sem os extras
 * do foco, o plano pode **dispensar o exercício direto** de uma lista fechada de grupos,
 * **nesta ordem**, parando assim que couber.
 *
 * 🔒 É prioridade de PRODUTO para sessão curta — nada aqui afirma que esses músculos
 * importam menos, e a interface não usa essa expressão. Fora do full-body de um dia a
 * política dos demais grupos continua valendo inteira (o único exercício não sai).
 *
 * `ordem` chega do chamador para que a regra fique legível no ponto de decisão; grupo
 * ausente do dia é PULADO, nunca acrescentado para depois ser retirado (é o caso do
 * antebraço, que não está entre os dez grupos do full-body vigente).
 *
 * Dado ausente não autoriza poda, como nas duas funções acima.
 */
export function dispensarGruposPorTempo(
 dia:DiaTreino,nivel:NivelExperiencia,limiteSeg:number|undefined,
 ordem:readonly GrupoPrimario[],
):{dia:DiaTreino;removidos:SlotExercicio[];gruposDispensados:GrupoPrimario[];cabe:boolean}{
 const slots=[...dia.slots],removidos:SlotExercicio[]=[];
 const gruposDispensados:GrupoPrimario[]=[];
 const cabe=()=>{
  if(limiteSeg===undefined)return true;
  const r=avaliarDuracaoResistida(slots,nivel,limiteSeg);
  return r.estadoCalculo!=='CALCULADO'||(r.duracaoMaximaEstimadaSegundos??Infinity)<=limiteSeg;
 };
 for(const grupo of ordem){
  if(cabe())break; // pára assim que couber: não se dispensa grupo por antecipação
  const doGrupo=slots.filter(s=>s.exercicio.grupoPrimario===grupo);
  if(doGrupo.length===0)continue; // grupo ausente: pula, não acrescenta
  for(const s of doGrupo){slots.splice(slots.indexOf(s),1);removidos.push(s);}
  gruposDispensados.push(grupo);
 }
 return {dia:{...dia,slots},removidos,gruposDispensados,cabe:cabe()};
}

/* ────────────────────────────────────────────────────────────────────────────────
 * E3 e E6 — REDUÇÃO DE SÉRIES (decisão do autor 2026-09-17)
 * ──────────────────────────────────────────────────────────────────────────────── */

/** 🔒 «Três para duas» autoriza ESTA transformação, não uma redução indiscriminada de
 *  qualquer quantidade para duas. Séries já menores ficam como estão. */
export const SERIES_DE = 3;
export const SERIES_PARA = 2;
/** 🔒 Última etapa: bíceps, tríceps e ombros a UMA série, nesta ordem determinística.
 *  Os exercícios são preservados — cai a série, nunca o exercício. */
export const GRUPOS_SERIE_MINIMA: readonly GrupoPrimario[] = ['biceps', 'triceps', 'ombros'];
export const SERIE_MINIMA = 1;

export interface SerieAjustada { exercicioId: string; grupo: GrupoPrimario | null; de: number; para: number }

export interface AjusteTemporalDoDia {
 dia: DiaTreino;
 /** E3 — exercícios que foram de 3 para 2 séries. */
 seriesReduzidas: SerieAjustada[];
 /** E4 — exercícios redundantes retirados (o grupo continua coberto no mesmo dia). */
 redundantesRetirados: SlotExercicio[];
 /** E5 — grupos que perderam o exercício direto. */
 gruposDispensados: GrupoPrimario[];
 /** E6 — bíceps/tríceps/ombros levados a 1 série. */
 seriesMinimas: SerieAjustada[];
 cabe: boolean;
 naoAvaliado: boolean;
 /** Duração máxima estimada do dia ENTREGUE, em segundos, quando calculável. */
 duracaoSeg?: number;
 /**
  * 🟡 CASO A DOCUMENTAR, NÃO A INVENTAR POLÍTICA: quantidades de séries acima de 3 que
  * sobraram num dia que não coube. A política aprovada cobre só 3 → 2; se isto aparecer,
  * é caso novo para o autor decidir, e sai daqui para o relatório sem limite inventado.
  */
 quantidadesForaDaPolitica: number[];
}

/** E3 — só 3 → 2, um exercício por vez, do fim para o começo do dia (determinístico). */
export function reduzirTresParaDuas(
 slots: SlotExercicio[], cabe: () => boolean,
): SerieAjustada[] {
 const feitas: SerieAjustada[] = [];
 while (!cabe()) {
  let alvo: SlotExercicio | undefined;
  for (let i = slots.length - 1; i >= 0; i -= 1) if (slots[i]!.series === SERIES_DE) { alvo = slots[i]; break; }
  if (!alvo) break; // não há mais nenhum com 3 séries: a etapa acabou
  alvo.series = SERIES_PARA;
  feitas.push({ exercicioId: alvo.exercicio.id, grupo: alvo.exercicio.grupoPrimario, de: SERIES_DE, para: SERIES_PARA });
 }
 return feitas;
}

/** E6 — bíceps → tríceps → ombros, um exercício por vez, do fim para o começo. */
export function reduzirBracosOmbrosParaUma(
 slots: SlotExercicio[], cabe: () => boolean,
): SerieAjustada[] {
 const feitas: SerieAjustada[] = [];
 while (!cabe()) {
  let alvo: SlotExercicio | undefined;
  for (const grupo of GRUPOS_SERIE_MINIMA) {
   for (let i = slots.length - 1; i >= 0; i -= 1) {
    const s = slots[i]!;
    if (s.exercicio.grupoPrimario === grupo && (s.series ?? 0) > SERIE_MINIMA) { alvo = s; break; }
   }
   if (alvo) break;
  }
  if (!alvo) break;
  feitas.push({ exercicioId: alvo.exercicio.id, grupo: alvo.exercicio.grupoPrimario, de: alvo.series ?? 0, para: SERIE_MINIMA });
  alvo.series = SERIE_MINIMA;
 }
 return feitas;
}

/**
 * 🔵 A SEQUÊNCIA APROVADA, INTEIRA E NUMA SÓ AUTORIDADE.
 *
 * `reduzirSeries` é falso no modo 75+ (explicitamente sem limite) — lá `limiteSeg` já é
 * `undefined` e a função sai intacta — e no treino manual, que não passa por aqui.
 * `permitirDispensa` é a exceção do full-body curto, que o autor AMPLIOU com glúteos e
 * mandou **não** generalizar para outras divisões: fora dela a política dos demais grupos
 * continua inteira (o único exercício de cada grupo não sai).
 */
export function reduzirDiaPorTempo(
 dia: DiaTreino, nivel: NivelExperiencia, limiteSeg: number | undefined,
 opcoes: {
  outrosDias?: readonly SlotExercicio[];
  permitirDispensa?: boolean;
  ordemDispensa?: readonly GrupoPrimario[];
  reduzirSeries?: boolean;
 } = {},
): AjusteTemporalDoDia {
 const { outrosDias = [], permitirDispensa = false, ordemDispensa = [], reduzirSeries = true } = opcoes;
 const medir = (slots: readonly SlotExercicio[]) => avaliarDuracaoResistida(slots, nivel, limiteSeg);
 const vazio = (d: DiaTreino, cabe: boolean, naoAvaliado: boolean, duracaoSeg?: number): AjusteTemporalDoDia => ({
  dia: d, seriesReduzidas: [], redundantesRetirados: [], gruposDispensados: [], seriesMinimas: [],
  cabe, naoAvaliado, quantidadesForaDaPolitica: [], ...(duracaoSeg != null ? { duracaoSeg } : {}),
 });
 // Sem limite (75+) não há o que ajustar: nada é reduzido e nada é retirado.
 if (limiteSeg === undefined) return vazio(dia, true, medir(dia.slots).estadoCalculo === 'NAO_AVALIADO');
 // 🔒 Dado ausente não autoriza poda: com duração não calculada o dia sai intacto e a
 // certificação diz NAO_AVALIADO — a mesma postura das etapas isoladas.
 if (medir(dia.slots).estadoCalculo !== 'CALCULADO') return vazio(dia, false, true);

 let slots = [...dia.slots];
 const cabe = () => {
  const r = medir(slots);
  return r.estadoCalculo !== 'CALCULADO' || (r.duracaoMaximaEstimadaSegundos ?? Infinity) <= limiteSeg;
 };

 // E3 — três séries viram duas, só quando necessário e só enquanto necessário.
 const seriesReduzidas = reduzirSeries ? reduzirTresParaDuas(slots, cabe) : [];

 // E4 — exercício redundante (grupo com mais de um no dia). A política de sempre, agora
 // com posição declarada: depois de E3 e antes de excluir um grupo inteiro.
 const etapa4 = reduzirEstruturaPorTempo({ ...dia, slots }, nivel, limiteSeg, outrosDias);
 slots = [...etapa4.dia.slots];

 // E5 — dispensa ordenada, restrita à exceção do full-body curto.
 let gruposDispensados: GrupoPrimario[] = [];
 if (!cabe() && permitirDispensa && ordemDispensa.length > 0) {
  const etapa5 = dispensarGruposPorTempo({ ...dia, slots }, nivel, limiteSeg, ordemDispensa);
  slots = [...etapa5.dia.slots];
  gruposDispensados = etapa5.gruposDispensados;
 }

 // E6 — último recurso: bíceps/tríceps/ombros a uma série, exercícios preservados.
 const seriesMinimas = reduzirSeries ? reduzirBracosOmbrosParaUma(slots, cabe) : [];

 const final = medir(slots);
 const coube = cabe();
 // Só documenta quando o dia NÃO coube: aí sim a quantidade que sobrou é candidata a
 // política nova. Num dia que coube, séries maiores são o plano normal, não um caso.
 const quantidadesForaDaPolitica = coube ? [] : [...new Set(
  slots.map((s) => s.series ?? 0).filter((n) => n > SERIES_DE),
 )].sort((a, b) => a - b);
 return {
  dia: { ...dia, slots },
  seriesReduzidas, redundantesRetirados: etapa4.removidos, gruposDispensados, seriesMinimas,
  cabe: coube, naoAvaliado: final.estadoCalculo === 'NAO_AVALIADO',
  quantidadesForaDaPolitica,
  ...(final.duracaoMaximaEstimadaSegundos != null ? { duracaoSeg: final.duracaoMaximaEstimadaSegundos } : {}),
 };
}
