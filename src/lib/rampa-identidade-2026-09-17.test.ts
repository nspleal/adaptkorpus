/**
 * 🔵 A REPARTIÇÃO POR IDENTIDADE — validação além do caso que a motivou (2026-09-17, 2ª volta).
 *
 * 🔑 O defeito original: a rampa repartia as séries de um grupo em round-robin na ordem
 * (dia, POSIÇÃO do slot), e o ramo automático reordena os slots depois. O editor persiste a
 * ordem final; ao reabrir, a mesma rampa rodava sobre a outra permutação e o mesmo total do
 * grupo caía em exercícios diferentes — `qui/e54=1 e41=2` no plano contra `e54=2 e41=1` no
 * editor. O conserto ordena por IDENTIDADE: dia, depois nº de secundários grandes, depois id.
 *
 * 🔴 O que este arquivo cobra, e por quê:
 *  ① que `dia/id` de fato IDENTIFICA cada ocorrência (senão a comparação abaixo seria cega);
 *  ② igualdade **por slot** entre plano e editor — nunca por total, que é o que escondia o
 *    defeito;
 *  ③ estabilidade sob cinco idas e voltas, em fases diferentes (rampa, foco, deload, retomada
 *    e saída da retomada);
 *  ④ que a repartição não depende da ORDEM em que os slots chegam — a propriedade que o
 *    conserto estabelece, medida embaralhando o desenho;
 *  ⑤ que reduzir uma escolha não levanta outro slot em silêncio;
 *  ⑥ que trocar, remover e inserir exercícios continua devolvendo o que se pediu;
 *  ⑦ e os fallbacks: desenho vazio e desenho com ids inelegíveis.
 *
 * ⚠️ Nada aqui usa número de fixture: são propriedades. Onde um número aparece, ele é o do
 * próprio plano medido na mesma execução.
 */
import { describe, expect, it } from 'vitest';
import { recomputarPlano } from './plano';
import { doPlano, paraRotinaCustom } from '@/components/painel/EditorTreino';
import type { PerfilResumo } from '@/components/painel/Painel';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './engine/alocador';
import { faixaSemanal } from './engine/trilhos';
import { MARGEM_SEM_FOCO, TETO_PONDERADO_SESSAO, TETO_SEMANAL_HIPERTROFIA } from './engine/treino-constants';
import { MARCA_EXCECAO_SESSAO } from './engine/excecao-sessao';
import type { RotinaSemanal } from './engine/treino-types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilResumo> = {}): PerfilResumo => ({
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
  objetivo: 'massa', flagsSaude: SEM, alergenos: [], preferencia: null, naoCurto: [],
  pratosCansados: [], favoritos: [], nivelExperiencia: 'intermediario', equipamento: 'academia',
  equipamentosCasa: [], diasDisponiveis: 4, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], ...over,
}) as PerfilResumo;

const gerar = (p: PerfilResumo, opcoes: unknown): RotinaSemanal =>
  recomputarPlano(p, opcoes as never).treino.rotina!;

/** A chave que o relato usou e que este arquivo põe à prova: dia + id do exercício. */
const porSlot = (r: RotinaSemanal): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const d of r.dias) for (const s of d.slots) m[`${d.diaId}/${s.exercicio.id}`] = s.series ?? 0;
  return m;
};
/** A mesma coisa, mas SEM depender da chave — dia, posição, id e séries, como vieram. */
const porPosicao = (r: RotinaSemanal): string[] =>
  r.dias.map((d) => `${d.diaId}:${d.slots.map((s) => `${s.exercicio.id}x${s.series}`).join(',')}`);

/** Uma volta pelo editor: abre o plano, não edita nada, devolve a prévia. */
function idaEVolta(p: PerfilResumo, r: RotinaSemanal, opcoes: { semanaCiclo?: { retomada?: unknown } }) {
  const editaveis = doPlano(r.dias, p.treinoDias ?? [], p.rotinaCustom as never, opcoes.semanaCiclo?.retomada as never);
  const rotinaCustom = paraRotinaCustom(editaveis);
  const perfilComDesenho = { ...p, rotinaCustom } as PerfilResumo;
  return { perfil: perfilComDesenho, rotina: gerar(perfilComDesenho, opcoes) };
}

