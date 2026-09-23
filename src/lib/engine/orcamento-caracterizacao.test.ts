import {adequarInicioFullUpperLower} from './adequacao-tempo-inicial';
import {avaliarDuracaoResistida} from './duracao-plano';
import { describe, expect, it, vi } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina, type OpcoesSemana } from './treino-montador';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude } from './types';
import type { PerfilTreino, SemanaCiclo } from './treino-types';
import { temCarga } from './equipamento';
import { classeDeDescanso, descansoDoExercicio } from './descanso';

import { MINIMOS_TEMPO, PRINCIPAIS_TEMPO, SECUNDARIOS_TEMPO, tipoSessaoTemporal } from './adequacao-tempo-politica';
import { creditoPonderadoDaSemana } from './alocador';
import { tetoPonderadoNaSessao, tetoSemanalDoGrupo, tetoSeriesPorExercicio } from './trilhos';
import { GRUPOS_COM_FAIXA_SEMANAL } from './grupos-volume';
/** Orçamento real, conforme decisões de 20/09.
 * As fotografias de slots foram arquivadas em LIMPEZA-ORCAMENTO-20260920/antes.
 * Uma quota inicial não pode substituir mínimos, duração real ou limites de volume.
 * Mesmos eixos da caracterização anterior; assertivas sobre a entrega, sem regravar fotos.
 */
const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

function perfil(over: Partial<PerfilTreino> = {}): PerfilTreino {
  return {
    pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
    nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4,
    tempoPorSessaoMin: 60, ...over,
  };
}

/** Exercita a composição entregue na semana escolhida. */
function rotinaComCiclo(over: Partial<PerfilTreino> = {}, semana = 1) {
  const p = perfil(over);
  const opc: OpcoesSemana = { semana: semana as OpcoesSemana['semana'], feedbackGrupos: new Map() };
  return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, undefined, opc);
}

function verificarResultado(r: ReturnType<typeof rotinaComCiclo>, p: PerfilTreino) {
  const limite = p.tempoPorSessaoMin * 60;
  const duracoes = r.dias.map(d => avaliarDuracaoResistida(d.slots, p.nivelExperiencia));
  expect(r.dias).toHaveLength(p.diasDisponiveis);
  for (const m of duracoes) expect(m.estadoCalculo).toBe('CALCULADO');
  const excede = duracoes.some(m => m.duracaoMaximaEstimadaSegundos! > limite);
  expect(r.resultadoGeracao?.tipo).toBe(excede ? 'INCOMPATIVEL' : 'CERTIFICADO');
  for (const d of r.dias) {
    expect(d.slots.length).toBeGreaterThan(0);
    const gs = d.slots.flatMap(s => s.exercicio.grupoPrimario ? [s.exercicio.grupoPrimario] : []);
    const tipo = tipoSessaoTemporal(d.nome, gs, r.dias.map(x => x.nome));
    const minimos = tipo === 'segmentada'
      ? Object.fromEntries([...new Set(gs)].map(g => [g, PRINCIPAIS_TEMPO.includes(g) ? 2 : SECUNDARIOS_TEMPO.includes(g) ? 1 : 0]))
      : MINIMOS_TEMPO[tipo];
    for (const [g, minimo] of Object.entries(minimos))
      expect(gs.filter(x => x === g).length, `${d.nome}/${g}`).toBeGreaterThanOrEqual(minimo);
    for (const s of d.slots) {
      expect(s.series).toBeGreaterThanOrEqual(1);
      expect(s.series).toBeLessThanOrEqual(tetoSeriesPorExercicio(p.nivelExperiencia));
      expect(s.descansoSeg).toBeGreaterThanOrEqual(60);
    }
    const teto = tetoPonderadoNaSessao(p.nivelExperiencia, p.objetivo);
    if (teto != null) for (const [g, n] of creditoPonderadoDaSemana(d.slots))
      expect(n, `${d.nome}/${g}`).toBeLessThanOrEqual(teto);
  }
  const t = r.tetoVolumeSemana!;
  const teto = tetoSemanalDoGrupo({ nivel: p.nivelExperiencia, objetivo: p.objetivo, emFoco: t.gruposEmFoco, tetoDaFase: t.cheio });
  const creditos = creditoPonderadoDaSemana(r.dias.flatMap(d => d.slots));
  for (const g of GRUPOS_COM_FAIXA_SEMANAL) expect(creditos.get(g) ?? 0, g).toBeLessThanOrEqual(teto(g));
}

