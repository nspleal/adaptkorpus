import { describe, expect, it } from 'vitest';
import { APOIO_CHAMA, MARCOS_CHAMA, bandaChama, chamaAtual, diasDeTreino, pillChama, proximosMarcos } from './chama';

/**
 * Âncoras da spec (design_handoff_chama_marcos + cofre registro-de-aderencia §Contador):
 * marcos 15/25/50/100 · âmbar desde o dia 1 (nunca apagada) · ênfase só ao cruzar o 1º marco ·
 * contador = dias DISTINTOS (dedupe por dia calendário) · copy final por faixa.
 */
describe('chama dos 4 marcos (contador de treinos)', () => {
  it('marcos canônicos: 15 âmbar · 25 azul · 50 roxo · 100 verde Folha', () => {
    expect(MARCOS_CHAMA.map((m) => [m.dias, m.cor])).toEqual([[15, 'amber'], [25, 'azul'], [50, 'roxo'], [100, 'verde']]);
  });

  it('bandas nas fronteiras exatas (14→0, 15→1, 24→1, 25→2, 49→2, 50→3, 99→3, 100→4)', () => {
    expect(bandaChama(0)).toBe(0);
    expect(bandaChama(14)).toBe(0);
    expect(bandaChama(15)).toBe(1);
    expect(bandaChama(24)).toBe(1);
    expect(bandaChama(25)).toBe(2);
    expect(bandaChama(49)).toBe(2);
    expect(bandaChama(50)).toBe(3);
    expect(bandaChama(99)).toBe(3);
    expect(bandaChama(100)).toBe(4);
    expect(bandaChama(365)).toBe(4);
  });

  it('acesa desde o dia 1: X<15 é âmbar SEM ênfase (nunca cinza), X≥15 com ênfase', () => {
    expect(chamaAtual(0)).toEqual({ cor: 'amber', enfase: false, nome: 'Âmbar', marco: 0 });
    expect(chamaAtual(1).cor).toBe('amber');
    expect(chamaAtual(1).enfase).toBe(false);
    expect(chamaAtual(15)).toEqual({ cor: 'amber', enfase: true, nome: 'Âmbar', marco: 15 });
    expect(chamaAtual(120)).toEqual({ cor: 'verde', enfase: true, nome: 'Verde Folha', marco: 100 });
  });

  it('pill: "Aquecendo" antes do 1º marco; "Marco N dias · Nome" depois', () => {
    expect(pillChama(8)).toBe('Aquecendo · antes do 1º marco');
    expect(pillChama(15)).toBe('Marco 15 dias · Âmbar');
    expect(pillChama(50)).toBe('Marco 50 dias · Roxo');
    expect(pillChama(100)).toBe('Marco 100 dias · Verde Folha');
  });

  it('copy de apoio por faixa é a copy FINAL do handoff (nunca fala em perder/zerar)', () => {
    expect(APOIO_CHAMA[0]).toBe('Um total que só cresce — sem sequência pra perder.');
    expect(APOIO_CHAMA[4]).toBe('Chama verde Folha: 100 dias somados. Isso é constância.');
    for (const linha of APOIO_CHAMA) {
      expect(linha).not.toMatch(/perdeu|zerou|apagou|faltou/i);
    }
  });

  it('próximos marcos: só os não alcançados, com "faltam N dias"; vazio em X≥100', () => {
    expect(proximosMarcos(12)).toEqual([
      { cor: 'amber', dias: 15, faltamTxt: 'faltam 3 dias' },
      { cor: 'azul', dias: 25, faltamTxt: 'faltam 13 dias' },
      { cor: 'roxo', dias: 50, faltamTxt: 'faltam 38 dias' },
      { cor: 'verde', dias: 100, faltamTxt: 'faltam 88 dias' },
    ]);
    expect(proximosMarcos(50).map((m) => m.dias)).toEqual([100]);
    expect(proximosMarcos(100)).toEqual([]);
    // concordância: 1 dia restante fica no singular
    expect(proximosMarcos(14)[0]!.faltamTxt).toBe('falta 1 dia');
  });

  it('contador conta dias DISTINTOS: dois treinos no mesmo dia = 1 dia (dedupe)', () => {
    expect(diasDeTreino([])).toBe(0);
    expect(diasDeTreino(['2026-07-01', '2026-07-01', '2026-07-02'])).toBe(2);
    expect(diasDeTreino(['2026-07-01', '', '2026-07-03'])).toBe(2);
  });

  it('nunca regride: banda é monotônica no total de dias', () => {
    let prev = 0;
    for (let x = 0; x <= 130; x++) {
      const b = bandaChama(x);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });
});
