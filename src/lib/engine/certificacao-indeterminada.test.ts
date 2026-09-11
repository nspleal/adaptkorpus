import { describe, expect, it } from 'vitest';
import { recomputarPlano } from '@/lib/plano';
import { migrarSessao } from '@/lib/session';
import { vereditoDoPlano } from '@/lib/veredito-motor';
import { EXERCISES_SEED } from '@/lib/data/seed';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { RotinaSemanal, SemanaCiclo } from './treino-types';

/**
 * 🔴 D12 (auditoria 2026-09-11 sobre `a40f8af`) — UMA SÓ CONDIÇÃO DE CERTIFICAÇÃO.
 *
 * O guard de D3 rebaixava `CERTIFICADO` apenas quando o dia era `ACIMA_DO_LIMITE_OPERACIONAL`.
 * `precisaReduzir` — o outro produtor, o ramo automático — trata `LIMITE_INDETERMINADO` como
 * motivo para REDUZIR o plano. O mesmo estado significava "reduza" num lugar e "certificado"
 * no outro, e a pessoa lia 🟢 *"a duração calculada está dentro dos limites do app"* ao lado
 * de 🔴 *"Upper A deve levar até cerca de 53 min, acima dos 45 min que você marcou"*.
 *
 * 🔒 Duas coisas, e só estas duas, são travadas aqui:
 *   1. `CERTIFICADO` ⇒ todo dia em `DENTRO_DO_LIMITE` ou `DENTRO_DA_TOLERANCIA`, nos DOIS
 *      produtores. A tolerância de +480 s continua valendo: ela é folga MEDIDA, não incerteza.
 *   2. A frase da incerteza é OUTRA frase. `LIMITE_INDETERMINADO` é `min ≤ limite < max` — o
 *      dia pode caber. Reusar o texto do excesso afirmaria uma medição que não existe.
 */

const base = (o: Record<string, unknown> = {}): PerfilResumo => ({
  sexo: 'masculino', idade: 30, alturaCm: 175, pesoKg: 75,
  nivelAtividade: 'moderado', objetivo: 'saude',
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: [],
  diasDisponiveis: 1, treinoDias: ['seg'], tempoPorSessaoMin: 60,
  alergenos: [], preferencia: null, naoCurto: [], pratosCansados: [], favoritos: [], ...o,
} as unknown as PerfilResumo);

/** O desenho manual mínimo que a auditoria mediu: 5 exercícios × N séries em 1 dia. */
const IDS = ['e14', 'e22', 'e16', 'e72', 'e70'];
const manual = (series: number, o: Record<string, unknown> = {}) => base({
  rotinaCustom: {
    origem: 'usuario',
    dias: [{ nome: 'Meu treino', diaId: 'seg', exercicioIds: IDS, seriesPorExercicio: Object.fromEntries(IDS.map((i) => [i, series])) }],
  },
  ...o,
});

const gerar = (p: PerfilResumo, semana: SemanaCiclo = 1, diasOferecidosCardio?: string[]): RotinaSemanal =>
  recomputarPlano(p, {
    semanaCiclo: { semana },
    ...(diasOferecidosCardio ? { diasOferecidosCardio: diasOferecidosCardio as never } : {}),
  }).treino.rotina!;

