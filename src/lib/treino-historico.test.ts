import { describe, expect, it, vi } from 'vitest';
import { lerPesos, lerPesosKg, novaSessaoDe, reconciliarHistorico, registrarPesoLocal, sessoesTreino, substituirPesos, type SessaoHistorico } from './treino-historico';
import { diasDeTreino } from './chama';

/**
 * Salvaguarda travada do B2 (cofre DF #13, 2026-07-04): evento de calibração NÃO conta
 * como dia de treino (Chama/marcos) nem alimenta o gráfico de Cargas.
 */
const base = { dia: 'Treino', series: 3, volumeKg: 0, feedback: {}, exercicios: [] };

describe('sessoesTreino — calibração fora da Chama e das Cargas', () => {
  it('filtra entradas tipo calibracao; treino normal (com e sem tipo) passa', () => {
    const hist: SessaoHistorico[] = [
      { ...base, n: 1, dataISO: '2026-07-01' },
      { ...base, n: 2, dataISO: '2026-07-02', tipo: 'calibracao', dia: 'Calibração manual', series: 0 },
      { ...base, n: 3, dataISO: '2026-07-03', manual: true },
    ];
    expect(sessoesTreino(hist).map((s) => s.n)).toEqual([1, 3]);
  });

  it('Chama: calibração em data NOVA não vira dia de treino', () => {
    const hist: SessaoHistorico[] = [
      { ...base, n: 1, dataISO: '2026-07-01' },
      { ...base, n: 2, dataISO: '2026-07-02', tipo: 'calibracao', dia: 'Calibração manual', series: 0 },
    ];
    expect(diasDeTreino(sessoesTreino(hist).map((s) => s.dataISO))).toBe(1);
    // sem o filtro seriam 2 — é exatamente o que a salvaguarda impede
    expect(diasDeTreino(hist.map((s) => s.dataISO))).toBe(2);
  });
});

describe('novaSessaoDe — a recém-gravada é a de maior n (write-through p/ o servidor)', () => {
  it('acha o max n independente da ordem do array; vazio → null', () => {
    const hist: SessaoHistorico[] = [
      { ...base, n: 2, dataISO: '2026-07-02' },
      { ...base, n: 5, dataISO: '2026-07-01' }, // registrada por último (n máximo), data antiga
      { ...base, n: 3, dataISO: '2026-07-03' },
    ];
    expect(novaSessaoDe(hist)?.n).toBe(5);
    expect(novaSessaoDe([])).toBeNull();
  });
});

// ── Fix bloqueador 2026-07-08 (cofre outputs/bug-persistencia-e-avatar): a hidratação
// NUNCA destrói dado local; sessões só-locais re-sobem (retry do write-through). ──
describe('reconciliarHistorico — hidratação não-destrutiva local × servidor', () => {
  const s = (n: number, dataISO: string, extra: Partial<SessaoHistorico> = {}): SessaoHistorico =>
    ({ ...base, n, dataISO, ...extra });

  it('cenário do bug: servidor [] + local não-vazio → NADA é apagado; tudo vira faltante (re-sobe)', () => {
    const locais = [s(3, '2026-07-08'), s(2, '2026-07-06'), s(1, '2026-07-05')];
    const { uniao, faltantes } = reconciliarHistorico(locais, []);
    expect(uniao).toHaveLength(3);
    expect(faltantes).toHaveLength(3); // os 3 uploads de retry
    expect(uniao.map((x) => x.n)).toEqual([3, 2, 1]); // ordem canônica preservada
  });

  it('chave compartilhada (dataISO|n|tipo): o SERVIDOR vence (payload do servidor na união)', () => {
    const doServidor = [s(1, '2026-07-05', { dia: 'Do Servidor' })];
    const locais = [s(1, '2026-07-05', { dia: 'Local Velho' }), s(2, '2026-07-06')];
    const { uniao, faltantes } = reconciliarHistorico(locais, doServidor);
    expect(uniao.find((x) => x.n === 1)?.dia).toBe('Do Servidor');
    expect(faltantes.map((x) => x.n)).toEqual([2]); // só a sessão que faltou no servidor
    expect(uniao).toHaveLength(2);
  });

  it('servidor completo → união = servidor, zero faltantes (2º device coerente)', () => {
    const doServidor = [s(2, '2026-07-06'), s(1, '2026-07-05')];
    const { uniao, faltantes } = reconciliarHistorico(doServidor, doServidor);
    expect(faltantes).toHaveLength(0);
    expect(uniao.map((x) => x.n)).toEqual([2, 1]);
  });

  it('tipos de evento entram na chave (calibração e sinal_fadiga não colidem com treino do mesmo dia/n)', () => {
    const locais = [s(1, '2026-07-05'), s(1, '2026-07-05', { tipo: 'calibracao' })];
    const { uniao, faltantes } = reconciliarHistorico(locais, [s(1, '2026-07-05')]);
    expect(uniao).toHaveLength(2);
    expect(faltantes.map((x) => x.tipo)).toEqual(['calibracao']);
  });

  it('ambos vazios → vazio; determinístico (dupla chamada idêntica)', () => {
    expect(reconciliarHistorico([], [])).toEqual({ uniao: [], faltantes: [] });
    const locais = [s(2, '2026-07-06'), s(1, '2026-07-05')];
    const a = reconciliarHistorico(locais, [s(1, '2026-07-05')]);
    const b = reconciliarHistorico(locais, [s(1, '2026-07-05')]);
    expect(a).toEqual(b);
  });
});

describe('pesos locais (evk_pesos — fix: pesos eram só memória)', () => {
  it('round-trip com storage stubado; corrompido/ausente → []', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
    try {
      expect(lerPesos()).toEqual([]);
      // 🔒 Leva D: a série carrega DATA. A data é carimbada aqui (UI), não no motor.
      expect(registrarPesoLocal(80, '2026-07-30')).toEqual([{ dataISO: '2026-07-30', kg: 80 }]);
      expect(registrarPesoLocal(79.5, '2026-07-31')).toEqual([
        { dataISO: '2026-07-30', kg: 80 }, { dataISO: '2026-07-31', kg: 79.5 },
      ]);
      expect(lerPesos()).toEqual([
        { dataISO: '2026-07-30', kg: 80 }, { dataISO: '2026-07-31', kg: 79.5 },
      ]);
      expect(substituirPesos([{ dataISO: '2026-07-29', kg: 81 }, { dataISO: '2026-07-30', kg: 80 }]))
        .toEqual([{ dataISO: '2026-07-29', kg: 81 }, { dataISO: '2026-07-30', kg: 80 }]);
      store.set('evk_pesos', '{corrompido');
      expect(lerPesos()).toEqual([]);
      // 🔒 RETROCOMPATÍVEL: número puro (formato anterior) entra SEM data — não conta na
      // janela de 7 dias, mas continua no gráfico. Perder o ponto trocaria um defeito por
      // outro. `lerPesosKg` é a porta do gráfico e devolve todos.
      store.set('evk_pesos', '[80,"x",null,79]');
      expect(lerPesos()).toEqual([{ dataISO: null, kg: 80 }, { dataISO: null, kg: 79 }]);
      expect(lerPesosKg()).toEqual([80, 79]);
      // Série MISTA (o navegador de quem já usava): legado + novo, na mesma lista.
      store.set('evk_pesos', '[80,{"dataISO":"2026-07-31","kg":79.2}]');
      expect(lerPesos()).toEqual([{ dataISO: null, kg: 80 }, { dataISO: '2026-07-31', kg: 79.2 }]);
      expect(lerPesosKg()).toEqual([80, 79.2]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
