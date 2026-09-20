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
  * 🔒 O CONTRATO DA EXCEÇÃO não mudou e continua provado acima, na fixture montada à mão
  * (bíceps 6 · ombros 3 · séries idênticas · padrões preservados). O que este caso cobra é a
  * INTEGRAÇÃO: o trapézio entra no plano automático, os tempos fecham e o manual não é tocado.
  *
  * 🔵 2026-09-20 (3ª volta) — a asserção que exigia a AUSÊNCIA de bíceps direto SAIU. Ela
  * transformava uma limitação de orçamento em regra, e regra ela não é: se um dia couber um
  * bíceps direto aqui, o teste tem de aprovar, não reprovar. O que substitui a ausência é o
  * caso abaixo, que MEDE a restrição em vez de descrevê-la.
  */
 it('integra no automático com tempos reais e preserva manual',()=>{
  const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:3}}).rotina!;
  const ss=r.dias.flatMap(d=>d.slots),c=creditoPonderadoDaSemana(ss);
  expect(ss.some(s=>diretosDoExercicio(s.exercicio.id).has('ts'))).toBe(true);
  expect(c.get('ombros')).toBe(6);
  // 🔵 PISO, não alvo: a 4ª volta levou o bíceps de 2,0 para 2,5 ponderadas neste perfil, pela
  // repartição dentro do grupo (a série sai da puxada, que não credita ninguém, e vai para a
  // remada, que credita 0,5). O requisito de ≥ 6 continua PENDENTE — ver o `it.todo` abaixo.
  // Esta linha impede a REGRESSÃO do que já foi entregue; um conserto que alcance 6 passa nela.
  expect(c.get('biceps'), 'bíceps regrediu abaixo do que a 4ª volta entregou').toBeGreaterThanOrEqual(2.5);
  expect(r.duracaoDias!.every(d=>d.estadoCalculo==='CALCULADO'&&d.duracaoMaximaEstimadaSegundos!<=1800)).toBe(true);
  const dias=fixture().map(d=>({nome:d.nome,diaId:d.diaId,exercicioIds:d.slots.map(s=>s.exercicio.id)}));
  const m=gerarTreino({...p,rotinaCustom:{origem:'usuario',dias}},{exercises:EXERCISES,semanaCiclo:{semana:3}}).rotina!;
  expect(m.dias.map(d=>d.slots.map(s=>s.exercicio.id))).toEqual(dias.map(d=>d.exercicioIds));
 });

/**
  * 🔴 A EXIGÊNCIA PEDIDA — bíceps ≥ 6 ponderadas COM exercício direto — CONTINUA PENDENTE.
  *
  * 🔵 2026-09-20 (4ª volta). O caso que ficava aqui — "a restrição medida" — SAIU por ordem do
  * autor: ele cobrava bíceps EXATAMENTE em 2 ponderadas, folga estrutural EXATAMENTE 1 e todos
  * os dias com o orçamento cheio, e isso reprovava qualquer melhoria legítima. Os números dele
  * ficam abaixo como EVIDÊNCIA da candidata `4533310`, não como comportamento obrigatório.
  *
  * 🔑 O QUE MUDOU NESTA VOLTA, medido: a repartição das séries DENTRO do grupo deixou de sair
  * uniforme por artefato do round-robin, e o bíceps deste perfil subiu de 2,0 para 2,5
  * ponderadas na semana 3 — sem exercício direto ainda, e sem que nada mais mudasse.
  *
  * 🔬 POR QUE OS 6 NÃO SAEM, medido em 2026-09-20 e reproduzido:
  *  · 6,0 com direto exige 3 diretas (teto de séries por exercício do iniciante) + 3,0
  *    indiretas, e as 3,0 indiretas exigem que as DUAS remadas levem 6 das 8 séries de costas;
  *  · isso cabe em 30 min com os descansos INTACTOS — medido: 1310/1770/1750/1390 s contra
  *    1800 s — num arranjo de 4+5 slots;
  *  · mas o arranjo que o motor gera para chegar lá derruba o descanso do dia do piso de
  *    180 s para 120 s, porque o dia termina com 12 séries (costas 6 + peito 3 + bíceps 3) e
  *    30 min a 180 s comportam ~10. O autor NÃO autorizou encurtar descanso, e a guarda do
  *    slot extra do piso DF② devolve o arranjo inteiro por isso.
  *
  * 📌 Evidência da candidata `4533310` (NÃO é contrato): 4 dias × `orcamentoSlotsDoDia(30)` = 16
  * slots, todos ocupados; folga estrutural de 1 slot; bíceps 2,0, todas indiretas.
  */
 it.todo('🔴 PENDENTE (autor 2026-09-20): bíceps ≥ 6 ponderadas COM exercício direto na semana 3, preservando dose, cobertura, funções, descansos e os 30 min');
});
