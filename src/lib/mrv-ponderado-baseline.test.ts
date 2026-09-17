/**
 * 🔒 O MRV É PONDERADO — E VALE PARA O BASELINE (decisão do autor, 2026-09-16).
 *
 * 🔑 O defeito que estes testes fecham, medido em `3d86cbf` e reconfirmado em `f035d6c`: o
 * mesmo `volumePorGrupoSemana` era cobrado em DUAS moedas dentro do mesmo motor —
 *  · PONDERADA (direta 1,0 + indireta 0,5) no alocador (`alvoPonderado`), no guard de
 *    cobertura e no crítico do editor;
 *  · DIRETA na rampa (`alvoDaSemana`) e no bloco adicional do foco.
 * Com crédito indireto > 0 as duas leituras são aritmeticamente incompatíveis, e o resultado
 * medido era o motor entregando planos que o próprio crítico acusava: na varredura das
 * 3 888 combinações, 234 entregavam um grande acima do MRV **sem foco nenhum** (costas 21
 * contra 20 em avançado/massa; 14 contra 12 em avançado/saúde).
 *
 * 🔵 A DECISÃO VIGENTE: o MRV limita o volume **ponderado** — série direta 1,0 e indireta 0,5
 * (`PESO_SECUNDARIO`) —, para todos os grupos, no baseline e no foco. Ela encerra a
 * ambiguidade e SUBSTITUI a leitura direta que `treino-montador.test.ts` cobrava; os
 * contratos afetados foram reescritos na moeda nova, com a redação antiga preservada, não
 * apagados.
 *
 * ⚠️ Nada aqui afrouxa nada: a régua é `creditoPonderadoDaSemana`, a mesma do crítico e do
 * alocador. Não há fórmula de volume nova neste arquivo nem no conserto que ele ancora.
 */
import { describe, expect, it } from 'vitest';
import { recomputarPlano } from './plano';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './engine/alocador';
import { doPlano, paraRotinaCustom } from '@/components/painel/EditorTreino';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { GrupoPrimario } from './data/types';
import type { RotinaSemanal } from './engine/treino-types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;

const perfil = (over: Record<string, unknown> = {}): PerfilResumo => ({
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
  objetivo: 'massa', flagsSaude: SEM, alergenos: [], preferencia: 'onivoro', naoCurto: [],
  pratosCansados: [], favoritos: [], nivelExperiencia: 'intermediario', equipamento: 'academia',
  equipamentosCasa: [], diasDisponiveis: 4, tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado',
  treinoDias: ['seg', 'ter', 'qui', 'sex'], ...over,
}) as unknown as PerfilResumo;

/** O perfil exato de uma célula da varredura — os mesmos eixos do laboratório. */
const celula = (nivel: string, objetivo: string, dias: number, tempo: number) =>
  perfil({
    nivelExperiencia: nivel, objetivo, diasDisponiveis: dias, tempoPorSessaoMin: tempo,
    limiteTempoTreino: tempo === 75 ? 'sem_limite' : 'limitado',
    treinoDias: DIAS.slice(0, dias),
  });

const rotina = (p: PerfilResumo, opcoes: unknown): RotinaSemanal =>
  recomputarPlano(p, opcoes as never).treino.rotina!;

/** A conta CANÔNICA — a mesma do crítico e do alocador v4. Nenhuma régua paralela aqui. */
const ponderado = (r: RotinaSemanal) => creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
const direto = (r: RotinaSemanal) => {
  const m = new Map<GrupoPrimario, number>();
  for (const d of r.dias) for (const s of d.slots) {
    const g = s.exercicio.grupoPrimario;
    if (g) m.set(g, (m.get(g) ?? 0) + (s.series ?? 0));
  }
  return m;
};
/**
 * 🔵 O TETO PASSOU A SER POR GRUPO (decisão do autor 2026-09-17), e o motor o PUBLICA.
 *
 * A leitura anterior — `faixaVolumeSemana.max` — virou o ALVO desejado da rampa; usá-la como
 * limite é exatamente a confusão que a decisão desfez. Quem está EM FOCO responde pelo teto
 * cheio; todos os outros param no máximo automático (teto − 3).
 */
