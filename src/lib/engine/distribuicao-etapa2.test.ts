import {verificarImpedimentoRecortes} from './__fixtures__/recortes-viabilidade';
import {adicoesComplementaresViaveis} from './__fixtures__/complementares-viabilidade';
import {describe,it,expect} from 'vitest';
import {freqMaxPorGrupo} from './treino-retomada';
import {creditoPonderadoDaSemana} from './alocador';
import {gerarTreino} from './index';
import {EXERCISES} from '../data/exercises';
import {ORDEM_SEMANA, type Weekday} from '../semana';
import type {PerfilTreino} from './treino-types';
const base:PerfilTreino={pesoKg:80,alturaCm:180,idade:30,flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false},objetivo:'massa',nivelExperiencia:'avancado',equipamento:'academia',diasDisponiveis:3,tempoPorSessaoMin:90};
const agendas:Record<number,Weekday[]>={1:['seg'],2:['seg','qui'],3:['seg','qua','sex'],4:['seg','ter','qui','sex'],5:['seg','ter','qua','sex','sab'],6:['seg','ter','qua','qui','sex','sab'],7:[...ORDEM_SEMANA]};
function run(n:number,f?:'bracos'|'pernas'|'peito'|'costas'|'antebraco',over:Partial<PerfilTreino>={}){return gerarTreino({...base,diasDisponiveis:n,treinoDias:agendas[n],...(f==='bracos'||f==='pernas'?{focoAgregado:{grupo:f,semana:1}}:f?{foco:{grupo:f,compensa:f==='peito'?'costas':'peito',semana:1}}:{}),...over},{exercises:EXERCISES,semanaCiclo:{semana:1}}).rotina!;}
const grupos=(r:ReturnType<typeof run>)=>r.dias.map(d=>d.slots.map(s=>s.exercicio.grupoPrimario));
/**
 * 🔵 2026-09-17 — a recusa do bloco do foco passou a NOMEAR a restrição (teto da semana,
 * teto de um treino só, ou os dois). A regex acompanha as três formas.
 */
