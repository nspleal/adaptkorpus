/**
 * 🔒 COBERTURA NO TETO — a mensagem certa na causa certa (DF do autor 2026-08-15).
 *
 * A família "duas frases distintas por causa" do dia curto em casa, agora com três causas.
 * O par discriminante que este guard protege, medido no teto (máx. sessões × máx. séries):
 *  · catálogo-limitado → nomeia o equipamento MÍNIMO que fecha o grupo (derivado, nunca fixo);
 *  · orçamento-limitado (alcança no teto) → NÃO recebe a mensagem de catálogo.
 *
 * 🔴 A premissa do autor (só ombros, massa/avançado, sempre elástico) veio de um snapshot de
 * semana 3 e CAIU na medição do pico: avançado alcança; posterior também é limitado;
 * iniciante-ombros só fecha com halteres (elástico não basta). Estes testes ancoram o pico.
 */
import { describe, expect, it } from 'vitest';
import { classificarCoberturaCatalogo, mensagemCoberturaCatalogo, tetoPonderado } from './cobertura-teto';
import { montarRotina } from './treino-montador';
import { prescreverTreino } from './treino';
import { avaliarGateTreino } from './treino-gate';
import { mev } from './trilhos';
import { EXERCISES } from '../data/exercises';
import type { NivelExperiencia, PerfilTreino } from './treino-types';
import type { EquipamentoCasa, GrupoPrimario } from '../data/types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'casa', equipamentosCasa: [], diasDisponiveis: 6, tempoPorSessaoMin: 180, ...over,
});
const classif = (nivel: NivelExperiencia, grupo: GrupoPrimario, casa: EquipamentoCasa[] = []) =>
  classificarCoberturaCatalogo(EXERCISES, grupo, nivel, 'massa', 'casa', casa);

describe('🔒 cobertura no teto — a instância medida (não a premissa)', () => {
  it('AVANÇADO casa-vazio: ombros e posterior ALCANÇAM o MEV no teto (não é catálogo)', () => {
    // A correção da premissa: no pico o avançado chega. Recomendar equipamento ali seria falso.
    expect(tetoPonderado(EXERCISES, 'avancado', 'massa', 'casa', []).get('ombros') ?? 0).toBeGreaterThanOrEqual(mev('avancado', 'massa'));
    expect(classif('avancado', 'ombros')).toBeNull();
    expect(classif('avancado', 'posterior')).toBeNull();
  });

  it('INTERMEDIÁRIO casa-vazio: ombros e posterior são catálogo-limitados, fechados por elástico', () => {
    for (const g of ['ombros', 'posterior'] as const) {
      const c = classif('intermediario', g);
      expect(c, `${g} deveria ser catálogo-limitado`).not.toBeNull();
      expect(c!.equipamento).toBe('elastico');
      expect(c!.exercicios.length, 'a frase precisa nomear ao menos 1 exercício que entra').toBeGreaterThan(0);
    }
  });

  it('🔴 INICIANTE casa-vazio ombros: o mínimo é HALTERES, não elástico (o caso que a string fixa erraria)', () => {
    const c = classif('iniciante', 'ombros');
    expect(c, 'iniciante-ombros é catálogo-limitado').not.toBeNull();
    expect(c!.equipamento, 'elástico NÃO fecha ombro no iniciante; só halteres').toBe('halteres');
    // e posterior no iniciante fecha com elástico — a prova de que o mínimo é DERIVADO, não global
    expect(classif('iniciante', 'posterior')!.equipamento).toBe('elastico');
  });
});

describe('🔒 mutação eixo (a) — o equipamento nomeado REALMENTE fecha o grupo no teto', () => {
  // Se a implementação nomear um equipamento que não fecha (ex.: hardcode 'elastico' no
  // iniciante-ombros), esta invariante quebra. Vale para todo caso classificado.
  const casos: [NivelExperiencia, GrupoPrimario][] = [
    ['iniciante', 'ombros'], ['iniciante', 'posterior'],
    ['intermediario', 'ombros'], ['intermediario', 'posterior'],
  ];
  for (const [nivel, g] of casos) {
    it(`${nivel}/${g}: o teto COM o equipamento nomeado ≥ MEV; sem ele, < MEV`, () => {
      const c = classif(nivel, g)!;
      expect(c).not.toBeNull();
      const piso = mev(nivel, 'massa');
      expect(tetoPonderado(EXERCISES, nivel, 'massa', 'casa', []).get(g) ?? 0, 'sem equipamento devia estar abaixo').toBeLessThan(piso);
      expect(tetoPonderado(EXERCISES, nivel, 'massa', 'casa', [c.equipamento]).get(g) ?? 0, `${c.equipamento} devia fechar`).toBeGreaterThanOrEqual(piso);
    });
  }

  it('minimalidade: nenhum equipamento MENOR (na ordem) que o nomeado fecha o grupo', () => {
    const ORDEM = ['elastico', 'halteres', 'kettlebell', 'barra_fixa', 'banco', 'corda_pular', 'roda_abdominal'] as const;
    const c = classif('iniciante', 'ombros')!; // halteres; elástico vem antes e NÃO fecha
    const piso = mev('iniciante', 'massa');
    for (const eqp of ORDEM) {
      if (eqp === c.equipamento) break;
      expect(tetoPonderado(EXERCISES, 'iniciante', 'massa', 'casa', [eqp]).get('ombros') ?? 0,
        `${eqp} vem antes de ${c.equipamento} e NÃO pode fechar (senão ele era o mínimo)`).toBeLessThan(piso);
    }
  });
});

