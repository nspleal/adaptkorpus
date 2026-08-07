/**
 * 🔴 ACEITE 5 da leva de importação — o que dá nome à leva.
 *
 * Fonte: outputs/handoff-leva-importacao-pratos-2026-08-06 §"Critério de aceite" nº 5, que
 * fecha o gargalo medido em 2026-08-01: o padrão vegano entregava ~90 g de proteína onde o
 * corte F70 pede 126, com a paleta suportando 139. Os 11 pratos (p97–p107) existem para isso.
 *
 * 🔑 POR QUE OS ALVOS SÃO INJETADOS, e não derivados de um perfil. Os 6 kcal_alvo de
 * calibração são do COFRE (a curadoria vegana provou o teto combinatório neles). O gate deste
 * app produz kcal-alvo próprias, que NÃO coincidem com essas seis (divergência real, reportada
 * ao autor e fora do escopo desta leva). O aceite fala do MONTADOR — "para os 6 kcal_alvo …
 * o montador fecha o dia com proteína ≥ piso" —, então o montador é alimentado com eles
 * diretamente. É o teste que o aceite pede, sem fingir que o gate os produz.
 */
import { describe, expect, it } from 'vitest';
import { montarCardapioDia } from './assembler';
import { JANELA_OBJETIVO } from './constants';
import { RECIPES_SEED, FOODS_BY_ID_SEED } from '../data/seed';
import type { PlanoDieta } from './types';

/** Os 6 de calibração: kcal-alvo · piso de proteína do objetivo · objetivo (define a janela). */
const CALIBRACAO = [
  { nome: 'F60', kcal: 1575, piso: 96, objetivo: 'emagrecimento' as const },
  { nome: 'F70', kcal: 1730, piso: 112, objetivo: 'emagrecimento' as const },
  { nome: 'M70', kcal: 2055, piso: 112, objetivo: 'emagrecimento' as const },
  { nome: 'M80', kcal: 2230, piso: 128, objetivo: 'emagrecimento' as const },
  { nome: 'M80manut', kcal: 2710, piso: 96, objetivo: 'saude' as const },
  { nome: 'M90massa', kcal: 3550, piso: 144, objetivo: 'massa' as const },
];

function plano(kcal: number, piso: number, objetivo: 'emagrecimento' | 'saude' | 'massa'): PlanoDieta {
  // A janela do montador é a razão do objetivo aplicada ao alvo (constants.ts, JANELA_OBJETIVO).
  const j = JANELA_OBJETIVO[objetivo];
  const get = kcal / ((j.min + j.max) / 2);
  return {
    comportamento: 'PERMITIR',
    kcalAlvo: kcal,
    /**
     * ⚠️ ASSIMETRIA ENCONTRADA NESTA LEVA: `proteinaPisoG` é o piso real do plano (1,6 g/kg —
     * diet.ts:66) e é tratado como trava DURA pela SUBSTITUIÇÃO (substituicao.ts:64), mas o
     * MONTADOR não o lê: ele só mira `proteinaG` (assembler.ts:193). Na prática não morde,
     * porque diet.ts:85 eleva `proteinaG` ao piso quando fica abaixo — mas montar e substituir
     * não obedecem à mesma trava, e isso é achado, não detalhe. Reportado ao autor.
     */
    macros: { proteinaG: piso, proteinaPisoG: piso, gorduraG: 0, carboidratoG: 0, kcalProteina: 0, kcalGordura: 0, kcalCarboidrato: 0 },
    janela: { minKcal: get * j.min, maxKcal: get * j.max },
    derivados: {} as PlanoDieta['derivados'],
    motivos: [],
    avisos: [],
  };
}

/**
 * ⚠️ O MONTADOR MIRA A PROTEÍNA, NÃO A USA COMO PISO (assembler.ts:193 — `alvoProt` entra em
 * `protDev`, minimizado). Sondado antes de escrever este arquivo: alimentando o alvo com um
 * valor inalcançável (9999), o montador entrega o MÁXIMO combinatório daquele kcal; com um
 * valor baixo, entrega perto dele. Consequência de método: um teste que passasse o piso como
 * alvo E depois conferisse "entregue ≥ piso" seria quase circular — mediria o otimizador
 * acertando o número que ele mesmo recebeu, e passaria com qualquer piso alcançável.
 *
 * Por isso o aceite é provado pelo TETO: quanto de proteína o catálogo vegano CONSEGUE
 * entregar naquela kcal. É o número que a curadoria calculou, e é falsificável.
 */
const TETO_INALCANCAVEL = 9999;

function tetoProteico(kcal: number, objetivo: 'emagrecimento' | 'saude' | 'massa', catalogo = RECIPES_SEED): number {
  return montarCardapioDia(plano(kcal, TETO_INALCANCAVEL, objetivo), catalogo, FOODS_BY_ID_SEED, {
    alergenos: [], preferencia: 'vegano',
  }).totais.proteinaG;
}