const RECUSA_EXPLICADA=/acima d[oa]s? (m[áa]ximo|limites)|j[áa] est[áa] n[oa]s? (m[áa]ximo|limites)/;
describe('etapa2: possibilidades na saída final',()=>{
 it('3 sem foco: Upper/Lower/Upper, sem separar peito e costas',()=>{
  const gs=grupos(run(3));expect(gs.filter(g=>g.includes('quadriceps')||g.includes('posterior'))).toHaveLength(1);
  expect(gs.filter(g=>g.includes('peito')&&g.includes('triceps')&&g.includes('costas'))).toHaveLength(2);
  expect(gs.flat()).toContain('ombros');
 });
 it('3 braços: foco preserva Upper/Lower e braços antes dos compostos',()=>{
  const r=run(3,'bracos'),gs=grupos(r);
  const superiores=gs.filter(g=>g.includes('peito'));
  expect(superiores).toHaveLength(2);
  for(const g of superiores){
   expect(['biceps','triceps']).toContain(g[0]);
   expect(g).toEqual(expect.arrayContaining(['costas','biceps','triceps']));
  }
  expect(gs.flat()).toEqual(expect.arrayContaining(['quadriceps','posterior','ombros']));
 });
 /**
  * 🔵 REANCORADO em 2026-09-15 — a SEGUNDA sessão do grupo focado é a entrega do bloco, e o
  * bloco agora para no MRV (cofre `motor-treino-grupo-em-foco-x-mrv`, claims --005/--010).
  * Onde o grupo já está no teto, a segunda sessão não existe — e o que o foco entrega é
  * ORDEM, que é a saída que a mesma DF previu (claim --006). O caso continua exigindo a
  * segunda sessão SEMPRE que houve entrega, e cobra a explicação quando não houve.
  */
 it.each([4,5,6])('%i peito/costas: sessões reais do foco e diferença estrutural',n=>{
  for(const [foco,rot] of [['peito','peito'],['costas','costas']] as const){
   const r=run(n,foco);
   const gs=grupos(r);
   const entregues=(r.blocoFoco?.adicionais??[]).length;
   if(entregues>0)expect(gs.filter(g=>g.includes(rot)),`${n}d/${foco}: bloco entregue sem segunda sessão`).toHaveLength(2);
   else expect(r.avisos.some(a=>RECUSA_EXPLICADA.test(a)),`${n}d/${foco}: sem segunda sessão e sem explicação: ${r.avisos.join(' | ')}`).toBe(true);
  }
  const p=grupos(run(n,'peito')),c=grupos(run(n,'costas'));
  expect(p).not.toEqual(c);
  for(const g of [p,c])expect(g.flat()).toEqual(expect.arrayContaining(['peito','costas','quadriceps','posterior','ombros','biceps','triceps']));
 });
 it('anti-vacuidade: em alguma agenda o foco ainda entrega a segunda sessão',()=>{
  const comSegunda=[4,5,6].filter(n=>(run(n,'peito').blocoFoco?.adicionais??[]).length>0);
  expect(comSegunda.length,'o bloco deixou de entregar em TODAS as agendas — o caso acima seria vazio').toBeGreaterThan(0);
 });
 it.each([4,5])('%i pernas: duas ênfases e dois superiores separados',n=>{
  const r=run(n,'pernas'),gs=grupos(r);
  const pernas=gs.filter(g=>g.includes('quadriceps')||g.includes('posterior'));
  /**
   * 🔵 2026-09-20 — a régua deixou de ser "exatamente dois dias inferiores".
   *
   * O que este caso cobra é ÊNFASES DISTINTAS no terminal: um dia com ênfase em quadríceps e
   * outro em posterior. Até 19/09 a agenda de 7 dias era cortada em 6 e isso coincidia com
   * exatamente dois dias inferiores; com a decisão do autor a mesma agenda entrega 7 sessões e
   * TRÊS dias tocam pernas — os dois recortes estão lá, e mais um. Exigir "== 2" passou a
   * reprovar justamente o caso que atende melhor. A asserção passa a cobrar o que o título diz,
   * e fica mais forte: as duas ênfases têm de ser distintas de verdade.
   */
  if(pernas.length<2)verificarImpedimentoRecortes(run(n),r,7);
  else{
    const soQuad=gs.some(g=>g.includes('quadriceps')&&!g.includes('posterior'));
    const soPost=gs.some(g=>g.includes('posterior')&&!g.includes('quadriceps'));
    expect(soQuad&&soPost,`ênfases não distintas em ${n} dias: ${JSON.stringify(gs)}`).toBe(true);
  }
  expect(gs.some(g=>g.includes('peito')&&!g.includes('costas'))).toBe(true);
  expect(gs.some(g=>g.includes('costas')&&!g.includes('peito'))).toBe(true);
  expect(gs.flat()).toContain('ombros');
 });
 it('3 pernas: foco conserva o Lower completo e os dois Upper da semana ímpar',()=>{
  const r=run(3,'pernas'),gs=grupos(r);
  expect(r.split).toBe('Upper / Lower / Upper');
  expect(gs.filter(g=>g.includes('peito')&&g.includes('costas'))).toHaveLength(2);
  expect(gs.filter(g=>g.includes('quadriceps')&&g.includes('posterior')&&g.includes('gluteos'))).toHaveLength(1);
 });
 // Em três dias a alternância aprovada substitui as duas ênfases segmentadas.
 it.each([4,5,6,7])('%i pernas: ênfases distintas no terminal, com derivados preservados',n=>{
  const r=run(n,'pernas'),f=grupos(r);
  // Primários documentais do catálogo; não exige exclusividade anatômica.
  const inferiores=f.filter(g=>g.includes('quadriceps')||g.includes('posterior'));
  // 🔵 2026-09-20: `< 2`, não `!== 2`. Com 7 dias marcados a agenda entrega 7 sessões e TRÊS
  // dias tocam pernas; os dois recortes estão lá, e mais um. A prova de impossibilidade só faz
  // sentido quando FALTA dia inferior — a distinção das ênfases é conferida logo abaixo, em
  // `separou`, que é a asserção que este caso de fato carrega.
  if(inferiores.length<2)verificarImpedimentoRecortes(run(n),r,7);
  /**
   * 🔴 L-03 (revisão independente 15/09) — A ASSERÇÃO NÃO DEPENDE MAIS DO AVISO DO MOTOR.
   * Antes, a verificação dos recortes era PULADA quando o próprio código sob teste emitia
   * "Mantivemos a distribuição disponível": a saída do motor virava premissa e, sem
   * anti-vacuidade, a asserção podia nunca rodar. Agora a estrutura é medida primeiro e o
   * aviso é CONFERIDO contra ela — separou ⇒ sem aviso; não separou ⇒ aviso obrigatório.
   */
  const separou=inferiores.some(g=>g[0]==='quadriceps'&&!g.includes('posterior'))
    &&inferiores.some(g=>g[0]==='posterior'&&!g.includes('quadriceps'));
  const avisou=r.avisos.some(a=>a.startsWith('Mantivemos a distribuição disponível'));
  expect(avisou,`recortes ${separou?'separados':'NÃO separados'}, aviso ${avisou?'presente':'ausente'}`).toBe(!separou);
  expect(f.flat()).toEqual(expect.arrayContaining(['gluteos','ombros','peito','costas']));
  if(!f.flat().includes('panturrilha')){
    const p:PerfilTreino={...base,diasDisponiveis:n,treinoDias:agendas[n],focoAgregado:{grupo:'pernas',semana:1}};
    const alternativas=([1,2,3,4,5] as const).map(semana=>adicoesComplementaresViaveis(gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!,p,'panturrilha'));
    expect(alternativas[0]!.filter(x=>alternativas.every(a=>a.includes(x)))).toEqual([]);
  }
  expect(r.distribuicao).toMatchObject({recortesPlanejados:2,recortesEntregues:separou?2:1});
 });
 /**
  * 🔵 2026-09-19 — antebraço é COMPLEMENTAR e entra em toda divisão com dia de superiores
  * livre (um complementar por dia), com ou sem foco. A redação anterior exigia que SEM foco
  * ele ficasse fora (DF② de 2026-08-12: só indireto); a decisão do autor de 2026-09-19 a
  * substitui: "não omita antebraço silenciosamente". Continua sem dia exclusivo.
  */
 it('antebraço: bloco direto com e sem foco explícito, sempre num dia compartilhado',()=>{
  const f=grupos(run(4,'antebraco'));expect(f.some(g=>g.includes('antebraco')&&g.length>1)).toBe(true);
  const s=grupos(run(4));expect(s.some(g=>g.includes('antebraco')&&g.length>1)).toBe(true);
  expect(s.some(g=>g.length>0&&g.every(x=>x==='antebraco'))).toBe(false);
 });
});

