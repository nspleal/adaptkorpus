/**
 * 🔴 ENTREGA PARCIAL DO BLOCO DO FOCO — a frase que dizia "não entrou" sobre o que entrou.
 *
 * 🔑 O defeito (achado na 3ª volta de validação, sobre `49dab05`): o ramo de recusa do bloco
 * do foco roda quando ALGUM extra é recusado, e as duas frases afirmavam que o bloco NÃO
 * ENTROU. Quando só parte é recusada, o que sobrou continua no plano e em
 * `blocoFoco.adicionais` — e a pessoa lia "não entrou" olhando para um exercício de foco que
 * está lá, com séries.
 *
 * 🔒 Medido antes de corrigir, no candidato `49dab05`: varredura de 5 184 combinações
 * (3 objetivos × 3 níveis × 4 agendas × 3 durações × 2 limites × 4 semanas × 6 focos). A
 * frase sai em 153 células; em **13** delas `adicionais` não estava vazio.
 *
 * 🔒 A correção é de COMUNICAÇÃO. `treino-types` já declara a distinção que faltava chegar à
 * copy: `solicitados` é a INTENÇÃO (quantos extras a montagem pediu), `adicionais` é a
 * ENTREGA (o que sobreviveu). Dose, alocador e regras do foco não são tocados — o que entra
 * continua sendo exatamente o que entrava.
 *
 * ⚠️ Os três estados são exigidos aqui, e com anti-vacuidade em cada um: entrega NENHUMA,
 * entrega PARCIAL (o caso reproduzido) e entrega COMPLETA.
 */
import { describe, expect, it } from 'vitest';
import { recomputarPlano } from './plano';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { RotinaSemanal } from './engine/treino-types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;

const perfil = (over: Record<string, unknown> = {}): PerfilResumo => ({
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
  objetivo: 'massa', flagsSaude: SEM, alergenos: [], preferencia: null, naoCurto: [],
  pratosCansados: [], favoritos: [], nivelExperiencia: 'intermediario', equipamento: 'academia',
  equipamentosCasa: [], diasDisponiveis: 4, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], ...over,
}) as PerfilResumo;

const plano = (over: Record<string, unknown>, semana: number): RotinaSemanal =>
  recomputarPlano(perfil({ ...over, foco: { ...(over.foco as object), semana } }), { semanaCiclo: { semana } } as never).treino.rotina!;

/** A frase de recusa/entrega parcial, qualquer que seja o ramo. */
const falaDoBloco = (r: RotinaSemanal) =>
  (r.avisos ?? []).filter((a) => /bloco do foco|O volume de .* já está/.test(a));

const entrega = (r: RotinaSemanal) => {
  const ad = r.blocoFoco?.adicionais ?? [];
  return { exercicios: ad.length, series: ad.reduce((n, a) => n + (a.series ?? 0), 0), solicitados: r.blocoFoco?.solicitados ?? 0 };
};

/** O caso REPRODUZIDO na varredura: entrega parcial com a frase errada. */
/**
 * 🔵 REANCORADO em 2026-09-19: com a seleção por referência, o caso avançado/6d/45 passou a
 * recusar o bloco inteiro. A entrega PARCIAL viva (1 de 2, o segundo cortado pelo tempo) é o
 * iniciante de 3 dias em 30 min com foco em bíceps.
 */
// Controle discriminante em CP10: 1 de 2 extras, via porta pública, sem mudar o regime limitado.
const CASO_PARCIAL = {
  nivelExperiencia: 'intermediario', diasDisponiveis: 3, treinoDias: ['seg','qua','sex'],
  tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado', foco: { grupo: 'biceps', compensa: 'peito' },
};