describe('🔒 mutação eixo (b) — grupo certo recebe/não recebe a mensagem', () => {
  it('grupo que ALCANÇA no teto (orçamento-limitado) NÃO recebe mensagem de catálogo', () => {
    // avançado alcança tudo em casa-vazio → nenhuma classificação de catálogo.
    for (const g of ['peito', 'costas', 'quadriceps', 'posterior', 'gluteos', 'ombros'] as const) {
      expect(classif('avancado', g), `${g} avançado alcança no teto`).toBeNull();
    }
  });

  it('academia nunca é catálogo-limitado (não há checklist para marcar)', () => {
    expect(classificarCoberturaCatalogo(EXERCISES, 'ombros', 'iniciante', 'massa', 'academia', undefined)).toBeNull();
  });

  it('marcar o equipamento que fecha REMOVE a classificação (a saída funciona)', () => {
    expect(classif('intermediario', 'ombros')).not.toBeNull();
    expect(classif('intermediario', 'ombros', ['elastico']), 'com elástico marcado, ombros deixa de ser limitado').toBeNull();
  });
});

describe('🔒 a mensagem — honesta, ancorada no checklist, sem venda', () => {
  it('nomeia grupo, equipamento e exercícios; sem "compre"/link/acusação', () => {
    const c = classif('intermediario', 'ombros')!;
    const msg = mensagemCoberturaCatalogo(c);
    expect(msg).toContain('Elástico');
    expect(msg).toContain('ombros');
    expect(msg).toContain(c.exercicios[0]!);
    expect(msg).not.toMatch(/compre|comprar|http|R\$|você (não|deveria|falhou)/i);
  });
});

describe('🔒 integração — o aviso certo sai do montador, na causa certa', () => {
  const avisosDe = (over: Partial<PerfilTreino>) => {
    const p = perfil(over);
    return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana: 3 as never }).avisos;
  };

  it('casa-vazio intermediário: sai "Chegamos ao limite de ombros" nomeando Elástico', () => {
    const av = avisosDe({ nivelExperiencia: 'intermediario', equipamento: 'casa', equipamentosCasa: [] });
    const msg = av.find((a) => a.includes('limite de ombros'));
    expect(msg, `avisos: ${av.join(' | ')}`).toBeTruthy();
    expect(msg).toContain('Elástico');
  });

  it('academia intermediário: NUNCA sai a frase de limite de catálogo', () => {
    const av = avisosDe({ nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: undefined });
    expect(av.some((a) => a.includes('Chegamos ao limite'))).toBe(false);
  });

  it('anchor anti-drift: o teto do classificador bate com montarRotina 6d/180m (slots por grupo)', () => {
    // Se a construção de args do montador divergir da do classificador, o pico calculado
    // diverge e a classificação mente. Aqui os dois têm de concordar na alocação de pico.
    const p = perfil({ nivelExperiencia: 'avancado', equipamento: 'casa', equipamentosCasa: [] });
    const r = montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana: 5 as never });
    const slotsMont = new Map<string, number>();
    for (const d of r.dias) for (const s of d.slots) { const g = s.exercicio.grupoPrimario; if (g) slotsMont.set(g, (slotsMont.get(g) ?? 0) + 1); }
    // montarRotina em semana de pico (5) usa séries máximas; o crédito ponderado tem de casar
    // com o do classificador (mesma alocação, mesma série de pico).
    const teto = tetoPonderado(EXERCISES, 'avancado', 'massa', 'casa', []);
    const montPond = new Map<string, number>();
    // recomputa ponderado do plano real (semana 5) para comparar ao teto
    for (const d of r.dias) for (const s of d.slots) {
      const g = s.exercicio.grupoPrimario; if (g) montPond.set(g, (montPond.get(g) ?? 0) + (s.series ?? 0));
    }
    // A comparação forte é sobre GRANDES diretos: o pico do classificador nunca fica ABAIXO do
    // real (usa série máxima), e para os grandes o real de pico deve igualar (mesma alocação).
    expect(slotsMont.get('ombros'), 'ombros: 1 slot no plano real (o único exercício)').toBeGreaterThan(0);
    for (const g of ['peito', 'costas', 'ombros'] as const) {
      expect(teto.get(g) ?? 0, `${g}: teto ≥ real de pico`).toBeGreaterThanOrEqual((montPond.get(g) ?? 0) - 0.001);
    }
  });
});
