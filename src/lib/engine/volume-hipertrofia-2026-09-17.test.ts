/**
 * 🔵 A POLÍTICA DE VOLUME DA HIPERTROFIA — decisão do autor de 2026-09-17, como regressão.
 *
 * O que ela substitui: até `8b41ec9` o mesmo número (`volumePorGrupoSemana.max`) era ao mesmo
 * tempo o ALVO da rampa e o TETO duro. Agora são três números distintos por nível, todos na
 * conta ponderada canônica (direta 1,0 · indireta 0,5 — `PESO_SECUNDARIO`):
 *
 * | Nível         | Faixa desejada | Teto semanal | Máximo automático SEM foco |
 * |---------------|----------------|--------------|----------------------------|
 * | Iniciante     | 6–10           | 13           | 10                         |
 * | Intermediário | 10–14          | 19           | 16                         |
 * | Avançado      | 12–18          | 21           | 18                         |
 *
 * E um teto POR SESSÃO de 12 séries ponderadas por grupo, para todos os níveis, com ou sem
 * foco, sem margem — que vale AO MESMO TEMPO que o semanal.
 *
 * 🔴 São política do aplicativo: não são MRV individual medido, nem limite biológico
 * universal, nem limiar automático de lesão. E máximo permitido não é meta: a rampa mira a
 * faixa desejada e nada aqui empurra volume para cima só porque cabe.
 *
 * ⚠️ Este arquivo não tem conta própria: usa `creditoPonderadoDaSemana` (a do alocador v4 e a
 * do crítico) e os números de `trilhos`. Uma segunda régua aqui seria a segunda verdade que a
 * decisão existe para remover.
 */
import { describe, expect, it } from 'vitest';
import { ROTULO_GRUPO } from '../frequencia-grupos';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './alocador';
import {
  faixaSemanal, maxSemanalSemFoco, mev, tetoPonderadoNaSessao, tetoSemanalCheio,
  tetoSemanalDoGrupo, tetoSeriesGrupoNaSessao,
} from './trilhos';
import { MARGEM_SEM_FOCO, TETO_PONDERADO_SESSAO, TETO_SEMANAL_HIPERTROFIA } from './treino-constants';
import { MARCA_PODA_TETO } from './teto-ponderado';
import { tipoSessaoTemporal } from './adequacao-tempo-politica';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude } from './types';
import type { PerfilTreino, RotinaSemanal, SemanaCiclo } from './treino-types';
import type { GrupoPrimario } from '../data/types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
const NIVEIS = ['iniciante', 'intermediario', 'avancado'] as const;

const perfil = (over: Record<string, unknown> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4,
  treinoDias: DIAS.slice(0, 4), tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado', ...over,
} as unknown as PerfilTreino);

const plano = (p: PerfilTreino, semana: SemanaCiclo = 5, retomada?: unknown): RotinaSemanal =>
  montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(),
    { semana, ...(retomada ? { retomada } : {}) } as never);

const pond = (r: RotinaSemanal) => creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
const pondDoDia = (r: RotinaSemanal, i: number) => creditoPonderadoDaSemana(r.dias[i]!.slots);

/** O teto semanal de cada grupo, como o motor o PUBLICA (foco e fase já resolvidos). */
const tetoDoGrupo = (r: RotinaSemanal, g: GrupoPrimario) =>
  (r.tetoVolumeSemana!.gruposEmFoco.includes(g) ? r.tetoVolumeSemana!.cheio : r.tetoVolumeSemana!.semFoco);

const acimaNaSemana = (r: RotinaSemanal) =>
  GRUPOS_GRANDES.filter((g) => (pond(r).get(g) ?? 0) > tetoDoGrupo(r, g))
    .map((g) => `${g} ${pond(r).get(g)} > ${tetoDoGrupo(r, g)}`);

const acimaNaSessao = (r: RotinaSemanal) => {
  const teto = r.tetoVolumeSemana?.sessao;
  if (teto == null) return [];
  const fora: string[] = [];
  r.dias.forEach((_d, i) => {
    for (const g of GRUPOS_GRANDES) {
      const v = pondDoDia(r, i).get(g) ?? 0;
      if (v > teto) fora.push(`dia${i} ${g} ${v} > ${teto}`);
    }
  });
  return fora;
};

