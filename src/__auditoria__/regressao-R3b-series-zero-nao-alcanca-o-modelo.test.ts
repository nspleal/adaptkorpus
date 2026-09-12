/**
 * ⚠️ R3, observação da conferência focal de `6847571` — O FALLBACK DE SÉRIES, MEDIDO.
 *
 * A conferência está certa em duas coisas, e as duas ficam registradas aqui:
 *
 *  1. `seriesDoSlot(sl) || linha.sets.length` **não trata só ausência**. `seriesDoSlot` é
 *     `slot.series ?? 0`, então "sem série decidida" e "série zero" chegam como o MESMO `0` e
 *     ativam o mesmo fallback. A afirmação anterior ("só cobre o slot que chega sem série
 *     decidida") era imprecisa e está corrigida na fonte.
 *  2. Ocorrência de slot com zero **não foi demonstrada** no fluxo real — nem por ela, nem
 *     por mim. Este arquivo demonstra o contrário: **não ocorre**, e por um motivo nomeável.
 *
 * 🔒 O que se mede aqui:
 *  ① varredura do espaço de planos gerados pelo motor — nenhum slot com `series` ausente,
 *    zero ou negativa;
 *  ② série manual FORA DE FAIXA (`0`, negativa, fracionária, acima do teto) é **recusada pelo
 *    montador**, que decide por conta própria — o zero morre no motor, não chega ao slot. Isso
 *    importa porque o schema de HIDRATAÇÃO deixa o valor passar de propósito (D6: derrubar a
 *    `rotinaCustom` inteira por um valor era pior), então o gate real é o montador (D3);
 *  ③ consequência: o fallback é **inalcançável** no fluxo real — a cópia do modelo sempre
 *    espelha o plano, e nenhuma série é inventada;
 *  ④ tripwire: se algum dia o motor passar a emitir zero, ① ou ② quebram ALTO e alguém
 *    decide o que a cópia deve fazer — em vez de o fallback inventar em silêncio.
 *
 * 🔴 NÃO afirma "nunca há série inventada em nenhuma circunstância": afirma que **neste
 * fluxo**, sob o espaço varrido, o fallback não é alcançado. Um slot construído à mão em
 * teste alcança, e o caso ③ mostra exatamente o que acontece então.
 */
import { describe, expect, it } from 'vitest';
import { linhaDaBiblioteca, linhasDoModelo } from '../components/painel/RegistrarTreino';
import { EXERCISES } from '../lib/data/exercises';
import { EXERCISES_SEED } from '../lib/data/seed';
import { seriesDoSlot } from '../lib/series-treino';
import { montarRotina } from '../lib/engine/treino-montador';
import { prescreverTreino } from '../lib/engine/treino';
import { avaliarGateTreino } from '../lib/engine/treino-gate';
import type { DiaTreino, PerfilTreino, PrescricaoFITT, SemanaCiclo } from '../lib/engine/treino-types';

const PRESCRICAO = {
  seriesPorExercicio: { min: 3, max: 4 },
  repsComposto: { min: 6, max: 10 },
  repsIsolado: { min: 10, max: 15 },
} as PrescricaoFITT;

const base: PerfilTreino = {
  pesoKg: 80, alturaCm: 175, idade: 34,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia',
  diasDisponiveis: 3, tempoPorSessaoMin: 60,
};

const comManual = (v: number): PerfilTreino => ({
  ...base,
  rotinaCustom: { origem: 'usuario', dias: [{ nome: 'A', diaId: 'seg', exercicioIds: ['e1'], seriesPorExercicio: { e1: v } }] },
});

describe('⚠️ R3b ① — o motor não emite slot com série zero nem ausente', () => {
  it('varre o espaço de planos e não acha nenhum', () => {
    const achados: string[] = [];
    let slots = 0;
    for (const objetivo of ['emagrecimento', 'massa', 'saude'] as const)
      for (const nivelExperiencia of ['iniciante', 'intermediario', 'avancado'] as const)
        for (const equipamento of ['academia', 'casa', 'peso_corporal'] as const)
          for (const diasDisponiveis of [1, 3, 5, 6])
            for (const tempoPorSessaoMin of [10, 30, 60, 90])
              for (const semana of [1, 2, 4, 5, 6] as readonly SemanaCiclo[])
                // `volumeReferencia` é obrigatório no tipo: retomada sem ele não é retomada.
                for (const retomada of [undefined, { semana: 1, fator: 0.5, volumeReferencia: 12 }]) {
                  const p = { ...base, objetivo, nivelExperiencia, equipamento, diasDisponiveis, tempoPorSessaoMin } as PerfilTreino;
                  let rotina;
                  try {
                    const presc = prescreverTreino(p, avaliarGateTreino(p));
                    if (!presc) continue;
                    rotina = montarRotina(presc, p, EXERCISES, new Set(), { semana, ...(retomada ? { retomada } : {}) });
                  } catch { continue; } // gate que não entrega plano não é caso deste teste
                  for (const d of rotina?.dias ?? []) for (const sl of d.slots) {
                    slots += 1;
                    if (sl.series == null || sl.series <= 0) {
                      achados.push(`${objetivo}/${nivelExperiencia}/${equipamento}/${diasDisponiveis}d/${tempoPorSessaoMin}min/sem${semana}: ${sl.exercicio.id}=${String(sl.series)}`);
                    }
                  }
                }
    // Anti-vacuidade: a varredura tem de ter olhado um número sério de slots (medido: 32.244).
    expect(slots, 'a varredura não montou plano nenhum — o teste seria vazio').toBeGreaterThan(5000);
    expect(achados, `slots com série 0/ausente (${achados.length}): ${achados.slice(0, 5).join(' · ')}`).toEqual([]);
  });

  it('o deload reduz mas não zera — o piso do alívio é ≥ 1', () => {
    for (const manual of [1, 2, 3, 7, 20]) {
      const p = comManual(manual);
      const presc = prescreverTreino(p, avaliarGateTreino(p));
      for (const semana of [1, 2, 3, 4, 5, 6] as readonly SemanaCiclo[]) {
        const sl = montarRotina(presc, p, EXERCISES, new Set(), { semana }).dias[0]!.slots[0]!;
        expect(seriesDoSlot(sl), `manual=${manual} semana=${semana} zerou`).toBeGreaterThan(0);
      }
    }
  });
});

