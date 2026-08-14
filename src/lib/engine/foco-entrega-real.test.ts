/**
 * 🔴 B3 — AS TRÊS ASSERÇÕES DA ENTREGA DO FOCO (DF do autor, 2026-08-14).
 *
 * 🔑 Este guard existe porque a asserção anterior era `expect(com).not.toBe(sem)` — "o plano
 * DIFERE" — e isso é satisfeito pelo COMPENSADOR perdendo série sozinho. O plano diferia, o
 * teste passava, e o volume sumia da semana: o defeito e o teste conviveram por dois dias.
 *
 * Pergunta que toda asserção sobre saída de motor tem de responder: **que defeito também
 * satisfaria isto?** "Difere" é satisfeito por três defeitos diferentes. As três abaixo, não:
 *
 *   ① `séries(focado) ≥ antes`   — mata "tira e não entrega"
 *   ② `total da semana CONSERVA` — mata o vazamento (e o crescimento)
 *   ③ `só o par focado ↔ compensador muda` — mata o `ombros −4` que ninguém pediu
 */
import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { compensadoresPossiveis } from './trilhos';
import { EXERCISES } from '../data/exercises';
import type { GrupoPrimario } from '../data/types';
import type { PerfilTreino, SemanaCiclo } from './treino-types';
import type { FlagsSaude } from './types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 6, tempoPorSessaoMin: 60, ...over,
});
const plano = (p: PerfilTreino, semana: SemanaCiclo) =>
  montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana });

const porGrupo = (r: ReturnType<typeof plano>) => {
  const m = new Map<string, number>();
  for (const d of r.dias) for (const s of d.slots) {
    const g = s.exercicio.grupoPrimario;
    if (g) m.set(g, (m.get(g) ?? 0) + (s.series ?? 0));
  }
  return m;
};
const total = (r: ReturnType<typeof plano>) => r.dias.flatMap((d) => d.slots).reduce((n, s) => n + (s.series ?? 0), 0);

/** O par do caso do autor, com compensador VÁLIDO (divide o dia de push com o peito). */
const FOCADO: GrupoPrimario = 'peito';
const COMPENSA: GrupoPrimario = 'triceps';
/** Semanas em que a spec manda haver delta (1, 4 e 5 são `ordem` por decisão). */
const SEMANAS_COM_DELTA: SemanaCiclo[] = [2, 3];

describe('🔴 B3 — a entrega do foco, nas três asserções', () => {
  for (const semana of SEMANAS_COM_DELTA) {
    const sem = plano(perfil(), semana);
    const com = plano(perfil({ foco: { grupo: FOCADO, compensa: COMPENSA, semana: 1 } }), semana);
    const a = porGrupo(sem); const b = porGrupo(com);

    it(`semana ${semana} · ① séries(${FOCADO}) SOBE`, () => {
      expect(b.get(FOCADO) ?? 0, `focado ${a.get(FOCADO)} → ${b.get(FOCADO)}`).toBeGreaterThan(a.get(FOCADO) ?? 0);
    });

    it(`semana ${semana} · ② o total da semana CONSERVA exatamente`, () => {
      expect(total(com), `total ${total(sem)} → ${total(com)}`).toBe(total(sem));
    });

    it(`semana ${semana} · ③ NENHUM grupo além do par focado↔compensador mudou`, () => {
      const mexidos = [...new Set([...a.keys(), ...b.keys()])]
        .filter((g) => (a.get(g) ?? 0) !== (b.get(g) ?? 0));
      expect(mexidos.sort(), `grupos alterados: ${mexidos.join(', ')}`).toEqual([COMPENSA, FOCADO].sort());
    });
  }

  /**
   * 🔒 A borda que a DF fechou de propósito: `delta = 0` (semanas 1, 4 e 5) NÃO promove ao
   * degrau do slot — mover slot ali daria +sMax séries onde a spec manda 0.
   */
  for (const semana of [1, 4, 5] as SemanaCiclo[]) {
    it(`semana ${semana} · delta 0 não move volume nenhum (entrega ordem)`, () => {
      const sem = plano(perfil(), semana);
      const com = plano(perfil({ foco: { grupo: FOCADO, compensa: COMPENSA, semana: 1 } }), semana);
      expect(total(com)).toBe(total(sem));
      expect(porGrupo(com).get(FOCADO) ?? 0).toBe(porGrupo(sem).get(FOCADO) ?? 0);
    });
  }

  /**
   * 🔴 O PERFIL HERDADO do autor: `panturrilha` + `compensa: peito` em PPL×2 — os dois nunca
   * dividem dia, e um slot de push não vira slot de perna. O motor cai no degrau ③ e NÃO
   * escolhe outro compensador por baixo dos panos; o plano fica intacto.
   */
  it('compensador que não divide dia: plano intacto, nenhum terceiro cobrado', () => {
    const sem = plano(perfil(), 3);
    const com = plano(perfil({ foco: { grupo: 'panturrilha', compensa: 'peito', semana: 1 } }), 3);
    expect(total(com)).toBe(total(sem));
    const a = porGrupo(sem); const b = porGrupo(com);
    const mexidos = [...new Set([...a.keys(), ...b.keys()])].filter((g) => (a.get(g) ?? 0) !== (b.get(g) ?? 0));
    expect(mexidos, `alguém foi cobrado sem estar no foco: ${mexidos.join(', ')}`).toEqual([]);
  });

  /** E a UI tem de saber disso: peito não pode ser oferecido para compensar panturrilha. */
  it('os compensadores oferecidos vêm do plano — peito não compensa panturrilha em PPL', () => {
    const r = plano(perfil(), 3);
    const diasComGrupos = r.dias.map((d) => d.slots.map((s) => s.exercicio.grupoPrimario).filter(Boolean) as GrupoPrimario[]);
    const ops = compensadoresPossiveis(diasComGrupos, 'panturrilha');
    expect(ops.length, 'nenhum compensador possível — a UI ficaria sem opção').toBeGreaterThan(0);
    expect(ops).not.toContain('peito');
  });
});
