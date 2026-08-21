/**
 * 🔒 C1 — distribuição semanal de cardio (primitiva canônica). Fixtures da §8: 25, 26, 27, 34, 35,
 * 40, 41, 42, 46, 47, 48, 49, 50. Duas fases, ordem total, conservação, consolidação, ressalvas.
 */
import { describe, expect, it } from 'vitest';
import {
  construirDistribuicaoCardioSemana,
  validarDistribuicaoCardioSemana,
  type DiaHorizonte,
  type EntradaDistribuicaoSemana,
  type OrcamentoDia,
  type PlanoResistidoTerminalDia,
  type PrescricaoCardioSemana,
} from './distribuicao-cardio-semana';
import { avaliarDuracaoSessao } from './duracao-sessao';

function entrada(o: {
  dias: DiaHorizonte[];
  planos?: PlanoResistidoTerminalDia[];
  orcamentos?: OrcamentoDia[];
  prescricoes: PrescricaoCardioSemana[];
  expectedRevision?: number;
  formulaVersion?: string;
}): EntradaDistribuicaoSemana {
  return {
    aggregateId: 'u1:semana',
    expectedRevision: o.expectedRevision ?? 0,
    formulaVersion: o.formulaVersion ?? 'tempo-v1',
    diasHorizonte: o.dias,
    planosResistidosTerminais: o.planos ?? [],
    orcamentoPorDia: o.orcamentos ?? [],
    prescricoesCardio: o.prescricoes,
  };
}
const dia = (diaId: string, ordem: number, oferecido = true): DiaHorizonte => ({ diaId, ordemNoHorizonte: ordem, oferecido });
const musc = (diaId: string, maxR: number | null): PlanoResistidoTerminalDia => ({ diaId, temMusculacao: true, maxResistidaSegundos: maxR });
const orc = (diaId: string, b: number | undefined): OrcamentoDia => ({ diaId, orcamentoSegundos: b });
const p = (prescricaoId: string, diaOrigemId: string, ordem: number, dur: number): PrescricaoCardioSemana =>
  ({ prescricaoId, diaOrigemId, ordemPrescricao: ordem, duracaoPrescritaSegundos: dur });
const contrato = (d: ReturnType<typeof construirDistribuicaoCardioSemana>, id: string) =>
  d.contratosPorPrescricao.find((c) => c.prescricaoId === id)!;
const bloco = (d: ReturnType<typeof construirDistribuicaoCardioSemana>, diaId: string) =>
  d.blocosPorDia.find((b) => b.diaId === diaId);

