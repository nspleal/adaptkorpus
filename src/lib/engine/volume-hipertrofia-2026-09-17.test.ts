/**
 * 🔵 A POLÍTICA DE VOLUME DA HIPERTROFIA — decisão do autor de 2026-09-17, como regressão.
 *
 * O que ela substitui: até `8b41ec9` o mesmo número (`volumePorGrupoSemana.max`) era ao mesmo
 * tempo o ALVO da rampa e o TETO duro. Agora são três números distintos por nível, todos na
 * conta ponderada canônica (direta 1,0 · indireta 0,5 — `PESO_SECUNDARIO`):
 *
 * | Nível         | Faixa desejada | Teto semanal | Máximo automático SEM foco |
 * |---------------|----------------|--------------|----------------------------|
 * | Iniciante     | 6–10           | 13           | 10                         |
 * | Intermediário | 10–14          | 19           | 16                         |
 * | Avançado      | 12–18          | 21           | 18                         |
 *
 * E um teto POR SESSÃO de 12 séries ponderadas por grupo, para todos os níveis, com ou sem
 * foco, sem margem — que vale AO MESMO TEMPO que o semanal.
 *
 * 🔴 São política do aplicativo: não são MRV individual medido, nem limite biológico
 * universal, nem limiar automático de lesão. E máximo permitido não é meta: a rampa mira a
 * faixa desejada e nada aqui empurra volume para cima só porque cabe.
 *
 * ⚠️ Este arquivo não tem conta própria: usa `creditoPonderadoDaSemana` (a do alocador v4 e a
 * do crítico) e os números de `trilhos`. Uma segunda régua aqui seria a segunda verdade que a
 * decisão existe para remover.
 */
import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './alocador';
import {
  faixaSemanal, maxSemanalSemFoco, mev, tetoPonderadoNaSessao, tetoSemanalCheio,
  tetoSemanalDoGrupo, tetoSeriesGrupoNaSessao,
} from './trilhos';
import { MARGEM_SEM_FOCO, TETO_PONDERADO_SESSAO, TETO_SEMANAL_HIPERTROFIA } from './treino-constants';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude } from './types';
import type { PerfilTreino, RotinaSemanal, SemanaCiclo } from './treino-types';
import type { GrupoPrimario } from '../data/types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
const NIVEIS = ['iniciante', 'intermediario', 'avancado'] as const;

const perfil = (over: Record<string, unknown> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4,
  treinoDias: DIAS.slice(0, 4), tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado', ...over,
} as unknown as PerfilTreino);

const plano = (p: PerfilTreino, semana: SemanaCiclo = 5, retomada?: unknown): RotinaSemanal =>
  montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(),
    { semana, ...(retomada ? { retomada } : {}) } as never);

const pond = (r: RotinaSemanal) => creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
const pondDoDia = (r: RotinaSemanal, i: number) => creditoPonderadoDaSemana(r.dias[i]!.slots);

/** O teto semanal de cada grupo, como o motor o PUBLICA (foco e fase já resolvidos). */
const tetoDoGrupo = (r: RotinaSemanal, g: GrupoPrimario) =>
  (r.tetoVolumeSemana!.gruposEmFoco.includes(g) ? r.tetoVolumeSemana!.cheio : r.tetoVolumeSemana!.semFoco);

const acimaNaSemana = (r: RotinaSemanal) =>
  GRUPOS_GRANDES.filter((g) => (pond(r).get(g) ?? 0) > tetoDoGrupo(r, g))
    .map((g) => `${g} ${pond(r).get(g)} > ${tetoDoGrupo(r, g)}`);

const acimaNaSessao = (r: RotinaSemanal) => {
  const teto = r.tetoVolumeSemana?.sessao;
  if (teto == null) return [];
  const fora: string[] = [];
  r.dias.forEach((_d, i) => {
    for (const g of GRUPOS_GRANDES) {
      const v = pondDoDia(r, i).get(g) ?? 0;
      if (v > teto) fora.push(`dia${i} ${g} ${v} > ${teto}`);
    }
  });
  return fora;
};

