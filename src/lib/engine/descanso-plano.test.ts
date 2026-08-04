import { describe, expect, it } from 'vitest';
import { montarRotina } from './treino-montador';
import { prescreverTreino } from './treino';
import { avaliarGateTreino } from './treino-gate';
import { classeDeDescanso } from './descanso';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino } from './treino-types';

/**
 * 🔒 O DESCANSO NO **PLANO EMITIDO** — não na função (DF 2026-08-04, item 2 do lote).
 *
 * 🔴 O defeito que este arquivo fecha, medido em produção e reproduzido aqui: o plano trazia
 * **2 valores em 14 exercícios** (composto 180 · isolado 120), **idênticos da semana 1 à 5**.
 * A spec §🕐 promete o oposto — o número varia dentro da sessão E ao longo do mesociclo.
 *
 * 🔑 **A causa não era a regra: era o fio.** `deslocarPorRir` estava certo e testado; o
 * montador o alimentava com `prescricao.rirAlvoSemana ?? prescricao.rir.min` — e
 * `rirAlvoSemana` **só é preenchido pela retomada**. Fora da rampa entrava sempre a mesma
 * constante (o `rir.min`, que é o extremo agressivo), então os dois valores ficavam colados
 * no TOPO das faixas, semana após semana. `rirAlvoDaSemana` existia, exportada e testada, e
 * **nenhuma linha de produção a chamava**.
 *
 * ⚠️ Por isso as provas moram aqui e não em `descanso.test.ts`: **todas as asserções de
 * função passavam com a produção quebrada.** É a lição repetida da série — *a suíte prova
 * função, não montagem*.
 */

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

function perfil(over: Partial<PerfilTreino> = {}): PerfilTreino {
  return {
    sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
    objetivo: 'massa', flagsSaude: SEM, nivelExperiencia: 'intermediario',
    equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60,
    ...over,
  } as PerfilTreino;
}

/** O plano da semana `s`, com os descansos que a tela vai exibir. */
function plano(s: number, over: Partial<PerfilTreino> = {}) {
  const p = perfil(over);
  const presc = prescreverTreino(p, avaliarGateTreino(p));
  const r = montarRotina(presc, p, EXERCISES, new Set(), { semana: s as never });
  return r.dias.map((d) => ({
    nome: d.nome,
    slots: d.slots.map((sl) => ({
      classe: classeDeDescanso(EXERCISES.find((e) => e.id === sl.exercicio.id)!),
      descansoSeg: sl.descansoSeg ?? null,
    })),
  }));
}

const distintos = (dias: ReturnType<typeof plano>) =>
  [...new Set(dias.flatMap((d) => d.slots.map((s) => s.descansoSeg)).filter((v): v is number => v != null))].sort((a, b) => a - b);

describe('🔒 aceite 2 — o descanso do PLANO varia ao longo do mesociclo', () => {
  it('🔴 semana 1 × semana 5: o mesmo plano entrega descansos diferentes', () => {
    const s1 = distintos(plano(1));
    const s5 = distintos(plano(5));
    // Antes do conserto os dois conjuntos eram [120, 180] — byte-idênticos.
    expect(s1, `semana 1 e semana 5 emitem o mesmo conjunto: ${s1.join(',')}`).not.toEqual(s5);
    // E a direção é a da spec: longe da falha (RIR 3) → piso; perto (RIR 1) → topo.
    expect(Math.max(...s1)).toBeLessThan(Math.max(...s5));
  });

  it('as 6 semanas, juntas, usam mais de 2 valores — o "sempre o mesmo" morre', () => {
    const todos = new Set<number>();
    for (const s of [1, 2, 3, 4, 5, 6]) distintos(plano(s)).forEach((v) => todos.add(v));
    expect(todos.size, `o ciclo inteiro só produziu ${[...todos].join(',')}`).toBeGreaterThan(2);
  });

  it('a posição na faixa segue o RIR-alvo da semana, classe a classe', () => {
    // Composto 120–180 · Isolado/core 60–120 (spec §🕐, tabela das classes).
    const porSemana = (s: number) => {
      const slots = plano(s).flatMap((d) => d.slots);
      return {
        composto: [...new Set(slots.filter((x) => x.classe === 'COMPOSTO').map((x) => x.descansoSeg))],
        isolado: [...new Set(slots.filter((x) => x.classe === 'ISOLADO').map((x) => x.descansoSeg))],
      };
    };
    expect(porSemana(1)).toEqual({ composto: [120], isolado: [60] });   // RIR 3 → piso
    expect(porSemana(3)).toEqual({ composto: [150], isolado: [90] });   // RIR 2 → meio
    expect(porSemana(5)).toEqual({ composto: [180], isolado: [120] });  // RIR 1 → topo
  });
});

