'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Exercise, GrupoPrimario } from '@/lib/data/types';
import type { DiaTreino, NivelExperiencia, Objetivo, RotinaCustom } from '@/lib/engine';
import type { Faixa, FaseVolume, FatoCoberturaGrupo, FatoInvariantePadrao, RotinaSemanal } from '@/lib/engine/treino-types';
import { avaliarSemana, type Avaliacao, type DiaDoEditor, type ItemCritico, type LinhaPlacar } from '@/lib/engine/critico';
import { unificarAvisos } from '@/lib/avisos-unificados';
import { SERIES_MANUAIS_MAX } from '@/lib/engine/treino-constants';
import { contextoDaDose, type ReferenciaDose } from '@/lib/engine/referencia-dose';
import { ROTULO_GRUPO } from '@/lib/frequencia-grupos';
import { DIA_LABEL, ORDEM_SEMANA, type Weekday } from '@/lib/semana';
import SeletorExercicio, { type ContextoSeletor } from './SeletorExercicio';
import { adicionarSemDuplicar, identidadesDe } from '@/lib/exercicio-identidade';
import ResumoSeries from './ResumoSeries';
import OrdemExercicios from './OrdemExercicios';
import CoberturaMuscular, { type EfeitoDaSugestao } from './CoberturaMuscular';

/**
 * 🧭 O EDITOR GUIADO — "Montar meu treino" (handoff-editor-guiado-2026-08-13).
 *
 * Fecha o pedido nº 5 do beta por inteiro: a pessoa monta o próprio treino **com o motor ao
 * lado**, recomendando enquanto ela monta e avisando do risco.
 *
 * 🔒 As três DFs, executadas aqui:
 *  ① **Aviso NÃO trava.** O botão de salvar nunca desabilita por causa do crítico; os
 *    avisos aparecem em vermelho, explicados, e a pessoa segue. Os únicos bloqueios do
 *    produto continuam sendo o gate de saúde e o piso legal de reps — nenhum mora aqui.
 *  ② Pedido posterior (2026-09-10): séries manuais no treino customizado.
 *    Reps/RIR/descanso continuam automáticos; o crítico permanece visível.
 *  ③ **O seletor é o mesmo do TROCAR** — uma peça, duas portas.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

export interface DiaEditavel {
  /** Rótulo do dia — herdado do plano ou "Dia N" no começo do zero. */
  nome: string;
  /** Dia da semana em que este treino cai (índice Seg=0…Dom=6). */
  weekdayIdx: number;
  exercicios: Exercise[];
  seriesPorExercicio?: Record<string, number>;
  referenciaDose?: ReferenciaDose;
  /**
   * 🔴 O QUE O APP CORTOU POR TEMPO neste dia, por exercício (2026-09-16).
   *
   * ⚠️ Sem isto, o corte automático vira invisível ao abrir o editor: `seriesPorExercicio`
   * recebe a dose JÁ cortada e ela passa a parecer escolha da pessoa. Vem do plano de origem
   * (`SlotExercicio.seriesAntesDoCorteDeTempo`), não de uma diferença calculada aqui.
   *
   * 🔒 Ausente quando o plano não traz procedência — desenho salvo, plano legado. A tela
   * cala; não há histórico a inventar.
   */
  cortesDoApp?: { exercicioId: string; de: number; para: number }[];
  /**
   * 🔒 Os ids que vieram do BLOCO ADICIONAL do foco no plano de origem (2026-09-16).
   *
   * ⚠️ Mesma mecânica de `cortesDoApp`, e pelo mesmo motivo: ao abrir o editor a
   * procedência AINDA é confiável (vem de `SlotExercicio.extraDoFoco`, marcado pelo Set que
   * decidiu a adição). Sem carregá-la, a MESMA semana recebia dois vereditos: a aba do plano
   * calada e "Montar meu treino" dizendo 🔴 *"mais exercícios de empurrar (7) que de puxar
   * (5)"* — medido no QA desta correção.
   *
   * 🔒 Ausente quando não há procedência (desenho salvo, plano legado): aí todo exercício
   * conta, que é a avaliação que o manual já tinha. E um exercício que a pessoa tirou some
   * daqui junto, porque a marca é por id e só vale para quem continua no dia.
   */
  extrasDoFoco?: string[];
}

/**
 * 🔑 O que a prévia do motor devolve ao editor. Mais do que os dias porque o crítico e a tela
 * precisam do CONTEXTO que só o motor tem — e precisam dele da MESMA rodada que produziu os
 * dias, senão a explicação sobrevive à edição que a invalidou.
 */
export interface PrevisaoEditor {
  dias: DiaDoEditor[];
  /** Avisos do motor sobre ESTE desenho (corte por tempo, fase, foco parcial). */
  avisos: string[];
  /** D16 — os fatos por trás dos avisos de cobertura, para `unificarAvisos` deduplicar. */
  fatosCobertura?: FatoCoberturaGrupo[];
  /** Os fatos dos invariantes de padrão (puxar ≥ empurrar), pela mesma razão. */
  fatosInvariantes?: FatoInvariantePadrao[];
  /** A faixa REALMENTE aplicável nesta semana (deload/retomada mudam a régua). */
  faixaVolumeSemana?: Faixa;
  /** 🔵 Os três tetos desta semana, como o motor os publicou (decisão 2026-09-17). */
  tetoVolumeSemana?: RotinaSemanal['tetoVolumeSemana'];
  faseVolume?: FaseVolume;
  /**
   * 🔒 O TEMPO de cada dia, na ordem dos dias com exercício, como o MOTOR o certificou.
   * `null` onde ele se absteve (`NAO_AVALIADO`) — a tela se abstém junto, nunca estima.
   * Existe para a sugestão de cobertura poder dizer "+X min no dia" com o número do motor.
   */
  duracaoSegPorDia?: readonly (number | null)[];
  /** O dia excede o tempo por sessão? Veredito do motor (`estadoLimite`), não conta da tela. */
  excedeTempoPorDia?: readonly boolean[];
}

