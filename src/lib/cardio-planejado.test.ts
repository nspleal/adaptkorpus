import { afterEach, describe, expect, it, vi } from 'vitest';
import { lerCardioPlanejado, normalizarCardioPlanejado, salvarCardioPlanejado } from './cardio-planejado';
import { chaveLocal, definirEscopoLocal, limparDadoPessoalLocal } from './escopo-local';

afterEach(() => { definirEscopoLocal(null); vi.unstubAllGlobals(); });

describe('montagem de cardio importada do laboratório', () => {
  it('descarta dados inválidos sem perder os dias válidos, ordena e elimina dias duplicados', () => {
    expect(normalizarCardioPlanejado([null, false, {}, { diaId: 'seg', modalidade: 'toString', minutos: 20 },
      { diaId: 'ter', modalidade: 'corrida', minutos: 1.5 },
      { diaId: 'seg', modalidade: 'caminhada', minutos: -1 },
      { diaId: 'ter', modalidade: 'corrida', minutos: 30 },
      { diaId: 'seg', modalidade: 'caminhada', minutos: 10 },
      { diaId: 'seg', modalidade: 'caminhada', minutos: 20 },
    ])).toEqual([{ diaId: 'seg', modalidade: 'caminhada', minutos: 20 }, { diaId: 'ter', modalidade: 'corrida', minutos: 30 }]);
    expect(normalizarCardioPlanejado({ dias: [] })).toEqual([]);
  });

  it('salva/reabre, isola contas e limpa o plano no logout sem criar sessão realizada', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k),
    });
    definirEscopoLocal('conta-A');
    salvarCardioPlanejado([{ diaId: 'seg', modalidade: 'caminhada', minutos: 20 }]);
    expect(lerCardioPlanejado()).toHaveLength(1);
    expect(data.has(chaveLocal('evk_treinos'))).toBe(false);
    definirEscopoLocal('conta-B');
    expect(lerCardioPlanejado()).toEqual([]);
    salvarCardioPlanejado([{ diaId: 'qua', modalidade: 'corrida', minutos: 15 }]);
    definirEscopoLocal('conta-A');
    expect(lerCardioPlanejado()[0]?.diaId).toBe('seg');
    limparDadoPessoalLocal('conta-A');
    expect(lerCardioPlanejado()).toEqual([]);
    definirEscopoLocal('conta-B'); expect(lerCardioPlanejado()[0]?.diaId).toBe('qua');
  });

  it('propaga erro de armazenamento para que a tela não anuncie salvamento falso', () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('quota'); } });
    expect(() => salvarCardioPlanejado([])).toThrow('quota');
  });
});
