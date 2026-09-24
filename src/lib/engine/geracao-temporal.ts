/**
 * 🔒 C1 — RESULTADO DA GERAÇÃO TEMPORAL + taxonomia do alocador + reduce-to-fit (spec §5/§6, §8).
 *
 * Orquestra o ajuste do plano automático quando a musculação não cabe no tempo (o cardio nunca
 * entra nesta conta — decisão de 2026-09-23): degrada descansos e, por fim, REDUZ a quantidade de exercícios reexecutando o alocador INTEIRO —
 * exatamente uma unidade de capacidade por tentativa, reiniciando a escada de descanso no nível
 * original a cada nova capacidade. Puro/determinístico.
 *
 * Precedência OBRIGATÓRIA por tentativa (spec §6, discrimina exatamente UM motivo, o primeiro):
 *   (1) rejeitar CAPACIDADE_REPETIDA antes de chamar/reusar o alocador;
 *   (2) validar CARDINALIDADE da resposta (recebida > solicitada);
 *   (3) validar os três INVARIANTES (cobertura, equipamento, puxar >= empurrar);
 *   (4) só então avaliar DURAÇÃO.
 *
 * Terminais: CERTIFICADO (cabe), NAO_AVALIADO_ENTREGAVEL (realocação virou NAO_AVALIADO — para o
 * laço, entrega com motivos, sem nova redução/incompatibilidade), ERRO_ALOCADOR (invariante/
 * capacidade repetida/cardinalidade), INCOMPATIVEL (menor plano com cobertura ainda excede).
 */
import {
  avaliarDuracaoSessao,
  type AplicacaoTecnica,
  type ExecucaoResistida,
  type ItemDuracao,
  type ResultadoDuracao,
  type TecnicaTemporal,
} from './duracao-sessao';

export type Padrao = 'puxar' | 'empurrar' | 'agachar' | 'isolado' | 'core' | 'potencia';

/** Item resistido do plano, com a classificação necessária aos três invariantes. */
export interface ItemPlanoTemporal {
  /** Dia real do horizonte semanal. Frequência é presença em dias distintos, nunca nº de slots. */
  diaId: string;
  id: string;
  padrao: Padrao;
  grupo: string;
  equipamento: string;
  series: number;
  descansoSeg: number;
  execucao: ExecucaoResistida;
  unilateralDoisLados?: boolean;
  tecnica?: TecnicaTemporal;
  tecnicasMaterializadas?: readonly AplicacaoTecnica[];
}

export interface InvariantesTreino {
  /** Padrões que DEVEM estar cobertos (ex.: ['puxar','empurrar','agachar']). */
  coberturaObrigatoria: readonly Padrao[];
  /** Allowlist de equipamentos disponíveis. */
  equipamentosDisponiveis: readonly string[];
}

export interface ResultadoInvariantes {
  ok: boolean;
  violacoes: string[];
}

/** Avalia os três invariantes: cobertura, equipamento e `puxar >= empurrar`. */
export function avaliarInvariantes(plano: readonly ItemPlanoTemporal[], inv: InvariantesTreino): ResultadoInvariantes {
  const violacoes: string[] = [];
  const padroes = new Set(plano.map((i) => i.padrao));
  for (const p of inv.coberturaObrigatoria) {
    if (!padroes.has(p)) violacoes.push(`cobertura ausente: ${p}`);
  }
  const permitidos = new Set(inv.equipamentosDisponiveis);
  for (const i of plano) {
    if (!permitidos.has(i.equipamento)) violacoes.push(`equipamento fora da allowlist: ${i.id} (${i.equipamento})`);
  }
  const puxar = plano.filter((i) => i.padrao === 'puxar').length;
  const empurrar = plano.filter((i) => i.padrao === 'empurrar').length;
  if (puxar < empurrar) violacoes.push(`puxar (${puxar}) < empurrar (${empurrar})`);
  return { ok: violacoes.length === 0, violacoes };
}