describe('C1 distribuição semanal · conservação e destinos (§4)', () => {
  it('fixture 34: prescrito 900, origem usa 300, terça 400, sábado 200, descarte 0 (soma 900)', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('ter', 1), dia('sab', 2)],
      planos: [musc('seg', 2400)],
      orcamentos: [orc('seg', 2700), orc('ter', 400), orc('sab', 200)],
      prescricoes: [p('p1', 'seg', 0, 900)],
    }));
    const c = contrato(d, 'p1');
    expect(c.duracaoUsadaNaSessaoSegundos).toBe(300);
    expect(c.alocacoesDestino).toEqual([{ diaId: 'ter', segundos: 400 }, { diaId: 'sab', segundos: 200 }]);
    expect(c.duracaoDescartadaSegundos).toBe(0);
    // conservação
    expect(c.duracaoUsadaNaSessaoSegundos + c.alocacoesDestino.reduce((s, a) => s + a.segundos, 0) + c.duracaoDescartadaSegundos).toBe(900);
  });

  it('fixture 34 variante: capacidades 400+100 descartam 100', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('ter', 1), dia('sab', 2)],
      planos: [musc('seg', 2400)],
      orcamentos: [orc('seg', 2700), orc('ter', 400), orc('sab', 100)],
      prescricoes: [p('p1', 'seg', 0, 900)],
    }));
    const c = contrato(d, 'p1');
    expect(c.duracaoDescartadaSegundos).toBe(100);
  });

  it('fixture 35/41: duas origens (400+400) para destino B=600 ⇒ um bloco 600 (2 linhagens), descarte 200', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('qua', 1), dia('sab', 2)],
      planos: [musc('seg', 2700), musc('qua', 2700)], // capacidade 0 nas origens ⇒ saldo integral
      orcamentos: [orc('seg', 2700), orc('qua', 2700), orc('sab', 600)],
      prescricoes: [p('pSeg', 'seg', 0, 400), p('pQua', 'qua', 0, 400)],
    }));
    const b = bloco(d, 'sab')!;
    expect(b.duracaoTotalSegundos).toBe(600);
    expect(b.linhagens).toHaveLength(2);
    expect(contrato(d, 'pSeg').alocacoesDestino).toEqual([{ diaId: 'sab', segundos: 400 }]);
    expect(contrato(d, 'pQua').duracaoDescartadaSegundos).toBe(200);
  });

  it('fixture 42: destino com cardio próprio 400 (B=600) recebe só 200, bloco 600, encaminha 100', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('qua', 1), dia('sex', 2)],
      planos: [musc('seg', 2700)], // capacidade 0 na origem ⇒ saldo 300
      orcamentos: [orc('seg', 2700), orc('qua', 600), orc('sex', 50)],
      // qua é destino oferecido, sem musculação, com cardio PRÓPRIO de 400 (capacidade B=600).
      prescricoes: [p('pSeg', 'seg', 0, 300), p('pQua', 'qua', 0, 400)],
    }));
    const bQ = bloco(d, 'qua')!;
    expect(bQ.duracaoTotalSegundos).toBe(600); // 400 próprio + 200 recebido
    const cSeg = contrato(d, 'pSeg');
    expect(cSeg.alocacoesDestino.find((a) => a.diaId === 'qua')!.segundos).toBe(200);
    // os 100 restantes vão ao próximo destino elegível (sex, B=50 ⇒ 50) e o resto descarta.
    expect(cSeg.alocacoesDestino.find((a) => a.diaId === 'sex')?.segundos).toBe(50);
    expect(cSeg.duracaoDescartadaSegundos).toBe(50);
  });

  it('fixture 46: duas prescrições no mesmo dia (B=3600) ⇒ usa 2400/1200, um bloco 3600, 2 linhagens', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0)],
      orcamentos: [orc('seg', 3600)], // dia exclusivo de cardio (sem musculação) ⇒ capacidade B
      prescricoes: [p('p1', 'seg', 0, 2400), p('p2', 'seg', 1, 2400)],
    }));
    expect(contrato(d, 'p1').duracaoUsadaNaSessaoSegundos).toBe(2400);
    expect(contrato(d, 'p2').duracaoUsadaNaSessaoSegundos).toBe(1200);
    const b = bloco(d, 'seg')!;
    expect(b.duracaoTotalSegundos).toBe(3600);
    expect(b.linhagens).toHaveLength(2);
  });
});

