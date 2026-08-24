/**
 * 🔒 C1 §5.8 — FIXTURE DOURADA por versão da fórmula. Amarra `formula_version` a uma saída canônica
 * EXATA: se alguém mudar faixa/estado/componentes/distribuição SEM bumpar a versão, esta fixture
 * quebra (a versão continua 'tempo-v4' mas a saída mudou). Também morre se a versão for bumpada sem
 * atualizar a dourada — forçando o par {versão, semântica} a andar junto.
 */
import { describe, expect, it } from 'vitest';
import { avaliarDuracaoSessao, FORMULA_DURACAO_VERSION, type ItemDuracao } from './duracao-sessao';

const reps = (series: number, descanso: number): ItemDuracao => ({
  tipo: 'RESISTIDO', series, descansoEntreSeriesSeg: descanso,
  execucao: { tipo: 'REPETICOES', segundosEstimadosPorSerie: 40 }, tecnica: { tipo: 'SEM_TECNICA' },
});

describe('C1.1-B · fixture dourada tempo-v4', () => {
  it('a versão vigente é tempo-v4 (semana real + cardio automático adaptado)', () => {
    expect(FORMULA_DURACAO_VERSION).toBe('tempo-v4');
  });

  it('fixture 1 (caso curto medido) tem saída canônica EXATA sob tempo-v4', () => {
    // 4 itens 4×, descansos 60/90/90/60, orçamento 1800.
    const r = avaliarDuracaoSessao({
      itens: [reps(4, 60), reps(4, 90), reps(4, 90), reps(4, 60)],
      orcamentoSegundos: 1800,
    });
    expect(r).toMatchObject({
      formulaVersion: 'tempo-v4',
      estadoCalculo: 'CALCULADO',
      estadoLimite: 'DENTRO_DO_LIMITE',
      duracaoMinimaEstimadaSegundos: 1540, // exec 640 + descanso 900
      duracaoMaximaEstimadaSegundos: 1780, // + transições 60+90+90 = 240
      limiteOperacionalSegundos: 2280,
    });
    expect(r.componentes).toEqual({
      execucaoSegundos: 640, descansoSegundos: 900, continuoSegundos: 0,
      adicionalTecnicaSegundos: 0, transicaoSegundos: 240,
    });
  });

  it('golden do cardio editado (fixture 28) sob tempo-v4', () => {
    const r = avaliarDuracaoSessao({ itens: [{ tipo: 'CONTINUO', duracaoTotalSegundos: 3000 }], orcamentoSegundos: 2700, origemPlano: 'EDITADO' });
    expect(r.formulaVersion).toBe('tempo-v4');
    expect(r.estadoLimite).toBe('ACIMA_DO_LIMITE_OPERACIONAL');
    expect(r.motivosLimite).toContain('CARDIO_EXCEDE_TEMPO_DISPONIVEL');
  });
});
