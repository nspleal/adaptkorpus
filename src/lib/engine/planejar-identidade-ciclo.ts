import {creditoPonderadoDaSemana} from './alocador';
import {avaliarDuracaoResistida} from './duracao-plano';
import {ehComplementar,ehDiaDePernas,ehDiaDisponivel} from './selecao-referencia';
import type {PerfilTreino,SlotExercicio,RotinaSemanal} from './treino-types';
import {PRINCIPAIS_TEMPO,SECUNDARIOS_TEMPO,MINIMOS_TEMPO} from './adequacao-tempo-politica';
import {diretosDoExercicio} from './cobertura-anatomica';
import {funcaoDe,papelReferencia} from './selecao-referencia';
import {adequarInicioFullUpperLower} from './adequacao-tempo-inicial';
import {tetoSeriesPorExercicio} from './trilhos';
import type {Exercise} from '../data/types';

const chaveDia=(d:RotinaSemanal['dias'][number])=>d.diaId??d.nome;
const alvos=(id:string)=>[...diretosDoExercicio(id)].sort().join('|');
const permutar=<T>(xs:readonly T[]):T[][]=>xs.length===0?[[]]:xs.flatMap((x,i)=>
 permutar(xs.filter((_,j)=>j!==i)).map(resto=>[x,...resto]));

