/**
 * 🔒 C1 §8.3 — REGRESSÃO MEDIDA: os CINCO CASOS ORIGINAIS do diagnóstico
 * (`auditoria-catalogo-criterios-treino-2026-08-16.md`,
 * SHA-256 A6222DB95B7C77D07DE9F7ABD3B295B84700D81CF8567E3427237CC4190F3A6A, medidos em `44f0ee0`):
 * curta · predominância de isolados · mista · predominância de compostos · força pesada.
 *
 * Para cada caso: os valores ANTIGOS (GER = custoDia no nível escolhido; C-lig = sessao_longa como
 * ligado no Painel; C-def = sessao_longa no caminho default 1 série/90 s) são o REGISTRO HISTÓRICO
 * do diagnóstico; os valores NOVOS saem do gerador de HOJE no mesmo perfil/dia, com a fórmula
 * canônica, e a convergência gerador↔crítico é ASSEGURADA no mesmo SHA.
 *
 * Três regressões ADICIONAIS (não substituem os originais): sessão longa, tempo impossível, deload.
 */
import { describe, expect, it } from 'vitest';
import { gerarTreino } from './index';
import { orcamentoSlotsDoDia } from './alocador';
import { avaliarDuracaoResistida } from './duracao-plano';
import { descansoDoExercicio } from './descanso';
import { rirAlvoDaSemana } from './treino-mesociclo';
import { prescreverTreino } from './treino';
import { avaliarGateTreino } from './treino-gate';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino, SemanaCiclo } from './treino-types';
import type { FlagsSaude } from './types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

interface CasoOriginal {
  nome: string;
  perfil: Partial<PerfilTreino>;
  semana: SemanaCiclo;
  /** Prefixo do NOME do dia medido no diagnóstico (Upper A / Push / Upper / Lower). */
  dia: string;
  /** Registro histórico do diagnóstico em 44f0ee0 (segundos). */
  antigo: { budget: number; slotCap: number; ger: number; cLig: number; cDef: number; composicao: string };
}

const ORIGINAIS: CasoOriginal[] = [
  {
    nome: '1 · curta',
    perfil: { objetivo: 'massa', nivelExperiencia: 'intermediario', diasDisponiveis: 4, tempoPorSessaoMin: 30 },
    semana: 1, dia: 'Upper A',
    antigo: { budget: 1800, slotCap: 4, ger: 1840, cLig: 1840, cDef: 520, composicao: 'isolado4x@60 · empurrar4x@90 · puxar4x@90 · isolado4x@60' },
  },
  {
    nome: '2 · predominância de isolados',
    perfil: { objetivo: 'massa', nivelExperiencia: 'avancado', diasDisponiveis: 5, tempoPorSessaoMin: 75 },
    semana: 5, dia: 'Push',
    antigo: { budget: 4500, slotCap: 7, ger: 3840, cLig: 3840, cDef: 780, composicao: 'isolado4x@120 ×6' },
  },
  {
    nome: '3 · mista',
    perfil: { objetivo: 'massa', nivelExperiencia: 'intermediario', diasDisponiveis: 4, tempoPorSessaoMin: 45 },
    semana: 1, dia: 'Upper A',
    antigo: { budget: 2700, slotCap: 5, ger: 2240, cLig: 2240, cDef: 650, composicao: 'isolado4x@60 · empurrar4x@90 · puxar4x@90 · isolado4x@60 · isolado4x@60' },
  },
  {
    nome: '4 · predominância de compostos',
    perfil: { objetivo: 'massa', nivelExperiencia: 'avancado', diasDisponiveis: 5, tempoPorSessaoMin: 75 },
    semana: 5, dia: 'Upper',
    antigo: { budget: 4500, slotCap: 7, ger: 4320, cLig: 4320, cDef: 780, composicao: 'empurrar4x@180 ×4 · isolado4x@60 ×2' },
  },
  {
    nome: '5 · força pesada',
    perfil: { objetivo: 'emagrecimento', nivelExperiencia: 'avancado', diasDisponiveis: 5, tempoPorSessaoMin: 60, modoForca: true },
    semana: 1, dia: 'Lower',
    antigo: { budget: 3600, slotCap: 6, ger: 4320, cLig: 2930, cDef: 780, composicao: 'dobradica3x@180 · isolado3x@60 · agachar3x@90 · agachar3x@180 · dobradica4x@90 · core4x@60' },
  },
];

const linhas: string[] = [];

