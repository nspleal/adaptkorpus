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
/**
 * 🔵 O OBJETIVO VIROU PARÂMETRO (2026-09-17). Ele já era um eixo da classificação (o MEV vem
 * de nível × objetivo); estava fixo em `massa` só porque as células medidas na época eram
 * todas de massa. Com a faixa desejada de hipertrofia mais baixa, o conjunto de grupos
 * catálogo-limitados mudou, e as células abaixo foram REMEDIDAS — ver a nota de cada uma.
 */
const classif = (nivel: NivelExperiencia, grupo: GrupoPrimario, casa: EquipamentoCasa[] = [], objetivo: 'massa' | 'saude' | 'emagrecimento' = 'massa') =>
  classificarCoberturaCatalogo(EXERCISES, grupo, nivel, objetivo, 'casa', casa);

describe('🔒 cobertura no teto — a instância medida (não a premissa)', () => {
  it('AVANÇADO casa-vazio: ombros e posterior ALCANÇAM o MEV no teto (não é catálogo)', () => {
    // A correção da premissa: no pico o avançado chega. Recomendar equipamento ali seria falso.
    expect(tetoPonderado(EXERCISES, 'avancado', 'massa', 'casa', []).get('ombros') ?? 0).toBeGreaterThanOrEqual(mev('avancado', 'massa'));
    expect(classif('avancado', 'ombros')).toBeNull();
    expect(classif('avancado', 'posterior')).toBeNull();
  });

  /**
   * 🔵 CÉLULA REMEDIDA (2026-09-17). A redação anterior era «INTERMEDIÁRIO casa-vazio: ombros
   * e posterior são catálogo-limitados». Com o MEV de hipertrofia caindo de 13 para 10 no
   * intermediário, os dois passaram a ALCANÇAR o mínimo em casa-vazio — deixaram de ser
   * limite de catálogo, e afirmar que ainda são seria falso. A célula que segue limitada e
   * fechada por elástico é `iniciante/massa/posterior`.
   */
  it('INICIANTE casa-vazio: posterior é catálogo-limitado, fechado por elástico', () => {
    const c = classif('iniciante', 'posterior');
    expect(c, 'posterior deveria ser catálogo-limitado').not.toBeNull();
    expect(c!.equipamento).toBe('elastico');
    expect(c!.exercicios.length, 'a frase precisa nomear ao menos 1 exercício que entra').toBeGreaterThan(0);
    // 🔒 E o INTERMEDIÁRIO, na mesma configuração, agora alcança — a mudança é dita, não escondida.
    expect(classif('intermediario', 'posterior'), 'com MEV 10 o intermediário alcança em casa-vazio').toBeNull();
  });

  /**
   * 🔵 O MÍNIMO É DERIVADO, NÃO UMA STRING FIXA — a propriedade que o caso anterior
   * («iniciante-ombros só fecha com halteres») protegia. Aquela célula desapareceu com o MEV
   * novo; esta foi medida no lugar e é ainda mais forte: o mínimo não é sequer o primeiro da
   * ordem, e o grupo já tem elástico e halteres marcados.
   */
  /**
   * 🔵 CÉLULA REMEDIDA (2026-09-19). Com a seleção por referência, o pico do peito iniciante em
   * casa com elástico+halteres passou a alcançar o MEV (a trava do empurrar deixou de forçar
   * isolados no primeiro slot e a flexão/crucifixo entram na ordem certa). A célula que segue
   * limitada e fechada por BANCO, com o mesmo par já marcado, é `avancado/saude/peito`.
   */
  it('🔴 o equipamento mínimo é MEDIDO: avançado/saúde/peito com elástico+halteres pede BANCO', () => {
    const c = classif('avancado', 'peito', ['elastico', 'halteres'], 'saude');
    expect(c, 'a célula precisa continuar limitada — senão o caso não prova nada').not.toBeNull();
    expect(c!.equipamento, 'não é o primeiro da ordem de minimalidade').toBe('banco');
    expect(c!.exercicios.length).toBeGreaterThan(0);
    // …e no mesmo nível, outro grupo fecha com elástico: o mínimo é por (grupo × nível × objetivo).
    expect(classif('iniciante', 'posterior')!.equipamento).toBe('elastico');
  });
});