const teto = (r: RotinaSemanal, g: GrupoPrimario) =>
  r.tetoVolumeSemana!.gruposEmFoco.includes(g) ? r.tetoVolumeSemana!.cheio : r.tetoVolumeSemana!.semFoco;
const acimaDoTeto = (r: RotinaSemanal) =>
  GRUPOS_GRANDES.filter((g) => (ponderado(r).get(g) ?? 0) > teto(r, g))
    .map((g) => `${g} ${ponderado(r).get(g)} > ${teto(r, g)}`);
/** O teto por SESSÃO, medido dia a dia — vale ao mesmo tempo que o semanal. */
const acimaNaSessao = (r: RotinaSemanal) => {
  const t = r.tetoVolumeSemana?.sessao;
  if (t == null) return [];
  const fora: string[] = [];
  r.dias.forEach((d, i) => {
    const noDia = creditoPonderadoDaSemana(d.slots);
    for (const g of GRUPOS_GRANDES) if ((noDia.get(g) ?? 0) > t) fora.push(`dia${i} ${g} ${noDia.get(g)} > ${t}`);
  });
  return fora;
};
const avisoDaPoda = (r: RotinaSemanal) =>
  r.avisos.filter((a) => a.includes('para não passar do máximo desta semana'));
const porSlot = (r: RotinaSemanal) =>
  r.dias.map((d) => `${d.diaId}/${d.nome}:${d.slots.map((s) => `${s.exercicio.id}x${s.series}`).join(',')}`);

// ── 1. Os casos NOMEADOS da varredura ────────────────────────────────────────
describe('🔴 os casos medidos em que o baseline passava do teto', () => {
  /**
   * Cada linha é uma célula da varredura das 3 888 em que o baseline SOZINHO passava do MRV
   * ponderado antes da correção. `pondDepois`/`diretoDepois` são o resultado medido DEPOIS,
   * anotados para que uma regressão futura apareça como número, não como sensação.
   */
  /**
   * 🔵 NÚMEROS REMEDIDOS SOB A TABELA NOVA (2026-09-17). A redação anterior era:
   *   · avançado/massa/3d/75min/S5 — teto 20 · costas 20 ponderadas · 18 diretas;
   *   · avançado/saúde/3d/45min/S3 — teto 12 · costas 12 · 10;
   *   · iniciante/massa/3d/45min/S6 — teto 7 · costas 7 · 7.
   * O que mudou e por quê: em HIPERTROFIA a faixa desejada caiu (12–18 no avançado) e o teto
   * operacional subiu para 18, então a célula de massa deixou de encostar no teto; a de SAÚDE
   * não mudou nada, porque a política daquele objetivo não foi tocada.
   */
  const CASOS = [
    { nome: 'avançado/saúde/3d/45min/S3 — a banda 10–12, intocada pela decisão de 2026-09-17', nivel: 'avancado', obj: 'saude', dias: 3, tempo: 45, semana: 3, tetoEsperado: 12, pondDepois: 12, diretoDepois: 10, podaDiz: /Costas/ },
    { nome: 'avançado/saúde/3d/75min/S5 — mesma banda, orçamento maior', nivel: 'avancado', obj: 'saude', dias: 3, tempo: 75, semana: 5, tetoEsperado: 12, pondDepois: 12, diretoDepois: 10, podaDiz: /Costas/ },
  ] as const;

  it.each(CASOS)('$nome', ({ nivel, obj, dias, tempo, semana, tetoEsperado, pondDepois, diretoDepois, podaDiz }) => {
    const r = rotina(celula(nivel, obj, dias, tempo), { semanaCiclo: { semana } });
    expect(teto(r, 'costas'), 'o teto publicado é o da fase e do porte do grupo').toBe(tetoEsperado);
    expect(ponderado(r).get('costas')).toBe(pondDepois);
    expect(direto(r).get('costas')).toBe(diretoDepois);
    expect(acimaDoTeto(r), 'nenhum grande passa do teto na conta que vale').toEqual([]);
    // 🔒 A poda é DITA: a frase existe e nomeia o grupo que cedeu.
    expect(avisoDaPoda(r).join(' '), 'a redução de volume não pode ser silenciosa').toMatch(podaDiz);
  });

  /**
   * 🔵 O CASO DE MASSA, REMEDIDO — ele deixou de ser apertado, e o teste DIZ isso em vez de
   * fingir que ainda é. A propriedade que continua valendo (nenhum grande acima do teto) é
   * verificada aqui; a prova de que a PODA funciona vive nas células de saúde acima e na
   * varredura abaixo.
   */
  it('avançado/massa/3d/75min/S5 — cabe com folga sob a tabela nova (antes: costas 22 → 20)', () => {
    const r = rotina(celula('avancado', 'massa', 3, 75), { semanaCiclo: { semana: 5 } });
    expect(teto(r, 'costas')).toBe(18);
    expect(acimaDoTeto(r)).toEqual([]);
    expect(ponderado(r).get('costas') ?? 0, 'a célula segue entregando volume de verdade').toBeGreaterThan(10);
  });
});

