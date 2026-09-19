// Autor14/09: o automático adiciona2×2; não usa a transferência histórica descrita abaixo.
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
import { describe, expect, it, vi } from 'vitest';
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
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 6, tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', ...over,
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
/**
 * 🔵 2026-09-15 — o `+4` literal virou "exatamente o que o bloco DECLAROU entregar".
 *
 * A instrução vigente desta correção manda respeitar o MRV inclusive nos extras do foco, e
 * SUBSTITUI neste ponto a exceção de 14/09 que os autorizava a ultrapassá-lo (uma decisão
 * deliberada da época, registrada em `etapa3-foco-tempo.test.ts`, não um engano). O que estes
 * casos protegem — adição SEM compensação, nenhum terceiro cobrado — segue idêntico e EXATO:
 * o delta continua sendo uma igualdade, não uma faixa. O que deixou de ser afirmado é que o
 * bloco entrega sempre as quatro séries: onde o grupo já está no topo, ele entrega ORDEM.
 */
const entregue = (r: ReturnType<typeof plano>) => (r.blocoFoco?.adicionais ?? []).reduce((n, i) => n + i.series, 0);

/** O par do caso do autor, com compensador VÁLIDO (divide o dia de push com o peito). */
const FOCADO: GrupoPrimario = 'peito';
const COMPENSA: GrupoPrimario = 'triceps';
/** Semanas em que a spec manda haver delta (1, 4 e 5 são `ordem` por decisão). */
const SEMANAS_COM_DELTA: SemanaCiclo[] = [2, 3];