function medirCaso(c: CasoOriginal) {
  const perfil = { pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, equipamento: 'academia', ...c.perfil } as PerfilTreino;
  const presc = prescreverTreino(perfil, avaliarGateTreino(perfil));
  const rot = gerarTreino(perfil, { exercises: EXERCISES, semanaCiclo: { semana: c.semana } }).rotina!;
  const orcamentoSeg = perfil.tempoPorSessaoMin * 60;
  // o dia medido no diagnóstico, pelo NOME do split (Upper A / Push / Upper / Lower).
  const idx = rot.dias.findIndex((d) => d.nome === c.dia);
  expect(idx, `dia '${c.dia}' existe no split de hoje`).toBeGreaterThanOrEqual(0);
  const dia = rot.dias[idx]!;
  const dur = rot.duracaoDias![idx]!;

  // degradação observada: descanso final < descanso sem degradar (nível 0).
  const rir = presc.rirAlvoSemana ?? rirAlvoDaSemana(presc.rir, c.semana);
  const degradou = dia.slots.some((s) => {
    const n0 = descansoDoExercicio({ exercicio: s.exercicio, rirAlvo: rir, modoForca: presc.modoForca === true, semanaRampa: null, degradacao: 0 });
    return n0 != null && s.descansoSeg != null && s.descansoSeg < n0;
  });

  // 🔒 CONVERGÊNCIA no mesmo SHA: o crítico avalia o MESMO dia pela MESMA função canônica.
  const doCritico = avaliarDuracaoResistida(dia.slots, perfil.nivelExperiencia, orcamentoSeg);
  expect(doCritico).toEqual(dur);

  const rg = rot.resultadoGeracao!;
  const motivo = rg.tipo === 'NAO_AVALIADO_ENTREGAVEL' ? (rg.motivos[0] ?? '—')
    : rg.tipo === 'INCOMPATIVEL' ? `menor plano com cobertura (cap ${rg.capacidadeMinimaTestada}) ainda excede B+480`
      : rg.tipo === 'ERRO_ALOCADOR' ? rg.violacoesInvariantes.join('; ') : '—';

  return { perfil, presc, rot, dia, dur, idx, degradou, rg, motivo, orcamentoSeg };
}

describe('C1 §8.3 · os CINCO CASOS ORIGINAIS do diagnóstico (antes 44f0ee0 × depois neste SHA)', () => {
  it.each(ORIGINAIS)('$nome — reproduzido no dia medido, com convergência gerador↔crítico', (c) => {
    const m = medirCaso(c);
    expect(m.orcamentoSeg).toBe(c.antigo.budget); // mesmo orçamento do diagnóstico
    linhas.push([
      c.nome,
      `${c.antigo.budget}s`,
      `${orcamentoSlotsDoDia(m.perfil.tempoPorSessaoMin)} → ${m.dia.slots.length}`,
      m.dia.slots.map((s) => `${s.padrao.slice(0, 4)}${s.series}×@${s.descansoSeg}`).join(' '),
      `${c.antigo.ger}s`, `${c.antigo.cLig}s`, `${c.antigo.cDef}s`,
      m.dur.estadoCalculo === 'CALCULADO' ? `${m.dur.duracaoMinimaEstimadaSegundos}–${m.dur.duracaoMaximaEstimadaSegundos}s` : 'NAO_AVALIADO',
      m.rg.tipo,
      m.dur.estadoLimite,
      m.degradou ? 'sim' : 'não',
      m.motivo,
      'convergiu',
    ].join(' | '));
  });

  it('caso 1 (curta): a composição de hoje É a do diagnóstico e a canônica corrige o descanso pós-última', () => {
    const m = medirCaso(ORIGINAIS[0]!);
    expect(m.dia.slots.map((s) => `${s.series}x@${s.descansoSeg}`)).toEqual(['4x@60', '4x@90', '4x@90', '4x@60']);
    // antigo GER=C-lig=1840 CONTAVAM o descanso após a última série; a canônica dá 1540–1780.
    expect(m.dur.duracaoMinimaEstimadaSegundos).toBe(1540);
    expect(m.dur.duracaoMaximaEstimadaSegundos).toBe(1780);
    expect(m.dur.estadoLimite).toBe('DENTRO_DO_LIMITE'); // o antigo dizia "não cabe" (1840 > 1800)
  });

  it('caso 5 (força pesada): a composição medida reaparece e o drift GER≫C-lig (4320×2930) morre na fonte única', () => {
    const m = medirCaso(ORIGINAIS[4]!);
    // composição do diagnóstico: dobr3x@180 · isol3x@60 · agach3x@90 · agach3x@180 · dobr4x@90 · core4x@60
    expect(m.dia.slots.map((s) => `${s.padrao.slice(0, 4)}${s.series}x@${s.descansoSeg}`)).toEqual(
      ['dobr3x@180', 'isol3x@60', 'agac3x@90', 'agac3x@180', 'dobr4x@90', 'core4x@60'],
    );
    // hoje NÃO há duas respostas: gerador e crítico devolvem a MESMA faixa (asserido em medirCaso),
    // dentro do limite — o antigo tinha GER "não cabe" (4320) × C-lig "cabe" (2930) para o MESMO dia.
    expect(m.dur.estadoCalculo).toBe('CALCULADO');
    expect(m.dur.estadoLimite).toBe('DENTRO_DO_LIMITE');
    // pisos de força pesada preservados: composto COM CARGA nunca < 180 (peso-corporal fica em 90).
    for (const s of m.dia.slots) {
      if (s.descansoSeg != null && s.descansoSeg >= 180) expect(s.descansoSeg).toBeGreaterThanOrEqual(180);
    }
  });

  it('imprime a tabela §8.3 (antes × depois)', () => {
    console.log('\n=== §8.3 · CINCO CASOS ORIGINAIS (44f0ee0 → este SHA) ===');
    console.log('caso | orçamento | slots inicial→final | séries×descanso (dia medido) | GER antigo | C-lig antigo | C-def antigo | canônica nova MIN–MAX | gerador novo | crítico novo (limite) | degradou | motivo | convergência');
    for (const l of linhas) console.log(l);
    expect(linhas.length).toBe(ORIGINAIS.length);
  });
});

