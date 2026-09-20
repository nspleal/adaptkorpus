import {describe,it,expect} from 'vitest';
import {gerarTreino} from './index';
import {EXERCISES} from '../data/exercises';
import {creditoPonderadoDaSemana,orcamentoSlotsDoDia} from './alocador';
import {tetoSeriesPorExercicio} from './trilhos';
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
  expect(r.duracaoDias!.every(d=>d.estadoCalculo==='CALCULADO'&&d.duracaoMaximaEstimadaSegundos!<=1800)).toBe(true);
  const dias=fixture().map(d=>({nome:d.nome,diaId:d.diaId,exercicioIds:d.slots.map(s=>s.exercicio.id)}));
  const m=gerarTreino({...p,rotinaCustom:{origem:'usuario',dias}},{exercises:EXERCISES,semanaCiclo:{semana:3}}).rotina!;
  expect(m.dias.map(d=>d.slots.map(s=>s.exercicio.id))).toEqual(dias.map(d=>d.exercicioIds));
 });

 /**
  * 🔴 A EXIGÊNCIA PEDIDA — bíceps ≥ 6 ponderadas COM exercício direto — E POR QUE ELA NÃO CABE
  * NESTE PERFIL. Medido em 2026-09-20; nada aqui é estimativa.
  *
  * 🔑 A restrição é de ORÇAMENTO, não de seleção. O perfil tem 4 dias × `orcamentoSlotsDoDia(30)`
  * = 16 slots, e todos estão ocupados por grupos principais. A única FOLGA estrutural da semana é
  * um slot: as costas carregam 8 séries diretas em 4 slots quando 3 bastariam (3+3+2, no teto de
  * séries por exercício do nível). Dando essa folga ao bíceps, ele chega a `sMax` diretas mais o
  * indireto que as remadas já dão — e isso não alcança 6. Seis exigiriam um SEGUNDO slot, que só
  * pode sair de um grupo sem folga: a dose dele cairia.
  *
  * 🔬 As quatro composições medidas nesta rodada (iniciante/academia/massa/4d/30min, semana 3),
  * todas por varredura de 120 perfis para conferir o efeito colateral:
  *  | composição                                   | costas | ts | peito | ombros | bíceps | pernas |
  *  |----------------------------------------------|--------|----|-------|--------|--------|--------|
  *  | vigente                                      |  9,5   | ✓  |   6   |   6    | 2 (0 diretos) | intactas |
  *  | piso do pequeno liberado (reserva DF② a 3)    |  8     | ✓  | **3** | **3**  | 5      | intactas |
  *  | + trava de puxar fiel + uma reserva só        |  9,5   | ✗  |   6   |   6    | 5,5    | intactas |
  *  | divisão desenhada (sem o ramo `adaptada`)     |  9,5   | ✓  |   8   |   8    | 4,5    | **quadríceps 8→6, glúteos 9→4,5, posterior 9,5→4,5** |
  *
  * Nenhuma alcança 6, e cada uma cobra o preço numa coluna protegida. A decisão fica com o
  * autor: sem mudar o orçamento de 30 min ou o teto de séries por exercício do iniciante, 6
  * ponderadas de bíceps só existem tirando dose de peito, ombros ou pernas.
  */
 it('🔴 a restrição medida: 6 ponderadas de bíceps não cabem em 16 slots de 30 min',()=>{
  const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:3}}).rotina!;
  const ss=r.dias.flatMap(d=>d.slots),c=creditoPonderadoDaSemana(ss);
  const teto=orcamentoSlotsDoDia(p.tempoPorSessaoMin!),sMax=tetoSeriesPorExercicio(p.nivelExperiencia);
  // ① o orçamento inteiro está ocupado — não há slot livre para acrescentar nada.
  expect(r.dias).toHaveLength(4);
  expect(r.dias.map(d=>d.slots.length),'sobrou slot no dia: a restrição mudou').toEqual([teto,teto,teto,teto]);
  // ② a FOLGA estrutural da semana: slots além do mínimo que a dose de cada grupo exige.
  const porGrupo=new Map<string,{slots:number;series:number}>();
  for(const s of ss){const g=s.exercicio.grupoPrimario!;const v=porGrupo.get(g)??{slots:0,series:0};
    porGrupo.set(g,{slots:v.slots+1,series:v.series+(s.series??0)});}
  const folga=[...porGrupo.values()].reduce((n,v)=>n+(v.slots-Math.ceil(v.series/sMax)),0);
  expect(folga,'a folga estrutural mudou: remeça a restrição').toBe(1);
  // ③ com a folga inteira o bíceps não chega a 6: um slot no teto do nível + o indireto de hoje.
  expect(c.get('biceps'),'o bíceps ganhou direto: remeça a restrição').toBe(2);
  expect(sMax+(c.get('biceps')??0),'6 ponderadas caberiam agora — refaça a distribuição').toBeLessThan(6);
 });
});