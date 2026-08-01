import { describe, expect, it } from 'vitest';
import { arredondar5, conteudoDoDiaExcedente, MODALIDADE_PADRAO_DIA } from './dia-de-cardio';
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
    expect(r).toEqual({ tipo: 'cardio', minutos: 150, modalidade: 'bike' });
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
