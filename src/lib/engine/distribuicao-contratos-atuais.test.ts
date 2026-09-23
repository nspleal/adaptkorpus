import { verificarDistribuicaoComplementares } from './__fixtures__/complementares-contrato';
import {describe,it,expect} from 'vitest';
import {gerarTreino,FORMULA_DURACAO_VERSION} from './index';
import {montarRotina} from './treino-montador';
import {prescreverTreino} from './treino';
import {avaliarGateTreino} from './treino-gate';
import {avaliarDuracaoResistida} from './duracao-plano';
import {descansoDoExercicio} from './descanso';
import {rirAlvoDaSemana} from './treino-mesociclo';
import {distribuirCardioDaRotina} from './treino-cardio-semana';
import {duracaoDoDiaDeCardio} from './dia-de-cardio';
import {EXERCISES} from '../data/exercises';
import {creditoPonderadoDaSemana} from './alocador';
import type {PerfilTreino,SemanaCiclo} from './treino-types';
const base:PerfilTreino={pesoKg:80,alturaCm:180,idade:30,flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false},objetivo:'massa',nivelExperiencia:'intermediario',equipamento:'academia',diasDisponiveis:4,tempoPorSessaoMin:60};
const run=(p:PerfilTreino,semana:SemanaCiclo=1)=>gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
const composto=(s:ReturnType<typeof run>['dias'][number]['slots'][number])=>s.padrao!=='isolado'&&s.padrao!=='core';

describe('rodada2: propriedades atuais antes protegidas por fotografias',()=>{
 it('dia não atendido: motivo, nome e exclusão continuam no auto atual',()=>{
  // 2026-09-19: o caso vivo por EQUIPAMENTO exige os dois tríceps de peso do corpo banidos (ver dia-nao-atendido.test).
  const r=run({...base,objetivo:'massa',nivelExperiencia:'avancado',equipamento:'casa',equipamentosCasa:[],diasDisponiveis:5,tempoPorSessaoMin:20,preferencias:{banidos:['e40','e113','e114'],trocas:[]}});
  expect(r.diasNaoAtendidos?.length).toBeGreaterThan(0);
  for(const d of r.diasNaoAtendidos!){expect(d.nome.length).toBeGreaterThan(0);expect(d.motivo).toBe('EQUIPAMENTO');expect(d.slotsPedidos).toBeGreaterThan(0);expect(r.dias.map(x=>x.nome)).not.toContain(d.nome);expect(r.avisos.join(' ')).toContain(d.nome);}
  expect(r.dias.every(d=>d.slots.length>0)).toBe(true);
 });
 it.each([
  {tempo:30,n:4,nivel:'intermediario',objetivo:'massa',semana:1},
  {tempo:75,n:5,nivel:'avancado',objetivo:'massa',semana:5},
  {tempo:45,n:4,nivel:'intermediario',objetivo:'massa',semana:1},
  {tempo:75,n:5,nivel:'avancado',objetivo:'massa',semana:5},
  {tempo:60,n:5,nivel:'avancado',objetivo:'emagrecimento',semana:1,modoForca:true},
 ] as const)('convergência em todos os dias do perfil histórico $tempo/$n/$nivel/$objetivo',c=>{
  const p:PerfilTreino={...base,tempoPorSessaoMin:c.tempo,diasDisponiveis:c.n,nivelExperiencia:c.nivel,objetivo:c.objetivo,modoForca:'modoForca' in c};
  const r=run(p,c.semana);expect(r.dias.length).toBeGreaterThan(0);
  for(let i=0;i<r.dias.length;i++)expect(avaliarDuracaoResistida(r.dias[i]!.slots,p.nivelExperiencia,p.tempoPorSessaoMin*60,r.limiteTempoEstrito)).toEqual(r.duracaoResistidaDias![i]);
 });
 it('degradação por composição e acessório antes de composto: casos atuais discriminantes',()=>{
  let diferencaPorDia=false,acessorioPrimeiro=false;
  for(const tempo of [60,75,90]){
   const p={...base,tempoPorSessaoMin:tempo};const r=run(p,5);
   const presc=prescreverTreino(p,avaliarGateTreino(p));const rir=presc.rirAlvoSemana??rirAlvoDaSemana(presc.rir,5);
   const dados=r.dias.map(d=>({d,comp:d.slots.filter(composto),degradou:d.slots.some(s=>(s.descansoSeg??0)<(descansoDoExercicio({exercicio:s.exercicio,rirAlvo:rir,modoForca:false,semanaRampa:null,degradacao:0})??0))}));
   if(dados.some(d=>d.degradou)&&dados.some(d=>!d.degradou&&d.comp.length>0))diferencaPorDia=true;
   for(const {d,comp} of dados)if(comp.length&&comp.every(s=>(s.descansoSeg??0)>90)&&d.slots.some(s=>!composto(s)&&s.descansoSeg===60&&(descansoDoExercicio({exercicio:s.exercicio,rirAlvo:rir,modoForca:false,semanaRampa:null,degradacao:0})??0)>60))acessorioPrimeiro=true;
  }
  expect(diferencaPorDia,'composição precisa discriminar degradação').toBe(true);
  expect(acessorioPrimeiro,'degrau 1 precisa ocorrer de fato').toBe(true);
 });
 it('cardio e hash derivam do terminal, com caso discriminante pré-degradação',()=>{
  let discriminantes=0;
  for(const tempo of [30,39,45,60]){
   const p={...base,diasDisponiveis:5,tempoPorSessaoMin:tempo};
   const presc={...prescreverTreino(p,avaliarGateTreino(p)),seriesPorExercicio:{min:5,max:5},volumePorGrupoSemana:{min:20,max:20},cardio:{tipo:'minutos_semana',min:30,max:30} as const};
   const oferta=[0,1,2,3,4],B=tempo*60;
   const r=montarRotina(presc,p,EXERCISES,new Set(),{semana:1},p.preferencias,new Map(),oferta);
   const cfg={diasOferecidosCardio:oferta,orcamentoSegundos:B,cardioPrescritoPorDiaSegundos:duracaoDoDiaDeCardio(30,oferta.length)*60,aggregateId:'rotina-cardio',expectedRevision:0,formulaVersion:FORMULA_DURACAO_VERSION};
   const final=distribuirCardioDaRotina({...cfg,diasComMusculacao:r.dias.map((d,i)=>({diaId:d.diaId!,duracao:r.duracaoResistidaDias![i]!}))});
   expect(r.distribuicaoCardio!.canonicalInputHash).toBe(final.canonicalInputHash);
   expect(r.distribuicaoCardio!.contratosPorPrescricao).toEqual(final.contratosPorPrescricao);
   expect(r.distribuicaoCardio!.blocosPorDia).toEqual(final.blocosPorDia);
   const rir=presc.rirAlvoSemana??rirAlvoDaSemana(presc.rir,1);
   const antes=r.dias.map(d=>avaliarDuracaoResistida(d.slots.map(s=>({...s,descansoSeg:descansoDoExercicio({exercicio:s.exercicio,rirAlvo:rir,modoForca:false,semanaRampa:null,degradacao:0})!})),p.nivelExperiencia,B));
   const intermediario=distribuirCardioDaRotina({...cfg,diasComMusculacao:r.dias.map((d,i)=>({diaId:d.diaId!,duracao:antes[i]!}))});
   if(JSON.stringify(intermediario.contratosPorPrescricao)!==JSON.stringify(final.contratosPorPrescricao)){discriminantes++;expect(intermediario.canonicalInputHash).not.toBe(final.canonicalInputHash);}
  }
  expect(discriminantes).toBeGreaterThan(0);
 });
});

