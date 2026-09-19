/**
 * 🔒 O CORTE POR TEMPO, EXPLICADO NO EDITOR (decisão do autor, 2026-09-16).
 *
 * 🔑 O defeito, medido em `5c3a6c0`: no caminho manual o reduce-to-fit **não roda** — é
 * contrato — então a prévia do desenho não tinha o que explicar. Só que a dose exibida já
 * vem cortada do plano de origem: `doPlano` copia `s.series` (pós-corte) para
 * `seriesPorExercicio`, e ela passa a parecer escolha da pessoa. Resultado: o número menor
 * aparecia sem causa, atribuído a quem não o escolheu.
 *
 * 🔵 A CORREÇÃO tem três travas, e cada uma tem caso aqui:
 *  ① o corte é um FATO do motor (`SlotExercicio.seriesAntesDoCorteDeTempo` → `fatosCorteTempo`),
 *    registrado do que a sequência E3/E6 executou — nunca deduzido de uma diferença;
 *  ② só aparece enquanto CORRESPONDE à dose exibida: mudou a série, saiu o exercício ⇒ some;
 *  ③ sem procedência (desenho salvo, plano legado) a tela cala — não há histórico a inventar.
 *
 * ⚠️ E a atribuição é exata: o deload NÃO é corte de tempo. Medido antes da correção: a
 * semana 6 reportava `4 → 1`, somando ao tempo a redução que era do deload.
 */
import { describe, expect, it } from 'vitest';
import { recomputarPlano } from './plano';
import { doPlano, paraRotinaCustom, cortesVigentes, type DiaEditavel } from '@/components/painel/EditorTreino';
import { avaliarSemana, type DiaDoEditor } from './engine/critico';
import { unificarAvisos } from './avisos-unificados';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { RotinaSemanal } from './engine/treino-types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const DIAS = ['seg', 'ter', 'qui', 'sex'] as const;
const OPC = { semanaCiclo: { semana: 3 } };

const perfil = (over: Record<string, unknown> = {}): PerfilResumo => ({
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
  objetivo: 'massa', flagsSaude: SEM, alergenos: [], preferencia: null, naoCurto: [],
  pratosCansados: [], favoritos: [], nivelExperiencia: 'intermediario', equipamento: 'academia',
  equipamentosCasa: [], diasDisponiveis: 4, tempoPorSessaoMin: 30, limiteTempoTreino: 'limitado',
  treinoDias: DIAS, ...over,
}) as unknown as PerfilResumo;

const rotina = (p: PerfilResumo, opcoes: unknown = OPC): RotinaSemanal =>
  recomputarPlano(p, opcoes as never).treino.rotina!;

/** A PRÉVIA real do editor: o desenho volta ao motor como `rotinaCustom`. */
const prever = (p: PerfilResumo, dias: readonly DiaEditavel[], opcoes: unknown = OPC): DiaDoEditor[] => {
  const r = rotina({ ...p, rotinaCustom: paraRotinaCustom(dias) } as PerfilResumo, opcoes);
  return r.dias.map((d) => ({
    nome: d.nome, exercicios: d.slots.map((s) => s.exercicio), series: d.slots.map((s) => s.series),
    descansoSeg: d.slots.map((s) => s.descansoSeg), holdSeg: d.slots.map((s) => s.holdSeg),
  }));
};
const abrir = (p: PerfilResumo, r: RotinaSemanal) => doPlano(r.dias, p.treinoDias ?? [], undefined, undefined);