const casos: { nome: string; over: Partial<PerfilTreino>; semana?: SemanaCiclo }[] = [
  ...[30,45,60,75,90].map(tempoPorSessaoMin => ({ nome: `intermediário/${tempoPorSessaoMin}min`, over: { tempoPorSessaoMin } })),
  ...(['massa','emagrecimento','saude'] as const).map(objetivo => ({ nome: `${objetivo}/60min`, over: { objetivo } })),
  ...(['iniciante','intermediario','avancado'] as const).map(nivelExperiencia => ({ nome: `${nivelExperiencia}/60min`, over: { nivelExperiencia } })),
  ...([1,3,5,6] as const).map(semana => ({ nome: `ciclo S${semana}`, over: {}, semana })),
  { nome: 'avançado/5d/30min', over: { nivelExperiencia: 'avancado', diasDisponiveis: 5, tempoPorSessaoMin: 30 } },
  ...(['iniciante','intermediario'] as const).flatMap(nivelExperiencia => [10,15,20,25].map(tempoPorSessaoMin => ({ nome: `${nivelExperiencia}/${tempoPorSessaoMin}min`, over: { nivelExperiencia, tempoPorSessaoMin } }))),
  ...(['massa','emagrecimento','saude'] as const).map(objetivo => ({ nome: `iniciante/${objetivo}/12min`, over: { nivelExperiencia: 'iniciante' as const, objetivo, tempoPorSessaoMin: 12 } })),
  ...[20,60].map(tempoPorSessaoMin => ({ nome: `força/emagrecimento/${tempoPorSessaoMin}min`, over: { objetivo: 'emagrecimento' as const, modoForca: true, tempoPorSessaoMin } })),
];
describe('orçamento: mínimos, duração e tetos na entrega', () => {
  it.each(casos)('$nome', ({ over, semana = 1 }) => verificarResultado(rotinaComCiclo(over, semana), perfil(over)));
  it('controle positivo: 30 min cabem; 10 min são recusados sem apagar grupos para caber', () => {
    expect(rotinaComCiclo({ tempoPorSessaoMin: 30 }).resultadoGeracao?.tipo).toBe('CERTIFICADO');
    expect(rotinaComCiclo({ tempoPorSessaoMin: 10 }).resultadoGeracao?.tipo).toBe('INCOMPATIVEL');
  });
  it('mesma entrada produz os mesmos dias, exercícios, séries e descansos', () => {
    expect(rotinaComCiclo().dias).toEqual(rotinaComCiclo().dias);
  });
});

