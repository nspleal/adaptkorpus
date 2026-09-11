/**
 * 🔴 R3 (revisão conjunta peso × registro, 2026-09-11) — REGRESSÃO DO COMPORTAMENTO CORRETO.
 *
 * O defeito: `linhasDoModelo` copiava um DIA do plano mas herdava o número de séries de
 * `linhaDaBiblioteca` (`prescricao.seriesPorExercicio.min`, ou 3) e nunca olhava o slot.
 * Slots com 1 e 5 séries viravam 3 e 3 — o plano original ficava intacto, mas a cópia
 * oferecida para registro era quantitativamente falsa.
 *
 * A reprodução original AFIRMAVA o defeito (`toEqual([3, 3])`). Aqui ela é a afirmação do
 * certo: `toEqual([1, 5])`.
 *
 * Guard em seis pernas:
 *  ① a reprodução exata, invertida — 1/5 continuam 1/5 com prescrição mínima 3;
 *  ② a autoridade é `seriesDoSlot` (fonte única desde D9), não uma régua nova;
 *  ③ plano manual (`seriesPorExercicio`) e DELOAD do motor chegam na cópia;
 *  ④ prescrição ausente não cancela a cópia e continua respeitando as séries do plano;
 *  ⑤ unidade em SEGUNDOS preservada nos isométricos;
 *  ⑥ ordem preservada e cópia INDEPENDENTE (editar o registro não alcança o plano).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { linhaDaBiblioteca, linhasDoModelo } from '../components/painel/RegistrarTreino';
import { EXERCISES } from '../lib/data/exercises';
import { EXERCISES_SEED } from '../lib/data/seed';
import { seriesDoSlot } from '../lib/series-treino';
import { montarRotina } from '../lib/engine/treino-montador';
import { prescreverTreino } from '../lib/engine/treino';
import { avaliarGateTreino } from '../lib/engine/treino-gate';
import type { DiaTreino, PerfilTreino, PrescricaoFITT } from '../lib/engine/treino-types';

const ex = (id: string) => EXERCISES_SEED.find((e) => e.id === id)!;
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Prescrição do caso relatado: mínimo 3 — o número que engolia o 1 e o 5. */
const PRESCRICAO = {
  seriesPorExercicio: { min: 3, max: 4 },
  repsComposto: { min: 6, max: 10 },
  repsIsolado: { min: 10, max: 15 },
} as PrescricaoFITT;

const diaCom = (pares: { id: string; series?: number }[]): DiaTreino => ({
  nome: 'Pull',
  slots: pares.map(({ id, series }) => {
    const e = ex(id);
    return { exercicio: e, padrao: e.padraoMovimento, ...(series == null ? {} : { series }) };
  }),
} as DiaTreino);

const perfilBase: PerfilTreino = {
  pesoKg: 80, alturaCm: 180, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia',
  diasDisponiveis: 3, tempoPorSessaoMin: 60,
};

describe('🔴 R3 ① — as séries do plano chegam na cópia', () => {
  it('slots com 1 e 5 séries, prescrição mínima 3: a cópia tem 1 e 5', () => {
    const dia = diaCom([{ id: 'e49', series: 1 }, { id: 'e49', series: 5 }]);
    expect(linhasDoModelo(dia, PRESCRICAO).map((x) => x.sets.length)).toEqual([1, 5]);
  });

  it('o plano original continua intocado depois da cópia (regra de D18)', () => {
    const dia = diaCom([{ id: 'e49', series: 1 }, { id: 'e49', series: 5 }]);
    linhasDoModelo(dia, PRESCRICAO);
    expect(dia.slots.map((x) => x.series)).toEqual([1, 5]);
  });

  it('o default da BIBLIOTECA segue sendo o mínimo da prescrição (ali não há slot)', () => {
    // Anti-vacuidade: a correção é do modelo, não uma mudança global do formulário.
    expect(linhaDaBiblioteca(ex('e49'), PRESCRICAO, true).sets.length).toBe(3);
    expect(linhaDaBiblioteca(ex('e49'), null, true).sets.length).toBe(3);
  });
});

describe('🔴 R3 ② — a autoridade é `seriesDoSlot`, não uma régua nova', () => {
  const fonte = semComentarios(readFileSync('src/components/painel/RegistrarTreino.tsx', 'utf8'));
  const corpo = (() => {
    const i = fonte.indexOf('export function linhasDoModelo');
    expect(i, 'linhasDoModelo desapareceu — o guard ficaria vazio').toBeGreaterThan(-1);
    return fonte.slice(i, fonte.indexOf('\n}', i));
  })();

  it('chama a fonte única e não reintroduz `seriesPorExercicio` nem deload', () => {
    expect(corpo).toContain('seriesDoSlot(sl)');
    expect(/seriesPorExercicio/.test(corpo), 'a prescrição voltou a decidir séries').toBe(false);
    expect(/deload/i.test(corpo), 'a tela voltou a ter régua de deload').toBe(false);
  });

  it('para todo slot com série decidida, a cópia espelha `seriesDoSlot`', () => {
    for (const n of [1, 2, 3, 5, 8]) {
      const dia = diaCom([{ id: 'e1', series: n }]);
      expect(linhasDoModelo(dia, PRESCRICAO)[0]!.sets.length).toBe(seriesDoSlot(dia.slots[0]!));
    }
  });

  it('slot SEM série decidida cai no default da biblioteca, nunca em zero', () => {
    const dia = diaCom([{ id: 'e1' }]);
    expect(seriesDoSlot(dia.slots[0]!), 'ausência honesta na fonte única').toBe(0);
    expect(linhasDoModelo(dia, PRESCRICAO)[0]!.sets.length).toBe(3);
    expect(linhasDoModelo(dia, null)[0]!.sets.length).toBe(3);
  });
});

