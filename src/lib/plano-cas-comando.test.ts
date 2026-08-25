/**
 * 🔒 C1 — o MOTOR produz o comando de commit (parte pura do CAS). Prova que o comando é
 * determinístico e que hash+agregado são consistentes por construção (mesmo input canônico).
 */
import { describe, expect, it } from 'vitest';
import { comandoCommitDePlano, aggregateIdDePlano, opcoesDeEntradaPlano } from './plano-cas-comando';
import { canonicalInputHash, decidirPreCommit, FORMULA_DURACAO_VERSION } from '@/lib/engine';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { FlagsSaude } from '@/lib/engine';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilResumo> = {}): PerfilResumo => ({
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
  objetivo: 'massa', flagsSaude: SEM, alergenos: [], preferencia: 'onivoro', naoCurto: [],
  pratosCansados: [], favoritos: [], nivelExperiencia: 'avancado', equipamento: 'academia',
  equipamentosCasa: [], diasDisponiveis: 6, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'], ...over,
}) as PerfilResumo;

describe('C1 · o motor produz o comando de commit (puro, determinístico)', () => {
  it('a chave carrega aggregateId estável, formulaVersion vigente e hash do input', () => {
    const cmd = comandoCommitDePlano('user-1', perfil(), 7);
    expect(cmd.aggregateId).toBe(aggregateIdDePlano('user-1'));
    expect(cmd.expectedRevision).toBe(7);
    expect(cmd.formulaVersion).toBe(FORMULA_DURACAO_VERSION);
    expect(cmd.canonicalInputHash).toBe(canonicalInputHash({ perfil: perfil(), opcoes: cmd.aggregate.entrada.opcoes }));
    expect(cmd.aggregate.dieta).toBeDefined();
    expect(cmd.aggregate.treino).toBeDefined();
  });

  it('mesmo perfil → MESMO comando (determinismo auditável); perfil diferente → hash diferente', () => {
    const a = comandoCommitDePlano('user-1', perfil(), 0);
    const b = comandoCommitDePlano('user-1', perfil(), 0);
    expect(a.canonicalInputHash).toBe(b.canonicalInputHash);
    const c = comandoCommitDePlano('user-1', perfil({ pesoKg: 90 }), 0);
    expect(c.canonicalInputHash).not.toBe(a.canonicalInputHash);
  });

  it('o comando produzido PASSA na pré-decisão contra um agregado inédito (revisão 0)', () => {
    const cmd = comandoCommitDePlano('user-1', perfil(), 0);
    expect(decidirPreCommit(null, cmd, FORMULA_DURACAO_VERSION)).toMatchObject({ tipo: 'PROSSEGUIR', proximaRevision: 1 });
  });

  it('certifica as entradas que mudam o plano visível — peso, oferta, ciclo, feedback e retomada não somem do hash', () => {
    const base = comandoCommitDePlano('user-1', perfil(), 0, {
      pesoEfetivoKg: 80, diasOferecidosCardio: ['qua'], semanaCiclo: { semana: 1, feedbackGrupos: [] }, escolhasExecucao: [],
    });
    const peso = comandoCommitDePlano('user-1', perfil(), 0, {
      pesoEfetivoKg: 78, diasOferecidosCardio: ['qua'], semanaCiclo: { semana: 1, feedbackGrupos: [] }, escolhasExecucao: [],
    });
    const oferta = comandoCommitDePlano('user-1', perfil(), 0, {
      pesoEfetivoKg: 80, diasOferecidosCardio: ['sex'], semanaCiclo: { semana: 1, feedbackGrupos: [] }, escolhasExecucao: [],
    });
    const semana = comandoCommitDePlano('user-1', perfil(), 0, {
      pesoEfetivoKg: 80, diasOferecidosCardio: ['qua'], semanaCiclo: {
        semana: 2, feedbackGrupos: [['costas', 'segura']],
        retomada: { semana: 1, fator: 0.5, volumeReferencia: 12, exerciciosRecentes: ['e1'] },
      }, escolhasExecucao: [],
    });
    expect(peso.canonicalInputHash).not.toBe(base.canonicalInputHash);
    expect(oferta.canonicalInputHash).not.toBe(base.canonicalInputHash);
    expect(semana.canonicalInputHash).not.toBe(base.canonicalInputHash);
  });

  it('transporta a escolha válida de lateralidade sem a perder ao reconstruir as opções do motor', () => {
    const cmd = comandoCommitDePlano('user-1', perfil(), 0, {
      pesoEfetivoKg: 80,
      diasOferecidosCardio: ['qua'],
      semanaCiclo: { semana: 1, feedbackGrupos: [] },
      escolhasExecucao: [['e72', 'BILATERAL']],
    });
    const opcoes = opcoesDeEntradaPlano(cmd.aggregate.entrada.opcoes);
    expect(cmd.aggregate.entrada.opcoes.escolhasExecucao).toEqual([['e72', 'BILATERAL']]);
    expect(opcoes.escolhasExecucao.get('e72')).toBe('BILATERAL');
  });
});
