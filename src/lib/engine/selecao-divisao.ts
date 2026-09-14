import type {GrupoPrimario} from '../data/types';
import type {TemplateDia} from './alocador';
import type {PerfilTreino} from './treino-types';
import {focoVigente} from './trilhos';

export interface IntencaoDivisao {
  nome: string;
  /** Cada recorte requer uma sessão distinta; não é uma quota de séries. */
  recortes: readonly (readonly GrupoPrimario[])[];
  adaptada: boolean;
}
const dia = (nome:string, ...grupos:GrupoPrimario[]):TemplateDia => ({nome,grupos});
const superior = () => dia('Superiores','peito','costas','ombros','biceps','triceps','core');
const pernas = () => dia('Pernas','quadriceps','posterior','gluteos','panturrilha','core');
const peito = () => dia('Peito + Tríceps','peito','triceps');
const costas = () => dia('Costas + Bíceps','costas','biceps');
const quad = () => dia('Quadríceps + complementares','quadriceps','gluteos','panturrilha','core');
const post = () => dia('Posteriores + complementares','posterior','gluteos','panturrilha','core');
const ombros = () => dia('Ombros + complementares','ombros','core');
const complemento = () => dia('Complementares','panturrilha','core');

/** Decisões 1–38 de 13/09: sessões condicionais, sem nova autoridade quantitativa.
 * A seleção automática posterior substitui os templates auto antigos; escolhas
 * explícitas válidas e retorno conservam os caminhos anteriores.
 */
