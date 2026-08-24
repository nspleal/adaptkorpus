/**
 * 🔒 C1 — FIAÇÃO VIVA da distribuição de cardio no gerador real. Testes obrigatórios do autor
 * (2026-08-21): dias oferecidos honrados, dia vago não oferecido rejeitado, musculação intocada,
 * redistribuição só para dias posteriores oferecidos (sem wrap), hash determinístico pela oferta,
 * cardio adaptado ao tempo × musculação usa +480, e a materialização no caminho real de montarRotina.
 */
import { describe, expect, it } from 'vitest';
import { distribuirCardioDaRotina, idDoDia } from './treino-cardio-semana';
import { avaliarDuracaoSessao, type ItemDuracao, type ResultadoDuracao } from './duracao-sessao';
import { montarRotina } from './treino-montador';
import { prescreverTreino } from './treino';
import { avaliarGateTreino } from './treino-gate';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino } from './treino-types';
import type { FlagsSaude } from './types';

const dur = (max: number): ResultadoDuracao => ({
  estadoCalculo: 'CALCULADO', estadoLimite: 'DENTRO_DO_LIMITE',
  duracaoMinimaEstimadaSegundos: max, duracaoMaximaEstimadaSegundos: max,
  formulaVersion: 'tempo-v2', motivosNaoAvaliados: [], motivosLimite: [],
});
const base = {
  orcamentoSegundos: 3600, cardioPrescritoPorDiaSegundos: 1800,
  aggregateId: 'rotina-cardio', expectedRevision: 0, formulaVersion: 'tempo-v2',
};
const bloco = (d: ReturnType<typeof distribuirCardioDaRotina>, i: number) => d.blocosPorDia.find((b) => b.diaId === idDoDia(i));
const contrato = (d: ReturnType<typeof distribuirCardioDaRotina>, i: number) => d.contratosPorPrescricao.find((c) => c.diaOrigemId === idDoDia(i));

describe('C1 fiação viva · dias oferecidos (autor 2026-08-21)', () => {
  it('teste 1/2: oferece ter(1) e sáb(5); só esses recebem cardio; quinta(3) vaga não oferecida é rejeitada', () => {
    const d = distribuirCardioDaRotina({ ...base, diasTotais: 7, diasForca: 0, duracaoDias: [], diasOferecidosCardio: [1, 5] });
    const diasComBloco = d.blocosPorDia.map((b) => b.diaId);
    expect(diasComBloco).toEqual([idDoDia(1), idDoDia(5)]);
    expect(bloco(d, 3)).toBeUndefined(); // quinta vaga, não oferecida
  });

  it('teste 3: sábado oferecido COM musculação não substitui a musculação (capacidade 0 ⇒ uso 0, descarte)', () => {
    // day5 é força e sua musculação ocupa TODO o orçamento (MAX_RESISTIDA = B) ⇒ capacidade de cardio 0.
    const duracaoDias = Array.from({ length: 6 }, () => dur(3600));
    const d = distribuirCardioDaRotina({ ...base, diasTotais: 7, diasForca: 6, duracaoDias, diasOferecidosCardio: [5] });
    expect(bloco(d, 5)).toBeUndefined(); // nada materializado sobre a musculação
    expect(contrato(d, 5)!.duracaoUsadaNaSessaoSegundos).toBe(0);
    expect(contrato(d, 5)!.duracaoDescartadaSegundos).toBe(1800); // sem destino posterior oferecido
  });

  it('teste 4: redistribuição usa só dias POSTERIORES oferecidos, sem wrap', () => {
    // day2 é força com capacidade 600; oferecidos [2,5]; overflow vai para day5 (posterior, vago).
    const duracaoDias = [dur(0), dur(0), dur(3000)]; // day2 MAX_RESISTIDA=3000 ⇒ capacidade 600
    const d = distribuirCardioDaRotina({ ...base, diasTotais: 7, diasForca: 3, duracaoDias, diasOferecidosCardio: [2, 5] });
    const c2 = contrato(d, 2)!;
    expect(c2.duracaoUsadaNaSessaoSegundos).toBe(600);
    expect(c2.alocacoesDestino).toEqual([{ diaId: idDoDia(5), segundos: 1200 }]);
    // nenhuma alocação para dia anterior à origem (sem wrap).
    expect(c2.alocacoesDestino.every((a) => a.diaId > idDoDia(2))).toBe(true);
  });

  it('teste 5: mudar os dias oferecidos muda a distribuição E o canonical_input_hash (determinístico)', () => {
    const a = distribuirCardioDaRotina({ ...base, diasTotais: 7, diasForca: 0, duracaoDias: [], diasOferecidosCardio: [1, 5] });
    const b = distribuirCardioDaRotina({ ...base, diasTotais: 7, diasForca: 0, duracaoDias: [], diasOferecidosCardio: [2, 4] });
    expect(a.canonicalInputHash).not.toBe(b.canonicalInputHash);
    // mesma oferta ⇒ mesmo hash (determinismo).
    const a2 = distribuirCardioDaRotina({ ...base, diasTotais: 7, diasForca: 0, duracaoDias: [], diasOferecidosCardio: [1, 5] });
    expect(a.canonicalInputHash).toBe(a2.canonicalInputHash);
  });

  it('teste 6: cardio EXCEDENTE é reduzido ao tempo disponível; musculação PODE usar a tolerância +480', () => {
    // (a) capacidade 600 < cardio 1800 ⇒ cardio adaptado para 600.
    const d = distribuirCardioDaRotina({ ...base, diasTotais: 2, diasForca: 1, duracaoDias: [dur(3000)], diasOferecidosCardio: [0] });
    expect(contrato(d, 0)!.duracaoUsadaNaSessaoSegundos).toBe(600); // adaptado, sem +480
    // (b) uma sessão só de musculação com MAX em (B, B+480] recebe DENTRO_DA_TOLERANCIA.
    // MAX = 2 × 1500 = 3000 ∈ (2700, 3180]. Só a musculação usa os +480.
    const itens: ItemDuracao[] = [{ tipo: 'RESISTIDO', series: 2, descansoEntreSeriesSeg: 0, execucao: { tipo: 'ISOMETRIA', holdSegundosPorSerie: 1500 }, tecnica: { tipo: 'SEM_TECNICA' } }];
    const r = avaliarDuracaoSessao({ itens, orcamentoSegundos: 2700, origemPlano: 'AUTOMATICO' });
    expect(r.estadoLimite).toBe('DENTRO_DA_TOLERANCIA');
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
    const oferecidos = [4];
    const rotina = montarRotina(presc, p, EXERCISES, new Set(), { semana: 1 }, p.preferencias, new Map(), oferecidos);
    expect(rotina.resultadoGeracao).toBeDefined();
    expect(['CERTIFICADO', 'NAO_AVALIADO_ENTREGAVEL', 'INCOMPATIVEL']).toContain(rotina.resultadoGeracao!.tipo);
    expect(rotina.distribuicaoCardio).toBeDefined();
    // todo bloco materializado está num dia OFERECIDO e SEM musculação.
    for (const b of rotina.distribuicaoCardio!.blocosPorDia) {
      expect(b.diaId).toBe(idDoDia(4));
    }
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