/** Começar do plano atual conserva sua dose como escolha inicial do novo desenho manual.
 * Custom existente conserva a intenção salva, inclusive a ausência de escolha: copiar a
 * saída recuperada congelaria rampa/deload e perderia a dose original do usuário.
 * A prévia/salvamento continuam sujeitos à recuperação do motor, sem regra paralela aqui.
 */
export function doPlano(dias: readonly DiaTreino[], treinoDias: readonly Weekday[], custom?: RotinaCustom, retomada?: { semana: number; fator: number; volumeReferencia: number }): DiaEditavel[] {
  const contexto = contextoDaDose(retomada);
  const editaveis: DiaEditavel[] = dias.map((d, i) => ({
    nome: d.nome,
    // `diaId` é a fonte nova; agenda/posição é apenas compatibilidade para plano legado.
    weekdayIdx: Math.max(0, ORDEM_SEMANA.indexOf(d.diaId ?? treinoDias[i] ?? ORDEM_SEMANA[i % 7]!)),
    exercicios: d.slots.map((s) => s.exercicio),
    seriesPorExercicio: custom
      ? { ...custom.dias.find((dia, indice) => (dia.diaId ?? treinoDias[indice]) === (d.diaId ?? treinoDias[i]))?.seriesPorExercicio }
      : Object.fromEntries(d.slots.filter((s) => s.series != null).map((s) => [s.exercicio.id, s.seriesAntesDoDeload ?? s.series!])),
    /**
     * 🔒 SÓ quando o desenho vem do plano do app (`custom == null`). Recuperando um desenho
     * SALVO, os slots vêm da regeneração manual — que não passa pela fase A e não corta nada —,
     * então não há corte do app naquele plano para explicar, e afirmar um seria inventar.
     */
    ...(custom ? {} : (() => {
      const cortes = d.slots.flatMap((s) => (s.seriesAntesDoCorteDeTempo != null && s.series != null
        && s.series < s.seriesAntesDoCorteDeTempo)
        ? [{ exercicioId: s.exercicio.id, de: s.seriesAntesDoCorteDeTempo, para: s.series }] : []);
      const extras = d.slots.filter((s) => s.extraDoFoco).map((s) => s.exercicio.id);
      return { ...(cortes.length > 0 ? { cortesDoApp: cortes } : {}), ...(extras.length > 0 ? { extrasDoFoco: extras } : {}) };
    })()),
  }));
  if (contexto) editaveis.forEach((d, i) => {
    d.referenciaDose = { versao: 1, contexto,
      series: Object.fromEntries(dias[i]!.slots.filter(s => s.series != null).map(s => [s.exercicio.id, s.series!])),
      escolhas: { ...d.seriesPorExercicio },
    };
  });
  return editaveis;
}

/** Captura a prévia efetivamente exibida ANTES da próxima edição, sem alterar a intenção. */
export function atualizarReferencias(dias: readonly DiaEditavel[], previsto: readonly DiaDoEditor[]): DiaEditavel[] {
  let indice = 0;
  return dias.map(d => {
    const p = d.exercicios.length ? previsto[indice++] : undefined;
    if (!d.referenciaDose || !p) return d;
    // 🔒 `cortesDoApp` atravessa intacto (spread): ele é histórico do que o APP fez, e não
    // muda por causa de uma edição. Quem decide se ainda vale é a renderização, comparando
    // com a dose exibida agora — assim nada fica preso em estado velho.
    return { ...d, referenciaDose: { ...d.referenciaDose,
      series: Object.fromEntries(p.exercicios.flatMap((e, i) => p.series?.[i] == null ? [] : [[e.id, p.series[i]!]])),
      escolhas: { ...d.seriesPorExercicio },
    } };
  });
}

/** Um treino de força por dia nesta versão. Sessões duplas exigirão uma identidade de sessão própria. */
export function weekdaysSaoUnicos(dias: readonly DiaEditavel[]): boolean {
  return new Set(dias.map((d) => d.weekdayIdx)).size === dias.length;
}

/** Do formato editável para o desenho e suas escolhas de séries (sem reps/RIR/descanso). */
export function paraRotinaCustom(dias: readonly DiaEditavel[]): RotinaCustom {
  return {
    origem: 'usuario',
    dias: dias
      .filter((d) => d.exercicios.length > 0)
      .map((d) => ({ ...(d.referenciaDose ? { referenciaDose: d.referenciaDose } : {}), nome: d.nome, diaId: ORDEM_SEMANA[d.weekdayIdx]!, exercicioIds: d.exercicios.map((e) => e.id),
        ...(d.seriesPorExercicio && Object.keys(d.seriesPorExercicio).length ? { seriesPorExercicio: Object.fromEntries(d.exercicios.filter((e) => d.seriesPorExercicio?.[e.id] != null).map((e) => [e.id, d.seriesPorExercicio![e.id]!])) } : {}),
      })),
  };
}

