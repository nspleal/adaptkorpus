import { adequarSessaoPorTempo, MINIMOS_TEMPO } from './adequacao-tempo-politica';
import { expect, it } from 'vitest';
import { gerarTreino } from './index';
import { EXERCISES } from '../data/exercises';
import { creditoPonderadoDaSemana } from './alocador';
import { adequarTetoSemanal } from './adequacao-teto-semanal';
import { placarDaSemana, recomendacoes } from './critico';
import { tetoSemanalDoGrupo } from './trilhos';
import { impedimentosDaGeracao } from '../geracao-treino-aceitavel';
import type { PerfilTreino, SemanaCiclo, SlotExercicio } from './treino-types';

const perfil=(nivel:PerfilTreino['nivelExperiencia']):PerfilTreino=>({pesoKg:80,alturaCm:180,idade:30,objetivo:'massa',nivelExperiencia:nivel,equipamento:'academia',diasDisponiveis:4,treinoDias:['seg','ter','qui','sex'],tempoPorSessaoMin:75,limiteTempoTreino:'sem_limite',flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false}});
for(const grupo of ['biceps','triceps'] as const) it(`${grupo}: S1–S6, três níveis, com/sem foco; geração e crítico usam o mesmo teto`,()=>{
 let validos=0, focados=0;
 for(const nivel of ['iniciante','intermediario','avancado'] as const)
 for(const foco of [false,true]) for(const semana of [1,2,3,4,5,6] as SemanaCiclo[]){
  const p={...perfil(nivel),...(foco?{foco:{grupo,semana:1}}:{})};
  const t=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}),r=t.rotina!;
  const tetos=r.tetoVolumeSemana!;
  const teto=tetoSemanalDoGrupo({nivel,objetivo:'massa',emFoco:tetos.gruposEmFoco,tetoDaFase:tetos.cheio});
  const c=creditoPonderadoDaSemana(r.dias.flatMap(d=>d.slots));
  const placar=placarDaSemana(r.dias.map(d=>({nome:d.nome,exercicios:d.slots.map(s=>s.exercicio),series:d.slots.map(s=>s.series!)})),{nivel,objetivo:'massa',tempoPorSessaoMin:75,tetoVolumeSemana:tetos});
  const linha=placar.find(l=>l.grupo===grupo)!;
  expect(linha.temFaixa).toBe(false);
  expect(linha.temTeto).toBe(true);
  expect(linha.mev).toBeUndefined();
  expect(linha.ponderado).toBe(c.get(grupo)??0);
  expect(linha.maxAutomatico).toBe(teto(grupo));
  if(!foco)expect(tetos.gruposEmFoco).not.toContain(grupo);
  if(foco&&tetos.gruposEmFoco.includes(grupo))focados++;
  const excessos=(['biceps','triceps'] as const).filter(g=>(c.get(g)??0)>teto(g));
  if(excessos.length){
   expect(r.resultadoGeracao?.tipo).toBe('TETO_SEMANAL_NAO_ATENDIDO');
   expect(impedimentosDaGeracao(t).length).toBeGreaterThan(0);
   for(const g of excessos)expect(r.dias.flatMap(d=>d.slots).filter(s=>s.exercicio.grupoPrimario===g).every(s=>s.series===1)).toBe(true);
  }else{validos++;expect(excessos).toEqual([]);}
 }
 expect(validos).toBeGreaterThan(0);expect(focados).toBeGreaterThan(0);
});

it('excesso indireto de tríceps não autoriza retirar ou reduzir peito',()=>{
 const slot=(id:string,series:number):SlotExercicio=>{const exercicio=EXERCISES.find(e=>e.id===id)!;return {exercicio,padrao:exercicio.padraoMovimento,series,descansoSeg:120};};
 const entrada=[{nome:'Upper',slots:[slot('e1',4),slot('e10',4),slot('e67',3)]}];
 const copia=structuredClone(entrada);
 const r=adequarTetoSemanal({dias:entrada,nivel:'iniciante',teto:g=>g==='triceps'?3:99,minimos:[{peito:2,triceps:1}]});
 expect(r.dias[0]!.slots.map(s=>[s.exercicio.id,s.series])).toEqual([['e1',4],['e10',4],['e67',1]]);
 expect(r.conflitos).toEqual([{grupo:'triceps',credito:5,teto:3}]);
 expect(entrada).toEqual(copia);
 expect(r.passos.every(p=>p.dias.every(d=>d.faltas.length===0))).toBe(true);
});

for(const grupo of ['biceps','triceps'] as const)it(`manual ${grupo}: teto diagnostica sem reescrever séries escolhidas`,()=>{
 const ids=grupo==='biceps'?['e19','e72']:['e68','e69'];
 const p={...perfil('iniciante'),rotinaCustom:{origem:'usuario' as const,dias:[{nome:'Manual',diaId:'seg' as const,exercicioIds:ids,seriesPorExercicio:Object.fromEntries(ids.map(id=>[id,9]))}]}};
 const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:3}}).rotina!;
 expect(r.dias[0]!.slots.map(s=>[s.exercicio.id,s.series])).toEqual(ids.map(id=>[id,9]));
 const linhas=placarDaSemana(r.dias.map(d=>({nome:d.nome,exercicios:d.slots.map(s=>s.exercicio),series:d.slots.map(s=>s.series!)})),{nivel:'iniciante',objetivo:'massa',tempoPorSessaoMin:75,tetoVolumeSemana:r.tetoVolumeSemana});
 expect(linhas.find(l=>l.grupo===grupo)?.status).toBe('acima_mrv');
});

for (const grupo of ['biceps','triceps'] as const) it(`${grupo}: zero ou uma série não cria mínimo semanal nem recomendação de aumento`,()=>{
 for(const series of [0,1]) {
  const e=EXERCISES.find(e=>e.grupoPrimario===grupo)!;
  const linhas=placarDaSemana([{nome:'Teste',exercicios:[e],series:[series]}],{nivel:'iniciante',objetivo:'massa',tempoPorSessaoMin:60});
  const linha=linhas.find(l=>l.grupo===grupo)!;
  expect(linha).toMatchObject({temFaixa:false,temTeto:true,status:'sem_referencia',ponderado:series});
  expect(linha.mev).toBeUndefined();
  expect(recomendacoes(linhas).filter(r=>r.fato?.grupo===grupo)).toEqual([]);
 }
});

it('ausência de mínimo semanal não dispensa exercício direto obrigatório por sessão',()=>{
 const exercicio=EXERCISES.find(e=>e.id==='e1')!;
 const dia={nome:'Upper',diaId:'seg' as const,slots:[{exercicio,padrao:exercicio.padraoMovimento,series:1,descansoSeg:60}]};
 const r=adequarSessaoPorTempo({dia,nivel:'iniciante',tipo:'upper',gruposObrigatorios:[],podeRetirar:()=>false});
 expect(MINIMOS_TEMPO.upper.biceps).toBe(1);
 expect(MINIMOS_TEMPO.upper.triceps).toBe(1);
 expect(r.faltas.map(f=>f.grupo)).toEqual(expect.arrayContaining(['biceps','triceps']));
 // Flexão credita tríceps indiretamente, mas não substitui o exercício direto obrigatório.
 expect(creditoPonderadoDaSemana(dia.slots).get('triceps')).toBeGreaterThan(0);
});
