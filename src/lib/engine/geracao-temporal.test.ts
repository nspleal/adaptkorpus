/**
 * 🔒 C1 — geração temporal: taxonomia do alocador (precedência) + reduce-to-fit ponta a ponta.
 * Catálogo sintético A/B/C/D da spec §8. Fixtures: 21, 22, 23, 31, 44, 45, 51, 54, 55, 56, 57.
 */
import { describe, expect, it } from 'vitest';
import {
  avaliarInvariantes,
  classificarTentativa,
  fatosReducao,
  gerarPlanoTemporal,
  type Alocador,
  type InvariantesTreino,
  type ItemPlanoTemporal,
  type Padrao,
} from './geracao-temporal';

const item = (id: string, padrao: Padrao, grupo: string, equip: string, descanso: number, holdIso?: number): ItemPlanoTemporal => ({
  id, padrao, grupo, equipamento: equip, series: 3, descansoSeg: descanso,
  execucao: holdIso === undefined
    ? { tipo: 'REPETICOES', segundosEstimadosPorSerie: 40 }
    : { tipo: 'ISOMETRIA', holdSegundosPorSerie: holdIso },
});

// Catálogo sintético (spec §8.2 fixture 21).
const A = item('A', 'puxar', 'costas', 'halter', 90);
const B = item('B', 'empurrar', 'peito', 'halter', 90);
const C = item('C', 'agachar', 'quadriceps', 'peso-corporal', 90);
const D = item('D', 'isolado', 'biceps', 'halter', 60);
const E = item('E', 'isolado', 'triceps', 'halter', 60);
const INV: InvariantesTreino = { coberturaObrigatoria: ['puxar', 'empurrar', 'agachar'], equipamentosDisponiveis: ['halter', 'peso-corporal'] };

describe('C1 geração temporal · invariantes', () => {
  it('cobertura completa + puxar>=empurrar + equipamento na allowlist ⇒ ok', () => {
    expect(avaliarInvariantes([A, B, C], INV).ok).toBe(true);
  });
  it('cobertura ausente (sem agachar) ⇒ viola', () => {
    expect(avaliarInvariantes([A, B, D], INV).ok).toBe(false);
  });
});

describe('C1 geração temporal · precedência do alocador (spec §6; fixtures 54-57, 51)', () => {
  it('fixture 54: capacidade repetida ⇒ CAPACIDADE_REPETIDA (antes de tudo)', () => {
    const t = classificarTentativa({ capacidadeTestada: 4, capacidadesJaTestadas: new Set([4]), plano: [A, B, C], invariantes: INV, orcamentoSegundos: 3600 });
    expect(t.tipo === 'ERRO_ALOCADOR' && t.motivo).toBe('CAPACIDADE_REPETIDA');
    expect(t.tipo === 'ERRO_ALOCADOR' && t.capacidadeTestada).toBe(4);
  });

  it('fixture 55: cardinalidade recebida (4) > solicitada (3) ⇒ CARDINALIDADE, antes da duração', () => {
    const t = classificarTentativa({ capacidadeTestada: 3, capacidadesJaTestadas: new Set(), plano: [A, B, C, D], invariantes: INV, orcamentoSegundos: 3600 });
    expect(t.tipo === 'ERRO_ALOCADOR' && t.motivo).toBe('CARDINALIDADE_ACIMA_DA_CAPACIDADE');
    expect(t.tipo === 'ERRO_ALOCADOR' && t.cardinalidadeRecebida).toBe(4);
  });

  it('fixture 56: cardinalidade + invariante simultâneos ⇒ CARDINALIDADE pela precedência', () => {
    // 4 itens (A/B/D/E) e cobertura quebrada (sem agachar): a cardinalidade decide.
    const t = classificarTentativa({ capacidadeTestada: 3, capacidadesJaTestadas: new Set(), plano: [A, B, D, E], invariantes: INV, orcamentoSegundos: 3600 });
    expect(t.tipo === 'ERRO_ALOCADOR' && t.motivo).toBe('CARDINALIDADE_ACIMA_DA_CAPACIDADE');
  });

  it('fixture 57: invariante + duração simultâneos ⇒ INVARIANTE_VIOLADO, duração NÃO avaliada', () => {
    // A/B/Diso: sem agachar (invariante) e Diso com hold ausente (duração). Invariante vence.
    const Diso = item('Diso', 'isolado', 'biceps', 'halter', 60, 0); // hold 0 ⇒ NAO_AVALIADO se avaliasse
    const t = classificarTentativa({ capacidadeTestada: 3, capacidadesJaTestadas: new Set(), plano: [A, B, Diso], invariantes: INV, orcamentoSegundos: 3600 });
    expect(t.tipo === 'ERRO_ALOCADOR' && t.motivo).toBe('INVARIANTE_VIOLADO');
  });

  it('fixture 51: alocador devolve A/B/D (sem agachar) ⇒ ERRO_ALOCADOR, nunca CERTIFICADO mesmo se cabe', () => {
    const alocar: Alocador = () => ({ tipo: 'PLANO', itens: [A, B, D] });
    const r = gerarPlanoTemporal({ capacidadeInicial: 3, niveisDescanso: 1, alocar, invariantes: INV, orcamentoSegundos: 3600 });
    expect(r.tipo).toBe('ERRO_ALOCADOR');
    expect(r.tipo === 'ERRO_ALOCADOR' && r.motivo).toBe('INVARIANTE_VIOLADO');
  });
});

