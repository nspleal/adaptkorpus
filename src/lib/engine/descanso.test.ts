import { describe, expect, it } from 'vitest';
import {
  DESCANSO_PISO_DURO_SEG, FAIXA_DESCANSO, FAIXA_FORCA_PESADA, classeDeDescanso,
  classificarComOrigem, descansoDoExercicio, descansoDoPadrao, deslocarPorRir, ehIsometrico, faixaDoExercicio, pisoFitDaRampa,
  rotuloDescanso, type ClasseDescanso,
} from './descanso';
import { EXERCISES } from '../data/exercises';
import { temCarga } from './equipamento';
import type { Exercise } from '../data/types';

/**
 * Descanso entre séries — spec travada no cofre §🕐 (DF 2026-07-31).
 * Números ancorados na spec, nunca no que o código devolve.
 */

const porId = (id: string): Exercise => {
  const e = EXERCISES.find((x) => x.id === id);
  if (!e) throw new Error(`exercício ${id} sumiu do seed`);
  return e;
};

describe('Bloco 1 — classe do exercício', () => {
  /** 🔒 Aceite 8: o fallback é INALCANÇÁVEL. Varre a biblioteca inteira. */
  it('os 163 mapeiam para uma classe conhecida, e a partição é 73/74/3/13', () => {
    const conta: Record<ClasseDescanso, number> = { COMPOSTO: 0, ISOLADO: 0, POTENCIA: 0, NAO_SE_APLICA: 0 };
    for (const e of EXERCISES) conta[classeDeDescanso(e)] += 1;
    expect(EXERCISES).toHaveLength(163);
    // Partição MEDIDA sobre o seed real (cofre §🕐), não estimada.
    expect(conta).toEqual({ COMPOSTO: 73, ISOLADO: 74, POTENCIA: 3, NAO_SE_APLICA: 13 });
    expect(conta.COMPOSTO + conta.ISOLADO + conta.POTENCIA + conta.NAO_SE_APLICA).toBe(163);
  });

  /**
   * 🔒 Aceite 8, a metade que faltava: o fallback é rede, NÃO caminho.
   *
   * Sem esta asserção o fallback é invisível — ele devolve COMPOSTO, a mesma resposta do
   * ramo legítimo. Trocar `dobradica_quadril` pelo literal errado `dobradica` (o defeito que
   * o cofre registrou) manda 16 exercícios para o fallback e a partição 73/74/3/13 **não
   * muda**: a mutação sobrevivia contando classes.
   */
  it('NENHUM exercício chega ao fallback', () => {
    const caidos = EXERCISES.filter((e) => classificarComOrigem(e).viaFallback).map((e) => `${e.id}/${e.padraoMovimento}`);
    expect(caidos, `caíram no fallback: ${caidos.join(', ')}`).toEqual([]);
  });

  it('e o detector de fallback FUNCIONA (não passa por vacuidade)', () => {
    // Padrão inventado → tem de acusar. Se este teste passar com o de cima quebrado,
    // o `viaFallback` está sempre false e não prova nada.
    // `as unknown as Exercise`: o padrão inventado não existe no union — é justamente o
    // ponto (simular dado fora do vocabulário, como um seed futuro traria).
    const inventado = { ...EXERCISES[0]!, padraoMovimento: 'padrao_que_nao_existe' } as unknown as Exercise;
    const r = classificarComOrigem(inventado);
    expect(r.viaFallback).toBe(true);
    expect(r.classe).toBe('COMPOSTO'); // a rede continua devolvendo o conservador
  });

  /**
   * 🔴 A armadilha do `e151`: Patinador é `padraoMovimento: 'cardio'` E `tipo: 'pliometrico'`.
   * `tipo` tem de ser consultado PRIMEIRO — senão ele cai em NAO_SE_APLICA e perde o descanso.
   */
  it('`tipo` vence `padraoMovimento`: o Patinador (e151) é POTÊNCIA, não cardio', () => {
    const e151 = porId('e151');
    expect(e151.padraoMovimento).toBe('cardio');
    expect(e151.tipo).toBe('pliometrico');
    expect(classeDeDescanso(e151)).toBe('POTENCIA');
    expect(descansoDoExercicio({ exercicio: e151, rirAlvo: 3 })).not.toBeNull();
  });

  it('os 3 pliométricos são POTÊNCIA (e143, e151, e163)', () => {
    const plio = EXERCISES.filter((e) => e.tipo === 'pliometrico').map((e) => e.id).sort();
    expect(plio).toEqual(['e143', 'e151', 'e163']);
    for (const id of plio) expect(classeDeDescanso(porId(id))).toBe('POTENCIA');
  });

  /** ⚠️ Literais reais do seed: `dobradica_quadril`, não `dobradica`. */
  it('`dobradica_quadril` é COMPOSTO (o literal errado cairia no fallback)', () => {
    const dobradicas = EXERCISES.filter((e) => e.padraoMovimento === 'dobradica_quadril');
    expect(dobradicas).toHaveLength(16);
    for (const e of dobradicas) {
      if (e.tipo === 'pliometrico') continue;
      expect(classeDeDescanso(e), e.id).toBe('COMPOSTO');
    }
  });

  /** 🔒 DF 2026-07-31: `core` é ACESSÓRIO. São os 18 que mudam de faixa. */
  it('`core` classifica como ISOLADO — o delta de 18 exercícios', () => {
    const core = EXERCISES.filter((e) => e.padraoMovimento === 'core');
    expect(core).toHaveLength(18);
    for (const e of core) expect(classeDeDescanso(e), e.id).toBe('ISOLADO');
  });

  it('cardio não recebe descanso entre séries (aceite 7)', () => {
    const cardio = EXERCISES.filter((e) => classeDeDescanso(e) === 'NAO_SE_APLICA');
    expect(cardio).toHaveLength(13);
    for (const e of cardio) {
      expect(faixaDoExercicio(e), e.id).toBeNull();
      expect(descansoDoExercicio({ exercicio: e, rirAlvo: 2 }), e.id).toBeNull();
    }
  });
});

