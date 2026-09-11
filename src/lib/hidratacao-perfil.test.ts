import { describe, expect, it } from 'vitest';
import { migrarSessao } from './session';
import { linhaParaPerfil, perfilParaLinha } from './persistencia/perfil-profile';
import { recomputarPlano } from './plano';
import type { PerfilResumo } from '@/components/painel/Painel';

/**
 * 🔴 D6 (diagnóstico 2026-09-10, §6.7) — blob de perfil parcial não pode derrubar a geração.
 *
 * Medido no SHA `34b2ede`: `preferencias: { banidos: [] }` (sem `trocas`) fazia
 * `preferencias.ts:164` lançar `TypeError: prefs.trocas is not iterable` dentro de
 * `recomputarPlano` — **nenhum plano era gerado** e o app ficava sem plano até alguém limpar
 * o storage, sem mensagem nenhuma.
 *
 * O `PUT /api/dados/perfil` já validava (o `perfilResumoSchema` exige `trocas`). Os dois
 * vetores que NÃO validavam eram os de HIDRATAÇÃO: `normalizarPerfil` (blob do
 * `localStorage`, via `migrarSessao`) e `linhaParaPerfil` (jsonb `preferencias` do `profile`,
 * onde uma linha legada guarda qualquer forma). Os dois passaram a usar os MESMOS sub-schemas
 * do PUT — fonte única de validação, não uma terceira régua.
 *
 * 🔒 O critério é o do relatório (L6): `recomputarPlano` não lança para nenhum blob que passe
 * por essas bordas. Fuzz CURTO e nomeado (as ~20 formas que o campo pode assumir), não
 * centenas de casos aleatórios.
 */

const PERFIL_OK: PerfilResumo = {
  sexo: 'masculino', idade: 30, alturaCm: 178, pesoKg: 80,
  nivelAtividade: 'moderado', objetivo: 'massa',
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: [],
  diasDisponiveis: 4, treinoDias: ['seg', 'ter', 'qui', 'sab'], tempoPorSessaoMin: 60,
  alergenos: [], preferencia: null, naoCurto: [], pratosCansados: [], favoritos: [],
} as unknown as PerfilResumo;

/**
 * As formas que os quatro blocos de treino podem chegar de um storage velho ou de uma linha
 * legada. Cada nome é o caso, não um número de sorteio.
 */
const FORMAS: readonly [string, Record<string, unknown>][] = [
  ['preferencias sem trocas (o caso medido)', { preferencias: { banidos: [] } }],
  ['preferencias sem banidos', { preferencias: { trocas: [] } }],
  ['preferencias vazia', { preferencias: {} }],
  ['preferencias null', { preferencias: null }],
  ['preferencias como array', { preferencias: [] }],
  ['preferencias como string', { preferencias: 'nenhuma' }],
  ['trocas com item incompleto', { preferencias: { banidos: [], trocas: [{ de: 'e1' }] } }],
  ['trocas não-array', { preferencias: { banidos: [], trocas: 'e1' } }],
  ['banidos com número', { preferencias: { banidos: [7], trocas: [] } }],
  ['preferencias completa e válida', { preferencias: { banidos: ['e1'], trocas: [{ de: 'e2', para: 'e3' }] } }],
  ['foco sem semana', { foco: { grupo: 'peito', compensa: 'costas' } }],
  ['foco com grupo inexistente', { foco: { grupo: 'asa', compensa: 'costas', semana: 1 } }],
  ['foco null', { foco: null }],
  ['foco como string', { foco: 'peito' }],
  ['foco válido', { foco: { grupo: 'peito', compensa: 'costas', semana: 1 } }],
  ['divisaoPreferida inválida', { divisaoPreferida: 'fullbody' }],
  ['divisaoPreferida válida', { divisaoPreferida: 'prioridades' }],
  ['rotinaCustom sem origem', { rotinaCustom: { dias: [{ nome: 'A', exercicioIds: ['e1'] }] } }],
  ['rotinaCustom sem dias', { rotinaCustom: { origem: 'usuario' } }],
  ['rotinaCustom com dias não-array', { rotinaCustom: { origem: 'usuario', dias: 'seg' } }],
  ['rotinaCustom com séries fracionárias', { rotinaCustom: { origem: 'usuario', dias: [{ nome: 'A', diaId: 'seg', exercicioIds: ['e1'], seriesPorExercicio: { e1: 2.5 } }] } }],
  ['rotinaCustom válida', { rotinaCustom: { origem: 'usuario', dias: [{ nome: 'A', diaId: 'seg', exercicioIds: ['e1'], seriesPorExercicio: { e1: 3 } }] } }],
];

const gerar = (p: PerfilResumo) => recomputarPlano(p, { semanaCiclo: { semana: 1 } });

