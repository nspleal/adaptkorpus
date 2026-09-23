import { describe, it, expect } from 'vitest';
import { gerarTreino } from './index';
import { EXERCISES } from '../data/exercises';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './alocador';
import { maxSemanalSemFoco } from './trilhos';
import type { PerfilTreino } from './treino-types';
import { ORDEM_SEMANA } from '../semana';
import { MINIMOS_TEMPO, tipoSessaoTemporal } from './adequacao-tempo-politica';
import type { GrupoPrimario } from '../data/types';
import { papelReferencia } from './selecao-referencia';
import {diretosDoExercicio} from './cobertura-anatomica';

const perfil = (n: number, divisaoPreferida: PerfilTreino['divisaoPreferida']): PerfilTreino => ({
  pesoKg:80, alturaCm:180, idade:30, objetivo:'massa', nivelExperiencia:'iniciante',
  flagsSaude:{gestacaoAmamentacao:false,renal:false,cardiaca:false,lesao:false,diabetes:false},
  equipamento:'academia',equipamentosCasa:[],diasDisponiveis:n,
  treinoDias:n===4?['seg','ter','qui','sex']:ORDEM_SEMANA.slice(0,n),
  tempoPorSessaoMin:30,limiteTempoTreino:'limitado',divisaoPreferida,
});

describe('adequação local integrada, academia e semanas S1–S5',()=>{
  it('6 dias Upper/Lower explícitos: identidade e complementares preservados em S1–S5',()=>{
    const p=perfil(6,'superior-inferior');
    const dias=([1,2,3,4,5] as const).map(semana=>{
      const interno=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana,planejamentoCicloInterno:true}}).rotina!;
      const final=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
      expect(final.resultadoGeracao?.tipo).toBe('CERTIFICADO');
      const slots=final.dias.flatMap(d=>d.slots);
      const alvos=new Set(slots.flatMap(s=>[...diretosDoExercicio(s.exercicio.id)]));
      for(const s of interno.dias.flatMap(d=>d.slots))
        for(const alvo of diretosDoExercicio(s.exercicio.id))expect(alvos.has(alvo),`S${semana}: ${alvo}`).toBe(true);
      const grupos=(grupo:string)=>slots.filter(s=>s.exercicio.grupoPrimario===grupo);
      for(const id of ['e97','e73','e118','e147'])
        expect(slots.filter(s=>s.exercicio.id===id),`S${semana}: ${id}`).toHaveLength(1);
      expect(grupos('core').reduce((n,s)=>n+s.series!,0)).toBeGreaterThanOrEqual(
        interno.dias.flatMap(d=>d.slots).filter(s=>s.exercicio.grupoPrimario==='core').reduce((n,s)=>n+s.series!,0));
      expect(grupos('antebraco').reduce((n,s)=>n+s.series!,0)).toBeGreaterThanOrEqual(
        interno.dias.flatMap(d=>d.slots).filter(s=>s.exercicio.grupoPrimario==='antebraco').reduce((n,s)=>n+s.series!,0));
      const biceps=(r:typeof final)=>creditoPonderadoDaSemana(r.dias.flatMap(d=>d.slots)).get('biceps')??0;
      expect(biceps(final)).toBeGreaterThanOrEqual(biceps(interno)-0.5);
      for(const d of final.dias.filter(d=>d.nome.startsWith('Upper'))){
        expect(d.slots.filter(s=>['core','antebraco','panturrilha'].includes(s.exercicio.grupoPrimario??''))).toHaveLength(1);
        const funcoes=d.slots.map(s=>papelReferencia(s.exercicio));
        expect(funcoes).toEqual(expect.arrayContaining(['puxada','remada']));
      }
      return final.dias.map(d=>d.slots.map(s=>s.exercicio.id).sort());
    });
    for(const atual of dias.slice(1))expect(atual).toEqual(dias[0]);
  });
  it('revisita mínimos bloqueados pelo saldo e preserva puxada/remada em cada Upper', () => {
    const p: PerfilTreino = { ...perfil(3, 'auto'), nivelExperiencia: 'intermediario',
      equipamento: 'casa', equipamentosCasa: ['halteres', 'elastico'], tempoPorSessaoMin: 45 };
    let ids: string[][] | undefined;
    for (const semana of [1, 3, 5] as const) {
      const r = gerarTreino(p, { exercises: EXERCISES, semanaCiclo: { semana } }).rotina!;
      expect(r.resultadoGeracao).toMatchObject({ tipo: 'CERTIFICADO' });
      const atuais = r.dias.map(d => d.slots.map(s => s.exercicio.id));
      if (ids) expect(atuais).toEqual(ids);
      ids = atuais;
      for (const d of r.dias.filter(d => d.nome.startsWith('Upper'))) {
        for (const [grupo, minimo] of Object.entries(MINIMOS_TEMPO.upper))
          expect(d.slots.filter(s => s.exercicio.grupoPrimario === grupo).length, d.nome + '/' + grupo).toBeGreaterThanOrEqual(minimo);
        expect(d.slots.map(s => papelReferencia(s.exercicio))).toEqual(expect.arrayContaining(['puxada', 'remada']));
      }
      const slots = r.dias.flatMap(d => d.slots);
      expect(slots.filter(s => s.padrao === 'puxar').length).toBeGreaterThanOrEqual(slots.filter(s => s.padrao === 'empurrar').length);
      for (const d of r.duracaoDias ?? []) expect(d.duracaoMaximaEstimadaSegundos).toBeLessThanOrEqual(2700);
    }
  });
  for(const n of [1,4,5,6]) for(const semana of [1,2,3,4,5] as const) {
    it(`${n} dias, semana ${semana}: mínimos, tempo e tetos`,()=>{
      const p=perfil(n,n===4||n===6?'superior-inferior':'auto');
      const r=gerarTreino(p,{exercises:EXERCISES,semanaCiclo:{semana}}).rotina!;
      expect(r.resultadoGeracao,JSON.stringify(r.resultadoGeracao)).toMatchObject({tipo:'CERTIFICADO'});
      const c=creditoPonderadoDaSemana(r.dias.flatMap(d=>d.slots));
      for(const g of GRUPOS_GRANDES) expect(c.get(g)??0,g).toBeLessThanOrEqual(maxSemanalSemFoco(p.nivelExperiencia,p.objetivo));
      for(const d of r.dias) {
        const tipo=tipoSessaoTemporal(d.nome,d.slots.map(s=>s.exercicio.grupoPrimario!).filter(Boolean),r.dias.map(x=>x.nome));
        if(tipo!=='segmentada') for(const [g,min] of Object.entries(MINIMOS_TEMPO[tipo])) expect(d.slots.filter(s=>s.exercicio.grupoPrimario===g).length,`${d.nome}/${g}`).toBeGreaterThanOrEqual(min);
        for(const s of d.slots) {expect(s.series).toBeGreaterThanOrEqual(1);expect(s.descansoSeg).toBeGreaterThanOrEqual(60);}
      }
      for(const d of r.duracaoDias??[]) expect(d.duracaoMaximaEstimadaSegundos).toBeLessThanOrEqual(1800);
      if(n===4&&semana===3) {
        expect(c.get('biceps')).toBeGreaterThanOrEqual(6);
        expect(r.dias.some(d=>d.slots.some(s=>s.exercicio.grupoPrimario===('biceps' as GrupoPrimario)))).toBe(true);
      }
    });
  }
});
