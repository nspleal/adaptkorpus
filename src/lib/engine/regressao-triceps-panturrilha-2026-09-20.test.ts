/** Regressões dos resíduos do PR18: tríceps redundante e panturrilha omitida.
 * Preserva a fixture aproximada e verifica os limites atuais; fotografias de dose
 * anteriores à estabilidade do ciclo não substituem os tetos por sessão.
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { creditoPonderadoDaSemana } from './alocador';
import { ehImprovisoDomestico } from './equipamento';
import { ehComplementar, ehDiaDePernas } from './selecao-referencia';
import { diretosDoExercicio } from './cobertura-anatomica';
import { avaliarDuracaoResistida } from './duracao-plano';
import { GRUPOS_COM_FAIXA_SEMANAL } from './grupos-volume';
import { tetoSemanalDoGrupo, tetoSeriesGrupoNaSessao, tetoSeriesPorExercicio } from './trilhos';
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

  it('não acrescenta um quinto tríceps redundante para acomodar dose acima do teto', () => {
    // 14 séries com teto de 4 por exercício exigem 4 exercícios; o quinto só carregava dose.
    const ts = doGrupo(bracos, 'triceps');
    expect(ts.length, ts.map((s) => `${s.exercicio.id}x${s.series}`).join(' ')).toBeLessThanOrEqual(4);
    // Quatro funções/alvos podem justificar quatro slots mesmo após reduzir a dose.
    expect(ts.length).toBeGreaterThan(0);
    for (const slot of ts) expect(slot.series).toBeGreaterThanOrEqual(1);
  });

  it('o teto aprovado limita a dose, preservando os três alvos do tríceps', () => {
    // A fotografia antiga de 14 diretas excede o teto de sessão aprovado (12).
    expect(serie(bracos, 'triceps')).toBe(tetoSeriesGrupoNaSessao('intermediario','massa'));
    expect(creditoPonderadoDaSemana(bracos.slots).get('triceps')).toBeLessThanOrEqual(tetoSeriesGrupoNaSessao('intermediario','massa'));
    for (const a of ['tl', 'tt', 'tm']) expect(alvosDe(bracos, 'triceps').has(a), a).toBe(true);
  });

  it('nenhum exercício passa do teto por exercício do nível', () => {
    for (const d of r.dias) for (const s of d.slots)
      expect(s.series ?? 0, `${d.nome}/${s.exercicio.id}`).toBeLessThanOrEqual(tetoSeriesPorExercicio('intermediario'));
  });

  it('não anuncia consolidação inexistente e informa a recusa do extra', () => {
    expect(r.blocoFoco?.consolidados ?? []).toEqual([]);
    expect(r.avisos.some(a => /extra do foco coube nos exercícios que o dia já tinha/.test(a))).toBe(false);
    expect(r.avisos.some(a => /máximo|limites/.test(a))).toBe(true);
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

  it('panturrilha não consome crédito dos principais; posterior respeita o teto com indiretos', () => {
    // A estabilidade S1–S5 mantém e58, que credita 2 séries indiretas de posterior.
    // Exigir 12 diretas nesta composição daria 14 ponderadas, acima do teto de 12.
    // A fotografia antiga dependia da troca e58→e153, agora proibida dentro do ciclo.
    const c = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
    for (const [g, n] of [['peito', 15], ['costas', 14], ['ombros', 13.5], ['quadriceps', 12],
      ['posterior', 12], ['gluteos', 10]] as const)
      expect(c.get(g) ?? 0, g).toBeGreaterThanOrEqual(n);
    expect(serie(pernas, 'quadriceps')).toBe(12);
    const semPanturrilha = pernas.slots.filter(s => s.exercicio.grupoPrimario !== 'panturrilha');
    const creditosSemPanturrilha = creditoPonderadoDaSemana(semPanturrilha);
    const creditosComPanturrilha = creditoPonderadoDaSemana(pernas.slots);
    for (const g of ['quadriceps', 'posterior', 'gluteos'] as const)
      expect(creditosComPanturrilha.get(g), g).toBe(creditosSemPanturrilha.get(g));
    expect(serie(pernas, 'posterior')).toBe(10);
    expect(creditosComPanturrilha.get('posterior')).toBe(12);
    expect(pernas.slots.find(s => s.exercicio.id === 'e58')?.series).toBe(4);
    const restaurado = pernas.slots.map(s => s.exercicio.id === 'e65' ? { ...s, series: 4 } : s);
    expect(creditoPonderadoDaSemana(restaurado).get('posterior')).toBeGreaterThan(tetoSeriesGrupoNaSessao('intermediario', 'massa'));
  });

  it('a redução autorizada preserva exercícios e respeita os tetos por sessão', () => {
    for (const d of r.dias) {
      for (const s of d.slots) expect(s.series).toBeGreaterThanOrEqual(1);
      for (const [g,n] of creditoPonderadoDaSemana(d.slots))
        expect(n, `${d.nome}/${g}`).toBeLessThanOrEqual(tetoSeriesGrupoNaSessao('intermediario','massa'));
    }
  });

  it('nenhum improviso doméstico sobra num plano de ACADEMIA', () => {
    const improvisos = r.dias.flatMap((d) => d.slots.filter((s) => ehImprovisoDomestico(s.exercicio)));
    expect(improvisos.map((s) => s.exercicio.nomePt), 'improviso de casa num treino de academia').toEqual([]);
  });

  it('panturrilha soma ao baseline principal, sem quota artificial de slots', () => {
    expect(pernas.slots.filter(s => !ehComplementar(s.exercicio.grupoPrimario))).toHaveLength(8);
    expect(pernas.slots.filter(s => ehComplementar(s.exercicio.grupoPrimario))).toHaveLength(1);
    expect(pernas.slots.filter(s => s.extraDoFoco)).toHaveLength(0);
    for (const d of r.dias) expect(avaliarDuracaoResistida(d.slots,'intermediario').estadoCalculo).toBe('CALCULADO');
  });

  it('nenhum grupo passa do teto semanal cheio', () => {
    const c = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
    const t=r.tetoVolumeSemana!;
    const teto=tetoSemanalDoGrupo({nivel:'intermediario',objetivo:'massa',emFoco:t.gruposEmFoco,tetoDaFase:t.cheio});
    for (const g of GRUPOS_COM_FAIXA_SEMANAL) expect(c.get(g) ?? 0, g).toBeLessThanOrEqual(teto(g));
  });
});

describe('limites reais de tempo e distribuição, sem quota rígida de slots (decisão posterior de 20/09)', () => {
  it('tempo limitado: toda sessão certificada cabe pela duração canônica', () => {
    for (const tempo of [30,45,60,75]) {
      const r=montar(perfil({divisaoPreferida:'prioridades',tempoPorSessaoMin:tempo,limiteTempoTreino:'limitado',variacaoTreino:1}));
      expect(r.resultadoGeracao?.tipo).toBe('CERTIFICADO');
      for (const d of r.dias) {
        const m=avaliarDuracaoResistida(d.slots,'intermediario');
        expect(m.estadoCalculo).toBe('CALCULADO');
        expect(m.duracaoMaximaEstimadaSegundos).toBeLessThanOrEqual(tempo*60);
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