describe('D6 — o blob do localStorage não derruba a geração', () => {
  it('anti-vacuidade: o caso medido REALMENTE quebra quando entra cru no motor', () => {
    const cru = { ...PERFIL_OK, preferencias: { banidos: [] } } as unknown as PerfilResumo;
    expect(() => gerar(cru), 'o motor deixou de recusar o bloco parcial — a fixture perdeu o alvo')
      .toThrow();
  });

  it.each(FORMAS)('%s: migrarSessao entrega um perfil que gera plano', (_nome, over) => {
    const raw = JSON.stringify({ v: 2, perfil: { ...PERFIL_OK, ...over } });
    const res = migrarSessao(raw);
    expect(res, 'a sessão foi descartada inteira por um bloco de treino inválido').not.toBeNull();
    expect(() => gerar(res!.perfil)).not.toThrow();
    expect(gerar(res!.perfil).treino.rotina, 'plano vazio').toBeTruthy();
  });

  it('o bloco VÁLIDO sobrevive à hidratação (saneamento não é poda cega)', () => {
    const valido = { preferencias: { banidos: ['e1'], trocas: [{ de: 'e2', para: 'e3' }] }, foco: { grupo: 'peito', compensa: 'costas', semana: 1 }, divisaoPreferida: 'prioridades' };
    const res = migrarSessao(JSON.stringify({ v: 2, perfil: { ...PERFIL_OK, ...valido } }))!;
    expect(res.perfil.preferencias).toEqual(valido.preferencias);
    expect(res.perfil.foco).toEqual(valido.foco);
    expect(res.perfil.divisaoPreferida).toBe('prioridades');
  });

  it('preferências parciais conservam itens legíveis; o bloco irrecuperável é avisado', () => {
    const res = migrarSessao(JSON.stringify({ v: 2, perfil: { ...PERFIL_OK, preferencias: { banidos: [] }, foco: 'peito' } }))!;
    expect(res.perfil.preferencias).toEqual({ banidos: [], trocas: [] });
    expect(res.perfil.foco).toBeUndefined();
    expect(res.perfil.avisosHidratacao).toHaveLength(2);
  });

  /**
   * 🔎 Medido no navegador (2026-09-10): com o schema de ESCRITA saneando a hidratação, um
   * único valor de série fora de 1–99 apagava a `rotinaCustom` inteira e o treino montado pela
   * pessoa sumia no reload, sem uma palavra. A régua da hidratação é a da FORMA; o valor
   * atravessa e é recusado COM AVISO pelo montador (D3).
   */
  it('o desenho do usuário sobrevive a um valor de série fora da faixa (o aviso é do motor)', () => {
    const rotinaCustom = { origem: 'usuario', dias: [{ nome: 'Meu dia', diaId: 'seg', exercicioIds: ['e1', 'e9'], seriesPorExercicio: { e1: 5, e9: 0 } }] };
    const res = migrarSessao(JSON.stringify({ v: 2, perfil: { ...PERFIL_OK, rotinaCustom } }))!;
    expect(res.perfil.rotinaCustom, 'o desenho foi apagado por um número inválido').toEqual(rotinaCustom);
    const r = gerar(res.perfil).treino.rotina!;
    expect(r.split).toBe('Meu treino');
    expect(r.dias[0]!.slots.find((sl) => sl.exercicio.id === 'e1')!.series).toBe(5);
    expect(r.avisos.some((a) => /n[ãa]o [ée] um n[úu]mero inteiro/.test(a)), 'o motor não avisou sobre o valor recusado').toBe(true);
  });

  it('uma rotinaCustom com FORMA quebrada continua sendo descartada (é o que evita o crash)', () => {
    const res = migrarSessao(JSON.stringify({ v: 2, perfil: { ...PERFIL_OK, rotinaCustom: { origem: 'usuario', dias: 'seg' } } }))!;
    expect(res.perfil.rotinaCustom).toBeUndefined();
  });

  it('nada fora dos quatro blocos de treino é tocado', () => {
    const res = migrarSessao(JSON.stringify({ v: 2, perfil: { ...PERFIL_OK, preferencias: { banidos: [] } } }))!;
    expect(res.perfil.pesoKg).toBe(80);
    expect(res.perfil.treinoDias).toEqual(['seg', 'ter', 'qui', 'sab']);
    expect(res.perfil.favoritos).toEqual([]);
  });
});

describe('D6 — a linha legada do banco não derruba a geração', () => {
  /** Escreve o jsonb CRU, como uma linha antiga guardaria — o caminho que o PUT não vê. */
  const linhaCom = (over: Record<string, unknown>) => {
    const linha = perfilParaLinha(PERFIL_OK);
    const pref = { ...(linha.preferencias as unknown as Record<string, unknown>) };
    if ('preferencias' in over) pref.preferenciasTreino = over.preferencias;
    for (const k of ['foco', 'divisaoPreferida', 'rotinaCustom'] as const) {
      if (k in over) pref[k] = over[k];
    }
    return { ...linha, preferencias: pref };
  };

  it.each(FORMAS)('%s: linhaParaPerfil entrega um perfil que gera plano', (_nome, over) => {
    const perfil = linhaParaPerfil(linhaCom(over) as never);
    expect(() => gerar(perfil)).not.toThrow();
    expect(gerar(perfil).treino.rotina, 'plano vazio').toBeTruthy();
  });

  it('ida e volta preserva os blocos válidos', () => {
    const completo = {
      ...PERFIL_OK,
      preferencias: { banidos: ['e1'], trocas: [{ de: 'e2', para: 'e3' }] },
      foco: { grupo: 'peito', compensa: 'costas', semana: 1 },
      divisaoPreferida: 'prioridades',
    } as unknown as PerfilResumo;
    const volta = linhaParaPerfil(perfilParaLinha(completo) as never);
    expect(volta.preferencias).toEqual(completo.preferencias);
    expect(volta.foco).toEqual(completo.foco);
    expect(volta.divisaoPreferida).toBe('prioridades');
  });
});
