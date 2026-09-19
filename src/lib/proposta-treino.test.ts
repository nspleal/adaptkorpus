/**
 * 🔁 GERAR NOVO TREINO × ATUALIZAR TREINO — as duas ações, e a fronteira entre elas.
 *
 * O gerador usado aqui é o REAL (`recomputarPlano` sobre o catálogo do app): o que estes
 * testes provam não é o formato do objeto, é o comportamento — que "gerar" não devolve o
 * desenho manual, que nada é gravado antes da confirmação, que "atualizar" preserva o que
 * ainda cabe, e que a ausência de alternativa é DITA em vez de maquiada.
 */
import { describe, expect, it } from 'vitest';
import { recomputarPlano } from './plano';
import { poolElegivel } from './engine/treino-montador';
import { orcamentoSlotsDoDia } from './engine/alocador';
import { EXERCISES_SEED } from './data/seed';
import {
  aplicarPropostaSobre, assinaturaDasEntradas, assinaturaDoTreino, atualizarDesenho,
  compararTreinos, proporTreino,
} from './proposta-treino';
import { normalizarEntradaPlanoVisivel } from './plano-cas-comando';
import { VARIACOES_TENTATIVAS_MAX } from './engine/treino-constants';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { RotinaCustom } from './engine';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const OPC = { semanaCiclo: { semana: 1 as const } };

const PERFIL = {
  sexo: 'masculino', idade: 30, alturaCm: 180, pesoKg: 80, nivelAtividade: 'moderado',
  objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia',
  equipamentosCasa: [], preferencia: null, alergenos: [], naoCurto: [], pratosCansados: [],
  favoritos: [], diasDisponiveis: 4, tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado',
  treinoDias: ['seg', 'ter', 'qui', 'sex'], flagsSaude: SEM,
} as unknown as PerfilResumo;

const gerar = (p: PerfilResumo) => recomputarPlano(p, OPC as never).treino.rotina;
const elegiveisDe = (p: PerfilResumo) => new Set(poolElegivel(EXERCISES_SEED, p, p.preferencias).map((e) => e.id));
const rotinaDe = (p: PerfilResumo) => gerar(p)?.dias ?? [];
const ids = (p: PerfilResumo) => rotinaDe(p).flatMap((d) => d.slots.map((s) => s.exercicio.id));

const entradaDe = (p: PerfilResumo) => normalizarEntradaPlanoVisivel(p, { semanaCiclo: { semana: 1, feedbackGrupos: [] } });

const propor = (tipo: 'gerar' | 'atualizar', perfil: PerfilResumo = PERFIL) => proporTreino({
  tipo, perfil, rotinaAtual: rotinaDe(perfil), gerar, elegiveis: elegiveisDe(perfil),
  entrada: entradaDe(perfil),
});

/**
 * Dois ids ELEGÍVEIS do perfil padrão, tirados do próprio pool. Fixar ids à mão já custou
 * um falso vermelho aqui: `e21` (barra fixa) é AVANÇADO e o perfil é intermediário — o
 * desenho o perdia por regra, não por defeito.
 */
const POOL = poolElegivel(EXERCISES_SEED, PERFIL, PERFIL.preferencias);
const ELEG_A = POOL.find((e) => e.grupoPrimario === 'peito')!.id;
const ELEG_B = POOL.find((e) => e.grupoPrimario === 'costas')!.id;

/** Um desenho manual plausível, derivado do plano automático e depois modificado. */
function desenhoManual(perfil: PerfilResumo = PERFIL): RotinaCustom {
  const dias = rotinaDe(perfil);
  return {
    origem: 'usuario',
    dias: dias.map((d, i) => ({
      nome: d.nome,
      diaId: d.diaId ?? (perfil.treinoDias ?? [])[i]!,
      exercicioIds: d.slots.map((s) => s.exercicio.id),
      seriesPorExercicio: Object.fromEntries(d.slots.map((s) => [s.exercicio.id, 3])),
    })),
  };
}

