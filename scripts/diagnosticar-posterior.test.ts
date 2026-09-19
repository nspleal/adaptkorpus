import {it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {gerarTreino,poolElegivel} from '../src/lib/engine';
import {EXERCISES} from '../src/lib/data/exercises';
import {perfilBase} from './dump-planos';
import {creditoPonderadoDaSemana,orcamentoSlotsDoDia} from '../src/lib/engine/alocador';
import {avaliarDuracaoResistida} from '../src/lib/engine/duracao-plano';
import {diretosDoExercicio} from '../src/lib/engine/cobertura-anatomica';
import {descansoDoExercicio} from '../src/lib/engine/descanso';
it('registra alternativas reais do intermediário por restrição',()=>{
 const saida=[];
 for(const tempoPorSessaoMin of [60,75,90]){
  const p=perfilBase({diasDisponiveis:4,tempoPorSessaoMin});
  const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:2}}).rotina!;
  const pool=poolElegivel(EXERCISES,p,p.preferencias);
  const d=r.dias.find(d=>d.slots.some(s=>s.exercicio.id==='e80'))!;
  const antes=creditoPonderadoDaSemana(r.dias.flatMap(d=>d.slots));
  const avaliar=(slots:typeof d.slots)=>{
   const depois=creditoPonderadoDaSemana(r.dias.flatMap(x=>x===d?slots:x.slots));
   return {perdas:[...antes].filter(([g,n])=>(depois.get(g)??0)<n).map(([g,n])=>({grupo:g,antes:n,depois:depois.get(g)})),slots:slots.length,tetoSlots:orcamentoSlotsDoDia(tempoPorSessaoMin),duracao:avaliarDuracaoResistida(slots,p.nivelExperiencia).duracaoMaximaEstimadaSegundos,credito:Object.fromEntries(depois)};
  };
  const candidatos=EXERCISES.filter(e=>e.grupoPrimario==='posterior'&&diretosDoExercicio(e.id).has('fc')).map(e=>{
   if(!pool.some(x=>x.id===e.id))return {id:e.id,nome:e.nomePt,elegivel:false,nivel:e.nivel};
   const novo={exercicio:e,padrao:e.padraoMovimento,series:2,descansoSeg:descansoDoExercicio({exercicio:e,rirAlvo:2,modoForca:false,degradacao:0})??0};
   return {id:e.id,nome:e.nomePt,elegivel:true,trocas:d.slots.filter(s=>s.exercicio.grupoPrimario==='posterior').map(s=>({sai:s.exercicio.id,...avaliar(d.slots.map(x=>x===s?novo:x))})),adicao:avaliar([...d.slots,novo])};
  });
  saida.push({perfil:p,semana:2,dia:d.nome,antes:d.slots.map(s=>({id:s.exercicio.id,series:s.series})),candidatos});
 }
 writeFileSync(process.env.ADAPT_DIAGNOSTICO!,JSON.stringify(saida,null,2),'utf8');
});
