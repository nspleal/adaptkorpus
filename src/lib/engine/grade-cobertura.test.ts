/**
 * 🔢 v4 · leva B3 — A GRADE DAS 36 COMBINAÇÕES (handoff-motor-volume-v4-2026-08-12),
 * agora permanente: 3 níveis × 6 dias × 2 tempos, semana 3, massa/academia.
 *
 * O que ela trava (contra o mundo medido em 2026-08-12, onde 7 de 12 grupos tinham ZERO):
 *  · cobertura: com ≥ 2 dias, NENHUM dos 12 grupos fica a zero ponderado;
 *  · 1 dia é o limite estrutural declarado (6–7 slots não cobrem 12 grupos) — os zeros
 *    existem, são ≤ 3 e ficam DECLARADOS aqui em vez de escondidos na média;
 *  · o teto de slots segue a tabela f(tempo) — nenhum dia acima do orçamento;
 *  · a inversão morreu (iniciante ≤ intermediário ≤ avançado — prova fina no
 *    alocador.test.ts; aqui o smoke da grade completa).
 */
import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { creditoPonderadoDaSemana, orcamentoSlotsDoDia } from './alocador';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino } from './treino-types';
import type { EquipamentoCasa } from '../data/types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const GRUPOS = ['peito', 'costas', 'ombros', 'quadriceps', 'posterior', 'gluteos', 'core', 'biceps', 'triceps', 'panturrilha', 'lombar', 'antebraco'] as const;
const NIVEIS = ['iniciante', 'intermediario', 'avancado'] as const;

const montar = (p: PerfilTreino) => montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana: 3 });

const perfil = (nivel: PerfilTreino['nivelExperiencia'], dias: number, tempo: number, casa?: EquipamentoCasa[]): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa', nivelExperiencia: nivel,
  equipamento: casa ? 'casa' : 'academia', ...(casa ? { equipamentosCasa: casa } : {}),
  diasDisponiveis: dias, tempoPorSessaoMin: tempo,
});

const rotina = (nivel: PerfilTreino['nivelExperiencia'], dias: number, tempo: number) => montar(perfil(nivel, dias, tempo));

