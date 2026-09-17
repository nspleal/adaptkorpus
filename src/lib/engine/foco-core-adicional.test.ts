import { doPlano, paraRotinaCustom } from '../../components/painel/EditorTreino';
import { describe, it, expect } from 'vitest';
import { gerarTreino } from '../engine';
import { EXERCISES } from '../data/exercises';
import { perfilBase } from '../../../scripts/dump-planos';
import { creditoPonderadoDaSemana } from './alocador';
import { diretosDoExercicio } from './cobertura-anatomica';

describe('core adicional sem cessão de terceiros', () => {
  it('preserva cada exercício e dose do baseline nos 216 cenários de foco', () => {
    let somados = 0;
    for (const nivelExperiencia of ['iniciante','intermediario','avancado'] as const)
    for (const objetivo of ['saude','massa','emagrecimento'] as const)
    for (const diasDisponiveis of [3,4])
    for (const semana of [1,2,3,5] as const)
    for (const compensa of ['costas','peito','quadriceps'] as const) {
      const p = perfilBase({nivelExperiencia,objetivo,diasDisponiveis});
      const op = {exercises:EXERCISES,semanaCiclo:{semana}};
      const a = gerarTreino(p,op).rotina!;
      const b = gerarTreino({...p,foco:{grupo:'core',compensa,semana:1}},op).rotina!;
      let delta = 0;
      for (let i=0;i<a.dias.length;i++) {
        const antes=a.dias[i]!, depois=b.dias[i]!;
        expect(depois.slots.map(s=>s.exercicio.id)).toEqual(antes.slots.map(s=>s.exercicio.id));
        for (let j=0;j<antes.slots.length;j++) {
          const x=antes.slots[j]!,y=depois.slots[j]!;
          const n=(y.series??0)-(x.series??0);
          if(x.exercicio.grupoPrimario==='core') expect(n).toBeGreaterThanOrEqual(0);
          else expect(n).toBe(0);
          expect(y.descansoSeg).toBe(x.descansoSeg);
          delta+=n;
        }
      }
      expect(delta).toBe(b.focoCoreAdicional?.entregues??0);
      expect(delta).toBeLessThanOrEqual(2);
      somados+=delta;
      const credito=creditoPonderadoDaSemana(b.dias.flatMap(d=>d.slots));
      const teto=nivelExperiencia==='iniciante'?10:nivelExperiencia==='intermediario'?16:18;
      for(const [g,n] of credito) expect(n,`${nivelExperiencia}/${objetivo}/${semana}/${g}`).toBeLessThanOrEqual(teto+(g==='core'?3:0));
    }
    expect(somados).toBeGreaterThan(0);
  }, 120000);
  it('a cobertura adicional conserva participação já conquistada', () => {
    const p=perfilBase({nivelExperiencia:'intermediario',diasDisponiveis:4,tempoPorSessaoMin:60});
    const a=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:2}}).rotina!;
    const b=gerarTreino({...p,foco:{grupo:'core',semana:1}},{exercises:EXERCISES,semanaCiclo:{semana:2}}).rotina!;
    const cobertura=(r:typeof a)=>new Set(r.dias.flatMap(d=>d.slots.flatMap(s=>[...diretosDoExercicio(s.exercicio.id)])));
    expect(cobertura(b)).toEqual(cobertura(a));
    expect(cobertura(a).has('qu')).toBe(true);
  });
});

it('confirmar e reabrir o core com foco conserva a dose, sem reaplicar o adicional', () => {
 const p=perfilBase({nivelExperiencia:'iniciante',objetivo:'saude',diasDisponiveis:4,tempoPorSessaoMin:60,foco:{grupo:'core',semana:1}});
 const op={exercises:EXERCISES,semanaCiclo:{semana:2 as const}};
 const r=gerarTreino(p,op).rotina!;
 const dose=(x:typeof r)=>x.dias.map(d=>({dia:d.diaId,slots:d.slots.map(s=>[s.exercicio.id,s.series])}));
 let atual=r;
 for(let i=0;i<3;i++){
  const custom=JSON.parse(JSON.stringify(paraRotinaCustom(doPlano(atual.dias,p.treinoDias??[]))));
  atual=gerarTreino({...p,rotinaCustom:custom},op).rotina!;
  expect(dose(atual)).toEqual(dose(r));
 }
});
