/**
 * 🔵 REGRESSÕES DA POLÍTICA FINAL DE REDUÇÃO PARA TREINOS CURTOS (decisão de 2026-09-17).
 *
 * A sequência aprovada, em ordem, com parada assim que couber:
 *
 * ```
 * E1 descanso até os pisos · E2 extras do foco · E3 três séries viram duas
 * E4 exercícios redundantes · E5 dispensa core → antebraço → panturrilha → glúteos
 * E6 bíceps/tríceps/ombros a uma série
 * ```
 *
 * Todas estas provas falham em `0a457709` por COMPORTAMENTO — o SHA anterior não reduz
 * séries, não dispensa glúteos e não diz a duração estimada quando o excesso persiste.
 */
import { describe, expect, it } from 'vitest';
import { gerarTreino } from './index';
import { EXERCISES } from '../data/exercises';
import { avaliarDuracaoResistida } from './duracao-plano';
import {
  GRUPOS_SERIE_MINIMA, SERIES_DE, SERIES_PARA, SERIE_MINIMA,
  reduzirDiaPorTempo, reduzirSeriesAteDuas, reduzirBracosOmbrosParaUma,
} from './ajuste-tempo-estrutura';
import { GRUPOS_DISPENSAVEIS_FULLBODY_CURTO } from './alocador';
import type { PerfilTreino, RotinaSemanal, SlotExercicio, DiaTreino } from './treino-types';
import type { Weekday } from '../semana';
import type { GrupoPrimario } from '../data/types';

/**
 * 🔒 Literais locais de propósito: as provas de PORTA PÚBLICA abaixo têm de falhar no SHA
 * anterior por COMPORTAMENTO, não por `import` de um símbolo que lá não existe. O casamento
 * entre estes literais e as constantes do motor é cobrado num teste próprio, logo adiante.
 */
const TRES = 3, DUAS = 2, UMA = 1;
const BRACOS_OMBROS: readonly GrupoPrimario[] = ['biceps', 'triceps', 'ombros'];

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> & { treinoDias: Weekday[] }): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', tempoPorSessaoMin: 60,
  diasDisponiveis: over.treinoDias.length, ...over,
});
const gerar = (p: PerfilTreino, semana: 1 | 2 | 3 | 4 | 5 | 6 = 1) =>
  gerarTreino(p, { exercises: EXERCISES, semanaCiclo: { semana } }).rotina!;
const todos = (r: RotinaSemanal) => r.dias.flatMap((d) => d.slots);
const ex = (g: GrupoPrimario) => EXERCISES.find((e) => e.grupoPrimario === g && e.padraoMovimento !== 'cardio')!;
const slot = (g: GrupoPrimario, series: number, descansoSeg = 120): SlotExercicio =>
  ({ exercicio: ex(g), padrao: ex(g).padraoMovimento, series, descansoSeg });
const dia = (slots: SlotExercicio[]): DiaTreino => ({ nome: 'Dia', diaId: 'seg' as Weekday, slots });
const medir = (slots: readonly SlotExercicio[]) =>
  avaliarDuracaoResistida(slots, 'intermediario', 100_000).duracaoMaximaEstimadaSegundos!;