/** Converte o plano em itens de duração canônicos e avalia. */
export function avaliarDuracaoDoPlano(plano: readonly ItemPlanoTemporal[], orcamentoSegundos: number | undefined): ResultadoDuracao {
  const itens: ItemDuracao[] = plano.map((i) => ({
    tipo: 'RESISTIDO',
    series: i.series,
    descansoEntreSeriesSeg: i.descansoSeg,
    execucao: i.execucao,
    unilateralDoisLados: i.unilateralDoisLados,
    tecnica: i.tecnica ?? { tipo: 'SEM_TECNICA' },
    tecnicasMaterializadas: i.tecnicasMaterializadas,
  }));
  return avaliarDuracaoSessao({ itens, orcamentoSegundos });
}

export type MotivoErroAlocador = 'INVARIANTE_VIOLADO' | 'CAPACIDADE_REPETIDA' | 'CARDINALIDADE_ACIMA_DA_CAPACIDADE';

/** Resultado de UMA tentativa (a precedência é resolvida aqui). */
export type Tentativa =
  | { tipo: 'ERRO_ALOCADOR'; motivo: MotivoErroAlocador; capacidadeTestada: number; violacoesInvariantes?: string[]; cardinalidadeRecebida?: number }
  | { tipo: 'CERTIFICADO'; resultadoDuracao: ResultadoDuracao }
  | { tipo: 'NAO_AVALIADO'; resultadoDuracao: ResultadoDuracao }
  | { tipo: 'EXCEDE'; resultadoDuracao: ResultadoDuracao };

/**
 * 🔒 PRECEDÊNCIA por tentativa. `capacidadesJaTestadas` já NÃO deve conter a capacidade atual quando
 * o alocador vai ser (re)chamado; se contiver, é CAPACIDADE_REPETIDA (o primeiro gate, antes de tudo).
 * O payload carrega SOMENTE os detalhes do primeiro motivo aplicável.
 */
export function classificarTentativa(params: {
  capacidadeTestada: number;
  capacidadesJaTestadas: ReadonlySet<number>;
  plano: readonly ItemPlanoTemporal[];
  invariantes: InvariantesTreino;
  orcamentoSegundos: number | undefined;
}): Tentativa {
  const { capacidadeTestada: cap, capacidadesJaTestadas, plano, invariantes, orcamentoSegundos } = params;

  // (1) capacidade repetida — antes de chamar/reusar o alocador.
  if (capacidadesJaTestadas.has(cap)) {
    return { tipo: 'ERRO_ALOCADOR', motivo: 'CAPACIDADE_REPETIDA', capacidadeTestada: cap };
  }
  // (2) cardinalidade da resposta.
  if (plano.length > cap) {
    return { tipo: 'ERRO_ALOCADOR', motivo: 'CARDINALIDADE_ACIMA_DA_CAPACIDADE', capacidadeTestada: cap, cardinalidadeRecebida: plano.length };
  }
  // (3) invariantes (cobertura, equipamento, puxar >= empurrar).
  const inv = avaliarInvariantes(plano, invariantes);
  if (!inv.ok) {
    return { tipo: 'ERRO_ALOCADOR', motivo: 'INVARIANTE_VIOLADO', capacidadeTestada: cap, violacoesInvariantes: inv.violacoes };
  }
  // (4) duração.
  const resultadoDuracao = avaliarDuracaoDoPlano(plano, orcamentoSegundos);
  if (resultadoDuracao.estadoCalculo === 'NAO_AVALIADO') return { tipo: 'NAO_AVALIADO', resultadoDuracao };
  const cabe = resultadoDuracao.estadoLimite === 'DENTRO_DO_LIMITE' || resultadoDuracao.estadoLimite === 'DENTRO_DA_TOLERANCIA';
  return cabe ? { tipo: 'CERTIFICADO', resultadoDuracao } : { tipo: 'EXCEDE', resultadoDuracao };
}