describe('🔴 grade 3 níveis × 6 dias × {60, 180} min — cobertura ponderada', () => {
  it('🔑 com ≥ 2 dias, ZERO grupos a zero ponderado (antes: 7 de 12) — nas 30 combinações', () => {
    const falhas: string[] = [];
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
      for (const dias of [2, 3, 4, 5, 6]) {
        for (const tempo of [60, 180]) {
          const r = rotina(nivel, dias, tempo);
          const pond = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
          const zeros = GRUPOS.filter((g) => (pond.get(g) ?? 0) <= 0);
          if (zeros.length > 0) falhas.push(`${nivel}/${dias}d/${tempo}min: ${zeros.join(',')}`);
        }
      }
    }
    expect(falhas, `grupos a zero:\n${falhas.join('\n')}`).toEqual([]);
  });

  it('1 dia: os zeros são o limite estrutural, declarado — nunca mais que 3', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
      for (const tempo of [60, 180]) {
        const r = rotina(nivel, 1, tempo);
        const pond = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
        const zeros = GRUPOS.filter((g) => (pond.get(g) ?? 0) <= 0);
        expect(zeros.length, `${nivel}/1d/${tempo}min: ${zeros.join(',')}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('nenhum dia passa do orçamento f(tempo), na grade inteira', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
      for (const dias of [1, 2, 3, 4, 5, 6]) {
        for (const tempo of [60, 180]) {
          const r = rotina(nivel, dias, tempo);
          for (const d of r.dias) {
            expect(d.slots.length, `${nivel}/${dias}d/${tempo}min · ${d.nome}`).toBeLessThanOrEqual(orcamentoSlotsDoDia(tempo));
          }
        }
      }
    }
  });

  /**
   * 🔗 Âncora contra a medição de 2026-08-12 (relatorio-medicao-v3): o perfil da queixa
   * (int/massa/4d/60min) tinha 14 slots e 55 séries; o v4 entrega 24 slots. O par
   * discriminante da leva inteira, gravado como número.
   */
  it('int/massa/4d/60min: 24 slots onde havia 14', () => {
    const r = rotina('intermediario', 4, 60);
    expect(r.dias.reduce((n, d) => n + d.slots.length, 0)).toBe(24);
  });
});

/**
 * 🔴 A GRADE DE **CASA** (pedido-casa-dia-curto-2026-08-13) — o ponto cego que o v4 deixou.
 *
 * A grade das 36 acima roda inteira em `academia`, onde os três locais liberam o catálogo
 * completo e o pool nunca esvazia. Em casa — sobretudo "só peso do corpo" — ele esvazia, e o
 * autor recebeu um `Push A` com 2 exercícios sem uma palavra de explicação.
 *
 * 🔒 A regra travada NÃO é "o dia sempre enche" — em "só peso do corpo" o catálogo tem UM
 * exercício de `puxar` (e116), e a invariante `puxar ≥ empurrar` (saúde do ombro) tampa a
 * semana em 1 `empurrar` por dia de puxar; como 100% dos exercícios de peito/ombros/tríceps
 * disponíveis ali são `empurrar`, o dia de Push É curto por limite real de catálogo. A regra
 * travada é **o corte não é silencioso**: se o dia veio abaixo do orçamento, os avisos DIZEM
 * qual dia — este guard ancora nesse critério, não na redação da frase.
 */
describe('🔴 grade de CASA — o corte é dito, nunca silencioso', () => {
  const MUNDOS = [
    { nome: 'academia', casa: undefined },
    { nome: 'casa · só peso do corpo', casa: [] as EquipamentoCasa[] },
    { nome: 'casa · halteres + barra fixa', casa: ['halteres', 'barra_fixa'] as EquipamentoCasa[] },
  ];

  /**
   * 🔑 A REGRA TRAVADA, aplicada aos TRÊS mundos — e é de propósito que academia entre aqui:
   * a medição de 2026-08-13 mostrou que 6 das 36 combinações de academia JÁ tinham um dia
   * curto (`avançado/6d/60min · Pull B` fecha em 4 de 6) e ninguém sabia, porque o guard das
   * 36 só checava o TETO (`≤ orçamento`), nunca a igualdade. O corte silencioso não era um
   * defeito de casa: era um defeito do motor que só doía o bastante para ser visto em casa.
   */
  it('🔑 com ≥ 2 dias, TODO dia curto é nomeado nos avisos (zero corte em silêncio)', () => {
    const falhas: string[] = [];
    for (const mundo of MUNDOS) {
      for (const nivel of NIVEIS) {
        for (const dias of [2, 3, 4, 5, 6]) {
          for (const tempo of [60, 180]) {
            const r = montar(perfil(nivel, dias, tempo, mundo.casa));
            const texto = r.avisos.join(' | ');
            for (const d of r.dias) {
              if (!d.slotsNaoPreenchidos) continue;
              if (!texto.includes(d.nome)) {
                falhas.push(`${mundo.nome}/${nivel}/${dias}d/${tempo}min · ${d.nome}: ${d.slotsNaoPreenchidos} slot(s) sem quem preencha, e nenhum aviso o nomeia`);
              }
            }
          }
        }
      }
    }
    expect(falhas, `cortes silenciosos:\n${falhas.join('\n')}`).toEqual([]);
  });

  /**
   * PAR DISCRIMINANTE da CAUSA: dizer "seu equipamento limita" quando o que agiu foi o teto
   * semanal seria mentir. Em academia os três locais liberam o catálogo inteiro — lá o corte
   * SÓ pode ser de teto, e a frase de equipamento nunca pode aparecer. Sem este par, um
   * conserto que disparasse a copy de equipamento em todo dia curto passaria no teste acima.
   */
  it('academia nunca culpa o equipamento (lá o catálogo é completo)', () => {
    for (const nivel of NIVEIS) {
      for (const dias of [1, 2, 3, 4, 5, 6]) {
        for (const tempo of [60, 180]) {
          const r = rotina(nivel, dias, tempo);
          expect(r.avisos.some((a) => a.includes('equipamento disponível limita')), `academia ${nivel}/${dias}d/${tempo}min: culpou o equipamento`).toBe(false);
        }
      }
    }
  });

  /** …e o inverso: em casa só-peso a causa É o catálogo, e a frase de equipamento aparece. */
  it('casa só peso do corpo: a causa É o equipamento, e a frase o diz', () => {
    const r = montar(perfil('avancado', 6, 60, []));
    expect(r.avisos.some((a) => a.includes('equipamento disponível limita'))).toBe(true);
  });

  /** O caso do autor, gravado como número: casa só-peso + avançado + 6 dias → PPL, Push curto e DITO. */
  it('o caso do autor: casa só-peso/avançado/6d/60min — Push A curto, e o aviso o nomeia', () => {
    const r = montar(perfil('avancado', 6, 60, []));
    const pushA = r.dias.find((d) => d.nome.startsWith('Push'));
    expect(pushA, `split entregue: ${r.split}`).toBeDefined();
    expect(pushA!.slots.length).toBeLessThan(orcamentoSlotsDoDia(60));
    expect(r.avisos.join(' | ')).toContain(pushA!.nome);
  });

  /**
   * Cobertura em casa: onde o catálogo NÃO limita (halteres + barra fixa), casa se comporta
   * como academia — nenhum grupo a zero. É a prova de que o curto do só-peso é catálogo, não
   * defeito do alocador.
   */
  it('casa com halteres + barra fixa: nenhum grupo a zero com ≥ 2 dias', () => {
    const falhas: string[] = [];
    for (const nivel of NIVEIS) {
      for (const dias of [2, 3, 4, 5, 6]) {
        for (const tempo of [60, 180]) {
          const r = montar(perfil(nivel, dias, tempo, ['halteres', 'barra_fixa']));
          const pond = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
          const zeros = GRUPOS.filter((g) => (pond.get(g) ?? 0) <= 0);
          if (zeros.length > 0) falhas.push(`${nivel}/${dias}d/${tempo}min: ${zeros.join(',')}`);
        }
      }
    }
    expect(falhas, `grupos a zero em casa equipada:\n${falhas.join('\n')}`).toEqual([]);
  });
});
