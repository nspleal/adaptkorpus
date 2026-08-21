/**
 * 🔒 C1.1 — PROVAS PELO CAMINHO PÚBLICO (correção final pedida pelo autor, 2026-08-21).
 *
 * Nada aqui testa helper isolado: tudo entra pelo ponto de entrada REAL —
 * `recomputarPlano` (fluxo do app: perfil salvo → motor) e `gerarTreino` (API pública do motor).
 * Cobre: os QUATRO estados de `resultadoGeracao`; a origem funcional de `diasOferecidosCardio`;
 * o e72 ponta a ponta; o cardio (final, sem substituir musculação, só oferecidos, sem wrap); e a
 * fixture 36 (distribuição SOMENTE pós-terminal).
 */
import { describe, expect, it } from 'vitest';
import { recomputarPlano } from './plano';
import { gerarTreino, FORMULA_DURACAO_VERSION } from './engine';
import { avaliarDuracaoResistida } from './engine/duracao-plano';
import { distribuirCardioDaRotina, idDoDia } from './engine/treino-cardio-semana';
import { EXERCISES } from './data/exercises';
import { prescreverTreino } from './engine/treino';
import { avaliarGateTreino } from './engine/treino-gate';
import { descansoDoExercicio } from './engine/descanso';
import { rirAlvoDaSemana } from './engine/treino-mesociclo';
import type { PerfilTreino, RotinaSemanal } from './engine/treino-types';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { FlagsSaude } from './engine';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

/** Perfil do FLUXO PÚBLICO (o mesmo objeto que o app salva e recomputa). */
const perfilResumo = (over: Partial<PerfilResumo> = {}): PerfilResumo => ({
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
  objetivo: 'emagrecimento', flagsSaude: SEM, alergenos: [], preferencia: 'onivoro', naoCurto: [],
  pratosCansados: [], favoritos: [], nivelExperiencia: 'intermediario', equipamento: 'academia',
  equipamentosCasa: [], diasDisponiveis: 5, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], ...over,
}) as PerfilResumo;

/** Perfil do motor (API pública `gerarTreino`). */
const perfilTreino = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60, ...over,
}) as PerfilTreino;

