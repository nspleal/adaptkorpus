/**
 * Mesociclo v2 — testes ancorados na spec (cofre parametros-motor-treino
 * §"v2 — decisões travadas" + outputs/handoff-motor-treino-v2, DFs 2026-07-08).
 */
import { describe, expect, it } from 'vitest';
import { VOLUME_NIVEL } from './treino-constants';
import { alvoDaSemana, estadoDoCiclo, isoMaisDias, rirAlvoDaSemana, semanaDoCiclo } from './treino-mesociclo';
import type { SemanaCiclo } from './treino-types';

const SEMANAS_RAMPA: SemanaCiclo[] = [1, 2, 3, 4, 5];

describe('semanaDoCiclo — avança por SEMANA TREINADA, não por calendário (Leva 1B)', () => {
  const ANCORA = '2026-01-05'; // segunda-feira
  /** Data dentro do bucket-semana `n` contado da âncora. */
  const naSemana = (n: number, offsetDias = 1) => isoMaisDias(ANCORA, n * 7 + offsetDias);

  it('conta nova, sem nenhuma sessão → semana 1 (o relógio não corre sozinho)', () => {
    expect(semanaDoCiclo(ANCORA, ANCORA, [])).toBe(1);
    // 35 dias parado: no v2 isto devolvia semana 6; agora segue na 1.
    expect(semanaDoCiclo(ANCORA, isoMaisDias(ANCORA, 35), [])).toBe(1);
  });

  it('treinou na 1ª semana → na semana seguinte o ciclo está na 2', () => {
    expect(semanaDoCiclo(ANCORA, naSemana(1), [naSemana(0)])).toBe(2);
  });

  it('🔴 o caso do beta: treinou 1 semana e PULOU a seguinte → segura na 2 (não pula p/ 3)', () => {
    const sessoes = [naSemana(0)];
    expect(semanaDoCiclo(ANCORA, naSemana(1), sessoes)).toBe(2); // semana seguinte
    expect(semanaDoCiclo(ANCORA, naSemana(2), sessoes)).toBe(2); // pulou uma → SEGURA
    expect(semanaDoCiclo(ANCORA, naSemana(3), sessoes)).toBe(2); // pulou duas → SEGURA
  });

  it('5 semanas com treino → semana 6 (alívio agendado)', () => {
    const sessoes = [0, 1, 2, 3, 4].map((n) => naSemana(n));
    expect(semanaDoCiclo(ANCORA, naSemana(5), sessoes)).toBe(6);
  });

  it('treinar na semana 6 → ciclo novo na semana 1 (wrap por atividade)', () => {
    const sessoes = [0, 1, 2, 3, 4, 5].map((n) => naSemana(n));
    expect(semanaDoCiclo(ANCORA, naSemana(6), sessoes)).toBe(1);
  });

  it('registrar a 1ª sessão da semana CORRENTE não muda a semana (prescrição não salta)', () => {
    const antes = [naSemana(0)];
    const depois = [naSemana(0), naSemana(1, 2)]; // treinou hoje, na semana corrente
    const hoje = naSemana(1, 3);
    expect(semanaDoCiclo(ANCORA, hoje, antes)).toBe(2);
    expect(semanaDoCiclo(ANCORA, hoje, depois)).toBe(2); // idêntico — a corrente é excluída
  });

  it('várias sessões na mesma semana contam UMA vez', () => {
    const tres = [naSemana(0, 1), naSemana(0, 3), naSemana(0, 5)];
    expect(semanaDoCiclo(ANCORA, naSemana(1), tres)).toBe(2);
  });

  it('sessão anterior à âncora não conta; âncora futura / ISO inválida → semana 1', () => {
    expect(semanaDoCiclo(ANCORA, naSemana(1), [isoMaisDias(ANCORA, -3)])).toBe(1);
    expect(semanaDoCiclo('2026-03-01', '2026-01-05', [])).toBe(1);
    expect(semanaDoCiclo('não-é-data', '2026-01-05', [])).toBe(1);
  });

  it('sem `datasSessao` (chamada legada) → semana 1, nunca uma rampa fantasma', () => {
    expect(semanaDoCiclo(ANCORA, isoMaisDias(ANCORA, 35))).toBe(1);
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

describe('estadoDoCiclo (agendado por atividade + reativo com marca explícita)', () => {
  const ANCORA = '2026-01-05';
  const naSemana = (n: number, offsetDias = 1) => isoMaisDias(ANCORA, n * 7 + offsetDias);
  const base = { sinaisFadiga: false, deloadAteISO: null as string | null };

  it('sem âncora (1º uso / conta migrada) → semana 1 e novaAncora = hoje', () => {
    const r = estadoDoCiclo({ ...base, mesocicloInicioISO: null, hojeISO: '2026-07-08' });
    expect(r).toEqual({ semanaEfetiva: 1, deload: false, novaAncoraISO: '2026-07-08' });
  });

  it('5 semanas treinadas → semana 6 com alívio agendado (todos os níveis)', () => {
    const datasSessao = [0, 1, 2, 3, 4].map((n) => naSemana(n));
    const r = estadoDoCiclo({ ...base, mesocicloInicioISO: ANCORA, hojeISO: naSemana(5), datasSessao });
    expect(r.semanaEfetiva).toBe(6);
    expect(r.deload).toBe(true);
    expect(r.novaAncoraISO).toBeUndefined();
  });

  it('parado não deloada sozinho: 6 semanas sem treinar segue na semana 1, sem alívio', () => {
    const r = estadoDoCiclo({ ...base, mesocicloInicioISO: ANCORA, hojeISO: isoMaisDias(ANCORA, 42), datasSessao: [] });
    expect(r).toEqual({ semanaEfetiva: 1, deload: false });
  });

  it('fadiga → alívio AGORA + marca explícita; a âncora nova é o FIM do alívio (sem "hoje − 35 d")', () => {
    const hoje = naSemana(2);
    const r = estadoDoCiclo({
      mesocicloInicioISO: ANCORA, hojeISO: hoje, sinaisFadiga: true,
      datasSessao: [naSemana(0), naSemana(1)], deloadAteISO: null,
    });
    const fim = isoMaisDias(hoje, 7);
    expect(r.semanaEfetiva).toBe(6);
    expect(r.deload).toBe(true);
    expect(r.novoDeloadAteISO).toBe(fim);
    expect(r.novaAncoraISO).toBe(fim); // o ciclo novo começa quando o alívio termina
  });

  it('durante o alívio a marca manda — e NÃO reancora de novo (sem loop de gravação)', () => {
    const r = estadoDoCiclo({
      mesocicloInicioISO: '2026-07-15', hojeISO: '2026-07-10', sinaisFadiga: false,
      datasSessao: [], deloadAteISO: '2026-07-15',
    });
    expect(r).toEqual({ semanaEfetiva: 6, deload: true });
  });

  it('fim do alívio → semana 1 do piso, MESMO tendo treinado durante o alívio', () => {
    // âncora = fim do alívio; sessões feitas ANTES dela não viram semana de rampa.
    const fim = '2026-07-15';
    const r = estadoDoCiclo({
      mesocicloInicioISO: fim, hojeISO: fim, sinaisFadiga: false,
      datasSessao: ['2026-07-11', '2026-07-13'], deloadAteISO: fim,
    });
    expect(r).toEqual({ semanaEfetiva: 1, deload: false });
  });

  it('marca vencida de um ciclo antigo é ignorada (não prende ninguém em alívio)', () => {
    const r = estadoDoCiclo({
      mesocicloInicioISO: ANCORA, hojeISO: naSemana(1), sinaisFadiga: false,
      datasSessao: [naSemana(0)], deloadAteISO: '2025-01-01',
    });
    expect(r.semanaEfetiva).toBe(2);
    expect(r.deload).toBe(false);
  });
});