// ── ① O fato existe, e bate com a dose entregue ──────────────────────────────
describe('🔴 o motor publica o corte por tempo, por exercício', () => {
  it('30 min: há cortes, e cada `para` é EXATAMENTE a série entregue', () => {
    const p = perfil();
    const r = rotina(p);
    // ⚠️ ANTI-VACUIDADE: sem corte nenhum o resto do arquivo não prova nada.
    expect(r.fatosCorteTempo?.length ?? 0, 'o cenário deixou de cortar por tempo').toBeGreaterThan(0);
    for (const f of r.fatosCorteTempo!) {
      const dia = r.dias.find((d) => d.diaId === f.diaId)!;
      const slot = dia.slots.find((s) => s.exercicio.id === f.exercicioId)!;
      expect(slot.series, `${f.exercicioId}: o fato não corresponde à dose entregue`).toBe(f.para);
      expect(f.de, 'corte sem redução').toBeGreaterThan(f.para);
      expect(f.limiteMin).toBe(30);
    }
  });

  it('sem limite de tempo (75+), não há corte nem fato', () => {
    const r = rotina(perfil({ tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite' }));
    expect(r.fatosCorteTempo).toBeUndefined();
  });

  it('🔴 DELOAD não vira corte de tempo — cada causa fica com o que é dela', () => {
    /**
     * Medido antes da correção: a semana 6 herdava `seriesAntesDoCorteDeTempo` da montagem
     * interna da semana CHEIA e reportava `4 → 1`, somando ao tempo a redução do deload.
     */
    const r = rotina(perfil(), { semanaCiclo: { semana: 6 } });
    expect(r.semana?.deload, 'o cenário precisa ser mesmo uma semana de deload').toBe(true);
    for (const f of r.fatosCorteTempo ?? []) {
      const slot = r.dias.find((d) => d.diaId === f.diaId)?.slots.find((s) => s.exercicio.id === f.exercicioId);
      expect(f.de, `${f.exercicioId}: a redução do deload foi atribuída ao tempo`)
        .toBeLessThanOrEqual(slot?.seriesAntesDoDeload ?? f.de);
    }
  });

  it('retomada: o `de` é a dose JÁ reduzida da fase, não a da semana cheia', () => {
    const r = rotina(perfil(), { semanaCiclo: { semana: 1, retomada: { semana: 1, fator: 0.5, volumeReferencia: 16 } } });
    for (const f of r.fatosCorteTempo ?? []) expect(f.de).toBeLessThanOrEqual(4);
  });
});

// ── ② O editor mostra — e só enquanto corresponder à tela ────────────────────
describe('🔑 abrir, editar, remover, salvar/reabrir', () => {
  const p = perfil();

  it('abrir SEM editar: os cortes do app aparecem, um por exercício', () => {
    const r = rotina(p);
    const dias = abrir(p, r);
    const vigentes = cortesVigentes(dias, prever(p, dias));
    expect(vigentes.length).toBe(r.fatosCorteTempo!.length);
    for (const c of vigentes) expect(c.de).toBeGreaterThan(c.para);
  });

  it('🔒 editar a série INVALIDA aquele corte — e só aquele', () => {
    const r = rotina(p);
    const dias = abrir(p, r);
    const antes = cortesVigentes(dias, prever(p, dias));
    const alvo = r.fatosCorteTempo![0]!;
    const editados = dias.map((d) => (d.exercicios.some((e) => e.id === alvo.exercicioId)
      ? { ...d, seriesPorExercicio: { ...d.seriesPorExercicio, [alvo.exercicioId]: 4 } } : d));
    const depois = cortesVigentes(editados, prever(p, editados));
    expect(depois.length, 'a linha do exercício editado continuou na tela').toBe(antes.length - 1);
    // 🔒 Os outros não somem junto: a invalidação é por exercício.
    expect(depois.length).toBeGreaterThan(0);
  });

  it('🔒 remover o exercício tira a linha dele', () => {
    const r = rotina(p);
    const dias = abrir(p, r);
    const alvo = r.fatosCorteTempo![0]!;
    const semEx = dias.map((d) => ({ ...d, exercicios: d.exercicios.filter((e) => e.id !== alvo.exercicioId) }));
    const nomes = cortesVigentes(semEx, prever(p, semEx)).map((c) => c.nome);
    const nome = r.dias.flatMap((d) => d.slots).find((s) => s.exercicio.id === alvo.exercicioId)!.exercicio.nomePt;
    expect(nomes).not.toContain(nome);
  });

  it('🔒 adicionar exercício não inventa corte para ele', () => {
    const r = rotina(p);
    const dias = abrir(p, r);
    const novo = r.dias[0]!.slots[0]!.exercicio;
    const comNovo = dias.map((d, i) => (i === 1 ? { ...d, exercicios: [...d.exercicios, novo] } : d));
    const vigentes = cortesVigentes(comNovo, prever(p, comNovo));
    expect(vigentes.every((c) => c.de > c.para)).toBe(true);
    expect(comNovo[1]!.cortesDoApp?.some((c) => c.exercicioId === novo.id) ?? false).toBe(false);
  });

  it('🔒 salvar e reabrir NÃO inventa histórico: o desenho salvo é da pessoa', () => {
    const r = rotina(p);
    const dias = abrir(p, r);
    const custom = paraRotinaCustom(dias);
    const salvo = rotina({ ...p, rotinaCustom: custom } as PerfilResumo);
    const reaberto = doPlano(salvo.dias, p.treinoDias ?? [], custom, undefined);
    expect(cortesVigentes(reaberto, prever(p, reaberto))).toEqual([]);
  });
});

// ── ③ O que NÃO pode mudar ───────────────────────────────────────────────────
describe('🔒 o que a explicação não pode custar', () => {
  const p = perfil();

  it('a dose explicitamente escolhida pela pessoa é preservada — e não vira corte do app', () => {
    const r = rotina(p);
    const dias = abrir(p, r);
    const alvo = r.fatosCorteTempo![0]!;
    // 2026-09-19: a escolha não pode coincidir com o `para` do corte, senão a asserção abaixo
    // não distingue escolha de corte. Escolhe-se um número diferente do que o app cortou.
    const escolha = alvo.para === 3 ? 4 : 3;
    const editados = dias.map((d) => (d.exercicios.some((e) => e.id === alvo.exercicioId)
      ? { ...d, seriesPorExercicio: { ...d.seriesPorExercicio, [alvo.exercicioId]: escolha } } : d));
    const prev = prever(p, editados);
    const slot = prev.flatMap((d) => d.exercicios.map((e, i) => ({ id: e.id, s: d.series?.[i] })))
      .find((x) => x.id === alvo.exercicioId);
    expect(slot?.s, 'a escolha da pessoa não sobreviveu').toBe(escolha);
    expect(cortesVigentes(editados, prev).some((c) => c.nome === r.dias.flatMap(d => d.slots).find(s => s.exercicio.id === alvo.exercicioId)!.exercicio.nomePt)).toBe(false);
  });

  it('o desenho salvo sai idêntico com e sem a explicação (nada novo é persistido)', () => {
    const r = rotina(p);
    const dias = abrir(p, r);
    const semCortes = dias.map(({ cortesDoApp: _ignorado, ...d }) => d);
    expect(paraRotinaCustom(dias)).toEqual(paraRotinaCustom(semCortes));
  });

  it('a explicação não duplica nem contradiz a lista do motor no editor', () => {
    const r = rotina(p);
    const dias = abrir(p, r);
    const prev = prever(p, dias);
    const custom = rotina({ ...p, rotinaCustom: paraRotinaCustom(dias) } as PerfilResumo);
    const avaliacao = avaliarSemana(prev, {
      nivel: 'intermediario', objetivo: 'massa', tempoPorSessaoMin: 30, limiteTempoTreino: 'limitado',
      treinoDias: DIAS, semana: 3, faixaSemanal: custom.faixaVolumeSemana, faseVolume: custom.faseVolume,
    } as never);
    const avisosMotor = unificarAvisos(custom, avaliacao).avisosMotor;
    // A prévia do DESENHO não corta por tempo — então a frase agregada não está lá, e a
    // explicação por exercício não repete ninguém.
    expect(avisosMotor.some((a) => a.includes('reduzimos séries progressivamente'))).toBe(false);
    expect(cortesVigentes(dias, prev).length).toBeGreaterThan(0);
  });

  it('o excesso manual acima do teto continua sendo dito', () => {
    const base = rotina(perfil({ tempoPorSessaoMin: 60 }));
    const dias = base.dias.map((d) => ({
      diaId: d.diaId, exercicioIds: d.slots.map((s) => s.exercicio.id),
      seriesPorExercicio: Object.fromEntries(d.slots.map((s) => [s.exercicio.id, 6])),
    }));
    const r = rotina(perfil({ tempoPorSessaoMin: 60, rotinaCustom: { origem: 'usuario', dias } }));
    for (const d of r.dias) for (const s of d.slots) expect(s.series).toBe(6);
  });
});