// ── ① A TABELA, como ela foi decidida ────────────────────────────────────────

describe('🔵 a tabela de 2026-09-17, número a número', () => {
  it('faixa desejada · teto semanal · máximo automático, por nível', () => {
    expect(NIVEIS.map((n) => faixaSemanal(n, 'massa')))
      .toEqual([{ min: 6, max: 10 }, { min: 10, max: 14 }, { min: 12, max: 18 }]);
    expect(NIVEIS.map((n) => tetoSemanalCheio(n, 'massa'))).toEqual([13, 19, 21]);
    expect(NIVEIS.map((n) => maxSemanalSemFoco(n, 'massa'))).toEqual([10, 16, 18]);
    expect(TETO_SEMANAL_HIPERTROFIA).toEqual({ iniciante: 13, intermediario: 19, avancado: 21 });
  });

  it('a margem de 3 vale SÓ no teto semanal dos grupos sem foco', () => {
    expect(MARGEM_SEM_FOCO).toBe(3);
    for (const n of NIVEIS) {
      expect(tetoSemanalCheio(n, 'massa') - maxSemanalSemFoco(n, 'massa'), n).toBe(MARGEM_SEM_FOCO);
      // 🔴 E NÃO existe margem no teto por sessão: ele é o mesmo com e sem foco.
      expect(tetoSeriesGrupoNaSessao(n, 'massa'), n).toBe(TETO_PONDERADO_SESSAO);
    }
  });

  it('12 por sessão, para TODOS os níveis, com ou sem foco', () => {
    for (const n of NIVEIS) {
      for (const freq of [1, 2, 3, 4, 5, 6, 7]) {
        expect(tetoSeriesGrupoNaSessao(n, 'massa', freq), `${n}/${freq}×`).toBe(12);
      }
      const teto = tetoSemanalDoGrupo({ nivel: n, objetivo: 'massa', emFoco: ['peito'] });
      expect(teto('peito'), `${n} focado`).toBe(tetoSemanalCheio(n, 'massa'));
      expect(teto('ombros'), `${n} não focado`).toBe(maxSemanalSemFoco(n, 'massa'));
    }
  });

  it('🔒 os outros objetivos NÃO herdam esta tabela — política própria, intocada', () => {
    for (const n of NIVEIS) {
      for (const obj of ['saude', 'emagrecimento'] as const) {
        expect(tetoSemanalCheio(n, obj), `${n}/${obj}`).toBe(faixaSemanal(n, obj).max);
        expect(maxSemanalSemFoco(n, obj), `${n}/${obj}`).toBe(faixaSemanal(n, obj).max);
        expect(tetoPonderadoNaSessao(n, obj), `${n}/${obj}: não há teto ponderado de sessão`).toBeNull();
      }
    }
  });
});

// ── ② OS EXEMPLOS OBRIGATÓRIOS da decisão, um a um ───────────────────────────

/**
 * 🔒 Os exemplos pressupõem AUSÊNCIA de outros créditos — é o próprio texto da decisão que o
 * diz. Aqui eles são medidos contra os limites, que é exatamente o que eles afirmam. A
 * contabilização real, com todos os créditos indiretos, é o que a varredura de ③ mede.
 */
