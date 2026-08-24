/**
 * 🔒 C1 §8.1 — GATE ESTÁTICO de fonte única (barreira arquitetural comprovável). Prova, por
 * dependência/importação, que:
 *  - gerador (`treino-montador`) e crítico (`critico`) consomem a fórmula canônica de duração;
 *  - o adaptador de plano roteia para `avaliarDuracaoSessao` (não copia a aritmética);
 *  - o construtor semanal e a geração temporal consomem `calcularUsosCardioNaOrigem` / a canônica;
 *  - existe UMA só definição da constante de repetições e UMA só da primitiva de cardio.
 * Igualdade apenas numérica não prova fonte única — este gate prova o CONSUMO da exportação.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { montarRotina } from './treino-montador';
import { avaliarRotinaAutomaticaFinal } from './critico';
import { construirDistribuicaoCardioSemana } from './distribuicao-cardio-semana';
import { prescreverTreino } from './treino';
import { avaliarGateTreino } from './treino-gate';
import { EXERCISES } from '../data/exercises';
import { ORDEM_SEMANA } from '../semana';
import type { PerfilTreino } from './treino-types';
import type { FlagsSaude } from './types';

const ENGINE = join(__dirname);
const ler = (arquivo: string) => readFileSync(join(ENGINE, arquivo), 'utf-8');

describe('C1 §8.1 · fonte única de duração (gerador + crítico convergem)', () => {
  it('o crítico importa a fórmula canônica do dia final', () => {
    const src = ler('critico.ts');
    expect(src).toMatch(/import\s*\{[^}]*avaliarDuracaoFinalDoDia[^}]*\}\s*from\s*['"]\.\/duracao-plano['"]/);
  });

  it('o gerador importa a fórmula canônica e reavalia o plano final', () => {
    const src = ler('treino-montador.ts');
    expect(src).toMatch(/from\s*['"]\.\/duracao-plano['"]/);
    expect(src).toMatch(/from\s*['"]\.\/duracao-sessao['"]/);
    expect(src).toMatch(/certificarDuracao/); // reavaliação do plano final
    expect(src).toMatch(/executarReduceToFit/); // o caminho vivo usa o mesmo orquestrador
    expect(src).not.toMatch(/for\s*\(let\s+b\s*=\s*budgetPorDia/); // sem segundo laço local
  });

  it('o adaptador de plano roteia para a canônica `avaliarDuracaoSessao` (sem aritmética própria)', () => {
    const src = ler('duracao-plano.ts');
    expect(src).toMatch(/import\s*\{[^}]*avaliarDuracaoSessao[^}]*\}\s*from\s*['"]\.\/duracao-sessao['"]/);
  });
});

describe('C1 §8.1 · primitiva única de cardio (avaliador e construtor semanal a consomem)', () => {
  it('o construtor semanal importa `calcularUsosCardioNaOrigem`', () => {
    const src = ler('distribuicao-cardio-semana.ts');
    expect(src).toMatch(/import\s*\{[^}]*calcularUsosCardioNaOrigem[^}]*\}\s*from\s*['"]\.\/cardio-sessao['"]/);
  });

  it('a geração temporal consome a canônica de duração', () => {
    const src = ler('geracao-temporal.ts');
    expect(src).toMatch(/import\s*\{[^}]*avaliarDuracaoSessao[^}]*\}\s*from\s*['"]\.\/duracao-sessao['"]/);
  });
});

describe('C1 §8.1 · uma única definição (proíbe cópia local)', () => {
  const arquivos = [
    'duracao-sessao.ts', 'duracao-plano.ts', 'cardio-sessao.ts', 'distribuicao-cardio-semana.ts',
    'geracao-temporal.ts', 'critico.ts', 'treino-montador.ts',
  ];

  it('há exatamente UMA definição de TEMPO_EXECUCAO_SERIE_REPS_SEG', () => {
    const defs = arquivos.filter((a) => /export const TEMPO_EXECUCAO_SERIE_REPS_SEG/.test(ler(a)));
    expect(defs).toEqual(['duracao-sessao.ts']);
  });

  it('há exatamente UMA definição de calcularUsosCardioNaOrigem', () => {
    const defs = arquivos.filter((a) => /export function calcularUsosCardioNaOrigem/.test(ler(a)));
    expect(defs).toEqual(['cardio-sessao.ts']);
  });

  it('nenhum consumidor recria o fallback proibido `series ?? 1` / `descanso ?? 90` no critério temporal', () => {
    // o fallback 1/90 foi removido do critério temporal (spec §1/§8.4). Guard contra reintrodução.
    for (const a of ['duracao-plano.ts', 'duracao-sessao.ts']) {
      expect(ler(a)).not.toMatch(/\?\?\s*90\b/);
      expect(ler(a)).not.toMatch(/series\s*\?\?\s*1\b/);
    }
  });
});

describe('C1 §8.1 · convergência COMPORTAMENTAL gerador × crítico (mesmo SHA, autor teste 7)', () => {
  const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
  const perfil: PerfilTreino = { pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'emagrecimento', nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 5, tempoPorSessaoMin: 60 };

  it('o CRÍTICO real recompõe independentemente o plano automático FINAL, inclusive cardio', () => {
    const presc = prescreverTreino(perfil, avaliarGateTreino(perfil));
    const rotina = montarRotina(presc, perfil, EXERCISES, new Set(), { semana: 1 }, undefined, new Map(), [0, 4]);
    const avaliacao = avaliarRotinaAutomaticaFinal(rotina, {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 4],
    });
    expect(rotina.planoFinalPorDia?.some((d) => (d.cardio?.duracaoSegundos ?? 0) > 0)).toBe(true);
    expect(avaliacao.convergenciaPlanoFinal?.estado).toBe('CONVERGIU');
    expect(avaliacao.convergenciaPlanoFinal?.motivosEstruturais).toEqual([]);
    expect(avaliacao.convergenciaPlanoFinal?.dias.length).toBe(rotina.planoFinalPorDia?.length);
    expect(avaliacao.convergenciaPlanoFinal?.dias.every((d) => d.converge)).toBe(true);
  });

  it('o crítico detecta um resultado do gerador adulterado em vez de apenas ecoá-lo', () => {
    const presc = prescreverTreino(perfil, avaliarGateTreino(perfil));
    const rotina = montarRotina(presc, perfil, EXERCISES, new Set(), { semana: 1 }, undefined, new Map(), [0, 4]);
    const finais = rotina.planoFinalPorDia ?? [];
    expect(finais.length).toBeGreaterThan(0);
    const adulterada = {
      ...rotina,
      planoFinalPorDia: finais.map((dia, indice) => indice !== 0 ? dia : {
        ...dia,
        duracao: {
          ...dia.duracao,
          duracaoMaximaEstimadaSegundos: (dia.duracao.duracaoMaximaEstimadaSegundos ?? 0) + 1,
        },
      }),
    };
    const avaliacao = avaliarRotinaAutomaticaFinal(adulterada, {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 4],
    });
    expect(avaliacao.convergenciaPlanoFinal?.estado).toBe('DIVERGIU');
    expect(avaliacao.convergenciaPlanoFinal?.dias[0]?.converge).toBe(false);
    expect(avaliacao.avisos).toEqual(avaliarRotinaAutomaticaFinal(rotina, {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 4],
    }).avisos);
  });

  it('o crítico rejeita plano final ausente em vez de convergir por vacuidade', () => {
    const presc = prescreverTreino(perfil, avaliarGateTreino(perfil));
    const rotina = montarRotina(presc, perfil, EXERCISES, new Set(), { semana: 1 }, undefined, new Map(), [0, 4]);
    const avaliacao = avaliarRotinaAutomaticaFinal({ ...rotina, planoFinalPorDia: [] }, {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 4],
    });
    expect(avaliacao.convergenciaPlanoFinal?.estado).toBe('DIVERGIU');
    expect(avaliacao.convergenciaPlanoFinal?.motivosEstruturais).toContainEqual(expect.stringContaining('horizonte final'));
    expect(avaliacao.convergenciaPlanoFinal?.motivosEstruturais).toContainEqual(expect.stringContaining('dia final ausente'));
  });

  it('ancora o horizonte na entrada externa mesmo quando todas as saídas são truncadas juntas', () => {
    const perfilSeteDias = { ...perfil, diasDisponiveis: 7 };
    const presc = prescreverTreino(perfilSeteDias, avaliarGateTreino(perfilSeteDias));
    const rotina = montarRotina(presc, perfilSeteDias, EXERCISES, new Set(), { semana: 1 }, undefined, new Map(), [0, 6]);
    const adulterada = structuredClone(rotina);
    const fatos = adulterada.fatosDistribuicaoCardio!;
    const ordemRemovida = perfilSeteDias.diasDisponiveis - 1;
    const diaIdRemovido = ORDEM_SEMANA[ordemRemovida]!;
    const fatosTruncados = {
      ...fatos,
      diasHorizonte: fatos.diasHorizonte.filter((d) => d.diaId !== diaIdRemovido),
      planosResistidosTerminais: fatos.planosResistidosTerminais.filter((d) => d.diaId !== diaIdRemovido),
      orcamentoPorDia: fatos.orcamentoPorDia.filter((d) => d.diaId !== diaIdRemovido),
      prescricoesCardio: fatos.prescricoesCardio.filter((p) => p.diaOrigemId !== diaIdRemovido),
    };
    adulterada.fatosDistribuicaoCardio = fatosTruncados;
    adulterada.distribuicaoCardio = construirDistribuicaoCardioSemana(fatosTruncados);
    adulterada.planoFinalPorDia = adulterada.planoFinalPorDia?.filter((d) => d.diaId !== diaIdRemovido);
    adulterada.diasCardio = adulterada.planoFinalPorDia?.flatMap((d) => d.cardio ? [d.cardio] : []) ?? [];
    adulterada.diasCardioRecuperacao = Math.max(0, ordemRemovida - adulterada.diasForcaAgendados);

    const avaliacao = avaliarRotinaAutomaticaFinal(adulterada, {
      nivel: perfilSeteDias.nivelExperiencia, objetivo: perfilSeteDias.objetivo,
      tempoPorSessaoMin: perfilSeteDias.tempoPorSessaoMin,
      seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 6],
    });
    expect(avaliacao.convergenciaPlanoFinal?.estado).toBe('DIVERGIU');
    expect(avaliacao.convergenciaPlanoFinal?.motivosEstruturais.join(' ')).toMatch(/entrada externa|horizonte final|dia final ausente/);
  });

  it('ancora a oferta de cardio na entrada externa mesmo quando toda a saída omite a oferta coerentemente', () => {
    const presc = prescreverTreino(perfil, avaliarGateTreino(perfil));
    const rotinaSemOferta = montarRotina(
      presc, perfil, EXERCISES, new Set(), { semana: 1 }, undefined, new Map(), [],
    );
    const avaliacao = avaliarRotinaAutomaticaFinal(rotinaSemOferta, {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 4],
    });
    expect(avaliacao.convergenciaPlanoFinal?.estado).toBe('DIVERGIU');
    expect(avaliacao.convergenciaPlanoFinal?.motivosEstruturais.join(' ')).toMatch(/oferta de cardio.*entrada externa/);
  });

  it('ancora treino_idx à ordem canônica e rejeita permutação autoconsistente', () => {
    const presc = prescreverTreino(perfil, avaliarGateTreino(perfil));
    const rotina = montarRotina(presc, perfil, EXERCISES, new Set(), { semana: 1 }, undefined, new Map(), [0, 4]);
    const adulterada = structuredClone(rotina);
    const a = adulterada.planoFinalPorDia?.find((d) => d.treinoIdx === 0);
    const b = adulterada.planoFinalPorDia?.find((d) => d.treinoIdx === 1);
    expect(a && b).toBeTruthy();
    a!.treinoIdx = 1;
    b!.treinoIdx = 0;
    const avaliacao = avaliarRotinaAutomaticaFinal(adulterada, {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 4],
    });
    expect(avaliacao.convergenciaPlanoFinal?.estado).toBe('DIVERGIU');
    expect(avaliacao.convergenciaPlanoFinal?.motivosEstruturais.join(' ')).toMatch(/treino_idx divergente/);
  });

  it.each([-1, 0.5])('rejeita duração de cardio fora do domínio (%s)', (duracaoInvalida) => {
    const presc = prescreverTreino(perfil, avaliarGateTreino(perfil));
    const rotina = montarRotina(presc, perfil, EXERCISES, new Set(), { semana: 1 }, undefined, new Map(), [0, 4]);
    const adulterada = structuredClone(rotina);
    const dia = adulterada.planoFinalPorDia?.find((d) => d.cardio);
    expect(dia?.cardio).toBeTruthy();
    dia!.cardio!.duracaoSegundos = duracaoInvalida;
    const avaliacao = avaliarRotinaAutomaticaFinal(adulterada, {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 4],
    });
    expect(avaliacao.convergenciaPlanoFinal?.estado).toBe('DIVERGIU');
    expect(avaliacao.convergenciaPlanoFinal?.motivosEstruturais.join(' ')).toMatch(/duração de cardio inválida/);
  });

  it('rejeita minutos de cardio que não projetam a duração exata do bloco', () => {
    const presc = prescreverTreino(perfil, avaliarGateTreino(perfil));
    const adulterada = structuredClone(montarRotina(presc, perfil, EXERCISES, new Set(), { semana: 1 }, undefined, new Map(), [0, 4]));
    const dia = adulterada.planoFinalPorDia?.find((d) => d.cardio?.duracaoSegundos != null);
    expect(dia?.cardio).toBeTruthy();
    dia!.cardio!.minutos = 999;
    const avaliacao = avaliarRotinaAutomaticaFinal(adulterada, {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 4],
    });
    expect(avaliacao.convergenciaPlanoFinal?.estado).toBe('DIVERGIU');
    expect(avaliacao.convergenciaPlanoFinal?.motivosEstruturais.join(' ')).toMatch(/minutos de cardio/);
  });

  it('rejeita vistas de compatibilidade adulteradas apesar do plano final intacto', () => {
    const presc = prescreverTreino(perfil, avaliarGateTreino(perfil));
    const original = montarRotina(presc, perfil, EXERCISES, new Set(), { semana: 1 }, undefined, new Map(), [0, 4]);
    const adulterada = structuredClone(original);
    adulterada.diasCardio[0] = { ...adulterada.diasCardio[0]!, minutos: 999 };
    adulterada.duracaoDias![0] = {
      ...adulterada.duracaoDias![0]!,
      duracaoMaximaEstimadaSegundos: (adulterada.duracaoDias![0]!.duracaoMaximaEstimadaSegundos ?? 0) + 1,
    };
    adulterada.duracaoResistidaDias![0] = {
      ...adulterada.duracaoResistidaDias![0]!,
      duracaoMaximaEstimadaSegundos: (adulterada.duracaoResistidaDias![0]!.duracaoMaximaEstimadaSegundos ?? 0) + 1,
    };
    const avaliacao = avaliarRotinaAutomaticaFinal(adulterada, {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 4],
    });
    expect(avaliacao.convergenciaPlanoFinal?.estado).toBe('DIVERGIU');
    expect(avaliacao.convergenciaPlanoFinal?.motivosEstruturais.join(' ')).toMatch(/diasCardio|duracaoDias|duracaoResistidaDias/);
  });

  it('reconstrói a distribuição: dia/bloco perdido não converge mesmo com contador adulterado', () => {
    const presc = prescreverTreino(perfil, avaliarGateTreino(perfil));
    const rotina = montarRotina(presc, perfil, EXERCISES, new Set(), { semana: 1 }, undefined, new Map(), [0, 4]);
    const adulterada = structuredClone(rotina);
    const puro = adulterada.planoFinalPorDia?.find((d) => d.tipo === 'CARDIO');
    expect(puro).toBeTruthy();
    adulterada.planoFinalPorDia = adulterada.planoFinalPorDia?.filter((d) => d.diaId !== puro!.diaId);
    adulterada.diasCardioRecuperacao -= 1;
    const avaliacao = avaliarRotinaAutomaticaFinal(adulterada, {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 4],
    });
    expect(avaliacao.convergenciaPlanoFinal?.estado).toBe('DIVERGIU');
    expect(avaliacao.convergenciaPlanoFinal?.motivosEstruturais.join(' ')).toMatch(/recuperação divergentes|horizonte final|bloco canônico fora/);
  });

  it('rejeita distribuição observada ou plano misto divergente dos fatos independentes', () => {
    const presc = prescreverTreino(perfil, avaliarGateTreino(perfil));
    const rotina = montarRotina(presc, perfil, EXERCISES, new Set(), { semana: 1 }, undefined, new Map(), [0, 4]);
    const distAdulterada = structuredClone(rotina);
    distAdulterada.distribuicaoCardio!.contratosPorPrescricao[0]!.duracaoDescartadaSegundos += 1;
    const a = avaliarRotinaAutomaticaFinal(distAdulterada, {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 4],
    });
    expect(a.convergenciaPlanoFinal?.estado).toBe('DIVERGIU');
    expect(a.convergenciaPlanoFinal?.motivosEstruturais.join(' ')).toMatch(/distribuição inválida/);

    const finalAdulterado = structuredClone(rotina);
    const misto = finalAdulterado.planoFinalPorDia?.find((d) => d.tipo === 'TREINO_E_CARDIO');
    expect(misto?.cardio).toBeTruthy();
    delete misto!.cardio!.duracaoSegundos;
    const b = avaliarRotinaAutomaticaFinal(finalAdulterado, {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 4],
    });
    expect(b.convergenciaPlanoFinal?.estado).toBe('DIVERGIU');
    expect(b.convergenciaPlanoFinal?.motivosEstruturais.join(' ')).toMatch(/duração de cardio inválida|diverge do bloco/);
  });

  it('não confia nos fatos derivados publicados: recompõe MAX resistida a partir dos slots', () => {
    const presc = prescreverTreino(perfil, avaliarGateTreino(perfil));
    const rotina = montarRotina(presc, perfil, EXERCISES, new Set(), { semana: 1 }, undefined, new Map(), [0, 4]);
    const adulterada = structuredClone(rotina);
    adulterada.fatosDistribuicaoCardio!.planosResistidosTerminais[0]!.maxResistidaSegundos! += 1;
    const avaliacao = avaliarRotinaAutomaticaFinal(adulterada, {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [0, 4],
    });
    expect(avaliacao.convergenciaPlanoFinal?.estado).toBe('DIVERGIU');
    expect(avaliacao.convergenciaPlanoFinal?.motivosEstruturais.join(' ')).toMatch(/fatos publicados divergem/);
  });

  it('gerador e crítico convergem em NAO_AVALIADO quando o cardio qualitativo não tem duração', () => {
    const perfilMassa = { ...perfil, objetivo: 'massa' as const, diasDisponiveis: 6 };
    const presc = prescreverTreino(perfilMassa, avaliarGateTreino(perfilMassa));
    const rotina = montarRotina(presc, perfilMassa, EXERCISES, new Set(), { semana: 1 }, undefined, new Map(), [4, 5]);
    const avaliacao = avaliarRotinaAutomaticaFinal(rotina, {
      nivel: perfilMassa.nivelExperiencia, objetivo: perfilMassa.objetivo,
      tempoPorSessaoMin: perfilMassa.tempoPorSessaoMin, seriesPadrao: presc.seriesPorExercicio.min,
      diasNoHorizonteEsperado: 7,
      diasOferecidosCardioEsperados: [4, 5],
    });
    expect(rotina.resultadoGeracao?.tipo).toBe('NAO_AVALIADO_ENTREGAVEL');
    expect(rotina.planoFinalPorDia?.filter((d) => d.cardio).every((d) =>
      d.duracao.estadoCalculo === 'NAO_AVALIADO')).toBe(true);
    expect(avaliacao.convergenciaPlanoFinal?.estado).toBe('CONVERGIU');
    expect(avaliacao.convergenciaPlanoFinal?.dias.filter((d) =>
      d.critico.estadoCalculo === 'NAO_AVALIADO')).toHaveLength(2);
  });
});
