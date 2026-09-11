import { describe, expect, it } from 'vitest';
import { recomputarPlano } from '@/lib/plano';
import { EXERCISES_SEED } from '@/lib/data/seed';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { SemanaCiclo } from './treino-types';

/**
 * 🔴 D3 (diagnóstico 2026-09-10, §6.4) — CERTIFICADO não pode conviver com um dia medido
 * ACIMA do limite operacional.
 *
 * Medido no SHA `34b2ede`: editor guiado com 99 séries por exercício produziu
 * `duracaoDias[0] = { estadoCalculo: CALCULADO, estadoLimite: ACIMA_DO_LIMITE_OPERACIONAL,
 * max: 35.520 s }` — 9 h 52 contra um orçamento de 3.600 s — **e**
 * `resultadoGeracao = { tipo: 'CERTIFICADO' }`. `treino-types.ts` define CERTIFICADO como
 * *"todo dia cabe em B+480 (musculação) após a adaptação"*: era contradição interna no mesmo
 * objeto, porque o terminal do ramo manual só olhava `motivosNaoAvaliados`, nunca
 * `estadoLimite`.
 *
 * 🔒 A política do manual NÃO mudou: plano do usuário é *soft* — não é reduzido, não perde
 * exercício, não é bloqueado. O que mudou é o RÓTULO: ele passa a ser entregue sem
 * certificação, com os dias que estouram nomeados. Nenhuma capacidade não medida é afirmada
 * (por isso não é `INCOMPATIVEL`, que alegaria "nem o menor plano coube") e nada é dado como
 * não avaliado (por isso não é `NAO_AVALIADO_ENTREGAVEL`: o dia FOI avaliado).
 */

const base = (o: Record<string, unknown> = {}): PerfilResumo => ({
  sexo: 'masculino', idade: 30, alturaCm: 178, pesoKg: 80,
  nivelAtividade: 'moderado', objetivo: 'massa',
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: [],
  diasDisponiveis: 4, treinoDias: ['seg', 'ter', 'qui', 'sab'], tempoPorSessaoMin: 60,
  alergenos: [], preferencia: null, naoCurto: [], pratosCansados: [], favoritos: [], ...o,
} as unknown as PerfilResumo);

const IDS = EXERCISES_SEED
  .filter((e) => e.local === 'academia' && e.padraoMovimento !== 'cardio')
  .slice(0, 3).map((e) => e.id);

const comDesenho = (seriesPorExercicio?: Record<string, number>, o: Record<string, unknown> = {}) =>
  base({
    rotinaCustom: {
      origem: 'usuario',
      dias: [{ nome: 'Meu dia', diaId: 'seg', exercicioIds: IDS, ...(seriesPorExercicio ? { seriesPorExercicio } : {}) }],
    },
    ...o,
  });

const gerar = (perfil: PerfilResumo, semana: SemanaCiclo = 1) =>
  recomputarPlano(perfil, { semanaCiclo: { semana } }).treino.rotina!;

