/**
 * 🔒 B2 — os cinco ramos do foco, cada um dizendo a SUA verdade.
 *
 * O guard central é o último: os dois motivos do degrau ③ não podem sair na mesma frase.
 * "Já está no topo" é boa notícia; "não há de onde tirar" é a explicação que o avançado
 * precisa para não ler a tela como quebrada. Colapsá-los num texto só reintroduziria a
 * ambiguidade que custou a rodada de medição de 2026-08-14.
 */
import { describe, expect, it } from 'vitest';
import { fraseDoFoco } from './foco-copy';
import type { RotinaSemanal } from '@/lib/engine';

const rot = (foco: RotinaSemanal['foco']): RotinaSemanal =>
  ({ diasForcaAgendados: 4, diasCardioRecuperacao: 0, split: 'x', dias: [], diasCardio: [], cardio: { tipo: 'sessoes_moderadas', min: 1, max: 2 }, avisos: [], ...(foco ? { foco } : {}) }) as RotinaSemanal;

const base = { grupo: 'peito', compensa: 'triceps' } as const;

describe('🔒 B2 — a tela diz qual ramo agiu', () => {
  it('sem foco, nenhuma frase (ausência não fala)', () => {
    expect(fraseDoFoco(rot(undefined))).toBeNull();
    expect(fraseDoFoco(null)).toBeNull();
  });

  it('① série: diz QUANTAS séries e QUEM cedeu', () => {
    const f = fraseDoFoco(rot({ ...base, degrau: 'serie', motivo: 'folga', series: 1 }))!;
    expect(f).toContain('Peito em foco');
    expect(f).toContain('+1 série');
    expect(f).toContain('Tríceps');
  });

  it('② slot: diz +1 EXERCÍCIO — grandeza diferente da série (assimetria declarada)', () => {
    const f = fraseDoFoco(rot({ grupo: 'panturrilha', compensa: 'quadriceps', degrau: 'slot', motivo: 'slot_do_compensador', series: 4 }))!;
    expect(f).toContain('+1 exercício');
    expect(f, 'o degrau do slot não pode falar em séries — confundiria as duas grandezas').not.toContain('série');
    expect(f).toContain('Quadríceps');
  });

  it('⓪ delta 0 (semana 1): diz que a entrega é PRIORIDADE, não séries', () => {
    const f = fraseDoFoco(rot({ ...base, degrau: 'ordem', motivo: 'delta_zero', series: 0 }))!;
    expect(f).toContain('prioridade');
    expect(f).toContain('primeiro na sessão');
  });

  it('③ focado no teto: "já está no topo"', () => {
    const f = fraseDoFoco(rot({ grupo: 'costas', compensa: 'biceps', degrau: 'ordem', motivo: 'focado_no_teto', series: 0 }))!;
    expect(f).toContain('já está no topo');
  });

  it('③ compensador no piso: "não há de onde tirar" — a frase do avançado', () => {
    const f = fraseDoFoco(rot({ ...base, degrau: 'ordem', motivo: 'compensador_no_piso', series: 0 }))!;
    expect(f).toContain('Não há de onde tirar');
    expect(f).toContain('volume mínimo');
  });

  it('③ sem dia comum: pede para REESCOLHER (o motor não escolhe sozinho)', () => {
    const f = fraseDoFoco(rot({ grupo: 'panturrilha', compensa: 'peito', degrau: 'ordem', motivo: 'sem_dia_comum', series: 0 }))!;
    expect(f).toContain('mesmo dia');
    expect(f).toContain('Escolha');
  });

  /**
   * 🔑 O PAR DISCRIMINANTE do B2: os dois motivos do ③ produzem textos DIFERENTES. Uma
   * implementação que respondesse "vem primeiro na sessão" para os dois passaria em todos os
   * testes acima menos neste — e devolveria ao avançado exatamente o silêncio ambíguo que
   * este trabalho existe para matar.
   */
  it('os dois motivos do ③ NÃO saem na mesma frase', () => {
    const teto = fraseDoFoco(rot({ ...base, degrau: 'ordem', motivo: 'focado_no_teto', series: 0 }));
    const piso = fraseDoFoco(rot({ ...base, degrau: 'ordem', motivo: 'compensador_no_piso', series: 0 }));
    expect(teto).not.toBe(piso);
    expect(piso, 'o motivo do piso não pode dizer que o grupo está no topo').not.toContain('no topo');
    expect(teto, 'o motivo do teto não pode dizer que faltou de onde tirar').not.toContain('de onde tirar');
  });

  /** Nenhum ramo pode soar como falha da pessoa (regra de copy da casa). */
  it('nenhuma frase acusa a pessoa nem promete resultado', () => {
    const motivos = ['folga', 'slot_do_compensador', 'delta_zero', 'focado_no_teto', 'compensador_no_piso', 'sem_dia_comum'] as const;
    for (const motivo of motivos) {
      const degrau = motivo === 'folga' ? 'serie' : motivo === 'slot_do_compensador' ? 'slot' : 'ordem';
      const f = fraseDoFoco(rot({ ...base, degrau, motivo, series: degrau === 'ordem' ? 0 : 1 }))!;
      expect(f, motivo).not.toMatch(/você (não|deveria|precisa|falhou)|falta[mr]?\b|erro|impossível/i);
    }
  });
});
