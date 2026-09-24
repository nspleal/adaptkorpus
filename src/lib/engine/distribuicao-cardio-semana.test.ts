/**
 * 🔒 C1 — distribuição semanal de cardio (primitiva canônica). Decisão do autor 2026-09-23: o
 * cardio conserva a duração prescrita inteira no dia de origem — sem capacidade derivada do tempo
 * da musculação, sem saldo, redistribuição ou descarte. Continuam valendo: ordem total canônica,
 * consolidação em um bloco por dia, erro estrutural fail-safe e validador que chama o construtor
 * (fixtures 46, 49, 50 da §8).
 */
import { describe, expect, it } from 'vitest';
import {
  construirDistribuicaoCardioSemana,
  validarDistribuicaoCardioSemana,
  type DiaHorizonte,
  type EntradaDistribuicaoSemana,
  type PrescricaoCardioSemana,
} from './distribuicao-cardio-semana';

function entrada(o: { dias: DiaHorizonte[]; prescricoes: PrescricaoCardioSemana[] }): EntradaDistribuicaoSemana {
  return {
    aggregateId: 'u1:semana', expectedRevision: 0, formulaVersion: 'tempo-v1',
    diasHorizonte: o.dias, prescricoesCardio: o.prescricoes,
  };
}
const dia = (diaId: string, ordem: number, oferecido = true): DiaHorizonte => ({ diaId, ordemNoHorizonte: ordem, oferecido });
const p = (prescricaoId: string, diaOrigemId: string, ordem: number, dur: number): PrescricaoCardioSemana =>
  ({ prescricaoId, diaOrigemId, ordemPrescricao: ordem, duracaoPrescritaSegundos: dur });
const bloco = (d: ReturnType<typeof construirDistribuicaoCardioSemana>, diaId: string) =>
  d.blocosPorDia.find((b) => b.diaId === diaId);

describe('cardio conserva a duração prescrita (decisão 2026-09-23)', () => {
  it('antigo fixture 34: 900 s prescritos na segunda ficam inteiros na segunda — nada vai a terça/sábado', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('ter', 1), dia('sab', 2)],
      prescricoes: [p('p1', 'seg', 0, 900)],
    }));
    expect(d.estado).toBe('CONSTRUIDA');
    expect(d.blocosPorDia).toEqual([{
      diaId: 'seg', duracaoTotalSegundos: 900,
      linhagens: [{ prescricaoId: 'p1', diaOrigemId: 'seg', ordemPrescricao: 0, segundos: 900 }],
    }]);
  });

  it('cada dia oferecido fica só com o próprio cardio: nenhum bloco recebe parcela de outro dia', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('qua', 1), dia('sab', 2)],
      prescricoes: [p('pSeg', 'seg', 0, 2700), p('pQua', 'qua', 0, 2700), p('pSab', 'sab', 0, 5400)],
    }));
    expect(d.blocosPorDia.map((b) => [b.diaId, b.duracaoTotalSegundos])).toEqual([['seg', 2700], ['qua', 2700], ['sab', 5400]]);
    for (const b of d.blocosPorDia) for (const l of b.linhagens) expect(l.diaOrigemId).toBe(b.diaId);
  });

  it('fixture 46: duas prescrições no mesmo dia somam um único bloco (2400 + 2400), sem teto compartilhado', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0)], prescricoes: [p('p2', 'seg', 1, 2400), p('p1', 'seg', 0, 2400)],
    }));
    expect(bloco(d, 'seg')!.duracaoTotalSegundos).toBe(4800);
    expect(bloco(d, 'seg')!.linhagens.map((l) => l.prescricaoId)).toEqual(['p1', 'p2']); // ordem_prescricao
  });
});

describe('C1 distribuição semanal · ordem total e erro estrutural (§2/§4)', () => {
  it('fixture 49: blocos seguem ordem_no_horizonte, não a ordem de inserção', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('qua', 1), dia('seg', 0), dia('sab', 2)],
      prescricoes: [p('pQua', 'qua', 0, 500), p('pSeg', 'seg', 0, 500)],
    }));
    expect(d.blocosPorDia.map((b) => b.diaId)).toEqual(['seg', 'qua']);
  });

  it('fixture 50: dia_id / ordem_no_horizonte duplicado ⇒ NAO_AVALIADA_ESTRUTURAL, zero commit', () => {
    const dup1 = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('seg', 1)], prescricoes: [p('p1', 'seg', 0, 100)],
    }));
    expect(dup1.estado).toBe('NAO_AVALIADA_ESTRUTURAL');
    expect(dup1.blocosPorDia).toHaveLength(0);

    const dup2 = construirDistribuicaoCardioSemana(entrada({
      dias: [dia('seg', 0), dia('ter', 0)], prescricoes: [p('p1', 'seg', 0, 100)],
    }));
    expect(dup2.estado).toBe('NAO_AVALIADA_ESTRUTURAL');
  });

  it('prescrição em dia não oferecido ou com duração inválida ⇒ NAO_AVALIADA_ESTRUTURAL', () => {
    for (const prescricoes of [[p('p1', 'ter', 0, 900)], [p('p1', 'seg', 0, 0)], [p('p1', 'seg', 0, 10.5)]]) {
      const d = construirDistribuicaoCardioSemana(entrada({ dias: [dia('seg', 0), dia('ter', 1, false)], prescricoes }));
      expect(d.estado).toBe('NAO_AVALIADA_ESTRUTURAL');
      expect(d.blocosPorDia).toHaveLength(0);
    }
  });
});

describe('C1 distribuição semanal · validador chama o construtor (§8.1)', () => {
  const e = entrada({ dias: [dia('seg', 0), dia('sab', 1)], prescricoes: [p('p1', 'seg', 0, 900)] });

  it('distribuição observada IGUAL ao construtor ⇒ VALIDA', () => {
    const canonica = construirDistribuicaoCardioSemana(e);
    expect(validarDistribuicaoCardioSemana({ fatosBase: e, distribuicaoObservada: canonica }).tipo).toBe('VALIDA');
  });

  it('distribuição observada ADULTERADA (bloco cortado a 300 s) ⇒ NAO_AVALIADA_ESTRUTURAL', () => {
    const canonica = construirDistribuicaoCardioSemana(e);
    const adulterada = { ...canonica, blocosPorDia: canonica.blocosPorDia.map((b) => ({ ...b, duracaoTotalSegundos: 300 })) };
    expect(validarDistribuicaoCardioSemana({ fatosBase: e, distribuicaoObservada: adulterada }).tipo).toBe('NAO_AVALIADA_ESTRUTURAL');
  });

  it('determinismo: mesma entrada ⇒ mesmo canonical_input_hash; outra oferta ⇒ outro hash', () => {
    expect(construirDistribuicaoCardioSemana(e).canonicalInputHash).toBe(construirDistribuicaoCardioSemana(e).canonicalInputHash);
    const outra = entrada({ dias: [dia('seg', 0), dia('sab', 1, false)], prescricoes: [p('p1', 'seg', 0, 900)] });
    expect(construirDistribuicaoCardioSemana(outra).canonicalInputHash).not.toBe(construirDistribuicaoCardioSemana(e).canonicalInputHash);
  });
});
