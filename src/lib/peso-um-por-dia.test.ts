/**
 * UM REGISTRO DE PESO POR DIA + o peso do perfil seguindo o registro (decisões do autor,
 * 2026-09-11). Testes de COMPORTAMENTO: exercitam as funções de verdade, com storage
 * stubado, em vez de procurar trechos de código.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lerPesos, pesoDoDia, registrarPesoLocal } from './treino-historico';
import { diaLocalISO } from './dia-local';
import { definirEscopoLocal } from './escopo-local';
import { FAIXA_INICIAL, resolverPesoDoPlano, type EstadoPesoPlano } from './engine/peso-suavizado';
import { kcalLiquida, metDe } from './engine/cardio';

/** Storage em memória, como o resto da suíte já faz. */
function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  });
  return store;
}

describe('um registro por dia — o dia civil local', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('o PRIMEIRO registro do dia entra no histórico', () => {
    stubStorage();
    try {
      const r = registrarPesoLocal(80, '2026-09-11');
      expect(r.tipo).toBe('REGISTRADO');
      expect(lerPesos()).toEqual([{ dataISO: '2026-09-11', kg: 80 }]);
    } finally { vi.unstubAllGlobals(); }
  });

  it('🔒 a SEGUNDA tentativa do dia é recusada: não grava e NÃO substitui a primeira', () => {
    stubStorage();
    try {
      registrarPesoLocal(80, '2026-09-11');
      const r = registrarPesoLocal(77, '2026-09-11');
      expect(r.tipo).toBe('RECUSADO_DIA');
      expect(r.tipo === 'RECUSADO_DIA' && r.registradoKg).toBe(80);
      // o histórico continua com UMA linha, e com o peso do PRIMEIRO registro
      expect(lerPesos()).toEqual([{ dataISO: '2026-09-11', kg: 80 }]);
    } finally { vi.unstubAllGlobals(); }
  });

  it('reenvio IDÊNTICO no mesmo dia é idempotente — não duplica e não é erro', () => {
    stubStorage();
    try {
      registrarPesoLocal(80, '2026-09-11');
      const r1 = registrarPesoLocal(80, '2026-09-11');
      const r2 = registrarPesoLocal(80, '2026-09-11');
      expect(r1.tipo).toBe('IDEMPOTENTE');
      expect(r2.tipo).toBe('IDEMPOTENTE');
      expect(lerPesos()).toHaveLength(1);
    } finally { vi.unstubAllGlobals(); }
  });

  it('o DIA SEGUINTE aceita um registro novo', () => {
    stubStorage();
    try {
      registrarPesoLocal(80, '2026-09-11');
      expect(registrarPesoLocal(79.4, '2026-09-12').tipo).toBe('REGISTRADO');
      expect(lerPesos()).toEqual([
        { dataISO: '2026-09-11', kg: 80 }, { dataISO: '2026-09-12', kg: 79.4 },
      ]);
    } finally { vi.unstubAllGlobals(); }
  });

  it('registro LEGADO (sem data) nunca bloqueia o dia', () => {
    const store = stubStorage();
    try {
      store.set('evk_pesos', '[80,81]'); // formato antigo: números puros, sem data
      expect(lerPesos()).toEqual([{ dataISO: null, kg: 80 }, { dataISO: null, kg: 81 }]);
      expect(registrarPesoLocal(79, '2026-09-11').tipo).toBe('REGISTRADO');
      expect(pesoDoDia(lerPesos(), '2026-09-11')?.kg).toBe(79);
    } finally { vi.unstubAllGlobals(); }
  });

  it('USUÁRIOS DIFERENTES são independentes (o storage é escopado por conta)', () => {
    stubStorage();
    try {
      definirEscopoLocal('conta-A');
      expect(registrarPesoLocal(80, '2026-09-11').tipo).toBe('REGISTRADO');
      definirEscopoLocal('conta-B');
      // mesmo dia, outra conta: continua sendo o PRIMEIRO registro dela
      expect(registrarPesoLocal(95, '2026-09-11').tipo).toBe('REGISTRADO');
      expect(lerPesos()).toEqual([{ dataISO: '2026-09-11', kg: 95 }]);
      definirEscopoLocal('conta-A');
      expect(lerPesos()).toEqual([{ dataISO: '2026-09-11', kg: 80 }]);
    } finally { definirEscopoLocal(null); vi.unstubAllGlobals(); }
  });
});