describe('Bloco 1 — override modal de força pesada', () => {
  const compostoComCarga = EXERCISES.find((e) => classeDeDescanso(e) === 'COMPOSTO' && temCarga(e))!;
  const compostoSemCarga = EXERCISES.find((e) => classeDeDescanso(e) === 'COMPOSTO' && !temCarga(e))!;

  it('modo força + composto + carga → 180–300 s', () => {
    expect(faixaDoExercicio(compostoComCarga, true)).toEqual(FAIXA_FORCA_PESADA);
  });

  /** 🔒 Aceite 6: peso corporal NÃO entra na força pesada. */
  it('peso corporal com modo força ligado NÃO recebe a faixa pesada', () => {
    expect(compostoSemCarga).toBeDefined();
    expect(faixaDoExercicio(compostoSemCarga, true)).toEqual(FAIXA_DESCANSO.COMPOSTO);
  });

  it('modo força não afeta isolado nem potência', () => {
    const iso = EXERCISES.find((e) => classeDeDescanso(e) === 'ISOLADO' && temCarga(e))!;
    expect(faixaDoExercicio(iso, true)).toEqual(FAIXA_DESCANSO.ISOLADO);
    expect(faixaDoExercicio(porId('e143'), true)).toEqual(FAIXA_DESCANSO.POTENCIA);
  });
});

