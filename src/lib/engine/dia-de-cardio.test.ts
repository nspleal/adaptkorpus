import { describe, expect, it } from 'vitest';
import { arredondar5, conteudoDoDiaExcedente, duracaoDoDiaDeCardio, MODALIDADE_PADRAO_DIA, TETO_MIN_DIA_CARDIO } from './dia-de-cardio';
import { metaCardioComRetomada, metaCardioSemanal } from './cardio';

/**
 * Dia excedente = dia de cardio — spec §🏃 (2026-07-31).
 * Os números vêm das metas JÁ TRAVADAS do cardio, nunca de constante nova aqui.
 */

const opcoes = { diasExcedentes: 1, roteado: false };

describe('arredondamento a 5 min', () => {
  it('arredonda para o múltiplo de 5 mais próximo, com piso de 5', () => {
    expect(arredondar5(37.5)).toBe(40);
    expect(arredondar5(36)).toBe(35);
    expect(arredondar5(1)).toBe(5);
    expect(arredondar5(0)).toBe(0);
    expect(arredondar5(Number.NaN)).toBe(0);
  });
});

describe('a duração sai da meta travada dividida pelos dias', () => {
  it('saúde (150 min) em 2 dias excedentes → 75 min', () => {
    const meta = metaCardioSemanal('saude', false);
    expect(meta).toEqual({ tipo: 'minutos', alvo: 150 });
    expect(conteudoDoDiaExcedente({ ...opcoes, meta, diasExcedentes: 2 }))
      .toEqual({ tipo: 'cardio', minutos: 75, modalidade: 'caminhada' });
  });

  it('emagrecimento em 3 dias → o alvo dividido, arredondado a 5', () => {
    const meta = metaCardioSemanal('emagrecimento', false)!;
    const esperado = arredondar5(meta.alvo / 3);
    expect(esperado % 5, 'a duração precisa cair num múltiplo de 5').toBe(0);
    expect(conteudoDoDiaExcedente({ ...opcoes, meta, diasExcedentes: 3 }))
      .toEqual({ tipo: 'cardio', minutos: esperado, modalidade: 'caminhada' });
  });

  it('a modalidade default é caminhada, e é a da spec', () => {
    expect(MODALIDADE_PADRAO_DIA).toBe('caminhada');
    const meta = metaCardioSemanal('saude', false);
    const r = conteudoDoDiaExcedente({ ...opcoes, meta, modalidade: 'bike' });
    // 🔻 90, não 150: com UM dia excedente o teto morde (ver o bloco do teto abaixo).
    expect(r).toEqual({ tipo: 'cardio', minutos: 90, modalidade: 'bike' });
  });
});

describe('🔒 massa: meta em SESSÕES, nunca em minutos', () => {
  const meta = metaCardioSemanal('massa', false)!;

  it('a meta de massa é mesmo em sessões (senão o caso não discrimina)', () => {
    expect(meta.tipo).toBe('sessoes');
  });

  it('com sessões pendentes o dia é cardio SEM duração — não se inventa minuto', () => {
    const r = conteudoDoDiaExcedente({ ...opcoes, meta, sessoesFeitas: 0 });
    expect(r).toEqual({ tipo: 'cardio', minutos: null, modalidade: 'caminhada' });
  });

  it('batidas as sessões, o dia vira RECUPERAÇÃO — que não prescreve nada', () => {
    expect(conteudoDoDiaExcedente({ ...opcoes, meta, sessoesFeitas: meta.alvo }))
      .toEqual({ tipo: 'recuperacao' });
    expect(conteudoDoDiaExcedente({ ...opcoes, meta, sessoesFeitas: meta.alvo + 5 }))
      .toEqual({ tipo: 'recuperacao' });
  });
});

