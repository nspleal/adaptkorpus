import { expect, it } from 'vitest';
import { adequarTetoSemanal } from './adequacao-teto-semanal';
import { EXERCISES } from '../data/exercises';
import type { DiaTreino, SlotExercicio } from './treino-types';
import { gerarTreino } from './index';
import { impedimentosDaGeracao } from '../geracao-treino-aceitavel';
import { creditoPonderadoDaSemana } from './alocador';
const slot = (id: string, series = 3): SlotExercicio => { const exercicio = EXERCISES.find(e => e.id === id)!; return { exercicio, padrao: exercicio.padraoMovimento, series, descansoSeg: 120 }; };
const dia = (slots: SlotExercicio[]): DiaTreino => ({ nome: 'Peito', diaId: 'seg', slots });
it('reduz apenas séries do grupo excedido e para no teto, sem mutar entrada', () => {
 const entrada = [dia([slot('e14'), slot('e15'), slot('e72')])]; const copia = structuredClone(entrada);
 const r = adequarTetoSemanal({ dias: entrada, nivel: 'iniciante', teto: g => g === 'peito' ? 4 : 99, minimos: [{ peito: 2, biceps: 1 }] });
 expect(r.ajustes.map(a => a.tipo)).toEqual(['serie','serie']);
 expect(r.dias[0]!.slots.map(s => s.series)).toEqual([2,2,3]);
 expect(r.passos.every(p => p.dias.every(d => !d.faltas.length))).toBe(true);
 expect(r.passos.map(p => p.credito.peito)).toEqual([5,4]);
 expect(r.conflitos).toEqual([]); expect(entrada).toEqual(copia);
});
it('não zera exercício obrigatório nem remove função exclusiva para forçar o teto', () => {
 const r = adequarTetoSemanal({ dias: [dia([slot('e14'),slot('e15')])], nivel:'iniciante', teto:g=>g==='peito'?1:99, minimos:[{peito:2}] });
 expect(r.dias[0]!.slots.map(s=>s.series)).toEqual([1,1]);
 expect(r.ajustes.every(a=>a.tipo==='serie')).toBe(true);
 expect(r.conflitos).toEqual([{grupo:'peito',credito:2,teto:1}]);
});
it('upper/lower explícito de sete dias em deload: recusa o conflito irredutível dos mínimos', () => {
 // O automático agora é estruturado e resolve o antigo conflito. UL explícito
 // exige quatro upper com dois costas cada: oito séries mínimas contra teto seis.
 const r = gerarTreino({pesoKg:80,alturaCm:180,idade:30,objetivo:'massa',nivelExperiencia:'iniciante',equipamento:'academia',divisaoPreferida:'superior-inferior',diasDisponiveis:7,treinoDias:['seg','ter','qua','qui','sex','sab','dom'],tempoPorSessaoMin:75,limiteTempoTreino:'sem_limite',flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false}}, {exercises:EXERCISES,semanaCiclo:{semana:6}});
 expect(r.rotina?.dias).toHaveLength(7);
 for (const d of r.rotina!.dias) { const peito=d.slots.filter(s=>s.exercicio.grupoPrimario==='peito'); if(peito.length)expect(peito.length).toBeGreaterThanOrEqual(2); }
 expect(r.rotina?.resultadoGeracao?.tipo).toBe('TETO_SEMANAL_NAO_ATENDIDO');
 const credito=creditoPonderadoDaSemana(r.rotina!.dias.flatMap(d=>d.slots)).get('costas')!;
 const teto=r.rotina!.tetoVolumeSemana!.semFoco;
 expect(credito).toBeGreaterThan(teto);
 expect(impedimentosDaGeracao(r).some(m=>m.includes('Costas')&&m.includes(`${credito}`)&&m.includes(`${teto}`))).toBe(true);
 expect(r.rotina?.dias.flatMap(d=>d.slots).filter(s=>s.exercicio.grupoPrimario==='costas').every(s=>s.series===1)).toBe(true);
});

it('desenho manual conserva IDs e séries escolhidas mesmo excedendo o teto', () => {
 const r = gerarTreino({pesoKg:80,alturaCm:180,idade:30,objetivo:'massa',nivelExperiencia:'iniciante',equipamento:'academia',diasDisponiveis:1,treinoDias:['seg'],tempoPorSessaoMin:75,limiteTempoTreino:'sem_limite',flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false},rotinaCustom:{origem:'usuario',dias:[{nome:'Meu treino',diaId:'seg',exercicioIds:['e14','e15'],seriesPorExercicio:{e14:12,e15:12}}]}},{exercises:EXERCISES,semanaCiclo:{semana:3}}).rotina!;
 expect(r.dias[0]!.slots.map(s=>[s.exercicio.id,s.series])).toEqual([['e14',12],['e15',12]]);
 expect(r.avisos.some(a=>a.includes('volume')||a.includes('limite'))).toBe(true);
});

// Decisão do autor: no deload, a dose indireta pode cair após esgotar a direta.
it('deload reduz glúteos 6,5→6 pela menor perda, sem retirar exercícios', () => {
 const entrada = [dia([slot('e57',1),slot('e127',1),slot('e57',1),slot('e60',1),slot('e28',2),slot('e16',2),slot('e64',2),slot('e65',1),slot('e65',1),slot('e3',1),slot('e62',1),slot('e87',1)])];
 const copia=structuredClone(entrada);
 const args={dias:entrada,nivel:'iniciante' as const,teto:(g:string)=>g==='gluteos'?6:99,minimos:[{gluteos:4,quadriceps:4,posterior:4}]};
 const bloqueado=adequarTetoSemanal(args);
 expect(bloqueado.conflitos).toContainEqual({grupo:'gluteos',credito:6.5,teto:6});
 const r=adequarTetoSemanal({...args,deloadPreservandoComposicao:true});
 expect(r.conflitos).toEqual([]);
 expect(r.ajustes).toHaveLength(1);
 const a=r.ajustes[0]!;
 expect(a.causa).toBe('indireto_deload');
 expect(a.id).toBe('e28'); // leg press: menor perda colateral; empate segue a ordem da sessão.
 expect(a.creditosAntes!.quadriceps).toBe(6);expect(a.creditosDepois!.quadriceps).toBe(5);
 expect(a.creditosAntes!.gluteos).toBe(6.5);
 expect(a.creditosDepois!.gluteos).toBe(6);
 expect(a.de-a.para).toBe(1);
 expect(a.para).toBeGreaterThanOrEqual(1);
 expect(r.dias[0]!.slots.map(s=>s.exercicio.id)).toEqual(entrada[0]!.slots.map(s=>s.exercicio.id));
 expect(r.passos.every(p=>p.dias.every(d=>!d.faltas.length))).toBe(true);
 for(const [g,c] of Object.entries(a.creditosAntes!)) expect(a.creditosDepois![g]).toBeLessThanOrEqual(c);
 expect(entrada).toEqual(copia);
});
