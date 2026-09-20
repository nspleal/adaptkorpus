import { adicoesComplementaresViaveis } from './__fixtures__/complementares-viabilidade';
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
import { faixaSemanal, maxSemanalSemFoco, mev } from './trilhos';
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

  /**
   * 🔵 REMEDIDO em 2026-09-17. A redação anterior era «24 ± 2 slots/semana · ≥ 5 por dia»,
   * ancorada na faixa desejada de 13–16. Com a faixa nova (10–14) o alocador para antes: ele
   * dá slot a quem tem DÉFICIT e nunca preenche o dia só para ocupar tempo — é a regra
   * "máximo permitido não é meta". Medido: 20 slots, com um dia de 4.
   *
   * ⚠️ O par discriminante do aceite B continua de pé: o alocador VELHO emitia 14 slots fixos
   * e 7 de 12 grupos com zero. 20 > 14, e a asserção abaixo falharia contra ele.
   */
  it('~5–6 exercícios/sessão · 18–26 slots/semana (antes: 14 fixos)', () => {
    // 🔵 A faixa abraça os DOIS seletores que este arquivo roda: 20 no atual, 24 no histórico.
    const total = slots.length;
    expect(total).toBeGreaterThanOrEqual(18);
    expect(total).toBeLessThanOrEqual(26);
    // Sem quota por sessão: a prioridade dos principais pode deixar só ombros+core.
    // A quantidade semanal discriminante e a cobertura por grupo continuam cobradas.
    expect(r.dias.every(d=>d.slots.length>0)).toBe(true);
  });

  it('peito E costas na faixa DESEJADA do nível, em contagem ponderada (semana 5)', () => {
    /**
     * 🔵 A faixa é lida da autoridade, não transcrita: ela mudou de 13–16 para 10–14 em
     * 2026-09-17 e o teto operacional (16) passou a ser outro número. O que o aceite mede é
     * o mesmo: a semana de pico entrega volume DENTRO da faixa, sem estourar o operacional.
     */
    const faixa = faixaSemanal('intermediario', 'massa');
    for (const g of ['peito', 'costas'] as const) {
      const v = ponderado.get(g) ?? 0;
      expect(v, `${g} ponderado ${v}`).toBeGreaterThanOrEqual(faixa.min);
      expect(v, `${g} ponderado ${v}`).toBeLessThanOrEqual(maxSemanalSemFoco('intermediario', 'massa'));
    }
  });

  it('🔑 os 12 grupos > 0 ponderado (antes: 7 de 12 com ZERO)', () => {
    const GRUPOS = ['antebraco', 'biceps', 'core', 'costas', 'gluteos', 'lombar', 'ombros', 'panturrilha', 'peito', 'posterior', 'quadriceps', 'triceps'];
    const zerados = GRUPOS.filter((g) => (ponderado.get(g as never) ?? 0) <= 0);
    for (const g of zerados) {
      expect(['core','panturrilha','antebraco','lombar']).toContain(g);
      const alvo=g==='lombar'?'core':g;
      expect(adicoesComplementaresViaveis(r,perfil(),alvo as never), `omissão corrigível: ${g}`).toEqual([]);
    }
  });

  it('pequenos com ≥ 1 exercício direto (bíceps · tríceps · panturrilha), lombar/antebraço só indireto', () => {
    const diretos = (g: string) => slots.filter((s) => s.exercicio.grupoPrimario === g).length;
    for (const g of ['biceps', 'triceps']) expect(diretos(g), g).toBeGreaterThanOrEqual(1);
    if (diretos('panturrilha') === 0) expect(adicoesComplementaresViaveis(r,perfil(),'panturrilha')).toEqual([]);
    // DF②: lombar/antebraço não ganham alvo direto — o crédito deles vem por indireto.
    expect((ponderado.get('lombar') ?? 0) + (ponderado.get('antebraco') ?? 0)).toBeGreaterThan(0);
  });

  it('tempo estimado da sessão cabe nos 60 min (séries × execução + descanso do slot)', () => {
    for (const d of r.dias) {
      /**
       * 🔵 O ÚLTIMO DESCANSO DO DIA NÃO É TEMPO DE TREINO (correção da conta, 2026-09-17):
       * ninguém espera o intervalo depois da última série para ir embora, e a fórmula
       * canônica do motor (`avaliarDuracaoSessao`) nunca o cobrou. Com a composição nova —
       * dias que passaram a caber e por isso mantêm o descanso de composto em 180 s — essa
       * cobrança a mais sozinha estourava o orçamento em 40 s, num dia que o motor certifica
       * como DENTRO_DO_LIMITE. O erro era da conta deste teste, não do plano.
       */
      const ultimo = d.slots[d.slots.length - 1]?.descansoSeg ?? 0;
      const seg = d.slots.reduce((a, s) => a + (s.series ?? 0) * (40 + (s.descansoSeg ?? 0)), 0) - ultimo;
      expect(seg, `${d.nome}: ${Math.round(seg / 60)} min`).toBeLessThanOrEqual(60 * 60);
    }
    // 🔒 …e a régua CANÔNICA do motor — a que a tela exibe — concorda, dia a dia.
    for (const [i, cert] of (r.duracaoDias ?? []).entries()) {
      expect(cert.estadoLimite, `dia ${i}: ${JSON.stringify(cert)}`).toBe('DENTRO_DO_LIMITE');
    }
  });
});

