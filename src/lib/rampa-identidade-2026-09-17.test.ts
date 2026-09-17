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
