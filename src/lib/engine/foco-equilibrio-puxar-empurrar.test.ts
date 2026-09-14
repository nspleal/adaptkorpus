/**
 * 🔒 C6 (fila histórica do motor) — A TRANSFERÊNCIA DE SLOT DO FOCO PRESERVA `puxar ≥ empurrar`.
 *
 * Invariante do cofre (`motor-treino-invariantes-do-montador-e-favoritos--002`):
 * "Puxar ≥ Empurrar em volume — saúde do ombro e postura (default protetor)."
 *
 * DF histórica (2026-08-17, `motor-treino-alocador-compensador-e-proiba`):
 *  · "ao rearranjar, mantém o equilíbrio";
 *  · "se quebraria, entrega ORDEM (prioriza sem tirar do puxar)".
 *
 * 🔴 O DEFEITO MEDIDO (base `67f5fd9c`): o degrau ② da cascata executava a troca com
 * `escolher(para, …)` SEM a trava que `colocar()` aplica em toda outra porta do alocador.
 * Com foco em `peito` cedido por `biceps`, o `e74[biceps/isolado]` saía e o `e2[peito/empurrar]`
 * entrava: a semana ia de `puxar 2 / empurrar 2` para `puxar 2 / empurrar 3`. O montador só
 * AVISAVA depois do fato — o plano entregue já estava desequilibrado.
 *
 * O par discriminante: o MESMO perfil sem foco fecha equilibrado. A violação é INTRODUZIDA
 * pela aplicação do foco, não herdada do plano base.
 */
import { describe, expect, it, vi } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude, Objetivo } from './types';
import type { PerfilTreino, DivisaoPreferida, NivelExperiencia } from './treino-types';
import type { GrupoPrimario, EquipamentoDisp } from '../data/types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 3, tempoPorSessaoMin: 45,
  divisaoPreferida: 'prioridades', ...over,
});
const plano = (p: PerfilTreino, semana: number) =>
  montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana } as never);

const conta = (r: ReturnType<typeof plano>, padrao: string) =>
  r.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === padrao).length, 0);
const equilibrada = (r: ReturnType<typeof plano>) => conta(r, 'puxar') >= conta(r, 'empurrar');

describe('🔴 C6 — o foco NÃO pode introduzir `empurrar > puxar` (reprodução mínima)', () => {
  const base = perfil();
  const comFoco = perfil({ foco: { grupo: 'peito', compensa: 'biceps', semana: 1 } });

  it('o plano SEM foco fecha equilibrado — a violação não é preexistente', () => {
    const r = plano(base, 2);
    expect(conta(r, 'puxar'), 'puxar').toBe(2);
    expect(conta(r, 'empurrar'), 'empurrar').toBe(2);
    expect(equilibrada(r)).toBe(true);
  });

  it('🔑 aplicar foco peito←bíceps NÃO derruba `puxar ≥ empurrar`', () => {
    const r = plano(comFoco, 2);
    expect(
      equilibrada(r),
      `puxar ${conta(r, 'puxar')} < empurrar ${conta(r, 'empurrar')} — a transferência de slot quebrou a invariante`,
    ).toBe(true);
  });

  it('o plano entregue não carrega o aviso de desequilíbrio que o próprio motor emite', () => {
    const r = plano(comFoco, 2);
    expect(r.avisos.filter((a) => a.includes('puxar ficou abaixo'))).toEqual([]);
  });

  /**
   * 🔒 Quando a troca é RECUSADA PELO EQUILÍBRIO, a decisão desce para ORDEM com o motivo
   * dito — a tela não pode prometer "+1 exercício" que o motor não entregou (DF B2).
   *
   * ⚠️ Limite declarado deste teste: ele cobre a recusa por equilíbrio, que é o escopo C6.
   * NÃO afirma que todo `degrau: 'slot'` moveu um slot — quando nenhum dia junta um slot do
   * compensador ao focado, a decisão segue dizendo `slot` sem mover nada. Esse é um defeito
   * SEPARADO e PREEXISTENTE (não introduzido aqui), fora do recorte C6.
   */
  it('recusa por equilíbrio desce para ORDEM e diz o motivo — nunca promete slot que não moveu', () => {
    const r = plano(comFoco, 2);
    if (r.foco?.motivo === 'equilibrio_puxar_empurrar') {
      expect(r.foco.degrau).toBe('ordem');
      expect(r.foco.series).toBe(0);
    }
    // Seja qual for o degrau entregue, o plano sai equilibrado — é o que C6 exige.
    expect(equilibrada(r)).toBe(true);
  });

  /**
   * 🔒 O 1:1 da spec continua valendo: a correção NÃO pode pagar o equilíbrio tirando
   * exercício ou série da pessoa. Quando a troca é recusada, a semana é a MESMA do plano
   * neutro — nem um slot, nem uma série a menos.
   */
  it('recusar a troca não encolhe a semana (slots e séries iguais ao plano sem foco)', () => {
    const rB = plano(base, 2);
    const rF = plano(comFoco, 2);
    if (rF.foco?.motivo !== 'equilibrio_puxar_empurrar') return;
    const slots = (r: typeof rB) => r.dias.reduce((n, d) => n + d.slots.length, 0);
    const series = (r: typeof rB) => r.dias.reduce((n, d) => n + d.slots.reduce((a, s) => a + (s.series ?? 0), 0), 0);
    expect(slots(rF)).toBe(slots(rB));
    expect(series(rF)).toBe(series(rB));
  });
});

