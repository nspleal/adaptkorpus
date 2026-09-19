import {it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {gerarTreino} from '../src/lib/engine';
import {EXERCISES} from '../src/lib/data/exercises';
import {perfilBase} from './dump-planos';
it('localiza casos reais do passe dosado sem alterar políticas',()=>{
 const encontrados=[];let examinados=0;
 for(const objetivo of ['saude','massa','emagrecimento'] as const)
 for(const nivelExperiencia of ['intermediario','avancado'] as const)
 for(const diasDisponiveis of [2,3,4,5,6])
 for(const tempoPorSessaoMin of [20,25,30,35,40,45,50,55,60,75,90])
 for(const semana of [1,2,3,5] as const){
  const p=perfilBase({objetivo,nivelExperiencia,diasDisponiveis,tempoPorSessaoMin});
  const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
  examinados++;
  if(r.avisos.some(a=>a.startsWith('Cobertura de posteriores')))encontrados.push({perfil:p,semana,rotina:r});
 }
 writeFileSync(process.env.ADAPT_SEARCH!,JSON.stringify({examinados,encontrados},null,2),'utf8');
},120000);
