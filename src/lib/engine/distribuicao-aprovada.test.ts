import { describe, expect, it } from 'vitest';
import { gerarTreino } from './index';
import { EXERCISES } from '../data/exercises';
import { ORDEM_SEMANA, type Weekday } from '../semana';
import type { GrupoPrimario } from '../data/types';
import type { PerfilTreino } from './treino-types';

const base: PerfilTreino = { pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false }, objetivo: 'massa', nivelExperiencia: 'avancado', equipamento: 'academia', diasDisponiveis: 3, tempoPorSessaoMin: 60 };
function gerar(agenda: Weekday[], override: Partial<PerfilTreino> = {}, semana: 1 | 2 | 5 | 6 = 1) {
  return gerarTreino({ ...base, ...override, treinoDias: agenda, diasDisponiveis: agenda.length }, { exercises: EXERCISES, favoritos: new Set(['e1', 'e74']), semanaCiclo: { semana } }).rotina!;
}

describe('decisões 13/09: resultado do motor com catálogo real', () => {
  it('todas as 127 agendas, inclusive domingo/segunda, sem repetição direta vizinha após duração/foco/favoritos', () => {
    for (let mask = 1; mask < 128; mask++) {
      const agenda = ORDEM_SEMANA.filter((_, i) => mask & (1 << i));
      for (const nivelExperiencia of ['iniciante', 'avancado'] as const) {
        const r = gerar(agenda, { nivelExperiencia, foco: { grupo: 'ombros', compensa: 'peito', semana: 1 } });
        if(agenda.length===3 && agenda.includes('dom') && agenda.includes('seg')){
          const seguinte=gerar(agenda,{nivelExperiencia,foco:{grupo:'ombros',compensa:'peito',semana:1}},2);
          const domingo=r.dias.find(d=>d.diaId==='dom')!;
          const segunda=seguinte.dias.find(d=>d.diaId==='seg')!;
          expect(domingo.slots.filter(s=>segunda.slots.some(t=>t.exercicio.grupoPrimario===s.exercicio.grupoPrimario)).map(s=>s.exercicio.grupoPrimario),JSON.stringify({agenda,nivelExperiencia,domingo:domingo.nome,segunda:segunda.nome})).toEqual([]);
        }
        for (const a of r.dias) {
          expect(agenda).toContain(a.diaId);
          for (const b of r.dias) {
            if (a === b) continue;
            const distancia = Math.abs(ORDEM_SEMANA.indexOf(a.diaId!) - ORDEM_SEMANA.indexOf(b.diaId!));
            if (distancia !== 1 && (distancia !== 6 || agenda.length === 3)) continue;
            const grupos = new Set(a.slots.map(s => s.exercicio.grupoPrimario));
            expect(b.slots.filter(s => grupos.has(s.exercicio.grupoPrimario)), JSON.stringify({ agenda, nivelExperiencia, a: a.nome, b: b.nome })).toEqual([]);
          }
        }
      }
    }
  }, 120000);
  it('um dia é full body sem dia inventado; impossibilidade de cobertura permanece explícita', () => {
    const r = gerar(['dom']);
    expect(r.split).toBe('Full-body');
    expect(r.dias.every(d => d.diaId === 'dom')).toBe(true);
    expect(r.dias.flatMap(d => d.slots).some(s => s.exercicio.grupoPrimario === 'costas')).toBe(true);
    expect(r.avisos.length).toBeGreaterThan(0);
  });
  it('foco de bíceps precede compostos no automático e preserva ordem manual', () => {
    const foco = { grupo: 'biceps', compensa: 'peito', semana: 1 } as const;
    const r = gerar(['seg','qua','sex'], { foco });
    const dia = r.dias.find(d => d.slots.some(s => s.exercicio.grupoPrimario === 'biceps'))!;
    expect(dia).toBeDefined();
    expect(dia.slots[0]!.exercicio.grupoPrimario).toBe('biceps');
    const custom = gerar(['seg'], { foco, rotinaCustom: { origem: 'usuario', dias: [{ nome: 'Meu', diaId: 'sex', exercicioIds: ['e1','e11'], seriesPorExercicio: { e1: 3, e11: 2 } }] } });
    expect(custom.dias[0]!.slots.map(s => s.exercicio.id)).toEqual(['e1','e11']);
    expect(custom.dias[0]!.diaId).toBe('sex');
  });
  it('mudança de perfil não corta dias manuais; séries e deload continuam calculados', () => {
    const rotinaCustom = { origem: 'usuario' as const, dias: ['seg','qua','sex','dom'].map(diaId => ({ diaId: diaId as Weekday, nome: diaId, exercicioIds: ['e1'], seriesPorExercicio: { e1: 4 } })) };
    const normal = gerar(['qua'], { nivelExperiencia: 'iniciante', rotinaCustom });
    const deload = gerar(['qua'], { nivelExperiencia: 'iniciante', rotinaCustom }, 6);
    expect(normal.dias).toHaveLength(4);
    expect(normal.dias.map(d => d.slots[0]!.series)).toEqual([4,4,4,4]);
    expect(deload.dias).toHaveLength(4);
    expect(deload.dias.every(d => d.slots[0]!.series! < 4)).toBe(true);
  });
  it('focos individuais/agregados, equipamento e tempo restritos: final sem adjacência e sem banidos', () => {
    const focos: GrupoPrimario[] = ['peito','costas','ombros','biceps','triceps','quadriceps','posterior','gluteos','panturrilha','core','antebraco'];
    const opcoes: Partial<PerfilTreino>[] = [{}, ...focos.map(grupo => ({ foco: { grupo, compensa: grupo === 'peito' ? 'costas' as const : 'peito' as const, semana: 2 } })), ...(['bracos','pernas'] as const).map(grupo => ({ focoAgregado: { grupo, semana: 1 } }))];
    for (const agenda of [['dom','seg'], ['seg','ter','qua'], ['seg','qua','sex'], [...ORDEM_SEMANA]] as Weekday[][])
    for (const foco of opcoes) for (const equipamento of ['academia','nenhum'] as const) for (const tempoPorSessaoMin of [20,60]) {
      const r = gerar(agenda, { ...foco, equipamento, tempoPorSessaoMin, preferencias: { banidos: ['e1'], trocas: [] } });
      for (const a of r.dias) for (const b of r.dias) {
        const delta = Math.abs(ORDEM_SEMANA.indexOf(a.diaId!) - ORDEM_SEMANA.indexOf(b.diaId!));
        if (delta === 1 || (delta === 6 && agenda.length !== 3)) expect(a.slots.some(s => b.slots.some(t => t.exercicio.grupoPrimario === s.exercicio.grupoPrimario))).toBe(false);
      }
      expect(r.dias.flatMap(d => d.slots).some(s => s.exercicio.id === 'e1')).toBe(false);
      if (equipamento === 'nenhum' || tempoPorSessaoMin === 20) expect(r.avisos.length).toBeGreaterThan(0);
    }
  });
  it('braços agregados somam bloco aos primários, preservando pernas e prioridades', () => {
    const sem = gerar(['seg','ter','qui','sex']);
    const com = gerar(['seg','ter','qui','sex'], { focoAgregado: { grupo: 'bracos', semana: 1 } });
    const ids = (r: typeof sem) => r.dias.map(d => d.slots.map(s => [s.exercicio.id,s.series]).sort()).flat();
    expect(ids(com)).not.toEqual(ids(sem));
    const grupos = com.dias.map(d => d.slots.map(s => s.exercicio.grupoPrimario));
    expect(com.blocoFoco?.grupos).toEqual(['biceps','triceps']);
    expect(com.blocoFoco?.adicionais.length).toBeGreaterThan(0);
    expect(grupos.flat()).toEqual(expect.arrayContaining(['quadriceps','posterior','ombros','peito','costas']));
    for (const d of com.dias.filter(d => d.slots.some(s => ['biceps','triceps'].includes(s.exercicio.grupoPrimario!))))
      expect(['biceps','triceps']).toContain(d.slots[0]!.exercicio.grupoPrimario);
  });

});