describe('C1 distribuição semanal · elegibilidade de destino (§4)', () => {
  it('fixture 26: só dia oferecido e sem musculação recebe; dia vazio NÃO oferecido é rejeitado', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('ter', 1, /*oferecido*/ false), dia('qua', 2), dia('sex', 3), dia('sab', 4)],
      planos: [musc('seg', 2700), musc('qua', 100), musc('sex', 100)], // seg origem cap 0
      orcamentos: [orc('seg', 2700), orc('ter', 3600), orc('qua', 3600), orc('sex', 3600), orc('sab', 3600)],
      prescricoes: [p('p1', 'seg', 0, 900)],
    }));
    const c = contrato(d, 'p1');
    // ter não foi oferecido; qua/sex têm musculação ⇒ só sáb.
    expect(c.alocacoesDestino).toEqual([{ diaId: 'sab', segundos: 900 }]);
  });

  it('fixture 25: destino com musculação NUNCA recebe cardio (não substitui treino)', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('ter', 1)],
      planos: [musc('seg', 2700), musc('ter', 100)], // ter tem musculação
      orcamentos: [orc('seg', 2700), orc('ter', 3600)],
      prescricoes: [p('p1', 'seg', 0, 900)],
    }));
    const c = contrato(d, 'p1');
    expect(c.alocacoesDestino).toHaveLength(0);
    expect(c.duracaoDescartadaSegundos).toBe(900); // sem destino ⇒ descarte
  });

  it('fixture 27: musculação deixa 300; usa 300, sem destino descarta 600', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0)],
      planos: [musc('seg', 2400)],
      orcamentos: [orc('seg', 2700)],
      prescricoes: [p('p1', 'seg', 0, 900)],
    }));
    const c = contrato(d, 'p1');
    expect(c.duracaoUsadaNaSessaoSegundos).toBe(300);
    expect(c.duracaoDescartadaSegundos).toBe(600);
  });

  it('fixture 40/43: saldo da sexta só usa sábado (posterior); segunda é anterior e nunca recebe, sem wrap', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('sex', 4), dia('sab', 5)],
      planos: [musc('sex', 2700)],
      orcamentos: [orc('seg', 3600), orc('sex', 2700), orc('sab', 3600)],
      prescricoes: [p('p1', 'sex', 0, 500)],
    }));
    const c = contrato(d, 'p1');
    expect(c.alocacoesDestino).toEqual([{ diaId: 'sab', segundos: 500 }]);
    expect(bloco(d, 'seg')).toBeUndefined(); // segunda (anterior) nunca recebe
  });

  it('fixture 48: origem usa 0 e sábado recebe 900; a sessão do sábado soma exatamente 900', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('sab', 1)],
      planos: [musc('seg', 2700)], // capacidade 0 na origem
      orcamentos: [orc('seg', 2700), orc('sab', 1800)],
      prescricoes: [p('p1', 'seg', 0, 900)],
    }));
    expect(contrato(d, 'p1').duracaoUsadaNaSessaoSegundos).toBe(0);
    const b = bloco(d, 'sab')!;
    expect(b.duracaoTotalSegundos).toBe(900);
    // avaliação da sessão do sábado (só cardio) soma 900 em MIN e MAX.
    const r = avaliarDuracaoSessao({ itens: [{ tipo: 'CONTINUO', duracaoTotalSegundos: b.duracaoTotalSegundos }], orcamentoSegundos: 1800, origemPlano: 'AUTOMATICO' });
    expect(r.duracaoMinimaEstimadaSegundos).toBe(900);
    expect(r.duracaoMaximaEstimadaSegundos).toBe(900);
  });
});

