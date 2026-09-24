/**
 * 🔴 DECISÃO DE NICOLAS (2026-09-23) — os dias oferecidos para cardio nunca determinam dias de
 * força, divisão, exercícios, séries, descansos ou veredito da musculação. O cardio é uma
 * recomendação separada: no mesmo dia vem depois da musculação, e uma oferta em dia sem
 * musculação não substitui um dia de força.
 *
 * Defeito medido na base pública `7cd7220`: o dia complementar (o primeiro depois do teto de
 * sessões) só era escolhido se não tivesse sido oferecido para cardio. Intermediário com seis
 * dias e cardio na sexta e no sábado: a musculação caía de cinco para quatro dias.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { gerarTreino } from './index';
import { avaliarRotinaAutomaticaFinal } from './critico';
import { EXERCISES } from '../data/exercises';
import { doPlano, paraRotinaCustom } from '@/components/painel/EditorTreino';
import SuaSemana from '@/components/painel/SuaSemana';
import { montarSemana, ORDEM_SEMANA, type Weekday } from '../semana';
import type { PerfilTreino, RotinaSemanal } from './treino-types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const SEIS: Weekday[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const perfil = (o: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 178, idade: 32, flagsSaude: SEM, objetivo: 'saude', nivelExperiencia: 'intermediario',
  equipamento: 'academia', equipamentosCasa: [], diasDisponiveis: 6, treinoDias: SEIS,
  tempoPorSessaoMin: 45, limiteTempoTreino: 'limitado', ...o,
} as PerfilTreino);
type Semana = 1 | 3 | 6;
const opcoes = (oferta: readonly Weekday[], semana: Semana | null) =>
  ({ exercises: EXERCISES, ...(semana ? { semanaCiclo: { semana } } : {}), diasOferecidosCardio: oferta });
const gerar = (p: PerfilTreino, oferta: readonly Weekday[], semana: Semana | null = 1) => gerarTreino(p, opcoes(oferta, semana)).rotina!;
/** Tudo o que é da musculação. O cardio e as vistas por dia que o carregam ficam de fora. */
const musculacao = (r: RotinaSemanal) => ({
  split: r.split, diasForca: r.diasForcaAgendados, recuperacao: r.diasCardioRecuperacao, naoAtendidos: r.diasNaoAtendidos,
  dias: r.dias, duracao: r.duracaoDias, resistida: r.duracaoResistidaDias, veredito: r.resultadoGeracao,
});
const dia = (r: RotinaSemanal, id: Weekday) => r.planoFinalPorDia!.find((d) => d.diaId === id)!;
const copiarParaEditor = (p: PerfilTreino, r: RotinaSemanal) =>
  ({ ...p, rotinaCustom: paraRotinaCustom(doPlano(r.dias, p.treinoDias ?? [], undefined, undefined)) });
const OFERTAS: Weekday[][] = [['seg'], ['sex'], ['sab'], ['dom'], ['sex', 'sab'], ['sab', 'dom'], [...ORDEM_SEMANA]];

describe('(1) o caso relatado: intermediário, seis dias, cardio na sexta e no sábado', () => {
  it.each(['saude', 'massa'] as const)('%s: cinco dias de força; a sexta traz o cardio depois da musculação', (objetivo) => {
    const p = perfil({ objetivo, treinoDias: undefined });
    const sem = gerar(p, []);
    const com = gerar(p, ['sex', 'sab']);
    expect(sem.diasForcaAgendados).toBe(5);
    expect(musculacao(com)).toEqual(musculacao(sem));
    const sex = dia(com, 'sex');
    expect(sex.tipo).toBe('TREINO_E_CARDIO');
    expect(com.dias[sex.treinoIdx!]!.nome).toBe('Complementares');
    expect(dia(com, 'sab').tipo).toBe('CARDIO');
    // A prescrição de cardio é a mesma de antes: a sexta não perde o cardio por ter musculação.
    expect(com.planoFinalPorDia!.filter((d) => d.cardio).map((d) => d.diaId)).toEqual(['sex', 'sab']);
  });

  // Só a sexta: na base o complementar pulava para o sábado, e o crítico, que espera a força nos
  // primeiros dias da agenda, divergia.
  it.each([[['sex']], [['sex', 'sab']]] as Weekday[][][])('gerador e crítico convergem com a oferta %j', (oferta) => {
    const p = perfil();
    const r = gerar(p, oferta);
    const auto = avaliarRotinaAutomaticaFinal(r, {
      semana: 1, nivel: p.nivelExperiencia, objetivo: p.objetivo, tempoPorSessaoMin: p.tempoPorSessaoMin,
      limiteTempoTreino: p.limiteTempoTreino, diasNoHorizonteEsperado: 7, diasOferecidosCardioEsperados: oferta,
      diasTreinoEsperados: SEIS, seriesPadrao: 2, diasDaSemanaIdx: r.dias.map((d) => ORDEM_SEMANA.indexOf(d.diaId!)),
    });
    expect(auto.convergenciaPlanoFinal?.estado, auto.convergenciaPlanoFinal?.motivosEstruturais.join(' | ')).toBe('CONVERGIU');
  });
});

