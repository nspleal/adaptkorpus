import { describe, expect, it } from 'vitest';
import { doPlano, paraRotinaCustom } from '@/components/painel/EditorTreino';
import { gerarTreino } from './engine';
import { EXERCISES } from './data/exercises';
import type { PerfilTreino, RotinaCustom, RotinaSemanal } from './engine/treino-types';
import type { OpcoesSemana } from './engine/treino-montador';

/**
 * 🔴 RETOMADA — ABRIR O EDITOR NÃO PODE COBRAR UMA SÉRIE PELA ORDEM DA RAMPA.
 *
 * Medido na validação de coordenação do candidato `5d81d227`: a rampa da retomada reparte o
 * volume do grupo em round-robin na ordem (dia, slot) e o ramo automático REORDENA os slots
 * depois (`reordenarPeloFoco`). O desenho que o editor persiste está na ordem final, então ao
 * reabrir a rampa roda sobre OUTRA permutação: o mesmo total do grupo caía em slots diferentes
 * e o `min(escolhida, série do slot)` guardava o menor dos dois — ombros `3/3/2/3` contra
 * `3/3/3/2` virava `3/3/2/2`. Uma série sumia em **36 dos 96** contextos de rampa, só quando
 * `preferencias.trocas` e `foco` apareciam juntos (o perfil-base de `RECUPERACAO.json` não
 * tinha trocas e deixou a combinação descoberta).
 *
 * 🔒 Comparar totais NÃO prova preservação: o commit anterior a `5d81d227` empatava o total
 * compensando +1 num slot e −1 em outro. Estes testes comparam **dia, id e séries de cada
 * slot** — nenhuma compensação é aceita como equivalência.
 */

/** Perfil sintético e descartável que reproduz o caso medido: trocas + foco. */
const PERFIL: PerfilTreino = {
  pesoKg: 80, alturaCm: 180, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'massa', nivelExperiencia: 'avancado', equipamento: 'academia',
  diasDisponiveis: 5, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], tempoPorSessaoMin: 75,
  divisaoPreferida: 'prioridades', foco: { grupo: 'peito', compensa: 'ombros', semana: 1 },
  preferencias: {
    trocas: [{ de: 'e14', para: 'e130' }, { de: 'e52', para: 'e53' }, { de: 'e53', para: 'e106' },
      { de: 'e106', para: 'e52' }, { de: 'e1', para: 'e156' }],
    banidos: [],
  },
};

const FATORES = [0.5, 0.7, 0.8, 0.9] as const;         // RETOMADA_FATORES_CURTA/LONGA
const REFERENCIAS = [10, 12, 14, 16, 18, 20] as const; // faixa de `volumePorGrupoSemana`
const RAMPAS = [1, 2, 3, 4] as const;

const RETOMADAS: OpcoesSemana[] = FATORES.flatMap((fator) =>
  REFERENCIAS.flatMap((volumeReferencia) =>
    RAMPAS.map((semana) => ({ semana: 3, retomada: { semana, fator, volumeReferencia } }))));