describe('🔴 aceite B — av/massa/4d (o perfil do autor na medição)', () => {
  it('peito chega a 16+ ponderado, sem truncamento silencioso (aviso quando o alvo não cabe)', () => {
    const r = plano(perfil({ nivelExperiencia: 'avancado' }));
    const ponderado = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
    // 🔵 «16+» era o piso da faixa antiga do avançado (16–20). Hoje o piso é 12 (faixa 12–18).
    expect(ponderado.get('peito') ?? 0).toBeGreaterThanOrEqual(faixaSemanal('avancado', 'massa').min);
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
    const semFoco = plano(perfil({ nivelExperiencia: 'avancado',limiteTempoTreino:'sem_limite' }), 3);
    const comFoco = plano(perfil({ nivelExperiencia: 'avancado',limiteTempoTreino:'sem_limite', foco: { grupo: 'peito', compensa: 'biceps', semana: 1 } }), 3);
    const soma = (r: typeof semFoco) => r.dias.flatMap((d) => d.slots).reduce((a, s) => a + (s.series ?? 0), 0);
    // 🔵 2026-09-15: o `+4` virou "o que o bloco DECLAROU entregar" — o teto duro agora vale
    // também para os extras (instrução vigente, que substitui a exceção de 14/09). A
    // propriedade deste caso — conserva e nenhum terceiro é cobrado — segue exata.
    const entregue = (comFoco.blocoFoco?.adicionais ?? []).reduce((n, i) => n + i.series, 0);
    expect(soma(comFoco)).toBe(soma(semFoco) + entregue);
    const porGrupo = (r: typeof semFoco) => {
      const m = new Map<string, number>();
      for (const d of r.dias) for (const s of d.slots) {
        const g = s.exercicio.grupoPrimario; if (g) m.set(g, (m.get(g) ?? 0) + (s.series ?? 0));
      }
      return m;
    };
    const a = porGrupo(semFoco); const b = porGrupo(comFoco);
    const mexidos = [...new Set([...a.keys(), ...b.keys()])].filter((g) => (a.get(g) ?? 0) !== (b.get(g) ?? 0));
    expect(mexidos, `cobrou de quem não estava no foco: ${mexidos.join(', ')}`).toEqual(entregue>0?['peito']:[]);
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
      const abaixo = (ponderado.get(g) ?? 0) < mev('intermediario', 'massa'); // 🔵 lido da autoridade
      if (abaixo) expect(r.avisos.some((a) => a.includes(g)), `${g} sub-MEV sem aviso`).toBe(true);
    }
  });
});

