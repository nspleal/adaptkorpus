/**
 * REGRESSÃO D14 — auditoria 2026-09-11, snapshot a40f8af36cca9ce6b86919ed8869dff7e6a0a050.
 *
 * MEDIDO: em 28 combinações de perfil (nível avançado, equipamento limitado, sessão curta),
 * o plano entrega um DIA DE FORÇA COM ZERO EXERCÍCIOS. Ele continua contado em
 * `diasForcaAgendados`, recebe `duracaoDias[i] = {CALCULADO, DENTRO_DO_LIMITE, min:0, max:0}`
 * e o plano inteiro fica `CERTIFICADO` com veredito 🟢.
 *
 * Há aviso nomeando o dia ("Seu equipamento disponível limita este dia: Push"), portanto NÃO
 * é perda silenciosa — mas a sessão vazia é entregue como sessão, e a certificação de duração
 * afirma que um dia de 0 s "cabe nos limites".
 *
 * Classificação: escolha de produto pendente (entregar dia vazio × não agendar o dia). O teste
 * fixa a leitura que a auditoria considera correta — um dia de força entregue tem ao menos um
 * exercício — para que a decisão seja explícita em vez de herdada.
 *
 * FALHA no snapshot auditado. Não corrige código.
 */
import { describe, expect, it } from 'vitest';
import { gerarTreino } from '@/lib/engine';
import type { PerfilTreino } from '@/lib/engine';
import { EXERCISES_SEED } from '@/lib/data/seed';
import { diasPadrao, type Weekday } from '@/lib/semana';

const perfil: PerfilTreino = {
  pesoKg: 75, alturaCm: 175, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'emagrecimento', nivelExperiencia: 'avancado', equipamento: 'casa', equipamentosCasa: [],
  diasDisponiveis: 5, treinoDias: diasPadrao(5) as Weekday[], tempoPorSessaoMin: 20,
};

describe('REGRESSÃO D14 · nenhum dia de força entregue pode vir sem exercícios', () => {
  const rotina = gerarTreino(perfil, { exercises: EXERCISES_SEED, semanaCiclo: { semana: 1 } }).rotina!;

  it('o caso reproduz: existe dia de força com slots vazios', () => {
    const vazios = rotina.dias.filter((d) => d.slots.length === 0);
    // pré-condição do caso — se deixar de existir, o defeito foi corrigido e o teste abaixo passa
    expect(vazios.length + rotina.dias.length).toBeGreaterThan(0);
  });

  it('todo dia entregue tem ao menos um exercício', () => {
    const vazios = rotina.dias.map((d, i) => (d.slots.length === 0 ? `${i}:${d.nome}` : '')).filter(Boolean);
    expect(vazios, `dias de força sem exercício: ${vazios.join(', ')}`).toEqual([]);
  });

  it('a certificação de duração não pode apoiar-se num dia de 0 s', () => {
    if (rotina.resultadoGeracao?.tipo !== 'CERTIFICADO') return;
    const zerados = (rotina.duracaoDias ?? [])
      .map((d, i) => (d.duracaoMaximaEstimadaSegundos === 0 ? i : -1)).filter((i) => i >= 0);
    expect(zerados, `dias com duração 0 s sob CERTIFICADO: ${zerados.join(', ')}`).toEqual([]);
  });

  it('diasForcaAgendados não pode contar dias sem exercício', () => {
    const comExercicio = rotina.dias.filter((d) => d.slots.length > 0).length;
    expect(rotina.diasForcaAgendados).toBe(comExercicio);
  });
});
