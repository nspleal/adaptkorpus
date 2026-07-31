import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina, type OpcoesSemana } from './treino-montador';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude } from './types';
import type { PerfilTreino } from './treino-types';

/**
 * CARACTERIZAÇÃO DO ORÇAMENTO DE TEMPO — escrita ANTES de mexer nele (trava da Leva B).
 *
 * 🔴 Por que existe: a varredura de call sites da Leva A sondou os 7 trilhos e achou **um
 * único ponto sem teste de comportamento** — `treino-montador.ts:176`, onde a banda de
 * volume alimenta `sPlan`, o estimador de quantos exercícios cabem no tempo da sessão.
 * Trocar a banda por `{min:1,max:99}` **sobrevivia à suíte inteira**. E a Leva B mexe
 * exatamente aí: o orçamento passa a **somar descanso item a item** em vez de usar um
 * escalar × total de séries.
 *
 * 🔒 Estes testes NÃO afirmam que os números estão certos — afirmam **o que o estimador faz
 * hoje**. Quando a soma por item entrar, eles mudam **de propósito**, e o diff obriga a
 * explicar cada número que se moveu. Sem esta rede, uma regressão no nº de exercícios por
 * sessão passa batida: *"a sessão não fecha"* é sintoma que só aparece na vida real.
 *
 * ⚠️ Leia o resultado como fotografia, não como spec. Se um número aqui mudar sem que o
 * commit explique por quê, é regressão — não "o teste estava velho".
 */

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

function perfil(over: Partial<PerfilTreino> = {}): PerfilTreino {
  return {
    pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
    nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4,
    tempoPorSessaoMin: 60, ...over,
  };
}

/** Rotina com a semana do mesociclo LIGADA — é o ramo `if (semanaCiclo)` que contém `sPlan`. */
function rotinaComCiclo(over: Partial<PerfilTreino> = {}, semana = 1) {
  const p = perfil(over);
  const opc: OpcoesSemana = { semana: semana as OpcoesSemana['semana'], feedbackGrupos: new Map() };
  return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, undefined, opc);
}

/** Nº de slots por dia — a saída observável do `maxExercicios` que `sPlan` produz. */
const slotsPorDia = (r: ReturnType<typeof rotinaComCiclo>): number[] => r.dias.map((d) => d.slots.length);