describe('🔒 aceite 1 — classes diferentes na MESMA sessão recebem descansos diferentes', () => {
  it('toda sessão com duas classes emite dois valores', () => {
    for (const s of [1, 3, 5]) {
      for (const dia of plano(s)) {
        const classes = new Set(dia.slots.map((x) => x.classe));
        if (classes.size < 2) continue; // sessão de uma classe só não tem o que comparar
        const valores = new Set(dia.slots.map((x) => x.descansoSeg));
        expect(valores.size, `semana ${s} · ${dia.nome}: ${classes.size} classes, ${valores.size} valor(es)`)
          .toBeGreaterThanOrEqual(2);
      }
    }
  });

  /**
   * ⚠️ ANTI-VACUIDADE: sem isto o teste acima passa quando NENHUMA sessão tem duas classes —
   * o `continue` engoliria o arquivo inteiro e o verde não significaria nada.
   */
  it('o arranjo existe: há sessões com duas classes no plano', () => {
    const comDuas = plano(1).filter((d) => new Set(d.slots.map((x) => x.classe)).size >= 2);
    expect(comDuas.length, 'nenhuma sessão mistura classes — o aceite 1 estaria vazio').toBeGreaterThan(0);
  });
});

describe('🔒 aceite 5 — o orçamento cede descanso, nunca exercício', () => {
  /**
   * ⚠️ A 1ª escrita comparava 30 min × 90 min e exigia o MESMO número de exercícios — e isso
   * a spec nunca prometeu: meia hora comporta menos trabalho que uma hora e meia, e a
   * medição confirma (12 × 14). A regra é outra: *nunca se corta exercício para caber
   * descanso*. Ela só se testa **dentro do mesmo orçamento**, comparando semanas em que a
   * exigência de descanso cresce.
   */
  it('🔑 no MESMO orçamento, a cobertura não cede quando o descanso cresce', () => {
    for (const tempoPorSessaoMin of [30, 45, 60, 90]) {
      const contagem = [1, 3, 5].map((s) => plano(s, { tempoPorSessaoMin }).flatMap((d) => d.slots).length);
      // Semana 5 exige o topo das faixas; se algum exercício sumisse para caber, a contagem cairia.
      expect(new Set(contagem).size, `${tempoPorSessaoMin} min: contagens ${contagem.join('/')} nas semanas 1/3/5`).toBe(1);
    }
  });

  it('quando o tempo aperta, quem cede é o DESCANSO — até os pisos de degradação', () => {
    const apertado = plano(5, { tempoPorSessaoMin: 30 });
    const folgado = plano(5, { tempoPorSessaoMin: 90 });
    expect(Math.max(...distintos(apertado))).toBeLessThan(Math.max(...distintos(folgado)));
    // Pisos travados na spec: isolado/core 60 s, composto 90 s. Nada abaixo disso.
    for (const d of apertado)
      for (const sl of d.slots)
        expect(sl.descansoSeg!, `${d.nome}: ${sl.classe} em ${sl.descansoSeg}s`)
          .toBeGreaterThanOrEqual(sl.classe === 'ISOLADO' ? 60 : 90);
  });
});