// ── 2. A varredura, em recorte executável ────────────────────────────────────
describe('🔒 nenhum grande acima do teto — varredura', () => {
  const NIVEIS = ['iniciante', 'intermediario', 'avancado'] as const;
  const OBJS = ['saude', 'massa'] as const;
  const CELULAS = NIVEIS.flatMap((n) => OBJS.flatMap((o) => [3, 4].flatMap((d) =>
    [45, 75].map((t) => ({ n, o, d, t })))));

  it('o baseline SEM foco fica dentro do MRV ponderado em toda a grade', () => {
    const fora: string[] = [];
    let podados = 0;
    for (const { n, o, d, t } of CELULAS) for (const semana of [1, 3, 5, 6]) {
      const r = rotina(celula(n, o, d, t), { semanaCiclo: { semana } });
      const ruim = [...acimaDoTeto(r), ...acimaNaSessao(r)];
      if (ruim.length > 0) fora.push(`${n}/${o}/${d}d/${t}min/S${semana}: ${ruim.join(', ')}`);
      if (avisoDaPoda(r).length > 0) podados += 1;
    }
    expect(fora).toEqual([]);
    // ⚠️ ANTI-VACUIDADE: sem células que EXIGEM a poda, o `toEqual([])` acima passaria sozinho.
    expect(podados, 'a grade precisa exercitar a poda, senão o teste não prova nada').toBeGreaterThan(0);
  }, 120000);

  it('a poda para na hora: uma série direta a mais no grupo podado estouraria o teto', () => {
    let verificados = 0;
    for (const { n, o, d, t } of CELULAS) for (const semana of [3, 5]) {
      const r = rotina(celula(n, o, d, t), { semanaCiclo: { semana } });
      const frase = avisoDaPoda(r)[0];
      if (frase == null) continue;
      const p = ponderado(r);
      for (const g of GRUPOS_GRANDES) {
        if (!frase.toLowerCase().includes(g.slice(0, 5))) continue;
        // Minimalidade: a poda tirou o necessário e parou — não cortou por precaução.
        expect((p.get(g) ?? 0) + 1, `${n}/${o}/${d}d/${t}min/S${semana} · ${g}`).toBeGreaterThan(teto(r, g));
        verificados += 1;
      }
    }
    expect(verificados, 'nenhum grupo podado foi verificado — o recorte deixou de exercitar a poda').toBeGreaterThan(0);
  }, 120000);
});