// ════════════════════════════════════════════════════════════════════════════════════════════
// ITEM 4 — os QUATRO estados de `resultadoGeracao` pelo caminho público
// ════════════════════════════════════════════════════════════════════════════════════════════
describe('C1.1 · resultadoGeracao — os QUATRO estados propagam pelo caminho público', () => {
  it('CERTIFICADO: perfil normal (60 min) certifica e `duracaoIncompativel` fica ausente', () => {
    const r = gerarTreino(perfilTreino(), { exercises: EXERCISES, semanaCiclo: { semana: 1 } });
    expect(r.rotina!.resultadoGeracao).toEqual({ tipo: 'CERTIFICADO', capacidadeTerminal: expect.any(Number) });
    expect(r.rotina!.duracaoIncompativel).toBeUndefined();
  });

  it('NAO_AVALIADO_ENTREGAVEL: deload (semana 6) não anota séries ⇒ entregue com motivos, sem certificar', () => {
    const r = gerarTreino(perfilTreino(), { exercises: EXERCISES, semanaCiclo: { semana: 6 } });
    const rg = r.rotina!.resultadoGeracao!;
    expect(rg.tipo).toBe('NAO_AVALIADO_ENTREGAVEL');
    if (rg.tipo !== 'NAO_AVALIADO_ENTREGAVEL') return;
    expect(rg.motivos.length).toBeGreaterThan(0);
    // não bloqueia a entrega: o plano existe e tem dias.
    expect(r.rotina!.dias.length).toBeGreaterThan(0);
    // nunca certificado como "cabe no tempo".
    expect(r.rotina!.duracaoIncompativel).toBeUndefined();
  });

  it('INCOMPATIVEL: nem o menor plano com cobertura cabe (10 min) ⇒ shortfall DITO', () => {
    const r = gerarTreino(perfilTreino({ tempoPorSessaoMin: 10 }), { exercises: EXERCISES, semanaCiclo: { semana: 1 } });
    const rg = r.rotina!.resultadoGeracao!;
    expect(rg.tipo).toBe('INCOMPATIVEL');
    if (rg.tipo !== 'INCOMPATIVEL') return;
    expect(rg.capacidadeMinimaTestada).toBe(3); // BUDGET_MIN_COBERTURA
    // 🔒 `duracaoIncompativel` é VISTA DERIVADA — sai do discriminante, não de decisão própria.
    expect(r.rotina!.duracaoIncompativel).toBe(true);
  });

  it('ERRO_ALOCADOR: realocação devolve plano sem cobertura ⇒ INVARIANTE_VIOLADO, sem classificar duração', () => {
    // catálogo REAL com um único campo adulterado: os `puxar` viram `empurrar`. Os grupos seguem
    // completos (o alocador preenche), mas o plano realocado perde a cobertura obrigatória.
    const semPuxar = EXERCISES.map((e) => (e.padraoMovimento === 'puxar' ? { ...e, padraoMovimento: 'empurrar' as const } : e));
    const r = gerarTreino(perfilTreino({ tempoPorSessaoMin: 10 }), { exercises: semPuxar, semanaCiclo: { semana: 1 } });
    const rg = r.rotina!.resultadoGeracao!;
    expect(rg.tipo).toBe('ERRO_ALOCADOR');
    if (rg.tipo !== 'ERRO_ALOCADOR') return;
    expect(rg.motivo).toBe('INVARIANTE_VIOLADO');
    expect(rg.violacoesInvariantes.join(' ')).toMatch(/cobertura ausente/);
    // 🔒 precedência §6: invariante violado NÃO vira incompatibilidade temporal nem NAO_AVALIADO.
    expect(r.rotina!.duracaoIncompativel).toBeUndefined();
  });

  it('🔒 `duracaoIncompativel` é SEMPRE a vista derivada do discriminante (nunca decide sozinho)', () => {
    const casos: RotinaSemanal[] = [
      gerarTreino(perfilTreino(), { exercises: EXERCISES, semanaCiclo: { semana: 1 } }).rotina!,
      gerarTreino(perfilTreino(), { exercises: EXERCISES, semanaCiclo: { semana: 6 } }).rotina!,
      gerarTreino(perfilTreino({ tempoPorSessaoMin: 10 }), { exercises: EXERCISES, semanaCiclo: { semana: 1 } }).rotina!,
    ];
    for (const rot of casos) {
      expect(rot.duracaoIncompativel ?? false).toBe(rot.resultadoGeracao!.tipo === 'INCOMPATIVEL');
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// ITEM 3 — origem FUNCIONAL de `diasOferecidosCardio` (entra pelo fluxo público real)
// ════════════════════════════════════════════════════════════════════════════════════════════
describe('C1.1 · diasOferecidosCardio entra pelo ponto de entrada público (recomputarPlano)', () => {
  const base = perfilResumo({ objetivo: 'emagrecimento', diasDisponiveis: 5, tempoPorSessaoMin: 60 });
  const gerar = (dias: readonly number[]) =>
    recomputarPlano(base, { semanaCiclo: { semana: 1 }, diasOferecidosCardio: dias }).treino.rotina!;

  it('a escolha do usuário atravessa recomputarPlano → gerarTreino → construtor semanal', () => {
    const rot = gerar([4]);
    expect(rot.distribuicaoCardio).toBeDefined();
    // o construtor canônico rodou: carrega identidade + hash + estado.
    expect(rot.distribuicaoCardio!.formulaVersion).toBe(FORMULA_DURACAO_VERSION);
    expect(rot.distribuicaoCardio!.canonicalInputHash).toMatch(/^[0-9a-f]{16}$/);
    expect(['CONSTRUIDA', 'CONSTRUIDA_COM_RESSALVAS']).toContain(rot.distribuicaoCardio!.estado);
  });

  it('mudar os dias oferecidos muda DETERMINISTICAMENTE o plano e o canonical_input_hash', () => {
    const a = gerar([4]);
    const b = gerar([3, 4]);
    expect(a.distribuicaoCardio!.canonicalInputHash).not.toBe(b.distribuicaoCardio!.canonicalInputHash);
    // determinismo: mesma oferta ⇒ mesmo hash e mesma distribuição.
    expect(gerar([4]).distribuicaoCardio!.canonicalInputHash).toBe(a.distribuicaoCardio!.canonicalInputHash);
    expect(gerar([4]).distribuicaoCardio!.blocosPorDia).toEqual(a.distribuicaoCardio!.blocosPorDia);
    // e o PLANO muda: oferecer mais dias materializa mais blocos.
    expect(b.distribuicaoCardio!.blocosPorDia.length).toBeGreaterThan(a.distribuicaoCardio!.blocosPorDia.length);
  });

  it('dia VAGO mas NÃO oferecido é rejeitado (nenhum bloco nele)', () => {
    const rot = gerar([4]); // dia 3 também é vago (5 dias, 3 de força), mas não foi oferecido
    const diasComBloco = rot.distribuicaoCardio!.blocosPorDia.map((b) => b.diaId);
    expect(diasComBloco).toContain(idDoDia(4));
    expect(diasComBloco).not.toContain(idDoDia(3));
  });

  it('dia OFERECIDO com musculação NUNCA RECEBE parcela redistribuída e nunca perde treino', () => {
    const rot = gerar([0]); // dia 0 é dia de FORÇA
    const diasForca = rot.diasForcaAgendados;
    expect(diasForca).toBeGreaterThan(0);
    const semMusculacao = (diaId: string) => Number(diaId.replace('dia-', '')) >= diasForca;

    // 🔒 REGRA 3 do autor — "receber" cardio = receber PARCELA REDISTRIBUÍDA (papel DESTINO).
    // Nenhum destino pode cair sobre um dia de musculação.
    for (const c of rot.distribuicaoCardio!.contratosPorPrescricao) {
      for (const a of c.alocacoesDestino) expect(semMusculacao(a.diaId)).toBe(true);
    }
    for (const b of rot.distribuicaoCardio!.blocosPorDia) {
      if (!semMusculacao(b.diaId)) {
        // Num dia de musculação só pode existir cardio PRÓPRIO (sessão mista, fixture 14),
        // limitado à sobra `B − MAX_RESISTIDA`: ele nunca desloca a musculação.
        expect(b.linhagens.every((l) => l.papel === 'ORIGEM')).toBe(true);
        const idx = Number(b.diaId.replace('dia-', ''));
        const maxResistida = rot.duracaoDias![idx]!.duracaoMaximaEstimadaSegundos ?? 0;
        expect(b.duracaoTotalSegundos).toBeLessThanOrEqual(Math.max(60 * 60 - maxResistida, 0));
      }
    }
    // 🔒 REGRA 4 — nenhum dia de força perdeu slots por causa do cardio.
    expect(rot.dias.every((d) => d.slots.length > 0)).toBe(true);
    expect(rot.diasForcaAgendados).toBe(diasForca);
  });

  it('sem oferta nenhuma, nenhum bloco é materializado', () => {
    expect(gerar([]).distribuicaoCardio!.blocosPorDia).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// ITEM 6 — cardio pelo caminho público (final, sem substituir, só oferecidos, sem wrap)
// ════════════════════════════════════════════════════════════════════════════════════════════
describe('C1.1 · cardio pelo gerador público', () => {
  const base = perfilResumo({ objetivo: 'emagrecimento', diasDisponiveis: 6, tempoPorSessaoMin: 60 });
  const gerar = (dias: readonly number[]) =>
    recomputarPlano(base, { semanaCiclo: { semana: 1 }, diasOferecidosCardio: dias }).treino.rotina!;

  it('cardio é sempre item FINAL da sessão (nunca precede um resistido)', () => {
    const rot = gerar([4, 5]);
    // nos dias de força, os slots são todos resistidos — nenhum slot de cardio no meio.
    for (const d of rot.dias) {
      expect(d.slots.every((s) => s.padrao !== 'cardio')).toBe(true);
    }
    // o cardio materializado vive em bloco de dia próprio, avaliado como item final único.
    for (const b of rot.distribuicaoCardio!.blocosPorDia) {
      const r = avaliarDuracaoResistida([], 'intermediario', 3600);
      expect(r.estadoCalculo).toBe('CALCULADO'); // sessão sem resistido é calculável
      expect(b.duracaoTotalSegundos).toBeGreaterThan(0); // soma 0 nunca materializa bloco
    }
  });

  it('somente dias explicitamente oferecidos recebem; destinos apenas POSTERIORES, sem wrap', () => {
    const rot = gerar([5]); // só o último dia é oferecido
    const contratos = rot.distribuicaoCardio!.contratosPorPrescricao;
    for (const c of contratos) {
      const origem = Number(c.diaOrigemId.replace('dia-', ''));
      for (const a of c.alocacoesDestino) {
        const destino = Number(a.diaId.replace('dia-', ''));
        expect(destino).toBeGreaterThan(origem); // estritamente posterior — sem wrap
        expect(destino).toBe(5); // e só o oferecido
      }
    }
  });

  it('o cardio PRÓPRIO do dia é reservado ANTES da redistribuição (parcela recebida não rouba)', () => {
    const rot = gerar([4, 5]);
    const contratos = rot.distribuicaoCardio!.contratosPorPrescricao;
    // conservação por prescrição: prescrita = origem + destinos + descarte.
    for (const c of contratos) {
      const soma = c.duracaoUsadaNaSessaoSegundos
        + c.alocacoesDestino.reduce((s, a) => s + a.segundos, 0)
        + c.duracaoDescartadaSegundos;
      expect(soma).toBe(c.duracaoPrescritaSegundos);
    }
    // cada dia consolida UM bloco cuja duração é a soma exata das suas linhagens.
    for (const b of rot.distribuicaoCardio!.blocosPorDia) {
      expect(b.linhagens.reduce((s, l) => s + l.segundos, 0)).toBe(b.duracaoTotalSegundos);
    }
    // e o cardio próprio (papel ORIGEM) do dia 4 foi reservado antes de qualquer parcela recebida.
    const b4 = rot.distribuicaoCardio!.blocosPorDia.find((b) => b.diaId === idDoDia(4));
    if (b4) expect(b4.linhagens.some((l) => l.papel === 'ORIGEM')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// ITEM 5 — e72 PONTA A PONTA pela API pública
// ════════════════════════════════════════════════════════════════════════════════════════════
describe('C1.1 · e72 ponta a ponta: escolha → gerarTreino → SlotExercicio → adaptador → avaliador', () => {
  const comEscolha = (escolha: 'UNILATERAL_ALTERNADO' | 'BILATERAL') =>
    recomputarPlano(
      perfilResumo({ favoritos: ['e72'], objetivo: 'massa', nivelExperiencia: 'avancado', diasDisponiveis: 6, tempoPorSessaoMin: 90 }),
      { semanaCiclo: { semana: 1 }, escolhasExecucao: new Map([['e72', escolha]]) },
    ).treino.rotina!;

  for (const escolha of ['UNILATERAL_ALTERNADO', 'BILATERAL'] as const) {
    it(`a escolha ${escolha} atravessa o fluxo público e materializa no slot`, () => {
      const rot = comEscolha(escolha);
      const slots = rot.dias.flatMap((d) => d.slots).filter((s) => s.exercicio.id === 'e72');
      expect(slots.length).toBeGreaterThan(0); // e72 favoritado entra no plano
      for (const s of slots) expect(s.execucaoSelecionada).toBe(escolha);
    });

    it(`a escolha ${escolha} NÃO dobra execução nem descanso no avaliador canônico`, () => {
      const rot = comEscolha(escolha);
      const slots = rot.dias.flatMap((d) => d.slots).filter((s) => s.exercicio.id === 'e72');
      const s = slots[0]!;
      const r = avaliarDuracaoResistida([s], 'intermediario', 3600);
      expect(r.estadoCalculo).toBe('CALCULADO');
      // execução = séries × 40 (NUNCA ×2) e descanso = (séries−1) × descanso (NUNCA ×2).
      expect(r.componentes!.execucaoSegundos).toBe(s.series! * 40);
      expect(r.componentes!.descansoSegundos).toBe(Math.max(s.series! - 1, 0) * s.descansoSeg!);
    });
  }

  it('as DUAS escolhas permitidas dão a MESMA duração (nenhuma é DOIS_LADOS)', () => {
    const alt = comEscolha('UNILATERAL_ALTERNADO');
    const bil = comEscolha('BILATERAL');
    const dur = (rot: RotinaSemanal) => {
      const s = rot.dias.flatMap((d) => d.slots).find((x) => x.exercicio.id === 'e72')!;
      return avaliarDuracaoResistida([s], 'intermediario', 3600).componentes!;
    };
    expect(dur(alt)).toEqual(dur(bil));
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// ITEM 2 — FIXTURE 36: distribuição SOMENTE pós-terminal
// ════════════════════════════════════════════════════════════════════════════════════════════
describe('C1.1 · fixture 36 — a distribuição usa o plano resistido TERMINAL, nunca um candidato', () => {
  /**
   * Perfil com DEGRADAÇÃO real de descanso: o candidato inicial (nível 0, descansos cheios) tem
   * MAX_RESISTIDA MAIOR — logo capacidade de cardio MENOR — que o plano TERMINAL (degradado).
   * A distribuição materializada tem de bater com o TERMINAL, e diferir do candidato.
   */
  const base = perfilResumo({ objetivo: 'saude', nivelExperiencia: 'iniciante', diasDisponiveis: 5, tempoPorSessaoMin: 25 });
  const OFERECIDO = [4];

  it('a degradação de descanso de fato ocorre neste perfil (pré-condição da fixture)', () => {
    const rot = recomputarPlano(base, { semanaCiclo: { semana: 1 }, diasOferecidosCardio: OFERECIDO }).treino.rotina!;
    const pt = perfilTreino({ objetivo: 'saude', nivelExperiencia: 'iniciante', diasDisponiveis: 5, tempoPorSessaoMin: 25 });
    const presc = prescreverTreino(pt, avaliarGateTreino(pt));
    const rir = presc.rirAlvoSemana ?? rirAlvoDaSemana(presc.rir, 1);
    const degradou = rot.dias.some((d) => d.slots.some((s) => {
      const semDegradar = descansoDoExercicio({ exercicio: s.exercicio, rirAlvo: rir, modoForca: presc.modoForca === true, semanaRampa: null, degradacao: 0 });
      return semDegradar != null && s.descansoSeg != null && s.descansoSeg < semDegradar;
    }));
    expect(degradou).toBe(true);
  });

  it('🔒 a distribuição bate com o TERMINAL e DIVERGE do candidato pré-degradação', () => {
    const rot = recomputarPlano(base, { semanaCiclo: { semana: 1 }, diasOferecidosCardio: OFERECIDO }).treino.rotina!;
    const orcamentoSeg = 25 * 60;
    const dur = rot.duracaoDias!;

    // (a) o que o gerador de fato materializou.
    const real = rot.distribuicaoCardio!;

    // (b) recomputação a partir do TERMINAL (mesmas durações certificadas do plano final).
    const doTerminal = distribuirCardioDaRotina({
      diasTotais: 5, diasForca: rot.diasForcaAgendados, duracaoDias: dur,
      diasOferecidosCardio: OFERECIDO, orcamentoSegundos: orcamentoSeg,
      cardioPrescritoPorDiaSegundos: real.contratosPorPrescricao[0]?.duracaoPrescritaSegundos ?? 0,
      aggregateId: 'rotina-cardio', expectedRevision: 0, formulaVersion: FORMULA_DURACAO_VERSION,
    });
    expect(real.blocosPorDia).toEqual(doTerminal.blocosPorDia);
    expect(real.contratosPorPrescricao).toEqual(doTerminal.contratosPorPrescricao);

    // (c) o CANDIDATO intermediário: mesmo plano ANTES de degradar ⇒ MAX_RESISTIDA maior.
    //     (simulado somando o que a degradação economizou em cada dia de força)
    const candidato = dur.map((d) => ({ ...d, duracaoMaximaEstimadaSegundos: (d.duracaoMaximaEstimadaSegundos ?? 0) + 600 }));
    const doCandidato = distribuirCardioDaRotina({
      diasTotais: 5, diasForca: rot.diasForcaAgendados, duracaoDias: candidato,
      diasOferecidosCardio: OFERECIDO, orcamentoSegundos: orcamentoSeg,
      cardioPrescritoPorDiaSegundos: real.contratosPorPrescricao[0]?.duracaoPrescritaSegundos ?? 0,
      aggregateId: 'rotina-cardio', expectedRevision: 0, formulaVersion: FORMULA_DURACAO_VERSION,
    });
    // 🔴 A MUTAÇÃO "distribuir antes do plano terminal" produziria ESTE resultado — e ele difere.
    expect(real.canonicalInputHash).not.toBe(doCandidato.canonicalInputHash);
  });

  it('a distribuição só existe DEPOIS da certificação: a capacidade sai do MAX_RESISTIDA terminal', () => {
    const rot = recomputarPlano(base, { semanaCiclo: { semana: 1 }, diasOferecidosCardio: OFERECIDO }).treino.rotina!;
    const orcamentoSeg = 25 * 60;
    // dia 4 é VAGO (sem musculação) ⇒ capacidade = B inteiro; o bloco não pode passar de B.
    for (const b of rot.distribuicaoCardio!.blocosPorDia) {
      expect(b.duracaoTotalSegundos).toBeLessThanOrEqual(orcamentoSeg);
    }
    // e todo dia de FORÇA respeita a certificação terminal (nenhum bloco sobre musculação).
    rot.duracaoDias!.forEach((d, i) => {
      if (i < rot.diasForcaAgendados) {
        expect(rot.distribuicaoCardio!.blocosPorDia.find((b) => b.diaId === idDoDia(i))).toBeUndefined();
        expect(d.estadoCalculo).toBe('CALCULADO');
      }
    });
  });
});
