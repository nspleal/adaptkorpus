import {describe,it,expect} from 'vitest';
import {gerarTreino} from './index';
import {EXERCISES} from '../data/exercises';
import {ORDEM_SEMANA,type Weekday} from '../semana';
import type {PerfilTreino,RotinaSemanal} from './treino-types';
import {altaExigenciaDocumental,descansoDoExercicio} from './descanso';
import {creditoPonderadoDaSemana,GRUPOS_GRANDES,GRUPOS_PEQUENOS_PISO} from './alocador';
const base:PerfilTreino={pesoKg:80,alturaCm:180,idade:30,flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false},objetivo:'massa',nivelExperiencia:'avancado',equipamento:'academia',diasDisponiveis:3,tempoPorSessaoMin:75,limiteTempoTreino:'sem_limite'};
const agendas:Weekday[][]=[['seg'],['dom','seg'],['seg','qui'],['seg','qua','sex'],['seg','ter','qui','sex'],['seg','ter','qua','sex','sab'],['seg','ter','qua','qui','sex','sab'],[...ORDEM_SEMANA]];
const run=(agenda:Weekday[],over:Partial<PerfilTreino>={},semana:1|5|6=1)=>gerarTreino({...base,...over,treinoDias:agenda,diasDisponiveis:agenda.length},{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
const slots=(r:RotinaSemanal)=>r.dias.flatMap(d=>d.slots);
/** 🔵 As frases de recusa/aparo do bloco do foco, nas duas restrições (semana e sessão). */
const RECUSA_OU_APARO=/(j[áa] est[áa] n[oa] m[áa]ximo|nos limites desta semana|levaria .* acima d[oa] m[áa]ximo|levaria .* acima dos limites)/;
describe('etapa3: plano concreto',()=>{
 it('um dia cobre cada grupo direto uma vez; foco tem dois exercícios no total',()=>{
  for(const foco of [undefined,{grupo:'peito' as const,compensa:'triceps' as const,semana:1}]){
   const r=run(['seg'],{foco});
   const grupos=slots(r).map(s=>s.exercicio.grupoPrimario);
   for(const g of [...GRUPOS_GRANDES,...GRUPOS_PEQUENOS_PISO].filter(g=>g!=='panturrilha'))expect(grupos.filter(x=>x===g).length,g).toBe(g==='costas'||g===foco?.grupo?2:1);
   expect(grupos.filter(g=>['core','antebraco','panturrilha'].includes(g??'')).length).toBeLessThanOrEqual(1);
   expect(grupos).not.toContain('lombar');expect(grupos).not.toContain('antebraco');
  }
 });
 /**
  * 🔴 Revisão 15/09 — a comparação passou a ser de CONTEÚDO (id, séries e descanso), não de
  * posição. A ordem dentro do dia é governada por outra regra aprovada — "o grupo focado vem
  * primeiro dentro da classe" (B2/C6, cobrada em trilhos.test.ts) —, e com a guarda de padrão
  * fora o extra do foco pode ser um COMPOSTO, o que muda a posição relativa dos demais no dia
  * que recebeu o bloco. Séries, descanso e a identidade de cada exercício continuam exigidos
  * um a um: nada do baseline pode sumir, encolher ou trocar de descanso por causa do foco.
  */
 const baselineFora=(r:RotinaSemanal,grupo:string)=>r.dias.map(d=>({dia:d.diaId,
   slots:d.slots.filter(s=>s.exercicio.grupoPrimario!==grupo).map(s=>`${s.exercicio.id}:${s.series}:${s.descansoSeg}`).sort()}));
 it.each(agendas)('sem limite preserva o baseline dos outros grupos e recuperação em %j',(...agenda)=>{
  const dias=agenda as Weekday[];
  const neutro=run(dias),foco=run(dias,{foco:{grupo:'peito',compensa:'triceps',semana:1}});
  expect(baselineFora(foco,'peito')).toEqual(baselineFora(neutro,'peito'));
  expect(foco.resultadoGeracao?.tipo).not.toBe('ERRO_ALOCADOR');
  for(const a of foco.dias)for(const b of foco.dias){
   const delta=Math.abs(ORDEM_SEMANA.indexOf(a.diaId!)-ORDEM_SEMANA.indexOf(b.diaId!));
   if(delta===1||delta===6)expect(a.slots.some(s=>b.slots.some(t=>t.exercicio.grupoPrimario===s.exercicio.grupoPrimario))).toBe(false);
  }
 });
 /**
  * 🔴 D-01/D-02 (revisão independente) — A MESMA PRESERVAÇÃO COM TEMPO LIMITADO.
  * Era exatamente a região que a suíte do candidato tinha abandonado ao mover as fixtures
  * para `sem_limite`. Aqui o tempo aperta de verdade e o baseline continua intocado; o que
  * cede é o bloco adicional, até desaparecer. Falha no candidato badcea47.
  */
 it.each([20,30,45,60] as const)('tempo LIMITADO de %i min preserva o baseline dos outros grupos',tempo=>{
  let comBloco=0,semBloco=0;
  for(const dias of agendas){
   const over={tempoPorSessaoMin:tempo,limiteTempoTreino:'limitado' as const};
   const neutro=run(dias,over),foco=run(dias,{...over,foco:{grupo:'costas',compensa:'peito',semana:1}});
   const rotulo=`${tempo}min ${dias.join('+')}`;
   const extrasDoDia=(d:{diaId?:Weekday;slots:{exercicio:{id:string}}[]})=>
     (foco.blocoFoco?.adicionais??[]).filter(a=>a.diaId===d.diaId&&d.slots.some(s=>s.exercicio.id===a.exercicioId)).length;
   for(const d of neutro.dias){
    const f=foco.dias.find(x=>x.diaId===d.diaId)!;
    const ids=(slotsDoDia:typeof d.slots)=>slotsDoDia.filter(s=>s.exercicio.grupoPrimario!=='costas').map(s=>`${s.exercicio.id}:${s.series}`).sort();
    // Exercícios e séries do baseline: SEMPRE idênticos ao plano sem foco.
    expect(ids(f.slots),`${rotulo} ${d.diaId}`).toEqual(ids(d.slots));
    // Descanso: idêntico também, salvo no dia em que um extra sobreviveu — ali a decisão 6
    // manda o descanso ceder ANTES de qualquer exercício, e o piso por classe segue valendo.
    const desc=(slotsDoDia:typeof d.slots)=>slotsDoDia.filter(s=>s.exercicio.grupoPrimario!=='costas').map(s=>`${s.exercicio.id}:${s.descansoSeg}`).sort();
    if(extrasDoDia(f)===0)expect(desc(f.slots),`${rotulo} ${d.diaId} sem extra sobrevivente`).toEqual(desc(d.slots));
    else expect(f.slots.every(s=>(s.descansoSeg??0)>=60)).toBe(true);
   }
   const extras=foco.blocoFoco?.adicionais.length??0;
   if(extras>0)comBloco+=1;else semBloco+=1;
   // O ganho líquido do grupo focado é EXATAMENTE o que o bloco declara ter entregue.
   const series=(r:RotinaSemanal)=>slots(r).filter(s=>s.exercicio.grupoPrimario==='costas').reduce((n,s)=>n+(s.series??0),0);
   expect(series(foco)-series(neutro),rotulo).toBe((foco.blocoFoco?.adicionais??[]).reduce((n,a)=>n+a.series,0));
  }
  // Anti-vacuidade: em cada tempo a matriz tem de conter agenda com e sem bloco sobrevivente
  // — senão o teste poderia passar só porque o foco nunca entregou nada.
  expect(comBloco+semBloco,'nenhuma agenda foi avaliada').toBe(agendas.length);
  // A anti-vacuidade vale dos 30 min para cima, onde o bloco tem de chegar ao plano.
  //
  // 🔵 REANCORADO em 2026-09-17: aos 20 min a asserção era `semBloco === agendas.length`,
  // isto é, «o bloco morre em TODAS as agendas». Com a sequência aprovada o baseline dos
  // 20 min cede séries antes de perder exercício, e numa das agendas isso abriu espaço para
  // o bloco sobreviver (7 de 8, não 8 de 8). O que continua exato — e é o que se cobra — é
  // que aos 20 min a ELIMINAÇÃO do bloco acontece, e na maioria das agendas: o caminho de
  // eliminação segue exercido. As provas de baseline acima valem em todas elas.
  // 🔵 2026-09-19: com a seleção por referência (compostos de 120–180 s no lugar de isolados)
  // o dia de 30 min fecha sem espaço para o extra em todas as agendas; o bloco volta a caber
  // dos 45 min para cima (3 de 8 agendas). Aos 20 e 30 a eliminação é a regra exercida.
  if(tempo>=45)expect(comBloco,`nenhum bloco sobreviveu em ${tempo}min — o caso não discrimina`).toBeGreaterThan(0);
  else{
   expect(semBloco,'20 min deixou de eliminar o bloco: o caminho de eliminação não é exercido').toBeGreaterThan(0);
   expect(semBloco,'aos 20 min a eliminação deixou de ser a regra').toBeGreaterThan(agendas.length/2);
  }
 });
 /**
  * 🔵 REANCORADO em 2026-09-15 — o baseline de terceiros continua INTOCADO (a propriedade
  * central deste caso). O que passou a variar é o tamanho do bloco: nas agendas de 6 e 7 dias
  * o posterior já chega ao MRV no baseline, e o componente dele é recusado pelo teto duro
  * (`motor-treino-grupo-em-foco-x-mrv`). Onde há folga, o bloco continua sendo 2 × 2.
  */
 it('pernas: recortes reaproveitam todo o baseline de outros grupos; o bloco para no teto',()=>{
  let comDois=0,comUm=0;
  for(const {agenda,over} of [...agendas.slice(3).map(agenda=>({agenda,over:{} as Partial<PerfilTreino>})),{agenda:['seg','qua','sex'] as Weekday[],over:{nivelExperiencia:'iniciante',tempoPorSessaoMin:60,limiteTempoTreino:'limitado'} as Partial<PerfilTreino>}]){
   const a=run(agenda,over),b=run(agenda,{...over,focoAgregado:{grupo:'pernas',semana:1}});
   const assinatura=(r:RotinaSemanal)=>slots(r).filter(s=>!['quadriceps','posterior'].includes(s.exercicio.grupoPrimario!)).map(s=>`${s.exercicio.id}:${s.series}`).sort();
   const antigos=assinatura(a),novos=assinatura(b);
   for(const item of antigos)expect(novos,`${agenda.join('-')}: terceiro removido`).toContain(item);
   for(const item of novos.filter(x=>!antigos.includes(x))){
    const e=EXERCISES.find(e=>e.id===item.split(':')[0])!;
    expect(['core','panturrilha','antebraco']).toContain(e.grupoPrimario);
   }
   const entregues=b.blocoFoco?.adicionais??[];
   expect(entregues.every(s=>s.series===2),`${agenda.join('-')}: série do extra fora do nominal`).toBe(true);
   expect(b.blocoFoco?.solicitados,'a INTENÇÃO do bloco continua sendo 2').toBe(2);
   if(entregues.length===2)comDois+=1;
   else{
    if(entregues.length===1)comUm+=1;
    /**
     * 🔵 2026-09-17 — o teto deixou de ser um número só. A recusa parcial é aceitável quando
     * um componente encosta no teto SEMANAL do porte dele (cheio para quem está em foco) OU no
     * teto da SESSÃO, que vale ao mesmo tempo. A redação anterior lia `faixaVolumeSemana.max`,
     * que hoje é o ALVO desejado — não um limite.
     */
    const t=b.tetoVolumeSemana!;
    const emFoco=(g:string)=>t.gruposEmFoco.includes(g as never);
    const c=creditoPonderadoDaSemana(slots(b));
    const noTetoSemanal=['quadriceps','posterior'].some(g=>(c.get(g as never)??0)>=(emFoco(g)?t.cheio:t.semFoco));
    const noTetoSessao=t.sessao!=null&&b.dias.some(d=>{
      const nd=creditoPonderadoDaSemana(d.slots);
      return ['quadriceps','posterior'].some(g=>(nd.get(g as never)??0)>=t.sessao!);
    });
    expect(noTetoSemanal||noTetoSessao,`${agenda.join('-')}: bloco encolheu sem ninguém no teto`).toBe(true);
    expect(b.avisos.some(x=>RECUSA_OU_APARO.test(x)),`${agenda.join('-')}: recusa sem explicação`).toBe(true);
   }
  }
  // 🔵 2026-09-19: com a extensora ao lado do agachamento e a flexora ao lado do stiff, o
  // quadríceps chega ao teto de um treino só antes do extra em todas as agendas; o componente
  // de posterior continua entrando (1 de 2) e a recusa do outro é dita — é isso que se cobra.
  expect(comDois+comUm,'nenhuma agenda entregou componente algum do bloco — o caso deixou de discriminar').toBeGreaterThan(0);
 });
 /**
  * 🔴 DECISÃO REVERTIDA em 2026-09-15 — este caso afirmava o CONTRÁRIO e precisa ser lido junto
  * com o histórico, não apagado.
  *
  * Redação anterior: *"extras podem exceder MRV conforme decisão explícita 14/09, sem
  * compensação"*, cobrando `n(b) === n(a)+4` **e** `n(b) > 16`.
  *
  * ⚠️ CONFLITO MATERIAL, explicitado: essa decisão de 14/09 contradiz uma decisão anterior e
  * ainda vigente do cofre (`motor-treino-grupo-em-foco-x-mrv`, claims --005/--010/--011, todos
  * `confirmed`): *"o foco sobe até o MRV do nível e PARA"*, *"o teto duro continua duro"*, e a
  * alternativa de elevar o teto durante o foco foi **recusada** — *"transformaria o único
  * guarda-corpo de volume em algo negociável"*. O claim --004 descreve LITERALMENTE este caso:
  * *"massa/intermediário com peito já em 16 (o topo) e foco no peito → 18–20 > 16"*.
  *
  * 🔑 O que decidiu na prática: o relato do autor de 2026-09-15. O motor entregava peito 17
  * contra 16 e o CRÍTICO DO PRÓPRIO APP acusava o plano na tela "Montar meu treino". Manter o
  * excesso exigiria calar o crítico — ou seja, esconder o número em vez de respeitá-lo.
  *
  * 🔒 O que NÃO mudou: o foco continua ADIÇÃO, sem compensação. Nenhum terceiro cede série
  * para o bloco entrar; o que muda é só que o bloco para no teto.
  */
 /**
  * 🔵 CÉLULA REANCORADA (2026-09-17). A anterior — intermediário 4d/75min/S5 com foco em
  * peito — deixou de discriminar: com a margem de 3, o baseline fica em 12 contra um teto de
  * 19, sobra folga e o bloco ENTRA. Afirmar ali "o extra para no teto" seria cobrar um
  * comportamento que aquela célula não exercita mais.
  *
  * A célula nova foi medida na varredura desta correção: INICIANTE 3d/60min/S5 com foco em
  * costas, onde o teto de 13 é atingido pelo baseline e o bloco é recusado por inteiro.
  */
 it('a MARGEM é do grupo em foco: extras cabem na margem sem exigir saturação fracionária',()=>{
  const over={nivelExperiencia:'iniciante' as const,tempoPorSessaoMin:60,limiteTempoTreino:'limitado' as const};
  const a=run(['seg','qua','sex'],over,5);
  const b=run(['seg','qua','sex'],{...over,foco:{grupo:'costas',compensa:'biceps',semana:1}},5);
  const t=b.tetoVolumeSemana!;
  const pond=(r:RotinaSemanal,g='costas')=>creditoPonderadoDaSemana(slots(r)).get(g as never)??0;
  expect(t.gruposEmFoco,'o grupo focado precisa estar declarado').toEqual(['costas']);
  // 🔵 Sem foco o grupo para no MÁXIMO AUTOMÁTICO; com foco ele usa a margem e chega ao CHEIO.
  expect(pond(a),'sem foco, costas não pode passar do máximo automático').toBeLessThanOrEqual(t.semFoco);
  expect(pond(b),'com foco, costas usa a margem').toBeGreaterThan(t.semFoco);
  expect(pond(b)).toBeLessThanOrEqual(t.cheio);
  // Crédito indireto fracionário: nem toda composição consegue fechar exatamente o teto.
  expect(pond(b)+1,'mais uma série direta ultrapassaria o teto').toBeGreaterThan(t.cheio);
  expect(t.cheio-t.semFoco,'a margem é de 3 séries').toBe(3);
  // 🔒 E a exceção é DO GRUPO: ninguém mais passa do máximo automático por tabela.
  for(const g of GRUPOS_GRANDES){
   if(g==='costas')continue;
   expect(pond(b,g),`${g} não está em foco e não pode usar o teto cheio`).toBeLessThanOrEqual(t.semFoco);
  }
  // 🔒 E o teto por sessão vale ao mesmo tempo: nenhum dia passa das 12 ponderadas.
  for(const d of b.dias){
   const nd=creditoPonderadoDaSemana(d.slots);
   for(const g of GRUPOS_GRANDES)expect(nd.get(g)??0,`${d.diaId}/${g}`).toBeLessThanOrEqual(t.sessao!);
  }
  // e não custa série de ninguém: o baseline dos outros grupos sai idêntico
  const outros=(r:RotinaSemanal)=>slots(r).filter(s=>s.exercicio.grupoPrimario!=='costas').map(s=>`${s.exercicio.id}:${s.series}`).sort();
  expect(outros(b)).toEqual(outros(a));
 });

 /**
  * 🔵 O DEGRAU DA RECUSA, na célula onde ele ainda acontece (medida na varredura de
  * 2026-09-17): iniciante 3d/60min seg-ter-qua, foco em costas na semana 5. Ali o bloco não
  * cabe e a tela DIZ por quê — é a outra metade do contrato de 14/09→15/09.
  */
 it('extras param no TETO — quando não cabe, o bloco é recusado e a tela explica',()=>{
  const over={nivelExperiencia:'iniciante' as const,tempoPorSessaoMin:60,limiteTempoTreino:'limitado' as const};
  const a=run(['seg','ter','qua'],over,5);
  const b=run(['seg','ter','qua'],{...over,foco:{grupo:'costas',compensa:'biceps',semana:5}},5);
  const t=b.tetoVolumeSemana!;
  const pond=(r:RotinaSemanal)=>creditoPonderadoDaSemana(slots(r)).get('costas')??0;
  expect(pond(b),'o foco não pode passar do teto cheio').toBeLessThanOrEqual(t.cheio);
  // anti-vacuidade: o bloco NÃO entregou o nominal inteiro — é disso que o caso trata
  const entregue=(b.blocoFoco?.adicionais??[]).reduce((n,x)=>n+x.series,0);
  expect(entregue,'o bloco entregou tudo — a célula deixou de exercitar a recusa').toBeLessThan(4);
  expect(b.avisos.some(x=>RECUSA_OU_APARO.test(x)),`recusa sem explicação na tela: ${b.avisos.join(' | ')}`).toBe(true);
  // e o baseline dos outros grupos segue intacto
  const outros=(r:RotinaSemanal)=>slots(r).filter(s=>s.exercicio.grupoPrimario!=='costas').map(s=>`${s.exercicio.id}:${s.series}`).sort();
  expect(outros(b)).toEqual(outros(a));
 });
 /**
  * 🔴 Revisão 15/09 (D-03) — o equilíbrio puxar/empurrar é do BASELINE.
  * Decisão da coordenação: o desequilíbrio que vem dos extras autorizados é consequência
  * aceita do foco e não se compensa em outro grupo. O que continua proibido é o baseline
  * desequilibrar por causa do foco — e é isso que se mede aqui, com o extra descontado.
  */
 it('corte local conserva o equilíbrio do baseline, com foco em dia de puxar',()=>{
  for(const semana of [1,5,6] as const){
   const r=run(['seg','qua','sex'],{tempoPorSessaoMin:20,limiteTempoTreino:'limitado',foco:{grupo:'peito',compensa:'triceps',semana:1}},semana);
   expect(r.resultadoGeracao?.tipo).not.toBe('ERRO_ALOCADOR');
   const extras=new Set((r.blocoFoco?.adicionais??[]).map(a=>`${a.diaId??''}|${a.exercicioId}`));
   const conta=(padrao:string,doFoco:boolean)=>r.dias.reduce((n,d)=>n+d.slots.filter(s=>s.padrao===padrao&&extras.has(`${d.diaId??''}|${s.exercicio.id}`)===doFoco).length,0);
   expect(conta('puxar',false)).toBeGreaterThanOrEqual(conta('empurrar',false));
   // E nada de excesso sem dono: todo `empurrar` a mais tem de vir do bloco adicional.
   const excesso=(conta('empurrar',false)+conta('empurrar',true))-(conta('puxar',false)+conta('puxar',true));
   if(excesso>0)expect(excesso).toBeLessThanOrEqual(conta('empurrar',true));
  }
 });
 it('certificado limitado respeita teto estrito; sem limite não é uma sentinela numérica',()=>{
  for(const agenda of agendas)for(const tempo of [20,60,75,90]){
   const r=run(agenda,{tempoPorSessaoMin:tempo,limiteTempoTreino:'limitado'});
   if(r.resultadoGeracao?.tipo==='CERTIFICADO')for(const d of r.duracaoDias??[])expect(d.duracaoMaximaEstimadaSegundos!).toBeLessThanOrEqual(tempo*60);
  }
  expect(run(['seg'],{tempoPorSessaoMin:20}).dias).toEqual(run(['seg'],{tempoPorSessaoMin:75}).dias);
 });
 it('exigência documental preserva piso120 em todos os níveis de degradação e FIT',()=>{
  for(const ex of EXERCISES.filter(altaExigenciaDocumental))for(const degradacao of [0,1,2] as const)for(const semanaRampa of [undefined,1,2]){
   expect(descansoDoExercicio({exercicio:ex,rirAlvo:4,degradacao,semanaRampa})!,ex.id).toBeGreaterThanOrEqual(120);
   if(degradacao===0)expect(descansoDoExercicio({exercicio:ex,rirAlvo:4,degradacao,semanaRampa})!,ex.id).toBeGreaterThanOrEqual(180);
  }
 });
});