describe('🔒 as três exclusões', () => {
  const meta = metaCardioSemanal('saude', false);

  it('ROTEAR (modo diário) não recebe dia de cardio', () => {
    expect(conteudoDoDiaExcedente({ ...opcoes, meta, roteado: true })).toEqual({ tipo: 'recuperacao' });
    // E o próprio motor já devolve meta nula para quem foi roteado — cinto e suspensório.
    expect(metaCardioSemanal('saude', true)).toBeNull();
  });

  it('sem dia excedente, não há dia a montar', () => {
    expect(conteudoDoDiaExcedente({ ...opcoes, meta, diasExcedentes: 0 })).toEqual({ tipo: 'recuperacao' });
  });

  it('sem meta, recuperação', () => {
    expect(conteudoDoDiaExcedente({ ...opcoes, meta: null })).toEqual({ tipo: 'recuperacao' });
  });
});

describe('🔒 na rampa a duração cai sozinha — sem regra nova', () => {
  it('o mesmo fator que corta o treino corta o dia de cardio', () => {
    const cheia = metaCardioSemanal('saude', false);
    const rampa = metaCardioComRetomada(cheia, 0.5);
    const diaCheio = conteudoDoDiaExcedente({ ...opcoes, meta: cheia, diasExcedentes: 2 });
    const diaRampa = conteudoDoDiaExcedente({ ...opcoes, meta: rampa, diasExcedentes: 2 });
    expect(diaCheio).toEqual({ tipo: 'cardio', minutos: 75, modalidade: 'caminhada' });
    expect(diaRampa).toEqual({ tipo: 'cardio', minutos: 40, modalidade: 'caminhada' });
    // ⚠️ Anti-vacuidade: a rampa precisa mesmo ter mudado a meta de entrada.
    expect(rampa!.alvo).toBeLessThan(cheia!.alvo);
  });

  it('massa na rampa continua em sessões (nunca vira barra de minutos)', () => {
    const rampa = metaCardioComRetomada(metaCardioSemanal('massa', false), 0.5)!;
    expect(rampa.tipo).toBe('sessoes');
    expect(conteudoDoDiaExcedente({ ...opcoes, meta: rampa, sessoesFeitas: 0 }))
      .toEqual({ tipo: 'cardio', minutos: null, modalidade: 'caminhada' });
  });
});

/**
 * 🔒 1.7 — a meta de emagrecimento usa o PISO da faixa (150), não o teto (300).
 *
 * A faixa é 150–300; dividida por 3 dias dá **50 ou 100 min/dia** — um fator 2. O piso é o
 * alvo e o teto é referência, senão o app pede o dobro do que a diretriz mínima manda.
 */
describe('🔒 1.7 — o piso da faixa é o alvo, e o empate arredonda para CIMA', () => {
  it('emagrecimento: alvo 150 (piso), max 300 (referência)', () => {
    const meta = metaCardioSemanal('emagrecimento', false)!;
    expect(meta).toEqual({ tipo: 'minutos', alvo: 150, max: 300 });
    // 🔴 O fator 2 que o erro produziria: 300 ÷ 3 = 100/dia contra 150 ÷ 3 = 50/dia.
    expect(conteudoDoDiaExcedente({ ...opcoes, meta, diasExcedentes: 3 }))
      .toEqual({ tipo: 'cardio', minutos: 50, modalidade: 'caminhada' });
    expect(arredondar5(meta.max! / 3), 'o teto daria o dobro').toBe(100);
  });

  it('o EMPATE do arredondamento vai para cima: 150 ÷ 4 = 37,5 → 40', () => {
    const meta = metaCardioSemanal('emagrecimento', false)!;
    expect(meta.alvo / 4).toBe(37.5);
    expect(arredondar5(37.5), 'empate arredondou para baixo').toBe(40);
    expect(conteudoDoDiaExcedente({ ...opcoes, meta, diasExcedentes: 4 }))
      .toEqual({ tipo: 'cardio', minutos: 40, modalidade: 'caminhada' });
    // Anti-vacuidade: um caso SEM empate continua arredondando para o mais próximo.
    expect(arredondar5(36), '36 não é empate — vai para 35').toBe(35);
    expect(arredondar5(38)).toBe(40);
  });

  it('saúde usa o valor único 150 (não é faixa)', () => {
    expect(metaCardioSemanal('saude', false)).toEqual({ tipo: 'minutos', alvo: 150 });
  });
});