describe('D12 · o dia que PODE estourar não recebe certificado', () => {
  const rotina = gerar(manual(6));

  it('anti-vacuidade: o motor realmente mede o dia como LIMITE_INDETERMINADO', () => {
    const d = rotina.duracaoDias![0]!;
    expect(d.estadoCalculo).toBe('CALCULADO');
    expect(d.estadoLimite).toBe('LIMITE_INDETERMINADO');
    expect(d.duracaoMaximaEstimadaSegundos!).toBeGreaterThan(d.limiteOperacionalSegundos!);
    expect(d.duracaoMinimaEstimadaSegundos!).toBeLessThanOrEqual(d.limiteOperacionalSegundos!);
  });

  it('o terminal nomeia o dia incerto em campo PRÓPRIO, e não na lista do excesso medido', () => {
    const rg = rotina.resultadoGeracao!;
    expect(rg.tipo).toBe('ENTREGUE_SEM_CERTIFICACAO');
    if (rg.tipo !== 'ENTREGUE_SEM_CERTIFICACAO') return;
    expect(rg.diasPodemUltrapassar).toEqual([0]);
    expect(rg.diasAcimaDoLimite, 'incerteza virou afirmação de excesso').toEqual([]);
  });

  it('a frase diz incerteza, não excesso', () => {
    const v = vereditoDoPlano(rotina, 60)!;
    expect(v.tom).not.toBe('ok');
    expect(v.titulo).toMatch(/não dá para garantir/i);
    expect(`${v.titulo} ${v.detalhe}`, 'afirmou excesso onde só há incerteza').not.toMatch(/acima do limite/i);
    expect(v.detalhe).toMatch(/pode passar do seu tempo/);
  });
});

describe('D12 · o excesso MEDIDO continua dizendo excesso (D3 preservada)', () => {
  it('99 séries: terminal com o dia na lista de excesso e a frase antiga', () => {
    const rotina = gerar(manual(99));
    const rg = rotina.resultadoGeracao!;
    expect(rg.tipo).toBe('ENTREGUE_SEM_CERTIFICACAO');
    if (rg.tipo !== 'ENTREGUE_SEM_CERTIFICACAO') return;
    expect(rg.diasAcimaDoLimite).toEqual([0]);
    const v = vereditoDoPlano(rotina, 60)!;
    expect(v.titulo).toMatch(/acima do limite de tempo/);
  });
});

describe('D12 · a tolerância existente é preservada', () => {
  /**
   * 🔒 `DENTRO_DA_TOLERANCIA` é `orçamento < max ≤ orçamento + 480`: excesso MEDIDO e aceito
   * por política explícita. Ele não pode ser varrido junto com a incerteza — seria apertar a
   * régua por tabela, que é o oposto do que D12 pede.
   */
  it('existe caso na tolerância e ele continua CERTIFICADO', () => {
    const achados = [3, 4, 5].flatMap((series) => [30, 45, 60, 75, 90].map((tempo) => {
      const r = gerar(manual(series, { tempoPorSessaoMin: tempo }));
      return { series, tempo, r };
    })).filter(({ r }) => r.duracaoDias?.some((d) => d.estadoLimite === 'DENTRO_DA_TOLERANCIA'));
    expect(achados.length, 'nenhum caso na tolerância — a afirmação abaixo seria vazia').toBeGreaterThan(0);
    for (const { series, tempo, r } of achados) {
      const outros = (r.duracaoDias ?? []).filter((d) => d.estadoLimite !== 'DENTRO_DA_TOLERANCIA' && d.estadoLimite !== 'DENTRO_DO_LIMITE');
      if (outros.length > 0) continue; // dia na tolerância convivendo com outro fora dela
      expect(r.resultadoGeracao?.tipo, `${series} séries / ${tempo} min`).toBe('CERTIFICADO');
    }
  });
});

describe('D12 · estado combinado: cardio sem duração + dia que pode estourar', () => {
  /** Objetivo `massa` prescreve cardio em SESSÕES (sem minutos): o terminal vira NAO_AVALIADO. */
  const rotina = gerar(manual(6, { objetivo: 'massa', diasDisponiveis: 2, treinoDias: ['seg', 'qua'] }), 1, ['qua']);

  it('os dois fatos convivem no mesmo terminal — nenhum é suprimido pelo outro', () => {
    const rg = rotina.resultadoGeracao!;
    expect(rg.tipo).toBe('NAO_AVALIADO_ENTREGAVEL');
    if (rg.tipo !== 'NAO_AVALIADO_ENTREGAVEL') return;
    expect(rg.motivos).toContain('CARDIO_SEM_DURACAO');
    expect(rg.diasPodemUltrapassar, 'o dia incerto sumiu ao encontrar o cardio').toEqual([0]);
  });

  it('a frase carrega os dois, e nenhum deles vira afirmação de excesso', () => {
    const v = vereditoDoPlano(rotina, 60)!;
    expect(v.detalhe).toMatch(/cardio sem duração definida/);
    expect(v.detalhe).toMatch(/pode passar do seu tempo/);
    expect(v.detalhe).not.toMatch(/acima do limite/i);
  });
});

