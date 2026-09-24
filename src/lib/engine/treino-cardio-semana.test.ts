/**
 * 🔒 C1 — FIAÇÃO VIVA da distribuição de cardio no gerador real. Testes do autor (2026-08-21):
 * dias oferecidos honrados, dia vago não oferecido rejeitado, musculação intocada, hash
 * determinístico pela oferta e a materialização no caminho real de montarRotina. Decisão de
 * 2026-09-23: o cardio conserva a duração prescrita — a ponte nem recebe o tempo da musculação.
 */
import { describe, expect, it } from 'vitest';
import { distribuirCardioDaRotina } from './treino-cardio-semana';
import { avaliarDuracaoSessao, type ItemDuracao } from './duracao-sessao';
import { montarRotina } from './treino-montador';
import { prescreverTreino } from './treino';
import { avaliarGateTreino } from './treino-gate';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino } from './treino-types';
import type { FlagsSaude } from './types';

const base = { cardioPrescritoPorDiaSegundos: 1800, aggregateId: 'rotina-cardio', expectedRevision: 0, formulaVersion: 'tempo-v2' };

describe('C1 fiação viva · dias oferecidos (autor 2026-08-21)', () => {
  it('teste 1/2: oferece ter(1) e sáb(5); só esses recebem cardio; quinta vaga não oferecida fica sem', () => {
    const d = distribuirCardioDaRotina({ ...base, diasOferecidosCardio: [1, 5] });
    expect(d.blocosPorDia.map((b) => b.diaId)).toEqual(['ter', 'sab']);
    expect(d.blocosPorDia.some((b) => b.diaId === 'qui')).toBe(false);
  });

  it('cada dia oferecido recebe exatamente a própria prescrição, sem parcela vinda de outro dia', () => {
    const d = distribuirCardioDaRotina({ ...base, diasOferecidosCardio: ['qua', 'sab'] });
    expect(d.blocosPorDia.map((b) => [b.diaId, b.duracaoTotalSegundos])).toEqual([['qua', 1800], ['sab', 1800]]);
    for (const b of d.blocosPorDia) expect(b.linhagens.map((l) => l.diaOrigemId)).toEqual([b.diaId]);
  });

  it('teste 5: mudar os dias oferecidos muda a distribuição E o canonical_input_hash (determinístico)', () => {
    const a = distribuirCardioDaRotina({ ...base, diasOferecidosCardio: [1, 5] });
    const b = distribuirCardioDaRotina({ ...base, diasOferecidosCardio: [2, 4] });
    expect(a.canonicalInputHash).not.toBe(b.canonicalInputHash);
    expect(a.canonicalInputHash).toBe(distribuirCardioDaRotina({ ...base, diasOferecidosCardio: [1, 5] }).canonicalInputHash);
  });

  it('meta em sessões (sem minutos) não cria bloco com duração inventada', () => {
    const d = distribuirCardioDaRotina({ ...base, cardioPrescritoPorDiaSegundos: 0, diasOferecidosCardio: ['seg', 'sab'] });
    expect(d.blocosPorDia).toHaveLength(0);
  });

  it('teste 6: só a musculação usa a tolerância +480 — MAX 3000 com B=2700 ⇒ DENTRO_DA_TOLERANCIA', () => {
    const itens: ItemDuracao[] = [{ tipo: 'RESISTIDO', series: 2, descansoEntreSeriesSeg: 0, execucao: { tipo: 'ISOMETRIA', holdSegundosPorSerie: 1500 }, tecnica: { tipo: 'SEM_TECNICA' } }];
    expect(avaliarDuracaoSessao({ itens, orcamentoSegundos: 2700 }).estadoLimite).toBe('DENTRO_DA_TOLERANCIA');
  });
});

describe('C1 fiação viva · caminho REAL de montarRotina', () => {
  const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
  const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino =>
    ({ pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'emagrecimento', nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 5, tempoPorSessaoMin: 60, ...over });

  it('materializa distribuicaoCardio + resultadoGeracao no plano real; blocos só em dias oferecidos', () => {
    const p = perfil();
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    // oferece o último dia (vago, além dos dias de força) para cardio.
    const rotina = montarRotina(presc, p, EXERCISES, new Set(), { semana: 1 }, p.preferencias, new Map(), [4]);
    expect(rotina.resultadoGeracao).toBeDefined();
    expect(['CERTIFICADO', 'NAO_AVALIADO_ENTREGAVEL', 'INCOMPATIVEL']).toContain(rotina.resultadoGeracao!.tipo);
    expect(rotina.distribuicaoCardio!.blocosPorDia.map((b) => b.diaId)).toEqual(['sex']);
    // duracaoIncompativel é DERIVADO do discriminante (não fonte independente).
    expect(rotina.duracaoIncompativel ?? false).toBe(rotina.resultadoGeracao!.tipo === 'INCOMPATIVEL');
  });

  it('sem dias oferecidos, a distribuição existe mas não materializa bloco (nada substitui treino)', () => {
    const p = perfil();
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    const rotina = montarRotina(presc, p, EXERCISES, new Set(), { semana: 1 });
    expect(rotina.distribuicaoCardio!.blocosPorDia).toHaveLength(0);
  });
});