/** Reaproveita as propostas do montador e testa uma identidade conjunta antes da certificação final. */
function conciliarUppers(semanas:readonly RotinaSemanal[],perfil:PerfilTreino,pool:readonly Exercise[]){
 if(semanas.length!==5||semanas.some(r=>r.dias.length!==6))return;
 const uppers=semanas.map(r=>r.dias.filter(d=>/^Upper\b/.test(d.nome)));
 if(uppers.some(ds=>ds.length!==3||ds.some((d,i)=>chaveDia(d)!==chaveDia(uppers[0]![i]!))))return;
 const comuns=uppers[0]!.map((d,i)=>new Set(d.slots.filter(s=>uppers.every(ds=>ds[i]!.slots.some(t=>t.exercicio.id===s.exercicio.id))).map(s=>s.exercicio.id)));
 const variaveis=[...new Set(uppers.flatMap(ds=>ds.flatMap((d,i)=>d.slots.filter(s=>!comuns[i]!.has(s.exercicio.id)).map(s=>s.exercicio.id))))];
 const exemplo=new Map(variaveis.map(id=>[id,uppers.flatMap(ds=>ds.flatMap(d=>d.slots)).find(s=>s.exercicio.id===id)!]));
 const complementares=variaveis.filter(id=>ehComplementar(exemplo.get(id)!.exercicio.grupoPrimario!));
 const principais=variaveis.filter(id=>!complementares.includes(id));
 if(principais.length!==1||complementares.length!==3
  ||complementares.some(id=>exemplo.get(id)!.exercicio.grupoPrimario==='panturrilha')
  ||principais.some(id=>uppers.some(ds=>!ds.some(d=>d.slots.some(s=>s.exercicio.id===id)))))return;
 const teto=tetoSeriesPorExercicio(perfil.nivelExperiencia);
 const limite=perfil.limiteTempoTreino==='sem_limite'?Infinity:perfil.tempoPorSessaoMin*60;
 const dur=(d:RotinaSemanal['dias'][number])=>avaliarDuracaoResistida(d.slots,perfil.nivelExperiencia,limite).duracaoMaximaEstimadaSegundos??Infinity;
 const credito=(r:RotinaSemanal)=>creditoPonderadoDaSemana(r.dias.flatMap(d=>d.slots));
 const original=semanas.map(credito);
 const papeis=(d:RotinaSemanal['dias'][number])=>d.slots.filter(s=>s.exercicio.grupoPrimario==='costas').map(s=>papelReferencia(s.exercicio)??funcaoDe(s.exercicio));
 const substitutos:{dia:number;de:string;para:Exercise}[]=[];
 for(let dia=0;dia<3;dia++)for(const s of uppers[0]![dia]!.slots){
  if(!comuns[dia]!.has(s.exercicio.id))continue;
  for(const e of pool)if(e.id!==s.exercicio.id&&e.grupoPrimario===s.exercicio.grupoPrimario
   &&e.padraoMovimento===s.exercicio.padraoMovimento&&alvos(e.id)===alvos(s.exercicio.id)
   &&(papelReferencia(e)??funcaoDe(e))===(papelReferencia(s.exercicio)??funcaoDe(s.exercicio))
   &&!semanas.some(r=>r.dias.some(d=>d.slots.some(x=>x.exercicio.id===e.id)))
   &&(creditoPonderadoDaSemana([{exercicio:e,series:1}]).get('biceps')??0)
     <(creditoPonderadoDaSemana([{exercicio:s.exercicio,series:1}]).get('biceps')??0))
   substitutos.push({dia,de:s.exercicio.id,para:e});
 }
 const solucoes:{semanas:RotinaSemanal[];custo:number}[]=[];
 for(const destinoPrincipal of [0,1,2])for(const destinos of permutar(complementares))
  for(const troca of [undefined,...substitutos]){
   const candidatas=semanas.map((r,w)=>{
    const copia:RotinaSemanal={...r,dias:r.dias.map(d=>({...d,slots:d.slots.map(s=>({...s}))}))};
    const ds=copia.dias.filter(d=>/^Upper\b/.test(d.nome));
    for(const d of ds)d.slots=d.slots.filter(s=>!variaveis.includes(s.exercicio.id));
    const colocar=(id:string,dia:number)=>{
     const existente=uppers[w]!.flatMap(d=>d.slots).find(s=>s.exercicio.id===id);
     const s=existente??{...exemplo.get(id)!,series:1};
     ds[dia]!.slots.push({...s});
    };
    colocar(principais[0]!,destinoPrincipal);
    destinos.forEach((id,dia)=>colocar(id,dia));
    if(troca)ds[troca.dia]!.slots.find(s=>s.exercicio.id===troca.de)!.exercicio=troca.para;
    return copia;
   });
   let custo=troca?1:0;
   for(const r of candidatas){
    const ds=r.dias.filter(d=>/^Upper\b/.test(d.nome));
    // Transfere séries do mesmo exercício antes de encurtar descanso: a dose semanal fica igual.
    for(let passo=0;passo<12;passo++){
     const excesso=()=>ds.reduce((n,d)=>n+Math.max(0,dur(d)-limite),0);
     const antes=excesso();
     if(antes<=0)break;
     let melhor:{de:SlotExercicio;para:SlotExercicio}|undefined;let ganho=0;
     for(const origem of ds.filter(d=>dur(d)>limite))for(const de of origem.slots.filter(s=>(s.series??0)>1))
      for(const destino of ds.filter(d=>d!==origem))for(const para of destino.slots.filter(s=>s.exercicio.id===de.exercicio.id&&(s.series??0)<teto)){
       de.series!--;para.series!++;
       const reducao=antes-excesso();
       para.series!--;de.series!++;
       if(reducao>ganho){ganho=reducao;melhor={de,para}}
      }
     if(!melhor)break;
     melhor.de.series!--;melhor.para.series!++;custo++;
    }
    for(const d of ds)if(dur(d)>limite){
     const ajustado=adequarInicioFullUpperLower(d,perfil.nivelExperiencia,limite);
     if(ajustado.removidos.length)break;
     custo+=ajustado.descansos.length;
     d.slots=ajustado.dia.slots;
    }
   }
   const ids=candidatas.map(r=>r.dias.map(d=>d.slots.map(s=>s.exercicio.id).sort().join('|')));
   if(!ids.every(row=>row.every((x,i)=>x===ids[0]![i])))continue;
   if(candidatas.some((r,w)=>{
    const c=credito(r),base=original[w]!,t=r.tetoVolumeSemana;
    if([...base].some(([g,n])=>(c.get(g)??0)<n-(g==='biceps'?0.5:0)))return true;
    const bicepsDireto=(rotina:RotinaSemanal)=>rotina.dias.flatMap(d=>d.slots)
      .filter(s=>s.exercicio.grupoPrimario==='biceps').reduce((n,s)=>n+(s.series??0),0);
    if(bicepsDireto(r)<bicepsDireto(semanas[w]!))return true;
    if([...c].some(([g,n])=>t&&n>(t.gruposEmFoco.includes(g)?t.cheio:t.semFoco)))return true;
    const anteriores=new Set(semanas[w]!.dias.flatMap(d=>d.slots.flatMap(s=>[...diretosDoExercicio(s.exercicio.id)])));
    const atuais=new Set(r.dias.flatMap(d=>d.slots.flatMap(s=>[...diretosDoExercicio(s.exercicio.id)])));
    if([...anteriores].some(a=>!atuais.has(a)))return true;
    if((c.get('biceps')??0)<(base.get('biceps')??0)&&![...atuais].some(a=>!anteriores.has(a)))return true;
    return r.dias.some(d=>{
     if(dur(d)>limite||d.slots.some(s=>(s.series??0)<1||(s.series??0)>teto||(s.descansoSeg??0)<60))return true;
     if(t?.sessao&&[...creditoPonderadoDaSemana(d.slots).values()].some(n=>n>t.sessao!))return true;
     if(!/^Upper\b/.test(d.nome))return false;
     if(d.slots.filter(s=>ehComplementar(s.exercicio.grupoPrimario!)).length>1)return true;
     if(Object.entries(MINIMOS_TEMPO.upper).some(([g,n])=>d.slots.filter(s=>s.exercicio.grupoPrimario===g).length<n))return true;
     const ps=papeis(d);return !ps.includes('puxada')||!ps.includes('remada');
    });
   }))continue;
   solucoes.push({semanas:candidatas,custo});
  }
 solucoes.sort((a,b)=>a.custo-b.custo);
 return solucoes[0]?.semanas;
}