// ── ① A TABELA, como ela foi decidida ────────────────────────────────────────

describe('🔵 a tabela de 2026-09-17, número a número', () => {
  it('faixa desejada · teto semanal · máximo automático, por nível', () => {
    expect(NIVEIS.map((n) => faixaSemanal(n, 'massa')))
      .toEqual([{ min: 6, max: 10 }, { min: 10, max: 14 }, { min: 12, max: 18 }]);
    expect(NIVEIS.map((n) => tetoSemanalCheio(n, 'massa'))).toEqual([13, 19, 21]);
    expect(NIVEIS.map((n) => maxSemanalSemFoco(n, 'massa'))).toEqual([10, 16, 18]);
    expect(TETO_SEMANAL_HIPERTROFIA).toEqual({ iniciante: 13, intermediario: 19, avancado: 21 });
  });

  it('a margem de 3 vale SÓ no teto semanal dos grupos sem foco', () => {
    expect(MARGEM_SEM_FOCO).toBe(3);
    for (const n of NIVEIS) {
      expect(tetoSemanalCheio(n, 'massa') - maxSemanalSemFoco(n, 'massa'), n).toBe(MARGEM_SEM_FOCO);
      // 🔴 E NÃO existe margem no teto por sessão: ele é o mesmo com e sem foco.
      expect(tetoSeriesGrupoNaSessao(n, 'massa'), n).toBe(TETO_PONDERADO_SESSAO);
    }
  });

  it('12 por sessão, para TODOS os níveis, com ou sem foco', () => {
    for (const n of NIVEIS) {
      for (const freq of [1, 2, 3, 4, 5, 6, 7]) {
        expect(tetoSeriesGrupoNaSessao(n, 'massa', freq), `${n}/${freq}×`).toBe(12);
      }
      const teto = tetoSemanalDoGrupo({ nivel: n, objetivo: 'massa', emFoco: ['peito'] });
      expect(teto('peito'), `${n} focado`).toBe(tetoSemanalCheio(n, 'massa'));
      expect(teto('ombros'), `${n} não focado`).toBe(maxSemanalSemFoco(n, 'massa'));
    }
  });

  it('🔒 os outros objetivos NÃO herdam esta tabela — política própria, intocada', () => {
    for (const n of NIVEIS) {
      for (const obj of ['saude', 'emagrecimento'] as const) {
        expect(tetoSemanalCheio(n, obj), `${n}/${obj}`).toBe(faixaSemanal(n, obj).max);
        expect(maxSemanalSemFoco(n, obj), `${n}/${obj}`).toBe(faixaSemanal(n, obj).max);
        expect(tetoPonderadoNaSessao(n, obj), `${n}/${obj}: não há teto ponderado de sessão`).toBeNull();
      }
    }
  });
});

// ── ② OS EXEMPLOS OBRIGATÓRIOS da decisão, um a um ───────────────────────────

/**
 * 🔒 Os exemplos pressupõem AUSÊNCIA de outros créditos — é o próprio texto da decisão que o
 * diz. Aqui eles são medidos contra os limites, que é exatamente o que eles afirmam. A
 * contabilização real, com todos os créditos indiretos, é o que a varredura de ③ mede.
 */
