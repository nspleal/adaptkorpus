/**
 * 🔢 v4 — ACEITES DA LEVA B (handoff-motor-volume-v4-2026-08-12), medidos no plano.
 *
 * O par discriminante da leva inteira: o alocador velho emitia 14 slots fixos, 7 de 12
 * grupos com ZERO séries e o foco sem efeito no volume. Cada aceite abaixo falharia
 * contra o alocador velho — é isso que os torna prova, não descrição.
 */
import { describe, expect, it, vi } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { creditoPonderadoDaSemana, orcamentoSlotsDoDia, GRUPOS_PEQUENOS_PISO, PEQUENOS_PISO_DIRETO } from './alocador';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude } from './types';
import type { PerfilTreino, SemanaCiclo } from './treino-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60,
  ...over,
});
const plano = (p: PerfilTreino, semana: SemanaCiclo = 5) =>
  montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana });

describe('🔒 orçamento de slots = f(tempo) — a tabela do handoff, ancorada', () => {
  it('os degraus dados: ≤20→3 · 25–30→4 · 35–45→5 · 50–60→6 · ≥75→7', () => {
    expect(orcamentoSlotsDoDia(20)).toBe(3);
    expect(orcamentoSlotsDoDia(25)).toBe(4);
    expect(orcamentoSlotsDoDia(30)).toBe(4);
    expect(orcamentoSlotsDoDia(35)).toBe(5);
    expect(orcamentoSlotsDoDia(45)).toBe(5);
    expect(orcamentoSlotsDoDia(50)).toBe(6);
    expect(orcamentoSlotsDoDia(60)).toBe(6);
    expect(orcamentoSlotsDoDia(75)).toBe(7);
    expect(orcamentoSlotsDoDia(180)).toBe(7); // satura — tempo além de 75 não infla sessão
  });
});

describe('🔴 aceite B — int/massa/4d/60min (o perfil da medição de 2026-08-12)', () => {
  const r = plano(perfil());
  const slots = r.dias.flatMap((d) => d.slots);
  const ponderado = creditoPonderadoDaSemana(slots);

  it('~6 exercícios/sessão · 24 ± 2 slots/semana (antes: 14)', () => {
    const total = slots.length;
    expect(total).toBeGreaterThanOrEqual(22);
    expect(total).toBeLessThanOrEqual(26);
    for (const d of r.dias) expect(d.slots.length, d.nome).toBeGreaterThanOrEqual(5);
  });

  it('peito E costas na banda 13–16 em contagem ponderada (semana 5)', () => {
    for (const g of ['peito', 'costas'] as const) {
      const v = ponderado.get(g) ?? 0;
      expect(v, `${g} ponderado ${v}`).toBeGreaterThanOrEqual(13);
      expect(v, `${g} ponderado ${v}`).toBeLessThanOrEqual(16);
    }
  });

  it('🔑 os 12 grupos > 0 ponderado (antes: 7 de 12 com ZERO)', () => {
    const GRUPOS = ['antebraco', 'biceps', 'core', 'costas', 'gluteos', 'lombar', 'ombros', 'panturrilha', 'peito', 'posterior', 'quadriceps', 'triceps'];
    const zerados = GRUPOS.filter((g) => (ponderado.get(g as never) ?? 0) <= 0);
    expect(zerados, `grupos sem NENHUM estímulo: ${zerados.join(', ')}`).toEqual([]);
  });

  it('pequenos com ≥ 1 exercício direto (bíceps · tríceps · panturrilha), lombar/antebraço só indireto', () => {
    const diretos = (g: string) => slots.filter((s) => s.exercicio.grupoPrimario === g).length;
    for (const g of ['biceps', 'triceps', 'panturrilha']) expect(diretos(g), g).toBeGreaterThanOrEqual(1);
    // DF②: lombar/antebraço não ganham alvo direto — o crédito deles vem por indireto.
    expect((ponderado.get('lombar') ?? 0) + (ponderado.get('antebraco') ?? 0)).toBeGreaterThan(0);
  });

  it('tempo estimado da sessão cabe nos 60 min (séries × execução + descanso do slot)', () => {
    for (const d of r.dias) {
      const seg = d.slots.reduce((a, s) => a + (s.series ?? 0) * (40 + (s.descansoSeg ?? 0)), 0);
      expect(seg, `${d.nome}: ${Math.round(seg / 60)} min`).toBeLessThanOrEqual(60 * 60);
    }
  });
});