describe('⚠️ R3b ② — série manual fora de faixa morre no MOTOR, não no slot', () => {
  it.each([
    ['zero', 0],
    ['negativa', -3],
    ['fracionária', 0.5],
    ['acima do teto', 200],
  ])('%s é recusada: o montador decide e não marca como definida pelo usuário', (_r, v) => {
    const p = comManual(v);
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    const sl = montarRotina(presc, p, EXERCISES, new Set(), { semana: 1 }).dias[0]!.slots[0]!;
    expect(sl.series, 'o valor fora de faixa chegou ao slot').not.toBe(v);
    expect(seriesDoSlot(sl)).toBeGreaterThan(0);
    expect(sl.seriesDefinidasPeloUsuario ?? false, 'valor recusado foi marcado como escolha do usuário').toBe(false);
  });

  it.each([1, 99])('%s séries está DENTRO da faixa e é respeitada (anti-vacuidade)', (v) => {
    const p = comManual(v);
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    const sl = montarRotina(presc, p, EXERCISES, new Set(), { semana: 1 }).dias[0]!.slots[0]!;
    expect(sl.series).toBe(v);
    expect(sl.seriesDefinidasPeloUsuario).toBe(true);
    expect(linhasDoModelo({ nome: 'A', slots: [sl] } as DiaTreino, presc)[0]!.sets.length).toBe(v);
  });
});

describe('⚠️ R3b ③ — o que o fallback FAZ, se um dia for alcançado', () => {
  const slotCom = (series: number | undefined) => {
    const e = EXERCISES_SEED.find((x) => x.id === 'e1')!;
    return { nome: 'A', slots: [{ exercicio: e, padrao: e.padraoMovimento, ...(series == null ? {} : { series }) }] } as DiaTreino;
  };

  it('ausência e zero são INDISTINGUÍVEIS e caem no MESMO default da biblioteca', () => {
    const ausente = linhasDoModelo(slotCom(undefined), PRESCRICAO)[0]!.sets.length;
    const zero = linhasDoModelo(slotCom(0), PRESCRICAO)[0]!.sets.length;
    const daBiblioteca = linhaDaBiblioteca(EXERCISES_SEED.find((x) => x.id === 'e1')!, PRESCRICAO, true).sets.length;
    expect(ausente).toBe(daBiblioteca);
    expect(zero, 'zero e ausência deixaram de ser o mesmo caso — reveja o comentário da fonte').toBe(ausente);
    expect(seriesDoSlot(slotCom(0).slots[0]!)).toBe(seriesDoSlot(slotCom(undefined).slots[0]!));
  });

  it('série NEGATIVA também cai no default, em vez de produzir lista vazia', () => {
    // Com `||`, um negativo é truthy e `Array.from({length:-3})` daria `[]` — linha sem série
    // nenhuma e sem explicação. O `> 0` explícito é o que fecha isso.
    expect(linhasDoModelo(slotCom(-3), PRESCRICAO)[0]!.sets.length).toBe(3);
  });

  it('sem prescrição, ausência/zero caem em 3 — o default de sempre, não um número novo', () => {
    for (const s of [undefined, 0, -1]) {
      expect(linhasDoModelo(slotCom(s), null)[0]!.sets.length).toBe(3);
    }
  });

  it('a fonte registra que o fallback cobre zero, não só ausência', async () => {
    const { readFileSync } = await import('node:fs');
    const fonte = readFileSync('src/components/painel/RegistrarTreino.tsx', 'utf8');
    const i = fonte.indexOf('export function linhasDoModelo');
    const cabecalho = fonte.slice(Math.max(0, fonte.lastIndexOf('/**', i)), i);
    expect(cabecalho, 'o comentário voltou a afirmar que o fallback só trata ausência').not.toMatch(/só cobre o slot que chega\s*\n?\s*\*?\s*SEM série decidida/);
    expect(cabecalho).toMatch(/colapsa/);
    expect(cabecalho).toMatch(/INALCANÇÁVEL/);
  });

  it('o call site usa a comparação explícita, não a coerção do `||`', async () => {
    const { readFileSync } = await import('node:fs');
    const fonte = readFileSync('src/components/painel/RegistrarTreino.tsx', 'utf8');
    expect(fonte).toContain('const doPlano = seriesDoSlot(sl);');
    expect(fonte).toContain('doPlano > 0 ? doPlano : linha.sets.length');
    expect(/seriesDoSlot\(sl\)\s*\|\|/.test(fonte), 'a coerção do `||` voltou').toBe(false);
  });
});
