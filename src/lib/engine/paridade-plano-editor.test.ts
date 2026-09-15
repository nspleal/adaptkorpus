/**
 * 🔒 DECISÃO DO AUTOR 2026-09-15 — ABRIR E SALVAR SEM EDITAR PRESERVA O TREINO.
 *
 * O editor guiado não estima nada: ele roda o MOTOR sobre o desenho em construção
 * (`Painel.preverPlano` → `montarRotina` com `rotinaCustom`). Logo, abrir o editor sobre o
 * plano exibido e salvar sem tocar em nada tem de devolver o MESMO treino, dentro do mesmo
 * contexto de semana/recuperação: IDs, ordem, séries e DESCANSOS EFETIVOS.
 *
 * 🔴 O DEFEITO QUE ESTE ARQUIVO DETECTA (preexistente em `origin/main`, medido em 17 de 34
 * cenários): a decisão de degradação do descanso no caminho do DESENHO DA PESSOA usava
 * `perfil.tempoPorSessaoMin * 60` como orçamento fixo, ignorando a opção **75+**
 * (`limiteTempoTreino: 'sem_limite'`), que o caminho automático respeita. Resultado no perfil
 * 75+: o plano trazia `e16` com 4 séries e 150 s de descanso, e a prévia interna do editor
 * recalculava os mesmos 4 × 90 s — o dia inteiro descia dois degraus de descanso só por ter
 * passado pelo editor. O editor não exibir descanso não elimina a divergência: ela é o que
 * seria SALVO.
 */
import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude } from './types';
import type { PerfilTreino, RotinaCustom, RotinaSemanal, SemanaCiclo } from './treino-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60,
  ...over,
});
const montar = (p: PerfilTreino, semana: SemanaCiclo = 3, extra: Record<string, unknown> = {}) => montarRotina(
  prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(),
  { semana, feedbackGrupos: new Map(), ...extra },
);

/**
 * Exatamente o que `Painel.preverPlano` monta: os IDs e as séries do plano exibido viram o
 * desenho. Descanso NÃO viaja (`paraRotinaCustom` não o carrega) — é o motor que recalcula, e
 * é justamente esse recálculo que precisa bater.
 */
const comoOEditorEnvia = (r: RotinaSemanal): RotinaCustom => ({
  origem: 'usuario',
  dias: r.dias.map((d) => ({
    nome: d.nome,
    ...(d.diaId ? { diaId: d.diaId } : {}),
    exercicioIds: d.slots.map((s) => s.exercicio.id),
    seriesPorExercicio: Object.fromEntries(
      d.slots.filter((s) => s.series != null).map((s) => [s.exercicio.id, s.seriesAntesDoDeload ?? s.series!]),
    ),
  })),
});

const foto = (r: RotinaSemanal | null) => (r?.dias ?? []).map((d) => ({
  nome: d.nome,
  slots: d.slots.map((s) => ({ id: s.exercicio.id, series: s.series ?? null, descanso: s.descansoSeg ?? null })),
}));

