/**
 * 🧭 A ROTINA DO USUÁRIO NO MOTOR — aceites do handoff-editor-guiado-2026-08-13.
 *
 * 🔒 DF②, verbatim do autor: *"igual ao motor normal, a única diferença é que foi o usuário
 * que fez o treino"*. O que se prova aqui é exatamente isso: o desenho manda nos
 * EXERCÍCIOS, e séries/RIR/descanso/rampa/deload continuam do motor — **sem ramo especial**
 * (é o mesmo `montarSaida` dos dois caminhos).
 */
import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude } from './types';
import type { PerfilTreino, RotinaCustom, SemanaCiclo } from './treino-types';
import type { ExecucaoLateralidade } from '../data/types';
import type { Weekday } from '../semana';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60,
  ...over,
});
const plano = (
  p: PerfilTreino,
  semana: SemanaCiclo = 3,
  diasOferecidosCardio: readonly Weekday[] = [],
  escolhasExecucao: ReadonlyMap<string, ExecucaoLateralidade> = new Map(),
) => montarRotina(
  prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana }, undefined, escolhasExecucao, diasOferecidosCardio,
);

/**
 * Um desenho de 2 dias: peito+costas / pernas — exercícios reais, TODOS liberados para
 * intermediário na academia.
 *
 * ⚠️ Fixture corrigida na 1ª execução: a versão anterior usava `e26` (Terra, AVANÇADO) e o
 * filtro duro de nível corretamente o derrubava — o teste estava errado, não o motor. E o
 * peito precisa de 4 slots para a rampa ter ESPAÇO: a banda do intermediário/massa é 13–16
 * e o teto da distribuição é `n × sMax`; com 3 slots (12) o alvo já nasce truncado e fica
 * igual nas cinco semanas — "o volume sobe" seria falso por construção. Com 4 (16), a rampa
 * anda de 13 a 16. 🔑 Desenho pequeno NÃO rampa, e isso é comportamento honesto do motor:
 * quem avisa é o crítico, não um número inflado aqui.
 */
const DESENHO: RotinaCustom = {
  origem: 'usuario',
  dias: [
    { nome: 'Meu dia A', exercicioIds: ['e1', 'e14', 'e10', 'e11', 'e22'] },
    { nome: 'Meu dia B', exercicioIds: ['e16', 'e17', 'e57'] },
  ],
};

describe('🧭 o desenho do usuário manda nos EXERCÍCIOS', () => {
  it('🔴 aceite — o plano sai com exatamente o que a pessoa montou, na ordem dela', () => {
    const r = plano(perfil({ rotinaCustom: DESENHO }));
    expect(r.dias.map((d) => d.nome)).toEqual(['Meu dia A', 'Meu dia B']);
    expect(r.dias.map((d) => d.slots.map((s) => s.exercicio.id))).toEqual([['e1', 'e14', 'e10', 'e11', 'e22'], ['e16', 'e17', 'e57']]);
    expect(r.split).toBe('Meu treino');
  });

  it('🔴 aceite — as SÉRIES vêm do motor (o usuário não as edita) e o RIR/descanso também', () => {
    const p = perfil({ rotinaCustom: DESENHO });
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    const r = plano(p);
    for (const d of r.dias) {
      for (const s of d.slots) {
        expect(s.series, `${s.exercicio.id} sem séries do motor`).toBeGreaterThanOrEqual(presc.seriesPorExercicio.min);
        expect(s.series).toBeLessThanOrEqual(presc.seriesPorExercicio.max);
        expect(s.descansoSeg, `${s.exercicio.id} sem descanso do motor`).toBeGreaterThan(0);
      }
    }
  });

  it('🔴 aceite — a semana seguinte PROGRIDE sem trocar exercício (a promessa da DF②)', () => {
    const p = perfil({ rotinaCustom: DESENHO });
    const ids = (semana: SemanaCiclo) => plano(p, semana).dias.map((d) => d.slots.map((s) => s.exercicio.id).join(',')).join('|');
    const series = (semana: SemanaCiclo) => plano(p, semana).dias.flatMap((d) => d.slots.map((s) => s.series ?? 0)).reduce((a, b) => a + b, 0);
    // Mesmos exercícios nas 5 semanas de rampa…
    for (const s of [2, 3, 4, 5] as const) expect(ids(s), `semana ${s} trocou exercício`).toBe(ids(1));
    // …e o volume SOBE (é a rampa do mesociclo operando sobre o desenho do usuário).
    expect(series(5)).toBeGreaterThan(series(1));
  });

  it('deload (semana 6) e rampa continuam valendo no plano custom — sem ramo especial', () => {
    const r6 = plano(perfil({ rotinaCustom: DESENHO }), 6);
    expect(r6.semana).toEqual(expect.objectContaining({ numero: 6, deload: true }));
    for (const d of r6.dias) for (const s of d.slots) expect(s.series).toBeUndefined();
  });

  it('a retomada também opera sobre o desenho (o pipeline é um só)', () => {
    const p = perfil({ rotinaCustom: DESENHO });
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    const r = montarRotina(presc, p, EXERCISES, new Set(), {
      semana: 3, retomada: { semana: 1, fator: 0.5, volumeReferencia: 16 },
    });
    expect(r.avisos.some((a) => a.includes('Retomada'))).toBe(true);
  });
});

