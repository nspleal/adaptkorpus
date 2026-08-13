/**
 * 🔢 v4 — secundários da biblioteca (P0.2 do handoff-motor-volume-v4-2026-08-12).
 * A decisão: a biblioteca TEM o dado (coluna `grupoMuscular` da A1) → usa-se ela, não o
 * mapa por padrão do handoff. Estes testes travam a normalização E a cobertura: um token
 * novo na biblioteca não pode entrar em silêncio.
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { PESO_SECUNDARIO, secundariosDe, tokensDesconhecidos } from './secundarios';

const porId = new Map(EXERCISES.map((e) => [e.id, e]));

describe('🔒 normalização dos secundários — da biblioteca, não de memória', () => {
  it('o peso do secundário é a DF① (0,5), e nunca muda sem decisão', () => {
    expect(PESO_SECUNDARIO).toBe(0.5);
  });

  it('casos ancorados: flexão credita tríceps+ombros; remada credita bíceps', () => {
    // e1 Flexão de braço — "Peito, tríceps, ombros" (primário peito).
    expect(secundariosDe(porId.get('e1')!)).toEqual(['triceps', 'ombros']);
    // e22 — costas primário, bíceps secundário ("Costas, bíceps").
    expect(secundariosDe(porId.get('e22')!)).toEqual(['biceps']);
  });

  it('parênteses são qualificadores, nunca crédito: "Ombros (posterior)" NÃO credita posterior de coxa', () => {
    const posteriores = EXERCISES.filter((e) => e.grupoPrimario === 'ombros' && /posterior/i.test(e.grupoMuscular));
    expect(posteriores.length).toBeGreaterThan(0); // anti-vacuidade
    for (const e of posteriores) {
      expect(secundariosDe(e), `${e.id} "${e.grupoMuscular}" creditou posterior de coxa`).not.toContain('posterior');
    }
  });

  it('nenhum exercício credita o próprio primário como secundário', () => {
    for (const e of EXERCISES) {
      expect(secundariosDe(e), `${e.id} credita o próprio primário`).not.toContain(e.grupoPrimario);
    }
  });

  /**
   * 🔒 COBERTURA TOTAL: token da biblioteca fora do mapa = decisão pendente, não descarte
   * silencioso. Se a A1 ganhar um grupo novo ("Trapézio superior"?), este teste fica
   * vermelho e a curadoria decide o destino.
   */
  it('a biblioteca inteira normaliza sem token desconhecido', () => {
    expect(tokensDesconhecidos(EXERCISES)).toEqual([]);
  });

  it('o alcance é real: ~40% da biblioteca carrega ≥ 1 secundário', () => {
    const com = EXERCISES.filter((e) => secundariosDe(e).length > 0).length;
    expect(com).toBeGreaterThanOrEqual(60); // medido em 2026-08-13: 65/163
  });
});