describe('D3 — a invariante: nenhum plano CERTIFICADO tem dia acima do limite operacional', () => {
  it('anti-vacuidade: o desenho de 99 séries REALMENTE estoura o limite (senão nada é provado)', () => {
    const r = gerar(comDesenho(Object.fromEntries(IDS.map((i) => [i, 99]))));
    const acima = (r.duracaoDias ?? []).filter((d) => d.estadoLimite === 'ACIMA_DO_LIMITE_OPERACIONAL');
    expect(acima.length, 'o caso deixou de estourar — a fixture precisa de outro exagero').toBeGreaterThan(0);
    expect(acima[0]!.estadoCalculo, 'o dia nem foi calculado — o caso mudou de natureza').toBe('CALCULADO');
  });

  /** Os DOIS produtores: o alocador automático e o editor guiado. */
  const CASOS: readonly [string, () => PerfilResumo][] = [
    ['editor guiado · 99 séries', () => comDesenho(Object.fromEntries(IDS.map((i) => [i, 99])))],
    ['editor guiado · sem séries explícitas', () => comDesenho()],
    ['editor guiado · dia longo em 10 min', () => comDesenho(undefined, { tempoPorSessaoMin: 10 })],
    ['alocador automático · 60 min', () => base()],
    ['alocador automático · 10 min, 1 dia', () => base({ diasDisponiveis: 1, treinoDias: ['seg'], tempoPorSessaoMin: 10 })],
    ['alocador automático · 90 min, 6 dias', () => base({ diasDisponiveis: 6, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'], tempoPorSessaoMin: 90, nivelExperiencia: 'avancado' })],
  ];

  it.each(CASOS)('%s: CERTIFICADO implica nenhum dia ACIMA_DO_LIMITE_OPERACIONAL', (_nome, perfil) => {
    for (const semana of [1, 6] as const) {
      const r = gerar(perfil(), semana);
      if (r.resultadoGeracao?.tipo !== 'CERTIFICADO') continue;
      const acima = (r.duracaoDias ?? [])
        .map((d, i) => ({ i, ...d }))
        .filter((d) => d.estadoLimite === 'ACIMA_DO_LIMITE_OPERACIONAL');
      expect(acima.map((d) => `dia ${d.i}: max ${d.duracaoMaximaEstimadaSegundos}s > ${d.limiteOperacionalSegundos}s`))
        .toEqual([]);
    }
  });
});

describe('D3 — o plano manual que estoura é ENTREGUE, sem certificado e com a limitação dita', () => {
  const rotina = () => gerar(comDesenho(Object.fromEntries(IDS.map((i) => [i, 99]))));

  it('o terminal é ENTREGUE_SEM_CERTIFICACAO e nomeia os dias que estouram', () => {
    const rg = rotina().resultadoGeracao!;
    expect(rg.tipo).toBe('ENTREGUE_SEM_CERTIFICACAO');
    if (rg.tipo !== 'ENTREGUE_SEM_CERTIFICACAO') return;
    expect(rg.diasAcimaDoLimite.length).toBeGreaterThan(0);
  });

  it('a escolha manual é preservada: mesmos exercícios, mesmas séries, plano entregue', () => {
    const r = rotina();
    expect(r.split).toBe('Meu treino');
    expect(r.dias[0]!.slots.map((s) => s.exercicio.id)).toEqual(IDS);
    expect(r.dias[0]!.slots.map((s) => s.series)).toEqual(IDS.map(() => 99));
    expect(r.dias[0]!.slots.every((s) => s.seriesDefinidasPeloUsuario)).toBe(true);
  });

  it('não alega capacidade não medida: nada de INCOMPATIVEL nem de duracaoIncompativel', () => {
    const r = rotina();
    expect(r.resultadoGeracao!.tipo).not.toBe('INCOMPATIVEL');
    expect(r.duracaoIncompativel).toBeUndefined();
  });

  it('a duração continua CALCULADA — entregar sem certificar não é deixar de medir', () => {
    for (const d of rotina().duracaoDias ?? []) expect(d.estadoCalculo).toBe('CALCULADO');
  });

  it('um desenho que CABE continua CERTIFICADO (o rótulo não virou pessimismo)', () => {
    const r = gerar(comDesenho(Object.fromEntries(IDS.map((i) => [i, 3]))));
    expect(r.resultadoGeracao!.tipo).toBe('CERTIFICADO');
  });
});

describe('D3 — entradas de séries inválidas são validadas e DITAS, não engolidas', () => {
  const INVALIDAS: readonly [string, number][] = [
    ['zero', 0], ['negativa', -3], ['fracionária', 2.5], ['acima do teto de tamanho', 250],
  ];

  const NOME_0 = EXERCISES_SEED.find((e) => e.id === IDS[0])!.nomePt;

  it.each(INVALIDAS)('série %s (%s): o plano sai, e o aviso nomeia o exercício', (_nome, valor) => {
    const r = gerar(comDesenho({ [IDS[0]!]: valor }));
    expect(r.dias[0]!.slots.length, 'o plano não foi entregue').toBe(IDS.length);
    const aviso = r.avisos.find((a) => a.includes(NOME_0));
    expect(aviso, `nenhum aviso menciona "${NOME_0}" — a entrada inválida foi engolida: ${JSON.stringify(r.avisos)}`)
      .toBeDefined();
    expect(aviso).toContain(String(valor));
  });

  it('a série inválida não vira número inventado: o slot fica com o valor do motor', () => {
    const r = gerar(comDesenho({ [IDS[0]!]: 0 }));
    const slot = r.dias[0]!.slots.find((s) => s.exercicio.id === IDS[0]);
    expect(slot!.series).toBeGreaterThan(0);
    expect(slot!.seriesDefinidasPeloUsuario ?? false, 'entrada recusada não pode virar "escolha do usuário"').toBe(false);
  });

  it('uma série válida no mesmo dia continua valendo (a recusa é por exercício, não por dia)', () => {
    const r = gerar(comDesenho({ [IDS[0]!]: 0, [IDS[1]!]: 5 }));
    expect(r.dias[0]!.slots.find((s) => s.exercicio.id === IDS[1])!.series).toBe(5);
  });
});