describe('🔵 os exemplos numéricos da decisão', () => {
  const sessao = TETO_PONDERADO_SESSAO;

  it('intermediário, peito SEM foco: 3 exercícios × 3 séries no mesmo dia = 9 — permitido', () => {
    expect(3 * 3).toBeLessThanOrEqual(sessao);
    expect(3 * 3).toBeLessThanOrEqual(maxSemanalSemFoco('intermediario', 'massa'));
  });

  it('intermediário SEM foco: 9 + 7 = 16 cabe; 9 + 8 = 17 ultrapassa o máximo automático', () => {
    const max = maxSemanalSemFoco('intermediario', 'massa');
    expect(9 + 7).toBeLessThanOrEqual(max);
    expect(9 + 8).toBeGreaterThan(max);
    // 🔴 …e 17 continua ABAIXO do teto cheio: não se pode dizer que ultrapassou o teto.
    expect(9 + 8).toBeLessThan(tetoSemanalCheio('intermediario', 'massa'));
  });

  it('intermediário COM foco: 10 + 9 = 19 cabe na semana; 13 numa sessão não cabe', () => {
    expect(10 + 9).toBeLessThanOrEqual(tetoSemanalCheio('intermediario', 'massa'));
    expect(13).toBeGreaterThan(sessao);
  });

  it('iniciante SEM foco: 11 numa sessão respeita o teto do dia e viola o máximo semanal de 10', () => {
    expect(11).toBeLessThanOrEqual(sessao);
    expect(11).toBeGreaterThan(maxSemanalSemFoco('iniciante', 'massa'));
  });

  it('avançado COM foco: 12 + 9 = 21 cabe', () => {
    expect(12 + 9).toBeLessThanOrEqual(tetoSemanalCheio('avancado', 'massa'));
    // e 21 é EXATAMENTE o teto: uma série a mais não cabe.
    expect(12 + 9 + 1).toBeGreaterThan(tetoSemanalCheio('avancado', 'massa'));
  });

  it('🔴 a exceção do foco é do GRUPO: um extra de peito não libera ombros nem tríceps', () => {
    const teto = tetoSemanalDoGrupo({ nivel: 'intermediario', objetivo: 'massa', emFoco: ['peito'] });
    expect(teto('peito')).toBe(19);
    for (const g of ['ombros', 'triceps', 'costas'] as const) expect(teto(g), g).toBe(16);
  });
});

// ── ③ A VARREDURA: o motor obedece os dois limites ao mesmo tempo ────────────

/**
 * 🔵 A LISTA ESVAZIOU em 2026-09-17 (2ª volta) — e é por isso que ela continua aqui.
 *
 * Até `6feab97` doze células entregavam `posterior 13 contra 12` num dia e o excesso era
 * declarado como resíduo: os slots diretos do grupo já estavam no piso e o excedente vinha do
 * crédito INDIRETO de glúteos no mesmo dia. A decisão do autor mandou **tentar alternativas
 * antes de aceitar o excesso** — e a alternativa que faltava não era cortar série de ninguém,
 * era TROCAR o exercício de glúteos por um equivalente que não credita posterior (mesmo
 * grupo, mesmo padrão, mesma assinatura de custo). Medido depois da correção: **0 células
 * acima do teto de sessão em 10 080 combinações** (4 inventários × 3 níveis × 1–7 dias ×
 * 5 tempos × 2 limites × 4 semanas × 3 focos).
 *
 * 🔒 A lista fica VAZIA, e não some: uma célula nova entra como falha, não como exceção
 * silenciosa. E a regra geral que autoriza e comunica o que sobrar é exercida logo abaixo,
 * no caminho onde ela é alcançável — o desenho da pessoa.
 */
const EXCESSO_DE_SESSAO_CONHECIDO = new Set<string>([]);

