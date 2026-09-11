import { describe, expect, it } from 'vitest';
import { formatarDuracaoMinutos } from './formatar-duracao';
describe('duracao apresentada', () => {
  it.each([[25.333333333333332, '25 min 20 s'], [12.666666666666666, '12 min 40 s'], [23, '23 min'], [59.9999, '60 min'], [0.5, '30 s']])('formata %s sem residuos decimais', (valor, texto) => {
    expect(formatarDuracaoMinutos(valor as number)).toBe(texto);
  });
});