/** Seleção conjunta sobre as cinco propostas, nunca uma troca na virada da semana.
 * Interseção por sessão preserva apenas identidades viáveis em todo o ciclo.
 * Não autoriza perder funções/alvos do baseline principal ou secundário.
 */
export function planejarIdentidadeDoCiclo(semanas:readonly RotinaSemanal[],perfil?:PerfilTreino,pool:readonly Exercise[]=[]) {
 const primeira=semanas[0]!;
 const porDia=semanas.map(r=>new Map(r.dias.map(d=>[d.diaId??d.nome,d])));
 const ids=new Map(primeira.dias.map(d=>[d.diaId??d.nome,d.slots.filter(s=>porDia.every(ds=>ds.get(d.diaId??d.nome)?.slots.some(x=>x.exercicio.id===s.exercicio.id))).map(s=>s.exercicio.id)]));
 const conflitos:string[]=[];
 for(const [w,r] of semanas.entries())for(const d of r.dias){
  const mantidos=d.slots.filter(s=>ids.get(d.diaId??d.nome)?.includes(s.exercicio.id));
  for(const s of d.slots){
   const g=s.exercicio.grupoPrimario;
   if(ids.get(d.diaId??d.nome)?.includes(s.exercicio.id)||s.extraDoFoco||!g||![...PRINCIPAIS_TEMPO,...SECUNDARIOS_TEMPO].includes(g))continue;
   const mesmo=mantidos.filter(x=>x.exercicio.grupoPrimario===g);
   const alvos=new Set(mesmo.flatMap(x=>[...diretosDoExercicio(x.exercicio.id)]));
   const papel=papelReferencia(s.exercicio)??funcaoDe(s.exercicio);
   if(!mesmo.some(x=>(papelReferencia(x.exercicio)??funcaoDe(x.exercicio))===papel)||[...diretosDoExercicio(s.exercicio.id)].some(a=>!alvos.has(a)))
    conflitos.push(`S${r.semana?.numero??w+1}, ${d.nome}: ${s.exercicio.nomePt} (${s.exercicio.id}) não é estável no ciclo e sua função ou seus alvos não estão preservados na composição comum.`);
  }
 }
 const adicoes:{dia:string;slot:SlotExercicio}[]=[];
 // A interseção pode liberar dias quando o complementar mudava de posição.
 // Testamos uma localização única nas cinco semanas, sem mexer no principal.
 if(perfil && !conflitos.length){
  const bases=semanas.map(r=>r.dias.map(d=>({...d,slots:d.slots.filter(s=>ids.get(d.diaId??d.nome)?.includes(s.exercicio.id))})));
  const pendentes=['panturrilha','core','antebraco'].filter(g=>!bases[0]!.some(d=>d.slots.some(s=>s.exercicio.grupoPrimario===g)));
  while(pendentes.length){
   const opcoes=pendentes.map(g=>{
    const candidatos=new Map<string,SlotExercicio>();
    for(const r of semanas)for(const d of r.dias)for(const s of d.slots)if(s.exercicio.grupoPrimario===g){
     const antigo=candidatos.get(s.exercicio.id);
     // Descanso mais conservador observado para esta execução no ciclo.
     if(!antigo||(s.descansoSeg??0)>(antigo.descansoSeg??0))candidatos.set(s.exercicio.id,s);
    }
    const locais=bases[0]!.flatMap(d=>{
     const dia=d.diaId??d.nome;
     const gs=d.slots.flatMap(s=>s.exercicio.grupoPrimario?[s.exercicio.grupoPrimario]:[]);
     const dedicado=ehDiaDisponivel(gs);
     const local=g==='panturrilha'?ehDiaDePernas(gs):dedicado||gs.some(x=>['peito','costas','ombros','biceps','triceps'].includes(x));
     if(!local||(!dedicado&&gs.some(ehComplementar)))return [];
     // Preservar a opção mais presente neste dia antes de deslocar outra para ele.
     const presenca=(s:SlotExercicio)=>porDia.filter(ds=>ds.get(dia)?.slots.some(x=>x.exercicio.id===s.exercicio.id)).length;
     return [...candidatos.values()].sort((a,b)=>presenca(b)-presenca(a)).flatMap(s=>{
      const slot:SlotExercicio={exercicio:s.exercicio,padrao:s.padrao,series:2,descansoSeg:s.descansoSeg,...(s.holdSeg?{holdSeg:s.holdSeg}:{}),...(s.incluidoPorPreferencia?{incluidoPorPreferencia:true}:{})};
      const cabe=bases.every((ds,w)=>{
       const destino=ds.find(x=>(x.diaId??x.nome)===dia);
       if(!destino)return false;
       const slots=[...destino.slots,slot],t=semanas[w]!.tetoVolumeSemana;
       const duracao=avaliarDuracaoResistida(slots,perfil.nivelExperiencia);
       if(duracao.estadoCalculo!=='CALCULADO'||(perfil.limiteTempoTreino!=='sem_limite'&&duracao.duracaoMaximaEstimadaSegundos!>perfil.tempoPorSessaoMin*60))return false;
       const creditos=creditoPonderadoDaSemana([...ds.flatMap(x=>x.slots),slot]);
       if(t&&[...creditos].some(([g,v])=>v>(t.gruposEmFoco.includes(g)?t.cheio:t.semFoco)))return false;
       return !t?.sessao||[...creditoPonderadoDaSemana(slots).values()].every(v=>v<=t.sessao!);
      });
      return cabe?[{dia,slot}]:[];
     });
    });
    return {g,locais};
   }).filter(x=>x.locais.length).sort((a,b)=>a.locais.length-b.locais.length);
   const escolha=opcoes[0];if(!escolha)break;
   const c=escolha.locais[0]!;adicoes.push(c);ids.get(c.dia)!.push(c.slot.exercicio.id);
   for(const ds of bases)ds.find(d=>(d.diaId??d.nome)===c.dia)!.slots.push({...c.slot});
   pendentes.splice(pendentes.indexOf(escolha.g),1);
  }
 }
 const fixas=conflitos.length&&perfil&&pool.length?conciliarUppers(semanas,perfil,pool):undefined;
 if(fixas)return {ids:new Map(fixas[0]!.dias.map(d=>[chaveDia(d),d.slots.map(s=>s.exercicio.id)])),adicoes:[],conflitos:[],fixas};
 return {ids,adicoes,conflitos:[...new Set(conflitos)],fixas:undefined};
}