describe('🔁 GERAR — a proposta é montada separadamente do desenho manual', () => {
  it('com rotinaCustom, a proposta NÃO é o desenho: ela é a montagem do app', () => {
    const perfil = { ...PERFIL, rotinaCustom: desenhoManual() };
    // Um desenho reconhecível: um dia só, com dois exercícios.
    perfil.rotinaCustom = { origem: 'usuario', dias: [{ nome: 'Meu', diaId: 'seg', exercicioIds: [ELEG_A, ELEG_B] }] };
    const p = propor('gerar', perfil)!;
    expect(p.rotina.dias.length).toBeGreaterThan(1);
    expect(p.origemAntes).toBe('manual');
    expect(p.origemDepois).toBe('automatico');
    expect(p.mudancas.identica).toBe(false);
  });

  it('🔴 o desenho salvo NÃO é apagado para montar a proposta', () => {
    const rotinaCustom: RotinaCustom = { origem: 'usuario', dias: [{ nome: 'Meu', diaId: 'seg', exercicioIds: [ELEG_A] }] };
    const perfil = { ...PERFIL, rotinaCustom };
    const copia = JSON.parse(JSON.stringify(perfil)) as PerfilResumo;
    propor('gerar', perfil);
    expect(perfil, 'o perfil de entrada foi mutado').toEqual(copia);
    expect(perfil.rotinaCustom).toBe(rotinaCustom);
  });

  it('o perfil PROPOSTO tira o desenho e carimba a variação — e nada mais muda', () => {
    const perfil = { ...PERFIL, rotinaCustom: desenhoManual(), favoritos: ['e1'], mesocicloInicio: '2026-07-09' };
    const p = propor('gerar', perfil)!;
    expect(p.perfilProposto.rotinaCustom).toBeUndefined();
    const { rotinaCustom: _a, variacaoTreino: _b, ...restoProposto } = p.perfilProposto;
    const { rotinaCustom: _c, variacaoTreino: _d, ...restoAtual } = perfil;
    expect(restoProposto, 'a proposta mexeu em algo além do treino').toEqual(restoAtual);
    // 🔒 O que sustenta "reabrir mantendo exatamente a proposta aceita".
    expect(assinaturaDoTreino(gerar(p.perfilProposto)!.dias, perfil.treinoDias))
      .toBe(assinaturaDoTreino(p.rotina.dias, perfil.treinoDias));
  });

  it('ciclo, deload e histórico não são tocados pelo perfil proposto', () => {
    const perfil = { ...PERFIL, mesocicloInicio: '2026-07-09', deloadAte: '2026-09-20', reconhecidoEm: '2026-09-01T00:00:00.000Z' };
    const p = propor('gerar', perfil)!;
    expect(p.perfilProposto.mesocicloInicio).toBe('2026-07-09');
    expect(p.perfilProposto.deloadAte).toBe('2026-09-20');
    expect(p.perfilProposto.reconhecidoEm).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('🔁 GERAR — variedade só entre alternativas VÁLIDAS', () => {
  it('partindo do plano automático, a proposta é uma semana DIFERENTE', () => {
    const p = propor('gerar')!;
    expect(p.variedade).toBe('nova');
    expect(p.mudancas.identica).toBe(false);
    expect(p.perfilProposto.variacaoTreino).toBeGreaterThan(0);
  });

  it('a variação não afrouxa NADA: todo exercício proposto continua no pool elegível', () => {
    const perfil = { ...PERFIL, preferencias: { banidos: [ELEG_A, ELEG_B], trocas: [] } } as unknown as PerfilResumo;
    const p = propor('gerar', perfil)!;
    const elegiveis = elegiveisDe(perfil);
    for (const d of p.rotina.dias) for (const s of d.slots) {
      expect(elegiveis.has(s.exercicio.id), `${s.exercicio.id} não é elegível`).toBe(true);
    }
    expect(p.rotina.dias.flatMap((d) => d.slots.map((s) => s.exercicio.id))).not.toContain(ELEG_A);
  });

  it('a variação não muda o NÚMERO de dias, e nenhum dia passa do orçamento de slots', () => {
    const antes = rotinaDe(PERFIL);
    const p = propor('gerar')!;
    expect(p.rotina.dias.length).toBe(antes.length);
    /**
     * 🔵 2026-09-19: o NÚMERO de slots de um dia pode mudar com a variação — outro exercício
     * carrega outro crédito indireto, e o alocador por déficit para noutro ponto. É o que
     * `variacao-montagem.test.ts` já registrava como consequência medida; aqui o que se fixa é
     * que nenhum dia passa do orçamento f(tempo) e que a diferença fica em UM slot.
     */
    for (const [i, d] of p.rotina.dias.entries()) {
      expect(d.slots.length).toBeLessThanOrEqual(orcamentoSlotsDoDia(PERFIL.tempoPorSessaoMin));
      expect(Math.abs(d.slots.length - antes[i]!.slots.length)).toBeLessThanOrEqual(1);
    }
  });

  it('sem montagem diferente ⇒ DIZ `sem_alternativa`, e não finge novidade', () => {
    /**
     * 🔒 O gerador é INJETADO de propósito: aqui o que se prova é o comportamento do módulo
     * quando NENHUMA variação produz semana diferente — um catálogo travado de verdade. Com o
     * gerador real isso depende do catálogo do dia, e um teste que só vale enquanto o catálogo
     * for pequeno não prova a regra.
     */
    const fixa = gerar(PERFIL)!;
    const p = proporTreino({
      tipo: 'gerar', perfil: PERFIL, rotinaAtual: fixa.dias,
      gerar: () => fixa, elegiveis: elegiveisDe(PERFIL), tentativas: 3,
    })!;
    expect(p.variedade).toBe('sem_alternativa');
    expect(p.mudancas.identica).toBe(true);
    expect(p.mudancas.adicionados).toEqual([]);
    expect(p.mudancas.removidos).toEqual([]);
    expect(p.tentativas, 'a busca parou antes do teto pedido').toBe(3);
  });

  it('a variedade declarada nunca contradiz a comparação', () => {
    for (const perfil of [
      PERFIL,
      { ...PERFIL, equipamento: 'casa', equipamentosCasa: [], nivelExperiencia: 'iniciante', treinoDias: ['seg'], diasDisponiveis: 1 } as unknown as PerfilResumo,
      { ...PERFIL, rotinaCustom: desenhoManual() } as PerfilResumo,
    ]) {
      const p = propor('gerar', perfil)!;
      if (p.variedade === 'nova') expect(p.mudancas.identica, 'disse "nova" e a semana é a mesma').toBe(false);
      else expect(p.mudancas.identica, 'disse "sem alternativa" e a semana mudou').toBe(true);
    }
  });

  it('a busca tem TETO declarado e para nele', () => {
    const p = propor('gerar')!;
    expect(p.tentativas).toBeGreaterThanOrEqual(1);
    expect(p.tentativas).toBeLessThanOrEqual(VARIACOES_TENTATIVAS_MAX);
  });

  it('é determinística: o mesmo perfil propõe a mesma semana', () => {
    const a = propor('gerar')!;
    const b = propor('gerar')!;
    expect(assinaturaDoTreino(a.rotina.dias, PERFIL.treinoDias))
      .toBe(assinaturaDoTreino(b.rotina.dias, PERFIL.treinoDias));
    expect(a.perfilProposto.variacaoTreino).toBe(b.perfilProposto.variacaoTreino);
  });

  it('gerar de novo a partir da proposta aceita continua andando, não volta ao mesmo', () => {
    const primeira = propor('gerar')!;
    const depois = primeira.perfilProposto;
    const segunda = proporTreino({
      tipo: 'gerar', perfil: depois, rotinaAtual: rotinaDe(depois), gerar, elegiveis: elegiveisDe(depois),
    })!;
    expect(assinaturaDoTreino(segunda.rotina.dias, PERFIL.treinoDias))
      .not.toBe(assinaturaDoTreino(primeira.rotina.dias, PERFIL.treinoDias));
  });
});

describe('🧭 ATUALIZAR — preserva o compatível, ajusta só o que deixou de caber', () => {
  it('desenho inteiramente válido ⇒ nada a atualizar, e a proposta DIZ isso', () => {
    const perfil = { ...PERFIL, rotinaCustom: desenhoManual() };
    const p = propor('atualizar', perfil)!;
    expect(p.mudancas.identica).toBe(true);
    expect(p.desenhoAlterado.mudou, 'o desenho salvo mudou sem motivo').toBe(false);
    expect(p.origemDepois).toBe('manual');
  });

  /**
   * 🔴 O DEFEITO MEDIDO NO QA DE 16/09. O montador já descarta da GERAÇÃO o id que deixou de
   * ser elegível, então banir um exercício do desenho não muda o plano exibido — mas ele
   * continua GRAVADO no perfil. Comparando só as rotinas renderizadas, a tela dizia "nada a
   * atualizar" com algo a atualizar, e a pessoa não tinha como tirá-lo do desenho.
   */
  it('a tela igual não quer dizer desenho igual: o banido sai do desenho SALVO', () => {
    const desenho = desenhoManual();
    const alvo = desenho.dias[0]!.exercicioIds[0]!;
    const perfil = {
      ...PERFIL, rotinaCustom: desenho, preferencias: { banidos: [alvo], trocas: [] },
    } as unknown as PerfilResumo;
    const p = propor('atualizar', perfil)!;
    // A rotina exibida já não tinha o banido — ela é a mesma antes e depois.
    expect(rotinaDe(perfil).flatMap((d) => d.slots.map((s) => s.exercicio.id))).not.toContain(alvo);
    expect(p.mudancas.identica).toBe(true);
    // E, ainda assim, HÁ o que aplicar: o desenho salvo perde o id.
    expect(p.desenhoAlterado.mudou).toBe(true);
    expect(p.desenhoAlterado.idsRemovidos).toContain(alvo);
    expect(p.perfilProposto.rotinaCustom!.dias.flatMap((d) => d.exercicioIds)).not.toContain(alvo);
  });

  it('"gerar" a partir de um desenho manual sempre altera o desenho salvo (ele sai)', () => {
    const perfil = { ...PERFIL, rotinaCustom: desenhoManual() } as PerfilResumo;
    const p = propor('gerar', perfil)!;
    expect(p.desenhoAlterado.mudou).toBe(true);
    expect(p.perfilProposto.rotinaCustom).toBeUndefined();
  });

  it('plano automático: nem a rotina nem o desenho mudam em "atualizar"', () => {
    const p = propor('atualizar')!;
    expect(p.mudancas.identica).toBe(true);
    expect(p.desenhoAlterado.mudou).toBe(false);
    expect(p.desenhoAlterado.idsRemovidos).toEqual([]);
  });

  it('exercício banido depois sai; o resto do dia fica na mesma ordem', () => {
    const desenho = desenhoManual();
    const alvo = desenho.dias[0]!.exercicioIds[0]!;
    const perfil = {
      ...PERFIL, rotinaCustom: desenho,
      preferencias: { banidos: [alvo], trocas: [] },
    } as unknown as PerfilResumo;
    const p = propor('atualizar', perfil)!;
    const novo = p.perfilProposto.rotinaCustom!;
    expect(novo.origem, 'atualizar converteu o desenho em automático').toBe('usuario');
    expect(novo.dias[0]!.exercicioIds).not.toContain(alvo);
    expect(novo.dias[0]!.exercicioIds).toEqual(desenho.dias[0]!.exercicioIds.filter((id) => id !== alvo));
    // As séries escolhidas dos que ficaram são preservadas.
    for (const id of novo.dias[0]!.exercicioIds) expect(novo.dias[0]!.seriesPorExercicio?.[id]).toBe(3);
    expect(novo.dias[0]!.seriesPorExercicio?.[alvo]).toBeUndefined();
  });

  it('🔒 atualizar NUNCA transforma desenho manual em plano automático', () => {
    const desenho = desenhoManual();
    const perfil = { ...PERFIL, rotinaCustom: desenho } as PerfilResumo;
    const p = propor('atualizar', perfil)!;
    expect(p.origemAntes).toBe('manual');
    expect(p.origemDepois).toBe('manual');
  });

  it('plano automático: atualizar não tem o que adaptar, e não inventa mudança', () => {
    const p = propor('atualizar')!;
    expect(p.origemAntes).toBe('automatico');
    expect(p.origemDepois).toBe('automatico');
    expect(p.mudancas.identica).toBe(true);
    expect(p.perfilProposto.rotinaCustom).toBeUndefined();
  });

  it('dia fora da agenda vai para um dia de treino livre — e some quando não há nenhum', () => {
    const elegiveis = elegiveisDe(PERFIL);
    const desenho: RotinaCustom = {
      origem: 'usuario',
      dias: [
        { nome: 'A', diaId: 'seg', exercicioIds: [ELEG_A] },
        { nome: 'B', diaId: 'dom', exercicioIds: [ELEG_B] },
      ],
    };
    const comVaga = atualizarDesenho(desenho, { elegiveis, agenda: ['seg', 'ter'], automatico: [] });
    expect(comVaga.dias.map((d) => [d.diaId, d.exercicioIds])).toEqual([['seg', [ELEG_A]], ['ter', [ELEG_B]]]);
    const semVaga = atualizarDesenho(desenho, { elegiveis, agenda: ['seg'], automatico: [] });
    expect(semVaga.dias.map((d) => d.diaId)).toEqual(['seg']);
  });

  it('dia de agenda que o desenho não cobre recebe o dia automático — e nada quando não há', () => {
    const perfil = {
      ...PERFIL,
      rotinaCustom: { origem: 'usuario', dias: [{ nome: 'Só segunda', diaId: 'seg', exercicioIds: [ELEG_A, ELEG_B] }] },
    } as unknown as PerfilResumo;
    const p = propor('atualizar', perfil)!;
    const dias = p.perfilProposto.rotinaCustom!.dias;
    expect(dias[0]!.exercicioIds, 'o dia da pessoa foi alterado').toEqual([ELEG_A, ELEG_B]);
    expect(dias.length).toBeGreaterThan(1);
    for (const d of dias) expect(perfil.treinoDias).toContain(d.diaId!);
  });

  it('desenho inteiro invalidado e sem automático para pôr no lugar ⇒ o campo sai', () => {
    const desenho: RotinaCustom = { origem: 'usuario', dias: [{ nome: 'A', diaId: 'seg', exercicioIds: [ELEG_A] }] };
    const vazio = atualizarDesenho(desenho, { elegiveis: new Set(), agenda: ['seg'], automatico: [] });
    expect(vazio.dias).toEqual([]);
  });
});

describe('🔒 comparação e assinatura — a base do "o que muda"', () => {
  it('a assinatura leva a ORDEM do dia em conta', () => {
    const dias = rotinaDe(PERFIL);
    const invertido = dias.map((d) => ({ ...d, slots: [...d.slots].reverse() }));
    if (dias[0]!.slots.length > 1) {
      expect(assinaturaDoTreino(invertido, PERFIL.treinoDias))
        .not.toBe(assinaturaDoTreino(dias, PERFIL.treinoDias));
    }
  });

  it('o que muda é contado por DIA DA SEMANA, não por posição', () => {
    const antes = rotinaDe(PERFIL);
    const depois = antes.map((d, i) => (i === 0 ? { ...d, slots: d.slots.slice(1) } : d));
    const m = compararTreinos(antes, depois, PERFIL.treinoDias);
    expect(m.removidos).toEqual([antes[0]!.slots[0]!.exercicio.id]);
    expect(m.adicionados).toEqual([]);
    expect(m.identica).toBe(false);
  });

  it('dias que entram e saem são nomeados', () => {
    const antes = rotinaDe(PERFIL);
    const m = compararTreinos(antes, antes.slice(0, 1), PERFIL.treinoDias);
    expect(m.diasRemovidos.length).toBe(antes.length - 1);
    expect(m.diasAdicionados).toEqual([]);
  });
});

describe('🔒 o motor sem rotina não vira proposta', () => {
  it('perfil suspenso (campos ilegíveis) devolve null — a tela não propõe o que não existe', () => {
    const perfil = { ...PERFIL, camposInvalidos: ['nivelExperiencia'] } as unknown as PerfilResumo;
    expect(proporTreino({ tipo: 'gerar', perfil, rotinaAtual: [], gerar, elegiveis: new Set() })).toBeNull();
    expect(proporTreino({ tipo: 'atualizar', perfil, rotinaAtual: [], gerar, elegiveis: new Set() })).toBeNull();
  });
});

describe('🔒 as preferências vigentes entram nas DUAS ações', () => {
  it('mudar os dias de treino move a proposta para a agenda nova', () => {
    const perfil = { ...PERFIL, treinoDias: ['seg', 'qua', 'sex'], diasDisponiveis: 3 } as unknown as PerfilResumo;
    const p = propor('gerar', perfil)!;
    for (const d of p.rotina.dias) expect(['seg', 'qua', 'sex']).toContain(d.diaId);
  });

  it('mudar o equipamento muda o pool das duas — nenhuma proposta usa o que não existe', () => {
    const casa = {
      ...PERFIL, equipamento: 'casa', equipamentosCasa: [], nivelExperiencia: 'iniciante',
    } as unknown as PerfilResumo;
    const elegiveis = elegiveisDe(casa);
    const p = propor('gerar', casa)!;
    for (const d of p.rotina.dias) for (const s of d.slots) expect(elegiveis.has(s.exercicio.id)).toBe(true);
    expect(ids(casa).length).toBeGreaterThan(0);
  });
});


/**
 * 🔴 A PROPOSTA VELHA — o defeito que a validação de 16/09 procurou e achou.
 *
 * A proposta carrega um perfil INTEIRO. Aplicá-lo mais tarde devolvia ao perfil tudo o que
 * mudou no meio do caminho: um banimento feito noutra aba, a âncora de mesociclo que o próprio
 * app moveu, o peso que chegou de uma resposta assíncrona. A pessoa aceitaria um treino e
 * perderia, em silêncio, uma escolha mais nova.
 */
describe('🔒 proposta velha não grava, e aplicar é REBASE', () => {
  it('a assinatura muda quando uma preferência que decide o plano muda', () => {
    const a = assinaturaDasEntradas(PERFIL, entradaDe(PERFIL));
    const comBanimento = { ...PERFIL, preferencias: { banidos: [ELEG_A], trocas: [] } } as unknown as PerfilResumo;
    const outraAgenda = { ...PERFIL, treinoDias: ['seg', 'qua', 'sex'], diasDisponiveis: 3 } as unknown as PerfilResumo;
    expect(assinaturaDasEntradas(comBanimento, entradaDe(comBanimento))).not.toBe(a);
    expect(assinaturaDasEntradas(outraAgenda, entradaDe(outraAgenda))).not.toBe(a);
  });

  it('a assinatura muda quando a ENTRADA transitória muda (semana do ciclo)', () => {
    const semana1 = normalizarEntradaPlanoVisivel(PERFIL, { semanaCiclo: { semana: 1, feedbackGrupos: [] } });
    const semana6 = normalizarEntradaPlanoVisivel(PERFIL, { semanaCiclo: { semana: 6, feedbackGrupos: [] } });
    expect(assinaturaDasEntradas(PERFIL, semana1)).not.toBe(assinaturaDasEntradas(PERFIL, semana6));
  });

  it('🔑 a assinatura IGNORA o que a própria proposta decide', () => {
    const a = assinaturaDasEntradas(PERFIL, entradaDe(PERFIL));
    const comDecisao = { ...PERFIL, variacaoTreino: 5, rotinaCustom: desenhoManual() } as PerfilResumo;
    expect(assinaturaDasEntradas(comDecisao, entradaDe(comDecisao)), 'a saída entrou na assinatura da entrada').toBe(a);
  });

  it('a proposta carimba a assinatura das entradas que a geraram', () => {
    const p = propor('gerar')!;
    expect(p.assinaturaDasEntradas).toBe(assinaturaDasEntradas(PERFIL, entradaDe(PERFIL)));
  });

  it('aplicar preserva o que mudou depois: só `rotinaCustom` e `variacaoTreino` vêm da proposta', () => {
    const p = propor('gerar')!;
    // Entre montar e aplicar, o app moveu a âncora do ciclo e chegou um peso novo.
    const agora = { ...PERFIL, mesocicloInicio: '2026-09-14', deloadAte: '2026-10-01', pesoKg: 78.4 } as PerfilResumo;
    const aplicado = aplicarPropostaSobre(agora, p);
    expect(aplicado.mesocicloInicio, 'a âncora do ciclo foi revertida').toBe('2026-09-14');
    expect(aplicado.deloadAte, 'o deload foi revertido').toBe('2026-10-01');
    expect(aplicado.pesoKg, 'o peso foi revertido').toBe(78.4);
    expect(aplicado.variacaoTreino).toBe(p.perfilProposto.variacaoTreino);
    expect(aplicado.rotinaCustom).toBe(p.perfilProposto.rotinaCustom);
  });

  it('aplicar NÃO ressuscita um desenho que a proposta apagou', () => {
    const perfil = { ...PERFIL, rotinaCustom: desenhoManual() } as PerfilResumo;
    const p = propor('gerar', perfil)!;
    expect(aplicarPropostaSobre(perfil, p).rotinaCustom).toBeUndefined();
  });
});
