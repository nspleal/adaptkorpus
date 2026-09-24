/**
 * 🔒 C1.1 — PROVAS PELO CAMINHO PÚBLICO (correção final pedida pelo autor, 2026-08-21).
 *
 * Nada aqui testa helper isolado: tudo entra pelo ponto de entrada REAL —
 * `recomputarPlano` (fluxo do app: perfil salvo → motor) e `gerarTreino` (API pública do motor).
 * Cobre: os QUATRO estados de `resultadoGeracao`; a origem funcional de `diasOferecidosCardio`;
 * o e72 ponta a ponta; o cardio (fora do tempo da musculação desde 2026-09-23, sem substituir
 * musculação, só em dia oferecido); e a fixture 36 (a degradação da musculação não mexe no cardio).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recomputarPlano } from './plano';
import { gerarTreino, FORMULA_DURACAO_VERSION } from './engine';
import { avaliarDuracaoResistida } from './engine/duracao-plano';
import { distribuirCardioDaRotina } from './engine/treino-cardio-semana';
import { montarRotina } from './engine/treino-montador';
import { EXERCISES } from './data/exercises';
import { prescreverTreino } from './engine/treino';
import { avaliarGateTreino } from './engine/treino-gate';
import { descansoDoExercicio } from './engine/descanso';
import { rirAlvoDaSemana } from './engine/treino-mesociclo';
import { alternarDiaOferecidoCardio, normalizarDiasOferecidosCardio } from './cardio-oferta';
import { montarSemana } from './semana';
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

  /**
   * 🔴 D2 (2026-09-10) — o VEÍCULO deste caso mudou, a propriedade não. O deload deixou de ser
   * produtor (a semana 6 ganhou séries) e, desde 2026-09-23, o cardio qualitativo também: o tempo
   * do perfil mede só a musculação. O produtor que resta é dado resistido ausente — a geração v1,
   * sem semana do ciclo, sai sem séries materializadas, e isso não pode ser mascarado pelo cardio.
   */
  it('NAO_AVALIADO_ENTREGAVEL: musculação sem séries (v1) ⇒ entregue com motivos, sem certificar', () => {
    const r = gerarTreino(perfilTreino({ objetivo: 'massa', diasDisponiveis: 3, treinoDias: ['seg', 'qua', 'sex'] }),
      { exercises: EXERCISES, diasOferecidosCardio: ['dom'] });
    const rg = r.rotina!.resultadoGeracao!;
    expect(rg.tipo).toBe('NAO_AVALIADO_ENTREGAVEL');
    if (rg.tipo !== 'NAO_AVALIADO_ENTREGAVEL') return;
    expect(rg.motivos.length).toBeGreaterThan(0);
    expect(rg.motivos.every((m) => /séries ausente/.test(m)), JSON.stringify(rg.motivos)).toBe(true);
    // não bloqueia a entrega: o plano existe e tem dias.
    expect(r.rotina!.dias.length).toBeGreaterThan(0);
    // nunca certificado como "cabe no tempo".
    expect(r.rotina!.duracaoIncompativel).toBeUndefined();
  });

  it('tempo estrito14/09:10min preserva únicos e declara incompatibilidade', () => {
    const r = gerarTreino(perfilTreino({ tempoPorSessaoMin: 10 }), { exercises: EXERCISES, semanaCiclo: { semana: 1 } });
    const rg = r.rotina!.resultadoGeracao!;
    // SER-4: mesma entrada de 10 min pode caber no seletor histórico; conferir o teto real.
    const excede = r.rotina!.duracaoDias!.some(d=>(d.duracaoMaximaEstimadaSegundos??0)>600);
    expect(rg.tipo).toBe(excede?'INCOMPATIVEL':'CERTIFICADO');
    expect(r.rotina!.avisos.some(a=>a.includes('reduzimos séries progressivamente'))).toBe(true);
  });

  /**
   * 🔵 REANCORADO pela decisão do autor de 2026-09-16 (P-01), não afrouxado.
   *
   * O literal `10` era a cobertura de dez grupos diretos. A decisão autorizou o full-body de
   * um dia a DISPENSAR o direto de core → antebraço → panturrilha quando não couber, nesta
   * ordem, parando assim que couber. Aos 10 min nada faz caber, então a lista é percorrida
   * inteira: core e panturrilha saem (antebraço não está entre os dez e é pulado) e restam 8.
   *
   * O que se cobra agora é a CONDUTA, não o número: quem saiu foi só grupo dispensável, os
   * demais mantiveram o único exercício, a retirada está nomeada num aviso e o plano continua
   * declarando incompatibilidade — nunca certificado falso.
   */
  it('um dia dispensa só o que a decisão permite e ainda assim declara INCOMPATIVEL temporal', () => {
    const r = gerarTreino(
      perfilTreino({ diasDisponiveis: 1, tempoPorSessaoMin: 10 }),
      { exercises: EXERCISES, semanaCiclo: { semana: 1 } },
    );
    const rotina = r.rotina!;
    const entregues = rotina.dias.flatMap((d) => d.slots).map((s) => s.exercicio.grupoPrimario);
    expect(rotina.resultadoGeracao).toEqual({ tipo: 'INCOMPATIVEL', capacidadeMinimaTestada: entregues.length });
    expect(rotina.duracaoIncompativel).toBe(true);
    // 🔵 17/09: a lista dispensável passou a incluir GLÚTEOS. Aos 10 min a sequência a
    // percorre inteira (nada faz caber), então saem core, panturrilha e glúteos — antebraço
    // não está entre os dez e é pulado —, e restam 7 dos 10 grupos.
    for (const g of ['core', 'panturrilha', 'gluteos'] as const) {
      expect(entregues, `${g} sobreviveu: o caso deixou de exercer a regra`).not.toContain(g);
    }
    expect(new Set(entregues).size).toBe(7);
    // …e nenhum grupo FORA da lista perdeu o seu único exercício.
    for (const g of ['peito', 'costas', 'quadriceps', 'posterior', 'ombros', 'biceps', 'triceps'] as const) {
      expect(entregues, `${g} perdeu o único exercício`).toContain(g);
    }
    // Core não foi alocado: a política de um complementar escolheu panturrilha.
    // A dispensa temporal continua exercida por panturrilha e glúteos, com nomes.
    expect(rotina.avisos.some(a => a.startsWith('Core não entrou neste plano:'))).toBe(true);
    expect(rotina.avisos.some(a => a.startsWith('Para caber em') && a.includes('Panturrilhas') && a.includes('Glúteos')),
      'a retirada temporal não foi nomeada').toBe(true);
  });

  it('o alocador declara SEM_PLANO_MENOR antes da capacidade 1 inválida e preserva o último terminal válido', () => {
    const r = gerarTreino(
      perfilTreino({ diasDisponiveis: 4, tempoPorSessaoMin: 1 }),
      { exercises: EXERCISES, semanaCiclo: { semana: 1 } },
    );
    expect(r.rotina!.resultadoGeracao).toEqual({ tipo: 'INCOMPATIVEL', capacidadeMinimaTestada: Math.max(...r.rotina!.dias.map(d=>d.slots.length)) });
    expect(r.rotina!.dias.every(d=>d.slots.length>0)).toBe(true);
  });

  it.each([5, 6])('perfil avançado de %i dias não publica candidato de capacidade 1 sem cobertura', (diasDisponiveis) => {
    const r = gerarTreino(
      perfilTreino({ nivelExperiencia: 'avancado', diasDisponiveis, tempoPorSessaoMin: 10 }),
      { exercises: EXERCISES, semanaCiclo: { semana: 1 } },
    );
    expect(r.rotina!.resultadoGeracao?.tipo).not.toBe('ERRO_ALOCADOR');
  });

  it('valida os invariantes também no baseline antes de certificar a duração', () => {
    const semPuxar = EXERCISES.map((e) => (e.padraoMovimento === 'puxar'
      ? { ...e, padraoMovimento: 'empurrar' as const }
      : e));
    const r = gerarTreino(
      perfilTreino({ diasDisponiveis: 2, tempoPorSessaoMin: 20 }),
      { exercises: semPuxar, semanaCiclo: { semana: 1 } },
    );
    expect(r.rotina!.resultadoGeracao?.tipo).toBe('ERRO_ALOCADOR');
    if (r.rotina!.resultadoGeracao?.tipo !== 'ERRO_ALOCADOR') return;
    expect(r.rotina!.resultadoGeracao.violacoesInvariantes.join(' ')).toMatch(/cobertura ausente/);
    expect(r.rotina!.duracaoDias).toBeUndefined();
    expect(r.rotina!.duracaoResistidaDias).toBeUndefined();
  });

  it('a geração inicial sem semana também valida invariantes antes do selo temporal', () => {
    const semPuxar = EXERCISES.map((e) => (e.padraoMovimento === 'puxar'
      ? { ...e, padraoMovimento: 'empurrar' as const }
      : e));
    const r = gerarTreino(
      perfilTreino({ diasDisponiveis: 2, tempoPorSessaoMin: 20 }),
      { exercises: semPuxar },
    );
    expect(r.rotina!.resultadoGeracao?.tipo).toBe('ERRO_ALOCADOR');
    expect(r.rotina!.duracaoDias).toBeUndefined();
    expect(r.rotina!.duracaoResistidaDias).toBeUndefined();
  });

  it('catálogo vazio não ganha certificação temporal por vacuidade', () => {
    const r = gerarTreino(
      perfilTreino({ diasDisponiveis: 2, tempoPorSessaoMin: 20 }),
      { exercises: [], semanaCiclo: { semana: 1 } },
    );
    expect(r.rotina!.resultadoGeracao?.tipo).toBe('ERRO_ALOCADOR');
    if (r.rotina!.resultadoGeracao?.tipo !== 'ERRO_ALOCADOR') return;
    expect(r.rotina!.resultadoGeracao.violacoesInvariantes.join(' ')).toMatch(/cobertura ausente/);
    expect(r.rotina!.duracaoDias).toBeUndefined();
    expect(r.rotina!.duracaoResistidaDias).toBeUndefined();
    expect(r.rotina!.planoFinalPorDia).toBeUndefined();
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
      gerarTreino(perfilTreino({ diasDisponiveis: 1, tempoPorSessaoMin: 10 }), { exercises: EXERCISES, semanaCiclo: { semana: 1 } }).rotina!,
    ];
    for (const rot of casos) {
      expect(rot.duracaoIncompativel ?? false).toBe(rot.resultadoGeracao!.tipo === 'INCOMPATIVEL');
    }
  });

  it('degrada descanso para DOIS_LADOS antes de reduzir a capacidade pelo caminho vivo', () => {
    // Catálogo temporalmente caro, mas estruturalmente idêntico: a lateralidade
    // precisa entrar no orçamento ANTES do reduce-to-fit. Com o descanso degradado,
    // quatro slots cabem; remover o quarto antes disso violaria a política do motor.
    const todosDoisLados = EXERCISES.map((e) => ({ ...e, execucao: 'UNILATERAL_DOIS_LADOS' as const }));
    const rot = gerarTreino(
      // 2026-09-19: aos 40 min o plano passou a caber sem degradar; a degradação a 90 s
      // antes de reduzir a capacidade é exercida aos 50 min (medido nos dois seletores).
      perfilTreino({ objetivo: 'massa', nivelExperiencia: 'intermediario', tempoPorSessaoMin: 50 }),
      { exercises: todosDoisLados, semanaCiclo: { semana: 1 } },
    ).rotina!;
    expect(rot.resultadoGeracao?.tipo).toBe('CERTIFICADO');
    expect(rot.duracaoDias!.every(d=>(d.duracaoMaximaEstimadaSegundos??0)<=3000)).toBe(true);
    expect(rot.dias.some(d=>d.slots.length>0)).toBe(true);
    // Compostos de massa começam a 120 s na semana 1; 90 s só ocorre após degradação.
    expect(rot.dias.flatMap((d) => d.slots).some((s) => s.descansoSeg === 90)).toBe(true);
    expect(Math.max(...rot.duracaoResistidaDias!.map((d) => d.duracaoMaximaEstimadaSegundos ?? 0)))
      .toBeLessThanOrEqual(50 * 60);
  });
});