describe('resumo dos descansos efetivamente prescritos', () => {
  const faixaObservada = (r: ReturnType<typeof rotinaComCiclo>) => {
    const valores = r.dias.flatMap((d) => d.slots)
      .filter((s) => s.descansoSeg != null && classeDeDescanso(s.exercicio) !== 'ISOLADO' && classeDeDescanso(s.exercicio) !== 'NAO_SE_APLICA')
      .map((s) => s.descansoSeg!);
    expect(valores.length, 'nenhum composto no plano: a identidade seria vácua').toBeGreaterThan(0);
    return { min: Math.min(...valores), max: Math.max(...valores) };
  };

  it.each(['massa', 'emagrecimento', 'saude'] as const)('descanso efetivo da semana — objetivo %s', (objetivo) => {
    const r = rotinaComCiclo({ objetivo, tempoPorSessaoMin: 90 });
    expect(r.semana?.descansoCompostoSeg, 'o resumo não bate com os slots').toEqual(faixaObservada(r));
  });

  it.each([30, 60, 90])('descanso efetivo — massa, %i min (resumo acompanha os slots)', (tempoPorSessaoMin) => {
    const r = rotinaComCiclo({ tempoPorSessaoMin });
    expect(r.semana?.descansoCompostoSeg, 'o resumo não bate com os slots').toEqual(faixaObservada(r));
  });

  it('descanso efetivo — modo força usa os valores entregues', () => {
    const r = rotinaComCiclo({ objetivo: 'emagrecimento', modoForca: true, tempoPorSessaoMin: 90 });
    expect(r.semana?.descansoCompostoSeg, 'o resumo não bate com os slots').toEqual(faixaObservada(r));
  });

  /**
   * 🔄 INVERTIDO PELA PARTE 2 (era: "a rotina devolve UM descanso, da semana, não um por
   * item"). O teste existia para registrar que nenhum slot carregava descanso próprio.
   * Agora TODO slot com série carrega — é a mudança estrutural da leva. O escalar da semana
   * segue exposto só por compatibilidade da chamada v1.
   */
  it('todo slot carrega o SEU descanso (o escalar da semana virou legado)', () => {
    const r = rotinaComCiclo();
    expect(r.semana?.descansoCompostoSeg).toBeDefined();
    for (const d of r.dias) {
      for (const s of d.slots) {
        expect(s.descansoSeg, `${s.exercicio.id}`).toBeDefined();
        expect(s.descansoSeg!).toBeGreaterThanOrEqual(60);
      }
    }
  });
});

describe('🔒 aceite 5b — a estimativa SOMA por item, e enxerga a composição', () => {
  it('mesmo número de séries custa mais com compostos; só o dia caro exige redução', () => {
    // Controle da fórmula com composição explícita: trocar a divisão não muda a prova.
    const montar = (ids: string[]) => ids.map(id => {
      const exercicio=EXERCISES.find(e=>e.id===id)!;
      return {exercicio,padrao:exercicio.padraoMovimento,series:3,
        descansoSeg:descansoDoExercicio({exercicio,rirAlvo:2,degradacao:0})!};
    });
    const caro=montar(['e15','e46']), barato=montar(['e72','e67']);
    const limite=avaliarDuracaoResistida(barato,'intermediario').duracaoMaximaEstimadaSegundos!;
    expect(avaliarDuracaoResistida(caro,'intermediario').duracaoMaximaEstimadaSegundos).toBeGreaterThan(limite);
    const a=adequarInicioFullUpperLower({nome:'Upper',slots:caro},'intermediario',limite);
    const b=adequarInicioFullUpperLower({nome:'Upper',slots:barato},'intermediario',limite);
    expect(a.descansos.length).toBeGreaterThan(0);
    expect(b.descansos).toEqual([]);
    expect(a.duracao.duracaoMaximaEstimadaSegundos).toBeLessThanOrEqual(limite);
    expect(a.dia.slots.map(s=>s.series)).toEqual([3,3]);
    expect(b.dia.slots).toEqual(barato);
  });

  it('o custo por slot acompanha a classe (composto ≥ acessório, sempre)', () => {
    const r = rotinaComCiclo({ tempoPorSessaoMin: 60 });
    for (const d of r.dias) {
      const comp = d.slots.filter((s) => s.padrao !== 'isolado' && s.padrao !== 'core');
      const aces = d.slots.filter((s) => s.padrao === 'isolado' || s.padrao === 'core');
      for (const c of comp) for (const a of aces) {
        expect(c.descansoSeg!, `${c.exercicio.id} vs ${a.exercicio.id}`).toBeGreaterThanOrEqual(a.descansoSeg!);
      }
    }
  });
});