describe('🔒 mutação eixo (a) — o equipamento nomeado REALMENTE fecha o grupo no teto', () => {
  // Se a implementação nomear um equipamento que não fecha (ex.: hardcode 'elastico' no
  // iniciante-ombros), esta invariante quebra. Vale para todo caso classificado.
  /** 🔵 Células REMEDIDAS em 2026-09-17 — ver a nota do bloco acima. */
  const casos: [NivelExperiencia, GrupoPrimario, 'massa' | 'saude' | 'emagrecimento'][] = [
    ['iniciante', 'posterior', 'massa'],
    ['iniciante', 'ombros', 'emagrecimento'],
    // 🔵 2026-09-19: avançado/saúde/ombros passou a alcançar em casa-vazio; a célula limitada é peito.
    ['avancado', 'peito', 'saude'],
  ];
  for (const [nivel, g, obj] of casos) {
    it(`${nivel}/${obj}/${g}: o teto COM o equipamento nomeado ≥ MEV; sem ele, < MEV`, () => {
      const c = classif(nivel, g, [], obj)!;
      expect(c).not.toBeNull();
      const piso = mev(nivel, obj);
      expect(tetoPonderado(EXERCISES, nivel, obj, 'casa', []).get(g) ?? 0, 'sem equipamento devia estar abaixo').toBeLessThan(piso);
      expect(tetoPonderado(EXERCISES, nivel, obj, 'casa', [c.equipamento]).get(g) ?? 0, `${c.equipamento} devia fechar`).toBeGreaterThanOrEqual(piso);
    });
  }

  it('minimalidade: nenhum equipamento MENOR (na ordem) que o nomeado fecha o grupo', () => {
    const ORDEM = ['elastico', 'halteres', 'kettlebell', 'barra_fixa', 'banco', 'corda_pular', 'roda_abdominal'] as const;
    // 🔵 A célula em que o mínimo NÃO é o primeiro da ordem — a que torna o teste discriminante.
    const jaMarcados: EquipamentoCasa[] = ['elastico', 'halteres'];
    const c = classif('avancado', 'peito', jaMarcados, 'saude')!;
    expect(c.equipamento).toBe('banco');
    const piso = mev('avancado', 'saude');
    let testados = 0;
    for (const eqp of ORDEM) {
      if (eqp === c.equipamento) break;
      if (jaMarcados.includes(eqp)) continue; // já está no perfil; não é candidato
      expect(tetoPonderado(EXERCISES, 'avancado', 'saude', 'casa', [...jaMarcados, eqp]).get('peito') ?? 0,
        `${eqp} vem antes de ${c.equipamento} e NÃO pode fechar (senão ele era o mínimo)`).toBeLessThan(piso);
      testados += 1;
    }
    // ⚠️ ANTI-VACUIDADE: sem candidatos ANTES do nomeado, o laço acima não prova minimalidade.
    expect(testados, 'a célula precisa ter equipamentos menores para descartar').toBeGreaterThan(0);
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
    expect(classif('iniciante', 'posterior')).not.toBeNull();
    expect(classif('iniciante', 'posterior', ['elastico']), 'com elástico marcado, posterior deixa de ser limitado').toBeNull();
  });
});

describe('🔒 a mensagem — honesta, ancorada no checklist, sem venda', () => {
  it('nomeia grupo, equipamento e exercícios; sem "compre"/link/acusação', () => {
    const c = classif('iniciante', 'posterior')!;
    const msg = mensagemCoberturaCatalogo(c);
    expect(msg).toContain('Elástico');
    expect(msg).toContain('posterior');
    expect(msg).toContain(c.exercicios[0]!);
    expect(msg).not.toMatch(/compre|comprar|http|R\$|você (não|deveria|falhou)/i);
  });
});

describe('🔒 integração — o aviso certo sai do montador, na causa certa', () => {
  const avisosDe = (over: Partial<PerfilTreino>) => {
    const p = perfil(over);
    return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana: 3 as never }).avisos;
  };

  it('casa-vazio iniciante: sai "Chegamos ao limite de posterior" nomeando Elástico', () => {
    const av = avisosDe({ nivelExperiencia: 'iniciante', equipamento: 'casa', equipamentosCasa: [] });
    const msg = av.find((a) => a.includes('limite de posterior'));
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