describe('🔴 aceite B — av/massa/4d (o perfil do autor na medição)', () => {
  it('peito chega a 16+ ponderado, sem truncamento silencioso (aviso quando o alvo não cabe)', () => {
    const r = plano(perfil({ nivelExperiencia: 'avancado' }));
    const ponderado = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
    expect(ponderado.get('peito') ?? 0).toBeGreaterThanOrEqual(16);
  });

  /**
   * 🔑 O par discriminante deste perfil MUDOU DE FORMA com a cascata (DF 2026-08-14), e o
   * motivo é medido: em avançado/4d a banda é 16–20, mas cada grupo cabe 3–4 slots × 4 = 12–16
   * séries — ou seja, **todo candidato a compensador já está no próprio piso**. Ceder o
   * empurraria abaixo dele, e a cascata proíbe (⓪ nenhum terceiro paga, ② o compensador não
   * fura o piso). A entrega correta aqui é ORDEM.
   *
   * ⚠️ A versão anterior afirmava "peito ganha série" e passava porque o motor cobrava de
   * quem tivesse menos déficit — `ombros −4` num plano onde ninguém pediu isso. Trocar a
   * asserção não é afrouxar: o que ela afirma agora é mais forte (conserva E ninguém de fora
   * é cobrado), e a prova de ENTREGA vive em `foco-entrega-real.test.ts`, num perfil onde o
   * compensador tem de fato o que ceder.
   */
  it('🔑 foco onde ninguém pode ceder: o plano CONSERVA e nenhum terceiro é cobrado', () => {
    const semFoco = plano(perfil({ nivelExperiencia: 'avancado' }), 3);
    const comFoco = plano(perfil({ nivelExperiencia: 'avancado', foco: { grupo: 'peito', compensa: 'biceps', semana: 1 } }), 3);
    const soma = (r: typeof semFoco) => r.dias.flatMap((d) => d.slots).reduce((a, s) => a + (s.series ?? 0), 0);
    expect(soma(comFoco), 'o volume da semana vazou').toBe(soma(semFoco));
    const porGrupo = (r: typeof semFoco) => {
      const m = new Map<string, number>();
      for (const d of r.dias) for (const s of d.slots) {
        const g = s.exercicio.grupoPrimario; if (g) m.set(g, (m.get(g) ?? 0) + (s.series ?? 0));
      }
      return m;
    };
    const a = porGrupo(semFoco); const b = porGrupo(comFoco);
    const mexidos = [...new Set([...a.keys(), ...b.keys()])].filter((g) => (a.get(g) ?? 0) !== (b.get(g) ?? 0));
    expect(mexidos, `cobrou de quem não estava no foco: ${mexidos.join(', ')}`).toEqual([]);
  });
});

describe('🔒 guard de cobertura — a pergunta que o motor nunca fez agora tem aviso', () => {
  it('grupo grande abaixo do MEV ponderado ⇒ aviso honesto (equipamento nenhum aperta o pool)', () => {
    // Sem equipamento o pool de costas/posterior encolhe — algum grande fica sub-MEV.
    const r = plano(perfil({ equipamento: 'nenhum', nivelExperiencia: 'iniciante', objetivo: 'massa', diasDisponiveis: 2, tempoPorSessaoMin: 20 }));
    expect(r.avisos.some((a) => a.includes('abaixo do mínimo')), `avisos: ${r.avisos.join(' | ')}`).toBe(true);
  });

  it('no perfil cheio (academia, 60 min) NENHUM grande fica sub-MEV sem aviso', () => {
    const r = plano(perfil());
    const ponderado = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
    for (const g of ['peito', 'costas', 'quadriceps', 'posterior', 'gluteos', 'ombros'] as const) {
      const abaixo = (ponderado.get(g) ?? 0) < 13; // MEV int/massa
      if (abaixo) expect(r.avisos.some((a) => a.includes(g)), `${g} sub-MEV sem aviso`).toBe(true);
    }
  });
});