describe('C1 distribuição semanal · ordem total e ressalvas (§2/§4)', () => {
  it('fixture 49: ordem segue {ordem_no_horizonte, ordem_prescricao, prescricao_id}, não a inserção', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      // quarta aparece ANTES no array, mas segunda tem ordem_no_horizonte anterior.
      dias: [dia('qua', 1), dia('seg', 0), dia('sab', 2)],
      planos: [musc('seg', 2700), musc('qua', 2700)], // ambas capacidade 0 ⇒ saldo integral
      orcamentos: [orc('seg', 2700), orc('qua', 2700), orc('sab', 500)],
      prescricoes: [p('pQua', 'qua', 0, 500), p('pSeg', 'seg', 0, 500)],
    }));
    // capacidade única no sábado (500): segunda (ordem 0) aloca ANTES da quarta (ordem 1).
    expect(contrato(d, 'pSeg').alocacoesDestino).toEqual([{ diaId: 'sab', segundos: 500 }]);
    expect(contrato(d, 'pQua').alocacoesDestino).toHaveLength(0);
    expect(contrato(d, 'pQua').duracaoDescartadaSegundos).toBe(500);
  });

  it('fixture 47: origem com capacidade desconhecida usa 0, pula destino sem orçamento, aloca no conhecido', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('ter', 1), dia('sab', 2)],
      planos: [musc('seg', null)], // musculação NAO_AVALIADO ⇒ capacidade INCALCULÁVEL
      orcamentos: [orc('seg', 2700), orc('ter', undefined), orc('sab', 1800)],
      prescricoes: [p('p1', 'seg', 0, 1800)],
    }));
    expect(d.estado).toBe('CONSTRUIDA_COM_RESSALVAS');
    const c = contrato(d, 'p1');
    expect(c.duracaoUsadaNaSessaoSegundos).toBe(0);
    expect(c.alocacoesDestino).toEqual([{ diaId: 'sab', segundos: 1800 }]); // terça (sem orçamento) foi pulada
  });

  it('fixture 50: dia_id / ordem_no_horizonte duplicado ⇒ NAO_AVALIADA_ESTRUTURAL, zero commit', () => {
    const dup1 = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('seg', 1)], prescricoes: [p('p1', 'seg', 0, 100)],
    }));
    expect(dup1.estado).toBe('NAO_AVALIADA_ESTRUTURAL');
    expect(dup1.contratosPorPrescricao).toHaveLength(0);
    expect(dup1.blocosPorDia).toHaveLength(0);

    const dup2 = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('ter', 0)], prescricoes: [p('p1', 'seg', 0, 100)],
    }));
    expect(dup2.estado).toBe('NAO_AVALIADA_ESTRUTURAL');
  });

  it('fixture 50 (parte 2): entrada válida com uma origem incalculável ⇒ ressalva, demais distribuídas', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('qua', 1), dia('sab', 2)],
      planos: [musc('seg', null), musc('qua', 2700)], // seg incalculável; qua cap 0
      orcamentos: [orc('seg', 2700), orc('qua', 2700), orc('sab', 3600)],
      prescricoes: [p('pSeg', 'seg', 0, 500), p('pQua', 'qua', 0, 500)],
    }));
    expect(d.estado).toBe('CONSTRUIDA_COM_RESSALVAS');
    // a prescrição calculável (qua) ainda é distribuída ao sábado.
    expect(contrato(d, 'pQua').alocacoesDestino).toEqual([{ diaId: 'sab', segundos: 500 }]);
  });
});

describe('C1 distribuição semanal · validador chama o construtor (§8.1)', () => {
  it('distribuição observada IGUAL ao construtor ⇒ VALIDA', () => {
    const e = entrada({
      dias: [dia('seg', 0), dia('sab', 1)],
      planos: [musc('seg', 2400)],
      orcamentos: [orc('seg', 2700), orc('sab', 3600)],
      prescricoes: [p('p1', 'seg', 0, 900)],
    });
    const canonica = construirDistribuicaoCardioSemana(e);
    expect(validarDistribuicaoCardioSemana({ fatosBase: e, distribuicaoObservada: canonica }).tipo).toBe('VALIDA');
  });

  it('distribuição observada ADULTERADA (uso divergente) ⇒ NAO_AVALIADA_ESTRUTURAL', () => {
    const e = entrada({
      dias: [dia('seg', 0), dia('sab', 1)],
      planos: [musc('seg', 2400)],
      orcamentos: [orc('seg', 2700), orc('sab', 3600)],
      prescricoes: [p('p1', 'seg', 0, 900)],
    });
    const canonica = construirDistribuicaoCardioSemana(e);
    // fixture 36/39: contrato adulterado — uso na origem 400 em vez do canônico 300.
    const adulterada = {
      ...canonica,
      contratosPorPrescricao: canonica.contratosPorPrescricao.map((c) => ({ ...c, duracaoUsadaNaSessaoSegundos: 400 })),
    };
    expect(validarDistribuicaoCardioSemana({ fatosBase: e, distribuicaoObservada: adulterada }).tipo).toBe('NAO_AVALIADA_ESTRUTURAL');
  });

  it('determinismo: mesma entrada ⇒ mesmo canonical_input_hash', () => {
    const e = entrada({ dias: [dia('seg', 0), dia('sab', 1)], orcamentos: [orc('seg', 3600)], prescricoes: [p('p1', 'seg', 0, 900)] });
    expect(construirDistribuicaoCardioSemana(e).canonicalInputHash).toBe(construirDistribuicaoCardioSemana(e).canonicalInputHash);
  });
});