describe('C1 geração temporal · reduce-to-fit ponta a ponta (fixtures 21, 22, 23, 31, 44)', () => {
  it('fixture 21: B=600 (limite 1080); 4 itens 1140–1410 excedem; capacidade 3 → A/B/C 900–1080, CERTIFICADO', () => {
    const alocar: Alocador = (cap) => (cap >= 4 ? { tipo: 'PLANO', itens: [A, B, C, D] } : cap === 3 ? { tipo: 'PLANO', itens: [A, B, C] } : { tipo: 'SEM_PLANO_MENOR' });
    const r = gerarPlanoTemporal({ capacidadeInicial: 4, niveisDescanso: 1, alocar, invariantes: INV, orcamentoSegundos: 600 });
    expect(r.tipo).toBe('CERTIFICADO');
    if (r.tipo !== 'CERTIFICADO') return;
    expect(r.capacidadeTerminal).toBe(3);
    expect(r.planoTerminal.map((i) => i.id)).toEqual(['A', 'B', 'C']);
    expect(r.resultadoDuracao.duracaoMinimaEstimadaSegundos).toBe(900);
    expect(r.resultadoDuracao.duracaoMaximaEstimadaSegundos).toBe(1080);
    // fatos baseline (4) × terminal (3)
    const f = fatosReducao([A, B, C, D], r.planoTerminal);
    expect(f.slotsAntes).toBe(4);
    expect(f.slotsDepois).toBe(3);
    expect(f.itensRemovidos).toEqual(['D']);
  });

  it('fixture 22: orçamento 300 (limite 780); menor plano 3 itens 900–1080 ainda excede ⇒ INCOMPATIVEL', () => {
    const alocar: Alocador = (cap) => (cap >= 4 ? { tipo: 'PLANO', itens: [A, B, C, D] } : cap === 3 ? { tipo: 'PLANO', itens: [A, B, C] } : { tipo: 'SEM_PLANO_MENOR' });
    const r = gerarPlanoTemporal({ capacidadeInicial: 4, niveisDescanso: 1, alocar, invariantes: INV, orcamentoSegundos: 300 });
    expect(r.tipo).toBe('INCOMPATIVEL');
    expect(r.tipo === 'INCOMPATIVEL' && r.capacidadeMinimaTestada).toBe(3);
  });

  it('fixture 23: realocação vira NAO_AVALIADO (hold ausente) ⇒ NAO_AVALIADO_ENTREGAVEL, laço para', () => {
    const Ciso = item('Ciso', 'agachar', 'quadriceps', 'peso-corporal', 90, 0); // hold 0 ⇒ NAO_AVALIADO
    const alocar: Alocador = (cap) => (cap >= 4 ? { tipo: 'PLANO', itens: [A, B, C, D] } : { tipo: 'PLANO', itens: [A, B, Ciso] });
    const r = gerarPlanoTemporal({ capacidadeInicial: 4, niveisDescanso: 1, alocar, invariantes: INV, orcamentoSegundos: 600 });
    expect(r.tipo).toBe('NAO_AVALIADO_ENTREGAVEL');
    expect(r.tipo === 'NAO_AVALIADO_ENTREGAVEL' && r.resultadoDuracao.estadoCalculo).toBe('NAO_AVALIADO');
  });

  it('fixture 31: capacidades 5 e 4 dão o mesmo plano; continua para 3, sem saltar 5→3', () => {
    const chamadas: number[] = [];
    const alocar: Alocador = (cap) => {
      chamadas.push(cap);
      return cap >= 4 ? { tipo: 'PLANO', itens: [A, B, C, D] } : cap === 3 ? { tipo: 'PLANO', itens: [A, B, C] } : { tipo: 'SEM_PLANO_MENOR' };
    };
    const r = gerarPlanoTemporal({ capacidadeInicial: 5, niveisDescanso: 1, alocar, invariantes: INV, orcamentoSegundos: 600 });
    expect(r.tipo).toBe('CERTIFICADO');
    expect(r.tipo === 'CERTIFICADO' && r.capacidadeTerminal).toBe(3);
    expect(chamadas).toEqual([5, 4, 3]); // decresce 1 por vez; nunca 5→3
  });

  it('fixture 44: reinício da escada — cap 4 não cabe em 120/90; cap 3 REINICIA em 120 e cabe (terminal 120)', () => {
    const c1 = item('c1', 'puxar', 'costas', 'halter', 0);
    const c2 = item('c2', 'empurrar', 'peito', 'halter', 0);
    const c3 = item('c3', 'agachar', 'quadriceps', 'peso-corporal', 0);
    const c4 = item('c4', 'puxar', 'dorsal', 'halter', 0);
    const comDescanso = (it: ItemPlanoTemporal, d: number): ItemPlanoTemporal => ({ ...it, descansoSeg: d });
    // nível 0 = 120 (original); nível 1 = 90 (degradado).
    const descansoDoNivel = (nivel: number) => (nivel === 0 ? 120 : 90);
    const alocar: Alocador = (cap, nivel) => {
      const d = descansoDoNivel(nivel);
      if (cap >= 4) return { tipo: 'PLANO', itens: [c1, c2, c3, c4].map((i) => comDescanso(i, d)) };
      if (cap === 3) return { tipo: 'PLANO', itens: [c1, c2, c3].map((i) => comDescanso(i, d)) };
      return { tipo: 'SEM_PLANO_MENOR' };
    };
    const r = gerarPlanoTemporal({ capacidadeInicial: 4, niveisDescanso: 2, alocar, invariantes: INV, orcamentoSegundos: 900 });
    expect(r.tipo).toBe('CERTIFICADO');
    if (r.tipo !== 'CERTIFICADO') return;
    expect(r.capacidadeTerminal).toBe(3);
    // terminal usa 120 (escada reiniciada), não 90 herdado.
    expect(r.planoTerminal.every((i) => i.descansoSeg === 120)).toBe(true);
    expect(r.resultadoDuracao.duracaoMinimaEstimadaSegundos).toBe(1080);
    expect(r.resultadoDuracao.duracaoMaximaEstimadaSegundos).toBe(1320);
  });
});

describe('C1 geração temporal · fatos factuais (fixture 45)', () => {
  it('fixture 45: remover o único isolado direto de bíceps registra frequência 1 → 0', () => {
    const f = fatosReducao([A, B, C, D], [A, B, C]);
    expect(f.frequenciaDiretaPorGrupo['biceps']).toEqual({ antes: 1, depois: 0 });
    expect(f.itensRemovidos).toEqual(['D']);
    expect(f.volumePorGrupo['biceps']).toEqual({ itensAntes: 1, itensDepois: 0, seriesAntes: 3, seriesDepois: 0 });
  });
});