describe('etapa2: contratos no seletor atual, sem fixture histórica',()=>{
 it('banda ponderada no caso intermediário de 4 dias é preservada',()=>{
  const r=run(4,undefined,{nivelExperiencia:'intermediario',tempoPorSessaoMin:60});
  const creditos=creditoPonderadoDaSemana(r.dias.flatMap(d=>d.slots));
  for(const g of ['peito','costas'] as const)expect(creditos.get(g)).toBeLessThanOrEqual(16);
 });
 it('manual preserva ids, ordem, dia e séries apesar de foco/agenda diferentes',()=>{
  const rotinaCustom={origem:'usuario' as const,dias:[{nome:'Meu',diaId:'sex' as const,exercicioIds:['e1','e11'],seriesPorExercicio:{e1:3,e11:2}}]};
  const r=run(1,'bracos',{rotinaCustom});expect(r.dias).toHaveLength(1);
  expect(r.dias[0]!.diaId).toBe('sex');expect(r.dias[0]!.slots.map(s=>[s.exercicio.id,s.series])).toEqual([['e1',3],['e11',2]]);
  expect(r.distribuicao).toBeUndefined();expect(rotinaCustom.dias[0]!.exercicioIds).toEqual(['e1','e11']);
 });
 it('7 dias conserva teto de força e oferece recuperação',()=>{
  const r=run(7,'peito');
  // O dia já escolhido pode ser dedicado aos complementares (autor 19/09).
  const principais=r.dias.filter(d=>d.slots.some(s=>!['core','antebraco','panturrilha','lombar'].includes(s.exercicio.grupoPrimario??'')));
  expect(principais.length).toBeLessThanOrEqual(6);
  expect(r.dias.length+r.diasCardioRecuperacao+(r.diasNaoAtendidos?.length??0)).toBe(7);
  /**
   * 🔵 2026-09-17 — a segunda sessão do foco depende de o bloco ENTRAR, e com os dois tetos
   * valendo ao mesmo tempo ele pode ser recusado. A propriedade é a mesma do caso acima:
   * entregou ⇒ duas sessões; não entregou ⇒ a tela DIZ por quê. Antes o teste afirmava as
   * duas sessões sem condição, o que hoje seria cobrar uma entrega que a política recusa.
   */
  const entregues=(r.blocoFoco?.adicionais??[]).length;
  if(entregues>0)expect(grupos(r).filter(g=>g.includes('peito'))).toHaveLength(2);
  else expect(r.avisos.some(a=>RECUSA_EXPLICADA.test(a)),`sem segunda sessão e sem explicação: ${r.avisos.join(' | ')}`).toBe(true);
 });
 it('focos individuais, restrições e equipamento: presença real ou limite dito',()=>{
  for(const grupo of ['ombros','biceps','triceps','quadriceps','posterior','gluteos','panturrilha','core','antebraco'] as const)
  for(const n of [1,2,3,4,5,6,7])for(const equipamento of ['academia','nenhum'] as const){
   const r=run(n,undefined,{equipamento,tempoPorSessaoMin:20,foco:{grupo,compensa:'peito',semana:1},preferencias:{banidos:['e1'],trocas:[]}});
   expect(r.dias.flatMap(d=>d.slots).some(s=>s.exercicio.id==='e1')).toBe(false);
   if(!grupos(r).flat().includes(grupo))expect(r.avisos.some(a=>a.includes('foco não foi atendido'))).toBe(true);
   if(r.distribuicao&&!r.distribuicao.atendida)expect(r.avisos.some(a=>a.startsWith('Distribuição planejada'))).toBe(true);
  }
 });
 it('deload reduz volume real com as divisões novas, todos os níveis/dias/focos',()=>{
  for(const n of [1,2,3,4,5,6,7])for(const nivelExperiencia of ['iniciante','intermediario','avancado'] as const)
  for(const f of [undefined,'bracos','pernas','peito'] as const){
   const perfil={...base,diasDisponiveis:n,treinoDias:agendas[n],nivelExperiencia,...(f==='bracos'||f==='pernas'?{focoAgregado:{grupo:f,semana:1}}:f?{foco:{grupo:f,compensa:'ombros' as const,semana:1}}:{})};
   const a=gerarTreino(perfil,{exercises:EXERCISES,semanaCiclo:{semana:5}}).rotina!;
   const b=gerarTreino(perfil,{exercises:EXERCISES,semanaCiclo:{semana:6}}).rotina!;
   const soma=(r:typeof a)=>r.dias.flatMap(d=>d.slots).reduce((v,s)=>v+(s.series??0),0);
   expect(soma(b),JSON.stringify({n,nivelExperiencia,f})).toBeLessThan(soma(a));
  }
 });
 it('retomada mantém frequência por sessão e sinaliza adaptação',()=>{
  const r=gerarTreino({...base,diasDisponiveis:6,treinoDias:agendas[6],focoAgregado:{grupo:'bracos',semana:1}},{exercises:EXERCISES,semanaCiclo:{semana:3,retomada:{semana:1,fator:0.5,volumeReferencia:14}}}).rotina!;
  const gs=grupos(r);for(const g of new Set(gs.flat()))expect(gs.filter(xs=>xs.includes(g)).length).toBeLessThanOrEqual(freqMaxPorGrupo(1));
  expect(r.distribuicao).toMatchObject({adaptada:true,atendida:false});
 });
});


