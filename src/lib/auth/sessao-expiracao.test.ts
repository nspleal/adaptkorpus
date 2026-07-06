import { describe, expect, it } from 'vitest';
import { EXPIRACAO_PADRAO, expirouSessao } from './sessao-expiracao';

const MIN = 60_000;
const HORA = 60 * MIN;

describe('expirouSessao — idle + absoluta (valores ajustáveis, não travados no cofre)', () => {
  it('ativa e recente → não expira', () => {
    expect(expirouSessao(10 * MIN, 9 * MIN, 0)).toBeNull();
  });

  it('30 min sem interação → idle', () => {
    expect(expirouSessao(31 * MIN, 0, 0)).toBe('idle');
    expect(expirouSessao(29 * MIN, 0, 0)).toBeNull(); // ainda dentro
  });

  it('12 h desde o início → absoluta (mesmo com atividade recente)', () => {
    const agora = 12 * HORA;
    expect(expirouSessao(agora, agora - MIN, 0)).toBe('absoluta');
  });

  it('absoluta tem precedência sobre idle', () => {
    expect(expirouSessao(13 * HORA, 0, 0)).toBe('absoluta');
  });

  it('config custom respeitada', () => {
    expect(expirouSessao(6 * MIN, 0, 0, { idleMs: 5 * MIN, absolutoMs: HORA })).toBe('idle');
  });

  it('defaults ancorados: 30 min / 12 h', () => {
    expect(EXPIRACAO_PADRAO.idleMs).toBe(30 * MIN);
    expect(EXPIRACAO_PADRAO.absolutoMs).toBe(12 * HORA);
  });
});
