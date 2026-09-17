import {it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {gerarTreino} from '../src/lib/engine';
import {EXERCISES} from '../src/lib/data/exercises';
import {creditoPonderadoDaSemana} from '../src/lib/engine/alocador';
import {diretosDoExercicio} from '../src/lib/engine/cobertura-anatomica';
import {avaliarDuracaoResistida} from '../src/lib/engine/duracao-plano';
import {perfilBase} from './dump-planos';
it('mede perfis por alvo',()=>{
 const linhas=[];
 for(const nivelExperiencia of ['iniciante','intermediario','avancado'] as const)
 for(const diasDisponiveis of [3,4,5,6]) for(const tempoPorSessaoMin of [30,45,60,75,90])
 for(const semana of [1,2,3,5,6] as const) {
  const p=perfilBase({nivelExperiencia,diasDisponiveis,tempoPorSessaoMin,
   treinoDias:['seg','ter','qua','qui','sex','sab'].slice(0,diasDisponiveis) as never});
  const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
  linhas.push({chave:`${nivelExperiencia}/${diasDisponiveis}/${tempoPorSessaoMin}/${semana}`,
   credito:Object.fromEntries(creditoPonderadoDaSemana(r.dias.flatMap(d=>d.slots))),
   dias:r.dias.map(d=>({nome:d.nome,id:d.diaId,slots:d.slots.map(s=>({id:s.exercicio.id,grupo:s.exercicio.grupoPrimario,series:s.series,descanso:s.descansoSeg})),
    cobertura:[...new Set(d.slots.flatMap(s=>[...diretosDoExercicio(s.exercicio.id)]))].sort(),
    duracao:avaliarDuracaoResistida(d.slots,p.nivelExperiencia).duracaoMaximaEstimadaSegundos})),
   diagnostico:r.coberturaAnatomica});
 }
 writeFileSync(process.env.ADAPT_MEDICAO!,JSON.stringify(linhas,null,2),'utf8');
});