describe('🔒 os filtros DUROS continuam valendo sobre a escolha do usuário', () => {
  it('exercício banido depois sai do plano — sem apagar o desenho guardado', () => {
    const desenho: RotinaCustom = { origem: 'usuario', dias: [{ nome: 'A', exercicioIds: ['e1', 'e22'] }] };
    const r = plano(perfil({ rotinaCustom: desenho, preferencias: { trocas: [], banidos: ['e22'] } }));
    const ids = r.dias.flatMap((d) => d.slots.map((s) => s.exercicio.id));
    expect(ids).toContain('e1');
    expect(ids, 'o banido sobreviveu no plano custom').not.toContain('e22');
  });

  it('exercício acima do nível não entra (favoritar/escolher NÃO fura o nível)', () => {
    // e26 Terra é avançado — um iniciante que o escolheu não o recebe.
    const desenho: RotinaCustom = { origem: 'usuario', dias: [{ nome: 'A', exercicioIds: ['e1', 'e26'] }] };
    const r = plano(perfil({ rotinaCustom: desenho, nivelExperiencia: 'iniciante' }));
    expect(r.dias.flatMap((d) => d.slots.map((s) => s.exercicio.id))).not.toContain('e26');
  });

  it('exercício sem o equipamento não entra', () => {
    const desenho: RotinaCustom = { origem: 'usuario', dias: [{ nome: 'A', exercicioIds: ['e1', 'e9'] }] };
    const r = plano(perfil({ rotinaCustom: desenho, equipamento: 'nenhum' }));
    expect(r.dias.flatMap((d) => d.slots.map((s) => s.exercicio.id))).not.toContain('e9');
  });

  it('id inexistente é ignorado — o plano sai correto, sem quebrar', () => {
    const desenho: RotinaCustom = { origem: 'usuario', dias: [{ nome: 'A', exercicioIds: ['e1', 'nao_existe'] }] };
    const r = plano(perfil({ rotinaCustom: desenho }));
    expect(r.dias[0]!.slots.map((s) => s.exercicio.id)).toEqual(['e1']);
  });

  it('o teto de SESSÕES do nível continua valendo, e o corte é DITO (nunca silencioso)', () => {
    // Intermediário: teto 4 sessões/semana. Um desenho de 6 dias perde 2 — com aviso.
    const seis: RotinaCustom = {
      origem: 'usuario',
      dias: Array.from({ length: 6 }, (_, i) => ({ nome: `D${i + 1}`, exercicioIds: ['e1'] })),
    };
    const r = plano(perfil({ rotinaCustom: seis, diasDisponiveis: 6 }));
    expect(r.dias).toHaveLength(4);
    expect(r.avisos.some((a) => a.includes('ficaram fora desta semana')), `avisos: ${r.avisos.join(' | ')}`).toBe(true);
  });

  it('desenho VAZIO cai no gerador — nunca deixa a pessoa sem plano', () => {
    const vazio: RotinaCustom = { origem: 'usuario', dias: [{ nome: 'A', exercicioIds: [] }] };
    const r = plano(perfil({ rotinaCustom: vazio }));
    expect(r.dias.length).toBeGreaterThan(0);
    expect(r.split, 'o vazio virou "Meu treino" em vez de cair no gerador').not.toBe('Meu treino');
  });
});