describe('🔴 aceite 5 — vegano cheio fecha a proteína nos 6 alvos de calibração', () => {
  it('o teto proteico do vegano supera o piso do objetivo, com folga ≥ 15%', () => {
    const linhas: string[] = [];
    const falhas: string[] = [];
    for (const c of CALIBRACAO) {
      const teto = tetoProteico(c.kcal, c.objetivo);
      const folga = ((teto - c.piso) / c.piso) * 100;
      linhas.push(`${c.nome.padEnd(9)} alvo ${String(c.kcal).padStart(4)} · piso ${String(c.piso).padStart(3)} · teto ${teto.toFixed(1).padStart(6)} (folga ${folga.toFixed(0)}%)`);
      if (teto < c.piso) falhas.push(`${c.nome}: teto ${teto.toFixed(1)} < piso ${c.piso}`);
      // "o piso agora tem folga mínima de 15%" — handoff §aceite 5.
      if (folga < 15) falhas.push(`${c.nome}: folga ${folga.toFixed(0)}% < 15%`);
    }
    expect(falhas, `\n${linhas.join('\n')}\n`).toEqual([]);
  });

  it('pedido o piso, o montador entrega o piso — kcal na janela e sem não-fechamento', () => {
    const falhas: string[] = [];
    for (const c of CALIBRACAO) {
      const p = plano(c.kcal, c.piso, c.objetivo);
      const cardapio = montarCardapioDia(p, RECIPES_SEED, FOODS_BY_ID_SEED, { alergenos: [], preferencia: 'vegano' });
      // Tolerância de 0,01 g: o otimizador converge ao alvo por baixo (95,999858 para 96) —
      // é o mínimo de |prot − alvo|, não um déficit nutricional.
      if (cardapio.totais.proteinaG < c.piso - 0.01) falhas.push(`${c.nome}: proteína ${cardapio.totais.proteinaG.toFixed(3)} abaixo do piso ${c.piso}`);
      if (cardapio.status !== 'ok') falhas.push(`${c.nome}: status ${cardapio.status} (${cardapio.nota ?? 'sem nota'})`);
      if (cardapio.totais.kcal < p.janela.minKcal || cardapio.totais.kcal > p.janela.maxKcal)
        falhas.push(`${c.nome}: kcal ${cardapio.totais.kcal.toFixed(0)} fora de ${p.janela.minKcal.toFixed(0)}–${p.janela.maxKcal.toFixed(0)}`);
    }
    expect(falhas).toEqual([]);
  });

  /**
   * 🔑 O PAR DISCRIMINANTE da leva. Sem ele, os testes acima poderiam estar passando por
   * mérito do catálogo antigo e a importação não teria prova de ter servido para nada.
   *
   * Reproduz o gargalo medido em 2026-08-01: o F70 antigo entrega 89,7 g — o "~90 g onde o
   * corte pede 126" que originou a curadoria vegana.
   */
  it('🔑 par discriminante: SEM os 11 pratos, 4 dos 6 perfis não alcançam o piso', () => {
    const antigos = RECIPES_SEED.filter((r) => Number(r.id.slice(1)) <= 96);
    expect(antigos).toHaveLength(96);
    const quebras = CALIBRACAO.filter((c) => tetoProteico(c.kcal, c.objetivo, antigos) < c.piso).map((c) => c.nome);
    expect(quebras, 'o catálogo antigo passou a fechar — este teste perdeu o poder de discriminar')
      .toEqual(['F60', 'F70', 'M70', 'M80']);
    // A âncora do gargalo que originou a leva (cofre, medição de 2026-08-01).
    expect(tetoProteico(1730, 'emagrecimento', antigos)).toBeCloseTo(89.7, 1);
  });

  /**
   * Os tetos que a curadoria vegana calculou (handoff §aceite 5). 5 dos 6 reproduzem exato no
   * motor do app.
   *
   * ⚠️ F70 diverge: a curadoria diz 136,4 e o app alcança 138,6 — o app chega MAIS ALTO que o
   * teto publicado. Não afeta aceite nenhum (o piso é 112, folga de 24%), mas é divergência
   * contra número do cofre e está reportada ao autor. O valor ancorado aqui é o MEDIDO; quando
   * o autor conciliar, é este número que muda.
   */
  it('os tetos reproduzem os da curadoria vegana', () => {
    const medido = (nome: string) => {
      const c = CALIBRACAO.find((x) => x.nome === nome)!;
      return tetoProteico(c.kcal, c.objetivo);
    };
    expect(medido('F60')).toBeCloseTo(124.1, 1);
    expect(medido('M70')).toBeCloseTo(162.0, 1);
    expect(medido('M80')).toBeCloseTo(175.8, 1);
    expect(medido('M80manut')).toBeCloseTo(209.3, 1);
    expect(medido('M90massa')).toBeCloseTo(219.6, 1);
    expect(medido('F70'), 'F70: curadoria diz 136,4 — divergência reportada').toBeCloseTo(138.6, 1);
  });

  /**
   * 🔴 Aceite 4 do handoff da leva H antecipado como regressão aqui: alérgeno é o filtro
   * ABSOLUTO, e 9 dos 11 novos levam soja. Quem declara alergia a soja não pode receber
   * nenhum deles — e ainda pode receber o 105/106.
   */
  it('🔴 alergia a soja: nenhum dos 9 aparece, e o cardápio ainda fecha', () => {
    for (const c of CALIBRACAO) {
      const cardapio = montarCardapioDia(plano(c.kcal, c.piso, c.objetivo), RECIPES_SEED, FOODS_BY_ID_SEED, {
        alergenos: ['soja'], preferencia: 'vegano',
      });
      for (const it of cardapio.itens) {
        expect(it.prato.contemAlergenos, `${c.nome}: ${it.prato.id} tem soja`).not.toContain('soja');
      }
      expect(cardapio.status, `${c.nome}: alérgico a soja ficou sem cardápio`).not.toBe('sem_candidatos');
    }
  });
});
