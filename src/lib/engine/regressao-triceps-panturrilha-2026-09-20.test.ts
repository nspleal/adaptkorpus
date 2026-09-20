/**
 * 🔒 REGRESSÃO — os dois resíduos publicados no PR #18 (decisões do autor, 2026-09-20).
 *
 * O PR #18 foi publicado com dois pontos abertos, nomeados no próprio relatório:
 *  ① o dia de braços do caso relatado terminava com CINCO exercícios de tríceps;
 *  ② a panturrilha não entrava no dia de pernas do mesmo caso.
 *
 * As causas medidas, cada uma numa etapa diferente:
 *  ① `consolidarPequenos` roda ANTES de `adicionarBlocoFoco`, então nunca via o extra do
 *    foco; e a guarda de traços era circular — protegia inclusive o traço que o próprio slot
 *    removido introduzia, de modo que um extra com traço próprio nunca podia sair.
 *  ② o orçamento de slots do dia é função do TEMPO, mas continuava valendo para quem marcou
 *    "sem limite de tempo" (perfil em que o motor nem avalia limite). Varredura de 336
 *    perfis: 284 sem panturrilha, e em TODOS o dia de pernas estava cheio.
 *
 * As duas correções, e só elas:
 *  ① um slot `extraDoFoco` pode ser consolidado nos mantidos quando sua FUNÇÃO e TODOS os
 *    seus alvos documentais continuam cobertos e a dose inteira cabe no teto por exercício;
 *  ② decisão explícita do autor: em "sem limite de tempo", e só quando os slots do orçamento
 *    são necessários para os grupos principais, o dia de pernas pode receber UM slot além do
 *    orçamento, exclusivamente para a panturrilha, sem tirar série de nenhum outro grupo.
 *
 * Cada `it` abaixo FALHA sobre `origin/main` em 67350fe (conferido; ver o registro da tarefa).
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { creditoPonderadoDaSemana, orcamentoSlotsDoDia } from './alocador';
import { ehImprovisoDomestico } from './equipamento';
import { ehComplementar, ehDiaDePernas } from './selecao-referencia';
import { diretosDoExercicio } from './cobertura-anatomica';
import { tetoSeriesPorExercicio } from './trilhos';
import type { GrupoPrimario } from '../data/types';
import type { FlagsSaude } from './types';
import type { DiaTreino, PerfilTreino, RotinaSemanal, SemanaCiclo } from './treino-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: [], diasDisponiveis: 4,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado', ...over,
});
const montar = (p: PerfilTreino, semana: SemanaCiclo = 5): RotinaSemanal =>
  montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana, feedbackGrupos: new Map() });

/** A mesma fixture APROXIMADA do relato usada no PR #18 — não é o perfil privado real. */
const RELATADO: PerfilTreino = perfil({
  divisaoPreferida: 'prioridades', tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite',
  focoAgregado: { grupo: 'bracos', semana: 1 }, variacaoTreino: 1,
});

const doGrupo = (d: DiaTreino, g: GrupoPrimario) => d.slots.filter((s) => s.exercicio.grupoPrimario === g);
const alvosDe = (d: DiaTreino, g: GrupoPrimario) =>
  new Set(doGrupo(d, g).flatMap((s) => [...diretosDoExercicio(s.exercicio.id)]));
const diaDePernas = (r: RotinaSemanal) =>
  r.dias.find((d) => ehDiaDePernas(d.slots.map((s) => s.exercicio.grupoPrimario).filter((x): x is GrupoPrimario => x != null)))!;
const diaDeTriceps = (r: RotinaSemanal) => r.dias.find((d) => doGrupo(d, 'triceps').length > 0)!;
const serie = (d: DiaTreino, g: GrupoPrimario) => doGrupo(d, g).reduce((n, s) => n + (s.series ?? 0), 0);

describe('🔴 resíduo ① — cinco exercícios de tríceps no dia de braços', () => {
  const r = montar(RELATADO);
  const bracos = diaDeTriceps(r);

  it('a mesma dose cabe em menos exercícios: no máximo quatro tríceps no dia', () => {
    // 14 séries com teto de 4 por exercício exigem 4 exercícios; o quinto só carregava dose.
    const ts = doGrupo(bracos, 'triceps');
    expect(ts.length, ts.map((s) => `${s.exercicio.id}x${s.series}`).join(' ')).toBeLessThanOrEqual(4);
    expect(ts.length, 'a dose não cabe em menos que isto — o caso deixou de discriminar').toBe(
      Math.ceil(serie(bracos, 'triceps') / tetoSeriesPorExercicio('intermediario')),
    );
  });

  it('consolidar não custou série, crédito nem alvo do tríceps', () => {
    // O crédito do PR #18 neste caso: 14 diretas e 18 ponderadas. Nada disso pode cair.
    expect(serie(bracos, 'triceps')).toBe(14);
    expect(creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots)).get('triceps')).toBe(18);
    for (const a of ['tl', 'tt', 'tm']) expect(alvosDe(bracos, 'triceps').has(a), a).toBe(true);
  });

  it('nenhum exercício passa do teto por exercício do nível', () => {
    for (const d of r.dias) for (const s of d.slots)
      expect(s.series ?? 0, `${d.nome}/${s.exercicio.id}`).toBeLessThanOrEqual(tetoSeriesPorExercicio('intermediario'));
  });

  it('a consolidação é dita, e diz que a dose ficou', () => {
    expect(r.avisos.some((a) => /extra do foco coube nos exercícios que o dia já tinha/.test(a))).toBe(true);
  });
});

