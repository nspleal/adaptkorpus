/**
 * 🔒 DECISÃO DO AUTOR 2026-09-15 — A TROCA AUTOMÁTICA NÃO REDUZ CRÉDITO DE NINGUÉM.
 *
 * As trocas por cobertura anatômica / complementaridade mecânica não podem reduzir o crédito
 * muscular PONDERADO existente — nem o direto nem o indireto — de NENHUM grupo. Sem compensar
 * com séries ou exercícios: se a alternativa causa perda, ou fica o exercício anterior, ou o
 * passe acha outro candidato compatível.
 *
 * 🔴 O QUE ESTE ARQUIVO DETECTA no candidato 5982581: o guard de crédito só protegia os
 * GRUPOS_GRANDES (piso do MEV) e o "ninguém zera". Com isso passavam trocas que apagavam
 * crédito indireto de grupo pequeno. Medido no perfil real (avançado · academia · 5d · 75 min
 * · prioridades · foco em peito): `e41` Desenvolvimento de ombros → `e95` Remada alta levava
 * o tríceps de 18 para 16 séries ponderadas, porque o desenvolvimento credita tríceps como
 * secundário e a remada alta não. Na tela, o painel "Séries por músculo" de quinta-feira caía
 * de "4 diretas · 6 indiretas" para "4 diretas · 2 indiretas".
 *
 * A régua é a autoridade existente (`creditoPonderadoDaSemana`: direto 1,0 + secundário 0,5).
 * Nenhum piso relativo, nenhuma tolerância, nenhuma fórmula nova.
 */
import { describe, expect, it } from 'vitest';
import { alocarSemana, creditoPonderadoDaSemana, templatesDaSemana, type ArgsAlocacao, type DiaAlocado } from './alocador';
import { otimizarCoberturaAnatomica } from './cobertura-anatomica';
import { GRUPOS_COM_ALVOS } from './cobertura-anatomica';
import { dificuldadesLiberadas } from './treino';
import { exercicioDisponivel } from './equipamento';
import { EXERCISES } from '../data/exercises';
import { secundariosDe } from './secundarios';
import type { GrupoPrimario } from '../data/types';
import type { FlagsSaude } from './types';
import type { PerfilTreino } from './treino-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60,
  ...over,
});
const ex = (id: string) => EXERCISES.find((e) => e.id === id)!;
const SERIES = 4;

/** Mesma grade da integração: cobre descritores, classes, equipamento, tempo, foco e ciclo. */
const GRADE: Array<{ nome: string; over: Partial<PerfilTreino> }> = [
  { nome: 'prioridades 4d/60', over: { divisaoPreferida: 'prioridades' } },
  { nome: 'prioridades 4d/90 avançado', over: { divisaoPreferida: 'prioridades', tempoPorSessaoMin: 90, nivelExperiencia: 'avancado' } },
  { nome: 'superior/inferior 4d/60', over: { divisaoPreferida: 'superior-inferior' } },
  { nome: 'superior/inferior 4d/90 avançado', over: { divisaoPreferida: 'superior-inferior', tempoPorSessaoMin: 90, nivelExperiencia: 'avancado' } },
  { nome: 'automático 4d/60', over: {} },
  { nome: 'automático 5d/75 avançado (perfil real)', over: { diasDisponiveis: 5, tempoPorSessaoMin: 75, nivelExperiencia: 'avancado', divisaoPreferida: 'prioridades' } },
  { nome: 'automático 6d/60 avançado', over: { diasDisponiveis: 6, nivelExperiencia: 'avancado' } },
  { nome: 'automático 6d/75 avançado', over: { diasDisponiveis: 6, tempoPorSessaoMin: 75, nivelExperiencia: 'avancado' } },
  { nome: 'sessão curta 3d/30', over: { diasDisponiveis: 3, tempoPorSessaoMin: 30 } },
  { nome: 'casa halteres+elástico 3d/45', over: { equipamento: 'casa', equipamentosCasa: ['halteres', 'elastico'], diasDisponiveis: 3, tempoPorSessaoMin: 45 } },
  { nome: 'casa sem equipamento 4d/60 avançado', over: { equipamento: 'casa', equipamentosCasa: [], nivelExperiencia: 'avancado' } },
  { nome: 'iniciante 3d/60', over: { diasDisponiveis: 3, nivelExperiencia: 'iniciante' } },
  { nome: 'emagrecimento 3d/45', over: { objetivo: 'emagrecimento', diasDisponiveis: 3, tempoPorSessaoMin: 45 } },
  { nome: 'modo força pesada 2d/75 avançado', over: { modoForca: true, nivelExperiencia: 'avancado', objetivo: 'emagrecimento', diasDisponiveis: 2, tempoPorSessaoMin: 75 } },
];