// ── Reduce-to-fit ponta a ponta ──────────────────────────────────────────────────────────────
export type PlanoAlocado =
  | { tipo: 'PLANO'; itens: ItemPlanoTemporal[] }
  /** O alocador declara que não há plano MENOR preservando os três invariantes. */
  | { tipo: 'SEM_PLANO_MENOR' };

/**
 * Alocador injetado: dada a capacidade e o nível de descanso (0 = original; crescente = degradado),
 * devolve um plano ou declara que não existe plano menor com cobertura. O nível reinicia em 0 a cada
 * nova capacidade (a escada NÃO herda o descanso degradado da capacidade anterior).
 */
export type Alocador = (capacidade: number, nivelDescanso: number) => PlanoAlocado;

/** Plano genérico usado pelo único laço reduce-to-fit, compartilhado pelo fixture e pelo montador vivo. */
export type PlanoAlocadoGenerico<TPlano> =
  | { tipo: 'PLANO'; plano: TPlano }
  | { tipo: 'SEM_PLANO_MENOR' };

export type ClassificacaoReduceToFit<TResult> =
  | { tipo: 'CERTIFICADO'; resultado: TResult }
  | { tipo: 'NAO_AVALIADO'; resultado: TResult }
  | { tipo: 'EXCEDE'; resultado: TResult }
  | { tipo: 'ERRO_ALOCADOR'; motivo: MotivoErroAlocador; violacoesInvariantes?: string[] };

export type ResultadoReduceToFit<TPlano, TResult> =
  | { tipo: 'CERTIFICADO'; planoTerminal: TPlano; resultado: TResult; capacidadeTerminal: number }
  | { tipo: 'NAO_AVALIADO_ENTREGAVEL'; planoTerminal: TPlano; resultado: TResult; capacidadeTerminal: number }
  | { tipo: 'ERRO_ALOCADOR'; motivo: MotivoErroAlocador; capacidadeTestada: number; planoTerminal?: TPlano; violacoesInvariantes?: string[]; cardinalidadeRecebida?: number }
  | {
      tipo: 'INCOMPATIVEL';
      /** Último plano que preservou os invariantes e excedeu; ausente só se o alocador nunca o produziu. */
      planoTerminal?: TPlano;
      resultado?: TResult;
      capacidadeMinimaTestada: number;
      invariantesPreservados: true;
    };

/**
 * 🔒 ÚNICO LAÇO reduce-to-fit. A cardinalidade é injetada porque a capacidade do montador vivo é
 * `máximo de slots em um dia`, enquanto a fixture plana usa `itens.length`.
 */