export default function EditorTreino({
  inicial, ctxSeletor, exercises, elegiveis, nivel, objetivo, tempoPorSessaoMin, limiteTempoTreino, preverPlano, semana,
  onSalvar, onCancelar, onGerarNovo, onDesbanir, onAvisoMostrado,
}: {
  inicial: DiaEditavel[];
  ctxSeletor: ContextoSeletor;
  exercises: readonly Exercise[];
  /**
   * 🔒 O POOL ELEGÍVEL do motor (`poolElegivel`) — a mesma autoridade que decide o que entra
   * no plano. É dele que a cobertura muscular tira as sugestões: sugerir do catálogo inteiro
   * ofereceria à pessoa exercício que o motor recusa.
   */
  elegiveis: readonly Exercise[];
  nivel: NivelExperiencia;
  objetivo: Objetivo;
  tempoPorSessaoMin: number;
  limiteTempoTreino?: 'limitado' | 'sem_limite';
  /**
   * 🔑 A PRÉVIA REAL, não uma estimativa. Recebe o desenho em construção e devolve o que o
   * MOTOR produziria com ele — séries e descanso incluídos.
   *
   * ⚠️ Isto nasceu de um defeito medido no próprio aceite 3: a 1ª versão pintava o placar
   * com um número fixo de séries por exercício, e o motor atribui outra coisa (ele
   * distribui o alvo da banda pelos slots, clampado em `n × sMax`). Resultado: 5 exercícios
   * de peito apareciam como "10 ⚪ abaixo do mínimo" enquanto o plano salvo entregaria 16 —
   * o crítico mentiria justamente sobre o número que ele existe para explicar. A regra da
   * casa vale aqui como no resto: **não estime o que dá para calcular com a função real.**
   */
  preverPlano: (dias: readonly DiaEditavel[]) => PrevisaoEditor;
  /** Semana do mesociclo — o crítico precisa dela para o fato casar com o do motor (D16). */
  semana?: number;
  onSalvar: (dias: DiaEditavel[], avaliacao: Avaliacao) => void;
  onCancelar: () => void;
  /**
   * 🔁 Abre a PROPOSTA de um treino novo montado pelo app. 🔴 Não substitui nada aqui: quem
   * mostra a prévia e pede a confirmação é o Painel, e o desenho salvo só sai se a pessoa
   * confirmar. O rascunho aberto neste editor não entra na proposta — ela parte do que está
   * salvo, e é isso que a prévia diz.
   */
  onGerarNovo: () => void;
  onDesbanir?: (id: string) => void;
  /** Telemetria do risco exibido — o EVENTO ADVERSO da leva (payload fechado). */
  onAvisoMostrado?: (codigos: string[]) => void;
}) {
  const [dias, setDias] = useState<DiaEditavel[]>(inicial.length > 0 ? inicial : [{ nome: 'Dia 1', weekdayIdx: 0, exercicios: [] }]);
  const [abrindoEm, setAbrindoEm] = useState<number | null>(null);
  const previsao = useMemo(() => preverPlano(dias), [dias, preverPlano]);
  /**
   * 🔒 A procedência do bloco do foco chega ao crítico pelo ID, casando o dia editado com
   * o dia previsto. É o que faz "Montar meu treino" e a aba do plano darem o MESMO veredito
   * sobre `puxar ≥ empurrar` — o mesmo escopo do montador.
   */
  const previstoComProcedencia = useMemo(() => {
    let indice = 0;
    return dias.flatMap((d) => {
      const p = d.exercicios.length ? previsao.dias[indice++] : undefined;
      if (!p) return [];
      return [d.extrasDoFoco ? { ...p, extraDoFoco: p.exercicios.map((e) => d.extrasDoFoco!.includes(e.id)) } : p];
    });
  }, [dias, previsao]);
  const previsto = previsao.dias;

  /**
   * 🔒 A AVALIAÇÃO DE UM DESENHO, em UMA função — usada pelo estado ao vivo e pela HIPÓTESE
   * ("o que muda se eu adicionar este exercício?"). Duas cópias desta montagem seriam duas
   * respostas possíveis para a mesma pergunta; a consequência que a cobertura mostra tem de
   * sair exatamente do cálculo que o crítico já faz.
   */
  const avaliarDesenho = useCallback((lista: readonly DiaEditavel[]): {
    previsao: PrevisaoEditor; avaliacao: Avaliacao;
  } => {
    const p = preverPlano(lista);
    const comExercicio = lista.filter((d) => d.exercicios.length > 0);
    let indice = 0;
    const comProcedencia = lista.flatMap((d) => {
      const previstoDoDia = d.exercicios.length ? p.dias[indice++] : undefined;
      if (!previstoDoDia) return [];
      return [d.extrasDoFoco
        ? { ...previstoDoDia, extraDoFoco: previstoDoDia.exercicios.map((e) => d.extrasDoFoco!.includes(e.id)) }
        : previstoDoDia];
    });
    // 🔒 O editor NÃO supre `seriesPadrao`: o placar vem do MOTOR (preverPlano). Onde o motor
    // não anotou séries (deload/corpo-inteiro), o placar cai no piso do próprio crítico — e o
    // critério de TEMPO abstém-se (C1), nunca inventa.
    const avaliacao = avaliarSemana(comProcedencia, {
      nivel, objetivo, tempoPorSessaoMin, limiteTempoTreino,
      // 🔴 Fase e faixa vêm do MOTOR, pela mesma prévia: sem elas o deload abria com 6
      // acusações de "faixa mínima desta semana" usando o piso terminal do mesociclo.
      ...(semana != null ? { semana } : {}),
      ...(p.faixaVolumeSemana ? { faixaSemanal: p.faixaVolumeSemana } : {}),
      ...(p.tetoVolumeSemana ? { tetoVolumeSemana: p.tetoVolumeSemana } : {}),
      ...(p.faseVolume ? { faseVolume: p.faseVolume } : {}),
      diasDaSemanaIdx: comExercicio.slice(0, p.dias.length).map((d) => d.weekdayIdx),
    });
    return { previsao: p, avaliacao };
  }, [preverPlano, nivel, objetivo, tempoPorSessaoMin, limiteTempoTreino, semana]);

  const avaliacao = useMemo<Avaliacao>(
    // A prévia vem do MOTOR (mesmo caminho do plano salvo); os dias com exercício mantêm a
    // ordem, então os índices de dia da semana acompanham por posição.
    () => avaliarSemana(previstoComProcedencia, {
      nivel, objetivo, tempoPorSessaoMin, limiteTempoTreino,
      ...(semana != null ? { semana } : {}),
      ...(previsao.faixaVolumeSemana ? { faixaSemanal: previsao.faixaVolumeSemana } : {}),
      ...(previsao.tetoVolumeSemana ? { tetoVolumeSemana: previsao.tetoVolumeSemana } : {}),
      ...(previsao.faseVolume ? { faseVolume: previsao.faseVolume } : {}),
      diasDaSemanaIdx: dias.filter((d) => d.exercicios.length > 0).slice(0, previsto.length).map((d) => d.weekdayIdx),
    }),
    [dias, nivel, objetivo, tempoPorSessaoMin, limiteTempoTreino, previsto, previstoComProcedencia, previsao, semana],
  );

  /**
   * 🔁 A CONSEQUÊNCIA de adicionar uma sugestão de cobertura — pelo CÁLCULO EXISTENTE.
   *
   * Tempo do dia: a certificação do motor (`duracaoSegPorDia`), que se abstém quando não tem
   * como calcular — e aqui a tela se abstém junto (`deltaSegundos: null`).
   * Volume: o placar PONDERADO do crítico (direto 1,0 + secundário 0,5), o mesmo da faixa.
   *
   * 🔴 Nada é adicionado por chamar isto: é uma simulação descartada assim que retorna.
   */
  const efeitoDeAdicionar = useCallback((indiceDoDia: number, ex: Exercise): EfeitoDaSugestao | null => {
    const hipotese = dias.map((d, k) => (k === indiceDoDia
      ? { ...d, exercicios: adicionarSemDuplicar(d.exercicios, [ex]).lista } : d));
    if (hipotese[indiceDoDia]?.exercicios.length === dias[indiceDoDia]?.exercicios.length) return null;
    const depois = avaliarDesenho(hipotese);
    // Posição do dia entre os dias COM exercício — a mesma ordem que a prévia devolve.
    const posicao = dias.slice(0, indiceDoDia).filter((d) => d.exercicios.length > 0).length;
    const antesSeg = previsao.duracaoSegPorDia?.[posicao] ?? null;
    const depoisSeg = depois.previsao.duracaoSegPorDia?.[posicao] ?? null;
    const grupo = ex.grupoPrimario;
    const linhaAntes = avaliacao.placar.find((l) => l.grupo === grupo);
    const linhaDepois = depois.avaliacao.placar.find((l) => l.grupo === grupo);
    /**
     * 🔴 O placar do crítico cobre os grupos GRANDES. Para core, braços, panturrilha, lombar e
     * antebraço ele simplesmente não tem linha — e a primeira versão desta função devolvia
     * `0 − 0 = 0`, que a tela lia como "sem mudança no volume semanal de Core". Era afirmação
     * sem conta (medido no QA desta leva). Sem linha ⇒ `null` ⇒ a tela não fala do semanal.
     */
    const semanal = linhaAntes && linhaDepois ? linhaDepois.ponderado - linhaAntes.ponderado : null;
    const seriesDoDia = (p: PrevisaoEditor) => {
      const series = p.dias[posicao]?.series;
      if (!series || series.some((n) => n == null)) return null;
      return series.reduce<number>((n, s) => n + (s ?? 0), 0);
    };
    const antesSeries = seriesDoDia(previsao);
    const depoisSeries = seriesDoDia(depois.previsao);
    /**
     * 🔵 OS LIMITES DEPOIS DE ADICIONAR (2026-09-17) — pelo MESMO crítico, nunca por conta
     * própria. `passaDoSemanal` sai do status do placar (que já distingue "acima do que o app
     * monta sozinho" de "acima do teto") e `passaDoTetoDaSessao` do aviso por sessão, casado
     * pelo fato (grupo + dia), não pelo texto.
     */
    // 🔵 2026-09-19: o placar agora tem linha para todo grupo; sem faixa não há teto a passar,
    // e a tela se abstém (`null`) em vez de afirmar "não passa" de uma faixa que não existe.
    const passaDoSemanal = linhaDepois == null || !linhaDepois.temFaixa
      ? null
      : linhaDepois.status === 'acima_mrv'
        ? 'teto' as const
        : linhaDepois.status === 'acima_do_automatico'
          ? 'automatico' as const
          : 'nao' as const;
    const passaDoTetoDaSessao = depois.avaliacao.avisos.some((a) => a.codigo === 'acima_do_maximo_na_sessao'
      && a.fato?.grupo === grupo && a.fato?.dia === posicao);
    return {
      deltaSegundos: antesSeg == null || depoisSeg == null ? null : depoisSeg - antesSeg,
      deltaSeriesNoDia: antesSeries == null || depoisSeries == null ? null : depoisSeries - antesSeries,
      deltaSeriesDoGrupo: semanal,
      grupo: linhaDepois?.rotulo ?? linhaAntes?.rotulo ?? ROTULO_GRUPO[grupo ?? ''] ?? (grupo ?? 'grupo'),
      excedeOTempo: depois.previsao.excedeTempoPorDia?.[posicao] === true,
      passaDoSemanal,
      passaDoTetoDaSessao,
    };
  }, [dias, avaliarDesenho, previsao, avaliacao]);

  /**
   * 🔴 O QUE O MOTOR EXPLICA, NO EDITOR (correção 2026-09-15).
   *
   * O corte por tempo, a redução planejada do deload e a entrega parcial do foco eram ditos
   * pelo motor e renderizados só na aba do plano; aqui o mesmo déficit aparecia sem causa. A
   * lista passa pelo MESMO `unificarAvisos` da aba do plano, então o par "motor + crítico
   * sobre o mesmo grupo" continua resolvido em UMA voz — a que traz os números.
   */
  const avisosMotor = useMemo(
    () => unificarAvisos(
      { avisos: previsao.avisos,
        ...(previsao.fatosCobertura ? { fatosCobertura: previsao.fatosCobertura } : {}),
        ...(previsao.fatosInvariantes ? { fatosInvariantes: previsao.fatosInvariantes } : {}) },
      avaliacao,
    ).avisosMotor,
    [previsao, avaliacao],
  );

  const total = dias.reduce((n, d) => n + d.exercicios.length, 0);
  const diasUnicos = weekdaysSaoUnicos(dias);
  const proximoDiaLivre = (atuais: readonly DiaEditavel[]) =>
    Math.max(0, ORDEM_SEMANA.findIndex((_, indice) => !atuais.some((dia) => dia.weekdayIdx === indice)));

  const mut = (i: number, f: (d: DiaEditavel) => DiaEditavel) => setDias((p) => atualizarReferencias(p, preverPlano(p).dias).map((d, k) => (k === i ? f(d) : d)));
  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '28px 20px 48px', animation: `evkScreenIn .45s ${EASE}` }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-.02em' }}>Montar meu treino</h1>
        <p style={{ margin: '0 0 20px', fontSize: '.9rem', color: 'rgba(234,229,219,.62)', lineHeight: 1.55 }}>
          Escolha vários exercícios de uma vez, organize a ordem e ajuste as séries.
          Repetições e descanso seguem as recomendações do app. Nas fases de recuperação, o volume pode ser reduzido.
        </p>

        {/* ═══ O CRÍTICO — placar, recomendações e avisos, ao vivo enquanto monta ═══ */}
        <PainelCritico avaliacao={avaliacao} />
        {/* O que o MOTOR explica sobre ESTE desenho: corte por tempo, fase de recuperação,
            entrega parcial do foco. Recalculado junto com a prévia — nunca é fala velha. */}
        <AvisosDoMotorNoEditor avisos={avisosMotor} />
        {/* Os cortes que o APP fez por tempo no plano de origem, enquanto ainda descrevem a
            dose exibida. Sai sozinho quando a pessoa mexe no número ou tira o exercício. */}
        <CortesDoAppNoEditor cortes={cortesVigentes(dias, previsto)} limiteMin={tempoPorSessaoMin} />
        <ResumoSeries slots={previsto.flatMap((dia) => dia.exercicios.map((exercicio, i) => ({ exercicio, series: dia.series?.[i] ?? 0 })))} />

        {dias.map((d, i) => (
          <div key={i} style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <input
                value={d.nome}
                onChange={(e) => mut(i, (x) => ({ ...x, nome: e.target.value.slice(0, 60) }))}
                aria-label={`Nome do dia ${i + 1}`}
                className="input-foco"
                style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', borderBottom: '1px solid rgba(234,229,219,.14)', color: '#EAE5DB', fontSize: '1rem', fontWeight: 700, padding: '4px 0', outline: 'none' }}
              />
              {dias.length > 1 && (
                <button onClick={() => setDias((p) => p.filter((_, k) => k !== i))} style={btnGhost} aria-label={`Remover ${d.nome}`}>Remover dia</button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <strong style={{ color: '#BDFF00' }}>{DIA_LABEL[ORDEM_SEMANA[d.weekdayIdx]!].full}</strong>
              <details><summary style={{ cursor: 'pointer', padding: '10px 0' }}>Trocar o dia</summary>
                <label>Dia do treino <select aria-label={`Dia de ${d.nome}`} value={d.weekdayIdx} onChange={(e) => { mut(i, x => ({ ...x, weekdayIdx: Number(e.target.value) })); e.currentTarget.closest('details')?.removeAttribute('open'); }} style={{ padding: 10, borderRadius: 10, background: '#12321f', color: '#EAE5DB' }}>
                  {ORDEM_SEMANA.map((w, wi) => <option key={w} value={wi} disabled={dias.some((outro, k) => k !== i && outro.weekdayIdx === wi)}>{DIA_LABEL[w].full}</option>)}
                </select></label>
              </details>
            </div>


            <p style={{ color: 'rgba(234,229,219,.8)', fontSize: '.85rem' }}>{d.exercicios.length} exercícios · {d.exercicios.length ? previsto[dias.slice(0, i).filter((dia) => dia.exercicios.length).length]?.series?.reduce<number>((n, s) => n + (s ?? 0), 0) ?? 0 : 0} séries previstas</p>
            {d.exercicios.length === 0 && (
              <p style={{ margin: '0 0 10px', fontSize: '.86rem', color: 'rgba(234,229,219,.5)' }}>Nenhum exercício ainda neste dia.</p>
            )}
            <OrdemExercicios exercicios={d.exercicios} onMover={(de, para) => mut(i, (dia) => { const itens = [...dia.exercicios]; const [item] = itens.splice(de, 1); itens.splice(para, 0, item!); return { ...dia, exercicios: itens }; })}>
              {(ex, k) => (<>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.94rem', fontWeight: 600 }}>{ex.nomePt}</div>
                    <div style={{ fontSize: '.76rem', color: 'rgba(234,229,219,.5)' }}>{ROTULO_GRUPO[ex.grupoPrimario ?? ''] ?? ex.grupoMuscular}</div>
                  </div>
                  <CampoSeries nome={ex.nomePt} valor={d.seriesPorExercicio?.[ex.id] ?? previsto[dias.slice(0, i).filter((dia) => dia.exercicios.length).length]?.series?.[k] ?? 1} onMudar={(valor) => mut(i, (dia) => ({ ...dia, seriesPorExercicio: { ...dia.seriesPorExercicio, [ex.id]: valor } }))} />
                  <button onClick={() => mut(i, (x) => ({ ...x, exercicios: x.exercicios.filter((_, j) => j !== k) }))} style={btnIcone} aria-label={`Remover ${ex.nomePt}`}>×</button>
                </>
              )}
            </OrdemExercicios>
            {/* 🦴 A cobertura muscular DESTE dia, ao vivo. Diagnóstico: não trava o salvamento,
                não adiciona nada sozinha e não repete o crítico (ela fala de REGIÕES, não de
                volume, tempo ou fase). O que entra, entra por um toque da pessoa — e pelo
                mesmo `adicionarSemDuplicar` do seletor.

                🔵 2026-09-17 — ela subiu para ANTES do botão de adicionar. Depois dele, no
                celular, o botão verde de largura cheia fechava visualmente o cartão do dia e
                a cobertura virava rodapé: é o defeito de descoberta do relato "não apareceu".
                Aqui ela fica colada na lista que descreve, e o botão continua logo abaixo. */}
            <CoberturaMuscular
              nomeDoDia={d.nome}
              escolhidos={d.exercicios}
              elegiveis={elegiveis}
              onAdicionar={(ex) => mut(i, (dia) => ({ ...dia, exercicios: adicionarSemDuplicar(dia.exercicios, [ex]).lista }))}
              efeitoDe={(ex) => efeitoDeAdicionar(i, ex)}
            />
            <button onClick={() => setAbrindoEm(i)} style={{ ...btnGhost, width: '100%', marginTop: 10, background: '#BDFF00', color: '#0D2818', minHeight: 48 }}>+ Adicionar exercícios</button>
          </div>
        ))}

        <button
          disabled={dias.length >= ORDEM_SEMANA.length}
          onClick={() => setDias((p) => [...p, { nome: `Dia ${p.length + 1}`, weekdayIdx: proximoDiaLivre(p), exercicios: [] }])}
          style={{ ...btnGhost, width: '100%', marginBottom: 20, opacity: dias.length >= ORDEM_SEMANA.length ? .4 : 1 }}
        >
          + Adicionar dia
        </button>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onCancelar} style={btnGhost}>Cancelar</button>
          {/* 🔁 Abre a PRÉVIA da proposta. 🔴 Nada é substituído aqui: o desenho salvo só sai
              depois da confirmação, na tela da proposta. A proposta parte do treino SALVO —
              o rascunho aberto neste editor não entra nela, e a prévia diz isso. */}
          <button onClick={onGerarNovo} style={btnGhost}>Gerar novo treino</button>
          {/* 🔒 DF① — o salvar NUNCA desabilita por causa de aviso. Só o treino vazio não
              salva, e isso não é risco: é ausência de treino. */}
          <button
            onClick={() => { onAvisoMostrado?.(avaliacao.avisos.map((a) => a.codigo)); onSalvar(atualizarReferencias(dias, previsto), avaliacao); }}
            disabled={total === 0 || !diasUnicos}
            className={total > 0 && diasUnicos ? 'hov-btn' : ''}
            style={{ flex: 1, minWidth: 180, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: 14, border: 'none', borderRadius: 13, cursor: total > 0 && diasUnicos ? 'pointer' : 'not-allowed', opacity: total > 0 && diasUnicos ? 1 : 0.4 }}
          >
            Salvar meu treino
          </button>
        </div>
        <p style={{ margin: '10px 2px 0', fontSize: '.82rem', lineHeight: 1.5, color: 'rgba(234,229,219,.5)' }}>
          &quot;Gerar novo treino&quot; monta uma proposta do app a partir do seu treino <strong>salvo</strong> —
          o que você está editando aqui não entra nela. Você vê a proposta antes de substituir.
        </p>
        {total === 0 && <p style={{ margin: '10px 2px 0', fontSize: '.84rem', color: 'rgba(234,229,219,.5)' }}>Adicione ao menos um exercício para salvar.</p>}
        {!diasUnicos && <p style={{ margin: '10px 2px 0', fontSize: '.84rem', color: '#ffb4a5' }}>Escolha dias diferentes: por enquanto, cada dia comporta um treino.</p>}
      </div>

      {/* 🔒 D19 — a trava mora na OPERAÇÃO: os dois caminhos de inclusão (clique individual
          e "Adicionar selecionados") passam pela mesma `adicionarSemDuplicar`. A marcação
          "Já neste treino" é só a aparência disso, e o dia continua sendo o escopo: o mesmo
          exercício em OUTRO dia não é tocado, e duplicata já gravada não é removida. */}
      {abrindoEm != null && (
        <SeletorExercicio
          exercises={exercises}
          ctx={ctxSeletor}
          jaAdicionados={identidadesDe(dias[abrindoEm]?.exercicios ?? [])}
          onEscolher={(ex) => { mut(abrindoEm, (d) => ({ ...d, exercicios: adicionarSemDuplicar(d.exercicios, [ex]).lista })); setAbrindoEm(null); }}
          onEscolherVarios={(selecionados) => { mut(abrindoEm, (d) => ({ ...d, exercicios: adicionarSemDuplicar(d.exercicios, selecionados).lista })); setAbrindoEm(null); }}
          onDesbanir={onDesbanir}
          onFechar={() => setAbrindoEm(null)}
        />
      )}

    </div>
  );
}