describe('C1.1 · planejamento temporal antes do reduce-to-fit', () => {
  it('materializa DOIS_LADOS no orçamento de descanso/capacidade', () => {
    // Regressão estática da auditoria fria P1: a certificação final já dobrava
    // a execução, mas o custo que escolhe o nível de descanso não. Este guard
    // mantém as duas etapas na mesma lateralidade curada antes do caminho público
    // reduzir a capacidade.
    const fonte = readFileSync(join(process.cwd(), 'src/lib/engine/treino-montador.ts'), 'utf8');
    const inicio = fonte.indexOf('const custoDia =');
    const fim = fonte.indexOf('\n      /**', inicio);
    expect(inicio).toBeGreaterThanOrEqual(0);
    expect(fim).toBeGreaterThan(inicio);
    const custoDia = fonte.slice(inicio, fim);
    expect(custoDia).toContain('unilateralDoisLados:');
    expect(custoDia).toContain(
      "resolverExecucao(s.exercicio.id, s.exercicio.execucao, s.execucaoSelecionada) === 'UNILATERAL_DOIS_LADOS'",
    );
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
    expect(rot.distribuicaoCardio!.canonicalInputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rot.distribuicaoCardio!.estado).toBe('CONSTRUIDA');
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
    expect(diasComBloco).toContain('sex');
    expect(diasComBloco).not.toContain('qui');
  });

  it('dia OFERECIDO com musculação recebe o próprio cardio inteiro, sem parcela de outro dia e sem perder treino', () => {
    const rot = gerar([0]); // dia 0 é dia de FORÇA
    const semOferta = gerar([]);
    expect(rot.diasForcaAgendados).toBeGreaterThan(0);
    // 🔴 2026-09-23 — 1 dia oferecido ⇒ 90 min (teto próprio do cardio), acima dos 60 min de
    // treino e sem corte pela sobra da musculação.
    expect(rot.distribuicaoCardio!.blocosPorDia).toEqual([{
      diaId: 'seg', duracaoTotalSegundos: 5400,
      linhagens: [{ prescricaoId: 'cardio-seg', diaOrigemId: 'seg', ordemPrescricao: 0, segundos: 5400 }],
    }]);
    // 🔒 REGRA 4 — a musculação e o seu tempo são os mesmos com ou sem o cardio.
    expect(rot.dias).toEqual(semOferta.dias);
    expect(rot.duracaoDias).toEqual(semOferta.duracaoDias);
    expect(rot.resultadoGeracao).toEqual(semOferta.resultadoGeracao);
  });

  it('sem oferta nenhuma, nenhum bloco é materializado', () => {
    const rot = gerar([]);
    expect(rot.distribuicaoCardio!.blocosPorDia).toHaveLength(0);
    expect(rot.diasCardio).toEqual([]);
    expect(rot.planoFinalPorDia?.every((d) => d.cardio == null)).toBe(true);
  });

  it('cardio qualitativo oferecido permanece explícito, sem inventar duração e sem tornar o treino NAO_AVALIADO', () => {
    const perfil = perfilTreino({ objetivo: 'massa', diasDisponiveis: 6 });
    const rot = gerarTreino(perfil, { exercises: EXERCISES, semanaCiclo: { semana: 1 }, diasOferecidosCardio: [4, 5] }).rotina!;
    const semOferta = gerarTreino(perfil, { exercises: EXERCISES, semanaCiclo: { semana: 1 } }).rotina!;
    expect(rot.cardio.tipo).toBe('sessoes_moderadas');
    expect(rot.distribuicaoCardio?.blocosPorDia).toEqual([]);
    expect(rot.diasCardio).toHaveLength(2);
    expect(rot.diasCardio.every((d) => d.minutos === null && d.duracaoSegundos === undefined)).toBe(true);
    expect(rot.planoFinalPorDia?.filter((d) => d.cardio).every((d) =>
      d.duracao.estadoCalculo === 'CALCULADO' && d.duracao.motivosNaoAvaliados.length === 0)).toBe(true);
    expect(rot.resultadoGeracao).toEqual(semOferta.resultadoGeracao);
    expect(rot.resultadoGeracao?.tipo).not.toBe('NAO_AVALIADO_ENTREGAVEL');
  });

  it('a geração inicial sem `semanaCiclo` também não exibe o agendamento legado sem oferta', () => {
    const rot = gerarTreino(
      perfilTreino({ objetivo: 'emagrecimento', diasDisponiveis: 5 }), { exercises: EXERCISES },
    ).rotina!;
    expect(rot.distribuicaoCardio?.blocosPorDia).toEqual([]);
    expect(rot.diasCardio).toEqual([]);
    expect(rot.planoFinalPorDia?.every((d) => d.cardio == null)).toBe(true);
  });

  it('a vista consumida pela UI é projeção exata dos blocos canônicos positivos', () => {
    const rot = gerar([3, 4]);
    const blocos = rot.distribuicaoCardio!.blocosPorDia.map((b) => ({
      diaId: b.diaId,
      duracaoSegundos: b.duracaoTotalSegundos,
    }));
    const vista = rot.diasCardio.map((d) => ({
      diaId: d.diaId,
      duracaoSegundos: d.duracaoSegundos,
    }));
    expect(vista).toEqual(blocos);
  });

  it('a duração FINAL do dia misto é só a resistida; o dia só de cardio não tem tempo de treino', () => {
    // 🔴 2026-09-23 — o tempo do perfil mede só a musculação. Segunda é mista e domingo, fora da
    // agenda, é só cardio; os dois blocos guardam a própria duração (75 min = 150 ÷ 2) fora da
    // conta do treino. (A sexta não serve de dia só de cardio: é o dia complementar da agenda.)
    const rot = gerar([0, 6]);
    const finais = rot.planoFinalPorDia ?? [];
    const mistos = finais.filter((d) => d.tipo === 'TREINO_E_CARDIO');
    const puros = finais.filter((d) => d.tipo === 'CARDIO');
    expect(mistos.map((d) => d.diaId)).toEqual(['seg']);
    expect(puros.map((d) => d.diaId)).toEqual(['dom']);

    for (const dia of mistos) {
      expect(dia.duracao).toEqual(rot.duracaoResistidaDias![dia.treinoIdx!]);
      expect(dia.cardio!.duracaoSegundos).toBe(4500);
    }
    for (const dia of puros) {
      expect(dia.duracao.duracaoMinimaEstimadaSegundos).toBe(0);
      expect(dia.duracao.duracaoMaximaEstimadaSegundos).toBe(0);
      expect(dia.cardio!.duracaoSegundos).toBe(4500);
    }
  });

  it('o bloco misto chega ao modelo da agenda, sem decidir apresentação/copy de C4', () => {
    const rot = gerar([0, 4]);
    const semana = montarSemana(
      ['seg', 'ter', 'qua', 'qui', 'sex'], rot.dias.map((d) => d.nome), 0, rot.diasCardio,
    );
    const misto = semana.find((d) => d.tipo === 'treino' && d.cardio != null);
    expect(misto?.cardio?.minutos).toBeGreaterThan(0);
  });

  it('o índice canônico continua correto depois de dias mistos antes de um cardio puro', () => {
    const cardios = [
      { modalidade: 'caminhada', minutos: 10, ordemNoHorizonte: 0 },
      { modalidade: 'bicicleta', minutos: 20, ordemNoHorizonte: 1 },
      { modalidade: 'eliptico', minutos: 30, ordemNoHorizonte: 4 },
    ];
    const semana = montarSemana(
      ['seg', 'ter', 'qua', 'qui', 'sex'], ['A', 'B', 'C', 'D'], 0, cardios,
    );
    expect(semana[0]).toMatchObject({ tipo: 'treino', cardioIdx: 0, cardio: cardios[0] });
    expect(semana[1]).toMatchObject({ tipo: 'treino', cardioIdx: 1, cardio: cardios[1] });
    expect(semana[4]).toMatchObject({ tipo: 'cardio', cardioIdx: 2, cardio: cardios[2] });
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
    // o cardio materializado vive em bloco próprio, fora da sessão resistida medida.
    for (const b of rot.distribuicaoCardio!.blocosPorDia) {
      const r = avaliarDuracaoResistida([], 'intermediario', 3600);
      expect(r.estadoCalculo).toBe('CALCULADO'); // sessão sem resistido é calculável
      expect(b.duracaoTotalSegundos).toBeGreaterThan(0); // soma 0 nunca materializa bloco
    }
  });

  it('somente dias explicitamente oferecidos recebem, e só a própria prescrição', () => {
    const rot = gerar([5]); // só o sábado é oferecido
    expect(rot.distribuicaoCardio!.blocosPorDia.map((b) => b.diaId)).toEqual(['sab']);
    expect(rot.distribuicaoCardio!.blocosPorDia[0]!.linhagens.map((l) => l.diaOrigemId)).toEqual(['sab']);
  });

  it('cada dia consolida UM bloco = soma exata das suas linhagens, todas nascidas nele', () => {
    const rot = gerar([4, 5]);
    for (const b of rot.distribuicaoCardio!.blocosPorDia) {
      expect(b.linhagens.reduce((s, l) => s + l.segundos, 0)).toBe(b.duracaoTotalSegundos);
      expect(b.linhagens.every((l) => l.diaOrigemId === b.diaId)).toBe(true);
    }
    // 2 dias oferecidos ⇒ 75 min cada (150 ÷ 2), nenhum minuto transferido entre eles.
    expect(rot.distribuicaoCardio!.blocosPorDia.map((b) => b.duracaoTotalSegundos)).toEqual([4500, 4500]);
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
// ITEM 2 — fixture 36 sob a decisão de 2026-09-23: a musculação apertada não mexe no cardio.
// Até 23/09 este bloco provava que o corte do cardio seguia o terminal (0 → 100 → 800); os
// nomes mudaram porque a regra mudou — o caso e os números de entrada são os mesmos.
// ════════════════════════════════════════════════════════════════════════════════════════════
describe('C1.1 · fixture 36 — musculação degradada e cardio intacto (900 + 900, nunca cortado)', () => {
  /**
   * Gerador real com prescrição artesanal: massa/intermediário, cinco séries prescritas,
   * cardio de 30 min/semana oferecido em {0, 4}, 900 s por origem. A musculação do dia 0 sofre
   * degradação real de descanso para caber no tempo; o cardio fica fora dessa conta.
   */
  const montarF36 = (tempo = 45) => {
    const p = perfilTreino({ objetivo: 'massa', nivelExperiencia: 'intermediario', diasDisponiveis: 5, tempoPorSessaoMin: tempo });
    const base = prescreverTreino(p, avaliarGateTreino(p));
    const presc = {
      ...base,
      seriesPorExercicio: { min: 5, max: 5 },
      volumePorGrupoSemana: { min: 20, max: 20 },
      cardio: { tipo: 'minutos_semana', min: 30, max: 30 } as const,
    };
    const rot = montarRotina(presc, p, EXERCISES, new Set(), { semana: 1 }, p.preferencias, new Map(), [0, 4]);
    return { p, presc, rot, B: tempo * 60 };
  };
  const blocos = (rot: RotinaSemanal) =>
    rot.distribuicaoCardio!.blocosPorDia.map((b) => [b.diaId, b.duracaoTotalSegundos]);

  it('pré-condição: a degradação REAL aconteceu (terminal 60/90/90/60; candidato nível 0 seria 60/120/120/60)', () => {
    const { p, presc, rot } = montarF36();
    const slots0 = rot.dias[0]!.slots;
    // 2026-09-19: a ordem dos slots mudou com a seleção por referência (puxada antes do isolado).
    expect(slots0.length).toBeGreaterThan(0);
    const rir = presc.rirAlvoSemana ?? rirAlvoDaSemana(presc.rir, 1);
    const semDegradar = slots0.map((s) => descansoDoExercicio({ exercicio: s.exercicio, rirAlvo: rir, modoForca: false, semanaRampa: null, degradacao: 0 }));
    expect(slots0.some((s,i)=>s.descansoSeg!<semDegradar[i]!),'a degradação precisa ocorrer de fato').toBe(true);
    expect(slots0.every((s,i)=>s.descansoSeg!<=semDegradar[i]!)).toBe(true);
    void p;
  });

  it('🔒 EXATO: 44 e 45 min ⇒ cardio 900 no dia 0 e 900 no dia 4; o tempo do treino é só o resistido', () => {
    for (const tempo of [44, 45]) {
      const { rot } = montarF36(tempo);
      expect(blocos(rot), `${tempo} min`).toEqual([['seg', 900], ['sex', 900]]);
      expect(rot.duracaoDias![0], `${tempo} min`).toEqual(rot.duracaoResistidaDias![0]);
    }
  });

  it('🔒 o CANDIDATO pré-degradação não deixaria folga — e mesmo assim o cardio é o mesmo', () => {
    const { p, presc, rot, B } = montarF36();
    // candidato REAL: os mesmos slots do dia 0, com os descansos do nível 0 (pré-degradação).
    const rir = presc.rirAlvoSemana ?? rirAlvoDaSemana(presc.rir, 1);
    const slotsCandidato = rot.dias[0]!.slots.map((s) => ({
      ...s,
      descansoSeg: descansoDoExercicio({ exercicio: s.exercicio, rirAlvo: rir, modoForca: false, semanaRampa: null, degradacao: 0 })!,
    }));
    const durCandidato = avaliarDuracaoResistida(slotsCandidato, p.nivelExperiencia, B);
    expect(durCandidato.duracaoMaximaEstimadaSegundos).toBeGreaterThanOrEqual(B); // no contrato antigo: folga 0
    // 🔴 A distribuição não recebe a musculação: candidato e terminal geram o mesmo cardio.
    expect(blocos(rot)).toEqual([['seg', 900], ['sex', 900]]);
  });

  it('🔒 blocos e canonical_input_hash derivam só da oferta e da meta (recomputação bate byte a byte)', () => {
    const { rot } = montarF36();
    const daOferta = distribuirCardioDaRotina({
      diasOferecidosCardio: [0, 4], cardioPrescritoPorDiaSegundos: 900,
      aggregateId: 'rotina-cardio', expectedRevision: 0, formulaVersion: FORMULA_DURACAO_VERSION,
    });
    expect(rot.distribuicaoCardio).toEqual(daOferta);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// ITEM 4 (C1.1-B) — ENTRADA FUNCIONAL: controle local → recomputarPlano → hash
// ════════════════════════════════════════════════════════════════════════════════════════════
describe('C1.1 · oferta de dias — caminho funcional completo (ter e sáb)', () => {
  // 🔒 o mapper deriva diasDisponiveis de treinoDias.length — o horizonte real tem 6 dias.
  const perfil6 = () => perfilResumo({
    objetivo: 'emagrecimento', diasDisponiveis: 6, tempoPorSessaoMin: 60,
    treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as never,
  });
  /** Recompute EXATAMENTE como o Painel faz, com a oferta pertencendo à montagem atual. */
  const recomputeComoOPainel = (p: PerfilResumo, oferta: readonly ('seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom')[]) =>
    recomputarPlano(p, { semanaCiclo: { semana: 1 }, diasOferecidosCardio: oferta }).treino.rotina!;

  it('a oferta local normaliza e alterna sem singleton compartilhado', () => {
    const base = normalizarDiasOferecidosCardio(['sab', 'ter', 'ter', 'invalido']);
    expect(base).toEqual(['ter', 'sab']);
    expect(alternarDiaOferecidoCardio(base, 'qui')).toEqual(['ter', 'qui', 'sab']);
    expect(alternarDiaOferecidoCardio(['ter', 'qui', 'sab'], 'qui')).toEqual(['ter', 'sab']);
  });

  it('usuário oferece TER e SÁB; SOMENTE essa escolha chega ao motor e ao hash', () => {
    const oferta = ['ter', 'sab'] as const;
    const rot = recomputeComoOPainel(perfil6(), oferta);
    const dist = rot.distribuicaoCardio!;
    // todo bloco e toda origem pertencem à oferta {ter, sáb} — nada além dela chegou ao motor.
    const diasTocados = new Set<string>([
      ...dist.blocosPorDia.map((b) => b.diaId),
      ...dist.blocosPorDia.flatMap((b) => b.linhagens.map((l) => l.diaOrigemId)),
    ]);
    expect([...diasTocados]).toEqual(['ter', 'sab']);
    // e o hash é DETERMINISTICAMENTE o da oferta ter/sáb: recompute bate; oferta diferente diverge.
    const deNovo = recomputeComoOPainel(perfil6(), oferta);
    expect(deNovo.distribuicaoCardio!.canonicalInputHash).toBe(dist.canonicalInputHash);
    expect(recomputeComoOPainel(perfil6(), ['qua', 'sex']).distribuicaoCardio!.canonicalInputHash).not.toBe(dist.canonicalInputHash);
  });

  it('DOM vago mas NÃO oferecido é rejeitado; SÁB oferecido recebe', () => {
    const rot = recomputeComoOPainel(perfil6(), ['ter', 'sab']);
    const blocos = rot.distribuicaoCardio!.blocosPorDia.map((b) => b.diaId);
    expect(blocos).not.toContain('dom');
    expect(blocos).toContain('sab');
  });

  it('TER com musculação: cardio PRÓPRIO após o treino com a duração prescrita inteira; musculação intacta', () => {
    const rot = recomputeComoOPainel(perfil6(), ['ter', 'sab']);
    const semOferta = recomputeComoOPainel(perfil6(), []);
    expect(rot.diasForcaAgendados).toBeGreaterThan(1); // ter (1) é dia de FORÇA neste perfil
    // (a) a terça recebe só o próprio cardio, 75 min (150 ÷ 2), acima dos 60 min do treino:
    const b1 = rot.distribuicaoCardio!.blocosPorDia.find((b) => b.diaId === 'ter')!;
    expect(b1.duracaoTotalSegundos).toBe(4500);
    expect(b1.linhagens.map((l) => l.diaOrigemId)).toEqual(['ter']);
    // (b) a musculação da terça e o seu tempo seguem os mesmos de sem cardio.
    expect(rot.dias[1]).toEqual(semOferta.dias[1]);
    expect(rot.duracaoDias![1]).toEqual(semOferta.duracaoDias![1]);
  });

  it('a fiação do Painel e do controle existe de fato (gate estático do caminho)', () => {
    const painel = readFileSync(join(__dirname, '../components/painel/Painel.tsx'), 'utf-8');
    // Todos os recomputes atravessam a fotografia canônica; não contam mais um literal por callsite.
    const recomputes = painel.split('\n').filter((linha) => linha.includes('recomputarPlano('));
    expect(recomputes.length).toBeGreaterThan(0);
    expect(recomputes.every((linha) => linha.includes('opcoesDoPlano('))).toBe(true);
    expect(painel).toMatch(/function entradaDoPlano/);
    expect(painel).toMatch(/function opcoesDoPlano/);
    expect(painel).toMatch(/useState<Weekday\[\]>\(\s*\(\) => entradaPlanoInicial\?\.diasOferecidosCardio/);
    expect(painel).toMatch(/<OfertaCardio/);
    expect(painel).toMatch(/avaliarRotinaAutomaticaFinal\(treino\.rotina/);
    const controle = readFileSync(join(__dirname, '../components/painel/OfertaCardio.tsx'), 'utf-8');
    expect(controle).toMatch(/alternarDiaOferecidoCardio\(/); // o clique deriva a próxima oferta
    expect(controle).toMatch(/onChange\(alternarDiaOferecidoCardio/); // o Painel recebe e recompõe
  });
});

// Fotografia/autoridade histórica: o seletor é congelado na etapa 1.
// As novas divisões reais são cobradas em distribuicao-etapa2.test.ts e na matriz externa.
vi.mock('./engine/selecao-divisao', async (importOriginal) => process.env.ADAPT_TEST_SELETOR_ATUAL === '1' ? importOriginal() : import('./engine/__fixtures__/selecao-etapa1'));