export function executarReduceToFit<TPlano, TResult>(params: {
  capacidadeInicial: number;
  capacidadeMinima: number;
  niveisDescanso: number;
  alocar: (capacidade: number, nivelDescanso: number) => PlanoAlocadoGenerico<TPlano>;
  cardinalidade: (plano: TPlano) => number;
  classificar: (plano: TPlano, capacidade: number) => ClassificacaoReduceToFit<TResult>;
}): ResultadoReduceToFit<TPlano, TResult> {
  const { capacidadeInicial, capacidadeMinima, niveisDescanso, alocar, cardinalidade, classificar } = params;
  const testadas = new Set<number>();
  let ultimoExcede: { plano: TPlano; resultado: TResult; capacidade: number } | null = null;

  for (let capacidade = capacidadeInicial; capacidade >= capacidadeMinima; capacidade -= 1) {
    // (1) capacidade repetida — antes de chamar/reusar o alocador.
    if (testadas.has(capacidade)) {
      return { tipo: 'ERRO_ALOCADOR', motivo: 'CAPACIDADE_REPETIDA', capacidadeTestada: capacidade };
    }
    testadas.add(capacidade);

    for (let nivel = 0; nivel < niveisDescanso; nivel += 1) {
      const alocado = alocar(capacidade, nivel);
      if (alocado.tipo === 'SEM_PLANO_MENOR') {
        return {
          tipo: 'INCOMPATIVEL',
          ...(ultimoExcede ? { planoTerminal: ultimoExcede.plano, resultado: ultimoExcede.resultado } : {}),
          capacidadeMinimaTestada: ultimoExcede?.capacidade ?? capacidade + 1,
          invariantesPreservados: true,
        };
      }

      // (2) cardinalidade antes de qualquer invariante/duração.
      const recebida = cardinalidade(alocado.plano);
      if (recebida > capacidade) {
        return {
          tipo: 'ERRO_ALOCADOR', motivo: 'CARDINALIDADE_ACIMA_DA_CAPACIDADE',
          capacidadeTestada: capacidade, planoTerminal: alocado.plano, cardinalidadeRecebida: recebida,
        };
      }

      // (3) invariantes e (4) duração são classificados pelo adaptador do produtor.
      const tentativa = classificar(alocado.plano, capacidade);
      if (tentativa.tipo === 'ERRO_ALOCADOR') {
        return {
          tipo: 'ERRO_ALOCADOR', motivo: tentativa.motivo, capacidadeTestada: capacidade,
          planoTerminal: alocado.plano,
          ...(tentativa.violacoesInvariantes ? { violacoesInvariantes: tentativa.violacoesInvariantes } : {}),
        };
      }
      if (tentativa.tipo === 'CERTIFICADO') {
        return { tipo: 'CERTIFICADO', planoTerminal: alocado.plano, resultado: tentativa.resultado, capacidadeTerminal: capacidade };
      }
      if (tentativa.tipo === 'NAO_AVALIADO') {
        return { tipo: 'NAO_AVALIADO_ENTREGAVEL', planoTerminal: alocado.plano, resultado: tentativa.resultado, capacidadeTerminal: capacidade };
      }
      ultimoExcede = { plano: alocado.plano, resultado: tentativa.resultado, capacidade };
    }
  }

  return {
    tipo: 'INCOMPATIVEL',
    ...(ultimoExcede ? { planoTerminal: ultimoExcede.plano, resultado: ultimoExcede.resultado } : {}),
    capacidadeMinimaTestada: ultimoExcede?.capacidade ?? capacidadeMinima,
    invariantesPreservados: true,
  };
}

export type ResultadoGeracaoTemporal =
  | { tipo: 'CERTIFICADO'; planoTerminal: ItemPlanoTemporal[]; resultadoDuracao: ResultadoDuracao; capacidadeTerminal: number }
  | { tipo: 'NAO_AVALIADO_ENTREGAVEL'; planoTerminal: ItemPlanoTemporal[]; resultadoDuracao: ResultadoDuracao; capacidadeTerminal: number }
  | { tipo: 'ERRO_ALOCADOR'; motivo: MotivoErroAlocador; capacidadeTestada: number; violacoesInvariantes?: string[]; cardinalidadeRecebida?: number }
  | { tipo: 'INCOMPATIVEL'; resultadoDuracao: ResultadoDuracao; capacidadeMinimaTestada: number; invariantesPreservados: true };

/**
 * 🔒 Laço reduce-to-fit. Capacidade decresce EXATAMENTE 1 por tentativa (nunca salta, nunca apaga o
 * último slot). A cada capacidade, a escada de descanso reinicia no nível 0. Termina em CERTIFICADO,
 * NAO_AVALIADO_ENTREGAVEL, ERRO_ALOCADOR ou INCOMPATIVEL.
 */
