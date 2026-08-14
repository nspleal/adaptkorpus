/**
 * 🔒 A CASCATA DO FOCO (DF do autor, 2026-08-14) — a decisão pura, degrau a degrau.
 *
 * Cada caso abaixo é um número que a medição de 2026-08-14 produziu no plano real, não um
 * exemplo inventado: o delta de 1 série das semanas 2–3, a panturrilha saturada em 1 slot ×
 * 4 séries, o glúteos que a 1ª tentativa zerou, e o `ombros −4` que ninguém pediu.
 */
import { describe, expect, it } from 'vitest';
import { compensadoresPossiveis, decidirFoco } from './trilhos';
import type { GrupoPrimario } from '../data/types';

const SMAX = 4;
/** Grande com folga: 3 slots (capacidade 12), 11 séries hoje. */
const grandeComFolga = { slots: 3, series: 11, tetoSeries: 16, tetoSlots: 6 };
/** Grande saturado: 3 slots, 12 séries = 3 × 4. Foi o caso de `costas` na medição. */
const grandeSaturado = { slots: 3, series: 12, tetoSeries: 16, tetoSlots: 6 };
/** Pequeno saturado: 1 slot, 4 séries. Foi o caso de `panturrilha`. */
const pequenoSaturado = { slots: 1, series: 4, tetoSeries: 8, tetoSlots: 2 };
const compensadorFolgado = { slots: 4, series: 15, pisoSeries: 8, pisoSlots: 1 };

describe('🔒 cascata do foco — ⓪ nenhum terceiro paga', () => {
  it('delta 0 (semanas 1, 4, 5) NÃO promove a slot — entrega ordem', () => {
    const d = decidirFoco({ delta: 0, focado: pequenoSaturado, compensador: compensadorFolgado, sMax: SMAX });
    expect(d).toEqual({ degrau: 'ordem', series: 0, moveSlot: false, motivo: 'delta_zero' });
  });

  /**
   * PAR DISCRIMINANTE do ⓪: sem compensador elegível a resposta é ORDEM, nunca "tira de
   * alguém". É o perfil herdado (`panturrilha` + `compensa: peito` em PPL×2), e era por aí
   * que o motor cobrava de um terceiro.
   */
  it('sem compensador que divida o dia → ordem, e o motivo é dito', () => {
    const d = decidirFoco({ delta: 1, focado: pequenoSaturado, compensador: null, sMax: SMAX });
    expect(d).toEqual({ degrau: 'ordem', series: 0, moveSlot: false, motivo: 'sem_dia_comum' });
  });
});

describe('🔒 cascata do foco — ① série na folga (degrau do GRANDE)', () => {
  it('focado com folga e compensador acima do piso → série, sem mexer em slot', () => {
    const d = decidirFoco({ delta: 1, focado: grandeComFolga, compensador: compensadorFolgado, sMax: SMAX });
    expect(d).toEqual({ degrau: 'serie', series: 1, moveSlot: false, motivo: 'folga' });
  });

  /** O degrau ① é o fino: 1 série, exatamente o delta da spec — nunca os 4 de um slot. */
  it('o que se move é o DELTA, não o tamanho de um slot', () => {
    const d = decidirFoco({ delta: 1, focado: grandeComFolga, compensador: compensadorFolgado, sMax: SMAX });
    expect(d.series).toBe(1);
    expect(d.series).toBeLessThan(SMAX);
  });

  it('compensador no piso não cede — desce um degrau em vez de furar o piso', () => {
    const noPiso = { slots: 3, series: 8, pisoSeries: 8, pisoSlots: 1 };
    const d = decidirFoco({ delta: 1, focado: grandeComFolga, compensador: noPiso, sMax: SMAX });
    expect(d.degrau).not.toBe('serie');
  });
});

describe('🔒 cascata do foco — ② slot do compensador (degrau do PEQUENO)', () => {
  it('pequeno saturado + compensador do mesmo dia → move 1 slot, 1:1 em slot e em série', () => {
    const d = decidirFoco({ delta: 1, focado: pequenoSaturado, compensador: compensadorFolgado, sMax: SMAX });
    expect(d).toEqual({ degrau: 'slot', series: SMAX, moveSlot: true, motivo: 'slot_do_compensador' });
  });

  /**
   * 🔴 O caso que ZEROU glúteos na 1ª tentativa: compensador com 1 slot só. Ele não pode
   * ceder — e a resposta certa é descer para ordem, não deixar um grupo sem nada.
   */
  it('compensador com 1 slot NÃO é esvaziado — desce para ordem', () => {
    const magro = { slots: 1, series: 4, pisoSeries: 4, pisoSlots: 1 };
    const d = decidirFoco({ delta: 1, focado: pequenoSaturado, compensador: magro, sMax: SMAX });
    expect(d.moveSlot).toBe(false);
    expect(d.degrau).toBe('ordem');
    expect(d.motivo).toBe('compensador_no_piso');
  });

  it('pequeno já em 2 exercícios é TOPO do porte — ordem, com o motivo certo', () => {
    const pequenoNoTeto = { slots: 2, series: 8, tetoSeries: 8, tetoSlots: 2 };
    const d = decidirFoco({ delta: 1, focado: pequenoNoTeto, compensador: compensadorFolgado, sMax: SMAX });
    expect(d).toEqual({ degrau: 'ordem', series: 0, moveSlot: false, motivo: 'focado_no_teto' });
  });
});

describe('🔒 compensadores possíveis — derivados do PLANO, não de lista fixa', () => {
  const PPL: GrupoPrimario[][] = [
    ['peito', 'ombros', 'triceps'], ['costas', 'biceps', 'core'], ['quadriceps', 'posterior', 'gluteos', 'panturrilha'],
    ['peito', 'ombros', 'triceps'], ['costas', 'biceps', 'core'], ['posterior', 'quadriceps', 'gluteos', 'panturrilha'],
  ];

  /** 🔑 O fato estrutural medido: slots não atravessam dias. Peito NUNCA pode ceder à panturrilha em PPL. */
  it('em PPL×2, focar panturrilha oferece as pernas — e nunca peito', () => {
    const ops = compensadoresPossiveis(PPL, 'panturrilha');
    expect(ops).toEqual(['gluteos', 'posterior', 'quadriceps']);
    expect(ops, 'peito treina noutro dia: um slot dele não vira slot de perna').not.toContain('peito');
  });

  it('focar peito oferece os do dia de push', () => {
    expect(compensadoresPossiveis(PPL, 'peito')).toEqual(['ombros', 'triceps']);
  });

  it('core nunca é oferecido como compensador (mecânica própria, DF 2026-08-05)', () => {
    expect(compensadoresPossiveis(PPL, 'costas')).not.toContain('core');
  });

  it('grupo fora do plano não tem compensador — a UI não inventa opção', () => {
    expect(compensadoresPossiveis(PPL, 'lombar')).toEqual([]);
  });
});