describe('🔒 o delta dos 18 `core` na saída REAL', () => {
  /**
   * 🔑 A confirmação que o handoff pede: um abdominal e um composto na MESMA sessão têm de
   * mostrar números diferentes. Antes, `sl.padrao !== 'isolado'` punha `core` do lado do
   * composto e os dois recebiam a mesma faixa.
   */
  it('um `core` e um composto na mesma sessão recebem descansos DIFERENTES', () => {
    // Explicit manual drawing keeps this rest-class control independent of complementary allocation.
    const r = rotinaComCiclo({tempoPorSessaoMin:60,diasDisponiveis:1,treinoDias:['seg'],rotinaCustom:{origem:'usuario',dias:[{nome:'Controle',diaId:'seg',exercicioIds:['e11','e147']}]}});
    const diaComCore = r.dias.find(
      (d) => d.slots.some((s) => s.padrao === 'core') && d.slots.some((s) => s.padrao !== 'core' && s.padrao !== 'isolado'),
    );
    expect(diaComCore, 'nenhuma sessão tem core + composto juntos — caso não discriminante').toBeDefined();
    const core = diaComCore!.slots.find((s) => s.padrao === 'core')!;
    const comp = diaComCore!.slots.find((s) => s.padrao !== 'core' && s.padrao !== 'isolado')!;
    expect(core.descansoSeg).toBeDefined();
    expect(comp.descansoSeg).toBeDefined();
    expect(core.descansoSeg).not.toBe(comp.descansoSeg);
    expect(core.descansoSeg!).toBeLessThan(comp.descansoSeg!);
  });

  it('nenhum slot de cardio recebe descanso (aceite 7, na saída real)', () => {
    const r = rotinaComCiclo();
    for (const d of r.dias) for (const s of d.slots) {
      if (s.exercicio.tipo === 'cardio') expect(s.descansoSeg).toBeUndefined();
    }
  });
});