describe('🔵 os exemplos numéricos da decisão', () => {
  const sessao = TETO_PONDERADO_SESSAO;

  it('intermediário, peito SEM foco: 3 exercícios × 3 séries no mesmo dia = 9 — permitido', () => {
    expect(3 * 3).toBeLessThanOrEqual(sessao);
    expect(3 * 3).toBeLessThanOrEqual(maxSemanalSemFoco('intermediario', 'massa'));
  });

  it('intermediário SEM foco: 9 + 7 = 16 cabe; 9 + 8 = 17 ultrapassa o máximo automático', () => {
    const max = maxSemanalSemFoco('intermediario', 'massa');
    expect(9 + 7).toBeLessThanOrEqual(max);
    expect(9 + 8).toBeGreaterThan(max);
    // 🔴 …e 17 continua ABAIXO do teto cheio: não se pode dizer que ultrapassou o teto.
    expect(9 + 8).toBeLessThan(tetoSemanalCheio('intermediario', 'massa'));
  });

  it('intermediário COM foco: 10 + 9 = 19 cabe na semana; 13 numa sessão não cabe', () => {
    expect(10 + 9).toBeLessThanOrEqual(tetoSemanalCheio('intermediario', 'massa'));
    expect(13).toBeGreaterThan(sessao);
  });

  it('iniciante SEM foco: 11 numa sessão respeita o teto do dia e viola o máximo semanal de 10', () => {
    expect(11).toBeLessThanOrEqual(sessao);
    expect(11).toBeGreaterThan(maxSemanalSemFoco('iniciante', 'massa'));
  });

  it('avançado COM foco: 12 + 9 = 21 cabe', () => {
    expect(12 + 9).toBeLessThanOrEqual(tetoSemanalCheio('avancado', 'massa'));
    // e 21 é EXATAMENTE o teto: uma série a mais não cabe.
    expect(12 + 9 + 1).toBeGreaterThan(tetoSemanalCheio('avancado', 'massa'));
  });

  it('🔴 a exceção do foco é do GRUPO: um extra de peito não libera ombros nem tríceps', () => {
    const teto = tetoSemanalDoGrupo({ nivel: 'intermediario', objetivo: 'massa', emFoco: ['peito'] });
    expect(teto('peito')).toBe(19);
    for (const g of ['ombros', 'triceps', 'costas'] as const) expect(teto(g), g).toBe(16);
  });
});

// ── ③ A VARREDURA: o motor obedece os dois limites ao mesmo tempo ────────────

/**
 * 🔴 A EXCEÇÃO MEDIDA, declarada em vez de escondida.
 *
 * Nestas células o teto POR SESSÃO fica acima de 12 e o motor não tem como corrigir: os slots
 * diretos do grupo já estão no piso por exercício do nível, e o excesso vem do crédito
 * INDIRETO de OUTRO grupo no mesmo dia (posterior recebe 0,5 por série de cada exercício de
 * glúteos ali). Reduzir o outro grupo seria cobrar de um terceiro por um teto que não é dele —
 * o que `podarExcessoPonderado` proíbe por desenho, e por bons motivos.
 *
 * 🔒 O excesso NÃO é silencioso: o crítico o diz, com o número, em `acima_do_maximo_na_sessao`
 * (verificado abaixo). Esta lista existe para que uma célula NOVA derrube o teste em vez de se
 * esconder atrás de uma tolerância.
 */
const EXCESSO_DE_SESSAO_CONHECIDO = new Set([
  'avancado/6d/45min/limitado',
  'avancado/7d/45min/limitado',
]);

