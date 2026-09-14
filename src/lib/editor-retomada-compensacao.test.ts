import { describe, expect, it } from 'vitest';
import { doPlano, paraRotinaCustom } from '@/components/painel/EditorTreino';
import { gerarTreino } from './engine';
import { EXERCISES } from './data/exercises';
import type { PerfilTreino, RotinaCustom, RotinaSemanal } from './engine/treino-types';
import type { OpcoesSemana } from './engine/treino-montador';

/**
 * 🔴 RETOMADA — A ESCOLHA DE UM EXERCÍCIO NÃO PAGA (NEM COBRA) EM OUTRO.
 *
 * Medido na revisão independente do candidato `cf88f9b` (14/09): ao entrar como teto na
 * rampa, a escolha manual passou a devolver ao round-robin do grupo a folga que ela mesma
 * liberava — e essa folga SUBIA um slot sobre o qual a pessoa não tinha dito nada. No dia
 * `seg` do perfil medido, reduzir só `e130` de 2 para 1 levava `e100` de 1 para 2: o total
 * de peito ficava nos mesmos 9 e a redução pedida virava troca de lugar. São 121 casos assim
 * na varredura por slot. O contrato vigente em `5d81d227` (`min(escolhida, série do slot)`)
 * nunca compensou nada em outro exercício — e a correção da permutação não tinha autoridade
 * para criar essa política.
 *
 * 🔒 A régua destes testes: o slot SEM escolha recebe exatamente a mesma série que receberia
 * se ninguém tivesse escolhido nada. O slot COM escolha nunca passa dela.
 */

const PERFIL: PerfilTreino = {
  pesoKg: 78, alturaCm: 175, idade: 28,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'massa', nivelExperiencia: 'avancado', equipamento: 'academia',
  diasDisponiveis: 5, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], tempoPorSessaoMin: 75,
  divisaoPreferida: 'prioridades', foco: { grupo: 'peito', compensa: 'ombros', semana: 1 },
  preferencias: {
    trocas: [{ de: 'e14', para: 'e130' }, { de: 'e52', para: 'e53' }, { de: 'e53', para: 'e106' },
      { de: 'e106', para: 'e52' }, { de: 'e1', para: 'e156' }],
    banidos: [],
  },
};

const RAMPA: OpcoesSemana = { semana: 3, retomada: { semana: 2, fator: 0.7, volumeReferencia: 16 } };

// O Painel fornece o contexto vigente ao capturar a dose real. O harness faz o mesmo.
const contextos = new WeakMap<RotinaSemanal, OpcoesSemana>();
const gerar = (p: PerfilTreino, ctx: OpcoesSemana) => {
  const r = gerarTreino(p, { exercises: EXERCISES, semanaCiclo: ctx }).rotina!;
  contextos.set(r, ctx); return r;
};
const abrir = (r: RotinaSemanal, p: PerfilTreino) => doPlano(r.dias, p.treinoDias ?? [], p.rotinaCustom, contextos.get(r)?.retomada);
const json = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const salvar = (r: RotinaSemanal, p: PerfilTreino) => json(paraRotinaCustom(abrir(r, p)));
const total = (r: RotinaSemanal) => r.dias.reduce((n, d) => n + d.slots.reduce((m, s) => m + (s.series ?? 0), 0), 0);
/** Dia + id + séries: o único par que prova preservação (o total esconde compensação). */
const porSlot = (r: RotinaSemanal) => {
  const m = new Map<string, number | undefined>();
  for (const d of r.dias) for (const s of d.slots) m.set(`${d.diaId}/${s.exercicio.id}`, s.series);
  return m;
};
/** O mesmo desenho, sem escolha nenhuma: a referência do "ninguém falou". */
const semEscolhaAlguma = (c: RotinaCustom): RotinaCustom => ({
  origem: 'usuario',
  dias: c.dias.map(({ nome, diaId, exercicioIds }) => ({ nome, diaId, exercicioIds })),
});
const comEscolha = (c: RotinaCustom, diaId: string, id: string, series: number): RotinaCustom => ({
  origem: 'usuario',
  dias: c.dias.map((d) => (d.diaId === diaId ? { ...d, seriesPorExercicio: { [id]: series } } : { ...d })),
});