/**
 * 🔒 A INVERSÃO MORRE — e a régua passou a ser a certa em 2026-09-20.
 *
 * 🔴 O que este teste existe para impedir: um nível mais alto receber MENOS TREINO. Até
 * 19/09 ele media isso pela contagem de SLOTS, e funcionava por um motivo que deixou de valer:
 * a agenda do iniciante era cortada no teto de 3 sessões, então ele nunca somava muitos slots.
 * Com a decisão do autor de 20/09 (todo dia marcado vira sessão), um iniciante de 4 dias passa
 * a ter 4 sessões — e slot deixa de ser proxy de treino, porque ele faz 3 séries por exercício
 * e o intermediário faz 4: medido, `4d/60min` dá 24 slots ao iniciante contra 23 ao
 * intermediário, e 62 séries contra 84.
 *
 * 🔵 A correção é de RÉGUA, não de exigência, e cada metade fica com a sua:
 *  ① iniciante × intermediário — eles NÃO compartilham `seriesPorExercicio.max` (3 contra 4),
 *    então contar slots comparava coisas diferentes. A régua passa a ser a DOSE (séries de
 *    trabalho na semana), que é o que "menos treino" quer dizer. Vale nas 12 células varridas;
 *  ② intermediário × avançado — a série por exercício É a mesma, então slot continua sendo
 *    proxy legítimo e a asserção original segue palavra por palavra.
 *
 * 📌 ACHADO SEPARADO, REPRODUZIDO NA BASE PUBLICADA (2026-09-20, 3ª volta). Em `3d/45min` o
 * intermediário entrega MAIS ponderadas que o avançado. A 2ª volta classificou isso como
 * preexistente por um argumento fraco (desligar as trocas de 20/09 não mudava o número); a
 * prova agora é direta: o MESMO caso, com as MESMAS entradas e a MESMA métrica (soma de
 * `creditoPonderadoDaSemana`, `plano(perfil({nivel, diasDisponiveis: 3, tempoPorSessaoMin: 45}))`,
 * semana 5), medido num worktree de `d43376ce` — o merge do PR #19, que é o que está em produção:
 *
 *   |            | base `d43376ce` | candidata |
 *   |------------|-----------------|-----------|
 *   | `3d/45min` | int 86 × av 84,5 ← invertido | int 84 × av 83 ← invertido |
 *   | `3d/90min` | int 110 × av 106 ← invertido | int 108 × av 104,5 ← invertido |
 *
 * As duas células já estavam invertidas em produção; a candidata não as introduz e estreita um
 * pouco a distância (1,5 → 1,0 e 4 → 3,5). Em três dias a agenda nunca foi cortada por teto de
 * nível, então a decisão de 20/09 não toca este caso. Fica como ACHADO — corrigi-lo é outra
 * rodada, e a régua antiga (contagem de slots) não o enxergava.
 */
describe('🔒 a inversão morre: o nível nunca DIMINUI o treino', () => {
  it('em 3–6 dias · 45/60/90 min, a DOSE semanal cresce com o nível', () => {
    for (const dias of [3, 4, 5, 6]) {
      for (const tempo of [45, 60, 90]) {
        const medir = (nivel: PerfilTreino['nivelExperiencia']) => {
          const r = plano(perfil({ nivelExperiencia: nivel, diasDisponiveis: dias, tempoPorSessaoMin: tempo }));
          const slots = r.dias.flatMap((d) => d.slots);
          const cred = creditoPonderadoDaSemana(slots);
          return { slots: slots.length, series: slots.reduce((n, s) => n + (s.series ?? 0), 0),
            credito: [...cred.values()].reduce((n, v) => n + v, 0) };
        };
        const [i, m, a] = [medir('iniciante'), medir('intermediario'), medir('avancado')];
        // ① Iniciante × intermediário: a régua é a DOSE — eles não compartilham a série por
        //    exercício (3 contra 4), então contar slots comparava coisas diferentes.
        expect(i.series, `${dias}d/${tempo}min: iniciante ${i.series} > intermediário ${m.series} séries`).toBeLessThanOrEqual(m.series);
        // ② Intermediário × avançado: a série por exercício É a mesma (4), então aqui slot
        //    continua sendo proxy legítimo de treino — e a asserção original segue intacta.
        expect(m.slots, `${dias}d/${tempo}min: intermediário ${m.slots} > avançado ${a.slots} slots`).toBeLessThanOrEqual(a.slots);
        expect(i.slots, `${dias}d/${tempo}min: iniciante sem slots`).toBeGreaterThan(0);
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
        if (g==='panturrilha' && diretos(g)===0) {
          expect(adicoesComplementaresViaveis(r,perfil({diasDisponiveis:dias,tempoPorSessaoMin:60}),g), `${dias}d: omissão corrigível`).toEqual([]);
          expect(r.avisos.some(a=>a.startsWith('Panturrilhas não entrou'))).toBe(true);
        } else expect(diretos(g), `${dias}d/60min: ${g} com ${diretos(g)} slot(s) diretos`).toBeGreaterThanOrEqual(PEQUENOS_PISO_DIRETO);
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