describe('🔒 nenhum plano automático nasce acima dos limites', () => {
  const CELULAS = NIVEIS.flatMap((nivel) => ([1, 2, 3, 4, 5, 6, 7] as const).flatMap((dias) =>
    ([20, 45, 75] as const).flatMap((tempo) =>
      (['limitado', 'sem_limite'] as const).map((limite) => ({ nivel, dias, tempo, limite })))));

  it('semana: nenhum grande passa do teto do seu porte, em 1–7 dias, com e sem foco', () => {
    const fora: string[] = [];
    let medidos = 0;
    let comFocoNaMargem = 0;
    for (const c of CELULAS) for (const semana of [1, 3, 5, 6] as const) for (const foco of [undefined, 'peito'] as const) {
      const p = perfil({
        nivelExperiencia: c.nivel, diasDisponiveis: c.dias, treinoDias: DIAS.slice(0, c.dias),
        tempoPorSessaoMin: c.tempo, limiteTempoTreino: c.limite,
        ...(foco ? { foco: { grupo: foco, compensa: 'ombros', semana } } : {}),
      });
      let r: RotinaSemanal;
      try { r = plano(p, semana); } catch { continue; }
      medidos += 1;
      const ruim = acimaNaSemana(r);
      if (ruim.length) fora.push(`${c.nivel}/${c.dias}d/${c.tempo}min/${c.limite}/S${semana}/${foco ?? 'sem-foco'}: ${ruim.join(', ')}`);
      // ⚠️ ANTI-VACUIDADE: a margem tem de ser USADA em algum lugar, senão ela é letra morta.
      if (foco && (pond(r).get('peito') ?? 0) > r.tetoVolumeSemana!.semFoco) comFocoNaMargem += 1;
    }
    expect(medidos, 'a varredura não mediu nada').toBeGreaterThan(200);
    expect(fora.slice(0, 10), `${fora.length} planos acima do teto semanal`).toEqual([]);
    expect(comFocoNaMargem, 'nenhum plano usou a margem do foco — ela virou letra morta').toBeGreaterThan(0);
  }, 600_000);

  it('sessão: nenhum grande passa das 12 ponderadas num dia, salvo as células declaradas', () => {
    const fora: string[] = [];
    let medidos = 0;
    for (const c of CELULAS) for (const semana of [1, 5] as const) {
      const chave = `${c.nivel}/${c.dias}d/${c.tempo}min/${c.limite}`;
      const p = perfil({
        nivelExperiencia: c.nivel, diasDisponiveis: c.dias, treinoDias: DIAS.slice(0, c.dias),
        tempoPorSessaoMin: c.tempo, limiteTempoTreino: c.limite,
      });
      let r: RotinaSemanal;
      try { r = plano(p, semana); } catch { continue; }
      medidos += 1;
      const ruim = acimaNaSessao(r);
      if (ruim.length && !EXCESSO_DE_SESSAO_CONHECIDO.has(chave)) fora.push(`${chave}/S${semana}: ${ruim.join(', ')}`);
    }
    expect(medidos, 'a varredura não mediu nada').toBeGreaterThan(100);
    expect(fora.slice(0, 10), `${fora.length} planos acima do teto de sessão fora da lista declarada`).toEqual([]);
  }, 600_000);

  /** 🔒 A célula declarada existe MESMO — e o excesso dela é DITO, não engolido. */
  it('a exceção declarada é real e o excesso que sobra é dito pelo crítico', async () => {
    const { avaliarSemana } = await import('./critico');
    const p = perfil({
      nivelExperiencia: 'avancado', diasDisponiveis: 6, treinoDias: DIAS.slice(0, 6),
      tempoPorSessaoMin: 45, limiteTempoTreino: 'limitado',
    });
    const r = plano(p, 3);
    expect(acimaNaSessao(r).length, 'a célula deixou de exercitar o resíduo — reancorar a lista').toBeGreaterThan(0);
    const av = avaliarSemana(
      r.dias.map((d) => ({
        nome: d.nome, exercicios: d.slots.map((s) => s.exercicio),
        series: d.slots.map((s) => s.series), descansoSeg: d.slots.map((s) => s.descansoSeg),
      })),
      {
        nivel: 'avancado', objetivo: 'massa', tempoPorSessaoMin: 45, limiteTempoTreino: 'limitado', semana: 3,
        ...(r.faixaVolumeSemana ? { faixaSemanal: r.faixaVolumeSemana } : {}),
        ...(r.tetoVolumeSemana ? { tetoVolumeSemana: r.tetoVolumeSemana } : {}),
      },
    );
    expect(av.avisos.some((a) => a.codigo === 'acima_do_maximo_na_sessao'),
      `o excesso ficou sem voz: ${av.avisos.map((a) => a.codigo).join(', ')}`).toBe(true);
  });
});

// ── ④ O crédito INDIRETO conta, e leva um terceiro ao limite ─────────────────