describe('Retomada · a escolha de um slot não se paga em outro', () => {
  const desenho = semEscolhaAlguma(salvar(gerar(PERFIL, RAMPA), PERFIL));
  const referencia = gerar({ ...PERFIL, rotinaCustom: desenho }, RAMPA);

  it('anti-vacuidade: o dia medido tem grupo repartido desigualmente e a rampa corta de verdade', () => {
    const seg = referencia.dias.find((d) => d.diaId === 'seg')!;
    const peito = seg.slots.filter((s) => s.exercicio.grupoPrimario === 'peito').map((s) => s.series);
    expect(peito.length).toBeGreaterThanOrEqual(4);
    // Repartição desigual: é dela que o round-robin tira a folga quando um slot é reduzido.
    expect(new Set(peito).size).toBeGreaterThan(1);
    expect(total(referencia)).toBeLessThan(total(gerar(PERFIL, { semana: 1 })));
    // O caso nominal medido, preso por número: reduzir e130 não pode mexer em e100.
    expect(porSlot(referencia).get('seg/e130')).toBe(2);
    expect(porSlot(referencia).get('seg/e100')).toBe(1);
  });

  it('o caso medido: reduzir e130 de 2 para 1 não levanta e100 de 1 para 2', () => {
    const r = gerar({ ...PERFIL, rotinaCustom: comEscolha(desenho, 'seg', 'e130', 1) }, RAMPA);
    const depois = porSlot(r);
    expect(depois.get('seg/e130')).toBe(1);
    expect(depois.get('seg/e100')).toBe(1);
    for (const [k, v] of porSlot(referencia)) {
      if (k === 'seg/e130') continue;
      expect(`${k}=${depois.get(k)}`).toBe(`${k}=${v}`);
    }
  });

  it('varredura: reduzir UM slot em 1 nunca aumenta nenhum outro, em nenhum dia', () => {
    const base = porSlot(referencia);
    const subiram: string[] = [];
    const naoEntregues: string[] = [];
    for (const dia of referencia.dias) {
      for (const s of dia.slots) {
        if ((s.series ?? 0) < 2) continue;
        const alvo = s.series! - 1;
        const chave = `${dia.diaId}/${s.exercicio.id}`;
        const depois = porSlot(gerar({ ...PERFIL, rotinaCustom: comEscolha(desenho, dia.diaId!, s.exercicio.id, alvo) }, RAMPA));
        if (depois.get(chave) !== alvo) naoEntregues.push(`${chave}: pediu ${alvo}, veio ${depois.get(chave)}`);
        for (const [k, v] of base) {
          if (k === chave || depois.get(k) === undefined) continue;
          if (depois.get(k)! > v!) subiram.push(`ao reduzir ${chave}: ${k} ${v} -> ${depois.get(k)}`);
        }
      }
    }
    expect(subiram).toEqual([]);
    expect(naoEntregues).toEqual([]);
  });

  it('escolha guardada não alcança um plano que a pessoa não desenhou', () => {
    // Desenho sem nenhum exercício elegível: a montagem cai no plano ALOCADO, e o aplicador
    // manual (`seriesDefinidasPeloUsuario`) nunca roda ali. A rampa também não pode ler a
    // escolha ali — seria intenção manual aplicada a um plano que a pessoa não desenhou.
    const vazio: RotinaCustom = { origem: 'usuario', dias: [{ nome: 'Meu', diaId: 'qui', exercicioIds: [] }] };
    const vazioComEscolha: RotinaCustom = {
      origem: 'usuario',
      dias: [{ nome: 'Meu', diaId: 'qui', exercicioIds: [], seriesPorExercicio: { e41: 1, e54: 1, e107: 1, e111: 1 } }],
    };
    const sem = gerar({ ...PERFIL, rotinaCustom: vazio }, RAMPA);
    const com = gerar({ ...PERFIL, rotinaCustom: vazioComEscolha }, RAMPA);
    // Anti-vacuidade: o plano existe e tem dose acima do piso — há o que estragar.
    expect([...porSlot(sem).values()].some((v) => (v ?? 0) > 1)).toBe(true);
    expect([...porSlot(com)]).toEqual([...porSlot(sem)]);
  });

  it('inverter a ordem do dia não muda a dose de nenhum exercício', () => {
    // A rampa reparte em round-robin na ordem (dia, slot) e o ramo automático reordena depois.
    // Com a intenção como teto, a permutação deixa de decidir quem fica curto.
    const cheio = salvar(gerar(PERFIL, RAMPA), PERFIL);
    const invertido: RotinaCustom = { origem: 'usuario', dias: cheio.dias.map((d) => ({ ...d, exercicioIds: [...d.exercicioIds].reverse() })) };
    const direta = porSlot(gerar({ ...PERFIL, rotinaCustom: cheio }, RAMPA));
    const inversa = porSlot(gerar({ ...PERFIL, rotinaCustom: invertido }, RAMPA));
    expect(direta.size).toBeGreaterThan(20);
    for (const [k, v] of direta) expect(`${k}=${inversa.get(k)}`).toBe(`${k}=${v}`);
  });
});
