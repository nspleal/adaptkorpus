import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recomputarPlano } from '@/lib/plano';
import { formatarDuracaoMinutos } from '@/lib/formatar-duracao';
import { arredondar5, duracaoDoDiaDeCardio, TETO_MIN_DIA_CARDIO } from './dia-de-cardio';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { Weekday } from '@/lib/semana';

/**
 * 🔴 D4 + D10 (diagnóstico 2026-09-10, §6.5) — a perda de cardio é DITA, e a política dos
 * blocos curtos fica registrada.
 *
 * Medido no SHA `34b2ede`, objetivo `emagrecimento`, treino seg/qua/sex, 60 min:
 *
 * | oferta | prescrito | entregue | perda | aviso |
 * |---|---|---|---|---|
 * | 1 dia  | 5.400 s (90 min) | 3.600 s (60 min) | 30 min | nenhum |
 * | 2 dias | 9.000 s (150 min) | 7.200 s (120 min) | 30 min | nenhum |
 * | 4 dias | 9.600 s (160 min) | 7.380 s (123 min) | 37 min | nenhum |
 *
 * A perda **já estava medida** em `duracaoDescartadaSegundos` de cada contrato e nunca virava
 * frase. Pior: o cartão de cardio do Painel chamava de `prescritoMin` a SOMA DO ENTREGUE —
 * a barra fechava em 123/123 enquanto a prescrição era 160.
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

/** As três ofertas medidas no diagnóstico, pelos mesmos dias. */
const OFERTAS: readonly [string, readonly Weekday[]][] = [
  ['1 dia (dom)', ['dom']],
  ['2 dias (sab, dom)', ['sab', 'dom']],
  ['4 dias (ter, qua, sex, dom)', ['ter', 'qua', 'sex', 'dom']],
];

describe('D4 — planejado, entregue e faltante saem do motor e fecham a conta', () => {
  it.each(OFERTAS)('%s: o resumo semanal existe e é aritmeticamente coerente', (_nome, dias) => {
    const r = gerar(dias);
    const c = r.cardioSemana;
    expect(c, 'a rotina não expõe o resumo semanal de cardio').toBeDefined();
    expect(c!.prescritoSegundos).toBeGreaterThan(0);
    expect(c!.entregueSegundos + c!.faltanteSegundos).toBe(c!.prescritoSegundos);
    // O entregue é exatamente a soma dos blocos que a tela recebe — não um número paralelo.
    const somaBlocos = (r.distribuicaoCardio?.blocosPorDia ?? []).reduce((n, b) => n + b.duracaoTotalSegundos, 0);
    expect(c!.entregueSegundos).toBe(somaBlocos);
  });

  it('anti-vacuidade: pelo menos uma das ofertas medidas REALMENTE perde minutos', () => {
    const perdas = OFERTAS.map(([nome, dias]) => [nome, gerar(dias).cardioSemana!.faltanteSegundos] as const);
    expect(perdas.filter(([, p]) => p > 0).length, `perdas medidas: ${JSON.stringify(perdas)}`).toBeGreaterThan(0);
  });

  it.each(OFERTAS)('%s: havendo perda, existe aviso que a nomeia com os três números', (_nome, dias) => {
    const r = gerar(dias);
    const { prescritoSegundos, entregueSegundos, faltanteSegundos } = r.cardioSemana!;
    const aviso = r.avisos.find((a) => /cardio/i.test(a) && /faltam|couberam|não coube/i.test(a));
    if (faltanteSegundos === 0) {
      expect(aviso, `sem perda, não pode haver aviso de perda: ${aviso}`).toBeUndefined();
      return;
    }
    expect(aviso, `perda de ${faltanteSegundos}s sem aviso: ${JSON.stringify(r.avisos)}`).toBeDefined();
    for (const n of [prescritoSegundos, entregueSegundos, faltanteSegundos].map((s) => String(Math.round(s / 60)))) {
      expect(aviso, `o aviso não diz ${n} min`).toContain(n);
    }
  });

  it('sem dia oferecido não há prescrição, nem perda, nem aviso', () => {
    const r = gerar([]);
    expect(r.cardioSemana?.prescritoSegundos ?? 0).toBe(0);
    expect(r.avisos.some((a) => /cardio/i.test(a) && /faltam/i.test(a))).toBe(false);
  });

  it('o aviso some quando o cardio cabe inteiro (1 dia oferecido e sessão folgada)', () => {
    const r = gerar(['dom'], { tempoPorSessaoMin: 120 });
    expect(r.cardioSemana!.faltanteSegundos).toBe(0);
    expect(r.avisos.some((a) => /cardio/i.test(a) && /faltam/i.test(a))).toBe(false);
  });
});

