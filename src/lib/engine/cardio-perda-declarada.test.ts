import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recomputarPlano } from '@/lib/plano';
import { formatarDuracaoMinutos } from '@/lib/formatar-duracao';
import { arredondar5, duracaoDoDiaDeCardio, TETO_MIN_DIA_CARDIO } from './dia-de-cardio';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { Weekday } from '@/lib/semana';

/**
 * 🔴 Histórico D4 (2026-09-10) → decisão do autor de 2026-09-23.
 *
 * Em D4 o cardio era cortado pela sobra do orçamento de cada sessão e a perda passou a ser DITA.
 * Medido no SHA `34b2ede`, objetivo `emagrecimento`, treino seg/qua/sex, 60 min:
 *
 * | oferta | prescrito | entregue (contrato antigo) |
 * |---|---|---|
 * | 1 dia  | 5.400 s (90 min) | 3.600 s (60 min) |
 * | 2 dias | 9.000 s (150 min) | 7.200 s (120 min) |
 * | 4 dias | 9.600 s (160 min) | 7.380 s (123 min) |
 *
 * A decisão de 2026-09-23 remove a causa: o tempo do perfil é só da musculação e o cardio
 * conserva a duração prescrita. As mesmas ofertas agora entregam o prescrito inteiro, sem aviso
 * de falta — e o cartão do Painel continua usando a prescrição como denominador.
 */

const base = (o: Record<string, unknown> = {}): PerfilResumo => ({
  sexo: 'masculino', idade: 30, alturaCm: 178, pesoKg: 80,
  nivelAtividade: 'moderado', objetivo: 'emagrecimento',
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: [],
  diasDisponiveis: 3, treinoDias: ['seg', 'qua', 'sex'], tempoPorSessaoMin: 60,
  alergenos: [], preferencia: null, naoCurto: [], pratosCansados: [], favoritos: [], ...o,
} as unknown as PerfilResumo);

const gerar = (dias: readonly Weekday[], o: Record<string, unknown> = {}) =>
  recomputarPlano(base(o), { semanaCiclo: { semana: 1 }, diasOferecidosCardio: dias }).treino.rotina!;

/** As três ofertas medidas no diagnóstico D4, pelos mesmos dias. */
const OFERTAS: readonly [string, readonly Weekday[], number][] = [
  ['1 dia (dom)', ['dom'], 5400],
  ['2 dias (sab, dom)', ['sab', 'dom'], 9000],
  ['4 dias (ter, qua, sex, dom)', ['ter', 'qua', 'sex', 'dom'], 9600],
];

describe('cardio sem perda: o prescrito é entregue inteiro (decisão 2026-09-23)', () => {
  it.each(OFERTAS)('%s: prescrito = soma dos blocos = medida do D4, sem corte', (_nome, dias, prescrito) => {
    const r = gerar(dias);
    expect(r.cardioSemana).toEqual({ prescritoSegundos: prescrito });
    const somaBlocos = (r.distribuicaoCardio?.blocosPorDia ?? []).reduce((n, b) => n + b.duracaoTotalSegundos, 0);
    expect(somaBlocos).toBe(prescrito);
  });

  it.each(OFERTAS)('%s: nenhum aviso de cardio que "não coube"', (_nome, dias) => {
    const r = gerar(dias);
    expect(r.avisos.filter((a) => /cardio/i.test(a) && /faltam|couberam|não coube/i.test(a))).toEqual([]);
  });

  it('sem dia oferecido não há prescrição de cardio', () => {
    const r = gerar([]);
    expect(r.cardioSemana).toBeUndefined();
    expect(r.distribuicaoCardio?.blocosPorDia).toEqual([]);
  });
});

describe('a apresentação preserva a duração calculada (nada é alterado em silêncio)', () => {
  it.each(OFERTAS)('%s: `minutos` e `duracaoSegundos` são o MESMO valor', (_nome, dias) => {
    for (const c of gerar(dias).diasCardio ?? []) {
      if (c.minutos == null) continue;
      expect(Math.round(c.minutos * 60), `${c.diaId}: ${c.minutos} min ≠ ${c.duracaoSegundos} s`)
        .toBe(c.duracaoSegundos);
    }
  });

  it('a formatação de um bloco fracionário é legível e não perde segundo', () => {
    // 760 s = 12,666… min — o valor que aparecia cru na vista da UI.
    expect(formatarDuracaoMinutos(760 / 60)).toBe('12 min 40 s');
    expect(formatarDuracaoMinutos(2400 / 60)).toBe('40 min');
  });

  /**
   * 🏷️ A régua "múltiplo de 5, empate para cima, teto 90" (`dia-de-cardio.ts`, DF 2026-08-01) é
   * a regra de PRESCRIÇÃO e o único teto aprovado do cardio. O tempo da musculação não é teto.
   */
  it('a PRESCRIÇÃO por dia continua múltipla de 5 e limitada ao teto próprio do cardio', () => {
    for (const dias of [1, 2, 3, 4, 5, 6, 7]) {
      for (const meta of [150, 160, 200, 300]) {
        const d = duracaoDoDiaDeCardio(meta, dias);
        expect(d % 5, `meta ${meta} ÷ ${dias} = ${d}`).toBe(0);
        expect(d).toBeLessThanOrEqual(TETO_MIN_DIA_CARDIO);
      }
    }
    expect(arredondar5(37.5)).toBe(40); // empate para cima, como a regra registrada diz
  });

  it('a ENTREGA de cada dia é EXATAMENTE a prescrição daquele dia', () => {
    for (const [, dias] of OFERTAS) {
      const r = gerar(dias);
      const prescritoPorDia = duracaoDoDiaDeCardio(
        (r.cardio.tipo === 'minutos_semana' ? r.cardio.min : 0), dias.length) * 60;
      const blocos = r.distribuicaoCardio?.blocosPorDia ?? [];
      expect(blocos.map((b) => b.diaId)).toEqual([...dias]);
      for (const b of blocos) expect(b.duracaoTotalSegundos, b.diaId).toBe(prescritoPorDia);
    }
  });
});

describe('D10 — política dos blocos curtos: registrada, e sem piso novo', () => {
  /**
   * 🏷️ DECISÃO REGISTRADA (2026-09-10): o cofre **não registra piso por bloco de cardio**
   * (`MATRIZ-REGRAS` §E: "não existe regra registrada"). Desde 2026-09-23 um bloco curto só nasce
   * da própria prescrição (ex.: 7 dias oferecidos ⇒ 20 min), nunca da sobra do treino. Este teste
   * trava a ausência de piso: se alguém introduzir um, ele cai em vermelho e a decisão volta à mesa.
   */
  it('nenhum piso por bloco existe no código da distribuição de cardio', () => {
    const fonte = ['distribuicao-cardio-semana.ts', 'treino-cardio-semana.ts', 'dia-de-cardio.ts']
      .map((f) => readFileSync(join(process.cwd(), 'src', 'lib', 'engine', f), 'utf8'))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
    expect(/PISO_(MIN_)?BLOCO|MIN_BLOCO_CARDIO|blocoMinimo/i.test(fonte),
      'apareceu um piso por bloco — decisão de produto, não conserto silencioso').toBe(false);
  });

  it('a oferta de 7 dias emite 7 blocos de 20 min, sem agrupar nem descartar', () => {
    const r = gerar(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
    expect((r.distribuicaoCardio?.blocosPorDia ?? []).map((b) => b.duracaoTotalSegundos)).toEqual(Array(7).fill(1200));
  });
});