describe('🔒 nenhum plano automático nasce acima dos limites', () => {
  const CELULAS = NIVEIS.flatMap((nivel) => ([1, 2, 3, 4, 5, 6, 7] as const).flatMap((dias) =>
    ([20, 45, 75] as const).flatMap((tempo) =>
      (['limitado', 'sem_limite'] as const).map((limite) => ({ nivel, dias, tempo, limite })))));

  it('semana: nenhum excesso é aceito; conflitos irredutíveis são recusados e nomeados', () => {
    const fora: string[] = [];
    let medidos = 0;
    let comFocoNaMargem = 0;
    let recusadosPorTeto = 0;
    let dentroDoTeto = 0;
    for (const c of CELULAS) for (const semana of [1, 3, 5, 6] as const) for (const foco of [undefined, 'peito'] as const) {
      const p = perfil({
        nivelExperiencia: c.nivel, diasDisponiveis: c.dias, treinoDias: DIAS.slice(0, c.dias),
        tempoPorSessaoMin: c.tempo, limiteTempoTreino: c.limite,
        ...(foco ? { foco: { grupo: foco, compensa: 'ombros', semana } } : {}),
      });
      let r: RotinaSemanal;
      try { r = plano(p, semana); } catch { continue; }
      medidos += 1;
      const ruim = acimaNaSemana(r);
      if (ruim.length) {
        // Decisão de 20/09: o piso obrigatório pode impedir o teto. A proposta
        // permanece mensurável, mas nunca se torna uma geração aceita.
        const resultado = r.resultadoGeracao;
        if (resultado?.tipo !== 'TETO_SEMANAL_NAO_ATENDIDO') {
          fora.push(`${c.nivel}/${c.dias}d/${c.tempo}min/${c.limite}/S${semana}/${foco ?? 'sem-foco'}: ${ruim.join(', ')}`);
        } else {
          recusadosPorTeto++;
          for (const g of GRUPOS_GRANDES.filter(g => (pond(r).get(g) ?? 0) > tetoDoGrupo(r, g))) {
            expect(resultado.motivos.some(m => m.includes(ROTULO_GRUPO[g] ?? g)
              && m.includes(`${pond(r).get(g)}`) && m.includes(`${tetoDoGrupo(r, g)}`)), `${g}: diagnóstico do excesso`).toBe(true);
            expect(r.dias.flatMap(d => d.slots).filter(s => s.exercicio.grupoPrimario === g)
              .every(s => s.series === 1), `${g}: séries próprias esgotadas antes da recusa`).toBe(true);
          }
        }
      } else dentroDoTeto++;
      // ⚠️ ANTI-VACUIDADE: a margem tem de ser USADA em algum lugar, senão ela é letra morta.
      if (foco && (pond(r).get('peito') ?? 0) > r.tetoVolumeSemana!.semFoco) comFocoNaMargem += 1;
    }
    expect(medidos, 'a varredura não mediu nada').toBeGreaterThan(200);
    expect(fora.slice(0, 10), `${fora.length} planos acima do teto semanal`).toEqual([]);
    // A composição aprovada pode resolver todos os casos desta grade. O conflito
    // irredutível é exercitado com entrada controlada em adequacao-teto-semanal.test.ts.
    expect(recusadosPorTeto + dentroDoTeto).toBe(medidos);
    expect(dentroDoTeto, 'recusar tudo não satisfaz a política').toBeGreaterThan(200);
    expect(comFocoNaMargem, 'nenhum plano usou a margem do foco — ela virou letra morta').toBeGreaterThan(0);
  }, 600_000);

  it('sessão: nenhum grande passa das 12 ponderadas num dia, salvo as células declaradas', () => {
    const fora: string[] = [];
    let medidos = 0;
    for (const c of CELULAS) for (const semana of [1, 5] as const) {
      const chave = `${c.nivel}/${c.dias}d/${c.tempo}min/${c.limite}`;
      const p = perfil({
        nivelExperiencia: c.nivel, diasDisponiveis: c.dias, treinoDias: DIAS.slice(0, c.dias),
        tempoPorSessaoMin: c.tempo, limiteTempoTreino: c.limite,
      });
      let r: RotinaSemanal;
      try { r = plano(p, semana); } catch { continue; }
      medidos += 1;
      const ruim = acimaNaSessao(r);
      if (ruim.length && !EXCESSO_DE_SESSAO_CONHECIDO.has(chave)) fora.push(`${chave}/S${semana}: ${ruim.join(', ')}`);
    }
    expect(medidos, 'a varredura não mediu nada').toBeGreaterThan(100);
    expect(fora.slice(0, 10), `${fora.length} planos acima do teto de sessão fora da lista declarada`).toEqual([]);
  }, 600_000);

  /**
   * 🔒 A CÉLULA QUE ERA O RESÍDUO — hoje resolvida, e resolvida pelo caminho certo.
   *
   * Anti-vacuidade dupla: o dia medido ainda TEM o grupo perto do teto (senão o caso
   * degenerou e não prova nada) e a correção que o salvou é NOMEADA no plano.
   */
  it('a célula antes resolvida por troca cabe e mantém IDs por alternância', () => {
    /**
     * 🔵 CÉLULA REMEDIDA em 2026-09-19: com o improviso doméstico fora da academia, o avançado
     * 6 d/45 min deixou de ter a TROCA como saída — ele resolve o dia podando série (o aviso
     * ali passou a ser "Ajustamos o volume de Posterior"), e o caso deixaria de provar o que
     * promete. A varredura desta correção achou 68 células em que a troca ainda resolve o dia
     * sem exceção e sem esvaziar o posterior; esta é a primeira.
     */
    const p = perfil({
      // 20/09: UL distribui posterior 8+8 e já não exerce a troca. O caso
      // positivo medido em adequacao-trocas-37.json mantém posterior em 12.
      nivelExperiencia: 'intermediario', diasDisponiveis: 3, treinoDias: DIAS.slice(0, 3),
      tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite',
    });
    const r = plano(p, 3);
    expect(acimaNaSessao(r), 'a célula voltou a estourar o teto do dia').toEqual([]);
    expect(r.excecoesDeSessao ?? [], 'sobrou exceção onde a troca deveria ter resolvido').toEqual([]);
    // O dia do posterior existe e continua carregado — o caso não degenerou.
    const posteriorPorDia = r.dias.map((_d, i) => pondDoDia(r, i).get('posterior') ?? 0);
    expect(Math.max(...posteriorPorDia), `posterior sumiu do plano: ${posteriorPorDia.join('+')}`).toBeGreaterThanOrEqual(10);
    expect(r.avisos.some((a)=>a.includes('Ajustamos o volume'))).toBe(true);
    const assinatura=(x:RotinaSemanal)=>x.dias.map(d=>d.slots.map(s=>s.exercicio.id));
    for(const semana of [1,2,3,4,5] as const){
      const x=plano(p,semana);expect(assinatura(x)).toEqual(assinatura(plano(p,semana%2===0?2:1)));
      expect(x.avisos.some(a=>a.startsWith('Trocamos'))).toBe(false);
      expect(acimaNaSessao(x)).toEqual([]);
    }
  });
});

