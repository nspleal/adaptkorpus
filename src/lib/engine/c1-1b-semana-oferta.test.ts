import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { ORDEM_SEMANA } from '../semana';
import { gerarTreino } from './index';
import {
  construirDistribuicaoCardioSemana,
  validarDistribuicaoCardioSemana,
} from './distribuicao-cardio-semana';
import { fatosDistribuicaoCardioDaRotina } from './treino-cardio-semana';
import type { PerfilTreino } from './treino-types';

const perfil: PerfilTreino = {
  pesoKg: 80,
  alturaCm: 180,
  idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'emagrecimento',
  nivelExperiencia: 'intermediario',
  equipamento: 'academia',
  equipamentosCasa: [],
  diasDisponiveis: 3,
  treinoDias: ['ter', 'qui', 'sab'],
  tempoPorSessaoMin: 60,
};

describe('C1.1-B · semana real, oferta isolada e contratos verificáveis', () => {
  it('F13: materializa Seg→Dom e preserva a agenda real, sem ids artificiais', () => {
    const rotina = gerarTreino(perfil, {
      exercises: EXERCISES,
      semanaCiclo: { semana: 1 },
      diasOferecidosCardio: ['ter', 'dom'],
    }).rotina!;

    expect(rotina.planoFinalPorDia?.map((dia) => dia.diaId)).toEqual(ORDEM_SEMANA);
    expect(rotina.fatosDistribuicaoCardio?.diasHorizonte.map((dia) => dia.diaId)).toEqual(ORDEM_SEMANA);
    expect(rotina.planoFinalPorDia?.filter((dia) => dia.treinoIdx != null).map((dia) => dia.diaId))
      .toEqual(['ter', 'qui', 'sab']);
    expect(rotina.fatosDistribuicaoCardio?.diasHorizonte.filter((dia) => dia.oferecido).map((dia) => dia.diaId))
      .toEqual(['ter', 'dom']);
    expect(rotina.planoFinalPorDia?.every((dia) => !dia.diaId.startsWith('dia-'))).toBe(true);
  });

  it('F14: uma geração sem oferta não herda a oferta de outra conta/montagem', () => {
    const contaA = gerarTreino(perfil, {
      exercises: EXERCISES, semanaCiclo: { semana: 1 }, diasOferecidosCardio: ['dom'],
    }).rotina!;
    const contaB = gerarTreino(perfil, {
      exercises: EXERCISES, semanaCiclo: { semana: 1 }, diasOferecidosCardio: [],
    }).rotina!;

    expect(contaA.fatosDistribuicaoCardio?.diasHorizonte.find((dia) => dia.diaId === 'dom')?.oferecido).toBe(true);
    expect(contaB.fatosDistribuicaoCardio?.diasHorizonte.some((dia) => dia.oferecido)).toBe(false);
    expect(contaB.fatosDistribuicaoCardio?.prescricoesCardio).toEqual([]);
    expect(contaB.distribuicaoCardio?.blocosPorDia).toEqual([]);
  });

  it('F18 (decisão 2026-09-23): o cardio do dia de treino não entra no tempo nem na tolerância da musculação', () => {
    const com = gerarTreino(perfil, { exercises: EXERCISES, semanaCiclo: { semana: 1 }, diasOferecidosCardio: ['ter', 'dom'] }).rotina!;
    const sem = gerarTreino(perfil, { exercises: EXERCISES, semanaCiclo: { semana: 1 }, diasOferecidosCardio: [] }).rotina!;
    const ter = (r: typeof com) => r.planoFinalPorDia!.find((dia) => dia.diaId === 'ter')!;
    expect(ter(com).tipo).toBe('TREINO_E_CARDIO');
    expect(ter(com).cardio!.duracaoSegundos).toBeGreaterThan(0);
    expect(ter(com).duracao).toEqual(ter(sem).duracao);
    expect(ter(com).duracao.motivosLimite).toEqual([]);
  });

  it('F20: rejeita dia ou prescrição fora do horizonte e dia duplicado', () => {
    const fatos = fatosDistribuicaoCardioDaRotina({
      diasOferecidosCardio: ['ter', 'dom'],
      cardioPrescritoPorDiaSegundos: 900,
      aggregateId: 'teste-c11b', expectedRevision: 4, formulaVersion: 'tempo-v5',
    });

    const fora = construirDistribuicaoCardioSemana({
      ...fatos,
      prescricoesCardio: [
        ...fatos.prescricoesCardio,
        { prescricaoId: 'fantasma', diaOrigemId: 'fantasma', ordemPrescricao: 0, duracaoPrescritaSegundos: 900 },
      ],
    });
    const duplicado = construirDistribuicaoCardioSemana({
      ...fatos,
      diasHorizonte: [...fatos.diasHorizonte, fatos.diasHorizonte[0]!],
    });

    expect(fora.estado).toBe('NAO_AVALIADA_ESTRUTURAL');
    expect(fora.motivos.join(' ')).toMatch(/fora do horizonte/);
    expect(duplicado.estado).toBe('NAO_AVALIADA_ESTRUTURAL');
    expect(duplicado.motivos.join(' ')).toMatch(/duplicado/);
  });

  it('F20: o validador rejeita identidade, revisão e motivos adulterados', () => {
    const fatos = fatosDistribuicaoCardioDaRotina({
      diasOferecidosCardio: ['ter', 'dom'],
      cardioPrescritoPorDiaSegundos: 900,
      aggregateId: 'teste-c11b', expectedRevision: 4, formulaVersion: 'tempo-v5',
    });
    const observada = construirDistribuicaoCardioSemana(fatos);
    const adulterada = {
      ...observada,
      aggregateId: 'outra-conta',
      expectedRevision: 999,
      motivos: ['DECLARACAO_FORJADA'],
    };

    expect(validarDistribuicaoCardioSemana({ fatosBase: fatos, distribuicaoObservada: adulterada }).tipo)
      .toBe('NAO_AVALIADA_ESTRUTURAL');
  });
});