describe('📸 caracterização — nº de exercícios por dia, com o estimador ATUAL', () => {
  /**
   * O eixo que mais mexe no `cap()`: o tempo por sessão entra no numerador direto.
   * Objetivo `massa` = descanso composto 90–120 (média 105) → o divisor é `sPlan × 145`.
   */
  it.each([30, 45, 60, 75, 90])('massa/intermediário, %i min por sessão', (tempoPorSessaoMin) => {
    const r = rotinaComCiclo({ tempoPorSessaoMin });
    expect({ tempo: tempoPorSessaoMin, slots: slotsPorDia(r) }).toMatchSnapshot();
  });

  /**
   * O objetivo muda `descansoCompostoSeg` (massa 90–120 · saúde e emagrecimento 60–90), que
   * entra no `restMid` do divisor — e também decide o `elegivel180`.
   */
  it.each(['massa', 'emagrecimento', 'saude'] as const)('objetivo %s, 60 min', (objetivo) => {
    const r = rotinaComCiclo({ objetivo });
    expect({ objetivo, slots: slotsPorDia(r) }).toMatchSnapshot();
  });

  /** O nível muda séries/exercício e a banda de volume — os dois lados do `sPlan`. */
  it.each(['iniciante', 'intermediario', 'avancado'] as const)('nível %s, 60 min', (nivelExperiencia) => {
    const r = rotinaComCiclo({ nivelExperiencia });
    expect({ nivel: nivelExperiencia, slots: slotsPorDia(r) }).toMatchSnapshot();
  });

  /** Modo força liga o `elegivel180` mesmo em faixa baixa — outro caminho do `cap()`. */
  it('modo força ligado (composto a 6RM) — o caminho do teto de 180 s', () => {
    const r = rotinaComCiclo({ objetivo: 'emagrecimento', modoForca: true });
    expect(slotsPorDia(r)).toMatchSnapshot();
  });

  /** A semana do ciclo move o volume-alvo; a 6 é deload. */
  it.each([1, 3, 5, 6])('semana %i do mesociclo', (semana) => {
    const r = rotinaComCiclo({}, semana);
    expect({ semana, slots: slotsPorDia(r) }).toMatchSnapshot();
  });

  /** Sessão curta é onde o orçamento morde — e onde a soma por item vai divergir mais. */
  it('sessão de 30 min, avançado (o caso mais apertado)', () => {
    const r = rotinaComCiclo({ tempoPorSessaoMin: 30, nivelExperiencia: 'avancado', diasDisponiveis: 5 });
    expect(slotsPorDia(r)).toMatchSnapshot();
  });

  /**
   * 🔑 A FAIXA ONDE O `cap` REALMENTE MORDE — descoberta por sondagem, não por suposição.
   *
   * Nos perfis "normais" o `cap` devolve 6–15 contra 3–4 padrões por dia: ele não limita
   * nada, e mutações no `sPlan` (banda literal, `restMid` no piso, `elegivel180` sempre
   * ligado) **sobrevivem por inalcançabilidade**, não por guard fraco. Duas causas medidas:
   *
   *  1. `sPlan` **satura em `seriesPorExercicio.max` em 7 dos 9 perfis** — mexer na banda
   *     não move o resultado porque o `Math.min` já grampeou.
   *  2. O tempo padrão (60 min) é folgado demais para o cap ser o limitante.
   *
   * Só `iniciante` escapa da saturação (`sPlan` 2 < max 3), e só abaixo de ~20 min o cap
   * passa a mandar. O mínimo aceito pela validação é **10 min** (`perfil-resumo.ts:21`),
   * então é aqui que a rede tem de existir — senão a Leva B mexe no estimador com a
   * caracterização toda passando por vacuidade.
   */
  it.each([10, 15, 20, 25])('iniciante/massa, %i min — faixa em que o cap LIMITA', (tempoPorSessaoMin) => {
    const r = rotinaComCiclo({ tempoPorSessaoMin, nivelExperiencia: 'iniciante', objetivo: 'massa' });
    expect({ tempo: tempoPorSessaoMin, slots: slotsPorDia(r) }).toMatchSnapshot();
  });

  it.each([10, 15, 20, 25, 30])('intermediário/massa, %i min — cap limitando com sPlan saturado', (tempoPorSessaoMin) => {
    const r = rotinaComCiclo({ tempoPorSessaoMin });
    expect({ tempo: tempoPorSessaoMin, slots: slotsPorDia(r) }).toMatchSnapshot();
  });

  it.each(['massa', 'emagrecimento', 'saude'] as const)('iniciante/%s, 12 min — objetivo muda o restMid no divisor', (objetivo) => {
    const r = rotinaComCiclo({ tempoPorSessaoMin: 12, nivelExperiencia: 'iniciante', objetivo });
    expect({ objetivo, slots: slotsPorDia(r) }).toMatchSnapshot();
  });

  it('modo força em sessão curta — o teto de 180 s morde o cap', () => {
    const r = rotinaComCiclo({ tempoPorSessaoMin: 20, objetivo: 'emagrecimento', modoForca: true });
    expect(slotsPorDia(r)).toMatchSnapshot();
  });
});

