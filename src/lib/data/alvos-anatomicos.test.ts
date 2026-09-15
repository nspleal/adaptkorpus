/**
 * 🦴 Os casos de `testar.py` do pacote `mapa-consumo-motor-168-20260915`, reproduzidos sobre a
 * leitura TypeScript. O Python fica como referência funcional e não viaja para o bundle; o que
 * ele provava do consumidor tem de continuar valendo aqui.
 *
 * Mapa 1:1 com os 23 testes de lá. Dois não são portáveis, e o que os substitui está dito:
 *  · `test_origem_preservada_inteira` compara as 1.706 relações contra ORIGEM-CP02.json e os
 *    SHA-256 de ENTRADAS.json. Esses arquivos ficam NO PACOTE de propósito (são contexto
 *    científico, não array de seleção). Aqui prova-se o que o app pode provar: que as relações
 *    NÃO foram trazidas e que a proveniência registra quantas ficaram lá fora;
 *  · `test_csv_json_todas_colunas` confere as 819 linhas do CSV. O app não porta o CSV; no
 *    lugar, confere-se cada contagem de CONTAGENS.json contra os dados gerados, e o gerador
 *    tem `--check` para provar idempotência contra o pacote.
 *
 * 🔴 Estes testes existem para que uma distinção não volte a ser apagada por conveniência:
 * cabeça curta que não entra na dobradiça, sóleo que participa em pé, e129 que é adução, Y-T-W
 * que não é puxada, supino que não cobre deltoide posterior, condição que não se presume.
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES } from './exercises';
import {
  ALVOS_ANATOMICOS, ANATOMIA_POR_EXERCICIO, PROCEDENCIA_ANATOMICA, RESSALVA_COBERTURA,
  VOCABULARIO_CONDICAO, alvoConhecido, alvosDoExercicio, alvosDoGrupo, anatomiaDe,
  avaliarCobertura, candidatosParaAlvo, diretosDe, idsSemAnatomia,
} from './alvos-anatomicos';
import { DETALHE_ANATOMICO, FONTES_ANATOMICAS, LIMITES_DE_DISCRIMINACAO, REGRAS_ANATOMICAS } from './alvos-anatomicos-fontes';
import type { CondicaoExecucao } from './alvos-anatomicos-tipos';

const ids = Object.keys(ANATOMIA_POR_EXERCICIO);
const diretos = (id: string, cond?: CondicaoExecucao) => diretosDe(id, cond);

describe('① inventário real: os 168 ids do pacote são os 168 do catálogo', () => {
  it('mesmo conjunto de ids, sem sobra dos dois lados', () => {
    expect(ids.length).toBe(168);
    expect(new Set(ids)).toEqual(new Set(EXERCISES.map((e) => e.id)));
    expect(idsSemAnatomia(EXERCISES.map((e) => e.id))).toEqual([]);
  });

  it('nome e grupo do catálogo batem, id a id', () => {
    for (const e of EXERCISES) {
      const d = DETALHE_ANATOMICO[e.id]!;
      expect(d, e.id).toBeDefined();
      expect(d.nome, e.id).toBe(e.nomePt);
      expect(d.grupoCatalogo, e.id).toBe(e.grupoPrimario);
    }
  });
});

describe('② fontes e tipos resolvidos', () => {
  it('todo id tem alvo ou condicional, regra com fontes, e alvo do vocabulário', () => {
    for (const id of ids) {
      const e = ANATOMIA_POR_EXERCICIO[id]!;
      expect(e.alvos.length + e.condicionais.length, id).toBeGreaterThan(0);
      const regra = REGRAS_ANATOMICAS[e.regra];
      expect(regra, `${id}/${e.regra}`).toBeDefined();
      expect(regra!.fontes.length, e.regra).toBeGreaterThan(0);
      expect(regra!.natureza).toBe('inferencia_anatomica');
      for (const f of regra!.fontes) expect(FONTES_ANATOMICAS[f]?.url ?? '', f).toMatch(/^https:\/\//);
      for (const [alvo] of e.alvos) expect(alvoConhecido(alvo), `${id}/${alvo}`).toBe(true);
      for (const c of e.condicionais) {
        expect(Object.keys(c.quando).length, id).toBeGreaterThan(0);
        for (const alvo of c.alvos) expect(alvoConhecido(alvo), `${id}/${alvo}`).toBe(true);
      }
    }
  });

  it('toda consulta declara `inferencia_anatomica` — nada aqui é medição', () => {
    for (const id of ids) {
      for (const a of alvosDoExercicio(id).alvos) expect(a.base, id).toBe('inferencia_anatomica');
    }
  });
});

describe('③ bíceps: as duas cabeças, sem preferência inventada', () => {
  it('rosca direta, martelo e 21 abordam longa E curta — e nenhuma delas isola uma', () => {
    for (const id of ['e19', 'e72', 'e136']) {
      expect([...diretos(id)], id).toEqual(expect.arrayContaining(['bl', 'bc']));
      expect(DETALHE_ANATOMICO[id]!.enfasesContextuais, id).toEqual([]);
    }
    // Martelo acrescenta braquiorradial; não acrescenta seletividade de cabeça.
    expect(diretos('e72').has('bf')).toBe(true);
  });
});

describe('④ tríceps: três cabeças, sem exigir três exercícios', () => {
  it('um único exercício de extensão fecha as três', () => {
    const r = avaliarCobertura(['e68'], ['tl', 'tt', 'tm']);
    expect(r.semAlvoDiretoNesteConjunto).toEqual([]);
    expect(new Set(Object.keys(r.abordadosPorInferencia))).toEqual(new Set(['tl', 'tt', 'tm']));
  });
});

describe('⑤ ombro: supino NÃO cobre deltoide posterior', () => {
  it('e9 não tem dp como alvo direto; e107 tem', () => {
    expect(diretos('e9').has('dp')).toBe(false);
    expect(avaliarCobertura(['e9'], ['dp']).semAlvoDiretoNesteConjunto).toEqual(['dp']);
    expect(diretos('e107').has('dp')).toBe(true);
  });
});

describe('⑥ ombro: as três porções conforme a ação', () => {
  it('frontal + lateral + invertido fecham anterior/lateral/posterior', () => {
    expect(avaliarCobertura(['e98', 'e52', 'e107'], ['da', 'dl', 'dp']).semAlvoDiretoNesteConjunto).toEqual([]);
  });
});

describe('⑦ posterior: cabeça curta entra na flexão de joelho, não na dobradiça', () => {
  it('stiff e bom dia não recebem `fc`; mesa flexora recebe', () => {
    for (const id of ['e80', 'e81', 'e82', 'e117']) expect(diretos(id).has('fc'), id).toBe(false);
    expect(diretos('e65').has('fc')).toBe(true);
  });
});

describe('⑧ panturrilha: o sóleo também participa em pé', () => {
  it('e36 (em pé) tem sóleo direto; e158 (sentado) tem sóleo direto e gastrocnêmios auxiliares', () => {
    expect(diretos('e36').has('so')).toBe(true);
    expect([...diretos('e36')]).toEqual(expect.arrayContaining(['gm', 'gl']));
    expect([...diretos('e158')]).toEqual(['so']);
    const todos = alvosDoExercicio('e158').alvos.map((a) => a.alvo);
    expect(todos).toEqual(expect.arrayContaining(['gm', 'gl']));
  });
});

describe('⑨ banco romano: sem execução declarada, nada é presumido', () => {
  it('e104 não tem alvo direto nenhum até a articulação ser dita', () => {
    expect([...diretos('e104')]).toEqual([]);
    expect([...diretos('e104', { movimento: 'extensao_coluna' })]).toEqual(['er']);
    expect(new Set(diretos('e104', { movimento: 'dobradica_quadril' }))).toEqual(new Set(['gx', 'fl', 'st', 'sm']));
  });

  it('a condicional pendente aparece no diagnóstico, sem cobrir nem negar', () => {
    const r = avaliarCobertura(['e104'], ['er']);
    expect(r.abordadosPorInferencia).toEqual({});
    expect(r.semAlvoDiretoNesteConjunto).toEqual(['er']);
    expect(r.condicionaisNaoResolvidas.er?.map((c) => c.quando)).toContainEqual({ movimento: 'extensao_coluna' });
  });
});

describe('⑩ rolo de punho: não cobre os dois sentidos sem informação', () => {
  it('sem ação declarada só a pegada; com ela, o sentido pedido', () => {
    expect([...diretos('e139')]).toEqual(['df']);
    expect(new Set(diretos('e139', { acaoPunho: 'flexao' }))).toEqual(new Set(['df', 'wf']));
    expect(new Set(diretos('e139', { acaoPunho: 'extensao' }))).toEqual(new Set(['df', 'we']));
    expect(new Set(diretos('e139', { acaoPunho: 'ambas' }))).toEqual(new Set(['df', 'wf', 'we']));
  });
});

describe('⑪ elevação de pernas: o reto abdominal depende da retroversão pélvica', () => {
  it('sem retroversão declarada não cobre; declarada `false` também não; `true` cobre', () => {
    for (const id of ['e85', 'e88', 'e89']) {
      expect(diretos(id).has('ra'), id).toBe(false);
      expect(diretos(id, { retroversaoPelvica: true }).has('ra'), id).toBe(true);
      expect(diretos(id, { retroversaoPelvica: false }).has('ra'), id).toBe(false);
    }
  });
});

describe('⑫ e129 é adução, apesar do grupo histórico', () => {
  it('o alvo é `ad`, e `ad` pertence a adutores — não a glúteos', () => {
    expect([...diretos('e129')]).toEqual(['ad']);
    expect(ALVOS_ANATOMICOS.ad!.grupo).toBe('adutores');
    // 🔴 O catálogo do app mantém e129 em `gluteos` (decisão de conectividade da substituição).
    // As duas coisas convivem: o grupo do catálogo não vira alvo, e o alvo não muda o grupo.
    expect(EXERCISES.find((e) => e.id === 'e129')!.grupoPrimario).toBe('gluteos');
  });
});

describe('⑬ Y-T-W não é puxada', () => {
  it('e167 não tem latíssimo; tem trapézio inferior/médio e deltoide posterior', () => {
    expect(diretos('e167').has('lat')).toBe(false);
    expect([...diretos('e167')]).toEqual(expect.arrayContaining(['ti', 'tc', 'dp']));
  });
});

describe('⑭ cardio não fecha hipertrofia', () => {
  const cardio = ids.filter((id) => ANATOMIA_POR_EXERCICIO[id]!.uso === 'somente_informativo_cardio');

  it('são 12, e juntos não abordam NENHUM alvo diretamente', () => {
    expect(cardio.length).toBe(12);
    expect(avaliarCobertura(cardio, Object.keys(ALVOS_ANATOMICOS)).abordadosPorInferencia).toEqual({});
  });

  it('a participação informativa continua visível', () => {
    expect(Object.keys(avaliarCobertura(cardio, ['qf']).participacaoCardio)).toEqual(['qf']);
  });

  it('cardio não é candidato para nenhum alvo', () => {
    for (const alvo of Object.keys(ALVOS_ANATOMICOS)) {
      const { diretos: d, condicionais: c } = candidatosParaAlvo(alvo);
      for (const id of [...d, ...c]) expect(cardio, `${alvo}/${id}`).not.toContain(id);
    }
  });
});

describe('⑮ auxiliar não vira direto', () => {
  it('o tríceps do supino aparece como auxiliar e não fecha cobertura', () => {
    const r = avaliarCobertura(['e9'], ['tl']);
    expect(r.abordadosPorInferencia).toEqual({});
    expect(r.participacaoAuxiliar).toEqual({ tl: ['e9'] });
    expect(r.semAlvoDiretoNesteConjunto).toEqual(['tl']);
  });
});

describe('⑯ recusar a inferência não fabrica medição', () => {
  it('sem inferência não sobra nada — esta camada inteira é inferência', () => {
    expect(avaliarCobertura(['e68'], ['tl'], { aceitarInferencia: false }).abordadosPorInferencia).toEqual({});
  });
});

describe('⑰ condições inválidas são recusadas, não convertidas', () => {
  it.each([
    ['e104', { movimento: 'qualquer' }],
    ['e139', { acaoPunho: 'neutra' }],
    ['e85', { retroversaoPelvica: 'false' }],
    ['e85', { retroversaoPelvica: 1 }],
    ['e9', { angulo: 45 }],
  ])('%s recusa %j', (id, cond) => {
    expect(() => alvosDoExercicio(id, cond as unknown as CondicaoExecucao)).toThrow();
  });

  it('o vocabulário é fechado e declarado', () => {
    expect(VOCABULARIO_CONDICAO.movimento).toEqual(['dobradica_quadril', 'extensao_coluna']);
    expect(VOCABULARIO_CONDICAO.acaoPunho).toEqual(['ambas', 'extensao', 'flexao']);
    expect(VOCABULARIO_CONDICAO.retroversaoPelvica).toEqual([false, true]);
  });
});

describe('⑱ ids e alvos inválidos são erro, não silêncio', () => {
  it('id desconhecido, id repetido e alvo inventado derrubam a consulta', () => {
    expect(() => alvosDoExercicio('e999')).toThrow(/desconhecido/);
    expect(() => avaliarCobertura(['e68', 'e68'], ['tl'])).toThrow(/repetidos/);
    expect(() => avaliarCobertura(['e68'], ['cabeca_inventada'])).toThrow(/desconhecidos/);
    expect(() => avaliarCobertura(['e68'], ['tl'], { condicoesPorId: { e9: {} } })).toThrow(/ausente/);
    expect(() => candidatosParaAlvo('musculo_inventado')).toThrow(/desconhecido/);
    expect(anatomiaDe('e999')).toBeUndefined();
  });
});

describe('⑲ candidatos sem inventar músculo', () => {
  it('tibial anterior e multífido não têm candidato — e isso fica dito', () => {
    expect(candidatosParaAlvo('it')).toEqual({ diretos: [], condicionais: [] });
    expect(candidatosParaAlvo('mu')).toEqual({ diretos: [], condicionais: [] });
    expect(LIMITES_DE_DISCRIMINACAO.some((l) => /Tibial anterior e multífido/.test(l.alvo))).toBe(true);
  });

  it('cabeça curta do posterior: mesa flexora sim, stiff não', () => {
    expect(candidatosParaAlvo('fc').diretos).toContain('e65');
    expect(candidatosParaAlvo('fc').diretos).not.toContain('e80');
  });
});

describe('⑳ ênfase contextual do supino é contexto, nunca peso', () => {
  it('e9 puxa esternocostal e e10 clavicular, ambos sob o protocolo de barra', () => {
    for (const [id, alvo] of [['e9', 'pe'], ['e10', 'pc']] as const) {
      const x = DETALHE_ANATOMICO[id]!.enfasesContextuais[0]!;
      expect(x.alvo).toBe(alvo);
      expect(x.usarComoPesoAutomatico).toBe(false);
      expect(x.protocolo.implemento).toBe('barra');
      expect(x.limite).toMatch(/hipertrofia/);
    }
  });

  it('halteres ficam como transferência não validada', () => {
    expect(DETALHE_ANATOMICO.e12!.enfasesContextuais[0]!.aplicacao)
      .toBe('transferencia_barra_para_halter_nao_validada');
  });

  it('nenhuma ênfase é lida pelo motor — elas vivem no módulo de fontes, não no de dados', () => {
    for (const id of ids) expect(Object.keys(ANATOMIA_POR_EXERCICIO[id]!)).toEqual(['regra', 'uso', 'alvos', 'condicionais']);
  });
});

describe('㉑ a origem científica ficou NO PACOTE (substitui `test_origem_preservada_inteira`)', () => {
  it('nenhuma relação de ORIGEM-CP02 foi trazida para o app', () => {
    const bruto = JSON.stringify(ANATOMIA_POR_EXERCICIO);
    expect(bruto).not.toMatch(/evidenciaOrigemIds/);
    expect(bruto).not.toMatch(/"R\d{4}"/);
  });

  it('a proveniência registra quantas ficaram lá fora, e que nada foi certificado como preferência', () => {
    expect(PROCEDENCIA_ANATOMICA.relacoesOriginaisNoPacote).toBe(1706);
    expect(PROCEDENCIA_ANATOMICA.preferenciasRegionaisUniversaisCertificadas).toBe(0);
    expect(PROCEDENCIA_ANATOMICA.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('㉒ as contagens do pacote batem com o que foi gerado (substitui `test_csv_json_todas_colunas`)', () => {
  it('ids, alvos, regras, cardios, condicionais e ênfases', () => {
    expect(ids.length).toBe(PROCEDENCIA_ANATOMICA.ids);
    expect(Object.keys(ALVOS_ANATOMICOS).length).toBe(PROCEDENCIA_ANATOMICA.alvos);
    expect(Object.keys(REGRAS_ANATOMICAS).length).toBe(PROCEDENCIA_ANATOMICA.regras);
    expect(ids.filter((id) => ANATOMIA_POR_EXERCICIO[id]!.uso === 'somente_informativo_cardio').length)
      .toBe(PROCEDENCIA_ANATOMICA.idsCardio);
    expect(ids.filter((id) => ANATOMIA_POR_EXERCICIO[id]!.condicionais.length > 0).sort())
      .toEqual([...PROCEDENCIA_ANATOMICA.idsComCondicoes].sort());
    expect(ids.filter((id) => DETALHE_ANATOMICO[id]!.enfasesContextuais.length > 0).sort())
      .toEqual([...PROCEDENCIA_ANATOMICA.idsComEnfaseContextual].sort());
  });

  it('os cinco níveis anatômicos continuam distintos', () => {
    const tipos = new Set(Object.values(ALVOS_ANATOMICOS).map((a) => a.tipo));
    expect(tipos).toEqual(new Set(['cabeca', 'porcao', 'musculo', 'grupo_muscular', 'regiao_corporal']));
  });

  it('peito tem DUAS cabeças — não existe terceira quota inferior', () => {
    expect(alvosDoGrupo('peito')).toEqual(['pc', 'pe']);
    expect(LIMITES_DE_DISCRIMINACAO.some((l) => /Peitoral inferior/.test(l.alvo)
      && l.estado === 'nao_usar_como_quota_independente')).toBe(true);
  });
});

describe('㉓ a consulta não muda os dados', () => {
  it('ler os 168 duas vezes devolve exatamente o mesmo, e nada é mutado', () => {
    const antes = JSON.stringify(ANATOMIA_POR_EXERCICIO);
    const um = ids.map((id) => JSON.stringify(alvosDoExercicio(id)));
    const dois = ids.map((id) => JSON.stringify(alvosDoExercicio(id)));
    expect(um).toEqual(dois);
    expect(JSON.stringify(ANATOMIA_POR_EXERCICIO)).toBe(antes);
  });

  it('a ressalva acompanha toda cobertura — não é opcional', () => {
    expect(avaliarCobertura(['e9'], ['pc']).mensagem).toBe(RESSALVA_COBERTURA);
    expect(RESSALVA_COBERTURA).toMatch(/não comprova dose suficiente nem predominância/);
  });
});