// ── 3. O foco e o baseline não pagam um pelo outro ───────────────────────────
describe('🔒 o baseline corrigido é preservado quando o foco entra', () => {
  const OVER = { nivelExperiencia: 'avancado', diasDisponiveis: 3, tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', treinoDias: DIAS.slice(0, 3) };
  const sem = () => rotina(perfil(OVER), { semanaCiclo: { semana: 5 } });
  const com = () => rotina(perfil({ ...OVER, foco: { grupo: 'peito', compensa: 'ombros', semana: 5 } }), { semanaCiclo: { semana: 5 } });

  /**
   * 🔒 A comparação é por CONJUNTO dentro do dia, não por posição: o foco muda a ORDEM de
   * propósito (decisão de produto 13/09, `reordenarPeloFoco` — e o degrau `ordem` da DF de
   * 2026-07-31: *"quem já está no topo não ganha volume; ganha ORDEM"*). O que não pode
   * mudar é QUAL exercício está lá e com QUANTAS séries — é isso que D-01/D-02 protegem.
   */
  it('os slots do baseline saem idênticos com e sem foco (o extra não retira volume de ninguém)', () => {
    const a = sem();
    const b = com();
    const extras = new Set((b.blocoFoco?.adicionais ?? []).map((x) => x.exercicioId));
    // ⚠️ ANTI-VACUIDADE: sem extras entregues, a comparação abaixo compara o plano consigo.
    expect(extras.size, 'o cenário precisa entregar bloco adicional').toBeGreaterThan(0);
    const soBaseline = (r: RotinaSemanal) => r.dias.map((d) => `${d.diaId}:${d.slots
      .filter((s) => !extras.has(s.exercicio.id)).map((s) => `${s.exercicio.id}x${s.series}`).sort().join(',')}`);
    expect(soBaseline(b)).toEqual(soBaseline(a));
  });

  it('com foco, nenhum grande passa do teto — nem o focado, nem um terceiro', () => {
    expect(acimaDoTeto(com())).toEqual([]);
  });
});

// ── 4. Deload e retomada usam a faixa da PRÓPRIA fase ────────────────────────
describe('🔒 o teto da fase é o teto que vale', () => {
  it('deload (S6): o teto publicado é o reduzido, aplicado UMA vez, e o plano cabe nele', () => {
    const r = rotina(perfil({ nivelExperiencia: 'avancado' }), { semanaCiclo: { semana: 6 } });
    expect(r.faseVolume).toBe('deload');
    const reduzido = r.faixaVolumeSemana!.max;
    expect(teto(r, 'costas'), 'a semana 6 tem teto reduzido, não o do nível').toBe(reduzido);
    /**
     * 🔵 SEM SEGUNDA SUBTRAÇÃO (2026-09-17): a margem de 3 já foi aplicada ao derivar o
     * máximo automático do NÍVEL; o teto da fase entra por `min`, nunca por outro `− 3`.
     */
    expect(teto(r, 'costas')).not.toBe(reduzido - 3);
    expect(acimaDoTeto(r)).toEqual([]);
  });

  it('retomada: o teto é o operacional do nível e o plano cabe nele', () => {
    const r = rotina(perfil({ nivelExperiencia: 'avancado' }), { semanaCiclo: { semana: 1, retomada: { semana: 1, fator: 0.5, volumeReferencia: 20 } } });
    expect(r.faseVolume).toBe('retomada');
    // 🔵 A retomada não declara teto menor — ela reduz o ALVO. E não aplica bloco de foco.
    expect(teto(r, 'costas'), 'a retomada nunca elevou nem baixou o TETO — só o alvo').toBe(18);
    expect(r.tetoVolumeSemana?.gruposEmFoco).toEqual([]);
    expect(acimaDoTeto(r)).toEqual([]);
  });
});

// ── 5. O desenho da pessoa: o app corrige o número do app, nunca o dela ──────
describe('🔒 treino manual salvo: as séries da pessoa não mudam', () => {
  /** Um desenho com dose explícita alta, que estoura o teto de propósito. */
  const comDose = (series: number) => {
    const r = rotina(perfil(), { semanaCiclo: { semana: 3 } });
    const dias = r.dias.map((d) => ({
      diaId: d.diaId, exercicioIds: d.slots.map((s) => s.exercicio.id),
      seriesPorExercicio: Object.fromEntries(d.slots.map((s) => [s.exercicio.id, series])),
    }));
    return rotina(perfil({ rotinaCustom: { dias } }), { semanaCiclo: { semana: 3 } });
  };

  /**
   * 🔒 Quem diz o excesso que FICA é o CRÍTICO (`acima_do_maximo`, com o número por grupo) —
   * D16, uma voz por fato. O montador só fala quando AGE; aqui ele não agiu, e não pode
   * inventar uma segunda linha sobre o mesmo excesso (medido no QA: três linhas do crítico
   * mais uma nossa, dizendo o mesmo com menos informação).
   */
  it('a dose escolhida sobrevive intacta mesmo acima do teto — e o motor não fala por cima do crítico', () => {
    const r = comDose(6);
    for (const d of r.dias) for (const s of d.slots) {
      expect(s.series, `${s.exercicio.id}`).toBe(6);
      expect(s.seriesDefinidasPeloUsuario).toBe(true);
    }
    // ⚠️ ANTI-VACUIDADE: o cenário só prova algo se de fato estourar o teto.
    expect(acimaDoTeto(r).length, 'o desenho precisa estourar o teto para o caso valer').toBeGreaterThan(0);
    expect(avisoDaPoda(r), 'a poda não podia ter agido: tudo é dose da pessoa').toEqual([]);
  });

  it('nenhum slot dosado pela pessoa é podado', () => {
    const r = comDose(5);
    expect(r.avisos.join(' ')).not.toMatch(/que o app dosou/);
    for (const d of r.dias) for (const s of d.slots) expect(s.series).toBe(5);
  });
});

// ── 6. Paridade por slot: abrir, salvar e reabrir não muda nada ──────────────
describe('🔒 abrir/salvar/reabrir depois da poda devolve o MESMO treino', () => {
  const CASOS = [
    { nome: 'avançado/massa 3d/75min S5 (célula podada)', over: { nivelExperiencia: 'avancado', diasDisponiveis: 3, tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', treinoDias: DIAS.slice(0, 3) }, opcoes: { semanaCiclo: { semana: 5 } } },
    { nome: 'avançado/saúde 3d/45min S3 (célula podada)', over: { nivelExperiencia: 'avancado', objetivo: 'saude', diasDisponiveis: 3, tempoPorSessaoMin: 45, treinoDias: DIAS.slice(0, 3) }, opcoes: { semanaCiclo: { semana: 3 } } },
    { nome: 'deload S6', over: { nivelExperiencia: 'avancado' }, opcoes: { semanaCiclo: { semana: 6 } } },
    { nome: 'retomada', over: { nivelExperiencia: 'avancado' }, opcoes: { semanaCiclo: { semana: 1, retomada: { semana: 1, fator: 0.5, volumeReferencia: 20 } } } },
  ] as const;

  /**
   * 🔒 O caminho é o REAL do editor (`doPlano` → `paraRotinaCustom`), não um `rotinaCustom`
   * montado à mão. A diferença importa: é `doPlano` que carrega a `referenciaDose`, sem a
   * qual o deload seria aplicado uma segunda vez sobre a escolha já reduzida — o plano
   * encolheria a cada abertura. Salvar à mão testaria um caminho que a tela não usa.
   */
  const salvar = (p: PerfilResumo, r: RotinaSemanal, opcoes: unknown) =>
    paraRotinaCustom(doPlano(r.dias, p.treinoDias ?? [], p.rotinaCustom,
      (opcoes as { semanaCiclo?: { retomada?: never } }).semanaCiclo?.retomada));

  it.each(CASOS)('$nome: dias, ids, ordem e séries idênticos na volta', ({ over, opcoes }) => {
    const p = perfil(over as Record<string, unknown>);
    const original = rotina(p, opcoes);
    expect(original.dias.flatMap((d) => d.slots).length, 'plano vazio não prova paridade').toBeGreaterThan(5);
    const pReaberto = { ...p, rotinaCustom: salvar(p, original, opcoes) } as PerfilResumo;
    const reaberto = rotina(pReaberto, opcoes);
    expect(porSlot(reaberto)).toEqual(porSlot(original));
    const segundaVolta = rotina({ ...pReaberto, rotinaCustom: salvar(pReaberto, reaberto, opcoes) } as PerfilResumo, opcoes);
    expect(porSlot(segundaVolta), 'salvar e reabrir de novo não acumula perda').toEqual(porSlot(reaberto));
  });
});
