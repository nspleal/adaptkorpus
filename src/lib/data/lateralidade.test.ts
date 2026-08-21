/**
 * 🔒 C1 — lateralidade curada (decisão do autor A). Gate do catálogo + caminho real
 * plano→slot→adaptador→avaliador provando que só UNILATERAL_DOIS_LADOS dobra a EXECUÇÃO.
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES } from './exercises';
import { LATERALIDADE, LATERALIDADE_AMBIGUA, type ExecucaoLateralidade } from './lateralidade';
import { avaliarDuracaoResistida } from '../engine/duracao-plano';

const VALORES: ExecucaoLateralidade[] = ['BILATERAL', 'UNILATERAL_ALTERNADO', 'UNILATERAL_DOIS_LADOS'];
const byId = (id: string) => EXERCISES.find((e) => e.id === id)!;

describe('C1 lateralidade · gate do catálogo', () => {
  it('TODO exercício possui `execucao` num valor do enum (ausente/ inválido falha)', () => {
    for (const e of EXERCISES) {
      expect(VALORES, `${e.id} (${e.nomePt}) com execucao inválida: ${e.execucao}`).toContain(e.execucao);
    }
  });

  it('a curadoria cobre exatamente os ids do catálogo (sem faltar, sem sobrar sem exercício)', () => {
    const idsCatalogo = new Set(EXERCISES.map((e) => e.id));
    for (const e of EXERCISES) expect(LATERALIDADE[e.id], `curadoria faltando: ${e.id}`).toBeDefined();
    for (const id of Object.keys(LATERALIDADE)) expect(idsCatalogo.has(id), `curadoria para id inexistente: ${id}`).toBe(true);
  });

  it('as ambiguidades são devolvidas ao autor (lista não vazia, cada uma com motivo)', () => {
    expect(LATERALIDADE_AMBIGUA.length).toBeGreaterThan(0);
    for (const a of LATERALIDADE_AMBIGUA) expect(a.motivo.length).toBeGreaterThan(0);
  });
});

describe('C1 lateralidade · caminho real dobra SÓ a execução (§3.3 / fixture 4)', () => {
  // e78 Agachamento búlgaro = UNILATERAL_DOIS_LADOS · e3 Agachamento livre = BILATERAL ·
  // e112 Rosca alternada = UNILATERAL_ALTERNADO. (asserção de que a curadoria é essa)
  it('a curadoria dos exercícios-âncora é a esperada', () => {
    expect(byId('e78').execucao).toBe('UNILATERAL_DOIS_LADOS');
    expect(byId('e3').execucao).toBe('BILATERAL');
    expect(byId('e112').execucao).toBe('UNILATERAL_ALTERNADO');
  });

  it('DOIS_LADOS: execução dobra (3×2×40=240), descanso NÃO (2×90=180) ⇒ MIN 420', () => {
    const r = avaliarDuracaoResistida([{ exercicio: byId('e78'), series: 3, descansoSeg: 90 }], 'intermediario');
    expect(r.componentes!.execucaoSegundos).toBe(240); // dobrado
    expect(r.componentes!.descansoSegundos).toBe(180); // NÃO dobrado
    expect(r.duracaoMinimaEstimadaSegundos).toBe(420);
  });

  it('BILATERAL: execução 3×40=120 (não dobra)', () => {
    const r = avaliarDuracaoResistida([{ exercicio: byId('e3'), series: 3, descansoSeg: 90 }], 'intermediario');
    expect(r.componentes!.execucaoSegundos).toBe(120);
    expect(r.duracaoMinimaEstimadaSegundos).toBe(300);
  });

  it('ALTERNADO: NÃO dobra — a série já representa o conjunto alternado (3×40=120)', () => {
    const r = avaliarDuracaoResistida([{ exercicio: byId('e112'), series: 3, descansoSeg: 90 }], 'intermediario');
    expect(r.componentes!.execucaoSegundos).toBe(120);
  });

  it('🔒 mutação-guard: se o adaptador forçasse tudo a BILATERAL, o búlgaro cairia a 120 — este teste morre', () => {
    // (o teste DOIS_LADOS acima ancora 240; forçar bilateral daria 120 e o quebraria)
    const dois = avaliarDuracaoResistida([{ exercicio: byId('e78'), series: 3, descansoSeg: 90 }], 'intermediario');
    const bi = avaliarDuracaoResistida([{ exercicio: byId('e3'), series: 3, descansoSeg: 90 }], 'intermediario');
    expect(dois.componentes!.execucaoSegundos).toBe(2 * bi.componentes!.execucaoSegundos);
  });
});
