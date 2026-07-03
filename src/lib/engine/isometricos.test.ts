import { describe, expect, it } from 'vitest';
import { HOLD_SEGUNDOS, PISO_HOLD_SEG, REP_UNIT_SEGUNDOS, faixaSegundos, repUnitDe, rotuloFaixaSeg } from './isometricos';
import { EXERCISES } from '../data/exercises';

/**
 * Âncoras da spec (cofre): ranking §Unidade de registro (5 holds → segundos) +
 * parametros-motor-treino §Isométricos DF 2026-07-03 (faixas por nível + piso 10 s).
 */
describe('isométricos — repUnit segundos + faixas de tempo (cofre)', () => {
  it('exatamente os 5 holds curados registram segundos; o resto é reps', () => {
    expect([...REP_UNIT_SEGUNDOS].sort()).toEqual(['e118', 'e140', 'e7', 'e90', 'e94']);
    expect(repUnitDe('e7')).toBe('segundos');
    expect(repUnitDe('e140')).toBe('segundos');
    expect(repUnitDe('e1')).toBe('reps'); // Flexão
    expect(repUnitDe('')).toBe('reps'); // exercício personalizado
  });

  it('os 5 ids batem com os exercícios certos na biblioteca (pega dessincronia)', () => {
    const nome = (id: string) => EXERCISES.find((e) => e.id === id)?.nomePt;
    expect(nome('e7')).toBe('Prancha');
    expect(nome('e90')).toBe('Prancha lateral');
    expect(nome('e94')).toBe('Agachamento na parede (isométrico)');
    expect(nome('e118')).toBe('Pendura na barra');
    expect(nome('e140')).toBe('Pegada estática (farmer hold)');
  });

  it('faixas por nível verbatim do cofre §Faixas por nível', () => {
    expect(HOLD_SEGUNDOS.e7).toEqual({ iniciante: { min: 20, max: 40 }, intermediario: { min: 40, max: 70 }, avancado: { min: 70, max: 120 } });
    expect(HOLD_SEGUNDOS.e90).toEqual({ iniciante: { min: 15, max: 30 }, intermediario: { min: 30, max: 50 }, avancado: { min: 50, max: 90 } });
    expect(HOLD_SEGUNDOS.e94).toEqual({ iniciante: { min: 20, max: 45 }, intermediario: { min: 45, max: 75 }, avancado: { min: 75, max: 120 } });
    expect(HOLD_SEGUNDOS.e118).toEqual({ iniciante: { min: 10, max: 25 }, intermediario: { min: 25, max: 50 }, avancado: { min: 50, max: 90 } });
    // farmer hold: avançado tem topo aberto (60–90+)
    expect(HOLD_SEGUNDOS.e140!.avancado).toEqual({ min: 60, max: 90, aberto: true });
  });

  it('faixaSegundos escolhe pela experiência do usuário; null para não-holds', () => {
    expect(faixaSegundos('e7', 'iniciante')).toEqual({ min: 20, max: 40 });
    expect(faixaSegundos('e7', 'avancado')).toEqual({ min: 70, max: 120 });
    expect(faixaSegundos('e1', 'iniciante')).toBeNull();
  });

  it('rótulo mostra o topo aberto do farmer hold avançado como "60–90+"', () => {
    expect(rotuloFaixaSeg({ min: 20, max: 40 })).toBe('20–40');
    expect(rotuloFaixaSeg(HOLD_SEGUNDOS.e140!.avancado)).toBe('60–90+');
  });

  it('piso de registro é 10 s (espelha o piso de reps = 6)', () => {
    expect(PISO_HOLD_SEG).toBe(10);
  });
});