describe('a fronteira do dia é LOCAL, não UTC', () => {
  it('23h30 do dia 11 em UTC-3 é dia 11 — mesmo com o UTC já no dia 12', () => {
    const tzAntes = process.env.TZ;
    process.env.TZ = 'America/Sao_Paulo';
    try {
      const noite = new Date(2026, 8, 11, 23, 30); // 11/09 23:30 local
      expect(diaLocalISO(noite)).toBe('2026-09-11');
      // a prova de que a regra NÃO é UTC: o UTC já virou
      expect(noite.toISOString().slice(0, 10)).toBe('2026-09-12');
      expect(diaLocalISO(noite)).not.toBe(noite.toISOString().slice(0, 10));
    } finally { process.env.TZ = tzAntes; }
  });

  it('a meia-noite local abre um dia novo — e só ela', () => {
    const tzAntes = process.env.TZ;
    process.env.TZ = 'America/Sao_Paulo';
    try {
      expect(diaLocalISO(new Date(2026, 8, 11, 23, 59, 59))).toBe('2026-09-11');
      expect(diaLocalISO(new Date(2026, 8, 12, 0, 0, 0))).toBe('2026-09-12');
    } finally { process.env.TZ = tzAntes; }
  });

  it('não é janela móvel de 24 h: 22h e 8h do dia seguinte são dias DIFERENTES', () => {
    const tzAntes = process.env.TZ;
    process.env.TZ = 'America/Sao_Paulo';
    try {
      const a = diaLocalISO(new Date(2026, 8, 11, 22, 0));
      const b = diaLocalISO(new Date(2026, 8, 12, 8, 0)); // 10 h depois
      expect(a).not.toBe(b);
      stubStorage();
      try {
        expect(registrarPesoLocal(80, a).tipo).toBe('REGISTRADO');
        expect(registrarPesoLocal(80.2, b).tipo).toBe('REGISTRADO'); // < 24 h, dia novo
      } finally { vi.unstubAllGlobals(); }
    } finally { process.env.TZ = tzAntes; }
  });
});

describe('efeitos do peso do perfil — o que muda e o que NÃO muda', () => {
  it('🟢 o CARDIO passa a usar o peso novo (a estimativa acompanha)', () => {
    const met = metDe('caminhada', 'moderado')!;
    const antes = kcalLiquida(met, 80, 30);
    const depois = kcalLiquida(met, 84, 30);
    expect(antes).toBeCloseTo(138.6, 4);
    expect(depois).toBeCloseTo(145.53, 4);
    expect(depois).toBeGreaterThan(antes);
  });

  it('🔴 a ÂNCORA do motor NÃO se move só porque o peso do perfil mudou', () => {
    const pesagens = [
      { dataISO: '2026-09-09', kg: 80 },
      { dataISO: '2026-09-10', kg: 80 },
      { dataISO: '2026-09-11', kg: 80 },
    ];
    const anterior: EstadoPesoPlano = {
      ancoraKg: 80, ancoraDesdeISO: '2026-09-11', ancoraMedida: true,
      faixa: FAIXA_INICIAL, pesoNaFaixaKg: null, reancoraISO: null,
    };
    const semMudanca = resolverPesoDoPlano({
      pesagens, hojeISO: '2026-09-11', pesoPerfilKg: 80,
      anterior, emFaixaProtetiva: () => false,
    });
    const comPerfilNovo = resolverPesoDoPlano({
      pesagens, hojeISO: '2026-09-11', pesoPerfilKg: 95, // perfil mudou muito
      anterior, emFaixaProtetiva: () => false,
    });
    // mesma âncora, mesmo peso do plano: `pesoPerfilKg` só é SEMENTE, e só sem âncora
    expect(comPerfilNovo.pesoKg).toBe(semMudanca.pesoKg);
    expect(comPerfilNovo.estado.ancoraKg).toBe(anterior.ancoraKg);
    expect(comPerfilNovo.estado.ancoraDesdeISO).toBe(anterior.ancoraDesdeISO);
    expect(comPerfilNovo.estado.reancoraISO).toBeNull(); // não reancorou
  });
});
