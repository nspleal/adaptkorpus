import { expect } from 'vitest';
import type { RotinaSemanal } from '../treino-types';

/** Contrato aprovado em 19/09, separado da prova de cobertura/viabilidade. */
export function verificarDistribuicaoComplementares(r: RotinaSemanal): void {
  const comps=['core','panturrilha','antebraco'];
  const baseline=r.dias.map(d=>d.slots);
  for(const slots of baseline){
    const gs=slots.map(s=>s.exercicio.grupoPrimario??'');
    const dedicado=gs.length>0&&gs.every(g=>comps.includes(g)||g==='lombar');
    const complementares=gs.filter(g=>comps.includes(g));
    if(!dedicado)expect(complementares.length,`mais de um complementar no dia misto: ${gs}`).toBeLessThanOrEqual(1);
    if(gs.includes('panturrilha'))expect(gs.some(g=>['quadriceps','posterior','gluteos'].includes(g))).toBe(true);
    if(!dedicado&&(gs.includes('core')||gs.includes('antebraco')))expect(gs.some(g=>['peito','costas','ombros','biceps','triceps'].includes(g))).toBe(true);
  }
  const core=baseline.filter(ss=>ss.some(s=>s.exercicio.grupoPrimario==='core')).length;
  expect(core).toBeLessThanOrEqual(3);
  if(core<2)expect(r.avisos.some(a=>a.startsWith(`Core em ${core} sessão(ões): frequência menor`))).toBe(true);
}
