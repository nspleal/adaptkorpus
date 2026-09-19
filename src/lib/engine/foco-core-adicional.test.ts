import { doPlano, paraRotinaCustom } from '../../components/painel/EditorTreino';
import { describe, it, expect } from 'vitest';
import { gerarTreino } from '../engine';
import { EXERCISES } from '../data/exercises';
import { perfilBase } from '../../../scripts/dump-planos';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './alocador';
import { diretosDoExercicio } from './cobertura-anatomica';
import { fraseDoFoco } from '../foco-copy';

describe('core adicional sem cessão de terceiros', () => {
  it('preserva cada exercício e dose do baseline nos 648 cenários de foco', () => {
    let somados = 0;
    for (const nivelExperiencia of ['iniciante','intermediario','avancado'] as const)
    for (const objetivo of ['saude','massa','emagrecimento'] as const)
    // Mantém as 324 combinações de 60 min e acrescenta controles de 75 min com ganho real.
    for (const tempoPorSessaoMin of [60,75])
    for (const diasDisponiveis of [3,4,6])
    for (const semana of [1,2,3,5] as const)
    for (const compensa of ['costas','peito','quadriceps'] as const) {
      const p = perfilBase({nivelExperiencia,objetivo,diasDisponiveis,tempoPorSessaoMin});
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
      // A faixa semanal pertence aos grandes; pequenos têm presença, não banda.
      // O loop acima já garante que core soma no máximo duas séries e terceiros não cedem.
      const teto=b.tetoVolumeSemana!;
      for(const g of GRUPOS_GRANDES) expect(credito.get(g)??0,`${nivelExperiencia}/${objetivo}/${semana}/${g}`)
        .toBeLessThanOrEqual(teto.gruposEmFoco.includes(g)?teto.cheio:teto.semFoco);
    }
    expect(somados).toBeGreaterThan(0);
  }, 120000);
  it('a cobertura adicional conserva participação já conquistada', () => {
    const p=perfilBase({nivelExperiencia:'intermediario',diasDisponiveis:4,tempoPorSessaoMin:60});
    const a=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana:2}}).rotina!;
    const b=gerarTreino({...p,foco:{grupo:'core',semana:1}},{exercises:EXERCISES,semanaCiclo:{semana:2}}).rotina!;
    const cobertura=(r:typeof a)=>new Set(r.dias.flatMap(d=>d.slots.flatMap(s=>[...diretosDoExercicio(s.exercicio.id)])));
    expect(cobertura(b)).toEqual(cobertura(a));
    // 2026-09-19: com um complementar por dia, o segundo core (e102) não é acrescentado e o
    // quadrado lombar fica pendente e DITO; o alvo conquistado que se conserva é o eretor (bird dog).
    expect(cobertura(a).has('er')).toBe(true);
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

it('sem folga (avançado/massa/5d/S1): o foco fica salvo, o plano diz que nada foi aplicado e a dose é a do baseline', () => {
 const p=perfilBase({nivelExperiencia:'avancado',objetivo:'massa',diasDisponiveis:5});
 const op={exercises:EXERCISES,semanaCiclo:{semana:1 as const}};
 const a=gerarTreino(p,op).rotina!;
 const b=gerarTreino({...p,foco:{grupo:'core',semana:1}},op).rotina!;
 expect(b.focoCoreAdicional).toEqual({solicitadas:2,entregues:0});
 expect(b.dias.map(d=>d.slots.map(s=>[s.exercicio.id,s.series]))).toEqual(a.dias.map(d=>d.slots.map(s=>[s.exercicio.id,s.series])));
 expect(b.avisos).toContain('Foco de core salvo, mas nenhum extra foi aplicado por falta de espaço nos limites do treino (séries por exercício, volume e tempo).');
 expect(fraseDoFoco(b)).toBe('Foco salvo, mas nenhum extra foi aplicado por falta de espaço nos limites do treino.');
});