describe('D12 · salvar e recarregar não troca o rótulo', () => {
  it('o terminal e a frase sobrevivem ao round-trip do perfil salvo', () => {
    const perfil = manual(6);
    const antes = gerar(perfil);
    const recarregado = migrarSessao(JSON.stringify({ v: 2, perfil }))!.perfil;
    const depois = gerar(recarregado);
    expect(depois.resultadoGeracao).toEqual(antes.resultadoGeracao);
    expect(vereditoDoPlano(depois, 60)).toEqual(vereditoDoPlano(antes, 60));
    expect(depois.resultadoGeracao?.tipo).not.toBe('CERTIFICADO');
  });
});

describe('D12 · a invariante unificada, nos dois produtores', () => {
  const PERFIS: readonly [string, PerfilResumo][] = [
    ['manual · 6 séries', manual(6)],
    ['manual · 3 séries', manual(3)],
    ['manual · 99 séries', manual(99)],
    ['manual · 10 min', manual(4, { tempoPorSessaoMin: 10 })],
    ['automático · 60 min / 4 dias', base({ diasDisponiveis: 4, treinoDias: ['seg', 'ter', 'qui', 'sex'] })],
    ['automático · 10 min / 1 dia', base({ tempoPorSessaoMin: 10 })],
    ['automático · 90 min / 6 dias', base({ nivelExperiencia: 'avancado', tempoPorSessaoMin: 90, diasDisponiveis: 6, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'] })],
    ['automático · casa sem equipamento', base({ equipamento: 'casa', equipamentosCasa: [], tempoPorSessaoMin: 30 })],
  ];

  it.each(PERFIS)('%s: CERTIFICADO ⇒ nenhum dia fora de DENTRO_DO_LIMITE/DENTRO_DA_TOLERANCIA', (_n, perfil) => {
    for (const semana of [1, 5, 6] as const) {
      const r = gerar(perfil, semana);
      if (r.resultadoGeracao?.tipo !== 'CERTIFICADO') continue;
      const fora = (r.duracaoDias ?? [])
        .map((d, i) => ({ i, e: d.estadoLimite }))
        .filter(({ e }) => e !== 'DENTRO_DO_LIMITE' && e !== 'DENTRO_DA_TOLERANCIA');
      expect(fora.map((f) => `semana ${semana} · dia ${f.i}: ${f.e}`)).toEqual([]);
    }
  });

  it('a fonte da condição é uma só: o guard de `finalizar` cobre os dois ramos', () => {
    const r = gerar(manual(6));
    // O ramo manual não passa por `precisaReduzir`; o que o rebaixa é o guard compartilhado.
    expect(r.resultadoGeracao?.tipo).toBe('ENTREGUE_SEM_CERTIFICACAO');
    const auto = gerar(base({ tempoPorSessaoMin: 10 }));
    // O automático degrada pelo reduce-to-fit; quando não consegue, o rótulo também é honesto.
    if (auto.resultadoGeracao?.tipo === 'CERTIFICADO') {
      expect((auto.duracaoDias ?? []).every((d) => d.estadoLimite === 'DENTRO_DO_LIMITE' || d.estadoLimite === 'DENTRO_DA_TOLERANCIA')).toBe(true);
    }
  });
});

/** Guard de fio: o exercício-fixture precisa existir, senão o desenho manual vira outro caso. */
it('as fixtures do desenho manual existem no seed', () => {
  for (const id of IDS) expect(EXERCISES_SEED.some((e) => e.id === id), id).toBe(true);
});
