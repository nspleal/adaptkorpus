/**
 * 🔴 DECISÃO DO AUTOR (2026-09-23) — o tempo escolhido no perfil limita APENAS a musculação. O
 * cardio tem duração própria: não consome esse orçamento, não reduz a musculação e não causa
 * incompatibilidade temporal do treino. Exemplo obrigatório: 30 min de musculação + 30 min de
 * cardio no mesmo dia preservam os dois blocos. Fonte: `ADENDO-CARDIO-FORA-DO-TEMPO-20260923.md`.
 *
 * O único teto de cardio aprovado é o por dia (`TETO_MIN_DIA_CARDIO`, DF 2026-08-01).
 */
import { describe, expect, it } from 'vitest';
import { gerarTreino } from './index';
import { avaliarDuracaoResistida } from './duracao-plano';
import { avaliarRotinaAutomaticaFinal, avaliarSemana } from './critico';
import { distribuirCardioDaRotina } from './treino-cardio-semana';
import { TETO_MIN_DIA_CARDIO } from './dia-de-cardio';
import { repUnitDe } from './isometricos';
import { resolverExecucao } from '../data/lateralidade';
import { EXERCISES } from '../data/exercises';
import { doPlano, paraRotinaCustom } from '@/components/painel/EditorTreino';
import { ORDEM_SEMANA, type Weekday } from '../semana';
import type { PerfilTreino, RotinaSemanal } from './treino-types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (o: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 178, idade: 32, flagsSaude: SEM, objetivo: 'saude', nivelExperiencia: 'intermediario',
  equipamento: 'academia', equipamentosCasa: [], diasDisponiveis: 3, treinoDias: ['seg', 'qua', 'sex'],
  tempoPorSessaoMin: 30, limiteTempoTreino: 'limitado', ...o,
} as PerfilTreino);
const gerar = (p: PerfilTreino, oferta: readonly Weekday[], semana: 1 | 3 | 6 | null = 1) =>
  gerarTreino(p, { exercises: EXERCISES, ...(semana ? { semanaCiclo: { semana } } : {}), diasOferecidosCardio: oferta }).rotina!;
const ctx = (p: PerfilTreino, r: RotinaSemanal, oferta: readonly Weekday[]) => ({
  semana: 1 as const, nivel: p.nivelExperiencia, objetivo: p.objetivo, tempoPorSessaoMin: p.tempoPorSessaoMin,
  limiteTempoTreino: p.limiteTempoTreino, diasNoHorizonteEsperado: 7, diasOferecidosCardioEsperados: oferta,
  diasTreinoEsperados: p.treinoDias ?? [], seriesPadrao: 2,
  diasDaSemanaIdx: r.dias.map((d) => ORDEM_SEMANA.indexOf(d.diaId!)),
});
const diasEditor = (r: RotinaSemanal) => r.dias.map((d) => ({
  nome: d.nome, exercicios: d.slots.map((s) => s.exercicio), series: d.slots.map((s) => s.series),
  descansoSeg: d.slots.map((s) => s.descansoSeg), holdSeg: d.slots.map((s) => s.holdSeg),
}));
const sessaoLonga = (a: { avisos: { codigo: string }[] }) => a.avisos.filter((x) => x.codigo === 'sessao_longa');
const dia = (r: RotinaSemanal, id: Weekday) => r.planoFinalPorDia!.find((d) => d.diaId === id)!;
const CINCO: Weekday[] = ['seg', 'ter', 'qua', 'qui', 'sex'];

describe('(1) 30 min de musculação + 30 min de cardio no mesmo dia', () => {
  // saúde: 150 min/semana ÷ 5 dias oferecidos = 30 min por dia; musculação de 30 min.
  const p = perfil();
  const r = gerar(p, CINCO);

  it('os dois blocos ficam inteiros: treino medido só na musculação, cardio de 30 min à parte', () => {
    for (const id of ['seg', 'qua', 'sex'] as const) {
      const d = dia(r, id);
      expect(d.tipo).toBe('TREINO_E_CARDIO');
      expect(d.cardio!.duracaoSegundos).toBe(1800);
      expect(d.duracao).toEqual(avaliarDuracaoResistida(r.dias[d.treinoIdx!]!.slots, p.nivelExperiencia, 1800, true));
      expect(d.duracao.duracaoMaximaEstimadaSegundos!).toBeLessThanOrEqual(1800);
      expect(d.duracao.estadoLimite).toBe('DENTRO_DO_LIMITE');
    }
    expect(r.resultadoGeracao?.tipo).toBe('CERTIFICADO');
  });

  it('nenhum alerta de treino longo: crítico automático e crítico do editor', () => {
    expect(sessaoLonga(avaliarRotinaAutomaticaFinal(r, ctx(p, r, CINCO)))).toEqual([]);
    expect(sessaoLonga(avaliarSemana(diasEditor(r), ctx(p, r, CINCO)))).toEqual([]);
    expect(r.avisos.filter((a) => /cardio/i.test(a) && /couberam|faltam|tempo/i.test(a))).toEqual([]);
  });

  it('o exemplo literal: 1800 s resistidos cabem em 30 min, e o bloco de 1800 s fica no mesmo dia', () => {
    const itens = [{ exercicio: EXERCISES.find((e) => e.id === 'e7')!, series: 1, descansoSeg: 0, holdSeg: 1800 }];
    expect(avaliarDuracaoResistida(itens, 'intermediario', 1800, true)).toMatchObject({
      estadoCalculo: 'CALCULADO', estadoLimite: 'DENTRO_DO_LIMITE', duracaoMaximaEstimadaSegundos: 1800,
    });
    const d = distribuirCardioDaRotina({ diasOferecidosCardio: ['seg'], cardioPrescritoPorDiaSegundos: 1800, aggregateId: 'a', expectedRevision: 0, formulaVersion: 'v' });
    expect(d.blocosPorDia).toEqual([{ diaId: 'seg', duracaoTotalSegundos: 1800, linhagens: [{ prescricaoId: 'cardio-seg', diaOrigemId: 'seg', ordemPrescricao: 0, segundos: 1800 }] }]);
  });
});