describe('Bloco 2 — deslocamento pelo RIR-alvo', () => {
  /** A tabela do handoff, verbatim. */
  it.each([
    ['COMPOSTO', FAIXA_DESCANSO.COMPOSTO, 120, 150, 180],
    ['ISOLADO', FAIXA_DESCANSO.ISOLADO, 60, 90, 120],
    ['POTENCIA', FAIXA_DESCANSO.POTENCIA, 120, 150, 180],
    ['FORÇA PESADA', FAIXA_FORCA_PESADA, 180, 240, 300],
  ] as const)('%s: RIR≥3 → %i · RIR 2 → %i · RIR≤1 → %i', (_n, faixa, piso, meio, topo) => {
    expect(deslocarPorRir(faixa, 4)).toBe(piso);
    expect(deslocarPorRir(faixa, 3)).toBe(piso);
    expect(deslocarPorRir(faixa, 2)).toBe(meio);
    expect(deslocarPorRir(faixa, 1)).toBe(topo);
    expect(deslocarPorRir(faixa, 0)).toBe(topo);
  });

  it('todo valor cai em passo de 30 s', () => {
    for (const faixa of [FAIXA_DESCANSO.COMPOSTO, FAIXA_DESCANSO.ISOLADO, FAIXA_FORCA_PESADA]) {
      for (const rir of [0, 1, 2, 3, 4]) expect(deslocarPorRir(faixa, rir) % 30).toBe(0);
    }
  });

  /** 🔒 Aceite 2: mesmo exercício, semana 1 (RIR 3) × semana 5 (RIR 1) → diferentes. */
  it('o mesmo exercício muda de descanso ao longo do mesociclo', () => {
    const ex = EXERCISES.find((e) => classeDeDescanso(e) === 'COMPOSTO')!;
    const sem1 = descansoDoExercicio({ exercicio: ex, rirAlvo: 3 });
    const sem5 = descansoDoExercicio({ exercicio: ex, rirAlvo: 1 });
    expect(sem1).toBe(120);
    expect(sem5).toBe(180);
    expect(sem1).not.toBe(sem5);
  });

  /** 🔒 Aceite 1: classes diferentes → descansos diferentes, com o MESMO RIR. */
  it('duas classes com o mesmo RIR recebem descansos diferentes', () => {
    const comp = EXERCISES.find((e) => classeDeDescanso(e) === 'COMPOSTO')!;
    const iso = EXERCISES.find((e) => classeDeDescanso(e) === 'ISOLADO')!;
    const a = descansoDoExercicio({ exercicio: comp, rirAlvo: 2 });
    const b = descansoDoExercicio({ exercicio: iso, rirAlvo: 2 });
    expect(a).toBe(150);
    expect(b).toBe(90);
    expect(a).not.toBe(b);
  });

  /** 🟢 O objetivo NUNCA encurta descanso — impossível por construção. */
  it('nenhum RIR produz valor abaixo do piso duro global', () => {
    for (const e of EXERCISES) {
      for (const rir of [0, 1, 2, 3, 4]) {
        const d = descansoDoExercicio({ exercicio: e, rirAlvo: rir });
        if (d != null) expect(d, `${e.id} rir=${rir}`).toBeGreaterThanOrEqual(DESCANSO_PISO_DURO_SEG);
      }
    }
  });
});

