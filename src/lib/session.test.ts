import { afterEach, describe, expect, it, vi } from 'vitest';
import { lerSessao, lerSessaoCompleta, migrarSessao, salvarSessao } from './session';

/**
 * Política travada (DF 2026-07-05): um bump de VERSAO NUNCA descarta o perfil salvo — ele é
 * MIGRADO (via normalizarPerfil) e re-carimbado. Só o irrecuperável vira null. Prova: um
 * perfil de versão antiga carrega migrado e não cai no onboarding.
 */
const legacyPerfil = {
  sexo: 'masculino', idade: 30, alturaCm: 180, pesoKg: 80, objetivo: 'massa',
  nivelAtividade: 'moderado', nivelExperiencia: 'intermediario',
  equipamento: 'nenhum', // legado (pré modelo 2 níveis)
  preferencia: null, alergenos: [], diasDisponiveis: 3, tempoPorSessaoMin: 60,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  // blob antigo: SEM treinoDias / favoritos / equipamentosCasa / pratosCansados
};

describe('migrarSessao — nunca descarta o perfil num bump de versão', () => {
  it('versão ANTIGA (v=1 < atual=2) migra e sinaliza migrou:true', () => {
    const res = migrarSessao(JSON.stringify({ v: 1, perfil: legacyPerfil }), 2);
    expect(res).not.toBeNull();
    expect(res!.migrou).toBe(true);
    expect(res!.perfil.equipamento).toBe('casa');            // nenhum → casa
    expect(res!.perfil.equipamentosCasa).toEqual([]);         // casa + checklist vazio
    expect(res!.perfil.favoritos).toEqual([]);                // backfill V8.2
    expect(res!.perfil.treinoDias.length).toBeGreaterThan(0); // derivado (diasPadrao)
  });

  it('mesma versão (v === atual) → migrou:false (sem re-carimbo)', () => {
    expect(migrarSessao(JSON.stringify({ v: 1, perfil: legacyPerfil }), 1)!.migrou).toBe(false);
  });

  it('descarta só o irrecuperável: versão futura, sem perfil, v ausente, JSON quebrado, vazio', () => {
    expect(migrarSessao(JSON.stringify({ v: 99, perfil: legacyPerfil }), 1)).toBeNull(); // app futuro
    expect(migrarSessao(JSON.stringify({ v: 1 }), 1)).toBeNull();                         // sem perfil
    expect(migrarSessao(JSON.stringify({ perfil: legacyPerfil }), 1)).toBeNull();         // v ausente
    expect(migrarSessao('{ não é json', 1)).toBeNull();                                   // quebrado
    expect(migrarSessao(null, 1)).toBeNull();
  });
});

describe('lerSessao — perfil antigo carrega migrado e re-carimba (não cai no onboarding)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('blob de versão antiga (v=0) → perfil migrado + storage re-carimbado p/ VERSAO atual', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
    store.set('evk_sessao', JSON.stringify({ v: 0, perfil: legacyPerfil }));

    const perfil = lerSessao();
    expect(perfil).not.toBeNull();               // NÃO retorna null → app não redireciona ao onboarding
    expect(perfil!.equipamento).toBe('casa');    // migrado
    expect(JSON.parse(store.get('evk_sessao')!).v).toBe(2); // re-carimbado p/ VERSAO atual
  });
});


describe('sessão C1 — fotografia das entradas transitórias', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('preserva oferta de cardio e escolha de execução em reload offline', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
    const entrada = {
      pesoEfetivoKg: 80,
      diasOferecidosCardio: ['qua'] as const,
      semanaCiclo: { semana: 1 as const, feedbackGrupos: [] as [] },
      escolhasExecucao: [['e72', 'BILATERAL'] as ['e72', 'BILATERAL']],
    };
    salvarSessao(legacyPerfil as never, entrada);
    const sessao = lerSessaoCompleta();
    expect(sessao?.entradaPlano).toEqual(entrada);
    expect(JSON.parse(store.get('evk_sessao')!).v).toBe(2);
  });
});