describe('(2) cardio em dia exclusivo maior que o tempo escolhido para o treino', () => {
  it.each([30, 45, 60])('perfil de %s min: domingo recebe 90 min (teto próprio do cardio), sem truncar', (tempo) => {
    const r = gerar(perfil({ tempoPorSessaoMin: tempo }), ['dom']);
    const dom = dia(r, 'dom');
    expect(dom.tipo).toBe('CARDIO');
    expect(dom.cardio!.duracaoSegundos).toBe(TETO_MIN_DIA_CARDIO * 60);
    expect(dom.cardio!.duracaoSegundos!).toBeGreaterThan(tempo * 60);
    expect(dom.duracao).toMatchObject({ estadoCalculo: 'CALCULADO', estadoLimite: 'DENTRO_DO_LIMITE', duracaoMaximaEstimadaSegundos: 0 });
    expect(r.cardioSemana).toEqual({ prescritoSegundos: 5400 });
  });
});

describe('(3) variar só o cardio deixa duração e veredito da musculação iguais', () => {
  const OFERTAS: Weekday[][] = [[], ['dom'], ['seg'], ['seg', 'dom'], CINCO, [...ORDEM_SEMANA]];
  const PERFIS = (['saude', 'emagrecimento', 'massa'] as const).flatMap((objetivo) =>
    [30, 45, 60].map((tempoPorSessaoMin) => perfil({ objetivo, tempoPorSessaoMin })));
  it.each(PERFIS.map((p) => [`${p.objetivo} ${p.tempoPorSessaoMin} min`, p] as const))('%s', (_n, p) => {
    const sem = gerar(p, []);
    for (const oferta of OFERTAS.slice(1)) {
      const com = gerar(p, oferta);
      expect(com.dias, JSON.stringify(oferta)).toEqual(sem.dias);
      expect(com.duracaoDias, JSON.stringify(oferta)).toEqual(sem.duracaoDias);
      expect(com.duracaoResistidaDias, JSON.stringify(oferta)).toEqual(sem.duracaoResistidaDias);
      expect(com.resultadoGeracao, JSON.stringify(oferta)).toEqual(sem.resultadoGeracao);
      for (const d of com.planoFinalPorDia!) expect(d.duracao, d.diaId).toEqual(dia(sem, d.diaId as Weekday).duracao);
    }
  });
});

describe('(4) plano gerado, crítico e editor convergem', () => {
  it.each([[30, CINCO], [45, ['seg', 'dom'] as Weekday[]], [60, [...ORDEM_SEMANA]]] as const)('%s min', (tempo, oferta) => {
    const p = perfil({ objetivo: 'emagrecimento', tempoPorSessaoMin: tempo });
    const r = gerar(p, oferta);
    const auto = avaliarRotinaAutomaticaFinal(r, ctx(p, r, oferta));
    expect(auto.convergenciaPlanoFinal?.estado).toBe('CONVERGIU');
    expect(sessaoLonga(auto)).toEqual(sessaoLonga(avaliarSemana(diasEditor(r), ctx(p, r, oferta))));
    // Copiar para o editor e recalcular: o manual também mede só a musculação e mantém o cardio.
    const manual = gerarTreino({ ...p, rotinaCustom: paraRotinaCustom(doPlano(r.dias, p.treinoDias ?? [], undefined, undefined)) },
      { exercises: EXERCISES, semanaCiclo: { semana: 1 }, diasOferecidosCardio: oferta }).rotina!;
    expect(manual.distribuicaoCardio).toEqual(r.distribuicaoCardio);
    for (const d of manual.planoFinalPorDia!.filter((x) => x.treinoIdx != null)) {
      expect(d.duracao).toEqual(avaliarDuracaoResistida(manual.dias[d.treinoIdx!]!.slots, p.nivelExperiencia, tempo * 60, manual.limiteTempoEstrito));
    }
  });
});