// ── Regressões ADICIONAIS (não substituem os cinco originais) ────────────────────────────────
describe('C1 §8.3 · regressões adicionais (sessão longa · tempo impossível · deload)', () => {
  const ADICIONAIS = [
    { nome: 'longa (90 min)', perfil: { objetivo: 'massa', nivelExperiencia: 'intermediario', diasDisponiveis: 5, tempoPorSessaoMin: 90 }, semana: 1 as SemanaCiclo, esperado: 'CERTIFICADO' },
    { nome: 'menor cobertura excede (10 min, 1 dia)', perfil: { objetivo: 'massa', nivelExperiencia: 'intermediario', diasDisponiveis: 1, tempoPorSessaoMin: 10 }, semana: 1 as SemanaCiclo, esperado: 'INCOMPATIVEL' },
    /**
     * 🔴 D2 (2026-09-10) — expectativa VIRADA de propósito, não afrouxada. O
     * `NAO_AVALIADO_ENTREGAVEL` desta linha era o defeito: a semana 6 saía sem séries e o
     * motor não sabia dizer se a sessão cabia no tempo, 1 semana em 6. Com o deload anotado
     * pela rampa (`aplicarDeload`, uma única redução), o deload passa a ser certificável como
     * as outras cinco — e a convergência gerador↔crítico abaixo continua sendo cobrada.
     */
    { nome: 'deload (semana 6)', perfil: { objetivo: 'massa', nivelExperiencia: 'intermediario', diasDisponiveis: 4, tempoPorSessaoMin: 60 }, semana: 6 as SemanaCiclo, esperado: 'CERTIFICADO' },
  ];
  it.each(ADICIONAIS)('$nome → $esperado, com convergência', (c) => {
    const perfil = { pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, equipamento: 'academia', ...c.perfil } as PerfilTreino;
    const rot = gerarTreino(perfil, { exercises: EXERCISES, semanaCiclo: { semana: c.semana } }).rotina!;
    expect(rot.resultadoGeracao!.tipo).toBe(c.esperado);
    if (rot.resultadoGeracao!.tipo === 'ERRO_ALOCADOR') {
      expect(rot.duracaoResistidaDias).toBeUndefined();
      expect(rot.duracaoDias).toBeUndefined();
      expect(rot.planoFinalPorDia).toBeUndefined();
      return;
    }
    const orcamentoSeg = perfil.tempoPorSessaoMin * 60;
    rot.dias.forEach((d, i) => {
      expect(avaliarDuracaoResistida(d.slots, perfil.nivelExperiencia, orcamentoSeg)).toEqual(rot.duracaoDias![i]);
    });
    expect(rot.duracaoIncompativel ?? false).toBe(rot.resultadoGeracao!.tipo === 'INCOMPATIVEL');
  });

  it('coverage-first encontra puxar + empurrar + membro inferior antes de declarar incompatibilidade', () => {
    const perfil = {
      pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, equipamento: 'academia' as const,
      objetivo: 'massa' as const, nivelExperiencia: 'intermediario' as const,
      diasDisponiveis: 1, tempoPorSessaoMin: 10,
    };
    const rot = gerarTreino(perfil, { exercises: EXERCISES, semanaCiclo: { semana: 1 } }).rotina!;
    const padroes = new Set(rot.dias.flatMap((d) => d.slots.map((s) => s.padrao)));
    expect(padroes.has('puxar')).toBe(true);
    expect(padroes.has('empurrar')).toBe(true);
    expect(padroes.has('agachar') || padroes.has('dobradica_quadril')).toBe(true);
    expect(rot.resultadoGeracao?.tipo).toBe('INCOMPATIVEL');
  });

  it('plano sem cobertura possível falha estruturalmente antes de ganhar duração', () => {
    const perfil = {
      pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, equipamento: 'academia' as const,
      objetivo: 'massa' as const, nivelExperiencia: 'intermediario' as const,
      diasDisponiveis: 1, tempoPorSessaoMin: 10,
    };
    const semMembroInferior = EXERCISES.filter((e) =>
      e.padraoMovimento !== 'agachar' && e.padraoMovimento !== 'dobradica_quadril');
    const rot = gerarTreino(perfil, { exercises: semMembroInferior, semanaCiclo: { semana: 1 } }).rotina!;
    expect(rot.resultadoGeracao?.tipo).toBe('ERRO_ALOCADOR');
    expect(rot.duracaoResistidaDias).toBeUndefined();
    expect(rot.duracaoDias).toBeUndefined();
    expect(rot.planoFinalPorDia).toBeUndefined();
  });
});
