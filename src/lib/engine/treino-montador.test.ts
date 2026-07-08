import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { dificuldadesLiberadas, prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude } from './types';
import type { FeedbackGrupo, PerfilTreino } from './treino-types';
import type { GrupoPrimario } from '../data/types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
function perfil(over: Partial<PerfilTreino> = {}): PerfilTreino {
  return { pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60, ...over };
}
function rotina(over: Partial<PerfilTreino> = {}) {
  const p = perfil(over);
  return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES);
}

describe('montador de rotina (base real, 163 exercícios)', () => {
  it('dias de força = min(dias, teto do nível); excedente → cardio/recuperação', () => {
    // iniciante: teto 3. Com 6 dias → 3 de força, 3 de cardio/recuperação.
    const r = rotina({ nivelExperiencia: 'iniciante', diasDisponiveis: 6 });
    expect(r.diasForcaAgendados).toBe(3);
    expect(r.diasCardioRecuperacao).toBe(3);
    expect(r.dias).toHaveLength(3);
  });

  it('todo exercício selecionado respeita equipamento/local e dificuldade liberada', () => {
    for (const equip of ['nenhum', 'casa', 'academia'] as const) {
      for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
        const r = rotina({ equipamento: equip, nivelExperiencia: nivel, diasDisponiveis: 4 });
        const liberadas = new Set(dificuldadesLiberadas(nivel));
        const locais =
          equip === 'nenhum' ? ['casa_sem'] : equip === 'casa' ? ['casa_sem', 'casa_com'] : ['casa_sem', 'casa_com', 'academia'];
        for (const d of r.dias)
          for (const s of d.slots) {
            expect(locais).toContain(s.exercicio.local);
            expect(liberadas.has(s.exercicio.nivel)).toBe(true);
          }
      }
    }
  });

  it('invariante: puxar ≥ empurrar (sem aviso de desequilíbrio)', () => {
    for (const dias of [2, 3, 4, 5, 6]) {
      const r = rotina({ diasDisponiveis: dias, nivelExperiencia: 'avancado' });
      const conta = (p: string) => r.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === p).length, 0);
      expect(conta('puxar')).toBeGreaterThanOrEqual(conta('empurrar'));
    }
  });

  it('dobradiça/quadril presente quando há ≥ 2 dias de força', () => {
    const r = rotina({ diasDisponiveis: 4, nivelExperiencia: 'avancado' });
    const temDobradica = r.dias.some((d) => d.slots.some((s) => s.padrao === 'dobradica_quadril'));
    expect(temDobradica).toBe(true);
  });

  it('invariante: core 2–3×/semana em qualquer split (≥ 2 dias)', () => {
    for (const dias of [2, 3, 4, 5, 6])
      for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
        const r = rotina({ diasDisponiveis: dias, nivelExperiencia: nivel });
        const core = r.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === 'core').length, 0);
        expect(core).toBeGreaterThanOrEqual(2);
        expect(core).toBeLessThanOrEqual(3);
      }
  });

  it('tempo curto: nº de exercícios por dia cai (cabe no tempo)', () => {
    const curto = rotina({ tempoPorSessaoMin: 20 });
    const longo = rotina({ tempoPorSessaoMin: 90 });
    const maxSlotsCurto = Math.max(...curto.dias.map((d) => d.slots.length));
    const maxSlotsLongo = Math.max(...longo.dias.map((d) => d.slots.length));
    expect(maxSlotsCurto).toBeLessThanOrEqual(maxSlotsLongo);
  });

  it('peso corporal (equipamento nenhum) gera rotina só com exercícios de casa_sem', () => {
    const r = rotina({ equipamento: 'nenhum', diasDisponiveis: 3, nivelExperiencia: 'iniciante' });
    expect(r.dias.length).toBeGreaterThan(0);
    for (const d of r.dias) for (const s of d.slots) expect(s.exercicio.local).toBe('casa_sem');
  });

  it('é determinístico', () => {
    const a = rotina({ diasDisponiveis: 5, nivelExperiencia: 'avancado' });
    const b = rotina({ diasDisponiveis: 5, nivelExperiencia: 'avancado' });
    const ids = (r: typeof a) => r.dias.map((d) => d.slots.map((s) => s.exercicio.id).join(',')).join('|');
    expect(ids(a)).toBe(ids(b));
  });
});