function CampoSeries({ nome, valor, onMudar }: { nome: string; valor: number; onMudar: (valor: number) => void }) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);
  return <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8rem' }}>Séries
    <input type="number" inputMode="numeric" min={1} max={SERIES_MANUAIS_MAX} step={1} aria-label={`Séries de ${nome}`} value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => { const n = Number(texto); if (Number.isInteger(n) && n >= 1 && n <= SERIES_MANUAIS_MAX) onMudar(n); else setTexto(String(valor)); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      style={{ width: 58, minHeight: 44, borderRadius: 10, background: '#0D2818', color: '#EAE5DB', border: '1px solid rgba(234,229,219,.4)', padding: 8, font: 'inherit' }} />
  </label>;
}

/**
 * O PLACAR + as sugestões + os avisos. Mesmo componente no editor e (compacto) no plano
 * salvo — DF②: *"o crítico permanece visível no plano custom, não só na montagem"*.
 */
/**
 * 🔴 D16 (auditoria 2026-09-11) — O QUE O CRÍTICO REALMENTE MOSTRA, em fonte única.
 *
 * No plano salvo o crítico é COMPACTO: ele exibe uma recomendação. Quem decide suprimir o eco
 * do motor (`lib/avisos-unificados`) precisa comparar contra o que a tela EXIBE, não contra a
 * lista inteira — senão um fato cuja fala do crítico ficou de fora do compacto sairia das duas
 * listas e desapareceria da tela. Uma régua só, aqui, para os dois consumidores.
 */