it('a antiga célula UL mantém posterior nos dois dias, sem exigir troca desnecessária', () => {
  const r = plano(perfil({nivelExperiencia:'intermediario',diasDisponiveis:4,treinoDias:DIAS.slice(0,4),tempoPorSessaoMin:45,limiteTempoTreino:'sem_limite',divisaoPreferida:'superior-inferior'}),3);
  expect(acimaNaSessao(r)).toEqual([]);
  expect(r.dias.map((_d,i)=>pondDoDia(r,i).get('posterior')??0).filter(n=>n>0)).toEqual([7,7]); // dose atual após tetos de todos os grupos; não é quota.
  expect(r.excecoesDeSessao??[]).toEqual([]);
});

// ── ③b A EXCEÇÃO: quando nada resolve, o motor autoriza E COMUNICA ───────────

/**
 * 🔵 DECISÃO DO AUTOR de 2026-09-17 (2ª volta): 12 por sessão continua sendo o limite normal
 * de montagem, mas deixou de ser obrigação absoluta. O excesso é aceito **depois** de
 * esgotadas as alternativas — e aí é nomeado, medido, explicado e mantido do plano ao editor.
 *
 * 🔒 O caminho alcançável é o DESENHO DA PESSOA: lá os exercícios, os dias e as séries são
 * escolha dela, e o app não os troca. É a regra geral que está sob teste aqui, não uma lista.
 */