describe('D4 — a apresentação preserva a duração calculada (nada é alterado em silêncio)', () => {
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
   * 🏷️ POLÍTICA DE ARREDONDAMENTO, registrada aqui porque o diagnóstico a deixou em aberto.
   *
   * A régua "múltiplo de 5, empate para cima, teto 90" (`dia-de-cardio.ts`) é regra de
   * **PRESCRIÇÃO**: ela decide quanto o app PEDE por dia. Ela continua valendo e é cobrada
   * abaixo. A parcela efetivamente ENTREGUE num dia é outra coisa: é o que sobra do orçamento
   * daquela sessão depois da musculação — um limite físico, não uma prescrição. Arredondá-la
   * para 5 estouraria o orçamento (para cima) ou descartaria minutos que cabiam (para baixo),
   * e as duas violam a direção "não altere minutos para melhorar a aparência".
   *
   * 🔒 Portanto: prescrição arredondada, entrega exata, diferença DITA (bloco acima).
   */
  it('a PRESCRIÇÃO por dia continua múltipla de 5 e limitada ao teto', () => {
    for (const dias of [1, 2, 3, 4, 5, 6, 7]) {
      for (const meta of [150, 160, 200, 300]) {
        const d = duracaoDoDiaDeCardio(meta, dias);
        expect(d % 5, `meta ${meta} ÷ ${dias} = ${d}`).toBe(0);
        expect(d).toBeLessThanOrEqual(TETO_MIN_DIA_CARDIO);
      }
    }
    expect(arredondar5(37.5)).toBe(40); // empate para cima, como a regra registrada diz
  });

  it('a ENTREGA de um dia nunca passa do que foi prescrito para ele', () => {
    for (const [, dias] of OFERTAS) {
      const r = gerar(dias);
      const prescritoPorDia = duracaoDoDiaDeCardio(
        (r.cardio.tipo === 'minutos_semana' ? r.cardio.min : 0), dias.length) * 60;
      for (const b of r.distribuicaoCardio?.blocosPorDia ?? []) {
        expect(b.duracaoTotalSegundos, `${b.diaId} recebeu mais do que o dia prescrevia`)
          .toBeLessThanOrEqual(prescritoPorDia * dias.length);
      }
    }
  });
});

describe('D10 — política dos blocos curtos: registrada, e sem piso novo', () => {
  /**
   * 🏷️ DECISÃO REGISTRADA (2026-09-10). Blocos de 10–13 min em dia de musculação **são
   * mantidos**. Fundamento, na ordem:
   *
   *  1. O tamanho isolado não prova defeito — é o que o orçamento daquele dia comportava
   *     depois da musculação, e o cofre **não registra piso por bloco de cardio**
   *     (`MATRIZ-REGRAS` §E: "não existe regra registrada").
   *  2. Descartar o bloco curto não devolve os minutos a lugar nenhum: ele já é uma parcela
   *     REDISTRIBUÍDA, então descartá-la só AUMENTA a perda semanal — que agora é declarada.
   *  3. Agrupar exigiria mover cardio para um dia que a pessoa não ofereceu, e isso o motor
   *     não faz por regra travada.
   *
   * Um piso só se justifica com fundamento (fisiológico ou de produto) que hoje não existe
   * registrado. Este teste trava a ausência: se alguém introduzir um piso, ele cai em
   * vermelho e a decisão volta à mesa em vez de entrar em silêncio.
   */
  it('nenhum piso por bloco existe no código da distribuição de cardio', () => {
    const fonte = ['distribuicao-cardio-semana.ts', 'treino-cardio-semana.ts', 'dia-de-cardio.ts']
      .map((f) => readFileSync(join(process.cwd(), 'src', 'lib', 'engine', f), 'utf8'))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
    expect(/PISO_(MIN_)?BLOCO|MIN_BLOCO_CARDIO|blocoMinimo/i.test(fonte),
      'apareceu um piso por bloco — decisão de produto, não conserto silencioso').toBe(false);
  });

  it('blocos curtos continuam sendo emitidos, e a perda semanal os explica', () => {
    const r = gerar(['ter', 'qua', 'sex', 'dom']);
    const blocos = r.distribuicaoCardio?.blocosPorDia ?? [];
    expect(blocos.length, 'a oferta de 4 dias deixou de produzir blocos').toBeGreaterThan(1);
    // O que sustenta manter os curtos é a perda estar DITA — sem isso, seriam minutos mudos.
    expect(r.cardioSemana).toBeDefined();
  });
});