describe('(5) saldo de cardio não é redistribuído por falta de folga da musculação', () => {
  it('musculação que ocupa os 30 min da segunda não empurra o cardio dela para terça e quarta', () => {
    // Medido na grade de base (contrato antigo): seg recebia 60 s e o saldo ia para ter (1800 s)
    // e qua (1740 s). Agora cada um dos 7 dias oferecidos fica com a própria prescrição: 20 min.
    const p = perfil({ nivelExperiencia: 'iniciante', diasDisponiveis: 1, treinoDias: ['seg'] });
    const r = gerar(p, [...ORDEM_SEMANA]);
    expect(r.distribuicaoCardio!.blocosPorDia.map((b) => [b.diaId, b.duracaoTotalSegundos, b.linhagens.map((l) => l.diaOrigemId)]))
      .toEqual(ORDEM_SEMANA.map((d) => [d, 1200, [d]]));
    const seg = dia(r, 'seg');
    expect(seg.tipo).toBe('TREINO_E_CARDIO');
    expect(seg.duracao.duracaoMaximaEstimadaSegundos!).toBeGreaterThan(1800 - 1200); // sem folga para 20 min no contrato antigo
    expect(seg.duracao).toEqual(dia(gerar(p, []), 'seg').duracao);
  });
});

describe('(6) isometria, unilateral e dado resistido ausente preservam a semântica', () => {
  it('com cardio em todos os dias, a execução usa o hold real, dobra só no DOIS_LADOS e nunca soma cardio', () => {
    let isometricos = 0; let doisLados = 0; let dias = 0;
    const PERFIS = (['academia', 'casa'] as const).flatMap((equipamento) => (['iniciante', 'avancado'] as const).flatMap((nivelExperiencia) =>
      [30, 60].map((tempoPorSessaoMin) => perfil({ equipamento, equipamentosCasa: equipamento === 'casa' ? ['halteres', 'elastico', 'banco'] : [], nivelExperiencia, tempoPorSessaoMin }))))
      // Na seleção da base pública, isometria e unilateral dos dois lados aparecem nestes dois perfis.
      .concat([perfil({ equipamento: 'casa', tempoPorSessaoMin: 60 }), perfil({ objetivo: 'emagrecimento', tempoPorSessaoMin: 60 })]);
    for (const p of PERFIS) {
      const r = gerar(p, [...ORDEM_SEMANA], 3);
      if (!r.planoFinalPorDia) continue; // terminal estrutural (mínimos/tetos): sem plano final a medir
      for (const d of r.planoFinalPorDia.filter((x) => x.treinoIdx != null)) {
        dias++;
        const slots = r.dias[d.treinoIdx!]!.slots;
        const esperado = slots.reduce((n, s) => {
          const iso = repUnitDe(s.exercicio.id) === 'segundos';
          const dois = resolverExecucao(s.exercicio.id, s.exercicio.execucao, s.execucaoSelecionada) === 'UNILATERAL_DOIS_LADOS';
          if (iso) isometricos++;
          if (dois) doisLados++;
          return n + s.series! * (iso ? s.holdSeg! : 40) * (dois ? 2 : 1);
        }, 0);
        expect(d.tipo).toBe('TREINO_E_CARDIO');
        expect(d.duracao.estadoCalculo).toBe('CALCULADO');
        expect(d.duracao.componentes?.execucaoSegundos, d.diaId).toBe(esperado);
      }
    }
    expect(dias, 'nenhum dia de treino medido').toBeGreaterThan(10);
    expect(isometricos, 'nenhum isométrico na amostra').toBeGreaterThan(0);
    expect(doisLados, 'nenhum unilateral dos dois lados na amostra').toBeGreaterThan(0);
  });

  it('musculação sem séries (geração v1) continua NAO_AVALIADO com o mesmo motivo; o cardio fica inteiro', () => {
    const p = perfil({ objetivo: 'emagrecimento' });
    const sem = gerar(p, [], null);
    const com = gerar(p, ['seg', 'dom'], null);
    expect(com.resultadoGeracao).toEqual(sem.resultadoGeracao);
    expect(com.resultadoGeracao?.tipo).toBe('NAO_AVALIADO_ENTREGAVEL');
    const seg = dia(com, 'seg');
    expect(seg.duracao.estadoCalculo).toBe('NAO_AVALIADO');
    expect(seg.duracao.motivosNaoAvaliados.join(' ')).toMatch(/séries ausente/);
    expect(seg.duracao).toEqual(dia(sem, 'seg').duracao);
    expect(seg.cardio!.duracaoSegundos).toBe(4500);
  });
});
