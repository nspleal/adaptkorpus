import { describe, it, expect } from 'vitest';
import { gerarTreino } from './index';
import { EXERCISES } from '../data/exercises';
import { creditoPonderadoDaSemana } from './alocador';
import { diretosDoExercicio } from './cobertura-anatomica';
import type { PerfilTreino } from './treino-types';

/**
 * 🔵 A REPARTIÇÃO DENTRO DO GRUPO (decisão do autor, 2026-09-20 — 4ª volta da revisão).
 *
 * 🔑 A MESMA dose direta rende crédito ponderado DIFERENTE conforme em qual exercício do grupo
 * ela cai: 8 séries de costas valem 2,0 de bíceps repartidas 2+2+2+2 entre puxada, remadas e
 * encolhimento, e 3,0 repartidas 1+3+3+1. Quem escolhia era o `i = 0` do round-robin da rampa —
 * uniformidade por ARTEFATO do ponto de partida, sem spec, invariante ou doc-comment a pedindo.
 *
 * 🔒 A correção é uma TROCA GUARDADA, e não outra ordem na rampa. Reordenar a rampa foi medido
 * primeiro e DESCARTADO: mexer na distribuição antes da fase A muda o custo do dia e com ele o
 * degrau de descanso — 137 perfis mudavam, 9 com descanso ENCURTADO e 24 com queda de dose.
 * A troca roda DEPOIS de descanso e poda decididos, e só é aceita se nada piorar.
 *
 * 📏 Varredura de 240 células (3 níveis × 2 equipamentos × 5 agendas × 4 tempos × semanas 1 e 5),
 * candidata `4533310` × esta: **159 mudam, todas só para melhor** — nenhum grupo perde crédito
 * ou série direta, nenhum alvo anatômico, exercício direto, papel de referência, sessão ou
 * descanso se perde, nenhuma duração estoura.
 */
const perfil = (over: Partial<PerfilTreino>): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'massa', nivelExperiencia: 'iniciante', equipamento: 'academia', equipamentosCasa: [],
  diasDisponiveis: 6, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
  tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado', ...over,
});
const plano = (p: PerfilTreino, semana: 1 | 3 | 5) => gerarTreino(p, { exercises: EXERCISES, semanaCiclo: { semana } }).rotina!;

describe('repartição dentro do grupo: mesma dose, mais cobertura ponderada', () => {
  /**
   * 🔴 O CUSTO DECLARADO DA 3ª VOLTA FOI PAGO. Recuperar o trapézio custava 0,5 ponderada de
   * bíceps INDIRETO nos perfis de iniciante/academia com 6 e 7 dias, na semana de topo da banda:
   * o encolhimento entrava e tirava a série da REMADA (que credita bíceps a 0,5) em vez da
   * puxada (que não credita ninguém). Com a troca, a série volta para a remada — e o bíceps
   * termina ACIMA do valor que a 2ª volta tinha (9,5), não apenas empatado.
   */
  it.each([
    { diasDisponiveis: 6, tempoPorSessaoMin: 45 },
    { diasDisponiveis: 6, tempoPorSessaoMin: 60 },
    { diasDisponiveis: 6, tempoPorSessaoMin: 75 },
  ])('6 dias: o trapézio não custa mais 0,5 de bíceps (%j)', (over) => {
    const p = perfil(over);
    const r = plano(p, 5);
    const ss = r.dias.flatMap((d) => d.slots);
    const c = creditoPonderadoDaSemana(ss);
    expect(ss.some((s) => diretosDoExercicio(s.exercicio.id).has('ts')), 'trapézio perdido').toBe(true);
    expect(c.get('biceps'), 'bíceps abaixo do que havia antes da recuperação do trapézio').toBeGreaterThanOrEqual(9.5);
    expect(c.get('costas'), 'costas cedeu para pagar o bíceps').toBeGreaterThanOrEqual(9.5);
  });

  it('7 dias: idem, sem ceder costas', () => {
    const r = plano(perfil({ diasDisponiveis: 7, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] }), 5);
    const c = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
    expect(c.get('biceps')).toBeGreaterThanOrEqual(9.5);
    expect(c.get('costas')).toBeGreaterThanOrEqual(10);
  });

  /**
   * 🔒 A TROCA NÃO COMPRA TEMPO. Ela move UMA série entre exercícios do MESMO grupo e só é
   * aceita se os dois dias envolvidos continuarem cabendo com o descanso que já têm — nada é
   * degradado ali. Esta grade cobra a consequência: nenhum dia passa do limite da pessoa.
   */
  it.each([
    { nivelExperiencia: 'iniciante' as const, diasDisponiveis: 4, treinoDias: ['seg', 'ter', 'qui', 'sex'], tempoPorSessaoMin: 30 },
    { nivelExperiencia: 'intermediario' as const, diasDisponiveis: 5, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], tempoPorSessaoMin: 45 },
    { nivelExperiencia: 'avancado' as const, diasDisponiveis: 6, tempoPorSessaoMin: 60 },
  ])('nenhum dia estoura o tempo da pessoa (%j)', (over) => {
    for (const semana of [1, 3, 5] as const) {
      const p = perfil(over as Partial<PerfilTreino>);
      const r = plano(p, semana);
      for (const d of r.duracaoDias ?? []) {
        expect(d.estadoCalculo, `S${semana}`).toBe('CALCULADO');
        expect(d.duracaoMaximaEstimadaSegundos, `S${semana}`).toBeLessThanOrEqual(p.tempoPorSessaoMin * 60);
      }
    }
  });
});