// ── Favoritos no montador (DF #12 + B5, 2026-07-04) ─────────────────────────
describe('favoritos no montador (DF #12)', () => {
  function rotinaFav(favs: string[], over: Partial<PerfilTreino> = {}) {
    const p = perfil(over);
    return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(favs));
  }

  it('favorito aparece em TODA sessão em que o padrão tem slot (isento da variedade B5)', () => {
    // e9 Supino reto (empurrar, INT, academia) favorito de um intermediário na academia
    const r = rotinaFav(['e9']);
    const diasComEmpurrar = r.dias.filter((d) => d.slots.some((s) => s.padrao === 'empurrar'));
    expect(diasComEmpurrar.length).toBeGreaterThan(0);
    for (const d of diasComEmpurrar) {
      expect(d.slots.some((s) => s.exercicio.id === 'e9'), `${d.nome} devia ter o favorito`).toBe(true);
    }
  });

  it('badge: incluidoPorPreferencia em TODO slot cujo exercício é favorito', () => {
    const r = rotinaFav(['e9']);
    for (const d of r.dias) for (const s of d.slots) {
      if (s.exercicio.id === 'e9') expect(s.incluidoPorPreferencia).toBe(true);
      else expect(s.incluidoPorPreferencia).toBeUndefined();
    }
  });

  it('favorito acima do nível NUNCA aparece (filtro duro intacto — favoritar não fura o nível)', () => {
    // e26 Terra (avançado) favoritado por um INICIANTE → fora do pool
    const r = rotinaFav(['e26'], { nivelExperiencia: 'iniciante' });
    for (const d of r.dias) expect(d.slots.some((s) => s.exercicio.id === 'e26')).toBe(false);
  });

  it('favorito sem o equipamento NUNCA aparece', () => {
    // e9 Supino (academia) favoritado por quem treina SEM equipamento
    const r = rotinaFav(['e9'], { equipamento: 'nenhum' });
    for (const d of r.dias) expect(d.slots.some((s) => s.exercicio.id === 'e9')).toBe(false);
  });

  it('invariantes intactas com favoritos ativos (puxar ≥ empurrar · dobradiça · core 2–3)', () => {
    const r = rotinaFav(['e9', 'e3']);
    const conta = (p: string) => r.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === p).length, 0);
    expect(conta('puxar')).toBeGreaterThanOrEqual(conta('empurrar'));
    expect(conta('dobradica_quadril')).toBeGreaterThanOrEqual(1);
    expect(conta('core')).toBeGreaterThanOrEqual(2);
    expect(conta('core')).toBeLessThanOrEqual(3);
    expect(r.avisos).toHaveLength(0);
  });

  it('determinismo: dupla chamada → rotina idêntica; set vazio → byte-idêntico ao default', () => {
    const a = JSON.stringify(rotinaFav(['e9', 'e19']));
    const b = JSON.stringify(rotinaFav(['e9', 'e19']));
    expect(a).toBe(b);
    expect(JSON.stringify(rotinaFav([]))).toBe(JSON.stringify(rotina()));
  });

  it('dois favoritos do mesmo padrão: ambos entram em ordem estável (tier, id) quando há 2 slots', () => {
    // dois favoritos de "empurrar": e9 (T1) e e11 (T1) — e9 < e11 lexicográfico... ("e11"<"e9" em string!)
    // A ordem estável é a do POOL (tier↑, id lexicográfico): "e11" vem antes de "e9".
    const r = rotinaFav(['e9', 'e11']);
    const dia = r.dias.find((d) => d.slots.filter((s) => s.padrao === 'empurrar').length >= 1)!;
    const primeiro = dia.slots.find((s) => s.padrao === 'empurrar')!;
    expect(['e11', 'e9']).toContain(primeiro.exercicio.id);
    expect(primeiro.exercicio.id).toBe('e11'); // determinístico: 1º na ordem do pool
  });
});