export function recomendacoesVisiveis(avaliacao: Pick<Avaliacao, 'recomendacoes'>, compacto: boolean): ItemCritico[] {
  return compacto ? avaliacao.recomendacoes.slice(0, 1) : [...avaliacao.recomendacoes];
}

export function PainelCritico({ avaliacao, compacto = false }: { avaliacao: Avaliacao; compacto?: boolean }) {
  const { placar, recomendacoes, avisos } = avaliacao;
  const visiveis = recomendacoesVisiveis(avaliacao, compacto);
  return (
    <div style={{ background: 'rgba(13,40,24,.4)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 16, padding: 15, marginBottom: 16 }}>
      {!compacto && (
        <>
          <div style={{ fontSize: '.76rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 9 }}>Sua semana</div>
          {/**
            * 🔵 2026-09-19 — TODOS os grupos acompanhados, com a unidade dita. O número do chip é
            * a conta PONDERADA (direta 1,0 · indireta 0,5), a mesma da faixa; o título separa as
            * diretas (séries feitas) do crédito indireto, que nunca é apresentado como "meia
            * série". Grupo sem faixa mostra a contagem e diz que não há referência — sem verde.
            */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 6 }}>
            {placar.map((l) => (
              <span key={l.grupo} title={tituloDaLinha(l)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '.8rem', fontWeight: 600, border: `1px solid ${corDoStatus(l.status).borda}`, color: corDoStatus(l.status).texto, borderRadius: 999, padding: '5px 10px' }}>
                {corDoStatus(l.status).marca} {l.rotulo} <span style={{ opacity: 0.7, fontWeight: 500 }}>{l.ponderado}</span>
                {!l.temFaixa && <span style={{ opacity: 0.55, fontWeight: 500, fontSize: '.72rem' }}>sem faixa</span>}
              </span>
            ))}
          </div>
          <p style={{ margin: `0 0 ${visiveis.length || avisos.length ? 13 : 0}px`, fontSize: '.74rem', color: 'rgba(234,229,219,.5)' }}>
            Séries ponderadas da semana (direta conta 1, indireta conta 0,5). Grupo marcado como “sem faixa” tem só a contagem: não há faixa de referência definida para ele.
          </p>
        </>
      )}
      {avisos.map((a, i) => <Linha key={`a${i}`} item={a} />)}
      {visiveis.map((r, i) => <Linha key={`r${i}`} item={r} />)}
      {/**
        * 🔵 2026-09-15 — a frase positiva agora depende do PLACAR, não do silêncio.
        *
        * Com a supressão do mínimo em deload/retomada, "está dentro das faixas" passou a poder
        * aparecer com chips CINZA na mesma tela (medido no QA: deload com quadríceps, posterior
        * e glúteos abaixo do piso da fase). Duas falas contraditórias sobre o mesmo placar.
        * Ela só sai quando todo grupo está mesmo na banda; fora disso, quem explica é o aviso
        * do motor logo abaixo, que sabe o motivo (fase de recuperação, corte por tempo).
        *
        * 🔵 2026-09-19 — e ela só fala pelos grupos COM faixa. Os demais estão no placar com a
        * contagem, mas não foram avaliados contra faixa nenhuma, e a frase diz isso em vez de
        * afirmar uma avaliação completa que não houve.
        */}
      {!compacto && avisos.length === 0 && recomendacoes.length === 0
        && placar.some((l) => l.temFaixa) && placar.filter((l) => l.temFaixa).every((l) => l.status === 'na_banda') && (
        <p style={{ margin: 0, fontSize: '.86rem', color: 'rgba(234,229,219,.6)' }}>{fraseDaSemana(placar)}</p>
      )}
    </div>
  );
}

/**
 * 🧭 A EXPLICAÇÃO DO MOTOR dentro do editor — a mesma lista já unificada da aba do plano,
 * com o mesmo tom (🟡 informativo, `role="status"`). Sem avisos, não ocupa espaço.
 *
 * 🔒 Não trava nada: é texto. Os únicos bloqueios do produto continuam sendo o gate de saúde
 * e o piso legal de reps com carga — e nenhum dos dois passa por aqui.
 */
/**
 * 🔴 OS CORTES DO APP, EXPLICADOS NO EDITOR (2026-09-16) — e só os que ainda valem.
 *
 * ⚠️ O defeito que isto fecha: no caminho manual o reduce-to-fit não roda (contrato), e a
 * prévia do desenho não tem o que explicar. Só que a dose exibida JÁ vem cortada do plano de
 * origem — `doPlano` a copia para `seriesPorExercicio` — e a pessoa via um número menor sem
 * causa, atribuído a ela.
 *
 * 🔒 Um corte só aparece se AINDA corresponde à tela: o exercício continua no dia e a dose
 * exibida é exatamente o `para` do corte. Mudou a série, tirou o exercício ⇒ a linha sai
 * sozinha, sem estado velho para limpar. E o que a pessoa digita nunca é atribuído ao app.
 */
export function cortesVigentes(
  dias: readonly DiaEditavel[],
  previsto: readonly DiaDoEditor[],
): { nome: string; de: number; para: number }[] {
  let indice = 0;
  return dias.flatMap((d) => {
    const p = d.exercicios.length ? previsto[indice++] : undefined;
    if (!d.cortesDoApp || !p) return [];
    return d.cortesDoApp.flatMap((c) => {
      const i = d.exercicios.findIndex((e) => e.id === c.exercicioId);
      if (i < 0) return [];
      // A dose que a TELA mostra: a prévia do motor, com a escolha guardada como referência.
      const j = p.exercicios.findIndex((e) => e.id === c.exercicioId);
      const exibida = j >= 0 ? p.series?.[j] : undefined;
      const escolhida = d.seriesPorExercicio?.[c.exercicioId];
      if (exibida !== c.para || (escolhida != null && escolhida !== c.para)) return [];
      return [{ nome: d.exercicios[i]!.nomePt, de: c.de, para: c.para }];
    });
  });
}

export function CortesDoAppNoEditor(
  { cortes, limiteMin }: { cortes: readonly { nome: string; de: number; para: number }[]; limiteMin: number },
) {
  if (cortes.length === 0) return null;
  const lista = cortes.map((c) => `${c.nome} (${c.de} → ${c.para})`).join(', ');
  return (
    <section
      aria-label="Ajustes de série feitos pelo app"
      style={{ background: 'rgba(13,40,24,.4)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 16, padding: 15, marginBottom: 16 }}
    >
      <p role="status" style={{ margin: 0, fontSize: '.86rem', lineHeight: 1.5, color: 'rgba(234,229,219,.8)' }}>
        <span aria-hidden style={{ marginRight: 6 }}>🟡</span>
        Para caber em {limiteMin} min, o app reduziu as séries de {lista}. A escolha é sua: mudar
        qualquer um desses números substitui o ajuste.
      </p>
    </section>
  );
}

export function AvisosDoMotorNoEditor({ avisos }: { avisos: readonly string[] }) {
  if (avisos.length === 0) return null;
  return (
    <section
      aria-label="O que o app calculou para este desenho"
      style={{ background: 'rgba(13,40,24,.4)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 16, padding: 15, marginBottom: 16 }}
    >
      {avisos.map((texto, i) => (
        <p key={`motor-${i}`} role="status" style={{ margin: i === avisos.length - 1 ? 0 : '0 0 8px', fontSize: '.86rem', lineHeight: 1.5, color: 'rgba(234,229,219,.8)' }}>
          <span aria-hidden style={{ marginRight: 6 }}>🟡</span>{texto}
        </p>
      ))}
    </section>
  );
}

function Linha({ item }: { item: ItemCritico }) {
  const risco = item.severidade === 'risco';
  return (
    <p role={risco ? 'alert' : 'status'} style={{ margin: '0 0 8px', fontSize: '.86rem', lineHeight: 1.5, color: risco ? '#E5484D' : 'rgba(234,229,219,.8)' }}>
      <span aria-hidden style={{ marginRight: 6 }}>{risco ? '🔴' : '🟡'}</span>{item.texto}
    </p>
  );
}

/**
 * A frase positiva do placar — só sobre quem tem faixa (2026-09-19). Nomeia os grupos que
 * ficaram fora da avaliação para a frase não afirmar cobertura completa.
 */
export function fraseDaSemana(placar: readonly LinhaPlacar[]): string {
  const comFaixa = placar.filter((l) => l.temFaixa);
  const semFaixa = placar.filter((l) => !l.temFaixa);
  const lista = comFaixa.map((l) => l.rotulo).join(', ');
  if (semFaixa.length === 0) return `Os grupos com faixa definida (${lista}) estão dentro das faixas do seu nível.`;
  return `Os grupos com faixa definida (${lista}) estão dentro das faixas do seu nível. ${semFaixa.map((l) => l.rotulo).join(', ')} aparecem só com a contagem: não têm faixa de referência e não foram avaliados.`;
}

/** O título do chip: a unidade, a decomposição direta/indireta e a faixa (quando existe). */
export function tituloDaLinha(l: LinhaPlacar): string {
  const conta = `${l.ponderado} séries ponderadas (${l.direto} diretas + ${l.indireto} de crédito indireto, já a 0,5)`;
  return l.temFaixa
    ? `${conta} · faixa ${l.mev}–${l.maxAutomatico} · teto ${l.mrv}`
    : `${conta} · sem faixa de referência definida para este grupo`;
}

const corDoStatus = (s: string) =>
  s === 'na_banda' ? { marca: '🟢', borda: 'rgba(22,163,74,.45)', texto: 'rgba(234,229,219,.9)' }
  // 🔵 Sem faixa: contagem, não avaliação — marca neutra, nunca verde.
  : s === 'sem_referencia' ? { marca: '◦', borda: 'rgba(234,229,219,.16)', texto: 'rgba(234,229,219,.62)' }
  : s === 'acima_mrv' ? { marca: '🔴', borda: 'rgba(229,72,77,.45)', texto: '#E5484D' }
  // 🔵 Acima do que o app monta sozinho e ainda dentro do teto — âmbar, não vermelho: é
  // escolha da pessoa, não limite ultrapassado.
  : s === 'acima_do_automatico' ? { marca: '🟡', borda: 'rgba(234,179,8,.45)', texto: '#EAB308' }
  : { marca: '⚪', borda: 'rgba(234,229,219,.2)', texto: 'rgba(234,229,219,.62)' };

const btnGhost: CSSProperties = {
  background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB',
  fontWeight: 600, fontSize: '.88rem', padding: '11px 15px', borderRadius: 12, cursor: 'pointer',
};
const btnIcone: CSSProperties = {
  background: 'rgba(234,229,219,.08)', border: '1px solid rgba(234,229,219,.3)', color: '#EAE5DB',
  width: 44, minWidth: 44, height: 44, borderRadius: 12, cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1,
};

/** Só para o teste de tipo do grupo — mantém o import de GrupoPrimario honesto. */
