import {it,expect} from 'vitest';
import {montarSemana,sessaoDeHojeIdx} from './semana';
it('dia explícito e índice da sessão sobrevivem à mudança de disponibilidade e ordem manual', () => {
  const agenda = montarSemana(['seg'], ['Sexta', 'Quarta'], 4, [], ['sex', 'qua']);
  expect(agenda[0]!.sessionIdx).toBeUndefined();
  expect(agenda[4]!.sessionIdx).toBe(0);
  expect(agenda[2]!.sessionIdx).toBe(1);
  expect(sessaoDeHojeIdx(['seg'], ['Sexta', 'Quarta'], 4, [], ['sex', 'qua'])).toBe(0);
});