describe('Bloco 3 — precedência: o piso do FIT vence o deslocamento', () => {
  it('piso da rampa: 120 s na semana 1 · 90 s na semana 2', () => {
    expect(pisoFitDaRampa(1)).toBe(120);
    expect(pisoFitDaRampa(2)).toBe(90);
  });

  /**
   * 🔒 ACEITE 3 — o teste que prova que o FIT vence. Na rampa o RIR-alvo é 3, que pelo
   * deslocamento puxaria o ISOLADO para 60 s. Sem o `max()`, a rampa ENCURTA o descanso
   * exatamente na fase que existe para proteger.
   */
  it('ISOLADO na rampa semana 1 com RIR 3: ≥ 120 s, não 60 s', () => {
    const iso = EXERCISES.find((e) => classeDeDescanso(e) === 'ISOLADO')!;
    const semRampa = descansoDoExercicio({ exercicio: iso, rirAlvo: 3 });
    const naRampa = descansoDoExercicio({ exercicio: iso, rirAlvo: 3, semanaRampa: 1 });
    expect(semRampa).toBe(60);            // o que o deslocamento sozinho daria
    expect(naRampa).toBeGreaterThanOrEqual(120);
    expect(naRampa).toBe(120);            // o piso do FIT
  });

  it('ISOLADO na rampa semana 2 com RIR 3: ≥ 90 s', () => {
    const iso = EXERCISES.find((e) => classeDeDescanso(e) === 'ISOLADO')!;
    expect(descansoDoExercicio({ exercicio: iso, rirAlvo: 3, semanaRampa: 2 })).toBe(90);
  });

  it('o piso NÃO reduz quem já estava acima dele', () => {
    const comp = EXERCISES.find((e) => classeDeDescanso(e) === 'COMPOSTO')!;
    // Composto no topo = 180 s; o piso de 120 não pode puxar para baixo.
    expect(descansoDoExercicio({ exercicio: comp, rirAlvo: 1, semanaRampa: 1 })).toBe(180);
  });

  /**
   * 🔒 ACEITE 4 — a razão FIT explode em isométrico. "1:4 ≈ 120 s" foi derivado de série de
   * 8–12 reps (~30 s). Aplicada como RAZÃO à prancha de 60 s daria 240 s; aos 120 s do
   * avançado, 480 s. Hold usa o piso FIXO, igual a todo mundo.
   */
  it('prancha na rampa recebe o piso fixo (120 s), NUNCA 240 s', () => {
    const prancha = porId('e7');
    expect(ehIsometrico(prancha)).toBe(true);
    const d = descansoDoExercicio({ exercicio: prancha, rirAlvo: 3, semanaRampa: 1 });
    expect(d).toBe(120);
    expect(d).not.toBe(240);
    expect(d).toBeLessThan(240);
  });

  it('nenhum isométrico recebe mais que a faixa da classe ou o piso da rampa', () => {
    const isos = EXERCISES.filter(ehIsometrico);
    expect(isos).toHaveLength(5);
    for (const e of isos) {
      for (const semanaRampa of [null, 1, 2]) {
        const d = descansoDoExercicio({ exercicio: e, rirAlvo: 3, semanaRampa });
        expect(d, `${e.id} rampa=${semanaRampa}`).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe('rótulo humano', () => {
  it.each([
    [60, '1 min'], [90, '1 min 30'], [120, '2 min'], [150, '2 min 30'],
    [180, '3 min'], [240, '4 min'], [300, '5 min'], [45, '45 s'],
  ])('%i s → %s', (seg, txt) => {
    expect(rotuloDescanso(seg)).toBe(txt);
  });
});

/**
 * 🟡 SONDAGEM — o `DESCANSO_PISO_DURO_SEG` (60 s) é hoje INALCANÇÁVEL neste módulo.
 *
 * Baixá-lo para 30 não derruba nada, e a sondagem diz por quê: o menor valor que qualquer
 * faixa produz é `FAIXA_DESCANSO.ISOLADO.min`, que **já é 60**. O `Math.max` final nunca
 * muda o resultado — é rede, não caminho, exatamente como o `Math.max(1, …)` do `cap`.
 *
 * ⚠️ Esta conclusão EXPIRA no bloco seguinte da Leva B: a degradação por orçamento de tempo
 * "cede ISOLADO até 60 s", e é lá que o piso vira o limite operante. O teste que o prova
 * pertence ao montador, que é quem conhece a sessão inteira — não a este módulo puro.
 */

/* ══════ 1.3 / 1.4 — os pisos da degradação, por classe (correções de 2026-07-31) ══════ */

describe('🔴 1.3 — força pesada NÃO desce de 180 s ao degradar', () => {
  const supino = EXERCISES.find((e) => e.padraoMovimento === 'empurrar' && /Barra/.test(e.equipamentoDetalhe ?? ''))!;

  it('o caso existe: composto COM carga, em modo força, no topo da faixa', () => {
    expect(temCarga(supino), supino.nomePt).toBe(true);
    // RIR 1 → topo da FAIXA_FORCA_PESADA.
    expect(descansoDoExercicio({ exercicio: supino, rirAlvo: 1, modoForca: true })).toBe(300);
  });

  it('🔴 300 → 180 ao degradar, nunca 90 (era −70 %, o oposto da §5.7)', () => {
    const cheio = descansoDoExercicio({ exercicio: supino, rirAlvo: 1, modoForca: true })!;
    const degradado = descansoDoExercicio({ exercicio: supino, rirAlvo: 1, modoForca: true, degradacao: 2 })!;
    expect(cheio).toBe(300);
    expect(degradado, 'força pesada furou o piso de 3 min').toBe(180);
    expect(degradado / cheio, 'a queda passou de 40 %').toBeGreaterThanOrEqual(0.6);
    // E o orçamento (que só vê o padrão) tem de concordar — senão o `min` do montador
    // reintroduz o corte pelo outro lado.
    expect(descansoDoPadrao('empurrar', { rirAlvo: 1, modoForca: true, degradacao: 2 })).toBe(180);
  });

  it('composto SEM força pesada continua cedendo até 90 s', () => {
    const comp = EXERCISES.find((e) => classeDeDescanso(e) === 'COMPOSTO')!;
    expect(descansoDoExercicio({ exercicio: comp, rirAlvo: 1, degradacao: 2 })).toBe(90);
  });

  it('composto sem carga não vira força pesada nem com o modo ligado', () => {
    const semCarga = EXERCISES.find((e) => classeDeDescanso(e) === 'COMPOSTO' && !temCarga(e))!;
    expect(descansoDoExercicio({ exercicio: semCarga, rirAlvo: 1, modoForca: true, degradacao: 2 })).toBe(90);
  });
});

describe('🟡 1.4 — POTÊNCIA degrada junto com o composto (piso 90 s)', () => {
  /**
   * 🔒 `e151` Patinador é CASO-TESTE OBRIGATÓRIO de toda regra nova sobre a biblioteca
   * (regra do lote de correção). Ele já quebrou três: o remap anatômico, a ordem
   * `tipo` vence `padrao`, e o fallback de tipo. É `padraoMovimento: 'cardio'` com
   * `tipo: 'pliometrico'` — quem olha só o padrão não enxerga que ele é POTÊNCIA.
   */
  const e151 = EXERCISES.find((e) => e.id === 'e151')!;

  it('o e151 é mesmo o caso torto que o teste precisa', () => {
    expect(e151.nomePt).toMatch(/Patinador/);
    expect(e151.tipo).toBe('pliometrico');
    expect(e151.padraoMovimento).toBe('cardio');
    expect(classificarComOrigem(e151)).toEqual({ classe: 'POTENCIA', viaFallback: false });
  });

  it('degrada até 90 s — nem fica intacto, nem cai no piso do isolado', () => {
    expect(descansoDoExercicio({ exercicio: e151, rirAlvo: 1 })).toBe(180);
    expect(descansoDoExercicio({ exercicio: e151, rirAlvo: 1, degradacao: 1 }), 'cedeu no nível do ISOLADO').toBe(180);
    expect(descansoDoExercicio({ exercicio: e151, rirAlvo: 1, degradacao: 2 })).toBe(90);
    expect(descansoDoExercicio({ exercicio: e151, rirAlvo: 3, degradacao: 2 })).toBe(90);
  });

  it('e na RAMPA não degrada nunca — o piso do FIT é inviolável', () => {
    expect(descansoDoExercicio({ exercicio: e151, rirAlvo: 3, semanaRampa: 1, degradacao: 2 })).toBe(120);
  });

  it('ISOLADO cede já no nível 1; POTÊNCIA e COMPOSTO só no 2 (a ordem travada)', () => {
    const iso = EXERCISES.find((e) => classeDeDescanso(e) === 'ISOLADO')!;
    const comp = EXERCISES.find((e) => classeDeDescanso(e) === 'COMPOSTO')!;
    expect(descansoDoExercicio({ exercicio: iso, rirAlvo: 1, degradacao: 1 })).toBe(60);
    expect(descansoDoExercicio({ exercicio: comp, rirAlvo: 1, degradacao: 1 })).toBe(180);
    expect(descansoDoExercicio({ exercicio: e151, rirAlvo: 1, degradacao: 1 })).toBe(180);
  });
});