describe('🔒 "Voltar ao recomendado" = apagar o campo, e nada mais', () => {
  it('sem `rotinaCustom` o plano é BYTE-IDÊNTICO ao de antes do editor', () => {
    const base = perfil();
    const comEDepoisSem = perfil({ rotinaCustom: undefined });
    expect(JSON.stringify(plano(comEDepoisSem))).toBe(JSON.stringify(plano(base)));
  });

  it('o campo é a ÚNICA diferença: com desenho, o plano muda; sem ele, volta', () => {
    const semDesenho = JSON.stringify(plano(perfil()));
    const comDesenho = JSON.stringify(plano(perfil({ rotinaCustom: DESENHO })));
    expect(comDesenho).not.toBe(semDesenho);
    expect(JSON.stringify(plano(perfil()))).toBe(semDesenho);
  });
});


describe('C1.1 · agenda explícita e cardio do plano manual', () => {
  it('preserva literalmente o treino manual e recomenda cardio apenas no dia oferecido livre', () => {
    const desenho: RotinaCustom = {
      origem: 'usuario',
      dias: [
        { nome: 'Força A', diaId: 'seg', exercicioIds: ['e1', 'e14'] },
        { nome: 'Força B', diaId: 'qua', exercicioIds: ['e16', 'e17'] },
      ],
    };
    const p = perfil({ objetivo: 'saude', diasDisponiveis: 2, treinoDias: ['seg', 'qua'], rotinaCustom: desenho });
    const r = plano(p, 3, ['ter']);
    // O motor pode recomendar cardio, mas não altera exercícios, ordem ou a agenda de musculação manual.
    expect(r.dias.map((d) => [d.diaId, d.slots.map((s) => s.exercicio.id)])).toEqual([
      ['seg', ['e1', 'e14']],
      ['qua', ['e16', 'e17']],
    ]);
    expect(r.planoFinalPorDia?.find((d) => d.diaId === 'seg')?.tipo).toBe('TREINO');
    expect(r.planoFinalPorDia?.find((d) => d.diaId === 'qua')?.tipo).toBe('TREINO');
    expect(r.diasCardio.some((d) => d.diaId === 'ter')).toBe(true);
  });

  it('liga escolha de execução do plano manual ao slot que a duração avalia', () => {
    const desenho: RotinaCustom = { origem: 'usuario', dias: [{ nome: 'Braços', diaId: 'seg', exercicioIds: ['e72'] }] };
    const r = plano(
      perfil({ diasDisponiveis: 1, treinoDias: ['seg'], rotinaCustom: desenho }),
      3,
      [],
      new Map([['e72', 'UNILATERAL_DOIS_LADOS']]),
    );
    expect(r.dias[0]?.slots[0]?.execucaoSelecionada).toBe('UNILATERAL_DOIS_LADOS');
    expect(r.duracaoDias?.[0]?.estadoCalculo).not.toBe('NAO_AVALIADO');
  });

  it('lê rotina legada sem dia e deriva a agenda uma vez, sem deslocar treino', () => {
    const legado: RotinaCustom = {
      origem: 'usuario',
      dias: [
        { nome: 'A', exercicioIds: ['e1'] },
        { nome: 'B', exercicioIds: ['e16'] },
      ],
    };
    const r = plano(perfil({ diasDisponiveis: 2, treinoDias: ['ter', 'sex'], rotinaCustom: legado }));
    expect(r.dias.map((d) => d.diaId)).toEqual(['ter', 'sex']);
  });
});