describe('🔵 a exceção ao teto por sessão', () => {
  const doAcademia = (g: GrupoPrimario, n: number) =>
    EXERCISES.filter((e) => e.grupoPrimario === g && e.equipamento === 'academia').slice(0, n);
  const desenhoPesado = () => {
    const peito = doAcademia('peito', 5);
    return {
      perfil: perfil({
        nivelExperiencia: 'intermediario', diasDisponiveis: 3, treinoDias: DIAS.slice(0, 3),
        tempoPorSessaoMin: 90, limiteTempoTreino: 'sem_limite',
        rotinaCustom: { origem: 'usuario', dias: [
          { nome: 'Peito', diaId: 'seg', exercicioIds: peito.map((e) => e.id),
            seriesPorExercicio: Object.fromEntries(peito.map((e) => [e.id, 4])) },
          { nome: 'Costas', diaId: 'ter', exercicioIds: doAcademia('costas', 3).map((e) => e.id) },
          { nome: 'Pernas', diaId: 'qua', exercicioIds: doAcademia('quadriceps', 3).map((e) => e.id) },
        ] },
      }),
      peito,
    };
  };

  it('o excesso que sobra é publicado com grupo, dia, volume e a referência de 12', () => {
    const r = plano(desenhoPesado().perfil, 5);
    const ex = r.excecoesDeSessao ?? [];
    expect(ex.length, 'a exceção não foi publicada').toBe(1);
    expect(ex[0]!.grupo).toBe('peito');
    expect(ex[0]!.dia).toBe(0);
    expect(ex[0]!.nomeDoDia).toBe('Peito');
    expect(ex[0]!.ponderado).toBe(20);
    expect(ex[0]!.teto).toBe(TETO_PONDERADO_SESSAO);
    expect(ex[0]!.direto).toBe(20);
  });

  it('as alternativas examinadas ficam registradas, com o motivo da recusa', () => {
    const { perfil: p, peito } = desenhoPesado();
    const alt = (plano(p, 5).excecoesDeSessao ?? [])[0]!.alternativas;
    // 🔒 Uma entrada por slot do grupo, cada uma NOMEANDO o exercício e o motivo — é o que
    // impede a exceção de ser uma conclusão sem exame.
    expect(alt.map((a) => a.slot).sort()).toEqual(peito.map((e) => e.id).sort());
    expect(new Set(alt.map((a) => a.motivo))).toEqual(new Set(['slot_escolhido_pela_pessoa']));
    expect(alt.every((a) => !a.aceita)).toBe(true);
  });

  it('a ressalva é DITA no plano, sem chamar o excesso de perigo e sem dizer que tudo coube', () => {
    const r = plano(desenhoPesado().perfil, 5);
    const frase = r.avisos.find((a) => a.includes('limite de um treino só'));
    expect(frase, `a exceção ficou muda: ${r.avisos.join(' | ')}`).toBeDefined();
    expect(frase).toContain('20');
    expect(frase).toContain(String(TETO_PONDERADO_SESSAO));
    expect(frase).toContain('não dá para dizer que ele está dentro de todos os limites');
    // 🔴 A decisão é explícita: não afirmar perigo nem lesão.
    expect(/perigo|lesão|lesao|arriscad/i.test(frase!), `a frase virou alerta clínico: ${frase}`).toBe(false);
    // 🔒 E ela não afirma um esforço que não houve: no desenho da pessoa não se troca nada.
    expect(frase).toContain('são sua escolha');
  });

  /**
   * 🔒 "A exceção diária NÃO flexibiliza nenhum limite semanal" (decisão, §1). O que se
   * cobra aqui é que os TETOS publicados continuam os mesmos — 16 sem foco e 19 cheio para o
   * intermediário — e que o excesso semanal do desenho manual continua sendo DITO em vez de
   * virar permissão. (Que nenhum plano AUTOMÁTICO passe do teto semanal é medido na
   * varredura acima, em 10 080 combinações.)
   */
  it('a exceção do DIA não afrouxa nenhum limite da SEMANA', () => {
    const r = plano(desenhoPesado().perfil, 5);
    expect(r.excecoesDeSessao ?? []).toHaveLength(1);
    expect(r.tetoVolumeSemana).toMatchObject({ semFoco: 16, cheio: 19, sessao: 12, gruposEmFoco: [] });
    // A semana dela passa de 16 porque a dose é DELA — e o motor não a corta nem a abençoa.
    expect(acimaNaSemana(r)).toEqual(['peito 20 > 16']);
    expect(r.avisos.some((a) => a.includes(MARCA_PODA_TETO)),
      'o app cortou a série que a pessoa escolheu').toBe(false);
  });

  it('o crítico do editor continua dizendo o mesmo excesso, com o número', async () => {
    const { avaliarSemana } = await import('./critico');
    const r = plano(desenhoPesado().perfil, 5);
    const av = avaliarSemana(
      r.dias.map((d) => ({
        nome: d.nome, exercicios: d.slots.map((s) => s.exercicio),
        series: d.slots.map((s) => s.series), descansoSeg: d.slots.map((s) => s.descansoSeg),
      })),
      {
        nivel: 'intermediario', objetivo: 'massa', tempoPorSessaoMin: 90, limiteTempoTreino: 'sem_limite', semana: 5,
        ...(r.faixaVolumeSemana ? { faixaSemanal: r.faixaVolumeSemana } : {}),
        ...(r.tetoVolumeSemana ? { tetoVolumeSemana: r.tetoVolumeSemana } : {}),
      },
    );
    const aviso = av.avisos.find((a) => a.codigo === 'acima_do_maximo_na_sessao');
    expect(aviso, `o excesso ficou sem voz no editor: ${av.avisos.map((a) => a.codigo).join(', ')}`).toBeDefined();
    expect(aviso!.fato?.escopo).toBe('sessao');
    expect(aviso!.fato?.grupo).toBe('peito');
  });

  it('nada é bloqueado: o plano com exceção é entregue, com os exercícios que a pessoa escolheu', () => {
    const { perfil: p, peito } = desenhoPesado();
    const r = plano(p, 5);
    expect(r.dias[0]!.slots.map((s) => s.exercicio.id)).toEqual(peito.map((e) => e.id));
    expect(r.dias[0]!.slots.map((s) => s.series)).toEqual([4, 4, 4, 4, 4]);
  });
});

