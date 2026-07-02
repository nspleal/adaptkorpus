import { describe, expect, it } from 'vitest';
import { diasDeTreino, diasEntreISO, marco } from './marcos';

describe('marcos de constância (cumulativo, sem streak punitivo)', () => {
  it('conta dias DISTINTOS (duas sessões no mesmo dia = 1 dia)', () => {
    expect(diasDeTreino(['2026-07-01', '2026-07-01', '2026-07-03'])).toBe(2);
    expect(diasDeTreino([])).toBe(0);
  });

  it('progride até o marco de 7', () => {
    expect(marco(0)).toMatchObject({ atual: 0, tier: 7, mode: 'progresso', restantes: 7 });
    expect(marco(4)).toMatchObject({ atual: 4, tier: 7, mode: 'progresso', restantes: 3 });
  });

  it('marco de 7 atingido', () => {
    expect(marco(7)).toMatchObject({ atual: 7, tier: 7, mode: 'atingido', restantes: 0 });
  });

  it('rumo ao nível 2 (30) sem resetar', () => {
    expect(marco(18)).toMatchObject({ atual: 18, tier: 30, mode: 'progresso', restantes: 12 });
    expect(marco(30)).toMatchObject({ atual: 30, tier: 30, mode: 'atingido' });
    expect(marco(45)).toMatchObject({ atual: 30, tier: 30, mode: 'atingido' }); // cap
  });

  it('pós-hiato: pausa não zera nem subtrai — só muda o tom', () => {
    const m = marco(12, 9); // 12 dias acumulados, voltou depois de 9 dias parado
    expect(m).toMatchObject({ atual: 12, tier: 30, mode: 'poshiato' });
    expect(m.atual).toBe(12); // NUNCA volta a 0
  });

  it('celebração tem prioridade sobre hiato', () => {
    expect(marco(7, 30).mode).toBe('atingido');
  });

  it('diasEntreISO conta dias corridos', () => {
    expect(diasEntreISO('2026-07-01', '2026-07-08')).toBe(7);
    expect(diasEntreISO('lixo', '2026-07-08')).toBe(0);
  });
});