describe('(2) perfis idênticos variando só a oferta: a musculação não muda', () => {
  const EQUIP: Partial<PerfilTreino>[] = [
    { equipamento: 'academia', equipamentosCasa: [] },
    { equipamento: 'casa', equipamentosCasa: ['halteres', 'elastico', 'banco'] },
    { equipamento: 'casa', equipamentosCasa: [] },
  ];
  const TEMPOS: Partial<PerfilTreino>[] = [
    { tempoPorSessaoMin: 30, limiteTempoTreino: 'limitado' },
    { tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado' },
    { tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite' },
  ];
  const OBJ = ['saude', 'emagrecimento', 'massa'] as const;
  let i = 0;
  const PERFIS = (['iniciante', 'intermediario', 'avancado'] as const).flatMap((nivelExperiencia) =>
    EQUIP.flatMap((e) => TEMPOS.flatMap((t) => [5, 6, 7].map((d) => perfil({
      nivelExperiencia, ...e, ...t, objetivo: OBJ[i++ % OBJ.length]!, diasDisponiveis: d, treinoDias: ORDEM_SEMANA.slice(0, d),
    })))));
  const nome = (p: PerfilTreino) => `${p.nivelExperiencia} ${p.objetivo} ${p.equipamento}/${p.equipamentosCasa?.length ?? 0} ${p.diasDisponiveis}d ${p.tempoPorSessaoMin}min`;

  it.each(PERFIS.map((p) => [nome(p), p] as const))('%s — semanas 1, 3 e 6', (_n, p) => {
    for (const semana of [1, 3, 6] as const) {
      const sem = musculacao(gerar(p, [], semana));
      for (const oferta of OFERTAS) expect(musculacao(gerar(p, oferta, semana)), `S${semana} ${oferta}`).toEqual(sem);
    }
  });

  it('retomada e geração sem semana do ciclo', () => {
    for (const p of [perfil(), perfil({ nivelExperiencia: 'avancado', diasDisponiveis: 7, treinoDias: [...ORDEM_SEMANA] })]) {
      const retomada = (oferta: readonly Weekday[]) => gerarTreino(p, { exercises: EXERCISES, diasOferecidosCardio: oferta,
        semanaCiclo: { semana: 3, retomada: { semana: 1, fator: 0.5, volumeReferencia: 12 } } } as never).rotina!;
      for (const oferta of OFERTAS) {
        expect(musculacao(retomada(oferta)), `retomada ${oferta}`).toEqual(musculacao(retomada([])));
        expect(musculacao(gerar(p, oferta, null)), `v1 ${oferta}`).toEqual(musculacao(gerar(p, [], null)));
      }
    }
  });
});

describe('(3) editor: copiar o plano e recalcular não depende da oferta', () => {
  it.each([perfil(), perfil({ objetivo: 'massa', nivelExperiencia: 'avancado', diasDisponiveis: 7, treinoDias: [...ORDEM_SEMANA] })]
    .map((p) => [`${p.nivelExperiencia} ${p.diasDisponiveis}d`, p] as const))('%s', (_n, p) => {
    const semOferta = gerar(p, []);
    const manualSem = musculacao(gerarTreino(copiarParaEditor(p, semOferta), opcoes([], 1)).rotina!);
    for (const oferta of OFERTAS) {
      const r = gerar(p, oferta);
      // O plano copiado com a oferta ligada é o mesmo copiado sem ela…
      expect(musculacao(gerarTreino(copiarParaEditor(p, r), opcoes(oferta, 1)).rotina!), `${oferta}`).toEqual(manualSem);
      // …e o desenho já salvo não muda quando só a oferta muda.
      expect(musculacao(gerarTreino(copiarParaEditor(p, semOferta), opcoes(oferta, 1)).rotina!), `${oferta}`).toEqual(manualSem);
    }
  });
});

describe('(4) na tela, o cardio do dia de musculação vem depois dela', () => {
  const p = perfil();
  const r = gerar(p, ['sex', 'sab']);
  const nomes = r.dias.map((d) => d.nome);
  const diasDasSessoes = r.dias.map((d) => d.diaId);

  it('Sua semana: a sexta é o treino Complementares com cardio; o sábado é só cardio', () => {
    const semana = montarSemana(SEIS, nomes, 0, r.diasCardio, diasDasSessoes);
    expect(semana.filter((d) => d.tipo === 'treino').map((d) => d.weekday)).toEqual(['seg', 'ter', 'qua', 'qui', 'sex']);
    expect(semana[4]).toMatchObject({ tipo: 'treino', sessionLabel: 'Complementares', cardio: { minutos: dia(r, 'sex').cardio!.minutos } });
    expect(semana[5]).toMatchObject({ tipo: 'cardio' });
  });

  it('na faixa renderizada, o rótulo do treino precede o cardio no mesmo dia', () => {
    const html = renderToStaticMarkup(React.createElement(SuaSemana, {
      treinoDias: SEIS, sessoesNomes: nomes, sessoesDias: diasDasSessoes, diasCardio: r.diasCardio,
      onIrSessao: () => {}, onVerDieta: () => {}, onEditarPerfil: () => {},
    }));
    const celulaSex = html.slice(html.indexOf('>Sex<'), html.indexOf('>Sáb<'));
    expect(celulaSex.indexOf('Complementares')).toBeGreaterThan(0);
    expect(celulaSex.indexOf('Cardio · ')).toBeGreaterThan(celulaSex.indexOf('Complementares'));
  });
});