describe('🔒 o crédito indireto entra na mesma conta', () => {
  it('o grupo que só recebe indireto também responde pelo teto', () => {
    const p = perfil({
      nivelExperiencia: 'avancado', diasDisponiveis: 6, treinoDias: DIAS.slice(0, 6),
      tempoPorSessaoMin: 90, limiteTempoTreino: 'sem_limite',
    });
    const r = plano(p, 5);
    const direto = new Map<GrupoPrimario, number>();
    for (const d of r.dias) for (const s of d.slots) {
      const g = s.exercicio.grupoPrimario;
      if (g) direto.set(g, (direto.get(g) ?? 0) + (s.series ?? 0));
    }
    // ⚠️ ANTI-VACUIDADE: sem crédito indireto, medir "ponderado" seria medir "direto".
    const comIndireto = GRUPOS_GRANDES.filter((g) => (pond(r).get(g) ?? 0) > (direto.get(g) ?? 0));
    expect(comIndireto.length, 'nenhum grande recebeu indireto — a conta não é ponderada').toBeGreaterThan(0);
    expect(acimaNaSemana(r), 'o indireto levou alguém acima do teto').toEqual([]);
  });
});

// ── ⑤ FASES: o menor limite manda, e a margem não é subtraída duas vezes ─────

describe('🔒 deload e retomada — um corte só', () => {
  it('deload: o teto da fase manda, e a margem de 3 NÃO é subtraída de novo', () => {
    for (const nivel of NIVEIS) {
      const r = plano(perfil({ nivelExperiencia: nivel }), 6);
      expect(r.faseVolume, nivel).toBe('deload');
      const reduzido = r.faixaVolumeSemana!.max;
      const t = r.tetoVolumeSemana!;
      expect(t.semFoco, `${nivel}: o teto da fase deixou de mandar`).toBe(reduzido);
      expect(t.cheio, `${nivel}: o foco não pode elevar o teto acima da fase`).toBe(reduzido);
      expect(t.semFoco, `${nivel}: segunda subtração de 3`).not.toBe(reduzido - MARGEM_SEM_FOCO);
      expect(acimaNaSemana(r), nivel).toEqual([]);
    }
  });

  it('retomada: o teto é o operacional do nível, e o foco não é aplicado na fase', () => {
    const r = plano(perfil({ nivelExperiencia: 'intermediario', foco: { grupo: 'peito', compensa: 'ombros', semana: 2 } }),
      1, { semana: 1, fator: 0.5, volumeReferencia: 14 });
    expect(r.faseVolume).toBe('retomada');
    expect(r.tetoVolumeSemana!.semFoco).toBe(maxSemanalSemFoco('intermediario', 'massa'));
    expect(r.tetoVolumeSemana!.gruposEmFoco, 'a retomada não aplica o bloco do foco').toEqual([]);
    expect(acimaNaSemana(r)).toEqual([]);
  });
});

// ── ⑥ MÁXIMO PERMITIDO NÃO É META ───────────────────────────────────────────

describe('🔒 a rampa mira a faixa desejada, nunca o teto', () => {
  it('sem foco, nenhum grande é empurrado acima do topo da faixa só porque cabe', () => {
    let medidos = 0;
    for (const nivel of NIVEIS) for (const dias of [3, 4, 5] as const) {
      const r = plano(perfil({
        nivelExperiencia: nivel, diasDisponiveis: dias, treinoDias: DIAS.slice(0, dias),
        tempoPorSessaoMin: 90, limiteTempoTreino: 'sem_limite',
      }), 5);
      const topo = faixaSemanal(nivel, 'massa').max;
      const piso = mev(nivel, 'massa');
      for (const g of GRUPOS_GRANDES) {
        const v = pond(r).get(g) ?? 0;
        if (v <= 0) continue;
        medidos += 1;
        expect(v, `${nivel}/${dias}d · ${g} acima do topo desejado sem foco`).toBeLessThanOrEqual(topo);
        // 🔒 …e não abaixo do piso sem o motor dizer (o guard de cobertura é quem fala).
        if (v < piso) {
          expect(r.avisos.some((a) => a.includes(g) || a.includes('abaixo do mínimo')),
            `${nivel}/${dias}d · ${g} abaixo do piso, calado`).toBe(true);
        }
      }
    }
    expect(medidos, 'a varredura não mediu grupo nenhum').toBeGreaterThan(20);
  }, 300_000);
});