/**
 * 🔒 A grade: nenhuma combinação de foco/compensador pode INTRODUZIR o desequilíbrio.
 * Recorte dos eixos que a varredura de 190.080 planos apontou como os únicos que chegam ao
 * degrau ② — manter estreito de propósito (a suíte inteira não cabe num teste).
 */
describe('🔒 C6 — grade: o foco nunca introduz `empurrar > puxar`', () => {
  it('varre nível × equipamento × objetivo × divisão × dias × tempo × semana × par focado', () => {
    const GRUPOS: GrupoPrimario[] = ['peito', 'ombros', 'triceps', 'biceps', 'costas'];
    const falhas: string[] = [];
    for (const nivelExperiencia of ['intermediario', 'avancado'] as NivelExperiencia[])
      for (const equipamento of ['academia', 'casa'] as EquipamentoDisp[])
        for (const objetivo of ['massa', 'emagrecimento', 'saude'] as Objetivo[])
          for (const divisaoPreferida of ['auto', 'prioridades'] as DivisaoPreferida[])
            for (const diasDisponiveis of [3, 4, 5])
              for (const tempoPorSessaoMin of [30, 45, 60, 90])
                for (const semana of [2, 3])
                  for (const grupo of GRUPOS)
                    for (const compensa of GRUPOS) {
                      if (grupo === compensa) continue;
                      const p = { nivelExperiencia, equipamento, objetivo, divisaoPreferida, diasDisponiveis, tempoPorSessaoMin };
                      const semFoco = plano(perfil(p), semana);
                      const comF = plano(perfil({ ...p, foco: { grupo, compensa, semana: 1 } }), semana);
                      // Limitação preexistente não é defeito do foco: só acusa o que o foco INTRODUZ.
                      if (!equilibrada(semFoco) || equilibrada(comF)) continue;
                      falhas.push(
                        `${nivelExperiencia}/${equipamento}/${objetivo}/${divisaoPreferida}/${diasDisponiveis}d/${tempoPorSessaoMin}min/S${semana} foco=${grupo}←${compensa}: ${conta(semFoco, 'puxar')}/${conta(semFoco, 'empurrar')} → ${conta(comF, 'puxar')}/${conta(comF, 'empurrar')}`,
                      );
                    }
    expect(falhas, `${falhas.length} combinações em que o FOCO introduziu o desequilíbrio:\n${falhas.slice(0, 20).join('\n')}`).toEqual([]);
  }, 600000);
});

// Fotografia/autoridade histórica: o seletor é congelado na etapa 1.
// As novas divisões reais são cobradas em distribuicao-etapa2.test.ts e na matriz externa.
vi.mock('./selecao-divisao', () => import('./__fixtures__/selecao-etapa1'));