describe('🔒 a inversão morre: slots iniciante ≤ intermediário ≤ avançado', () => {
  it('em 3–6 dias · 45/60/90 min, o nível nunca DIMINUI o treino', () => {
    for (const dias of [3, 4, 5, 6]) {
      for (const tempo of [45, 60, 90]) {
        const total = (nivel: PerfilTreino['nivelExperiencia']) =>
          plano(perfil({ nivelExperiencia: nivel, diasDisponiveis: dias, tempoPorSessaoMin: tempo })).dias.flatMap((d) => d.slots).length;
        const [i, m, a] = [total('iniciante'), total('intermediario'), total('avancado')];
        expect(i, `${dias}d/${tempo}min: iniciante ${i} > intermediário ${m}`).toBeLessThanOrEqual(m);
        expect(m, `${dias}d/${tempo}min: intermediário ${m} > avançado ${a}`).toBeLessThanOrEqual(a);
      }
    }
  });
});

/**
 * 🔒 O PISO DIRETO DOS PEQUENOS (DF② — "1–2 exercícios/semana"), re-ancorado na auditoria
 * de 2026-08-14. `PEQUENOS_PISO_DIRETO` existia como constante da spec e NINGUÉM a lia: o
 * piso vivia como um `- 1` cravado no passo 1b. Duas cópias do mesmo número, livres para
 * divergir — e nenhum teste exercitando o piso, então a divergência seria muda.
 *
 * O aceite abaixo falha contra o alocador VELHO (que não tinha reserva de pequenos: bíceps,
 * tríceps e panturrilha ficavam a zero direto) e falha de novo se alguém baixar a reserva.
 */
describe('🔒 DF② — bíceps, tríceps e panturrilha têm piso DIRETO na semana', () => {
  it('com orçamento que comporta, cada pequeno recebe ao menos PEQUENOS_PISO_DIRETO slot', () => {
    for (const dias of [3, 4, 5, 6]) {
      const r = plano(perfil({ diasDisponiveis: dias, tempoPorSessaoMin: 60 }));
      const diretos = (g: string) => r.dias.flatMap((d) => d.slots).filter((s) => s.exercicio.grupoPrimario === g).length;
      for (const g of GRUPOS_PEQUENOS_PISO) {
        expect(diretos(g), `${dias}d/60min: ${g} com ${diretos(g)} slot(s) diretos`).toBeGreaterThanOrEqual(PEQUENOS_PISO_DIRETO);
      }
    }
  });

  /**
   * PAR DISCRIMINANTE do piso: ele CEDE ao tempo, nunca o contrário (a reserva só existe
   * onde sobram slots para os grandes). Sem este par, "piso sempre garantido" passaria — e
   * seria uma regra diferente da que o cofre travou.
   */
  it('em tempo curto o piso cede: o dia de 20 min não sacrifica os grandes pelo acessório', () => {
    const r = plano(perfil({ diasDisponiveis: 3, tempoPorSessaoMin: 20 }));
    const slots = r.dias.flatMap((d) => d.slots);
    expect(slots.length).toBeGreaterThan(0);
    const pequenos = slots.filter((s) => (GRUPOS_PEQUENOS_PISO as readonly string[]).includes(s.exercicio.grupoPrimario ?? '')).length;
    expect(pequenos, 'com 3 slots/dia o acessório não pode dominar a sessão').toBeLessThan(slots.length);
  });
});

// Fotografia/autoridade histórica: o seletor é congelado na etapa 1.
// As novas divisões reais são cobradas em distribuicao-etapa2.test.ts e na matriz externa.
vi.mock('./selecao-divisao', async (importOriginal) => process.env.ADAPT_TEST_SELETOR_ATUAL === '1' ? importOriginal() : import('./__fixtures__/selecao-etapa1'));