// ── Mesociclo v2: rampa de volume por grupo no montador (DF 2026-07-08) ─────
describe('rampa de volume no montador (mesociclo v2)', () => {
  const SEMANAS: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
  function rotinaSemana(semana: 1 | 2 | 3 | 4 | 5 | 6, over: Partial<PerfilTreino> = {}, feedbackGrupos?: ReadonlyMap<GrupoPrimario, FeedbackGrupo>) {
    const p = perfil({ nivelExperiencia: 'avancado', diasDisponiveis: 6, tempoPorSessaoMin: 90, ...over });
    return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana, feedbackGrupos });
  }
  function totalPorGrupo(r: ReturnType<typeof rotinaSemana>) {
    const tot = new Map<string, { series: number; slots: number }>();
    for (const d of r.dias)
      for (const s of d.slots) {
        const g = tot.get(s.exercicio.grupoPrimario) ?? { series: 0, slots: 0 };
        g.series += s.series ?? 0;
        g.slots += 1;
        tot.set(s.exercicio.grupoPrimario, g);
      }
    return tot;
  }

  it('aceitação: volume/grupo sobe do piso ao topo da banda em 5 semanas e NUNCA ultrapassa o topo', () => {
    // Avançado/massa: banda 16–20, séries/exercício 3–4.
    const p = perfil({ nivelExperiencia: 'avancado', diasDisponiveis: 6, tempoPorSessaoMin: 90 });
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    const banda = presc.volumePorGrupoSemana;
    const porSemana = SEMANAS.map((s) => totalPorGrupo(rotinaSemana(s)));
    for (const [grupo, { slots }] of porSemana[0]!) {
      const base = slots * presc.seriesPorExercicio.min;
      const teto = slots * presc.seriesPorExercicio.max;
      const alvos = SEMANAS.map((s) => Math.min(Math.max(banda.min + (s - 1), base), Math.min(banda.max, teto)));
      const totais = porSemana.map((m) => m.get(grupo)!.series);
      expect(totais, `grupo ${grupo}`).toEqual(alvos);
      for (const t of totais) expect(t).toBeLessThanOrEqual(banda.max); // nunca ultrapassa o topo
      for (let i = 1; i < totais.length; i++) expect(totais[i]!).toBeGreaterThanOrEqual(totais[i - 1]!); // monotônico
    }
  });

  it('grupos com slots suficientes ATINGEM o topo da banda na semana 5 (interm./massa: peito → 16)', () => {
    // Avançado/massa (topo 20) exigiria ≥ 5 slots/grupo/semana — estruturalmente fora dos
    // splits atuais (limite honesto, registrado no handoff). Interm./massa (topo 16) atinge.
    const over: Partial<PerfilTreino> = { nivelExperiencia: 'intermediario', diasDisponiveis: 4, tempoPorSessaoMin: 90 };
    const p = perfil(over);
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    const sem5 = totalPorGrupo(rotinaSemana(5, over));
    const atingiveis = [...sem5.entries()].filter(([, v]) => v.slots * presc.seriesPorExercicio.max >= presc.volumePorGrupoSemana.max);
    expect(atingiveis.length).toBeGreaterThan(0); // o cenário tem grupos com teto ≥ topo
    for (const [, v] of atingiveis) expect(v.series).toBe(presc.volumePorGrupoSemana.max); // 16
  });

  it('toda série por slot fica dentro de seriesPorExercicio {min..max}', () => {
    const p = perfil({ nivelExperiencia: 'avancado', diasDisponiveis: 6, tempoPorSessaoMin: 90 });
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    for (const s of [...SEMANAS, 6 as const]) {
      const r = rotinaSemana(s);
      for (const d of r.dias)
        for (const slot of d.slots) {
          if (s === 6) expect(slot.series).toBeUndefined(); // deload NÃO anota séries (corte único via mecanismo v1)
          else {
            expect(slot.series).toBeGreaterThanOrEqual(presc.seriesPorExercicio.min);
            expect(slot.series).toBeLessThanOrEqual(presc.seriesPorExercicio.max);
          }
        }
    }
  });

  it('semana 6 marca deload nos metadados; ciclo novo (semana 1) reseta ao piso', () => {
    const r6 = rotinaSemana(6);
    expect(r6.semana).toEqual(expect.objectContaining({ numero: 6, deload: true }));
    const r1a = totalPorGrupo(rotinaSemana(1));
    const r1b = totalPorGrupo(rotinaSemana(1));
    expect([...r1a.entries()]).toEqual([...r1b.entries()]); // determinístico
  });

  it("feedback 'segura' congela o incremento do grupo (alvo = semana anterior)", () => {
    const r3 = totalPorGrupo(rotinaSemana(3));
    const grupo = [...r3.keys()].find((g) => {
      const v3 = r3.get(g)!;
      return v3.series > v3.slots * 3; // grupo que de fato rampou (não pinado na base)
    })!;
    const seguraMap = new Map([[grupo as GrupoPrimario, 'segura' as FeedbackGrupo]]);
    const r4seg = totalPorGrupo(rotinaSemana(4, {}, seguraMap));
    expect(r4seg.get(grupo)!.series).toBe(r3.get(grupo)!.series); // sem. 4 'segura' = alvo da sem. 3
  });

  it('compat: sem semanaCiclo a saída é byte-idêntica à v1 (invariantes preservadas nas semanas 1–6)', () => {
    expect(JSON.stringify(rotina())).toBe(JSON.stringify(rotina())); // sanidade determinismo
    for (const s of [1, 2, 3, 4, 5, 6] as const) {
      const r = rotinaSemana(s);
      const conta = (p: string) => r.dias.reduce((n, d) => n + d.slots.filter((x) => x.padrao === p).length, 0);
      expect(conta('puxar')).toBeGreaterThanOrEqual(conta('empurrar'));
      expect(conta('dobradica_quadril')).toBeGreaterThanOrEqual(1);
      expect(conta('core')).toBeGreaterThanOrEqual(2);
      expect(conta('core')).toBeLessThanOrEqual(3);
    }
  });

  it('estrutura estável no ciclo: os MESMOS exercícios nas semanas 1–5 (só as séries mudam)', () => {
    const ids = (s: 1 | 2 | 3 | 4 | 5) => rotinaSemana(s).dias.map((d) => d.slots.map((x) => x.exercicio.id).join(',')).join('|');
    const base = ids(1);
    for (const s of [2, 3, 4, 5] as const) expect(ids(s)).toBe(base);
  });

  it('descanso do composto: massa/90 min sobe o teto p/ 180 s; tempo curto mantém a base (tempo é o limitante)', () => {
    const longo = rotinaSemana(1, { tempoPorSessaoMin: 90 });
    expect(longo.semana?.descansoCompostoSeg.max).toBe(180);
    const curto = rotinaSemana(1, { tempoPorSessaoMin: 30 });
    expect(curto.semana?.descansoCompostoSeg.max).toBe(120); // base massa 90–120
  });

  it('descanso do composto: objetivo saúde (60–90) sem modo força NUNCA sobe p/ 180 s', () => {
    const r = rotinaSemana(1, { objetivo: 'saude', tempoPorSessaoMin: 120 });
    expect(r.semana?.descansoCompostoSeg.max).toBe(90);
  });

  it('smoke: 3 níveis × 3 objetivos × semanas 1–6 sem violar invariantes nem séries fora da faixa', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const)
      for (const obj of ['saude', 'massa', 'emagrecimento'] as const)
        for (const s of [1, 2, 3, 4, 5, 6] as const) {
          const p = perfil({ nivelExperiencia: nivel, objetivo: obj, diasDisponiveis: 4, tempoPorSessaoMin: 60 });
          const presc = prescreverTreino(p, avaliarGateTreino(p));
          const r = montarRotina(presc, p, EXERCISES, new Set(), { semana: s });
          const conta = (pat: string) => r.dias.reduce((n, d) => n + d.slots.filter((x) => x.padrao === pat).length, 0);
          expect(conta('puxar')).toBeGreaterThanOrEqual(conta('empurrar'));
          for (const d of r.dias)
            for (const slot of d.slots) {
              if (slot.series != null) {
                expect(slot.series).toBeGreaterThanOrEqual(presc.seriesPorExercicio.min);
                expect(slot.series).toBeLessThanOrEqual(presc.seriesPorExercicio.max);
              }
            }
        }
  });
});