describe('🔒 degradação e rampa na saída real (buracos achados por mutação)', () => {
  // FB/UL: piso de 60 s; a ordem e a redução mínima têm controles em adequacao-tempo-inicial.test.ts.
  it('sessão curta respeita o piso de 60 s, inclusive nos compostos de FB/UL', () => {
    const r = rotinaComCiclo({ tempoPorSessaoMin: 20, nivelExperiencia: 'intermediario' }, 5);
    const todos = r.dias.flatMap(d => d.slots);
    expect(todos.length).toBeGreaterThan(0);
    for (const x of todos) expect(x.descansoSeg!, x.exercicio.id).toBeGreaterThanOrEqual(60);

  });

  /**
   * B5 — 🟡 EXCEÇÃO NOMEADA: na rampa o piso do FIT é INVIOLÁVEL. Mesmo com tempo curto,
   * ninguém desce de 120 s na semana 1 — quem cede é o nº de exercícios. Sem este teste, a
   * mutação "rampa passa a degradar" sobrevivia, e ela apaga exatamente a proteção que a
   * rampa existe para dar (o risco documentado é rabdomiólise, não desconforto).
   */
  it('na rampa com tempo curto, NINGUÉM desce do piso do FIT (cede o nº de exercícios)', () => {
    // 🔻 1.2: 30 min, não 20. MEDIDO: a 20 min a sessão na rampa sai com **zero ISOLADO**
    // (4 slots, todos composto) — era essa a razão de o aceite passar sem provar nada. A 30
    // min há 2 isolados, e 30 é duração REAL do app (as opções são 30/45/60/75).
    const p = perfil({ tempoPorSessaoMin: 30 });
    const opc: OpcoesSemana = {
      semana: 1, feedbackGrupos: new Map(),
      retomada: { semana: 1, fator: 0.5, volumeReferencia: 12, exerciciosRecentes: new Set() },
    };
    const r = montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, undefined, opc);
    const todos = r.dias.flatMap((d) => d.slots).filter((s) => s.descansoSeg != null);
    expect(todos.length, 'rampa sem slots — caso não discriminante').toBeGreaterThan(0);
    for (const s of todos) {
      expect(s.descansoSeg!, `${s.exercicio.id} furou o piso do FIT`).toBeGreaterThanOrEqual(120);
    }

    /**
     * 🔻 CORREÇÃO 1.2 (2026-07-31) — o aceite acima era VACUOSO sozinho.
     *
     * Com composto, o RIR-alvo 3 da rampa já dá **120 s**, que é o próprio piso do FIT: o
     * `max(120, 120)` é inerte, e apagar o piso não mudaria número nenhum. O caso que
     * discrimina é o **ISOLADO**, cuja base a RIR 3 é **60 s** — só o piso o leva a 120.
     */
    const isolados = todos.filter((s) => classeDeDescanso(s.exercicio) === 'ISOLADO');
    expect(isolados.length, 'sem ISOLADO na sessão o aceite volta a ser vacuoso').toBeGreaterThan(0);
    for (const s of isolados) {
      // O que o deslocamento daria SOZINHO, fora da rampa — a prova de que o piso agiu.
      const semRampa = descansoDoExercicio({ exercicio: s.exercicio, rirAlvo: 3 });
      expect(semRampa, `${s.exercicio.id}: base do isolado`).toBe(60);
      expect(s.descansoSeg!, `${s.exercicio.id}: 60 → 120 é o efeito do piso`).toBe(120);
    }
  });

  it('na rampa semana 2 o piso é 90 s', () => {
    const p = perfil({ tempoPorSessaoMin: 20 });
    const opc: OpcoesSemana = {
      semana: 1, feedbackGrupos: new Map(),
      retomada: { semana: 2, fator: 0.7, volumeReferencia: 12, exerciciosRecentes: new Set() },
    };
    const r = montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, undefined, opc);
    for (const s of r.dias.flatMap((d) => d.slots).filter((x) => x.descansoSeg != null)) {
      expect(s.descansoSeg!).toBeGreaterThanOrEqual(90);
    }
  });

  /**
   * B3 — o descanso do slot vem do EXERCÍCIO, não do padrão. O padrão não enxerga o override
   * de força pesada (só composto COM carga), então usar `descansoDoPadrao` no slot final
   * daria o mesmo número para barra e para peso corporal.
   */
  it('modo força: composto COM carga recebe faixa pesada; peso corporal NÃO', () => {
    const r = rotinaComCiclo({ modoForca: true, nivelExperiencia: 'avancado', tempoPorSessaoMin: 90 });
    const comp = r.dias.flatMap((d) => d.slots).filter((s) => s.padrao !== 'isolado' && s.padrao !== 'core');
    const comCarga = comp.filter((s) => temCarga(s.exercicio));
    const semCarga = comp.filter((s) => !temCarga(s.exercicio));
    expect(comCarga.length, 'nenhum composto com carga — caso não discriminante').toBeGreaterThan(0);
    for (const s of comCarga) expect(s.descansoSeg!, `${s.exercicio.id}`).toBeGreaterThanOrEqual(180);
    for (const s of semCarga) expect(s.descansoSeg!, `${s.exercicio.id}`).toBeLessThanOrEqual(180);
  });
});

describe('orçamento por dia', () => {
  it('4d/75min/S5: mínimos e tempo prevalecem sobre a quota inicial de slots', () => {
    const p = perfil({ diasDisponiveis: 4, tempoPorSessaoMin: 75, nivelExperiencia: 'intermediario' });
    const r = rotinaComCiclo(p, 5);
    verificarResultado(r, p);
    // A poda de volume pode liberar tempo DEPOIS da redução de descanso. A duração
    // final não prova qual era o custo antes da poda; a redução mínima é testada na unidade.

  });
});

// Fotografia/autoridade histórica: o seletor é congelado na etapa 1.
// As novas divisões reais são cobradas em distribuicao-etapa2.test.ts e na matriz externa.
vi.mock('./selecao-divisao', async (importOriginal) => process.env.ADAPT_TEST_SELETOR_ATUAL === '1' ? importOriginal() : import('./__fixtures__/selecao-etapa1'));
