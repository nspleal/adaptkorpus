import {expect} from 'vitest';
import type {RotinaSemanal} from '../treino-types';

/** Limite inferior independente: duas pernas deixam N-2 superiores.
 * Se só os slots principais de superiores excedem a capacidade, nenhuma permutação
 * resolve sem remover principal/aumentar slots. Não usa o aviso como prova.
 */
export function verificarImpedimentoRecortes(base:RotinaSemanal,foco:RotinaSemanal,slotsMax:number):void {
 const superiores=['peito','costas','ombros','biceps','triceps'];
 const n=base.dias.flatMap(d=>d.slots).filter(s=>superiores.includes(s.exercicio.grupoPrimario??'')).length;
 expect(n,'faltou prova de impossibilidade pelos principais; investigar outra restrição').toBeGreaterThan((base.dias.length-2)*slotsMax);
 const assinatura=(r:RotinaSemanal)=>r.dias.flatMap(d=>d.slots.filter(s=>!s.extraDoFoco)).map(s=>JSON.stringify([s.exercicio.id,s.series,s.descansoSeg])).sort();
 expect(assinatura(foco)).toEqual(assinatura(base));
 expect(foco.avisos.some(a=>a.startsWith('Mantivemos a distribuição disponível'))).toBe(true);
 expect(foco.distribuicao?.atendida).toBe(false);
}
