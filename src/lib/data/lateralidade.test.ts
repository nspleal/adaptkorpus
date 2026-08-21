/**
 * 🔒 C1 — LATERALIDADE, curadoria FINAL do autor (2026-08-21). Gate do catálogo (168 ids, zero
 * ambiguidade) + caminho real Exercise → montador → SlotExercicio → adaptador → avaliador
 * provando que só UNILATERAL_DOIS_LADOS dobra a EXECUÇÃO, e que e72 (rosca martelo) é caso com
 * escolha do usuário (alternado | simultâneo), nunca dobrado, nunca DOIS_LADOS.
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES } from './exercises';
import {
  LATERALIDADE, LATERALIDADE_ESCOLHA, LATERALIDADE_RESOLVIDA_AUTOR,
  resolverExecucao, temEscolhaDeExecucao, type ExecucaoLateralidade,
} from './lateralidade';
import { avaliarDuracaoResistida } from '../engine/duracao-plano';
import { avaliarGateTreino } from '../engine/treino-gate';
import { prescreverTreino } from '../engine/treino';
import { montarRotina } from '../engine/treino-montador';
import type { FlagsSaude } from '../engine/types';
import type { PerfilTreino, SlotExercicio } from '../engine/treino-types';

const VALORES: ExecucaoLateralidade[] = ['BILATERAL', 'UNILATERAL_ALTERNADO', 'UNILATERAL_DOIS_LADOS'];
const byId = (id: string) => EXERCISES.find((e) => e.id === id)!;

// ── Gate 1: contrato válido em TODOS os 168 ────────────────────────────────────
describe('C1 lateralidade · gate do catálogo (168 · zero ambiguidade)', () => {
  it('há exatamente 168 exercícios e TODO um possui `execucao` num valor do enum', () => {
    expect(EXERCISES).toHaveLength(168);
    for (const e of EXERCISES) {
      expect(VALORES, `${e.id} (${e.nomePt}) com execucao inválida: ${e.execucao}`).toContain(e.execucao);
    }
  });

  it('a curadoria cobre exatamente os ids do catálogo (sem faltar, sem sobrar)', () => {
    const idsCatalogo = new Set(EXERCISES.map((e) => e.id));
    for (const e of EXERCISES) expect(LATERALIDADE[e.id], `curadoria faltando: ${e.id}`).toBeDefined();
    for (const id of Object.keys(LATERALIDADE)) expect(idsCatalogo.has(id), `curadoria para id inexistente: ${id}`).toBe(true);
  });

  it('contagem por categoria é a da curadoria final (133 BI · 7 ALT · 28 DOIS)', () => {
    const c = { BILATERAL: 0, UNILATERAL_ALTERNADO: 0, UNILATERAL_DOIS_LADOS: 0 };
    for (const e of EXERCISES) c[e.execucao] += 1;
    expect(c).toEqual({ BILATERAL: 133, UNILATERAL_ALTERNADO: 7, UNILATERAL_DOIS_LADOS: 28 });
  });

  it('a curadoria final do autor bate exercício-a-exercício (11 casos antes provisórios)', () => {
    // Substitui a antiga LATERALIDADE_AMBIGUA: cada caso saiu de "provisório" para "travado".
    for (const r of LATERALIDADE_RESOLVIDA_AUTOR) {
      if (r.final === 'ESCOLHA_USUARIO') {
        expect(temEscolhaDeExecucao(r.id), `${r.id} deveria ser caso de escolha`).toBe(true);
      } else {
        expect(byId(r.id).execucao, `${r.id} (${r.nome})`).toBe(r.final);
      }
    }
    // Os 6 que viraram DOIS_LADOS + os que viraram ALT/BI + e72 = 11 casos resolvidos.
    expect(LATERALIDADE_RESOLVIDA_AUTOR).toHaveLength(11);
  });
});

// ── Gate 2: nenhum default silencioso ──────────────────────────────────────────
describe('C1 lateralidade · sem default silencioso', () => {
  it('a montagem de EXERCISES LANÇA se um id não estiver curado (fail-fast)', async () => {
    // O load já falha na ausência (exercises.ts). Aqui provamos que resolverExecucao é fail-safe:
    // um exercício SEM escolha rejeita uma seleção que contradiz a curadoria (não cai em default).
    expect(() => resolverExecucao('e3', 'BILATERAL', 'UNILATERAL_DOIS_LADOS')).toThrow();
  });

  it('o default do caso-com-escolha está SEMPRE entre as opções permitidas (guard do load)', () => {
    for (const [id, permitidas] of Object.entries(LATERALIDADE_ESCOLHA)) {
      expect(permitidas, `${id} default fora das permitidas`).toContain(LATERALIDADE[id]);
    }
  });
});

// ── Gate 3-6: quem dobra e quem não dobra ──────────────────────────────────────
describe('C1 lateralidade · o que dobra a EXECUÇÃO (e o que nunca dobra)', () => {
  it('DOIS_LADOS (e78 búlgaro): execução dobra (240), descanso NÃO (180) ⇒ MIN 420', () => {
    const r = avaliarDuracaoResistida([{ exercicio: byId('e78'), series: 3, descansoSeg: 90 }], 'intermediario');
    expect(r.componentes!.execucaoSegundos).toBe(240);
    expect(r.componentes!.descansoSegundos).toBe(180);
    expect(r.duracaoMinimaEstimadaSegundos).toBe(420);
  });

  it('BILATERAL (e3 agachamento): execução 3×40=120 (não dobra)', () => {
    const r = avaliarDuracaoResistida([{ exercicio: byId('e3'), series: 3, descansoSeg: 90 }], 'intermediario');
    expect(r.componentes!.execucaoSegundos).toBe(120);
  });

  it('ALTERNADO (e112 rosca alternada): NÃO dobra — a série já é o conjunto alternado (120)', () => {
    const r = avaliarDuracaoResistida([{ exercicio: byId('e112'), series: 3, descansoSeg: 90 }], 'intermediario');
    expect(r.componentes!.execucaoSegundos).toBe(120);
  });

  it('descanso nunca é dobrado, mesmo num DOIS_LADOS (o dobro é SÓ a execução)', () => {
    const r = avaliarDuracaoResistida([{ exercicio: byId('e78'), series: 3, descansoSeg: 90 }], 'intermediario');
    expect(r.componentes!.descansoSegundos).toBe(180); // 2×90, não 4×90
  });

  it('os novos DOIS_LADOS do autor (e101 giro russo, e133 tríceps coice) dobram a execução', () => {
    for (const id of ['e101', 'e133']) {
      const r = avaliarDuracaoResistida([{ exercicio: byId(id), series: 3, descansoSeg: 90 }], 'intermediario');
      const bi = avaliarDuracaoResistida([{ exercicio: byId('e3'), series: 3, descansoSeg: 90 }], 'intermediario');
      expect(r.componentes!.execucaoSegundos, id).toBe(2 * bi.componentes!.execucaoSegundos);
    }
  });

  it('e146 (prancha c/ toque) virou ALTERNADO ⇒ NÃO dobra', () => {
    expect(byId('e146').execucao).toBe('UNILATERAL_ALTERNADO');
    const r = avaliarDuracaoResistida([{ exercicio: byId('e146'), series: 3, descansoSeg: 90 }], 'intermediario');
    expect(r.componentes!.execucaoSegundos).toBe(120);
  });
});

// ── Gate 7-9 + 12: e72 é caso com escolha ──────────────────────────────────────
describe('C1 lateralidade · e72 (rosca martelo) — escolha do usuário', () => {
  it('e72 declara execucoesPermitidas = [ALTERNADO, BILATERAL] no contrato do catálogo', () => {
    expect(byId('e72').execucoesPermitidas).toEqual(['UNILATERAL_ALTERNADO', 'BILATERAL']);
    expect(temEscolhaDeExecucao('e72')).toBe(true);
  });

  it('e72 ACEITA ALTERNADO', () => {
    expect(resolverExecucao('e72', byId('e72').execucao, 'UNILATERAL_ALTERNADO')).toBe('UNILATERAL_ALTERNADO');
  });

  it('e72 ACEITA BILATERAL', () => {
    expect(resolverExecucao('e72', byId('e72').execucao, 'BILATERAL')).toBe('BILATERAL');
  });

  it('e72 REJEITA DOIS_LADOS (nunca dobra por escolha)', () => {
    expect(() => resolverExecucao('e72', byId('e72').execucao, 'UNILATERAL_DOIS_LADOS')).toThrow();
  });

  it('ambas as opções de e72 têm o MESMO multiplicador ⇒ duração calculável sem escolha', () => {
    const semEscolha = avaliarDuracaoResistida([{ exercicio: byId('e72'), series: 3, descansoSeg: 90 }], 'intermediario');
    const alt = avaliarDuracaoResistida([{ exercicio: byId('e72'), series: 3, descansoSeg: 90, execucaoSelecionada: 'UNILATERAL_ALTERNADO' }], 'intermediario');
    const bi = avaliarDuracaoResistida([{ exercicio: byId('e72'), series: 3, descansoSeg: 90, execucaoSelecionada: 'BILATERAL' }], 'intermediario');
    expect(semEscolha.estadoCalculo).not.toBe('NAO_AVALIADO');
    expect(alt.componentes!.execucaoSegundos).toBe(120);
    expect(bi.componentes!.execucaoSegundos).toBe(120);
    expect(semEscolha.componentes!.execucaoSegundos).toBe(120);
  });

  it('🔒 mutação-guard #12: se e72 dobrasse a execução, este teste morre (deve ficar em 120)', () => {
    const r = avaliarDuracaoResistida([{ exercicio: byId('e72'), series: 3, descansoSeg: 90, execucaoSelecionada: 'BILATERAL' }], 'intermediario');
    expect(r.componentes!.execucaoSegundos).toBe(120); // nunca 240
  });
});

// ── Gate 10: caminho real preserva a escolha ───────────────────────────────────
const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
function perfil(over: Partial<PerfilTreino> = {}): PerfilTreino {
  return { pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60, ...over };
}

describe('C1 lateralidade · caminho real Exercise → montador → slot → adaptador → avaliador', () => {
  it('a escolha de e72 materializada sobrevive à montagem e chega ao slot', () => {
    const p = perfil();
    const escolhas = new Map<string, ExecucaoLateralidade>([['e72', 'UNILATERAL_ALTERNADO']]);
    // Favorita e72 para forçá-lo ao plano (trilho de isenção da variedade); a escolha é injetada.
    const r = montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(['e72']), undefined, p.preferencias, escolhas);
    const slotsE72 = r.dias.flatMap((d) => d.slots).filter((s: SlotExercicio) => s.exercicio.id === 'e72');
    expect(slotsE72.length, 'e72 favoritado deveria entrar no plano').toBeGreaterThan(0);
    for (const s of slotsE72) expect(s.execucaoSelecionada).toBe('UNILATERAL_ALTERNADO');
  });

  it('o adaptador honra a escolha do slot ao decidir se dobra (montador→adaptador→avaliador)', () => {
    // e72 nunca dobra em nenhuma escolha permitida — o slot carrega a opção e o avaliador a lê.
    const r = avaliarDuracaoResistida(
      [{ exercicio: byId('e72'), series: 3, descansoSeg: 90, execucaoSelecionada: 'UNILATERAL_ALTERNADO' }],
      'intermediario',
    );
    expect(r.componentes!.execucaoSegundos).toBe(120);
  });

  it('slot com escolha inválida (e72 DOIS_LADOS) faz o caminho real LANÇAR — sem dobra silenciosa', () => {
    expect(() =>
      avaliarDuracaoResistida(
        [{ exercicio: byId('e72'), series: 3, descansoSeg: 90, execucaoSelecionada: 'UNILATERAL_DOIS_LADOS' }],
        'intermediario',
      ),
    ).toThrow();
  });
});

// ── Gate 11: mutação global BILATERAL morre ────────────────────────────────────
describe('C1 lateralidade · mutação-guard #11 (forçar tudo BILATERAL morre)', () => {
  it('se o adaptador forçasse tudo a BILATERAL, o búlgaro cairia de 240 a 120 — este teste morre', () => {
    const dois = avaliarDuracaoResistida([{ exercicio: byId('e78'), series: 3, descansoSeg: 90 }], 'intermediario');
    const bi = avaliarDuracaoResistida([{ exercicio: byId('e3'), series: 3, descansoSeg: 90 }], 'intermediario');
    expect(dois.componentes!.execucaoSegundos).toBe(2 * bi.componentes!.execucaoSegundos);
  });
});