describe('🔴 o bloco do foco: entrega parcial não é recusa total', () => {
  it('ENTREGA PARCIAL — o caso reproduzido diz quanto entrou, e não diz que não entrou', () => {
    const r = plano(CASO_PARCIAL, 1);
    const e = entrega(r);
    // ⚠️ ANTI-VACUIDADE: se o caso degenerar (nada entregue, ou tudo), ele deixa de provar.
    expect(e.exercicios, 'o caso degenerou: nada foi entregue, não há entrega PARCIAL').toBeGreaterThan(0);
    expect(e.exercicios, 'o caso degenerou: entrou tudo, não há recusa').toBeLessThan(e.solicitados);

    const fala = falaDoBloco(r);
    expect(fala.length, 'o corte do bloco ficou mudo').toBeGreaterThan(0);
    const frase = fala.join(' | ');
    expect(frase, 'a frase afirma recusa TOTAL sobre uma entrega parcial').not.toMatch(/bloco do foco não entrou/);
    expect(frase, 'a frase não diz que a entrada foi parcial').toMatch(/entrou só em parte/);
    // 🔒 O número dito é o ENTREGUE, não o pedido.
    expect(frase, 'a frase não diz quantos exercícios entraram').toMatch(
      new RegExp(`${e.exercicios} exerc[íi]cios?`));
    expect(frase, 'a frase não diz quantas séries entraram').toMatch(
      new RegExp(`${e.series} s[ée]ries?`));
  }, 60_000);

  it('NENHUMA ENTREGA — a frase de recusa total continua exatamente como era', () => {
    const r = plano({
      nivelExperiencia: 'avancado', diasDisponiveis: 5, treinoDias: [...DIAS.slice(0, 5)],
      tempoPorSessaoMin: 45, limiteTempoTreino: 'limitado', foco: { grupo: 'peito', compensa: 'ombros' },
    }, 1);
    const e = entrega(r);
    expect(e.exercicios, 'o caso degenerou: algo foi entregue, não é recusa TOTAL').toBe(0);
    expect(e.solicitados, 'o caso degenerou: nada foi pedido, não há recusa').toBeGreaterThan(0);

    const frase = falaDoBloco(r).join(' | ');
    expect(frase, 'a recusa total ficou muda').toMatch(/bloco do foco não entrou|já está n[oa]/);
    expect(frase, 'recusa total não pode falar em entrada parcial').not.toMatch(/entrou só em parte/);
  }, 60_000);

  it('ENTREGA COMPLETA — nada é dito sobre recusa, e o bloco entra inteiro', () => {
    const r = plano({
      nivelExperiencia: 'intermediario', diasDisponiveis: 4, treinoDias: [...DIAS.slice(0, 4)],
      tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', foco: { grupo: 'peito', compensa: 'ombros' },
    }, 1);
    const e = entrega(r);
    expect(e.solicitados, 'o caso degenerou: nada foi pedido').toBeGreaterThan(0);
    expect(e.exercicios, 'o caso degenerou: a entrega não foi completa').toBe(e.solicitados);

    const frase = falaDoBloco(r).join(' | ');
    expect(frase, 'entrega completa não pode falar em recusa').not.toMatch(/bloco do foco não entrou/);
    expect(frase, 'entrega completa não pode falar em entrada parcial').not.toMatch(/entrou só em parte/);
  }, 60_000);

  /**
   * 🔒 A INVARIANTE, varrida — é ela que o defeito violava em 13 células de 5 184.
   *
   * Nenhum plano pode afirmar que o bloco não entrou enquanto entrega exercício de foco.
   */
  it('em nenhuma célula a frase de recusa TOTAL convive com adicionais entregues', () => {
    const fora: string[] = [];
    let medidos = 0;
    let comFala = 0;
    let parciais = 0;
    for (const objetivo of ['massa', 'emagrecimento'] as const)
      for (const tempo of [45, 60, 75] as const)
        for (const limite of ['limitado', 'sem_limite'] as const)
          for (const semana of [1, 3, 5] as const)
            for (const grupo of ['peito', 'gluteos', 'costas', 'pernas'] as const) {
              let r: RotinaSemanal;
              try {
                r = plano({
                  objetivo, nivelExperiencia: 'avancado', diasDisponiveis: 6,
                  treinoDias: [...DIAS.slice(0, 6)], tempoPorSessaoMin: tempo,
                  limiteTempoTreino: limite, foco: { grupo, compensa: 'ombros' },
                }, semana);
              } catch { continue; }
              medidos += 1;
              const e = entrega(r);
              const frase = falaDoBloco(r).join(' | ');
              if (frase) comFala += 1;
              if (e.exercicios > 0 && e.exercicios < e.solicitados) parciais += 1;
              if (/bloco do foco não entrou/.test(frase) && e.exercicios > 0) {
                fora.push(`${objetivo}/${tempo}min/${limite}/S${semana}/foco=${grupo}: entregues=${e.exercicios}`);
              }
            }
    expect(medidos, 'a varredura não mediu nada').toBeGreaterThan(100);
    expect(comFala, 'nenhuma célula falou do bloco — a invariante não foi exercida').toBeGreaterThan(0);
    expect(parciais, 'nenhuma entrega parcial na grade — o caso não foi exercido').toBeGreaterThan(0);
    expect(fora, `${fora.length} planos dizem que o bloco não entrou enquanto entregam foco`).toEqual([]);
  }, 300_000);
});