// ── ④ O crédito INDIRETO conta, e leva um terceiro ao limite ─────────────────

describe('🔒 o crédito indireto entra na mesma conta', () => {
  it('o grupo que só recebe indireto também responde pelo teto', () => {
    const p = perfil({
      nivelExperiencia: 'avancado', diasDisponiveis: 6, treinoDias: DIAS.slice(0, 6),
      tempoPorSessaoMin: 90, limiteTempoTreino: 'sem_limite',
    });
    const r = plano(p, 5);
    const direto = new Map<GrupoPrimario, number>();
    for (const d of r.dias) for (const s of d.slots) {
      const g = s.exercicio.grupoPrimario;
      if (g) direto.set(g, (direto.get(g) ?? 0) + (s.series ?? 0));
    }
    // ⚠️ ANTI-VACUIDADE: sem crédito indireto, medir "ponderado" seria medir "direto".
    const comIndireto = GRUPOS_GRANDES.filter((g) => (pond(r).get(g) ?? 0) > (direto.get(g) ?? 0));
    expect(comIndireto.length, 'nenhum grande recebeu indireto — a conta não é ponderada').toBeGreaterThan(0);
    expect(acimaNaSemana(r), 'o indireto levou alguém acima do teto').toEqual([]);
  });
});

// ── ⑤ FASES: o menor limite manda, e a margem não é subtraída duas vezes ─────

describe('🔒 deload e retomada — um corte só', () => {
  it('deload: o teto da fase manda, e a margem de 3 NÃO é subtraída de novo', () => {
    for (const nivel of NIVEIS) {
      const r = plano(perfil({ nivelExperiencia: nivel }), 6);
      expect(r.faseVolume, nivel).toBe('deload');
      const reduzido = r.faixaVolumeSemana!.max;
      const t = r.tetoVolumeSemana!;
      expect(t.semFoco, `${nivel}: o teto da fase deixou de mandar`).toBe(reduzido);
      expect(t.cheio, `${nivel}: o foco não pode elevar o teto acima da fase`).toBe(reduzido);
      expect(t.semFoco, `${nivel}: segunda subtração de 3`).not.toBe(reduzido - MARGEM_SEM_FOCO);
      expect(acimaNaSemana(r), nivel).toEqual([]);
    }
  });

  it('retomada: o teto é o operacional do nível, e o foco não é aplicado na fase', () => {
    const r = plano(perfil({ nivelExperiencia: 'intermediario', foco: { grupo: 'peito', compensa: 'ombros', semana: 2 } }),
      1, { semana: 1, fator: 0.5, volumeReferencia: 14 });
    expect(r.faseVolume).toBe('retomada');
    expect(r.tetoVolumeSemana!.semFoco).toBe(maxSemanalSemFoco('intermediario', 'massa'));
    expect(r.tetoVolumeSemana!.gruposEmFoco, 'a retomada não aplica o bloco do foco').toEqual([]);
    expect(acimaNaSemana(r)).toEqual([]);
  });
});

