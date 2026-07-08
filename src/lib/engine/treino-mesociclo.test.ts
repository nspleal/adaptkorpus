/**
 * Mesociclo v2 — testes ancorados na spec (cofre parametros-motor-treino
 * §"v2 — decisões travadas" + outputs/handoff-motor-treino-v2, DFs 2026-07-08).
 */
import { describe, expect, it } from 'vitest';
import { VOLUME_NIVEL } from './treino-constants';
import { alvoDaSemana, estadoDoCiclo, isoMaisDias, rirAlvoDaSemana, semanaDoCiclo } from './treino-mesociclo';
import type { SemanaCiclo } from './treino-types';

const SEMANAS_RAMPA: SemanaCiclo[] = [1, 2, 3, 4, 5];

describe('semanaDoCiclo', () => {
  it('deriva a semana da âncora: 0d→1, 6d→1, 7d→2, 35d→6, 41d→6', () => {
    expect(semanaDoCiclo('2026-01-05', '2026-01-05')).toBe(1);
    expect(semanaDoCiclo('2026-01-05', '2026-01-11')).toBe(1);
    expect(semanaDoCiclo('2026-01-05', '2026-01-12')).toBe(2);
    expect(semanaDoCiclo('2026-01-05', '2026-02-09')).toBe(6); // 35 dias
    expect(semanaDoCiclo('2026-01-05', '2026-02-15')).toBe(6); // 41 dias
  });

  it('dá wrap no fim do deload: dia 42 → semana 1 (reinício sem escrita)', () => {
    expect(semanaDoCiclo('2026-01-05', '2026-02-16')).toBe(1); // 42 dias
    expect(semanaDoCiclo('2026-01-05', '2026-02-23')).toBe(2); // 49 dias
  });

  it('âncora no futuro ou ISO inválida → semana 1 (guard do módulo negativo do JS)', () => {
    expect(semanaDoCiclo('2026-03-01', '2026-01-05')).toBe(1);
    expect(semanaDoCiclo('não-é-data', '2026-01-05')).toBe(1);
  });
});

describe('alvoDaSemana (rampa dentro das faixas do v1 — tabela 1.2, sem tabela nova)', () => {
  it('avançado/massa {16,20}: semanas 1–5 → 16,17,18,19,20 (piso → topo)', () => {
    const banda = VOLUME_NIVEL.avancado.volumePorGrupoSemana.massa;
    expect(SEMANAS_RAMPA.map((s) => alvoDaSemana(banda, s))).toEqual([16, 17, 18, 19, 20]);
  });

  it('nunca ultrapassa o topo (banda estreita clampa cedo e segura)', () => {
    const banda = VOLUME_NIVEL.iniciante.volumePorGrupoSemana.massa; // {10,12}
    expect(SEMANAS_RAMPA.map((s) => alvoDaSemana(banda, s))).toEqual([10, 11, 12, 12, 12]);
  });

  it('banda larga (> 4) sobe +2/semana (futuro-prova; tabela 1.2 atual nunca aciona)', () => {
    expect(SEMANAS_RAMPA.map((s) => alvoDaSemana({ min: 10, max: 20 }, s))).toEqual([10, 12, 14, 16, 18]);
  });

  it("'segura' (feedback agregado do grupo) usa o alvo da semana anterior; semana 1 fica no piso", () => {
    const banda = VOLUME_NIVEL.avancado.volumePorGrupoSemana.massa;
    expect(alvoDaSemana(banda, 4, 'segura')).toBe(alvoDaSemana(banda, 3));
    expect(alvoDaSemana(banda, 1, 'segura')).toBe(banda.min);
  });

  it('todo alvo fica DENTRO da banda em todos os cenários nível × objetivo', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
      for (const obj of ['saude', 'massa', 'emagrecimento'] as const) {
        const banda = VOLUME_NIVEL[nivel].volumePorGrupoSemana[obj];
        for (const s of SEMANAS_RAMPA) {
          const alvo = alvoDaSemana(banda, s);
          expect(alvo).toBeGreaterThanOrEqual(banda.min);
          expect(alvo).toBeLessThanOrEqual(banda.max);
        }
      }
    }
  });
});