/**
 * 🔴 TETO DE 90 min POR DIA (DF 2026-08-01) — 🏷️ política declarada, não evidência.
 *
 * O defeito veio da MEDIÇÃO da emissão: a fórmula `meta ÷ dias` não tinha teto, e o
 * denominador 1 a quebrava — saúde com 1 dia excedente dava **150 min**, duas horas e meia
 * de caminhada num dia. A meta da OMS é desenhada para ser DISTRIBUÍDA (30 × 5).
 */
describe('🔴 o teto de 90 min/dia — corta o patológico, não redesenha o saudável', () => {
  const saude = metaCardioSemanal('saude', false)!;

  it('o valor é 90 e está declarado como constante', () => {
    expect(TETO_MIN_DIA_CARDIO).toBe(90);
  });

  /** 🔒 ACEITE: saúde · 1 dia excedente → 90, não 150. */
  it('1 dia excedente: 150 → 90 (o caso que quebrava)', () => {
    expect(arredondar5(saude.alvo / 1), 'sem teto seria isto').toBe(150);
    expect(duracaoDoDiaDeCardio(saude.alvo, 1)).toBe(90);
    expect(conteudoDoDiaExcedente({ ...opcoes, meta: saude, diasExcedentes: 1 }))
      .toEqual({ tipo: 'cardio', minutos: 90, modalidade: 'caminhada' });
  });

  /** 🔒 ACEITE, o outro lado do par: 2 dias continua 75, byte-idêntico. */
  it('🔑 INERTE onde a fórmula se comporta: 2 dias → 75, 3 dias → 50', () => {
    expect(duracaoDoDiaDeCardio(saude.alvo, 2), '2 dias mudou').toBe(75);
    expect(duracaoDoDiaDeCardio(saude.alvo, 3), '3 dias mudou').toBe(50);
    // …e são os mesmos números que a divisão crua daria — a prova de que o teto não tocou.
    expect(duracaoDoDiaDeCardio(saude.alvo, 2)).toBe(arredondar5(saude.alvo / 2));
    expect(duracaoDoDiaDeCardio(saude.alvo, 3)).toBe(arredondar5(saude.alvo / 3));
  });

  it('o teto morde SÓ no denominador 1 — varredura de 1 a 7 dias', () => {
    const mordidos = [1, 2, 3, 4, 5, 6, 7].filter(
      (n) => duracaoDoDiaDeCardio(saude.alvo, n) !== arredondar5(saude.alvo / n),
    );
    expect(mordidos, 'o teto passou a redesenhar casos saudáveis').toEqual([1]);
  });

  it('emagrecimento (piso 150) segue a mesma regra, e o teto não muda o piso', () => {
    const emag = metaCardioSemanal('emagrecimento', false)!;
    expect(emag.alvo).toBe(150);
    expect(duracaoDoDiaDeCardio(emag.alvo, 1)).toBe(90);
    expect(duracaoDoDiaDeCardio(emag.alvo, 3)).toBe(50); // inalterado
  });

  it('na rampa a meta já chega menor — o teto simplesmente não morde', () => {
    const rampa = metaCardioComRetomada(saude, 0.5)!;
    expect(rampa.alvo).toBe(75);
    expect(duracaoDoDiaDeCardio(rampa.alvo, 1), 'a rampa passou a ser cortada pelo teto').toBe(75);
  });

  it('entrada absurda não vira duração', () => {
    expect(duracaoDoDiaDeCardio(0, 2)).toBe(0);
    expect(duracaoDoDiaDeCardio(150, 0)).toBe(0);
    expect(duracaoDoDiaDeCardio(Number.NaN, 2)).toBe(0);
  });
});
