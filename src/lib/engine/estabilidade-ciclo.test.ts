import {expect,it} from 'vitest';
import {gerarTreino} from './index';import {EXERCISES} from '../data/exercises';
import {creditoPonderadoDaSemana} from './alocador';import {tetoSemanalDoGrupo} from './trilhos';
import {GRUPOS_COM_FAIXA_SEMANAL} from './grupos-volume';import {avaliarDuracaoResistida} from './duracao-plano';
import {adicoesComplementaresViaveis} from './__fixtures__/complementares-viabilidade';
import {planejarIdentidadeDoCiclo} from './planejar-identidade-ciclo';
import type {PerfilTreino,RotinaSemanal} from './treino-types';
it('folga para trapézio preserva a opção de antebraço recorrente no dia durante todo o ciclo',()=>{
 const p={...perfil('avancado',4,45,false),objetivo:'saude' as const,treinoDias:['seg','ter','qua','qui'] as const};
 for(const semana of [1,2,3,4,5,6] as const){
  const r=gerarTreino({...p,treinoDias:[...p.treinoDias]},{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
  expect(r.resultadoGeracao?.tipo).toBe('CERTIFICADO');
  const ss=r.dias.flatMap(d=>d.slots);
  expect(ss.some(s=>s.exercicio.id==='e97'),'trapézio ausente').toBe(true);
  expect(ss.some(s=>s.exercicio.id==='e137'),'flexão de punho substituída por outra região').toBe(true);
 }
});
const perfil=(nivel:PerfilTreino['nivelExperiencia'],dias:number,tempo:number,foco:boolean):PerfilTreino=>({pesoKg:80,alturaCm:180,idade:30,objetivo:'massa',nivelExperiencia:nivel,equipamento:'academia',diasDisponiveis:dias,tempoPorSessaoMin:tempo,limiteTempoTreino:'limitado',flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false},...(foco?{foco:{grupo:'biceps',semana:1}}:{})});
for(const nivel of ['iniciante','intermediario','avancado'] as const)for(const dias of [2,4,6])for(const tempo of [30,90])for(const foco of [false,true])it(`${nivel}/${dias}d/${tempo}min/foco=${foco}: mesmos IDs S1–S5, tempo e tetos`,()=>{
 const p=perfil(nivel,dias,tempo,foco);const foto=JSON.stringify(p);
 const rs=([1,2,3,4,5] as const).map(semana=>gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!);
 const ids=(r:RotinaSemanal)=>r.dias.map(d=>({dia:d.diaId,ids:d.slots.map(s=>s.exercicio.id).sort()}));
 for(const r of rs){
  expect(ids(r)).toEqual(ids(rs[0]!));expect(r.resultadoGeracao?.tipo).toBe('CERTIFICADO');
  const t=r.tetoVolumeSemana!,teto=tetoSemanalDoGrupo({nivel,objetivo:'massa',emFoco:t.gruposEmFoco,tetoDaFase:t.cheio});
  const creditos=creditoPonderadoDaSemana(r.dias.flatMap(d=>d.slots));
  for(const g of GRUPOS_COM_FAIXA_SEMANAL)expect(creditos.get(g)??0,g).toBeLessThanOrEqual(teto(g));
  for(const d of r.dias){
   const m=avaliarDuracaoResistida(d.slots,nivel);expect(m.estadoCalculo).toBe('CALCULADO');expect(m.duracaoMaximaEstimadaSegundos).toBeLessThanOrEqual(tempo*60);
   for(const n of creditoPonderadoDaSemana(d.slots).values())expect(n).toBeLessThanOrEqual(t.sessao!);
   expect(d.slots.every(s=>(s.series??0)>=1)).toBe(true);
  }
 }
 expect(JSON.stringify(p)).toBe(foto);
});
it('não resolve instabilidade descartando silenciosamente função exclusiva de um principal',()=>{
 const p=perfil('intermediario',2,90,false);const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:1}}).rotina!;
 const outro=structuredClone(r);const di=outro.dias.findIndex(d=>d.slots.some(s=>s.exercicio.grupoPrimario==='costas'));
 outro.dias[di]!.slots=outro.dias[di]!.slots.filter(s=>s.exercicio.grupoPrimario!=='costas');
 expect(planejarIdentidadeDoCiclo([r,outro,r,r,r]).conflitos.length).toBeGreaterThan(0);
});
it('memo não reaproveita composição quando catálogo ou configuração mudam',()=>{
 const p=perfil('iniciante',4,30,false);const gerar=(exercises:typeof EXERCISES)=>gerarTreino(p,{exercises,semanaCiclo:{semana:1}}).rotina!;
 const antes=gerar(EXERCISES);const id=antes.dias[0]!.slots[0]!.exercicio.id;
 const restrito=gerar(EXERCISES.filter(e=>e.id!==id));
 expect(restrito.dias.flatMap(d=>d.slots).some(s=>s.exercicio.id===id)).toBe(false);
 expect(gerar(EXERCISES).dias).toEqual(antes.dias);
});