describe('rirAlvoDaSemana (rampa 3→1; pisos por cima; nunca 0)', () => {
  it('massa interm./avançado (piso 1): 3,3,2,2,1; deload (sem. 6) volta a 3', () => {
    const rir = { min: 1, max: 3 };
    expect([1, 2, 3, 4, 5, 6].map((s) => rirAlvoDaSemana(rir, s as SemanaCiclo))).toEqual([3, 3, 2, 2, 1, 3]);
  });

  it('iniciante nunca < 2 (piso RIR_MIN_INICIANTE já embutido na prescrição)', () => {
    const rir = { min: 2, max: 3 }; // prescrição de iniciante/massa
    expect([1, 2, 3, 4, 5].map((s) => rirAlvoDaSemana(rir, s as SemanaCiclo))).toEqual([3, 3, 2, 2, 2]);
  });

  it('objetivo saúde (piso 2) nunca desce abaixo de 2; nunca 0 em cenário algum', () => {
    const rir = { min: 2, max: 4 };
    for (const s of [1, 2, 3, 4, 5, 6] as SemanaCiclo[]) {
      const alvo = rirAlvoDaSemana(rir, s);
      expect(alvo).toBeGreaterThanOrEqual(2);
      expect(alvo).toBeGreaterThan(0);
    }
  });
});

describe('estadoDoCiclo (agendado sem. 6 universal + reativo que reancora)', () => {
  it('sem âncora (1º uso / conta migrada) → semana 1 e novaAncora = hoje', () => {
    const r = estadoDoCiclo({ mesocicloInicioISO: null, hojeISO: '2026-07-08', sinaisFadiga: false });
    expect(r).toEqual({ semanaEfetiva: 1, deload: false, novaAncoraISO: '2026-07-08' });
  });

  it('semana 6 → deload agendado para TODOS os níveis (mesociclo universal, DF 2026-07-08)', () => {
    // A derivação não depende de nível: a mesma âncora deloada iniciante e avançado.
    const r = estadoDoCiclo({ mesocicloInicioISO: '2026-06-01', hojeISO: '2026-07-06', sinaisFadiga: false }); // 35 d
    expect(r.semanaEfetiva).toBe(6);
    expect(r.deload).toBe(true);
    expect(r.novaAncoraISO).toBeUndefined();
  });

  it('fadiga na semana 3 → deload IMEDIATO (sem. 6) + reancora hoje − 35 d; sem. 1 em 7 dias', () => {
    const hoje = '2026-07-08';
    const ancoraSem3 = isoMaisDias(hoje, -16); // 16 d → semana 3
    const r = estadoDoCiclo({ mesocicloInicioISO: ancoraSem3, hojeISO: hoje, sinaisFadiga: true });
    expect(r.semanaEfetiva).toBe(6);
    expect(r.deload).toBe(true);
    expect(r.novaAncoraISO).toBe(isoMaisDias(hoje, -35));
    // Com a âncora nova, hoje + 7 dias cai na semana 1 (ciclo novo, volume no piso).
    expect(semanaDoCiclo(r.novaAncoraISO!, isoMaisDias(hoje, 7))).toBe(1);
  });

  it('fadiga JÁ na semana 6 não reancora de novo (deload segue o curso)', () => {
    const r = estadoDoCiclo({ mesocicloInicioISO: '2026-06-01', hojeISO: '2026-07-06', sinaisFadiga: true });
    expect(r.semanaEfetiva).toBe(6);
    expect(r.deload).toBe(true);
    expect(r.novaAncoraISO).toBeUndefined();
  });

  it('ciclo dá wrap: âncora + 42 d → semana 1 com deload desligado (rampa reseta ao piso)', () => {
    const r = estadoDoCiclo({ mesocicloInicioISO: '2026-06-01', hojeISO: '2026-07-13', sinaisFadiga: false }); // 42 d
    expect(r.semanaEfetiva).toBe(1);
    expect(r.deload).toBe(false);
  });
});