describe('🔴 R3 ③ — plano manual e deload do MOTOR chegam na cópia', () => {
  const comEscolhaManual = (series: number): PerfilTreino => ({
    ...perfilBase,
    rotinaCustom: { origem: 'usuario', dias: [{ nome: 'A', diaId: 'seg', exercicioIds: ['e1'], seriesPorExercicio: { e1: series } }] },
  });

  it('escolha manual de 7 séries: a cópia oferece 7 linhas, não o mínimo da prescrição', () => {
    const p = comEscolhaManual(7);
    const prescricao = prescreverTreino(p, avaliarGateTreino(p));
    const dia = montarRotina(prescricao, p, EXERCISES, new Set(), { semana: 1 }).dias[0]!;
    expect(seriesDoSlot(dia.slots[0]!)).toBe(7);
    expect(linhasDoModelo(dia, prescricao)[0]!.sets.length).toBe(7);
  });

  it('na semana de ALÍVIO o motor reduz e a cópia acompanha (sem régua própria)', () => {
    const p = comEscolhaManual(7);
    const prescricao = prescreverTreino(p, avaliarGateTreino(p));
    const alivio = montarRotina(prescricao, p, EXERCISES, new Set(), { semana: 6 }).dias[0]!;
    const reduzida = seriesDoSlot(alivio.slots[0]!);
    expect(reduzida).toBeLessThan(7);
    expect(linhasDoModelo(alivio, prescricao)[0]!.sets.length).toBe(reduzida);
  });

  it('escolha manual de 1 série sobrevive à cópia (o caso que mais doía)', () => {
    const p = comEscolhaManual(1);
    const prescricao = prescreverTreino(p, avaliarGateTreino(p));
    const dia = montarRotina(prescricao, p, EXERCISES, new Set(), { semana: 1 }).dias[0]!;
    expect(linhasDoModelo(dia, prescricao)[0]!.sets.length).toBe(1);
  });
});

describe('🔴 R3 ④⑤ — prescrição ausente e unidade em segundos', () => {
  it('sem prescrição a cópia continua acontecendo, com as séries do plano e reps vazias', () => {
    const dia = diaCom([{ id: 'e1', series: 5 }]);
    const linhas = linhasDoModelo(dia, null);
    expect(linhas[0]!.sets.length).toBe(5);
    expect(linhas[0]!.sets.every((s) => s.reps === '')).toBe(true);
  });

  it('isométrico registra SEGUNDOS e não recebe reps pré-preenchidas', () => {
    const dia = diaCom([{ id: 'e7', series: 2 }]);
    const linha = linhasDoModelo(dia, PRESCRICAO)[0]!;
    expect(linha.repUnit).toBe('segundos');
    expect(linha.sets.length).toBe(2);
    expect(linha.sets.every((s) => s.reps === '')).toBe(true);
  });

  it('composto e isolado recebem o TOPO da faixa certa', () => {
    const dia = diaCom([{ id: 'e1', series: 1 }]);
    const composto = linhasDoModelo(dia, PRESCRICAO)[0]!;
    expect(composto.sets[0]!.reps).toBe(dia.slots[0]!.padrao === 'isolado' ? '15' : '10');
  });
});

describe('🔴 R3 ⑥ — ordem preservada e cópia independente', () => {
  const dia = () => diaCom([{ id: 'e1', series: 4 }, { id: 'e49', series: 2 }, { id: 'e7', series: 1 }]);

  it('a ordem dos slots é a ordem das linhas', () => {
    const d = dia();
    expect(linhasDoModelo(d, PRESCRICAO).map((x) => x.refId)).toEqual(['e1', 'e49', 'e7']);
    expect(linhasDoModelo(d, PRESCRICAO).map((x) => x.sets.length)).toEqual([4, 2, 1]);
  });

  it('editar as linhas copiadas não muda o plano nem os `sets` de outra cópia', () => {
    const d = dia();
    const a = linhasDoModelo(d, PRESCRICAO);
    const b = linhasDoModelo(d, PRESCRICAO);
    a[0]!.sets.push({ reps: '99', kg: '99', rir: '0' });
    a[1]!.sets[0]!.kg = '50';
    expect(d.slots.map((s) => s.series)).toEqual([4, 2, 1]);
    expect(b[0]!.sets.length).toBe(4);
    expect(b[1]!.sets[0]!.kg).toBe('');
  });

  it('nenhum `sets` é compartilhado por referência entre linhas da mesma cópia', () => {
    const linhas = linhasDoModelo(dia(), PRESCRICAO);
    const vistos = new Set<unknown>();
    for (const l of linhas) {
      for (const s of l.sets) {
        expect(vistos.has(s), 'objeto de série reaproveitado entre linhas').toBe(false);
        vistos.add(s);
      }
    }
  });
});
