import { describe, expect, it } from 'vitest';
import { montarRotina } from './treino-montador';
import { gerarTreino } from './index';
import { prescreverTreino } from './treino';
import { avaliarGateTreino } from './treino-gate';
import { tipoSessaoTemporal, PRINCIPAIS_TEMPO } from './adequacao-tempo-politica';
import { altaExigenciaDocumental, classeDeDescanso } from './descanso';
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

it('avisa descanso encurtado pelo foco somente quando um descanso realmente diminui', () => {
  const comum = {pesoKg:80,alturaCm:178,idade:30,objetivo:'massa' as const,equipamento:'academia' as const,
    limiteTempoTreino:'limitado' as const,tempoPorSessaoMin:45,flagsSaude:SEM};
  const semReducao = gerarTreino({...comum,nivelExperiencia:'iniciante',diasDisponiveis:4,
    treinoDias:['seg','ter','qua','qui'],foco:{grupo:'costas',semana:1}},
    {exercises:EXERCISES,semanaCiclo:{semana:5}}).rotina!;
  expect(semReducao.blocoFoco!.adicionais.length).toBeGreaterThan(0);
  expect(semReducao.dias.flatMap(d=>d.slots).find(s=>s.extraDoFoco)!.descansoSeg).toBe(180);
  expect(semReducao.avisos.some(a=>a.includes('descanso de'))).toBe(false);
  const comReducao = gerarTreino({...comum,nivelExperiencia:'avancado',diasDisponiveis:6,
    treinoDias:['seg','ter','qua','qui','sex','sab'],focoAgregado:{grupo:'bracos',semana:1}},
    {exercises:EXERCISES,semanaCiclo:{semana:5}}).rotina!;
  expect(comReducao.dias.flatMap(d=>d.slots).some(s=>s.extraDoFoco&&s.descansoSeg===60)).toBe(true);
  expect(comReducao.avisos.some(a=>a.includes('descanso de'))).toBe(true);
});

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
    semana: s,
    tipo: tipoSessaoTemporal(d.nome, d.slots.flatMap(sl => sl.exercicio.grupoPrimario ? [sl.exercicio.grupoPrimario] : []), r.dias.map(d => d.nome)),
    slots: d.slots.map((sl) => ({
      id: sl.exercicio.id,
      principal: PRINCIPAIS_TEMPO.includes(sl.exercicio.grupoPrimario!),
      complementar: ['core','panturrilha','antebraco'].includes(sl.exercicio.grupoPrimario??''),
      classe: classeDeDescanso(EXERCISES.find((e) => e.id === sl.exercicio.id)!),
      exigente: altaExigenciaDocumental(EXERCISES.find((e) => e.id === sl.exercicio.id)!),
      descansoSeg: sl.descansoSeg ?? null,
      series: sl.series,
      cortouTempo: sl.seriesAntesDoCorteDeTempo != null && sl.series! < sl.seriesAntesDoCorteDeTempo,
    })),
  }));
}

const distintos = (dias: ReturnType<typeof plano>) =>
  [...new Set(dias.flatMap((d) => d.slots.map((s) => s.descansoSeg)).filter((v): v is number => v != null))].sort((a, b) => (a ?? 0) - (b ?? 0));

/**
 * 🔻 FIXTURES MOVIDAS PARA ORÇAMENTO FOLGADO (120 min) — leva B do v4, 2026-08-13.
 *
 * O alocador por volume dá 6 slots a 60 min (antes: ~3,5), e 6 exercícios × ~4 séries com
 * descanso no TOPO da faixa (180 s na semana 5) não cabem em 60 min por aritmética — a
 * degradação travada (regra 3: cobertura > descanso) passa a agir nas semanas altas, POR
 * CIMA da posição por RIR. A REGRA que estes dois testes provam (posição na faixa segue o
 * RIR da semana) não mudou uma linha — o que mudou é onde ela fica visível sem a
 * degradação por cima: num orçamento que comporta a semana 5 cheia. A degradação em
 * orçamento apertado tem prova própria no aceite 5, abaixo (intacto).
 */
