import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { ORDEM_SEMANA } from '../semana';
import { gerarTreino } from './index';
import { avaliarDuracaoSessao } from './duracao-sessao';
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

const duracaoResistida = avaliarDuracaoSessao({
  itens: [{
    tipo: 'RESISTIDO', series: 2, descansoEntreSeriesSeg: 90,
    execucao: { tipo: 'REPETICOES', segundosEstimadosPorSerie: 40 },
    tecnica: { tipo: 'SEM_TECNICA' },
  }],
  orcamentoSegundos: 3600,
  origemPlano: 'AUTOMATICO',
});

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
    expect(contaB.distribuicaoCardio?.contratosPorPrescricao).toEqual([]);
  });

  it('F18: cardio automático não pode usar a tolerância exclusiva da musculação', () => {
    const resultado = avaliarDuracaoSessao({
      itens: [{ tipo: 'CONTINUO', duracaoTotalSegundos: 3000 }],
      orcamentoSegundos: 2700,
      origemPlano: 'AUTOMATICO',
    });

    expect(resultado.estadoLimite).toBe('ACIMA_DO_LIMITE_OPERACIONAL');
    expect(resultado.motivosLimite).toContain('CARDIO_AUTOMATICO_NAO_ADAPTADO');
  });

  it('F20: rejeita linhas de plano/orçamento fora do horizonte ou duplicadas', () => {
    const fatos = fatosDistribuicaoCardioDaRotina({
      diasComMusculacao: [{ diaId: 'ter', duracao: duracaoResistida }],
      diasOferecidosCardio: ['ter', 'dom'],
      orcamentoSegundos: 3600,
      cardioPrescritoPorDiaSegundos: 900,
      aggregateId: 'teste-c11b', expectedRevision: 4, formulaVersion: 'tempo-v4',
    });

    const fora = construirDistribuicaoCardioSemana({
      ...fatos,
      planosResistidosTerminais: [
        ...fatos.planosResistidosTerminais,
        { diaId: 'fantasma', temMusculacao: false, maxResistidaSegundos: 0 },
      ],
    });
    const duplicado = construirDistribuicaoCardioSemana({
      ...fatos,
      orcamentoPorDia: [...fatos.orcamentoPorDia, fatos.orcamentoPorDia[0]!],
    });

    expect(fora.estado).toBe('NAO_AVALIADA_ESTRUTURAL');
    expect(fora.motivos.join(' ')).toMatch(/fora do horizonte/);
    expect(duplicado.estado).toBe('NAO_AVALIADA_ESTRUTURAL');
    expect(duplicado.motivos.join(' ')).toMatch(/duplicado/);
  });

  it('F20: o validador rejeita identidade, revisão e motivos adulterados', () => {
    const fatos = fatosDistribuicaoCardioDaRotina({
      diasComMusculacao: [{ diaId: 'ter', duracao: duracaoResistida }],
      diasOferecidosCardio: ['ter', 'dom'],
      orcamentoSegundos: 3600,
      cardioPrescritoPorDiaSegundos: 900,
      aggregateId: 'teste-c11b', expectedRevision: 4, formulaVersion: 'tempo-v4',
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
