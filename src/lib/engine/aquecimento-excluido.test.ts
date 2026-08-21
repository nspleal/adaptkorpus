/**
 * 🔒 C1 — FIXTURE 19 (§8.2): AQUECIMENTO EXCLUÍDO, provado por EXECUÇÃO (não por ausência de campo).
 *
 * O override do autor (2026-08-20) manda: "variar o aquecimento entre ausente, `0` e uma duração
 * positiva não muda a faixa nem o estado temporal". Este teste avalia a MESMA sessão nas três
 * variações e exige resultado IDÊNTICO (deep equal), incluindo `componentes`.
 *
 * 🔴 MUTAÇÃO QUE ESTE TESTE MATA: somar o aquecimento em qualquer componente (execução, descanso,
 * transição, contínuo) ou deixá-lo produzir `NAO_AVALIADO`. Se o aquecimento voltar a entrar na
 * duração, os três resultados divergem e o teste morre.
 */
import { describe, expect, it } from 'vitest';
import { avaliarDuracaoSessao, type EntradaDuracao, type ItemDuracao } from './duracao-sessao';

const reps = (series: number, descanso: number): ItemDuracao => ({
  tipo: 'RESISTIDO', series, descansoEntreSeriesSeg: descanso,
  execucao: { tipo: 'REPETICOES', segundosEstimadosPorSerie: 40 }, tecnica: { tipo: 'SEM_TECNICA' },
});

/** A MESMA sessão nos três casos — só o aquecimento varia. */
const SESSAO: Omit<EntradaDuracao, 'aquecimentoSegundos'> = {
  itens: [reps(4, 60), reps(4, 90), reps(4, 90), reps(4, 60)],
  orcamentoSegundos: 1800,
};

describe('C1 fixture 19 · aquecimento não altera faixa nem estado', () => {
  const ausente = avaliarDuracaoSessao({ ...SESSAO });
  const zero = avaliarDuracaoSessao({ ...SESSAO, aquecimentoSegundos: 0 });
  const positivo = avaliarDuracaoSessao({ ...SESSAO, aquecimentoSegundos: 600 });

  it('ausente × 0 × positivo produzem resultado IDÊNTICO (deep equal, com componentes)', () => {
    expect(zero).toEqual(ausente);
    expect(positivo).toEqual(ausente);
  });

  it('a faixa medida é a da fixture 1 nos três casos (1540–1780), sem os 600 s do aquecimento', () => {
    for (const r of [ausente, zero, positivo]) {
      expect(r.duracaoMinimaEstimadaSegundos).toBe(1540);
      expect(r.duracaoMaximaEstimadaSegundos).toBe(1780);
      expect(r.estadoLimite).toBe('DENTRO_DO_LIMITE');
    }
    // guard explícito da mutação: 1540+600 e 1780+600 NÃO podem aparecer.
    expect(positivo.duracaoMinimaEstimadaSegundos).not.toBe(2140);
    expect(positivo.duracaoMaximaEstimadaSegundos).not.toBe(2380);
  });

  it('nenhum componente absorve o aquecimento', () => {
    expect(positivo.componentes).toEqual(ausente.componentes);
    expect(positivo.componentes).toEqual({
      execucaoSegundos: 640, descansoSegundos: 900, continuoSegundos: 0,
      adicionalTecnicaSegundos: 0, transicaoSegundos: 240,
    });
  });

  it('aquecimento de domínio inválido NÃO produz NAO_AVALIADO (não é entrada temporal do C1)', () => {
    for (const aquecimentoSegundos of [-1, 10.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2]) {
      const r = avaliarDuracaoSessao({ ...SESSAO, aquecimentoSegundos });
      expect(r.estadoCalculo).toBe('CALCULADO');
      expect(r).toEqual(ausente);
    }
  });

  it('a exclusão vale também quando o estado é de TOLERÂNCIA (não só no verde)', () => {
    const apertada: Omit<EntradaDuracao, 'aquecimentoSegundos'> = { itens: [reps(4, 60), reps(4, 90), reps(4, 90), reps(4, 60)], orcamentoSegundos: 1700 };
    const semA = avaliarDuracaoSessao({ ...apertada });
    const comA = avaliarDuracaoSessao({ ...apertada, aquecimentoSegundos: 900 });
    expect(semA.estadoLimite).toBe('DENTRO_DA_TOLERANCIA');
    expect(comA).toEqual(semA); // o aquecimento não empurra para ACIMA
  });
});