const CASOS: Array<{ nome: string; over: Partial<PerfilTreino>; semana?: SemanaCiclo; extra?: Record<string, unknown> }> = [
  { nome: '75+ sem limite 4d avançado (a reprodução do parecer)', over: { tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', nivelExperiencia: 'avancado' } },
  { nome: '75+ sem limite 5d avançado', over: { diasDisponiveis: 5, tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', nivelExperiencia: 'avancado' } },
  { nome: '75+ sem limite 6d avançado', over: { diasDisponiveis: 6, tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', nivelExperiencia: 'avancado' } },
  { nome: '75 min LIMITADO (contraste — aqui degradar está certo)', over: { tempoPorSessaoMin: 75, limiteTempoTreino: 'limitado', nivelExperiencia: 'avancado' } },
  { nome: '60 min limitado 4d', over: {} },
  { nome: '30 min limitado 3d', over: { diasDisponiveis: 3, tempoPorSessaoMin: 30 } },
  { nome: '75+ com foco em ombros', over: { tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', nivelExperiencia: 'avancado', foco: { grupo: 'ombros', compensa: 'peito', semana: 1 } } },
  { nome: '75+ casa com halteres', over: { equipamento: 'casa', equipamentosCasa: ['halteres'], tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite' } },
  { nome: '75+ semana 1', over: { tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', nivelExperiencia: 'avancado' }, semana: 1 },
  { nome: '75+ deload (semana 6)', over: { tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', nivelExperiencia: 'avancado' }, semana: 6 },
  { nome: '75+ retomada', over: { tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', nivelExperiencia: 'avancado' }, extra: { retomada: { semana: 1, fator: 0.6, volumeReferencia: 12 } } },
  /**
   * 🔴 A 2ª CAUSA, e ela NÃO depende do 75+: aqui o limite existe (75 min, `limitado`) e o
   * desenho tem séries mistas (4+3+3+3+3). A estimativa do caminho manual projetava `sPlan`
   * em todos os slots, inflava o dia e degradava 180 s → 120 s no dia de costas. É o perfil
   * autenticado da validação: 5 dias, prioridades, avançado, foco em peito.
   */
  { nome: 'perfil real — 75 limitado, 5d, prioridades, foco em peito', over: { diasDisponiveis: 5, tempoPorSessaoMin: 75, nivelExperiencia: 'avancado', divisaoPreferida: 'prioridades', foco: { grupo: 'peito', compensa: 'ombros', semana: 1 } }, semana: 1 },
  { nome: '60 min limitado 5d avançado prioridades', over: { diasDisponiveis: 5, nivelExperiencia: 'avancado', divisaoPreferida: 'prioridades' } },
  { nome: '45 min limitado 4d superior/inferior', over: { tempoPorSessaoMin: 45, divisaoPreferida: 'superior-inferior' } },
  { nome: '90 min limitado 6d avançado', over: { diasDisponiveis: 6, tempoPorSessaoMin: 90, nivelExperiencia: 'avancado' } },
  { nome: '60 min limitado 3d iniciante', over: { diasDisponiveis: 3, nivelExperiencia: 'iniciante' } },
  { nome: 'casa sem equipamento 4d/60', over: { equipamento: 'casa', equipamentosCasa: [] } },
  { nome: 'emagrecimento 3d/45', over: { objetivo: 'emagrecimento', diasDisponiveis: 3, tempoPorSessaoMin: 45 } },
  { nome: 'força pesada 2d/75 limitado', over: { modoForca: true, nivelExperiencia: 'avancado', objetivo: 'emagrecimento', diasDisponiveis: 2, tempoPorSessaoMin: 75 } },
  { nome: 'deload limitado 4d/60', over: {}, semana: 6 },
  { nome: 'retomada limitada 4d/60', over: {}, extra: { retomada: { semana: 1, fator: 0.6, volumeReferencia: 12 } } },
];

describe('② plano e prévia do editor são o mesmo treino', () => {
  it.each(CASOS)('$nome — IDs, ordem, séries e descansos efetivos', ({ over, semana, extra }) => {
    const p = perfil(over);
    const plano = montar(p, semana ?? 3, extra ?? {});
    expect(plano).not.toBeNull();
    const previa = montar({ ...p, rotinaCustom: comoOEditorEnvia(plano!) }, semana ?? 3, extra ?? {});
    expect(foto(previa)).toEqual(foto(plano));
  });

  /**
   * A trava explícita do caso nomeado: no 75+ o descanso do composto pesado não pode cair
   * abaixo do mínimo vigente só por passar pelo editor.
   */
  it('75+ — o descanso do plano sobrevive ao editor, sem piso rebaixado', () => {
    const p = perfil({ tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', nivelExperiencia: 'avancado' });
    const plano = montar(p)!;
    const previa = montar({ ...p, rotinaCustom: comoOEditorEnvia(plano) })!;
    const descansos = (r: RotinaSemanal) => r.dias.flatMap((d) => d.slots.map((s) => s.descansoSeg ?? 0));
    expect(descansos(previa)).toEqual(descansos(plano));
    expect(Math.min(...descansos(previa))).toBeGreaterThanOrEqual(60);
  });

  /** O mínimo de 120 s dos pesados continua valendo nos dois caminhos. */
  it('o piso de 120 s do composto pesado vale no plano e na prévia', () => {
    const p = perfil({ modoForca: true, nivelExperiencia: 'avancado', objetivo: 'emagrecimento', diasDisponiveis: 2, tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite' });
    const plano = montar(p)!;
    const previa = montar({ ...p, rotinaCustom: comoOEditorEnvia(plano) })!;
    for (const r of [plano, previa]) {
      const pesados = r.dias.flatMap((d) => d.slots.filter((s) => s.exercicio.tipo === 'forca_hipertrofia' && s.padrao !== 'isolado' && s.padrao !== 'core'));
      for (const s of pesados) expect(s.descansoSeg ?? 0).toBeGreaterThanOrEqual(120);
    }
  });
});
