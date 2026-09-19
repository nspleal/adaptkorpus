import { describe, expect, it } from 'vitest';
import { distribuirGruposNoCalendario } from './calendario-grupos';
import type { TemplateDia } from './alocador';

const comps = (ds: readonly TemplateDia[]) => ds.map(d => d.grupos.filter(g => ['core','antebraco','panturrilha'].includes(g)));
describe('decisões explícitas do autor em 19/09, sem alternância semanal', () => {
  it('dois dias: panturrilha no inferior e apenas um complementar no superior', () => {
    const ts: TemplateDia[] = [{nome:'Upper',grupos:['peito','costas','biceps','triceps','core']},{nome:'Lower',grupos:['quadriceps','posterior','gluteos','panturrilha','core']}];
    const r=distribuirGruposNoCalendario(ts,['seg','qui'],[],2,true);
    expect(comps(r.dias)).toEqual([['core'],['panturrilha']]);
    expect(r.dias[0]!.grupos).toContain('peito'); expect(r.dias[1]!.grupos).toContain('posterior');
  });
  it('full-body três dias: oferece os três antes de repetir core', () => {
    const ts: TemplateDia[]=Array.from({length:3},(_,i)=>({nome:`Full ${i}`,grupos:['peito','costas','quadriceps','posterior','panturrilha','core']}));
    const r=distribuirGruposNoCalendario(ts,['seg','qua','sex'],[],2,true);
    expect(comps(r.dias).every(c=>c.length===1)).toBe(true);
    expect(comps(r.dias).flat().sort()).toEqual(['antebraco','core','panturrilha']);
    expect(distribuirGruposNoCalendario(ts,['seg','qua','sex'],[],2,true)).toEqual(r);
  });
  it('dia dedicado recebe core e antebraço, nunca transfere panturrilha das pernas', () => {
    const ts:TemplateDia[]=[{nome:'Upper',grupos:['peito','costas']},{nome:'Lower',grupos:['quadriceps','posterior','panturrilha']},{nome:'Complementares',grupos:['core','antebraco']}];
    const r=distribuirGruposNoCalendario(ts,['seg','qua','sex'],[],2,true);
    expect(comps(r.dias)[2]).toEqual(['core','antebraco']);
    expect(comps(r.dias)[1]).toEqual(['panturrilha']);
    expect(r.dias[2]!.grupos.every(g=>g==='core'||g==='antebraco')).toBe(true);
  });
  it('um único full-body também respeita apenas um complementar', () => {
    const r=distribuirGruposNoCalendario([{nome:'Full',grupos:['peito','costas','quadriceps','posterior','core','panturrilha']}],['qua'],[],2,true);
    expect(comps(r.dias)[0]).toHaveLength(1);
  });
});