const FASES = [
  { nome: 'rampa S1', opcoes: { semanaCiclo: { semana: 1 } }, over: {} },
  { nome: 'rampa S3', opcoes: { semanaCiclo: { semana: 3 } }, over: {} },
  { nome: 'rampa S5 com foco', opcoes: { semanaCiclo: { semana: 5 } }, over: { foco: { grupo: 'peito', compensa: 'ombros', semana: 5 } } },
  { nome: 'deload S6', opcoes: { semanaCiclo: { semana: 6 } }, over: {} },
  { nome: 'retomada semana 1', opcoes: { semanaCiclo: { semana: 1, retomada: { semana: 1, fator: 0.5, volumeReferencia: 16 } } }, over: {} },
  { nome: 'saída da retomada (S2 normal)', opcoes: { semanaCiclo: { semana: 2 } }, over: {} },
  { nome: '6 dias, tempo curto', opcoes: { semanaCiclo: { semana: 4 } }, over: { diasDisponiveis: 6, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'], tempoPorSessaoMin: 45 } },
  { nome: 'avançado 5 dias 75 min', opcoes: { semanaCiclo: { semana: 3 } }, over: { nivelExperiencia: 'avancado', diasDisponiveis: 5, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], tempoPorSessaoMin: 75 } },
] as const;

// ── ① A CHAVE: dia/id identifica mesmo cada ocorrência? ──────────────────────

describe('🔒 dia/id identifica cada ocorrência do plano', () => {
  it('nenhum dia repete o mesmo exercício — a chave não colide em nenhuma fase', () => {
    const colisoes: string[] = [];
    let medidos = 0;
    for (const f of FASES) {
      const p = perfil(f.over as never);
      const r = gerar(p, f.opcoes);
      for (const d of r.dias) {
        medidos += d.slots.length;
        const ids = d.slots.map((s) => s.exercicio.id);
        if (new Set(ids).size !== ids.length) colisoes.push(`${f.nome}/${d.diaId}: ${ids.join(',')}`);
      }
    }
    expect(medidos, 'nenhum slot medido — a varredura degenerou').toBeGreaterThan(80);
    expect(colisoes, 'dia/id não identifica: há exercício repetido no mesmo dia').toEqual([]);
  });

  /**
   * 🔴 O MESMO EXERCÍCIO EM DIAS DISTINTOS — o caso que tornaria `id` sozinho ambíguo, e que
   * o `dia` resolve. Aqui ele é construído no DESENHO da pessoa, onde a repetição é uma
   * escolha explícita; no caminho automático ela também acontece (core 2–3×/semana), e isso é
   * medido no caso logo abaixo em vez de suposto.
   */
  it('o MESMO exercício em dias diferentes vira duas ocorrências, cada uma com a sua dose', () => {
    const p = perfil();
    const base = gerar(p, { semanaCiclo: { semana: 3 } });
    const repetido = base.dias[0]!.slots[0]!.exercicio.id;
    const dias = base.dias.slice(0, 2).map((d, i) => ({
      nome: d.nome, diaId: d.diaId,
      exercicioIds: i === 1 ? [repetido, ...d.slots.map((s) => s.exercicio.id).filter((x) => x !== repetido)]
        : d.slots.map((s) => s.exercicio.id),
    }));
    const r = gerar({ ...p, rotinaCustom: { origem: 'usuario', dias } } as PerfilResumo, { semanaCiclo: { semana: 3 } });
    const ocorrencias = r.dias.filter((d) => d.slots.some((s) => s.exercicio.id === repetido));
    expect(ocorrencias.length, `${repetido} não ficou nos dois dias — o caso não foi exercido`).toBe(2);
    const chaves = Object.keys(porSlot(r));
    for (const d of ocorrencias) expect(chaves, `${d.diaId}/${repetido} sumiu da chave`).toContain(`${d.diaId}/${repetido}`);
    expect(chaves.length, 'a chave perdeu ocorrências pelo caminho')
      .toBe(r.dias.reduce((n, d) => n + d.slots.length, 0));
  });

  /**
   * 🔴 O automático REPETE, sim — e é por isso que a chave precisa do dia.
   *
   * Medido: `avançado 5 dias/75 min` usa o mesmo exercício de core (`e147`) em dois dias, o
   * que a invariante de core 2–3×/semana produz naturalmente. `id` sozinho colidiria; `dia/id`
   * não. Este caso existe para que a repetição entre dias seja um FATO exercido, e não uma
   * hipótese — e para provar que as duas ocorrências têm dose própria.
   */
  it('o automático repete exercício entre DIAS, e cada ocorrência tem a sua própria dose', () => {
    const repetem: { fase: string; id: string; dias: string[] }[] = [];
    for (const f of FASES) {
      const r = gerar(perfil(f.over as never), f.opcoes);
      const vistos = new Map<string, string[]>();
      for (const d of r.dias) for (const s of d.slots) {
        vistos.set(s.exercicio.id, [...(vistos.get(s.exercicio.id) ?? []), d.diaId!]);
      }
      for (const [id, dias] of vistos) if (dias.length > 1) repetem.push({ fase: f.nome, id, dias });
    }
    // ⚠️ ANTI-VACUIDADE: sem repetição medida, `dia/id` não teria sido posto à prova.
    expect(repetem.length, 'nenhuma repetição entre dias — a colisão de `id` não foi exercida').toBeGreaterThan(0);
    for (const { fase, id, dias } of repetem) {
      const r = gerar(perfil(FASES.find((f) => f.nome === fase)!.over as never), FASES.find((f) => f.nome === fase)!.opcoes);
      const chaves = Object.keys(porSlot(r));
      for (const dia of dias) expect(chaves, `${fase}: ${dia}/${id} sumiu da chave`).toContain(`${dia}/${id}`);
      expect(chaves.length, `${fase}: a chave perdeu ocorrências — houve colisão`)
        .toBe(r.dias.reduce((n, d) => n + d.slots.length, 0));
    }
  });
});

// ── ② e ③ Plano ↔ editor, por slot, e sem deriva em cinco voltas ─────────────

describe('🔒 abrir, confirmar e reabrir devolve o MESMO treino, slot a slot', () => {
  for (const f of FASES) {
    it(`${f.nome}: dia, exercício e séries idênticos na primeira volta`, () => {
      const p = perfil(f.over as never);
      const antes = gerar(p, f.opcoes);
      expect(antes.dias.flatMap((d) => d.slots).length, 'plano vazio não prova paridade').toBeGreaterThan(5);
      const depois = idaEVolta(p, antes, f.opcoes as never).rotina;
      expect(porSlot(depois), 'a série mudou de exercício ao reabrir').toEqual(porSlot(antes));
      expect(porPosicao(depois), 'a ordem ou a composição mudou ao reabrir').toEqual(porPosicao(antes));
    });

    it(`${f.nome}: cinco voltas consecutivas sem deriva`, () => {
      const p = perfil(f.over as never);
      const inicial = gerar(p, f.opcoes);
      const alvo = porSlot(inicial);
      let atual = { perfil: p, rotina: inicial };
      for (let volta = 1; volta <= 5; volta += 1) {
        atual = idaEVolta(atual.perfil, atual.rotina, f.opcoes as never);
        expect(porSlot(atual.rotina), `volta ${volta}: o plano derivou`).toEqual(alvo);
      }
    }, 30_000);
  }
});

// ── ④ A propriedade que o conserto estabelece ────────────────────────────────

describe('🔒 a repartição não depende da ORDEM em que os slots chegam', () => {
  const embaralhar = <T>(xs: readonly T[], semente: number): T[] => {
    const a = [...xs];
    let s = semente;
    for (let i = a.length - 1; i > 0; i -= 1) {
      s = (s * 1103515245 + 12345) % 2147483648;
      const j = s % (i + 1);
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };

  /**
   * 🔒 A comparação é DESENHO × DESENHO, nunca desenho × automático. Os dois produtores têm
   * pipelines legitimamente diferentes (o automático acrescenta o bloco do foco, o manual
   * nunca passa por reduce-to-fit, e o deload lê a `referenciaDose` que o editor carrega),
   * então uma diferença entre eles não diria nada sobre ORDEM. Aqui o desenho é o mesmo em
   * tudo — só a ordem dos exercícios dentro do dia muda.
   */
  it('embaralhar a ordem dos exercícios do dia não move nenhuma série de exercício', () => {
    let medidos = 0;
    for (const f of FASES) {
      const p = perfil(f.over as never);
      const base = gerar(p, f.opcoes);
      const comDesenho = idaEVolta(p, base, f.opcoes as never);
      const referencia = porSlot(comDesenho.rotina);
      const custom = comDesenho.perfil.rotinaCustom as { dias: { exercicioIds: string[] }[] };
      for (const semente of [7, 23, 101]) {
        const dias = custom.dias.map((d, i) => ({ ...d, exercicioIds: embaralhar(d.exercicioIds, semente + i) }));
        const r = gerar({ ...comDesenho.perfil, rotinaCustom: { ...custom, dias } } as PerfilResumo, f.opcoes);
        medidos += 1;
        const depois = porSlot(r);
        for (const [chave, series] of Object.entries(referencia)) {
          expect(`${chave}=${depois[chave]}`,
            `${f.nome}/semente ${semente}: a dose mudou por causa da ORDEM`).toBe(`${chave}=${series}`);
        }
      }
    }
    expect(medidos, 'nenhuma permutação medida').toBeGreaterThan(20);
  }, 60_000);
});

// ── ⑤ Reduzir uma escolha não levanta outro slot ─────────────────────────────

describe('🔒 reduzir uma escolha não aumenta outro slot em silêncio', () => {
  /**
   * 🔒 O desenho de referência vem do EDITOR (`doPlano` → `paraRotinaCustom`), como na tela:
   * é ele que carrega a `referenciaDose` que impede o deload de ser aplicado duas vezes. A
   * redução é feita SOBRE esse desenho, e comparada com ele — as duas pontas no mesmo trilho.
   */
  it('baixar UMA série de um exercício deixa todos os outros exatamente como estavam', () => {
    let casos = 0;
    for (const f of FASES) {
      const p = perfil(f.over as never);
      const comDesenho = idaEVolta(p, gerar(p, f.opcoes), f.opcoes as never);
      const antes = porSlot(comDesenho.rotina);
      const custom = comDesenho.perfil.rotinaCustom as {
        dias: { diaId?: string; exercicioIds: string[]; seriesPorExercicio?: Record<string, number> }[];
      };
      const alvo = Object.entries(antes).find(([, n]) => n > 1);
      if (!alvo) continue;
      casos += 1;
      const [chave, series] = alvo;
      const [diaId, id] = chave.split('/') as [string, string];
      /**
       * 🔒 UMA entrada só — é o que a pessoa faz na tela quando digita um número num campo.
       * Preencher `seriesPorExercicio` para TODOS converteria cada slot em escolha manual, e
       * o deload trata escolha manual por outro caminho: a diferença medida seria da
       * conversão, não da redução.
       */
      const dias = custom.dias.map((d) => (d.diaId === diaId
        ? { ...d, seriesPorExercicio: { ...(d.seriesPorExercicio ?? {}), [id]: series - 1 } }
        : d));
      const r = gerar({ ...comDesenho.perfil, rotinaCustom: { ...custom, dias } } as PerfilResumo, f.opcoes);
      const depois = porSlot(r);
      expect(depois[chave], `${f.nome}: a redução pedida não foi respeitada`).toBe(series - 1);
      for (const [k, v] of Object.entries(antes)) {
        if (k === chave) continue;
        expect(`${k}=${depois[k]}`, `${f.nome}: ${k} subiu sozinho para cobrir a redução`).toBe(`${k}=${v}`);
      }
    }
    expect(casos, 'nenhum caso com slot acima de 1 série — o teste não exercitou nada').toBeGreaterThan(3);
  }, 60_000);
});

// ── ⑥ Trocar, remover e inserir ──────────────────────────────────────────────

describe('🔒 trocar, remover e inserir devolvem exatamente o que se pediu', () => {
  const opcoes = { semanaCiclo: { semana: 3 } };

  it('remover um exercício tira só ele, e os demais mantêm dia e identidade', () => {
    const p = perfil();
    const base = gerar(p, opcoes);
    const vitima = base.dias[0]!.slots[base.dias[0]!.slots.length - 1]!.exercicio.id;
    const dias = base.dias.map((d, i) => ({
      nome: d.nome, diaId: d.diaId,
      exercicioIds: d.slots.map((s) => s.exercicio.id).filter((id) => !(i === 0 && id === vitima)),
    }));
    const r = gerar({ ...p, rotinaCustom: { origem: 'usuario', dias } } as PerfilResumo, opcoes);
    expect(r.dias[0]!.slots.map((s) => s.exercicio.id), 'o exercício removido voltou ou outro saiu junto')
      .toEqual(base.dias[0]!.slots.map((s) => s.exercicio.id).filter((id) => id !== vitima));
    for (let i = 1; i < base.dias.length; i += 1) {
      expect(r.dias[i]!.slots.map((s) => s.exercicio.id), `o dia ${i} mudou sem ter sido tocado`)
        .toEqual(base.dias[i]!.slots.map((s) => s.exercicio.id));
    }
  });

  it('trocar a ordem de dois exercícios do dia não muda a dose de nenhum deles', () => {
    const p = perfil();
    const base = gerar(p, opcoes);
    const antes = porSlot(base);
    const dias = base.dias.map((d, i) => {
      const ids = d.slots.map((s) => s.exercicio.id);
      if (i === 0 && ids.length >= 2) [ids[0], ids[1]] = [ids[1]!, ids[0]!];
      return { nome: d.nome, diaId: d.diaId, exercicioIds: ids };
    });
    const r = gerar({ ...p, rotinaCustom: { origem: 'usuario', dias } } as PerfilResumo, opcoes);
    expect(porSlot(r), 'a troca de posição mexeu na dose — a repartição voltou a olhar a posição')
      .toEqual(antes);
  });
});

// ── ⑦ Fallbacks ─────────────────────────────────────────────────────────────

describe('🔒 os fallbacks do desenho continuam de pé', () => {
  it('rotinaCustom vazia não quebra e não vira plano fantasma', () => {
    const p = perfil();
    const r = recomputarPlano({ ...p, rotinaCustom: { origem: 'usuario', dias: [] } } as PerfilResumo, { semanaCiclo: { semana: 3 } } as never).treino.rotina;
    expect(r, 'o motor não devolveu rotina').toBeTruthy();
    expect(r!.dias.every((d) => d.slots.length >= 0)).toBe(true);
  });

  it('ids inelegíveis são recusados com explicação, e o plano não inventa dose para eles', () => {
    const p = perfil({ equipamento: 'nenhum', equipamentosCasa: [] } as never);
    const r = gerar({ ...p, rotinaCustom: { origem: 'usuario', dias: [
      { nome: 'A', diaId: 'seg', exercicioIds: ['e65', 'e15'] },
    ] } } as PerfilResumo, { semanaCiclo: { semana: 3 } });
    expect(r.avisos.some((a) => /não elegíveis no perfil/.test(a)),
      `a recusa ficou muda: ${r.avisos.join(' | ')}`).toBe(true);
    for (const d of r.dias) for (const s of d.slots) {
      expect(['e65', 'e15'], 'um id inelegível entrou no plano com dose').not.toContain(s.exercicio.id);
    }
  });
});

// ── ⑧ FORA DA HIPERTROFIA — a rampa mudou para TODOS, os números não ─────────

/**
 * 🔴 A LACUNA QUE ESTE BLOCO FECHA (2026-09-17, 3ª volta).
 *
 * A correção da rampa mora num trecho que NÃO é da hipertrofia: o laço que reparte o volume
 * por grupo roda para todo plano que tem `semanaCiclo`, qualquer que seja o objetivo. A
 * matriz acima, porém, é toda de `objetivo: 'massa'` — ela provava a estabilidade só onde os
 * números novos valem. Emagrecimento e saúde passavam pelo MESMO desempate sem cobertura.
 *
 * 🔒 O que se exige aqui é DUPLO, e as duas metades são independentes:
 *  ① a mesma estabilidade por slot (abrir/salvar/reabrir, cinco voltas, redução isolada,
 *    deload e retomada) nos outros dois objetivos;
 *  ② e que os números da hipertrofia NÃO tenham vazado para eles — propriedade de
 *    `ehHipertrofia`, medida contra a tabela do próprio objetivo, com anti-vacuidade contra
 *    a de `massa` no MESMO nível.
 *
 * ⚠️ "Não apareceu aviso novo" não entra como prova: o que se compara são as propriedades —
 * dose por slot, tetos publicados, fase, tempo e identidade das ocorrências.
 */
describe('🔒 a ordenação por identidade fora da hipertrofia', () => {
  const OUTROS = ['emagrecimento', 'saude'] as const;
  const FASES_FORA = [
    { nome: 'rampa S3', opcoes: { semanaCiclo: { semana: 3 } } },
    { nome: 'deload S6', opcoes: { semanaCiclo: { semana: 6 } } },
    { nome: 'retomada', opcoes: { semanaCiclo: { semana: 1, retomada: { semana: 1, fator: 0.5, volumeReferencia: 12 } } } },
    { nome: 'saída da retomada (S2)', opcoes: { semanaCiclo: { semana: 2 } } },
  ] as const;

  // ① Abrir, salvar e reabrir não redistribui nada — nos dois objetivos, nas quatro fases.
  for (const objetivo of OUTROS) for (const f of FASES_FORA) {
    it(`${objetivo}/${f.nome}: cinco voltas sem mover um slot`, () => {
      const p = perfil({ objetivo } as never);
      const inicial = gerar(p, f.opcoes);
      expect(inicial.dias.flatMap((d) => d.slots).length, 'plano vazio não prova paridade').toBeGreaterThan(5);
      const alvo = porSlot(inicial);
      let atual = { perfil: p, rotina: inicial };
      for (let volta = 1; volta <= 5; volta += 1) {
        atual = idaEVolta(atual.perfil, atual.rotina, f.opcoes as never);
        expect(porSlot(atual.rotina), `volta ${volta}: o plano derivou`).toEqual(alvo);
        expect(porPosicao(atual.rotina), `volta ${volta}: a ordem ou a composição mudou`).toEqual(porPosicao(inicial));
      }
    }, 60_000);
  }

  // ② Os números da hipertrofia não são aplicados fora dela.
  it('teto publicado é o do PRÓPRIO objetivo, e não existe teto por sessão fora da hipertrofia', () => {
    let medidos = 0;
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
      const daCasa = gerar(perfil({ objetivo: 'massa', nivelExperiencia: nivel } as never), { semanaCiclo: { semana: 3 } });
      for (const objetivo of OUTROS) {
        const r = gerar(perfil({ objetivo, nivelExperiencia: nivel } as never), { semanaCiclo: { semana: 3 } });
        const t = r.tetoVolumeSemana!;
        const faixa = faixaSemanal(nivel, objetivo);
        medidos += 1;
        expect(t.sessao, `${objetivo}/${nivel}: nasceu um teto por sessão fora da hipertrofia`).toBeNull();
        expect(t.cheio, `${objetivo}/${nivel}: teto cheio não é o topo da faixa do objetivo`).toBe(faixa.max);
        expect(t.semFoco, `${objetivo}/${nivel}: a margem de 3 da hipertrofia vazou`).toBe(faixa.max);
        expect(r.excecoesDeSessao ?? [], `${objetivo}/${nivel}: exceção de sessão sem teto de sessão`).toEqual([]);
        // ⚠️ ANTI-VACUIDADE: em `massa`, no MESMO nível, os três números são outros.
        const tm = daCasa.tetoVolumeSemana!;
        expect(tm.sessao, `${nivel}: massa perdeu o teto por sessão — a comparação degenerou`).toBe(TETO_PONDERADO_SESSAO);
        expect(tm.cheio, `${nivel}: massa não está usando a tabela da hipertrofia`).toBe(TETO_SEMANAL_HIPERTROFIA[nivel]);
        expect(tm.semFoco).toBe(TETO_SEMANAL_HIPERTROFIA[nivel] - MARGEM_SEM_FOCO);
      }
    }
    expect(medidos).toBe(6);
  }, 60_000);

  // ③ A frase da exceção do teto por sessão não aparece onde não há teto por sessão.
  it('nenhum plano fora da hipertrofia fala do limite de um treino só', () => {
    const falantes: string[] = [];
    let medidos = 0;
    for (const objetivo of OUTROS) for (const f of FASES_FORA) for (const nivel of ['intermediario', 'avancado'] as const) {
      const r = gerar(perfil({ objetivo, nivelExperiencia: nivel } as never), f.opcoes);
      medidos += 1;
      for (const a of r.avisos ?? []) {
        if (a.includes(MARCA_EXCECAO_SESSAO)) falantes.push(`${objetivo}/${nivel}/${f.nome}: ${a}`);
      }
    }
    expect(medidos).toBeGreaterThan(10);
    expect(falantes, 'a marca do teto por sessão vazou para um objetivo que não tem esse teto').toEqual([]);
  }, 60_000);

  // ④ O baseline não é cobrado para pagar o foco — a regra vale fora da hipertrofia também.
  it('o foco não tira série de terceiro, nos dois objetivos', () => {
    const cobrados: string[] = [];
    let medidos = 0;
    for (const objetivo of OUTROS) for (const nivel of ['intermediario', 'avancado'] as const) {
      const semFoco = gerar(perfil({ objetivo, nivelExperiencia: nivel } as never), { semanaCiclo: { semana: 3 } });
      const comFoco = gerar(perfil({ objetivo, nivelExperiencia: nivel, foco: { grupo: 'peito', compensa: 'ombros', semana: 3 } } as never), { semanaCiclo: { semana: 3 } });
      const antes = creditoPonderadoDaSemana(semFoco.dias.flatMap((d) => d.slots));
      const depois = creditoPonderadoDaSemana(comFoco.dias.flatMap((d) => d.slots));
      medidos += 1;
      for (const g of GRUPOS_GRANDES) {
        if (g === 'peito' || g === 'ombros') continue; // o par focado é quem pode mudar
        const a = antes.get(g) ?? 0;
        const d = depois.get(g) ?? 0;
        if (d < a) cobrados.push(`${objetivo}/${nivel}: ${g} ${a} → ${d}`);
      }
    }
    expect(medidos).toBe(4);
    expect(cobrados, 'um terceiro pagou pelo foco fora da hipertrofia').toEqual([]);
  }, 60_000);

  // ⑤ Reduzir uma escolha manual não levanta outro slot.
  it('baixar UMA série não levanta nenhuma outra, nos dois objetivos', () => {
    let casos = 0;
    for (const objetivo of OUTROS) for (const f of FASES_FORA) {
      const p = perfil({ objetivo } as never);
      const comDesenho = idaEVolta(p, gerar(p, f.opcoes), f.opcoes as never);
      const antes = porSlot(comDesenho.rotina);
      const custom = comDesenho.perfil.rotinaCustom as {
        dias: { diaId?: string; exercicioIds: string[]; seriesPorExercicio?: Record<string, number> }[];
      };
      const diaAlvo = custom.dias.find((d) => (d.exercicioIds ?? []).some((id) => (antes[`${d.diaId}/${id}`] ?? 0) > 1));
      if (!diaAlvo) continue;
      const idAlvo = diaAlvo.exercicioIds.find((id) => (antes[`${diaAlvo.diaId}/${id}`] ?? 0) > 1)!;
      const chaveAlvo = `${diaAlvo.diaId}/${idAlvo}`;
      const dias = custom.dias.map((d) => (d === diaAlvo
        ? { ...d, seriesPorExercicio: { ...(d.seriesPorExercicio ?? {}), [idAlvo]: (antes[chaveAlvo] ?? 0) - 1 } }
        : d));
      const r = gerar({ ...comDesenho.perfil, rotinaCustom: { ...custom, dias } } as PerfilResumo, f.opcoes);
      const depois = porSlot(r);
      casos += 1;
      expect(depois[chaveAlvo], `${objetivo}/${f.nome}: a redução pedida não foi entregue`).toBe((antes[chaveAlvo] ?? 0) - 1);
      for (const [chave, series] of Object.entries(antes)) {
        if (chave === chaveAlvo) continue;
        expect(`${chave}=${depois[chave]}`,
          `${objetivo}/${f.nome}: outro slot mudou junto com a redução`).toBe(`${chave}=${series}`);
      }
    }
    expect(casos, 'nenhuma redução exercida').toBeGreaterThan(4);
  }, 60_000);

  // ⑥ Deload e retomada: um corte só.
  it('a retomada supersede o mesociclo — a semana 6 não corta por cima dela', () => {
    let medidos = 0;
    for (const objetivo of [...OUTROS, 'massa'] as const) {
      const p = perfil({ objetivo } as never);
      const retomada = { semana: 1, fator: 0.5, volumeReferencia: 12 };
      const naS1 = gerar(p, { semanaCiclo: { semana: 1, retomada } });
      const naS6 = gerar(p, { semanaCiclo: { semana: 6, retomada } });
      medidos += 1;
      expect(naS1.faseVolume, `${objetivo}: a fase não é retomada`).toBe('retomada');
      expect(naS6.faseVolume, `${objetivo}: a semana 6 sequestrou a fase da retomada`).toBe('retomada');
      expect(porSlot(naS6), `${objetivo}: CORTE DUPLO — a semana 6 cortou por cima da retomada`)
        .toEqual(porSlot(naS1));
      // ⚠️ ANTI-VACUIDADE: sem retomada, a semana 6 CORTA mesmo — senão nada foi provado.
      const deloadPuro = gerar(p, { semanaCiclo: { semana: 6 } });
      const normal = gerar(p, { semanaCiclo: { semana: 5 } });
      const soma = (r: RotinaSemanal) => r.dias.flatMap((d) => d.slots).reduce((n, s) => n + (s.series ?? 0), 0);
      expect(soma(deloadPuro), `${objetivo}: a semana de alívio não reduziu nada`).toBeLessThan(soma(normal));
    }
    expect(medidos).toBe(3);
  }, 60_000);

  // ⑦ Tempo: o que o motor certifica continua certificado.
  it('nenhum dia passa do limite de tempo declarado, nos dois objetivos', () => {
    const estourados: string[] = [];
    let medidos = 0;
    /**
     * ⚠️ ANTI-VACUIDADE DUPLA. Contar só os dias ESTOURADOS deixaria o teste verde com
     * `duracaoDias` vazio ou com todos os dias em `NAO_AVALIADO` — e foi assim que a primeira
     * redação deste caso passou medindo `'ACIMA_DO_LIMITE'`, um valor que `EstadoLimite` não
     * tem: a comparação nunca casava e o teste era verde por construção (o typecheck a pegou).
     * Agora se exige que dias tenham sido de fato COMPARADOS ao limite.
     */
    let comparadosAoLimite = 0;
    for (const objetivo of OUTROS) for (const f of FASES_FORA) for (const tempo of [45, 60] as const) {
      const r = gerar(perfil({ objetivo, tempoPorSessaoMin: tempo, limiteTempoTreino: 'limitado' } as never), f.opcoes);
      medidos += 1;
      (r.duracaoDias ?? []).forEach((d, i) => {
        if (d.estadoLimite === 'DENTRO_DO_LIMITE' || d.estadoLimite === 'DENTRO_DA_TOLERANCIA') comparadosAoLimite += 1;
        if (d.estadoLimite === 'ACIMA_DO_LIMITE_OPERACIONAL') estourados.push(`${objetivo}/${f.nome}/${tempo}min dia${i}`);
      });
    }
    expect(medidos).toBeGreaterThan(10);
    expect(comparadosAoLimite, 'nenhum dia chegou a ser comparado ao limite — o caso é vazio').toBeGreaterThan(20);
    expect(estourados, 'um dia passou do tempo declarado').toEqual([]);
  }, 60_000);

  // ⑧ A repetição entre dias continua com identidade própria fora da hipertrofia.
  it('a mesma ocorrência repetida em dias distintos não colide na chave', () => {
    let repeticoes = 0;
    for (const objetivo of OUTROS) for (const f of FASES_FORA) {
      const r = gerar(perfil({ objetivo, nivelExperiencia: 'avancado', diasDisponiveis: 5,
        treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], tempoPorSessaoMin: 75 } as never), f.opcoes);
      const vistos = new Map<string, string[]>();
      for (const d of r.dias) for (const s of d.slots) {
        vistos.set(s.exercicio.id, [...(vistos.get(s.exercicio.id) ?? []), d.diaId!]);
      }
      for (const [, dias] of vistos) if (dias.length > 1) repeticoes += 1;
      expect(Object.keys(porSlot(r)).length, `${objetivo}/${f.nome}: a chave dia/id perdeu ocorrências`)
        .toBe(r.dias.reduce((n, d) => n + d.slots.length, 0));
    }
    expect(repeticoes, 'nenhuma repetição entre dias — a colisão não foi exercida').toBeGreaterThan(0);
  }, 60_000);
});
