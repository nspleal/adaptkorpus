import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina, type OpcoesSemana } from './treino-montador';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude } from './types';
import type { PerfilTreino } from './treino-types';
import { temCarga } from './equipamento';
import { classeDeDescanso, descansoDoExercicio } from './descanso';

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

  /**
   * 🔻 ESTE NÚMERO MUDOU DE PROPÓSITO (correção 1.3, 2026-07-31): `[2,2,2,2]` → `[1,1,1,1]`.
   *
   * Antes, o orçamento degradava a força pesada de **300 → 90 s (−70 %)** — o oposto do que
   * a §5.7 manda (3–5 min). Com o piso de 180 s, 20 min só comportam UM exercício, e é a
   * resposta honesta: quem escolhe força pesada aceita que o descanso é o custo.
   *
   * 🟢 Alcance MEDIDO em produção: **zero**. O app oferece 30/45/60/75 min
   * (`EditarPerfil.tsx:258`); 20 min não é selecionável. Nas durações reais, com e sem modo
   * força, o nº de exercícios por dia ficou **byte-idêntico** — só os segundos exibidos
   * mudaram, para cima, onde a §5.7 mandava.
   */
  it('modo força em sessão curta — o piso de 180 s da força pesada custa exercício', () => {
    const r = rotinaComCiclo({ tempoPorSessaoMin: 20, objetivo: 'emagrecimento', modoForca: true });
    expect(slotsPorDia(r)).toMatchSnapshot();
  });
});