describe('🔒 aceite 2 — o descanso do PLANO varia ao longo do mesociclo', () => {
  it('🔴 semana 1 × semana 5: o mesmo plano entrega descansos diferentes', () => {
    const s1 = distintos(plano(1, { tempoPorSessaoMin: 120 }));
    const s5 = distintos(plano(5, { tempoPorSessaoMin: 120 }));
    // Antes do conserto os dois conjuntos eram [120, 180] — byte-idênticos.
    expect(s1, `semana 1 e semana 5 emitem o mesmo conjunto: ${s1.join(',')}`).not.toEqual(s5);
    // E a direção é a da spec: longe da falha (RIR 3) → piso; perto (RIR 1) → topo.
    expect(Math.min(...s1)).toBeLessThan(Math.min(...s5));
  });

  it('as 6 semanas, juntas, usam mais de 2 valores — o "sempre o mesmo" morre', () => {
    const todos = new Set<number>();
    for (const s of [1, 2, 3, 4, 5, 6]) distintos(plano(s)).forEach((v) => todos.add(v));
    expect(todos.size, `o ciclo inteiro só produziu ${[...todos].join(',')}`).toBeGreaterThan(2);
  });

  it('a posição na faixa segue o RIR-alvo da semana, classe a classe', () => {
    // Mede cada classe efetivamente presente; a seleção não precisa produzir todos
    // os subtipos de composto em cada semana para provar o transporte do RIR.
    for (const semana of [1, 3, 5]) {
      const slots = plano(semana, { tempoPorSessaoMin: 120 }).flatMap(d => d.slots);
      expect(slots.some(s => s.classe === 'COMPOSTO')).toBe(true);
      expect(slots.some(s => s.classe === 'ISOLADO')).toBe(true);
      for (const s of slots) {
        const esperado = s.classe === 'ISOLADO' ? ({ 1: 60, 3: 90, 5: 120 }[semana])
          : s.exigente ? 180 : ({ 1: 120, 3: 150, 5: 180 }[semana]);
        expect(s.descansoSeg, `${semana}/${s.id}`).toBe(esperado);
      }
    }
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
   * SER-4 preserva exercícios cedendo séries, portanto queda no número de exercícios
   * entre semanas não é mais a testemunha necessária da redução temporal. Neste perfil
   * intermediário, uma série abaixo de três testemunha a etapa E3 ou posterior.
   * Cobra-se que os compostos já estejam no piso quando isso ocorre, com casos dos dois
   * lados. Os orçamentos originais permanecem e acrescentamos 5/10/20 min.
   * O nome histórico fica preservado por ser chave da classificação do Vitest.
   */
  it('🔑 no MESMO orçamento, exercício só cede DEPOIS que todo o descanso cedeu', () => {
    let comReducao = 0; let semReducao = 0;
    for (const tempoPorSessaoMin of [5, 10, 20, 30, 45, 60, 90]) {
      const semanas = [1, 3, 5].map((s) => plano(s, { tempoPorSessaoMin }));
      for (const dias of semanas) for (const dia of dias) {
        // Fase A: cortes em principais exigem degradação prévia. A adição tardia de
        // complementar pode ceder sua própria dose, preservando o descanso dos principais.
        if (!dia.slots.some(s=>s.cortouTempo&&!s.complementar)) { semReducao++; continue; }
        comReducao++;
        const compostos=dia.slots.filter(s=>s.classe==='COMPOSTO');
        // Nicolas: segmentadas preservam descansos; FB/UL cedem até 60 s antes das séries.
        for (const s of compostos) {
          if (dia.tipo === 'segmentada' && !s.principal) {
            expect(s.descansoSeg).toBeGreaterThanOrEqual(s.exigente ? 120 : 90);
            continue;
          }
          const esperado = dia.tipo === 'segmentada' ? (s.exigente ? 180 : ({ 1: 120, 3: 150, 5: 180 }[dia.semana])) : 60;
          expect(s.descansoSeg, `${tempoPorSessaoMin}/${dia.nome}/${s.id}`).toBe(esperado);
        }
      }
    }
    expect(comReducao, 'nenhum orçamento cedeu séries: a implicação não foi exercida').toBeGreaterThan(0);
    expect(semReducao, 'todos os orçamentos cederam séries: o contraste sumiu').toBeGreaterThan(0);
  });

  it('quando o tempo aperta, quem cede é o DESCANSO — até os pisos de degradação', () => {
    const apertado = plano(5, { tempoPorSessaoMin: 30 });
    const folgado = plano(5, { tempoPorSessaoMin: 90 });
    // Um dia pode caber no topo enquanto outro precisa degradar: comparar os mesmos IDs.
    const longos=new Map(folgado.flatMap(d=>d.slots.map(s=>[`${d.nome}/${s.id}`,s.descansoSeg!] as const)));
    const pares=apertado.flatMap(d=>d.slots.map(s=>({curto:s.descansoSeg!,longo:longos.get(`${d.nome}/${s.id}`)}))).filter(x=>x.longo!=null);
    expect(pares.length).toBeGreaterThan(0);
    expect(pares.some(x=>x.curto<x.longo!),'nenhum descanso efetivamente degradado').toBe(true);
    expect(pares.every(x=>x.curto<=x.longo!)).toBe(true);
    // Pisos travados na spec: isolado/core 60 s, composto 90 s. Nada abaixo disso.
    for (const d of apertado)
      for (const sl of d.slots)
        expect(sl.descansoSeg!, `${d.nome}: ${sl.classe} em ${sl.descansoSeg}s`)
          .toBeGreaterThanOrEqual(sl.classe === 'ISOLADO' ? 60 : 90);
  });
});