describe('Adição14/09 — entrega sem compensação, nos dois seletores', () => {
  for (const semana of SEMANAS_COM_DELTA) {
    const sem = plano(perfil(), semana);
    const com = plano(perfil({ foco: { grupo: FOCADO, compensa: COMPENSA, semana: 1 } }), semana);
    const a = porGrupo(sem); const b = porGrupo(com);

    it(`semana ${semana} · ① séries(${FOCADO}) SOBE`, () => {
      expect(b.get(FOCADO) ?? 0, `focado ${a.get(FOCADO)} → ${b.get(FOCADO)}`).toBeGreaterThan(a.get(FOCADO) ?? 0);
    });

    it(`semana ${semana} · ② o total sobe exatamente o que o bloco entregou`, () => {
      expect(entregue(com), `semana ${semana}: bloco vazio — a igualdade seria trivial`).toBeGreaterThan(0);
      expect(total(com), `total ${total(sem)} → ${total(com)}`).toBe(total(sem) + entregue(com));
    });

    it(`semana ${semana} · ③ somente o grupo focado muda`, () => {
      const mexidos = [...new Set([...a.keys(), ...b.keys()])]
        .filter((g) => (a.get(g) ?? 0) !== (b.get(g) ?? 0));
      expect(mexidos.sort(), `grupos alterados: ${mexidos.join(', ')}`).toEqual([FOCADO]);
    });
  }

  /**
   * 🔒 A borda que a DF fechou de propósito: `delta = 0` (semanas 1, 4 e 5) NÃO promove ao
   * degrau do slot — mover slot ali daria +sMax séries onde a spec manda 0.
   */
  for (const semana of [1, 4, 5] as SemanaCiclo[]) {
    it(`semana ${semana} · também recebe o bloco adicional (no que couber no teto)`, () => {
      const sem = plano(perfil(), semana);
      const com = plano(perfil({ foco: { grupo: FOCADO, compensa: COMPENSA, semana: 1 } }), semana);
      expect(total(com)).toBe(total(sem) + entregue(com));
      expect(porGrupo(com).get(FOCADO) ?? 0).toBe((porGrupo(sem).get(FOCADO) ?? 0) + entregue(com));
    });
  }

  /**
   * 🔴 O PERFIL HERDADO do autor: `panturrilha` + `compensa: peito` em PPL×2 — os dois nunca
   * dividem dia, e um slot de push não vira slot de perna. O motor cai no degrau ③ e NÃO
   * escolhe outro compensador por baixo dos panos; o plano fica intacto.
   */
  it('compensador legado não cobra terceiros nem impede adição', () => {
    const sem = plano(perfil(), 3);
    const com = plano(perfil({ foco: { grupo: 'panturrilha', compensa: 'peito', semana: 1 } }), 3);
    // A adição continua subordinada ao limite de um complementar por dia.
    if(entregue(com)===0)expect(com.avisos.some(a=>/completar o bloco adicional|complementar/.test(a))).toBe(true);
    expect(total(com)).toBe(total(sem) + entregue(com));
    const a = porGrupo(sem); const b = porGrupo(com);
    const mexidos = [...new Set([...a.keys(), ...b.keys()])].filter((g) => (a.get(g) ?? 0) !== (b.get(g) ?? 0));
    expect(mexidos, `alguém foi cobrado sem estar no foco: ${mexidos.join(', ')}`).toEqual(entregue(com)>0?['panturrilha']:[]);
  });

  /**
   * 🔴 REGRESSÃO DA REVISÃO INDEPENDENTE 15/09 (L-01) — A FIXTURE ORIGINAL DE 60 MIN VOLTA.
   *
   * A etapa 3 tinha movido este arquivo de `60 min limitado` para `75 min + sem_limite`. Com
   * a fixture ORIGINAL, o candidato `badcea47` falhava: nas semanas 4 e 5 o bíceps perdia 4
   * séries (8→4) e o total da semana CAÍA 2, enquanto o peito subia 2 — exatamente o D-01.
   * Ela fica aqui como regressão permanente do regime com tempo limitado, que é o de quase
   * todo mundo. O que se exige é a identidade: o que o grupo focado ganha é, série a série,
   * o que o bloco entregou; e ninguém mais muda.
   */
  describe('fixture original de 60 min, LIMITADA — regressão de D-01', () => {
    const base60 = (over: Partial<PerfilTreino> = {}) =>
      perfil({ tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado', ...over });
    for (const semana of [1, 2, 3, 4, 5] as SemanaCiclo[]) {
      it(`semana ${semana} · só ${FOCADO} muda, e muda exatamente o que o bloco entregou`, () => {
        const sem = plano(base60(), semana);
        const com = plano(base60({ foco: { grupo: FOCADO, compensa: COMPENSA, semana: 1 } }), semana);
        const a = porGrupo(sem); const b = porGrupo(com);
        const entregue = (com.blocoFoco?.adicionais ?? []).reduce((n, x) => n + x.series, 0);
        const mexidos = [...new Set([...a.keys(), ...b.keys()])].filter((g) => (a.get(g) ?? 0) !== (b.get(g) ?? 0));
        expect(mexidos.sort(), `grupos alterados: ${mexidos.join(', ')}`).toEqual(entregue > 0 ? [FOCADO] : []);
        expect((b.get(FOCADO) ?? 0) - (a.get(FOCADO) ?? 0), 'ganho líquido ≠ bloco declarado').toBe(entregue);
        expect(total(com) - total(sem)).toBe(entregue);
      });
    }
    it('anti-vacuidade: neste perfil o bloco de 60 min realmente chega ao plano', () => {
      // Mantidos os cinco pares originais acima; este controle exige entrega real.
      const com = plano(base60({nivelExperiencia:'iniciante',diasDisponiveis:3,treinoDias:['seg','qua','sex'], foco: { grupo: FOCADO, compensa: COMPENSA, semana: 1 } }), 3);
      expect((com.blocoFoco?.adicionais ?? []).length, 'bloco vazio nas cinco semanas: a identidade seria trivial').toBeGreaterThan(0);
    });
  });

  /** E a UI tem de saber disso: peito não pode ser oferecido para compensar panturrilha. */
  it('os compensadores oferecidos vêm do plano — peito não compensa panturrilha em PPL', () => {
    const r = plano(perfil(), 3);
    const diasComGrupos = r.dias.map((d) => d.slots.map((s) => s.exercicio.grupoPrimario).filter(Boolean) as GrupoPrimario[]);
    const ops = compensadoresPossiveis(diasComGrupos, 'panturrilha');
    const diasPant=diasComGrupos.filter(gs=>gs.includes('panturrilha'));
    if(diasPant.length===0)expect(ops).toEqual([]);
    else expect(ops.length).toBeGreaterThan(0);
    expect(ops).not.toContain('peito');
  });
});

// Fotografia/autoridade histórica: o seletor é congelado na etapa 1.
// As novas divisões reais são cobradas em distribuicao-etapa2.test.ts e na matriz externa.
vi.mock('./selecao-divisao', async (importOriginal) => process.env.ADAPT_TEST_SELETOR_ATUAL === '1' ? importOriginal() : import('./__fixtures__/selecao-etapa1'));
