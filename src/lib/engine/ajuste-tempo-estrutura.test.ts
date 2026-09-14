import {describe,it,expect} from 'vitest';
import {reduzirEstruturaPorTempo,removerExtrasPorTempo} from './ajuste-tempo-estrutura';
import {EXERCISES} from '../data/exercises';
import type {DiaTreino,SlotExercicio} from './treino-types';
const slot=(id:string):SlotExercicio=>{const exercicio=EXERCISES.find(e=>e.id===id)!;return {exercicio,padrao:exercicio.padraoMovimento,series:2,descansoSeg:120};};
const dia=(slots:SlotExercicio[]):DiaTreino=>({nome:'Teste',diaId:'seg',slots});

describe('corte do BASELINE por orçamento — decisões14/09',()=>{
 it('alterna o maior removível com outro grupo e preserva o único de cada grupo',()=>{
  const base=['e9','e11','e14','e19','e72','e74'].map(slot);
  const r=reduzirEstruturaPorTempo(dia([...base]),'intermediario',1);
  // Alternância: nenhum grupo sai duas vezes seguidas enquanto houver outro removível.
  const seq=r.removidos.map(s=>s.exercicio.grupoPrimario);
  expect(seq.length,'nada foi removido — o caso não discrimina').toBeGreaterThan(1);
  for(let i=1;i<seq.length;i++)expect(seq[i],`repetiu ${seq[i]} em sequência: ${seq.join('>')}`).not.toBe(seq[i-1]);
  // Sobra exatamente um exercício de cada grupo que existia no dia.
  expect([...new Set(r.dia.slots.map(s=>s.exercicio.grupoPrimario))].sort()).toEqual(['biceps','peito']);
  expect(r.dia.slots).toHaveLength(2);
  expect(r.incompativel).toBe(true);expect(r.naoAvaliado).toBe(false);
  // Não realoca nem mexe em séries de quem ficou.
  expect(r.dia.slots.every(s=>s.series===2)).toBe(true);
 });
 it('sem limite não corta; o número de minutos não serve de sentinela',()=>{
  const slots=['e9','e11','e14'].map(slot);const r=reduzirEstruturaPorTempo(dia(slots),'intermediario',undefined);
  expect(r.dia.slots).toEqual(slots);expect(r.removidos).toEqual([]);expect(r.incompativel).toBe(false);
 });
 it('dado ausente permanece não avaliado, sem poda arbitrária',()=>{
  const s=slot('e9');delete s.series;const r=reduzirEstruturaPorTempo(dia([s,slot('e11')]),'intermediario',1);
  expect(r.naoAvaliado).toBe(true);expect(r.removidos).toEqual([]);
 });
});

/**
 * 🔴 REVISÃO INDEPENDENTE 15/09 (D-01) — O CONTRATO NOVO DO BLOCO ADICIONAL.
 *
 * O candidato reprovado passava o conjunto `adicionais` para o corte do baseline e filtrava
 * os extras pelo MESMO `removivel`: um extra sozinho no seu grupo naquele dia ficava
 * irremovível e o dia cedia um exercício do baseline (foco de bíceps custando 3 séries de
 * costas). A decisão da coordenação inverteu isso: «um grupo introduzido somente pelo foco
 * não torna seu extra irremovível», «o tempo pode eliminar integralmente o bloco adicional»
 * e «não retire exercícios do baseline para preservar extras». As três viraram testes.
 */
describe('corte dos EXTRAS do foco — decisões da revisão 15/09',()=>{
 it('remove o extra mesmo quando ele é o único exercício do seu grupo no dia',()=>{
  const base=['e9','e11'].map(slot),extra=slot('e19'); // e19 = bíceps, sozinho no dia
  const r=removerExtrasPorTempo(dia([...base,extra]),'intermediario',1,new Set([extra]));
  expect(r.removidos).toEqual([extra]);
  expect(r.dia.slots).toEqual(base);
 });
 it('o tempo pode eliminar o bloco inteiro, e o corte para ao chegar no baseline',()=>{
  const base=['e9','e11'].map(slot),extras=['e14','e19','e72'].map(slot);
  const r=removerExtrasPorTempo(dia([...base,...extras]),'intermediario',1,new Set(extras));
  expect(r.removidos).toHaveLength(3);
  expect(r.dia.slots).toEqual(base); // nenhum slot do baseline foi tocado
  expect(r.cabe).toBe(false);        // ainda não cabe — e mesmo assim o baseline fica
 });
 it('sai o último acrescentado primeiro',()=>{
  const base=[slot('e9')],extras=['e14','e19'].map(slot);
  const r=removerExtrasPorTempo(dia([...base,...extras]),'intermediario',1,new Set(extras));
  expect(r.removidos.map(s=>s.exercicio.id)).toEqual(['e19','e14']);
 });
 it('cabendo, não remove nada; sem limite, idem',()=>{
  const extras=['e14'].map(slot);const slots=[slot('e9'),...extras];
  expect(removerExtrasPorTempo(dia([...slots]),'intermediario',99999,new Set(extras)).removidos).toEqual([]);
  expect(removerExtrasPorTempo(dia([...slots]),'intermediario',undefined,new Set(extras)).removidos).toEqual([]);
 });
 it('dado ausente não autoriza poda do bloco',()=>{
  const extra=slot('e14');delete extra.series;
  const r=removerExtrasPorTempo(dia([slot('e9'),extra]),'intermediario',1,new Set([extra]));
  expect(r.removidos).toEqual([]);
 });
});