export function selecionarDivisao(
  legado: {split:string;dias:TemplateDia[]}, perfil:PerfilTreino,
  agregado:'bracos'|'pernas'|undefined, retomada:boolean, coreMax?:number,
): {split:string;dias:TemplateDia[];intencao?:IntencaoDivisao;preservarRecortes?:boolean;prioritarios?:readonly GrupoPrimario[]} {
  const n=legado.dias.length;
  const preferencia=perfil.divisaoPreferida??'auto';
  if(preferencia==='superior-inferior'||(preferencia==='prioridades'&&n===4))return legado;
  const individual=focoVigente(perfil.foco)?perfil.foco!.grupo:undefined;
  const foco=individual??agregado;
  const prioritarios:GrupoPrimario[]=individual?[individual]:agregado==='bracos'?['biceps','triceps']:agregado==='pernas'?['quadriceps','posterior']:[];
  let dias:TemplateDia[];
  if(n===1) dias=[superior()];
  else if(n===2) dias=[superior(),pernas()];
  else if(n===3) dias=[dia('Peito + Tríceps + Ombros','peito','triceps','ombros','core'),costas(),pernas()];
  else if(n===4) dias=[peito(),costas(),pernas(),ombros()];
  else if(n===5) dias=[peito(),costas(),pernas(),dia('Ombros + Braços','ombros','biceps','triceps'),complemento()];
  else dias=[dia('Peito + Tríceps','peito','triceps','core'),costas(),quad(),ombros(),post(),complemento()];
  if(n===1) dias=[dia('Full-body','peito','costas','quadriceps','posterior','ombros','gluteos','biceps','triceps','panturrilha','core')];
  if(n===3&&foco==='bracos') dias=[dia('Bíceps + Peito + Ombros','biceps','peito','ombros','core'),dia('Tríceps + Costas','triceps','costas'),pernas()];
  if(n===3&&foco==='pernas')dias=[superior(),quad(),post()];
  if(n>=4&&foco==='bracos') {
    dias=[dia('Peito + Ombros','peito','ombros','core'),dia('Costas','costas'),pernas(),dia('Braços','biceps','triceps')];
    if(n>=5){dias[0]=dia('Peito','peito','core');dias.push(dia('Ombros + complementares','ombros','panturrilha','core'));}
    if(n>=6){dias[0]=dia('Braços + Peito','biceps','triceps','peito');dias.push(complemento());}
  }
  if(n>=4&&(foco==='peito'||foco==='costas')){
    const outro=foco==='peito'?costas():peito();
    dias=[dia('Primeira sessão do foco',foco),pernas(),outro,dia('Segunda sessão do foco',foco,'ombros','core',foco==='peito'?'triceps':'biceps')];
    if(n>=5){dias[3]=dia('Segunda sessão do foco',foco);dias.push(dia('Ombros + Braços','ombros','biceps','triceps','core'));}
    if(n>=6)dias.push(complemento());
  }
  if(n>=4&&(foco==='pernas'||individual&&['quadriceps','posterior','gluteos'].includes(individual))){
    dias=[dia('Peito + Tríceps + Ombros','peito','triceps','ombros'),quad(),costas(),post()];
    if(n>=5){dias[0]=peito();dias.push(dia('Ombros + Braços','ombros','biceps','triceps'));}
    if(n>=6){
      if(foco==='pernas'){dias[1]=pernas();dias[3]=pernas();}
      dias.push(complemento());
    }
    // Foco individual conserva as outras ênfases, sem virar foco agregado.
    if(individual)for(const i of [1,3])dias[i]={...dias[i]!,grupos:[individual,...dias[i]!.grupos.filter(g=>g!==individual)]};
  }
  if(individual&&['ombros','biceps','triceps','panturrilha','core','antebraco'].includes(individual)){
    // Blocos complementares compartilham sessões; não nasce dia só de antebraço/core.
    let locais=dias.flatMap((d,i)=>d.grupos.includes(individual)?[i]:[]);
    if(!locais.length)locais=[Math.min(1,n-1)];
    if(n>=6&&locais.length===1)locais.push(locais[0]===0?3:0);
    for(const i of locais)dias[i]={...dias[i]!,grupos:[individual,...dias[i]!.grupos.filter(g=>g!==individual)]};
  }
  // Core continua com sua própria reserva; as estruturas fornecem lugares, não séries.
  if(n>1&&dias.filter(d=>d.grupos.includes('core')).length<2){const d=dias.find(d=>!d.grupos.includes('core'))!;d.grupos=[...d.grupos,'core'];}
  if(coreMax!=null){
    // Preserva primeiro os blocos complementares, que não devem virar dia vazio
    // por oferecer core acima do teto já usado pelo alocador.
    const locais=dias.flatMap((d,i)=>d.grupos.includes('core')?[i]:[]).sort((a,b)=>dias[a]!.grupos.length-dias[b]!.grupos.length||a-b).slice(0,coreMax);
    dias=dias.map((d,i)=>locais.includes(i)?d:{...d,grupos:d.grupos.filter(g=>g!=='core')});
  }
  const adaptada=retomada||(n>2&&perfil.nivelExperiencia==='iniciante');
  let recortes:GrupoPrimario[][];
  if(n===1)recortes=[['peito','costas','quadriceps','posterior']];
  else if(n===2)recortes=[['peito','costas'],['quadriceps','posterior']];
  else if(foco==='pernas')recortes=n>=6?[['quadriceps','posterior'],['quadriceps','posterior']]:[['quadriceps'],['posterior']];
  else if(n===3&&foco==='bracos')recortes=[['biceps','peito'],['triceps','costas']];
  else if(prioritarios.length)recortes=dias.filter(d=>prioritarios.every(g=>d.grupos.includes(g))).map(()=>[...prioritarios]);
  else recortes=dias.map(d=>d.grupos.filter(g=>['peito','costas','quadriceps','posterior','ombros'].includes(g))).filter(g=>g.length>0);
  if(!recortes.length&&prioritarios.length)recortes=[[...prioritarios]];
  const split=n===1?'Full-body':dias.map(d=>d.nome).join(' / ');
  return {...(adaptada?legado:{split,dias}),intencao:{nome:split,recortes,adaptada},preservarRecortes:!adaptada,prioritarios:adaptada?undefined:prioritarios};
}

/** Quantas sessões distintas do plano final cumprem os recortes principais pedidos.
 * Matching evita contar um único full-body como duas ênfases/sessões entregues.
 */
export function contarRecortesEntregues(recortes: IntencaoDivisao['recortes'], sessoes: readonly (readonly GrupoPrimario[])[]): number {
  const visitar = (i: number, usados: Set<number>): number => {
    if (i === recortes.length) return 0;
    let melhor = visitar(i + 1, usados);
    for (let d = 0; d < sessoes.length; d++) {
      if (usados.has(d) || !recortes[i]!.every(g => sessoes[d]!.includes(g))) continue;
      melhor = Math.max(melhor, 1 + visitar(i + 1, new Set([...usados, d])));
    }
    return melhor;
  };
  return visitar(0, new Set());
}