describe('📸 caracterização — o estimador de HOJE é cego à composição da sessão', () => {
  /**
   * 🔑 Este é o teste que a Leva B vai INVERTER, e é o motivo de ele estar escrito antes.
   *
   * Hoje o orçamento usa **um** descanso (o do composto) × total de séries, então duas
   * sessões com a mesma contagem de slots custam o mesmo mesmo que uma seja toda de
   * composto e a outra toda de acessório. Depois da soma por item, elas **têm** de divergir
   * — e o critério de aceite 5b pede exatamente essa prova.
   *
   * Aqui só registramos a cegueira atual: o `cap` não olha a classe de nada.
   */
  it('o divisor do cap não depende de quais exercícios caíram na sessão', () => {
    // Mesmo perfil, mesma semana → mesma contagem, qualquer que seja a mistura sorteada.
    const a = rotinaComCiclo({ diasDisponiveis: 4 });
    const b = rotinaComCiclo({ diasDisponiveis: 4 });
    expect(slotsPorDia(a)).toEqual(slotsPorDia(b)); // determinismo do motor

    // E a contagem por dia é uniforme dentro da sessão, independentemente da composição:
    // nenhum dia recebe menos slots por ter mais composto.
    const r = rotinaComCiclo({ tempoPorSessaoMin: 45 });
    const porDia = r.dias.map((d) => ({
      slots: d.slots.length,
      compostos: d.slots.filter((s) => s.padrao !== 'isolado').length,
    }));
    expect(porDia).toMatchSnapshot();
  });

  /**
   * O valor único que sai hoje como propriedade da SEMANA — o escalar que a Leva B
   * substitui por um descanso de cada slot.
   */
  /**
   * 🔑 `descansoEfetivo` — o escalar que a Leva B substitui. Caracterizado por objetivo
   * porque é ele que decide o `elegivel180`: massa (90–120) e modo força entram no teto de
   * 180 s; saúde e emagrecimento (60–90) não. Sem esta fotografia, forçar
   * `elegivel180 = true` **sobrevivia** — a mudança não aparecia na contagem de slots,
   * só no valor do descanso.
   */
  it.each(['massa', 'emagrecimento', 'saude'] as const)('descanso efetivo da semana — objetivo %s', (objetivo) => {
    const r = rotinaComCiclo({ objetivo, tempoPorSessaoMin: 90 });
    expect({ objetivo, descanso: r.semana?.descansoCompostoSeg }).toMatchSnapshot();
  });

  it.each([30, 60, 90])('descanso efetivo — massa, %i min (o teto de 180 s depende do tempo)', (tempoPorSessaoMin) => {
    const r = rotinaComCiclo({ tempoPorSessaoMin });
    expect({ tempo: tempoPorSessaoMin, descanso: r.semana?.descansoCompostoSeg }).toMatchSnapshot();
  });

  it('descanso efetivo — modo força liga o teto de 180 s em faixa baixa', () => {
    const r = rotinaComCiclo({ objetivo: 'emagrecimento', modoForca: true, tempoPorSessaoMin: 90 });
    expect(r.semana?.descansoCompostoSeg).toMatchSnapshot();
  });

  it('a rotina devolve UM descanso, da semana, não um por item', () => {
    const r = rotinaComCiclo();
    expect(r.semana?.descansoCompostoSeg).toBeDefined();
    expect(r.semana?.descansoCompostoSeg).toMatchSnapshot();
    // E nenhum slot carrega descanso próprio — é o que muda.
    for (const d of r.dias) {
      for (const s of d.slots) {
        expect(s).not.toHaveProperty('descansoSeg');
      }
    }
  });
});

/**
 * 🟡 SONDAGEM DE ALCANÇABILIDADE — registrada, sem teste (regra "não perseguir placar").
 *
 * A mutação "remover o `Math.max(1, …)` do `cap`" **sobrevive**, e a sondagem diz por quê:
 * o valor 0 só aparece na avaliação de `cap(rest180)` **dentro da guarda**
 * `if (cap(rest180) >= precisaSlots)`, cujo resultado é descartado quando não passa. O que
 * chega a `maxExercicios` é sempre `cap(descansoEfetivo)` com a faixa BASE, e o pior caso
 * medido em todos os perfis com o mínimo aceito pela validação (10 min) é **1**, não 0.
 *
 * Ou seja: o piso é defensivo e hoje **inalcançável**. Escrever teste para ele seria testar
 * código morto para o placar fechar. Fica anotado — se a Leva B mudar o divisor (e ela vai:
 * a soma por item troca `sPlan × descanso` por `Σ descanso do item`), **esta conclusão
 * expira** e o piso pode virar alcançável.
 */