describe('E3 — três séries viram duas, e só quando é preciso', () => {
  it('não toca em nada quando o dia já cabe', () => {
    const d = dia([slot('peito', 3), slot('costas', 3)]);
    const r = reduzirDiaPorTempo(d, 'intermediario', medir(d.slots), { reduzirSeries: true });
    expect(r.seriesReduzidas, 'reduziu sem precisar').toEqual([]);
    expect(r.dia.slots.map((s) => s.series)).toEqual([3, 3]);
    expect(r.cabe).toBe(true);
  });

  it('PARA assim que couber: reduz um, não dois', () => {
    const d = dia([slot('peito', 3), slot('costas', 3)]);
    const cheio = medir(d.slots);
    const umMenos = medir([slot('peito', 3), slot('costas', 2)]);
    expect(umMenos, 'reduzir um não muda a duração: o caso não exerce a regra').toBeLessThan(cheio);
    const r = reduzirDiaPorTempo(d, 'intermediario', umMenos, { reduzirSeries: true });
    expect(r.seriesReduzidas).toHaveLength(1);
    expect(r.dia.slots.filter((s) => s.series === SERIES_PARA)).toHaveLength(1);
    expect(r.cabe).toBe(true);
  });

  it('SER-4 reduz 4→3→2 e preserva séries já menores', () => {
    const d = dia([slot('peito', 4), slot('costas', 2), slot('ombros', 4), slot('biceps', 1)]);
    const antes = JSON.stringify(d);
    const r = reduzirDiaPorTempo(d, 'intermediario', 1, { reduzirSeries: true });
    expect(r.seriesReduzidas.map(s => [s.grupo, s.de, s.para])).toEqual([
      ['ombros',4,3], ['ombros',3,2], ['peito',4,3], ['peito',3,2],
    ]);
    expect(r.dia.slots.map(s => s.series)).toEqual([2,2,1,1]);
    expect(r.quantidadesForaDaPolitica).toEqual([]);
    expect(JSON.stringify(d), 'ajuste não pode modificar o plano de entrada').toBe(antes);
  });

  it('SER-4 para em 4→3 se uma única série resolver', () => {
    const d = dia([slot('peito',4),slot('costas',4)]);
    const limite = medir([slot('peito',4),slot('costas',3)]);
    expect(limite).toBeLessThan(medir(d.slots));
    const r = reduzirDiaPorTempo(d,'intermediario',limite);
    expect(r.dia.slots.map(s=>s.series)).toEqual([4,3]);
    expect(r.seriesReduzidas.map(s=>[s.de,s.para])).toEqual([[4,3]]);
    expect(r.redundantesRetirados).toEqual([]);
    expect(r.seriesMinimas).toEqual([]);
    expect(r.cabe).toBe(true);
  });

  it('a unidade só reduz enquanto `cabe()` é falso', () => {
    const slots = [slot('peito', 3), slot('costas', 3), slot('ombros', 3)];
    let chamadas = 0;
    // `cabe` responde falso nas duas primeiras chamadas e verdadeiro na terceira: a etapa
    // reduz exatamente duas vezes e para — nenhum corte depois de o dia caber.
    const feitas = reduzirSeriesAteDuas(slots, () => { chamadas += 1; return chamadas > 2; });
    expect(feitas).toHaveLength(2);
    expect(chamadas, 'a etapa não conferiu a duração antes de cada redução').toBe(3);
    expect(slots.filter((s) => s.series === SERIES_DE), 'reduziu mais do que o necessário').toHaveLength(1);
  });
});

describe('as constantes do motor são as da decisão', () => {
  it('3 → 2, mínimo 1, e a lista bíceps → tríceps → ombros', () => {
    expect([SERIES_DE, SERIES_PARA, SERIE_MINIMA]).toEqual([TRES, DUAS, UMA]);
    expect(GRUPOS_SERIE_MINIMA).toEqual(BRACOS_OMBROS);
  });
});

describe('E6 — bíceps/tríceps/ombros a uma série, só como último recurso', () => {
  it('não acontece enquanto E3 resolve', () => {
    const d = dia([slot('peito', 3), slot('biceps', 3, 60)]);
    const alvo = medir([slot('peito', 3), slot('biceps', 2, 60)]);
    const r = reduzirDiaPorTempo(d, 'intermediario', alvo, { reduzirSeries: true });
    expect(r.seriesReduzidas.length, 'E3 não agiu: o caso não exerce a ordem').toBeGreaterThan(0);
    expect(r.seriesMinimas, 'E6 agiu antes da hora').toEqual([]);
  });

  it('ordem determinística bíceps → tríceps → ombros, e o exercício é PRESERVADO', () => {
    const slots = [slot('ombros', 4), slot('triceps', 4, 60), slot('biceps', 4, 60)];
    const feitas = reduzirBracosOmbrosParaUma(slots, () => false); // nunca cabe: percorre tudo
    expect(feitas.map((f) => f.grupo)).toEqual(['biceps', 'triceps', 'ombros']);
    expect(slots, 'E6 removeu exercício em vez de reduzir série').toHaveLength(3);
    expect(slots.every((s) => s.series === SERIE_MINIMA)).toBe(true);
  });

  it('nunca toca em grupo fora da lista', () => {
    const slots = [slot('peito', 4), slot('costas', 4), slot('biceps', 4, 60)];
    reduzirBracosOmbrosParaUma(slots, () => false);
    expect(slots.filter((s) => s.exercicio.grupoPrimario === 'peito')[0]!.series).toBe(4);
    expect(slots.filter((s) => s.exercicio.grupoPrimario === 'costas')[0]!.series).toBe(4);
  });
});