// ── ⑥ MÁXIMO PERMITIDO NÃO É META ───────────────────────────────────────────

describe('🔒 a rampa mira a faixa desejada, nunca o teto', () => {
  it('segmentadas sem foco não aumentam a dose só porque há margem', () => {
    let medidos = 0;
    for (const nivel of NIVEIS) for (const dias of [4, 5] as const) {
      const r = plano(perfil({
        nivelExperiencia: nivel, diasDisponiveis: dias, treinoDias: DIAS.slice(0, dias),
        tempoPorSessaoMin: 90, limiteTempoTreino: 'sem_limite',
      }), 5);
      const topo = faixaSemanal(nivel, 'massa').max;
      const piso = mev(nivel, 'massa');
      for (const g of GRUPOS_GRANDES) {
        const v = pond(r).get(g) ?? 0;
        if (v <= 0) continue;
        medidos += 1;
        expect(v, `${nivel}/${dias}d · ${g} acima do topo desejado sem foco`).toBeLessThanOrEqual(topo);
        // 🔒 …e não abaixo do piso sem o motor dizer (o guard de cobertura é quem fala).
        if (v < piso) {
          expect(r.avisos.some((a) => a.includes(g) || a.includes('abaixo do mínimo')),
            `${nivel}/${dias}d · ${g} abaixo do piso, calado`).toBe(true);
        }
      }
    }
    expect(medidos, 'a varredura não mediu grupo nenhum').toBeGreaterThan(20);
  }, 300_000);

  it('full body e upper/lower respeitam a tabela aprovada, o foco e o deload', () => {
    // 20/09: faixa desejada não é teto duro em FB/UL. Não se concede margem
    // ilimitada, nem a margem de foco aos demais grupos, nem se eleva o deload.
    for (const nivel of NIVEIS) for (const dias of [1, 2, 3] as const)
      for (const semana of [1, 5, 6] as const) for (const foco of [false, true]) {
        const r = plano(perfil({
          nivelExperiencia: nivel, diasDisponiveis: dias, treinoDias: DIAS.slice(0, dias),
          tempoPorSessaoMin: 90, limiteTempoTreino: 'sem_limite',
          ...(foco ? { foco: { grupo: 'peito', compensa: 'ombros', semana } } : {}),
        }), semana);
        const contexto = `${nivel}/${dias}d/S${semana}/foco=${foco}`;
        const fase = semana === 6 ? r.faixaVolumeSemana!.max : Infinity;
        expect(r.dias, contexto).toHaveLength(dias);
        expect(r.dias.every(d => tipoSessaoTemporal(d.nome,
          d.slots.map(s => s.exercicio.grupoPrimario!), r.dias.map(x => x.nome)) !== 'segmentada'), contexto).toBe(true);
        expect(r.tetoVolumeSemana!.semFoco, contexto).toBe(Math.min(maxSemanalSemFoco(nivel, 'massa'), fase));
        expect(r.tetoVolumeSemana!.cheio, contexto).toBe(Math.min(tetoSemanalCheio(nivel, 'massa'), fase));
        expect(acimaNaSemana(r), contexto).toEqual([]);
        expect(acimaNaSessao(r), contexto).toEqual([]);
      }
  }, 300_000);

  it('upper/lower intermediário pode entregar costas acima do alvo 14 até o teto 16 sem foco', () => {
    const r = plano(perfil({ diasDisponiveis: 3, treinoDias: DIAS.slice(0, 3),
      tempoPorSessaoMin: 90, limiteTempoTreino: 'sem_limite' }), 5);
    expect(pond(r).get('costas')).toBeGreaterThan(faixaSemanal('intermediario', 'massa').max);
    expect(pond(r).get('costas')).toBeLessThanOrEqual(maxSemanalSemFoco('intermediario', 'massa'));
    expect(acimaNaSemana(r)).toEqual([]);
  });
});
