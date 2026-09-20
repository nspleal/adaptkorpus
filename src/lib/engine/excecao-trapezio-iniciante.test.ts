import {describe,it,expect} from 'vitest';
import {gerarTreino} from './index';
import {EXERCISES} from '../data/exercises';
import {creditoPonderadoDaSemana} from './alocador';
import {diretosDoExercicio} from './cobertura-anatomica';
import {aplicarExcecaoTrapezio} from './excecao-trapezio-iniciante';
import type {PerfilTreino,DiaTreino} from './treino-types';

const p:PerfilTreino={pesoKg:80,alturaCm:180,idade:30,flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false},objetivo:'massa',nivelExperiencia:'iniciante',equipamento:'academia',equipamentosCasa:[],diasDisponiveis:4,treinoDias:['seg','ter','qui','sex'],tempoPorSessaoMin:30,limiteTempoTreino:'limitado'};
// Contrafactual medido antes da exceção; não deriva os esperados da própria função.
const fixture=():DiaTreino[]=>[
  ['e15','e43','e14','e40'],['e49','e46','e168','e72'],
  ['e28','e64','e57','e62'],['e73','e147'],
].map((ids,i)=>({nome:`Dia ${i}`,diaId:p.treinoDias![i],slots:ids.map(id=>{
  const exercicio=EXERCISES.find(e=>e.id===id)!;
  return {exercicio,padrao:exercicio.padraoMovimento,series:id==='e49'?2:3,descansoSeg:60};
})}));
const aplicar=(perfil:PerfilTreino,dias:DiaTreino[])=>aplicarExcecaoTrapezio({perfil,dias,pool:EXERCISES,
  materializar:(exercicio,s)=>({...s,exercicio,padrao:exercicio.padraoMovimento})});

describe('exceção localizada autorizada: trapézio no iniciante 4d/30min',()=>{
 it('preserva demais créditos, alvos, dose e grupos; aceita só os dois pisos autorizados',()=>{
  const dias=fixture(),antes=dias.flatMap(d=>d.slots),c=creditoPonderadoDaSemana(antes);
  expect(aplicar(p,dias)).toBe(true);
  const depois=dias.flatMap(d=>d.slots),n=creditoPonderadoDaSemana(depois);
  expect(n.get('biceps')).toBe(6);expect(n.get('ombros')).toBe(3);
  for(const [g,v] of c)if(g!=='biceps'&&g!=='ombros')expect(n.get(g),g).toBe(v);
  const aa=new Set(antes.flatMap(s=>[...diretosDoExercicio(s.exercicio.id)]));
  const dd=new Set(depois.flatMap(s=>[...diretosDoExercicio(s.exercicio.id)]));
  expect([...aa].every(a=>dd.has(a))).toBe(true);expect(dd.has('ts')).toBe(true);
  expect(depois.map(s=>s.series)).toEqual(antes.map(s=>s.series));
  expect(depois.filter(s=>s.padrao==='puxar')).toHaveLength(2);
  expect(depois.filter(s=>s.padrao==='empurrar')).toHaveLength(2);
 });
 it.each([{nivelExperiencia:'intermediario'},{diasDisponiveis:5},{tempoPorSessaoMin:60},{equipamento:'casa'},{limiteTempoTreino:'sem_limite'}] as Partial<PerfilTreino>[])
 ('não amplia a exceção para %j',over=>{const d=fixture(),antes=JSON.stringify(d);expect(aplicar({...p,...over},d)).toBe(false);expect(JSON.stringify(d)).toBe(antes);});
 it('não retira remadas favoritas',()=>{const d=fixture();for(const s of d[1]!.slots)s.incluidoPorPreferencia=true;const a=JSON.stringify(d);expect(aplicar(p,d)).toBe(false);expect(JSON.stringify(d)).toBe(a);});
 /**
  * 🔵 NÚMEROS REMEDIDOS EM 2026-09-20, e o motivo não é a exceção: o perfil deste caso é
  * iniciante com 4 dias marcados. Até 19/09 ele recebia 3 sessões full-body (a agenda era
  * cortada no teto do nível) mais um dia dedicado a complementares; desde a decisão do autor
  * ele recebe 4 sessões Upper/Lower ×2. Com 30 min por sessão o dia cabe 4 slots, e num Upper
  * de 4 slots costas/peito/ombros ficam à frente do bíceps — o crédito de bíceps cai de 6 para
  * 2 (só indireto) e o de ombros sobe de 3 para 6.
  *
  * 🔒 O CONTRATO DA EXCEÇÃO não mudou e continua provado acima, na fixture montada à mão
  * (bíceps 6 · ombros 3 · séries idênticas · padrões preservados). O que este caso cobra é a
  * INTEGRAÇÃO: o trapézio entra no plano automático, os tempos fecham e o manual não é tocado.
  * 🔴 E a perda de bíceps direto não passa calada — asserção nova, abaixo.
  */
 it('integra no automático com tempos reais e preserva manual',()=>{
  const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:3}}).rotina!;
  const ss=r.dias.flatMap(d=>d.slots),c=creditoPonderadoDaSemana(ss);
  expect(ss.some(s=>diretosDoExercicio(s.exercicio.id).has('ts'))).toBe(true);
  expect(c.get('biceps')).toBe(2);expect(c.get('ombros')).toBe(6);
  // O bíceps ficou sem exercício direto neste orçamento — e o motor DIZ isso.
  expect(ss.some(s=>s.exercicio.grupoPrimario==='biceps'),'bíceps direto apareceu: remeça os números').toBe(false);
  expect(r.avisos.some(a=>/Cobertura direta ausente neste plano:.*B[í i]ceps/i.test(a)),
    `a ausência de bíceps direto não foi dita: ${r.avisos.join(' | ')}`).toBe(true);
  expect(r.duracaoDias!.every(d=>d.estadoCalculo==='CALCULADO'&&d.duracaoMaximaEstimadaSegundos!<=1800)).toBe(true);
  const dias=fixture().map(d=>({nome:d.nome,diaId:d.diaId,exercicioIds:d.slots.map(s=>s.exercicio.id)}));
  const m=gerarTreino({...p,rotinaCustom:{origem:'usuario',dias}},{exercises:EXERCISES,semanaCiclo:{semana:3}}).rotina!;
  expect(m.dias.map(d=>d.slots.map(s=>s.exercicio.id))).toEqual(dias.map(d=>d.exercicioIds));
 });
});