describe('E5 — dispensa na ordem aprovada, pulando ausentes', () => {
  it('a lista aprovada é core → antebraço → panturrilha → glúteos', () => {
    expect(GRUPOS_DISPENSAVEIS_FULLBODY_CURTO).toEqual(['core', 'antebraco', 'panturrilha', 'gluteos']);
  });

  it('pula o grupo ausente e respeita a ordem entre os presentes', () => {
    // Sem core e sem antebraço no dia: quem cede primeiro é panturrilha, depois glúteos.
    const d = dia([slot('peito', 4), slot('gluteos', 4), slot('panturrilha', 4, 60)]);
    const r = reduzirDiaPorTempo(d, 'intermediario', 1, { permitirDispensa: true, ordemDispensa: GRUPOS_DISPENSAVEIS_FULLBODY_CURTO, reduzirSeries: false });
    expect(r.gruposDispensados).toEqual(['panturrilha', 'gluteos']);
    expect(r.dia.slots.map((s) => s.exercicio.grupoPrimario)).toEqual(['peito']);
  });

  it('fora do full-body de um dia a dispensa NÃO acontece', () => {
    const d = dia([slot('peito', 4), slot('core', 4, 60)]);
    const r = reduzirDiaPorTempo(d, 'intermediario', 1, { permitirDispensa: false, ordemDispensa: GRUPOS_DISPENSAVEIS_FULLBODY_CURTO, reduzirSeries: false });
    expect(r.gruposDispensados, 'a exceção do full-body vazou para outra divisão').toEqual([]);
    expect(r.dia.slots).toHaveLength(2);
  });

  it('no plano real: divisão de vários dias não perde grupo dispensável por tempo', () => {
    const r = gerar(perfil({ nivelExperiencia: 'avancado', tempoPorSessaoMin: 20, treinoDias: ['seg', 'ter', 'qui', 'sex'] }));
    expect(r.avisos.some((a) => a.startsWith('Para caber em') && a.includes('nesta sessão única')),
      'o aviso da exceção do full-body apareceu numa divisão de vários dias').toBe(false);
    // Anti-vacuidade: o caso realmente aperta — há dia acima do limite.
    expect(r.avisos.some(a=>a.includes('reduzimos séries em')), 'SER-4 deve atuar no caso limitado').toBe(true);
    expect(r.resultadoGeracao?.tipo).toBe('CERTIFICADO');
  });
});

describe('Persistindo o excesso: cortes mantidos, duração dita, sem falso certificado', () => {
  // Política de 20/09 faz 20 min caber; 10 min prova o excesso residual sem apagar os casos de 20/30.
  const curto = perfil({ nivelExperiencia: 'avancado', tempoPorSessaoMin: 10, treinoDias: ['seg'] });

  it('as reduções FICAM mesmo sem serem suficientes', () => {
    const r = gerar(curto);
    expect(r.resultadoGeracao?.tipo, 'este perfil passou a caber: escolha outro para a prova').toBe('INCOMPATIVEL');
    const grupos = new Set(todos(r).map((s) => s.exercicio.grupoPrimario));
    // Dispensa mantida…
    expect(grupos.has('core'), 'o core foi restaurado porque o plano seguiu incompatível').toBe(false);
    // …e a redução de séries de braços/ombros também.
    const bracos = todos(r).filter((s) => BRACOS_OMBROS.includes(s.exercicio.grupoPrimario!));
    expect(bracos.length, 'sem braços/ombros no plano: a prova seria vácua').toBeGreaterThan(0);
    expect(bracos.every((s) => s.series === UMA), 'as séries de braços/ombros foram devolvidas').toBe(true);
  });

  it('a duração estimada é DITA, e bate com a medida do dia entregue', () => {
    const r = gerar(curto);
    const aviso = r.avisos.find((a) => a.includes('a estimativa ainda passa do seu tempo'));
    expect(aviso, 'o excesso residual não foi comunicado').toBeTruthy();
    const minutos = Number(/~(\d+) min/.exec(aviso!)?.[1]);
    const pior = Math.max(...(r.duracaoDias ?? []).map((d) => d.duracaoMaximaEstimadaSegundos ?? 0));
    expect(minutos, 'a duração dita não é a medida do plano entregue').toBe(Math.round(pior / 60));
    expect(minutos).toBeGreaterThan(curto.tempoPorSessaoMin);
  });

  it('sem falso certificado', () => {
    expect(gerar(curto).resultadoGeracao?.tipo).toBe('INCOMPATIVEL');
    expect(gerar(curto).duracaoIncompativel).toBe(true);
  });

  it('a comunicação não se repete por exercício nem por dia', () => {
    const r = gerar(perfil({ nivelExperiencia: 'avancado', tempoPorSessaoMin: 20, treinoDias: ['seg', 'ter', 'qui', 'sex'] }));
    for (const marca of ['reduzimos séries em', 'desses exercícios estão com 1 série', 'exercícios repetidos', 'a estimativa ainda passa']) {
      const n = r.avisos.filter((a) => a.includes(marca)).length;
      expect(n, `a mensagem «${marca}» saiu ${n} vezes`).toBeLessThanOrEqual(1);
    }
  });
});