describe('rodada2: contratos quantitativos, seletor real',()=>{
 it.each([1,2,3,4,5] as const)('banda existente no terminal, semana %i',semana=>{
  const p={...base,nivelExperiencia:'intermediario' as const,diasDisponiveis:4,tempoPorSessaoMin:60};
  const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
  const c=creditoPonderadoDaSemana(r.dias.flatMap(d=>d.slots));
  for(const g of ['peito','costas'] as const)expect(c.get(g)).toBeLessThanOrEqual(16);
 });
 it.each([{semana:2,tempo:45,divisao:'superior-inferior'},{semana:3,tempo:45,divisao:'superior-inferior'},{semana:2,tempo:90,divisao:'superior-inferior'},{semana:3,tempo:90,divisao:'superior-inferior'},{semana:2,tempo:90,divisao:'prioridades'},{semana:3,tempo:90,divisao:'prioridades'}] as const)('adição em $divisao: S$semana, $tempo min, preservação de terceiros',({semana,tempo,divisao})=>{
  // Caminho explícito suportado pelo seletor atual, sem simular o seletor antigo.
  /**
   * 🔵 PERFIL REMEDIDO em 2026-09-19 (exclusão do improviso doméstico na academia): a 75 min
   * sem limite o peito deste perfil passou a encostar no teto e o bloco não entrega mais nada
   * — as igualdades abaixo virariam triviais. A varredura desta correção achou 459 células que
   * entregam o bloco nas DUAS semanas (2 e 3); esta é a mais próxima da anterior, mudando só
   * o tempo por sessão.
   */
  const p:PerfilTreino={...base,nivelExperiencia:'intermediario',diasDisponiveis:4,tempoPorSessaoMin:tempo,limiteTempoTreino:'limitado',divisaoPreferida:divisao,treinoDias:['seg','ter','qui','sex']};
  const run=(p:PerfilTreino)=>gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
  const a=run(p),b=run({...p,foco:{grupo:'peito',compensa:'triceps',semana:1}});
  const totais=(r:typeof a)=>{const m=new Map<string,number>();for(const d of r.dias)for(const s of d.slots){const g=s.exercicio.grupoPrimario!;m.set(g,(m.get(g)??0)+(s.series??0));}return m;};
  const x=totais(a),y=totais(b);
  // 🔵 2026-09-15: o `+4` literal virou "exatamente o que o bloco declarou entregar". O bloco
  // agora para no MRV (teto duro do cofre), então o delta é 4 onde há folga e menos onde não
  // há — mas continua EXATO, e continua sem cobrar de terceiro nenhum.
  const entregue=(b.blocoFoco?.adicionais??[]).reduce((n,i)=>n+i.series,0);
  // 45 min preserva a reprodução sem folga; 90 min mantém a prova positiva
  // nas duas semanas, sem alterar as igualdades de terceiros nem os tetos.
  if(divisao==='prioridades')expect(entregue,`S${semana}: bloco vazio — as igualdades abaixo seriam triviais`).toBeGreaterThan(0);
  else expect(entregue).toBe(0);
  expect(y.get('peito')).toBe(x.get('peito')!+entregue);
  expect([...y.values()].reduce((a,b)=>a+b,0)).toBe([...x.values()].reduce((a,b)=>a+b,0)+entregue);
  expect([...new Set([...x.keys(),...y.keys()])].filter(g=>x.get(g)!==y.get(g)).sort()).toEqual(entregue>0?['peito']:[]);
  // 🔵 2026-09-17 — o teto do FOCADO é o CHEIO, não o topo da faixa desejada: é exatamente a
  // margem que a decisão deu a ele. `faixaVolumeSemana.max` virou o alvo, e não serve de limite.
  const t=b.tetoVolumeSemana!;
  expect(t.gruposEmFoco).toContain('peito');
  expect(creditoPonderadoDaSemana(b.dias.flatMap(d=>d.slots)).get('peito')).toBeLessThanOrEqual(t.cheio);
 });
});