const gerar = (p: PerfilTreino, ctx: OpcoesSemana) => gerarTreino(p, { exercises: EXERCISES, semanaCiclo: ctx }).rotina!;
const abrir = (r: RotinaSemanal, p: PerfilTreino, ctx?: OpcoesSemana) => doPlano(r.dias, p.treinoDias ?? [], p.rotinaCustom, ctx?.retomada);
/** Dia + id + séries de CADA slot — nunca o total, que compensação disfarça. */
const dose = (r: RotinaSemanal) => r.dias.map((d) => ({ dia: d.diaId, slots: d.slots.map((s) => [s.exercicio.id, s.series] as const) }));
const total = (r: RotinaSemanal) => r.dias.reduce((n, d) => n + d.slots.reduce((m, s) => m + (s.series ?? 0), 0), 0);
const json = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe('Retomada · transferência ao editor conserva a dose slot a slot', () => {
  it('a matriz de rampa tem os 96 contextos medidos', () => {
    expect(RETOMADAS).toHaveLength(96);
  });

  it('os 96 contextos: abrir sem editar e prever devolve dia, id e séries idênticos', () => {
    const divergencias: string[] = [];
    for (const ctx of RETOMADAS) {
      const automatico = gerar(PERFIL, ctx);
      const custom = json(paraRotinaCustom(abrir(automatico, PERFIL, ctx)));
      const previsto = gerar({ ...PERFIL, rotinaCustom: custom }, ctx);
      const { fator, volumeReferencia, semana } = ctx.retomada!;
      for (const dia of automatico.dias) {
        for (const s of dia.slots) {
          const depois = previsto.dias.find((d) => d.diaId === dia.diaId)?.slots.find((x) => x.exercicio.id === s.exercicio.id);
          if (depois?.series !== s.series) {
            divergencias.push(`f${fator}/v${volumeReferencia}/r${semana} ${dia.diaId}/${s.exercicio.id}: ${s.series} -> ${depois?.series ?? 'ausente'}`);
          }
        }
      }
    }
    expect(divergencias).toEqual([]);
  });

  it('anti-vacuidade: o grupo do caso medido existe, é repartido desigualmente e a rampa corta de verdade', () => {
    const ctx: OpcoesSemana = { semana: 3, retomada: { semana: 2, fator: 0.7, volumeReferencia: 16 } };
    const r = gerar(PERFIL, ctx);
    const ombros = r.dias.flatMap((d) => d.slots.filter((s) => s.exercicio.grupoPrimario === 'ombros').map((s) => s.series));
    // 4 slots e repartição desigual: é a permutação desse grupo que trocava de slot.
    expect(ombros.length).toBeGreaterThanOrEqual(4);
    expect(new Set(ombros).size).toBeGreaterThan(1);
    // O plano de rampa é MENOR que o da semana cheia — a matriz não está medindo o plano normal.
    expect(total(r)).toBeLessThan(total(gerar(PERFIL, { semana: 1 })));
  });

  it('cinco ciclos de salvar/reabrir na rampa não movem a dose nem a intenção', () => {
    const ctx: OpcoesSemana = { semana: 3, retomada: { semana: 2, fator: 0.7, volumeReferencia: 16 } };
    const automatico = gerar(PERFIL, ctx);
    const primeiro = json(paraRotinaCustom(abrir(automatico, PERFIL, ctx)));
    let atual = primeiro;
    for (let i = 0; i < 5; i += 1) {
      const salvo: PerfilTreino = { ...PERFIL, rotinaCustom: json(atual) };
      const r = gerar(salvo, ctx);
      expect(dose(r)).toEqual(dose(automatico));
      atual = json(paraRotinaCustom(abrir(r, salvo, ctx)));
      expect(atual).toEqual(primeiro);
    }
  });

  it('sair da rampa conserva a intenção salva; o motor não a multiplica nem recupera o que cortou', () => {
    const rampa: OpcoesSemana = { semana: 3, retomada: { semana: 2, fator: 0.7, volumeReferencia: 16 } };
    const custom = json(paraRotinaCustom(abrir(gerar(PERFIL, rampa), PERFIL)));
    const salvo: PerfilTreino = { ...PERFIL, rotinaCustom: custom };
    for (const depois of [{ semana: 1 }, { semana: 5 }, { semana: 6 }] as OpcoesSemana[]) {
      const r = gerar(salvo, depois);
      // O desenho e as escolhas salvas continuam os mesmos ao reabrir.
      expect(paraRotinaCustom(abrir(r, salvo))).toEqual(custom);
      for (const dia of r.dias) {
        for (const s of dia.slots) {
          const escolhida = custom.dias.find((d) => d.diaId === dia.diaId)?.seriesPorExercicio?.[s.exercicio.id];
          if (escolhida == null) continue;
          expect(s.series).toBeLessThanOrEqual(escolhida);
          // Semana normal entrega a escolha; a semana 6 reduz UMA vez e nunca uma segunda.
          if (depois.semana !== 6) expect(s.series).toBe(escolhida);
          else expect(s.series).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('custom com escolhas parciais: a rampa respeita a escolha como teto e não inventa onde não há', () => {
    const ctx: OpcoesSemana = { semana: 3, retomada: { semana: 2, fator: 0.7, volumeReferencia: 16 } };
    const semEscolha: RotinaCustom = {
      origem: 'usuario',
      dias: [{ nome: 'Meu', diaId: 'qui', exercicioIds: ['e54', 'e41', 'e111', 'e107'] }],
    };
    const comUma: RotinaCustom = { origem: 'usuario', dias: [{ ...semEscolha.dias[0]!, seriesPorExercicio: { e111: 1 } }] };
    const p = (c: RotinaCustom): PerfilTreino => ({ ...PERFIL, rotinaCustom: json(c), treinoDias: ['qui'], diasDisponiveis: 1 });
    // Sem escolha nenhuma, a rampa decide como sempre e o editor não passa a fabricar intenção.
    expect(paraRotinaCustom(abrir(gerar(p(semEscolha), ctx), p(semEscolha)))).toEqual(semEscolha);
    const r = gerar(p(comUma), ctx);
    expect(r.dias[0]!.slots.find((s) => s.exercicio.id === 'e111')?.series).toBe(1);
    expect(paraRotinaCustom(abrir(r, p(comUma)))).toEqual(comUma);
  });
});

/**
 * 🔒 O caso normal relatado pela coordenação, preso por número: 35 exercícios / 120 séries,
 * 24/24/24/28/20, o Voador da segunda em 4 e os dois adicionais do foco na quinta em 2 cada.
 * A correção da rampa não tem autoridade fora da retomada — este bloco é a prova disso.
 */
describe('Semana normal · o caso medido na prévia não se move', () => {
  const semana1: OpcoesSemana = { semana: 1 };
  it('plano automático e editor entregam a mesma dose, exercício a exercício', () => {
    const r = gerar(PERFIL, semana1);
    expect(r.dias.map((d) => [d.slots.length, d.slots.reduce((n, s) => n + (s.series ?? 0), 0)]))
      .toEqual([[7, 24], [7, 24], [6, 24], [9, 28], [6, 20]]);
    expect(total(r)).toBe(120);
    expect(r.dias.flatMap((d) => d.slots)).toHaveLength(35);
    expect(r.dias[0]!.slots.find((s) => s.exercicio.id === 'e130')?.series).toBe(4);
    // Os dois adicionais do foco moram na quinta, com 2 séries cada.
    expect(r.dias[3]!.slots.slice(0, 2).map((s) => [s.exercicio.id, s.series]))
      .toEqual([['e156', 2], ['e130', 2]]);
    const custom = json(paraRotinaCustom(abrir(r, PERFIL)));
    const previsto = gerar({ ...PERFIL, rotinaCustom: custom }, semana1);
    expect(dose(previsto)).toEqual(dose(r));
    expect(total(previsto)).toBe(120);
  });
});