describe('Escopo: 75+ e deload', () => {
  it('75+ explicitamente sem limite não reduz nada', () => {
    const base = perfil({ nivelExperiencia: 'avancado', treinoDias: ['seg'], tempoPorSessaoMin: 75 });
    const semLimite = gerar({ ...base, limiteTempoTreino: 'sem_limite' });
    for (const marca of ['reduzimos séries em', 'desses exercícios estão com 1 série', 'retiramos exercícios complementares']) {
      expect(semLimite.avisos.some((a) => a.includes(marca)), `75+ sofreu ${marca}`).toBe(false);
    }
    // Anti-vacuidade: o MESMO perfil com limite sofre os ajustes.
    const limitado = gerar({ ...base, limiteTempoTreino: 'limitado', tempoPorSessaoMin: 30 });
    expect(limitado.avisos.some((a) => a.includes('reduzimos séries em') || a.includes('desses exercícios estão com 1 série') || a.includes('retiramos exercícios complementares')),
      'o perfil de controle não sofre ajuste: a comparação é vácua').toBe(true);
  });

  it('nenhum aumento involuntário de séries no deload', () => {
    const p = perfil({ nivelExperiencia: 'avancado', treinoDias: ['seg', 'qua', 'sex'], tempoPorSessaoMin: 45 });
    const s5 = gerar(p, 5);
    const s6 = gerar(p, 6);
    const soma = (r: RotinaSemanal) => todos(r).reduce((n, s) => n + (s.series ?? 0), 0);
    expect(soma(s6), 'o deload entregou volume igual ou maior que a semana de rampa').toBeLessThan(soma(s5));
    for (const s of todos(s6)) {
      expect(s.series ?? 0, `${s.exercicio.id} passou de 3 séries no deload`).toBeLessThanOrEqual(TRES);
      expect(s.series ?? 0, `${s.exercicio.id} ficou sem série no deload`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Baseline diante do foco, e duração sobre a ORDEM FINAL', () => {
  /** O baseline do plano com foco = plano com foco menos os extras declarados. */
  const baseline = (r: RotinaSemanal) => {
    const extras = new Map<string, string[]>();
    for (const a of r.blocoFoco?.adicionais ?? []) extras.set(a.diaId ?? '', [...(extras.get(a.diaId ?? '') ?? []), a.exercicioId]);
    return r.dias.map((d) => {
      const resto = [...(extras.get(d.diaId ?? '') ?? [])];
      const fica: SlotExercicio[] = [];
      for (const s of d.slots) {
        const i = resto.indexOf(s.exercicio.id);
        if (i >= 0) { resto.splice(i, 1); continue; }
        fica.push(s);
      }
      return `${d.diaId}{${fica.map((s) => `${s.exercicio.id}:${s.series}`).sort().join(',')}}`;
    }).join(';');
  };

  it('a sequência não sacrifica o baseline para acomodar extras, em tempo limitado', () => {
    let comExtra = 0;
    for (const tempo of [30, 45, 60, 90] as const) {
      for (const g of ['peito', 'costas', 'biceps'] as const) {
        const p = perfil({ nivelExperiencia: 'intermediario', tempoPorSessaoMin: tempo, treinoDias: ['seg', 'qua', 'sex'] });
        const sem = gerar(p);
        const com = gerar({ ...p, foco: { grupo: g, compensa: g === 'peito' ? 'triceps' : 'peito', semana: 1 } });
        expect(baseline(com), `foco ${g} @${tempo} mudou o baseline`).toBe(baseline(sem));
        if ((com.blocoFoco?.adicionais.length ?? 0) > 0) comExtra += 1;
      }
    }
    expect(comExtra, 'nenhum extra foi entregue em regime limitado: a prova é vácua').toBeGreaterThan(0);
  });

  it('a duração publicada é a da ordem ENTREGUE (R-00 revalidado)', () => {
    for (const tempo of [30, 45, 60, 90] as const) {
      const p = perfil({ nivelExperiencia: 'iniciante', tempoPorSessaoMin: tempo, treinoDias: ['seg', 'qui'] });
      const sem = gerar(p);
      const com = gerar({ ...p, foco: { grupo: 'costas', compensa: 'peito', semana: 1 } });
      // O foco nunca piora o veredito de um baseline que cabia.
      if (sem.resultadoGeracao?.tipo === 'CERTIFICADO') {
        expect(com.resultadoGeracao?.tipo, `${tempo} min: o foco derrubou a certificação`).toBe('CERTIFICADO');
      }
      com.dias.forEach((d, i) => {
        const pub = com.duracaoDias?.[i];
        if (pub?.estadoCalculo !== 'CALCULADO') return;
        // Recalcula pela ordem entregue: se a certificação medisse outra ordem, romperia.
        expect(avaliarDuracaoResistida(d.slots, p.nivelExperiencia, tempo * 60, true))
          .toEqual(pub);
      });
    }
  });
});