function antesEDepois(p: PerfilTreino): { antes: DiaAlocado[]; depois: DiaAlocado[] } {
  const niveis = new Set(dificuldadesLiberadas(p.nivelExperiencia));
  const pool = EXERCISES.filter((e) => exercicioDisponivel(e, p.equipamento, p.equipamentosCasa) && niveis.has(e.nivel));
  const { dias: templates } = templatesDaSemana(p.diasDisponiveis, p.nivelExperiencia, p.divisaoPreferida ?? 'auto');
  const args: ArgsAlocacao = {
    templates,
    budgetPorDia: p.tempoPorSessaoMin >= 75 ? 7 : 6,
    pool,
    favoritos: new Set<string>(),
    alvoPonderado: new Map<GrupoPrimario, number>(GRUPOS_COM_ALVOS.map((g) => [g, 16])),
    seriesPlanejamento: SERIES,
    tetoSlotsSemana: () => Number.POSITIVE_INFINITY,
    coreMin: 2,
    coreMax: 3,
  };
  const antes = alocarSemana(args);
  const depois = antes.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s })) }));
  otimizarCoberturaAnatomica(
    depois.map((dia, d) => ({ grupos: templates[d]!.grupos, slots: dia.slots })),
    (g, favorito) => pool.filter((e) => e.grupoPrimario === g && e.padraoMovimento !== 'cardio' && favorito === false),
    { seriesPlanejamento: SERIES },
  );
  return { antes, depois };
}

const credito = (dias: readonly DiaAlocado[]) => creditoPonderadoDaSemana(
  dias.flatMap((d) => d.slots.map((s) => ({ exercicio: s.exercicio, series: SERIES }))),
);

describe('① crédito ponderado nunca regride por troca automática', () => {
  it.each(GRADE)('$nome — nenhum grupo perde crédito', ({ over }) => {
    const { antes, depois } = antesEDepois(perfil(over));
    const a = credito(antes); const d = credito(depois);
    const perdas: string[] = [];
    for (const g of new Set([...a.keys(), ...d.keys()])) {
      const v0 = a.get(g) ?? 0; const v1 = d.get(g) ?? 0;
      if (v1 < v0) perdas.push(`${g}: ${v0} → ${v1}`);
    }
    expect(perdas, `trocas reduziram crédito de ${perdas.join(' · ')}`).toEqual([]);
  });

  it.each(GRADE)('$nome — a dose não é usada para compensar', ({ over }) => {
    const { antes, depois } = antesEDepois(perfil(over));
    expect(depois.flatMap((d) => d.slots).length).toBe(antes.flatMap((d) => d.slots).length);
    expect(depois.length).toBe(antes.length);
    depois.forEach((d, i) => expect(d.slots.length).toBe(antes[i]!.slots.length));
  });

  /**
   * A reprodução exata do parecer. `e41` credita tríceps como secundário; `e95` não. A troca
   * só é aceitável se alguém repuser esse crédito — e nenhum candidato de mesmo custo repõe.
   */
  it('a troca que apagava o crédito indireto de tríceps não acontece mais', () => {
    expect(secundariosDe(ex('e41'))).toContain('triceps');
    expect(secundariosDe(ex('e95'))).not.toContain('triceps');

    const p = perfil({ diasDisponiveis: 5, tempoPorSessaoMin: 75, nivelExperiencia: 'avancado', divisaoPreferida: 'prioridades' });
    const { antes, depois } = antesEDepois(p);
    const tinha = (dias: readonly DiaAlocado[], id: string) => dias.some((d) => d.slots.some((s) => s.exercicio.id === id));
    if (!tinha(antes, 'e41')) return; // a grade cobre o caso em outras linhas
    const a = credito(antes); const d = credito(depois);
    expect(d.get('triceps') ?? 0).toBeGreaterThanOrEqual(a.get('triceps') ?? 0);
  });

  /** As outras perdas medidas no parecer, cada uma pelo par que a causava. */
  it.each([
    ['e45', 'e120', 'biceps'],
    ['e164', 'e167', 'biceps'],
    ['e164', 'e167', 'core'],
    ['e3', 'e142', 'gluteos'],
    ['e41', 'e119', 'triceps'],
    ['e42', 'e95', 'triceps'],
  ])('%s → %s tiraria crédito de %s e por isso é recusada', (de, para, grupo) => {
    expect(secundariosDe(ex(de))).toContain(grupo);
    expect(secundariosDe(ex(para))).not.toContain(grupo);
    // um dia com só esses dois slots: a troca tiraria o crédito e não tem quem reponha
    const dia = { grupos: [ex(de).grupoPrimario!] as GrupoPrimario[], slots: [
      { grupo: ex(de).grupoPrimario!, exercicio: ex(de), favorito: false, padrao: ex(de).padraoMovimento },
      { grupo: ex(de).grupoPrimario!, exercicio: ex(de === 'e41' ? 'e42' : de), favorito: false, padrao: ex(de).padraoMovimento },
    ] };
    const trocas = otimizarCoberturaAnatomica(
      [dia as never],
      (g, favorito) => (favorito ? [] : [ex(de), ex(para)].filter((e) => e.grupoPrimario === g)),
      { seriesPlanejamento: SERIES },
    );
    expect(trocas.some((t) => t.para === para)).toBe(false);
  });
});