export function gerarPlanoTemporal(params: {
  capacidadeInicial: number;
  niveisDescanso: number; // quantos níveis a escada tenta (>= 1)
  alocar: Alocador;
  invariantes: InvariantesTreino;
  orcamentoSegundos: number | undefined;
}): ResultadoGeracaoTemporal {
  const { capacidadeInicial, niveisDescanso, alocar, invariantes, orcamentoSegundos } = params;
  const resultado = executarReduceToFit<ItemPlanoTemporal[], ResultadoDuracao>({
    capacidadeInicial,
    capacidadeMinima: 0,
    niveisDescanso,
    alocar: (capacidade, nivel) => {
      const r = alocar(capacidade, nivel);
      return r.tipo === 'PLANO' ? { tipo: 'PLANO', plano: r.itens } : r;
    },
    cardinalidade: (plano) => plano.length,
    classificar: (plano, capacidade) => {
      const t = classificarTentativa({
        capacidadeTestada: capacidade,
        capacidadesJaTestadas: new Set(),
        plano,
        invariantes,
        orcamentoSegundos,
      });
      if (t.tipo === 'ERRO_ALOCADOR') return t;
      if (t.tipo === 'CERTIFICADO') return { tipo: 'CERTIFICADO', resultado: t.resultadoDuracao };
      if (t.tipo === 'NAO_AVALIADO') return { tipo: 'NAO_AVALIADO', resultado: t.resultadoDuracao };
      return { tipo: 'EXCEDE', resultado: t.resultadoDuracao };
    },
  });

  if (resultado.tipo === 'CERTIFICADO') {
    return { tipo: 'CERTIFICADO', planoTerminal: resultado.planoTerminal, resultadoDuracao: resultado.resultado, capacidadeTerminal: resultado.capacidadeTerminal };
  }
  if (resultado.tipo === 'NAO_AVALIADO_ENTREGAVEL') {
    return { tipo: 'NAO_AVALIADO_ENTREGAVEL', planoTerminal: resultado.planoTerminal, resultadoDuracao: resultado.resultado, capacidadeTerminal: resultado.capacidadeTerminal };
  }
  if (resultado.tipo === 'ERRO_ALOCADOR') return resultado;
  return {
    tipo: 'INCOMPATIVEL',
    resultadoDuracao: resultado.resultado ?? avaliarDuracaoDoPlano([], orcamentoSegundos),
    capacidadeMinimaTestada: resultado.capacidadeMinimaTestada,
    invariantesPreservados: true,
  };
}

// ── Fatos baseline × terminal (spec §6.10; C2/C3 decidem a política) ──────────────────────────
export interface FatosReducao {
  slotsAntes: number;
  slotsDepois: number;
  itensRemovidos: string[];
  /** Volume bruto por grupo (itens e séries) antes e depois — reutiliza contagem, não inventa métrica. */
  volumePorGrupo: Record<string, { itensAntes: number; itensDepois: number; seriesAntes: number; seriesDepois: number }>;
  /** Frequência direta por grupo = nº de DIAS distintos com presença direta antes/depois. */
  frequenciaDiretaPorGrupo: Record<string, { antes: number; depois: number }>;
}

/** Congela baseline × terminal e registra apenas FATOS (sem política). */
export function fatosReducao(baseline: readonly ItemPlanoTemporal[], terminal: readonly ItemPlanoTemporal[]): FatosReducao {
  const grupos = new Set<string>([...baseline, ...terminal].map((i) => i.grupo));
  const volumePorGrupo: FatosReducao['volumePorGrupo'] = {};
  const frequenciaDiretaPorGrupo: FatosReducao['frequenciaDiretaPorGrupo'] = {};
  for (const g of grupos) {
    const ba = baseline.filter((i) => i.grupo === g);
    const te = terminal.filter((i) => i.grupo === g);
    volumePorGrupo[g] = {
      itensAntes: ba.length,
      itensDepois: te.length,
      seriesAntes: ba.reduce((s, i) => s + i.series, 0),
      seriesDepois: te.reduce((s, i) => s + i.series, 0),
    };
    frequenciaDiretaPorGrupo[g] = {
      antes: new Set(ba.map((i) => i.diaId)).size,
      depois: new Set(te.map((i) => i.diaId)).size,
    };
  }
  const idsTerminal = new Set(terminal.map((i) => i.id));
  return {
    slotsAntes: baseline.length,
    slotsDepois: terminal.length,
    itensRemovidos: baseline.filter((i) => !idsTerminal.has(i.id)).map((i) => i.id),
    volumePorGrupo,
    frequenciaDiretaPorGrupo,
  };
}
