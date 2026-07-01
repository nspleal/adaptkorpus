import { describe, expect, it } from 'vitest';
import { marcarPratoCansado, pratosCansadosAtivos, DESCANSO_PRATO_DIAS } from './rotacao-pratos';

const T0 = new Date('2026-07-01T12:00:00Z');
const maisDias = (base: Date, d: number) => new Date(base.getTime() + d * 86_400_000);

describe('rotação de pratos — "Cansei deste prato" (descanso de 21 dias, retorno automático)', () => {
  it('marca o prato com retorno em exatamente 21 dias', () => {
    const [c] = marcarPratoCansado([], 'r5', T0);
    expect(c!.id).toBe('r5');
    expect(c!.ate).toBe(maisDias(T0, DESCANSO_PRATO_DIAS).toISOString());
  });

  it('fica ativo durante a janela e retorna sozinho após 21 dias', () => {
    const lista = marcarPratoCansado([], 'r5', T0);
    expect(pratosCansadosAtivos(lista, T0)).toEqual(['r5']);              // no dia da marcação
    expect(pratosCansadosAtivos(lista, maisDias(T0, 20))).toEqual(['r5']); // 20 dias depois: ainda descansando
    expect(pratosCansadosAtivos(lista, maisDias(T0, 22))).toEqual([]);     // 22 dias depois: voltou sozinho
  });

  it('remarcar o mesmo prato reinicia a contagem (não duplica)', () => {
    const l1 = marcarPratoCansado([], 'r5', T0);
    const l2 = marcarPratoCansado(l1, 'r5', maisDias(T0, 10));
    expect(l2.filter((c) => c.id === 'r5')).toHaveLength(1);
    expect(l2[0]!.ate).toBe(maisDias(T0, 10 + DESCANSO_PRATO_DIAS).toISOString());
  });

  it('é robusto a entradas ausentes/corrompidas', () => {
    expect(pratosCansadosAtivos(undefined, T0)).toEqual([]);
    expect(pratosCansadosAtivos([{ id: 'x', ate: 'não-é-data' }], T0)).toEqual([]);
  });
});