describe('🔴 resíduo ② — panturrilha omitida no dia de pernas', () => {
  const r = montar(RELATADO);
  const pernas = diaDePernas(r);

  it('a panturrilha entra, no dia de pernas, e é o único complementar daquele dia', () => {
    expect(doGrupo(pernas, 'panturrilha'), 'panturrilha fora do dia de pernas').toHaveLength(1);
    const comp = pernas.slots.filter((s) => ehComplementar(s.exercicio.grupoPrimario));
    expect(comp.map((s) => s.exercicio.grupoPrimario)).toEqual(['panturrilha']);
    expect(r.avisos.some((a) => /Panturrilhas? não entrou/i.test(a))).toBe(false);
  });

  it('ela entrou SOMANDO: nenhum grupo principal perdeu série nem crédito ponderado', () => {
    // Os créditos medidos no PR #18 para esta fixture, grupo a grupo.
    /**
     * 🔵 GLÚTEOS REMEDIDO em 2026-09-19 (10 → 9,5), e o motivo não é a panturrilha.
     *
     * A exclusão do improviso doméstico na ACADEMIA tirou deste plano o `e59` — "Elevação de
     * quadril (hip thrust)", cujo `comoFazer` manda apoiar as costas *"na borda do sofá/cama"*.
     * Ele era o ÚNICO candidato da família `ponte-hip-thrust` sem crédito secundário em
     * posterior E com o mesmo custo de slot do `e58` (o `e153`, na máquina, tem outro custo e o
     * `e161` é unilateral). Sem ele, a troca que resolvia o teto do dia de pernas sem custar
     * série deixou de existir, a poda cortou 2 séries de posterior e o crédito INDIRETO de
     * glúteos caiu 0,5 junto.
     *
     * 🔒 O que NÃO mudou: a panturrilha continua entrando somando, o slot extra continua sendo
     * um só e no dia de pernas, quadríceps e posterior continuam em 12 séries diretas no dia, e
     * nenhum teto foi afrouxado. E o motor DIZ a perda — asserção logo abaixo —, em vez de
     * entregar um número mais bonito calado.
     *
     * 📌 Resíduo de CATÁLOGO, para decisão do autor: academia não tem variante própria de hip
     * thrust com barra nem de paralelas; o `e153` (máquina) e o `e100` (paralelas em duas
     * cadeiras) são o que existe. Enquanto não houver, o glúteo do perfil de academia fica
     * dependendo de ponte no chão.
     */
    const c = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
    for (const [g, n] of [['peito', 15], ['costas', 14], ['ombros', 13.5], ['quadriceps', 12],
      ['posterior', 12], ['gluteos', 9.5], ['biceps', 17.5]] as const)
      expect(c.get(g) ?? 0, g).toBeGreaterThanOrEqual(n);
    expect(serie(pernas, 'quadriceps')).toBe(12);
    // Posterior DIRETO caiu 12 → 10 pela mesma causa acima (a poda substituiu a troca que o
    // `e59` viabilizava). O crédito PONDERADO do grupo continua em 12, e é ele que a faixa
    // cobra — a asserção logo acima. A poda é dita em `rotina.avisos`.
    expect(serie(pernas, 'posterior')).toBe(10);
    expect(r.avisos.some((a) => /Ajustamos o volume de Posterior/i.test(a)),
      `o corte de posterior não foi dito: ${r.avisos.join(' | ')}`).toBe(true);
  });

  it('a perda de glúteos não é escondida: o motor diz que o grupo ficou abaixo do mínimo', () => {
    expect(r.avisos.some((a) => /volume de gluteos ficou abaixo do m[íi]nimo/i.test(a)),
      `o plano entrega glúteos abaixo do mínimo sem dizer: ${r.avisos.join(' | ')}`).toBe(true);
  });

  it('nenhum improviso doméstico sobra num plano de ACADEMIA', () => {
    const improvisos = r.dias.flatMap((d) => d.slots.filter((s) => ehImprovisoDomestico(s.exercicio)));
    expect(improvisos.map((s) => s.exercicio.nomePt), 'improviso de casa num treino de academia').toEqual([]);
  });

  it('o slot extra é UM só, e só no dia de pernas — os demais dias respeitam o orçamento', () => {
    const orcamento = orcamentoSlotsDoDia(75);
    for (const d of r.dias) {
      // O orçamento se mede sobre o BASELINE: o extra do bloco de foco é outra autorização,
      // anterior a esta, e continua podendo somar nos dias em que o foco entrega.
      const baseline = d.slots.length - d.slots.filter((s) => s.extraDoFoco).length;
      const limite = d === pernas ? orcamento + 1 : orcamento;
      expect(baseline, `${d.nome} passou do orçamento de baseline`).toBeLessThanOrEqual(limite);
    }
    expect(pernas.slots.length, 'o dia de pernas deveria ter exatamente um slot além do orçamento').toBe(orcamento + 1);
    expect(pernas.slots.filter((s) => s.extraDoFoco), 'o slot extra do dia de pernas não é do foco').toHaveLength(0);
  });

  it('nenhum grupo passa do teto semanal cheio', () => {
    const c = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
    for (const g of ['peito', 'costas', 'quadriceps', 'posterior', 'gluteos', 'ombros'] as const)
      expect(c.get(g) ?? 0, g).toBeLessThanOrEqual(r.tetoVolumeSemana!.cheio);
  });
});