describe('rodada2: avisos e conservação sem autoridade estrutural duplicada',()=>{
 it('favoritos preservam puxar/empurrar, dobradiça e core, admitindo aviso real',()=>{
  const r=montarRotina(prescreverTreino(base,avaliarGateTreino(base)),base,EXERCISES,new Set(['e9','e3']));
  const count=(g:string)=>r.dias.flatMap(d=>d.slots).filter(s=>s.padrao===g).length;
  expect(count('puxar')).toBeGreaterThanOrEqual(count('empurrar'));
  expect(count('dobradica_quadril')).toBeGreaterThanOrEqual(1);
    // Autor 19/09: localização e um complementar por dia precedem core 2x.
    verificarDistribuicaoComplementares(r);
 });
 it('casa restrita: sessão curta é nomeada sem depender do rótulo Push',()=>{
  const r=run({...base,nivelExperiencia:'avancado',diasDisponiveis:6,equipamento:'casa',equipamentosCasa:[]});
  const curtos=r.dias.filter(d=>d.slots.length<6);expect(curtos.length).toBeGreaterThan(0);
  expect(curtos.some(d=>r.avisos.join(' ').includes(d.nome))).toBe(true);
 });
 /**
  * 🔵 REANCORADO em 2026-09-15 — o `+4` fixo saiu, o CONTRATO ficou.
  *
  * O que este caso protege continua sendo "adição SEM compensação": o bloco do foco não se
  * paga com séries de terceiros. O `+4` literal era, além disso, uma afirmação de que o
  * bloco entrega sempre — e essa parte era o defeito: com peito no topo da banda o motor
  * entregava 17/20 contra um teto de 16, e o crítico do editor acusava o próprio plano
  * (relato 2026-09-15). O teto duro vem do cofre (`motor-treino-grupo-em-foco-x-mrv`,
  * claims --005/--010/--011) e a entrega agora para nele.
  *
  * 🔒 A força do caso é mantida por duas vias: a identidade continua EXATA contra o que o
  * bloco declara (nada de "aproximadamente"), e a anti-vacuidade logo abaixo exige que
  * alguma das semanas entregue bloco de verdade.
  */
 const gruposDe=(r:ReturnType<typeof run>)=>{const m:Record<string,number>={};for(const d of r.dias)for(const s of d.slots){const g=s.exercicio.grupoPrimario!;m[g]=(m[g]??0)+(s.series??0);}return m;};
 const entregueDe=(r:ReturnType<typeof run>)=>(r.blocoFoco?.adicionais??[]).reduce((n,x)=>n+x.series,0);
 const P_SEM_LIMITE:PerfilTreino={...base,divisaoPreferida:'superior-inferior',limiteTempoTreino:'sem_limite'};
 const P_LIMITADO:PerfilTreino={...base,divisaoPreferida:'superior-inferior',tempoPorSessaoMin:60,limiteTempoTreino:'limitado'};
 // UL permanece como controle de conservação. Prioridades/90 min entrega
 // extras estáveis durante o ciclo e exercita o ganho real nas duas modalidades.
 const positivo=(limiteTempoTreino:PerfilTreino['limiteTempoTreino']):PerfilTreino=>({
  ...base,divisaoPreferida:'prioridades',tempoPorSessaoMin:90,limiteTempoTreino,
 });
 /** A propriedade, medida numa semana: terceiros intactos e focado = baseline + o declarado. */
 const semCompensacao=(p:PerfilTreino,semana:SemanaCiclo)=>{
  const a=run(p,semana),b=run({...p,foco:{grupo:'peito',compensa:'triceps',semana:1}},semana);
  const entregue=entregueDe(b);
  // 🔒 Vale nos dois casos: bloco entregue OU recusado pelo teto. Se o bloco não entrou,
  // o plano tem de ser IDÊNTICO ao neutro — recusar não pode custar séries a ninguém.
  expect(gruposDe(b)).toEqual({...gruposDe(a),peito:gruposDe(a).peito!+entregue});
  return entregue;
 };
 it.each([1,4,5] as const)('adição sem compensação na mesma divisão explícita, semana %i',semana=>{
  semCompensacao(P_SEM_LIMITE,semana);
 });
 it('anti-vacuidade: em alguma das semanas o bloco realmente entrega (sem_limite)',()=>{
  expect(([1,4,5] as const).reduce((n,s)=>n+semCompensacao(positivo('sem_limite'),s),0),
   'nenhuma semana entregou bloco — as igualdades acima seriam triviais').toBeGreaterThan(0);
 });
 it('extras inviáveis em uma semana não são prometidos nas demais semanas do ciclo',()=>{
  const p:PerfilTreino={...P_SEM_LIMITE,foco:{grupo:'peito',compensa:'triceps',semana:1}};
  const propostas=([1,2,3,4,5] as const).map(semana=>
   gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana,planejamentoCicloInterno:true}}).rotina!);
  // A S1 isolada entrega; na S3 o crédito indireto de tríceps impede o extra.
  expect(entregueDe(propostas[0]!)).toBeGreaterThan(0);
  expect(entregueDe(propostas[2]!)).toBe(0);
  expect(creditoPonderadoDaSemana(propostas[2]!.dias.flatMap(d=>d.slots)).get('triceps'))
   .toBe(propostas[2]!.tetoVolumeSemana!.semFoco);
  expect(propostas[2]!.avisos.join(' ')).toMatch(/somar Peito aqui levaria Tríceps acima/);
  const final=run(p,1);
  expect(entregueDe(final)).toBe(0);
  expect(final.avisos.join(' ')).toContain('não permaneceram viáveis nas cinco semanas');
  expect(gruposDe(final)).toEqual(gruposDe(run(P_SEM_LIMITE,1)));
 });
 /**
  * 🔴 L-01 (revisão independente 15/09) — a MESMA propriedade com tempo LIMITADO de 60 min,
  * que é a fixture que esta suíte tinha trocado por `75 + sem_limite`. No candidato
  * `badcea47` o bloco se pagava com séries de terceiros exatamente aqui.
  */
 it.each([1,4,5] as const)('tempo LIMITADO: adição sem compensação, semana %i',semana=>{
  semCompensacao(P_LIMITADO,semana);
 });
 it('anti-vacuidade: em alguma das semanas o bloco realmente entrega (LIMITADO)',()=>{
  expect(([1,4,5] as const).reduce((n,s)=>n+semCompensacao(positivo('limitado'),s),0),
   'nenhuma semana entregou bloco — as igualdades acima seriam triviais').toBeGreaterThan(0);
 });
});