describe('📸 caracterização — orçamento temporal atual e composição da sessão', () => {
  /**
   * 🔑 A contagem INICIAL de slots ainda depende de tempo e volume, antes de existir
   * uma lista concreta de exercícios. Depois da alocação, o orçamento temporal avalia
   * cada item pela fórmula canônica — inclusive descanso, isometria e lateralidade.
   *
   * Estas fotos distinguem as duas camadas: o cap inicial continua independente da
   * composição; já o descanso efetivo reage aos exercícios materializados. Assim,
   * mudanças futuras só podem alterar estes números com uma explicação explícita.
   */
  it('o cap inicial não depende de quais exercícios caíram na sessão', () => {
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
   * 🔑 `descansoEfetivo` — o escalar da semana, hoje LEGADO. Caracterizado por objetivo
   * porque é ele que decide o `elegivel180`: massa (90–120) e modo força entram no teto de
   * 180 s; saúde e emagrecimento (60–90) não. Sem esta fotografia, forçar
   * `elegivel180 = true` não aparecia na contagem de slots, só no valor do descanso.
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

  /**
   * 🔄 INVERTIDO PELA PARTE 2 (era: "a rotina devolve UM descanso, da semana, não um por
   * item"). O teste existia para registrar que nenhum slot carregava descanso próprio.
   * Agora TODO slot com série carrega — é a mudança estrutural da leva. O escalar da semana
   * segue exposto só por compatibilidade da chamada v1.
   */
  it('todo slot carrega o SEU descanso (o escalar da semana virou legado)', () => {
    const r = rotinaComCiclo();
    expect(r.semana?.descansoCompostoSeg).toBeDefined();
    for (const d of r.dias) {
      for (const s of d.slots) {
        expect(s.descansoSeg, `${s.exercicio.id}`).toBeDefined();
        expect(s.descansoSeg!).toBeGreaterThanOrEqual(60);
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

/* ════════════════ PARTE 2 — o comportamento NOVO ════════════════ */

describe('🔒 aceite 5b — a estimativa SOMA por item, e enxerga a composição', () => {
  /**
   * O teste que a fórmula antiga não conseguiria passar. Antes, o custo era
   * `sPlan × (40 + um_descanso)` — igual para qualquer mistura. Agora cada padrão custa o
   * descanso da SUA classe, então um dia de composto e um de acessório divergem.
   */
  /**
   * 🔻 REESCRITO no v4 (2026-08-13): comparar CUSTO por slot na saída deixou de
   * discriminar — a degradação por dia aperta justamente o dia caro, igualando os custos
   * finais (que é o objetivo dela). A prova de que a estimativa enxerga a composição
   * mudou de face: no MESMO orçamento, o dia carregado de composto DEGRADA o descanso e o
   * dia leve não. Com a fórmula antiga (um descanso × total), os dois degradariam juntos.
   * Fixture por sondagem: 4d/75min/semana 5 — Lower A (composto-pesado) cai a 90 s;
   * Upper A (com isolados) mantém o topo (180 s).
   */
  it('no mesmo orçamento, o dia carregado de composto degrada e o leve não', () => {
    const r = rotinaComCiclo({ tempoPorSessaoMin: 75 }, 5);
    const compostos = (d: (typeof r.dias)[number]) => d.slots.filter((s) => s.padrao !== 'isolado' && s.padrao !== 'core').length;
    const descansoComposto = (d: (typeof r.dias)[number]) => Math.max(...d.slots.filter((s) => s.padrao !== 'isolado' && s.padrao !== 'core').map((s) => s.descansoSeg ?? 0));
    const ordenados = [...r.dias].sort((a, b) => compostos(b) - compostos(a));
    const maisComposto = ordenados[0]!;
    const menosComposto = ordenados[ordenados.length - 1]!;
    expect(compostos(maisComposto), 'caso não discriminante — composições iguais').toBeGreaterThan(compostos(menosComposto));
    expect(descansoComposto(maisComposto), 'o dia pesado não cedeu descanso').toBeLessThan(descansoComposto(menosComposto));
  });

  it('o custo por slot acompanha a classe (composto ≥ acessório, sempre)', () => {
    const r = rotinaComCiclo({ tempoPorSessaoMin: 60 });
    for (const d of r.dias) {
      const comp = d.slots.filter((s) => s.padrao !== 'isolado' && s.padrao !== 'core');
      const aces = d.slots.filter((s) => s.padrao === 'isolado' || s.padrao === 'core');
      for (const c of comp) for (const a of aces) {
        expect(c.descansoSeg!, `${c.exercicio.id} vs ${a.exercicio.id}`).toBeGreaterThanOrEqual(a.descansoSeg!);
      }
    }
  });
});

describe('🔒 o delta dos 18 `core` na saída REAL', () => {
  /**
   * 🔑 A confirmação que o handoff pede: um abdominal e um composto na MESMA sessão têm de
   * mostrar números diferentes. Antes, `sl.padrao !== 'isolado'` punha `core` do lado do
   * composto e os dois recebiam a mesma faixa.
   */
  it('um `core` e um composto na mesma sessão recebem descansos DIFERENTES', () => {
    const r = rotinaComCiclo({ tempoPorSessaoMin: 60, diasDisponiveis: 4 });
    const diaComCore = r.dias.find(
      (d) => d.slots.some((s) => s.padrao === 'core') && d.slots.some((s) => s.padrao !== 'core' && s.padrao !== 'isolado'),
    );
    expect(diaComCore, 'nenhuma sessão tem core + composto juntos — caso não discriminante').toBeDefined();
    const core = diaComCore!.slots.find((s) => s.padrao === 'core')!;
    const comp = diaComCore!.slots.find((s) => s.padrao !== 'core' && s.padrao !== 'isolado')!;
    expect(core.descansoSeg).toBeDefined();
    expect(comp.descansoSeg).toBeDefined();
    expect(core.descansoSeg).not.toBe(comp.descansoSeg);
    expect(core.descansoSeg!).toBeLessThan(comp.descansoSeg!);
  });

  it('nenhum slot de cardio recebe descanso (aceite 7, na saída real)', () => {
    const r = rotinaComCiclo();
    for (const d of r.dias) for (const s of d.slots) {
      if (s.exercicio.tipo === 'cardio') expect(s.descansoSeg).toBeUndefined();
    }
  });
});

describe('🔒 degradação e rampa na saída real (buracos achados por mutação)', () => {
  /**
   * B4 — a ORDEM da degradação. Sob orçamento apertado, cede ISOLADO até 60 s ANTES de
   * COMPOSTO, e o composto nunca desce abaixo de 90 s. Invertida, a mutação sobrevivia:
   * os snapshots contam SLOTS, não os valores de descanso sob degradação.
   */
  it('degradação nível 1: o ACESSÓRIO vai ao piso e o COMPOSTO fica intacto', () => {
    // ⚠️ Fixture RE-SONDADA para o alocador v4 (2026-08-13): com 6–7 slots por dia, os
    // 45 min passaram a exigir nível 2 em todos os dias e o caso parou de discriminar a
    // ORDEM. A sondagem nova achou 90 min / semana 5: o Upper A (7 slots) fecha no nível 1
    // — acessório a 60 s, composto INTACTO no topo (180 s). A ordem invertida rebaixaria o
    // composto a 90 aqui. Semana 5 põe o RIR em 1, e só aí o acessório vale 120 s pela
    // faixa: na semana 1 (RIR 3) ele JÁ é 60 s e degradar fica indistinguível.
    const r = rotinaComCiclo({ tempoPorSessaoMin: 90, nivelExperiencia: 'intermediario' }, 5);
    const diaDegradado = r.dias.find((d) =>
      d.slots.some((x) => (x.padrao === 'isolado' || x.padrao === 'core') && x.descansoSeg === 60));
    expect(diaDegradado, 'nenhum dia degradou — caso não discriminante').toBeDefined();
    const comp = diaDegradado!.slots.filter((x) => x.padrao !== 'isolado' && x.padrao !== 'core');
    expect(comp.length).toBeGreaterThan(0);
    // A regra 3 concentra o benefício no composto pesado: ele NÃO cede enquanto o
    // acessório resolver. A ordem invertida rebaixaria o composto a 90 aqui.
    for (const c of comp) expect(c.descansoSeg!, `composto ${c.exercicio.id}`).toBeGreaterThan(90);
  });

  it('degradação nível 2: quando o acessório não basta, o COMPOSTO cede — mas só até 90 s', () => {
    const r = rotinaComCiclo({ tempoPorSessaoMin: 20, nivelExperiencia: 'intermediario' }, 5);
    const todos = r.dias.flatMap((d) => d.slots);
    for (const x of todos.filter((y) => y.padrao === 'isolado' || y.padrao === 'core')) {
      expect(x.descansoSeg!, `acessório ${x.exercicio.id}`).toBe(60);
    }
    for (const x of todos.filter((y) => y.padrao !== 'isolado' && y.padrao !== 'core')) {
      expect(x.descansoSeg!, `composto ${x.exercicio.id}`).toBeGreaterThanOrEqual(90);
    }
  });

  /**
   * B5 — 🟡 EXCEÇÃO NOMEADA: na rampa o piso do FIT é INVIOLÁVEL. Mesmo com tempo curto,
   * ninguém desce de 120 s na semana 1 — quem cede é o nº de exercícios. Sem este teste, a
   * mutação "rampa passa a degradar" sobrevivia, e ela apaga exatamente a proteção que a
   * rampa existe para dar (o risco documentado é rabdomiólise, não desconforto).
   */
  it('na rampa com tempo curto, NINGUÉM desce do piso do FIT (cede o nº de exercícios)', () => {
    // 🔻 1.2: 30 min, não 20. MEDIDO: a 20 min a sessão na rampa sai com **zero ISOLADO**
    // (4 slots, todos composto) — era essa a razão de o aceite passar sem provar nada. A 30
    // min há 2 isolados, e 30 é duração REAL do app (as opções são 30/45/60/75).
    const p = perfil({ tempoPorSessaoMin: 30 });
    const opc: OpcoesSemana = {
      semana: 1, feedbackGrupos: new Map(),
      retomada: { semana: 1, fator: 0.5, volumeReferencia: 12, exerciciosRecentes: new Set() },
    };
    const r = montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, undefined, opc);
    const todos = r.dias.flatMap((d) => d.slots).filter((s) => s.descansoSeg != null);
    expect(todos.length, 'rampa sem slots — caso não discriminante').toBeGreaterThan(0);
    for (const s of todos) {
      expect(s.descansoSeg!, `${s.exercicio.id} furou o piso do FIT`).toBeGreaterThanOrEqual(120);
    }

    /**
     * 🔻 CORREÇÃO 1.2 (2026-07-31) — o aceite acima era VACUOSO sozinho.
     *
     * Com composto, o RIR-alvo 3 da rampa já dá **120 s**, que é o próprio piso do FIT: o
     * `max(120, 120)` é inerte, e apagar o piso não mudaria número nenhum. O caso que
     * discrimina é o **ISOLADO**, cuja base a RIR 3 é **60 s** — só o piso o leva a 120.
     */
    const isolados = todos.filter((s) => classeDeDescanso(s.exercicio) === 'ISOLADO');
    expect(isolados.length, 'sem ISOLADO na sessão o aceite volta a ser vacuoso').toBeGreaterThan(0);
    for (const s of isolados) {
      // O que o deslocamento daria SOZINHO, fora da rampa — a prova de que o piso agiu.
      const semRampa = descansoDoExercicio({ exercicio: s.exercicio, rirAlvo: 3 });
      expect(semRampa, `${s.exercicio.id}: base do isolado`).toBe(60);
      expect(s.descansoSeg!, `${s.exercicio.id}: 60 → 120 é o efeito do piso`).toBe(120);
    }
  });

  it('na rampa semana 2 o piso é 90 s', () => {
    const p = perfil({ tempoPorSessaoMin: 20 });
    const opc: OpcoesSemana = {
      semana: 1, feedbackGrupos: new Map(),
      retomada: { semana: 2, fator: 0.7, volumeReferencia: 12, exerciciosRecentes: new Set() },
    };
    const r = montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, undefined, opc);
    for (const s of r.dias.flatMap((d) => d.slots).filter((x) => x.descansoSeg != null)) {
      expect(s.descansoSeg!).toBeGreaterThanOrEqual(90);
    }
  });

  /**
   * B3 — o descanso do slot vem do EXERCÍCIO, não do padrão. O padrão não enxerga o override
   * de força pesada (só composto COM carga), então usar `descansoDoPadrao` no slot final
   * daria o mesmo número para barra e para peso corporal.
   */
  it('modo força: composto COM carga recebe faixa pesada; peso corporal NÃO', () => {
    const r = rotinaComCiclo({ modoForca: true, nivelExperiencia: 'avancado', tempoPorSessaoMin: 90 });
    const comp = r.dias.flatMap((d) => d.slots).filter((s) => s.padrao !== 'isolado' && s.padrao !== 'core');
    const comCarga = comp.filter((s) => temCarga(s.exercicio));
    const semCarga = comp.filter((s) => !temCarga(s.exercicio));
    expect(comCarga.length, 'nenhum composto com carga — caso não discriminante').toBeGreaterThan(0);
    for (const s of comCarga) expect(s.descansoSeg!, `${s.exercicio.id}`).toBeGreaterThanOrEqual(180);
    for (const s of semCarga) expect(s.descansoSeg!, `${s.exercicio.id}`).toBeLessThanOrEqual(180);
  });
});

describe('🔒 o orçamento é POR DIA — dias de composição diferente saem diferentes', () => {
  /**
   * 🔻 REESCRITO para o alocador v4 (2026-08-13). O cap por soma-de-itens morreu de
   * propósito: o nº de slots vem da tabela f(tempo) do handoff (igual para todos os dias).
   * O que continua POR DIA — e é o que este teste agora prova — são as DUAS saídas que
   * dependem da composição do dia:
   *  · a CONTAGEM ainda difere quando o déficit de um dia se esgota antes do orçamento
   *    (o dia não é inflado para bater a tabela);
   *  · a DEGRADAÇÃO é decidida dia a dia: o dia carregado de composto cede descanso, o dia
   *    que cabe na faixa cheia não cede nada.
   * Fixture por sondagem: 4 dias / 75 min / semana 5 — Upper A degrada (90 s) e Lower B
   * fecha inteiro (180 s), com contagens 7/7/7/6.
   */
  it('4d/75min/sem.5: a contagem segue a tabela f(tempo) e a DEGRADAÇÃO varia por dia', () => {
    const p = perfil({ diasDisponiveis: 4, tempoPorSessaoMin: 75, nivelExperiencia: 'intermediario' });
    const opc: OpcoesSemana = { semana: 5, feedbackGrupos: new Map() };
    const r = montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, undefined, opc);
    expect(r.split).toBe('Upper / Lower ×2');
    // v4: o nº de slots é limitado pela tabela do handoff (75 min → 7) — e um dia PODE
    // fechar menor quando os déficits do template acabam (o dia não é inflado p/ bater a
    // tabela; medido: o Lower A fecha em 6 com o teto dos acessórios respeitado).
    for (const d of r.dias) expect(d.slots.length, d.nome).toBeLessThanOrEqual(7);
    for (const d of r.dias) expect(d.slots.length, d.nome).toBeGreaterThanOrEqual(5);
    // …e o que varia POR DIA é a degradação: o dia que não cabe cede descanso, o que cabe
    // fica no topo da faixa. (Com um nível único para a semana, os dois seriam iguais.)
    const compostoDoDia = r.dias.map((d) => Math.max(...d.slots.filter((s) => !['isolado', 'core'].includes(s.padrao)).map((s) => s.descansoSeg ?? 0)));
    expect(new Set(compostoDoDia).size, `todos os dias com o mesmo descanso de composto: ${compostoDoDia}`).toBeGreaterThan(1);
  });
});

/**
 * 🟡 SONDAGEM — GUARDA DUPLA na rampa, registrada sem teste.
 *
 * "Remover o `semanaRampa != null ? 0 :` do montador" sobrevive, e não é buraco: o laço que
 * calcula `nivelDegradacaoDia` já tem `if (n < alvo && semanaRampa == null)`, então na rampa
 * o nível **nunca sai de 0**. São duas guardas para a mesma regra (o piso do FIT é
 * inviolável) e remover uma deixa a outra. Defense-in-depth deliberada — testar a redundância
 * seria placar. O que importa é o comportamento, e ele TEM teste: "na rampa com tempo curto,
 * ninguém desce do piso do FIT".
 */