describe('🔒 os limites da exceção do oitavo slot (decisão do autor: só "sem limite de tempo")', () => {
  it('perfil com TEMPO LIMITADO não ganha o slot extra em dia nenhum', () => {
    for (const tempo of [30, 45, 60, 75]) {
      const r = montar(perfil({ divisaoPreferida: 'prioridades', tempoPorSessaoMin: tempo, limiteTempoTreino: 'limitado', variacaoTreino: 1 }));
      const orcamento = orcamentoSlotsDoDia(tempo);
      for (const d of r.dias) {
        const extras = d.slots.filter((s) => s.extraDoFoco).length;
        expect(d.slots.length - extras, `${tempo}min ${d.nome}`).toBeLessThanOrEqual(orcamento);
      }
    }
  });

  it('o slot extra serve SÓ à panturrilha: core e antebraço não furam o orçamento', () => {
    for (const dias of [2, 3, 4, 5, 6, 7] as const) {
      const agenda = (['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const).slice(0, dias);
      const r = montar(perfil({ diasDisponiveis: dias, treinoDias: [...agenda], tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', variacaoTreino: 1 }));
      const orcamento = orcamentoSlotsDoDia(75);
      for (const d of r.dias) {
        const extras = d.slots.filter((s) => s.extraDoFoco).length;
        if (d.slots.length - extras <= orcamento) continue;
        // Passou do orçamento: então o excedente é exatamente a panturrilha, num dia de pernas.
        expect(d.slots.length - extras, `${dias}d ${d.nome}`).toBe(orcamento + 1);
        expect(doGrupo(d, 'panturrilha'), `${dias}d ${d.nome}`).toHaveLength(1);
        expect(ehDiaDePernas(d.slots.map((s) => s.exercicio.grupoPrimario).filter((x): x is GrupoPrimario => x != null))).toBe(true);
      }
    }
  });

  it('um complementar por dia continua valendo, e panturrilha só em dia de pernas', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const)
      for (const dias of [2, 4, 6] as const) {
        const agenda = (['seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const).slice(0, dias);
        const r = montar(perfil({ nivelExperiencia: nivel, diasDisponiveis: dias, treinoDias: [...agenda], tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite', variacaoTreino: 1 }));
        for (const d of r.dias) {
          const gs = d.slots.map((s) => s.exercicio.grupoPrimario).filter((x): x is GrupoPrimario => x != null);
          const comp = gs.filter(ehComplementar);
          const dedicado = gs.length > 0 && gs.every((g) => ehComplementar(g) || g === 'lombar');
          if (!dedicado) expect(comp.length, `${nivel}/${dias}d ${d.nome}: ${comp.join(',')}`).toBeLessThanOrEqual(1);
          if (comp.includes('panturrilha')) expect(ehDiaDePernas(gs), `${nivel}/${dias}d ${d.nome}`).toBe(true);
        }
      }
  });

  it('é determinístico e o desenho manual não é tocado', () => {
    const a = montar(RELATADO), b = montar(RELATADO);
    const foto = (r: RotinaSemanal) => JSON.stringify(r.dias.map((d) => d.slots.map((s) => [s.exercicio.id, s.series])));
    expect(foto(a)).toBe(foto(b));

    const manual = montar(perfil({
      ...RELATADO,
      rotinaCustom: { origem: 'usuario', dias: [{ nome: 'Meu dia', diaId: 'seg', exercicioIds: ['e3', 'e63'] }] },
    } as Partial<PerfilTreino>));
    expect(manual.dias).toHaveLength(1);
    expect(manual.dias[0]!.slots.map((s) => s.exercicio.id)).toEqual(['e3', 'e63']);
  });
});