it('iniciante/academia/4d/30min: deload indireto preserva toda composição e cabe nos limites',()=>{
 // Controle do deload em Upper/Lower; auto de quatro dias agora é segmentado.
 const p={...perfil('iniciante',4,30,false),divisaoPreferida:'superior-inferior' as const};
 const s5=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:5}}).rotina!;
 const s6=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:6}}).rotina!;
 expect(s6.dias.map(d=>d.slots.map(s=>s.exercicio.id))).toEqual(s5.dias.map(d=>d.slots.map(s=>s.exercicio.id)));
 expect(s6.resultadoGeracao?.tipo).toBe('CERTIFICADO');
 const c=creditoPonderadoDaSemana(s6.dias.flatMap(d=>d.slots));
 expect(c.get('gluteos')).toBe(6);expect(c.get('quadriceps')).toBe(5);
 for(const g of GRUPOS_COM_FAIXA_SEMANAL)expect(c.get(g)??0).toBeLessThanOrEqual(6);
 for(const d of s6.dias){
  expect(d.slots.every(s=>(s.series??0)>=1)).toBe(true);
  expect(avaliarDuracaoResistida(d.slots,'iniciante').duracaoMaximaEstimadaSegundos).toBeLessThanOrEqual(1800);
 }
 expect(s6.avisos.some(a=>a.includes('Glúteos')&&a.includes('6.5→6')&&a.includes('6→5'))).toBe(true);
});

it('não omite complementares só porque mudavam de dia nas propostas semanais',()=>{
 const p=perfil('iniciante',3,60,false);
 const rs=([1,2,3,4,5] as const).map(semana=>gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!);
 const ids=(r:RotinaSemanal)=>r.dias.map(d=>d.slots.map(s=>s.exercicio.id));
 for(const [i,r] of rs.entries()){
  // Upper/Lower alterna; identidade se compara entre repetições do mesmo desenho.
  expect(ids(r)).toEqual(ids(rs[i%2]!));
  expect(r.resultadoGeracao?.tipo).toBe('CERTIFICADO');
 }
 for(const paridade of [0,1]){
  const semanas=rs.filter((_,i)=>i%2===paridade);
  for(const g of ['core','panturrilha','antebraco'] as const){
   const alternativas=semanas.map(r=>adicoesComplementaresViaveis(r,p,g));
   expect(alternativas[0]!.filter(x=>alternativas.every(a=>a.includes(x))),`${paridade}/${g}: omissão corrigível`).toEqual([]);
  }
 }
 // Controle positivo: a semana com dois Upper continua entregando ambos.
 for(const g of ['core','panturrilha'])expect(rs[0]!.dias.some(d=>d.slots.some(s=>s.exercicio.grupoPrimario===g))).toBe(true);
});

it('margem do foco não muda a dose de terceiros no baseline antes dos extras',()=>{
 const p=perfil('iniciante',5,60,false);p.treinoDias=['seg','ter','qua','qui','sex'];
 for(const semana of [1,3,5] as const){
  const a=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
  const b=gerarTreino({...p,foco:{grupo:'costas',semana:1}},{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
  const terceiros=(r:RotinaSemanal)=>r.dias.map(d=>d.slots.filter(s=>s.exercicio.grupoPrimario!=='costas').map(s=>`${s.exercicio.id}:${s.series}`).sort());
  expect(terceiros(b)).toEqual(terceiros(a));
  const total=(r:RotinaSemanal)=>r.dias.flatMap(d=>d.slots).reduce((n,s)=>n+(s.series??0),0);
  const extras=b.blocoFoco!.adicionais.reduce((n,s)=>n+s.series,0);
  expect(extras).toBe(2);expect(total(b)-total(a)).toBe(extras);
 }
});

it('relato do foco corresponde aos extras que sobreviveram ao planejamento da alternância',()=>{
 const p={...perfil('iniciante',3,60,false),treinoDias:['seg','qua','sex'] as const,focoAgregado:{grupo:'pernas' as const,semana:1}};
 const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:1}}).rotina!;
 expect(r.blocoFoco!.adicionais.length).toBeGreaterThan(0);
 for(const a of r.blocoFoco!.adicionais){
  const s=r.dias.find(d=>d.diaId===a.diaId)!.slots.find(s=>s.exercicio.id===a.exercicioId);
  expect(s).toBeDefined();expect(s!.series).toBe(a.series);
 }
 expect(r.avisos.some(a=>a.includes('Bloco do foco no ciclo estável: 0'))).toBe(false);
});


it.each([0, 1, 2])('identifica dias pelo calendário quando uma semana omite a posição %i', omitido => {
 const p=perfil('iniciante',3,60,false);
 const base=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:1}}).rotina!;
 const reduzida={...base,dias:base.dias.filter((_,i)=>i!==omitido)};
 const plano=planejarIdentidadeDoCiclo([base,reduzida,base,base,base]);
 for(const d of reduzida.dias)expect(plano.ids.get(d.diaId!)).toEqual(d.slots.map(s=>s.exercicio.id));
 expect(plano.ids.get(base.dias[omitido]!.diaId!)).toEqual([]);
});

it('dia vazio no meio não apaga sexta estável nem aplica mínimos de quinta a ela',()=>{
 const p:PerfilTreino={...perfil('avancado',5,20,false),equipamento:'casa',equipamentosCasa:[],
  preferencias:{banidos:['e40','e113','e114'],trocas:[]}};
 const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:1}}).rotina!;
 expect(r.dias.find(d=>d.diaId==='sex')?.slots.map(s=>s.exercicio.id)).toContain('e147');
 expect(r.diasNaoAtendidos?.some(d=>d.diaId==='sex')).toBe(false);
 expect(r.resultadoGeracao?.tipo).toBe('MINIMOS_NAO_ATENDIDOS');
 if(r.resultadoGeracao?.tipo==='MINIMOS_NAO_ATENDIDOS') {
  expect(r.resultadoGeracao.motivos.some(m=>m.includes('Complementares'))).toBe(false);
 }
});
