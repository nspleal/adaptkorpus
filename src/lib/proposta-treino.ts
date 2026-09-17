/**
 * 🔁 PROPOSTA DE TREINO — "Gerar novo treino" e "Atualizar treino", antes de qualquer
 * gravação.
 *
 * As duas ações têm diferenças travadas aqui, não na tela:
 *
 *  · **Gerar novo treino** monta uma proposta AUTOMÁTICA nova com as preferências atuais.
 *    🔴 Ela é montada SEPARADAMENTE, com `rotinaCustom` fora da entrada — sem isso o motor
 *    devolveria o próprio desenho manual (que tem prioridade no montador) e "gerar novo"
 *    seria um botão que não gera nada. O desenho salvo **não é apagado**: ele continua no
 *    perfil vigente e só sai se a pessoa confirmar.
 *  · **Atualizar treino** ADAPTA o que existe: preserva todo exercício que continua elegível,
 *    a ordem, os dias e as séries escolhidas, e só preenche o que deixou de caber.
 *
 * 🔒 Nenhuma das duas escreve nada. Elas devolvem o PERFIL PROPOSTO e a rotina que ele gera;
 * quem grava é o chamador, depois da confirmação explícita. Cancelar é não usar o resultado.
 *
 * 🔒 Variedade só entre alternativas VÁLIDAS: a busca varia `variacaoTreino`, que desloca o
 * início da rotação dentro do pool já elegível (ver `alocador`). Nenhuma regra é afrouxada
 * para caber uma novidade — e quando as tentativas se esgotam sem montagem diferente, o
 * resultado DIZ `sem_alternativa` em vez de prometer um treino novo que não existe.
 *
 * Puro: o gerador entra por parâmetro (`gerar`), então o módulo não conhece storage, rede,
 * relógio nem React.
 */
import { VARIACAO_TREINO_MAX, VARIACOES_TENTATIVAS_MAX } from '@/lib/engine/treino-constants';
import { canonicalInputHash } from '@/lib/engine';
import type { DiaTreino, RotinaCustom, RotinaSemanal } from '@/lib/engine';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { EntradaPlanoVisivel } from '@/lib/plano-cas-comando';
import { ORDEM_SEMANA, type Weekday } from '@/lib/semana';

export type TipoDeProposta = 'gerar' | 'atualizar';

/** De onde o treino vem: montado pelo app, ou desenhado pela pessoa. */
export type OrigemDoTreino = 'automatico' | 'manual';

/**
 * Por que a proposta é (ou não é) diferente do treino vigente.
 *
 * 🔴 `sem_alternativa` é um RESULTADO, não uma falha: o catálogo elegível e as restrições
 * atuais não comportam outra montagem. A tela diz isso; não finge novidade.
 */
export type Variedade = 'nova' | 'sem_alternativa';

export interface MudancasDaProposta {
  /** Ids que continuam no MESMO dia da semana. */
  mantidos: readonly string[];
  /** Ids que passam a existir (num dia que já havia ou num dia novo). */
  adicionados: readonly string[];
  /** Ids que saem. Um id que só muda de dia aparece nas duas listas — e é verdade. */
  removidos: readonly string[];
  /** Dias da semana que ganham treino. */
  diasAdicionados: readonly Weekday[];
  /** Dias da semana que deixam de ter treino. */
  diasRemovidos: readonly Weekday[];
  /** Nada muda: mesmos dias, mesmos ids, mesma ordem. */
  identica: boolean;
}

/**
 * 🔴 O DESENHO SALVO muda mesmo quando a TELA não muda (defeito medido no QA de 16/09).
 *
 * O montador já DESCARTA da geração os ids do desenho que deixaram de ser elegíveis — então
 * banir um exercício não muda o plano exibido, mas ele continua guardado no perfil. Comparar
 * só as rotinas renderizadas dizia "nada a atualizar" enquanto havia, sim, o que atualizar.
 */
export interface DesenhoAlterado {
  mudou: boolean;
  /** Ids que saem do desenho salvo — vazio quando nada sai. */
  idsRemovidos: readonly string[];
}

export interface Proposta {
  tipo: TipoDeProposta;
  /** O perfil que, gravado, reproduz EXATAMENTE esta proposta no próximo recompute. */
  perfilProposto: PerfilResumo;
  /** A rotina que `perfilProposto` gera — o que a tela mostra antes de substituir. */
  rotina: RotinaSemanal;
  mudancas: MudancasDaProposta;
  origemAntes: OrigemDoTreino;
  origemDepois: OrigemDoTreino;
  /** Só informativo em `atualizar` (lá nunca se busca variedade). */
  variedade: Variedade;
  /** O que acontece com o DESENHO salvo. Ver `DesenhoAlterado`. */
  desenhoAlterado: DesenhoAlterado;
  /**
   * 🔒 A fotografia das ENTRADAS no instante em que a proposta foi montada. Quem aplica
   * compara com a assinatura de AGORA; diferente ⇒ a proposta está velha e a tela diz isso,
   * em vez de gravar um plano montado sobre preferências que não valem mais.
   *
   * Ausente só quando o chamador não passou a entrada (caminho de teste puro).
   */
  assinaturaDasEntradas?: string;
  /** Quantas montagens foram testadas antes de parar. Evidência da busca, não enfeite. */
  tentativas: number;
}

/** O gerador real do app, injetado: `recomputarPlano(perfil, opcoes).treino.rotina`. */
export type GerarRotina = (perfil: PerfilResumo) => RotinaSemanal | null;

/**
 * 🔒 OS DOIS CAMPOS QUE A PROPOSTA DECIDE. Tudo o mais no perfil é ENTRADA dela — e por isso
 * não pode ser sobrescrito por uma fotografia velha na hora de aplicar.
 */
const CAMPOS_DECIDIDOS = ['rotinaCustom', 'variacaoTreino'] as const;

/**
 * 🔴 A ASSINATURA DAS ENTRADAS que produziram a proposta.
 *
 * ⚠️ O defeito que ela fecha: a proposta guarda um perfil INTEIRO, e aplicá-lo mais tarde
 * devolveria ao perfil tudo o que mudou no meio do caminho — um banimento feito noutra aba,
 * uma âncora de mesociclo que o próprio app moveu, o peso que chegou de uma resposta
 * assíncrona. A pessoa aceitaria um treino e perderia, em silêncio, uma escolha mais nova.
 *
 * 🔒 Usa o MESMO `canonicalInputHash` do CAS — a autoridade que já existe para dizer "a
 * entrada que gerou este plano mudou". Os dois campos que a proposta DECIDE ficam de fora:
 * eles são a saída, não a entrada.
 */
export function assinaturaDasEntradas(perfil: PerfilResumo, entrada: EntradaPlanoVisivel): string {
  const semDecisao: Record<string, unknown> = { ...perfil };
  for (const campo of CAMPOS_DECIDIDOS) delete semDecisao[campo];
  return canonicalInputHash({ perfil: semDecisao, opcoes: entrada });
}

/**
 * 🔒 APLICAR = REBASE, nunca substituição. O perfil CORRENTE é a base; a proposta contribui
 * só com o que decidiu. O chamador compara `assinaturaDasEntradas` ANTES de chamar isto — se
 * a entrada mudou, a proposta está velha e não pode ser aplicada sem tratamento explícito.
 */
export function aplicarPropostaSobre(perfilAtual: PerfilResumo, proposta: Proposta): PerfilResumo {
  return {
    ...perfilAtual,
    rotinaCustom: proposta.perfilProposto.rotinaCustom,
    variacaoTreino: proposta.perfilProposto.variacaoTreino,
  };
}

/** Dia da semana de um dia do plano, com o mesmo fallback que o resto do app usa. */
function diaDoPlano(dia: DiaTreino, indice: number, agenda: readonly Weekday[]): Weekday {
  return dia.diaId ?? agenda[indice] ?? ORDEM_SEMANA[indice % ORDEM_SEMANA.length]!;
}

/** Ids por dia da semana — a forma canônica de comparar dois treinos. */
export function mapaPorDia(
  dias: readonly DiaTreino[],
  agenda: readonly Weekday[] = [],
): Map<Weekday, string[]> {
  const mapa = new Map<Weekday, string[]>();
  dias.forEach((d, i) => {
    const ids = d.slots.map((s) => s.exercicio.id);
    if (ids.length === 0) return;
    mapa.set(diaDoPlano(d, i, agenda), ids);
  });
  return mapa;
}

/**
 * A ASSINATURA de um treino: dias em ordem da semana, ids na ordem do dia.
 *
 * 🔒 A ordem entra de propósito — trocar a ordem dos exercícios de um dia é uma semana
 * diferente para quem treina, e chamar isso de "igual" seria a tela mentindo.
 */
export function assinaturaDoTreino(
  dias: readonly DiaTreino[],
  agenda: readonly Weekday[] = [],
): string {
  const mapa = mapaPorDia(dias, agenda);
  return ORDEM_SEMANA.filter((d) => mapa.has(d))
    .map((d) => `${d}:${mapa.get(d)!.join(',')}`).join('|');
}

/** O que muda do treino vigente para a proposta, por dia da semana. */
export function compararTreinos(
  antes: readonly DiaTreino[],
  depois: readonly DiaTreino[],
  agenda: readonly Weekday[] = [],
): MudancasDaProposta {
  const a = mapaPorDia(antes, agenda);
  const b = mapaPorDia(depois, agenda);
  const mantidos: string[] = [];
  const adicionados: string[] = [];
  const removidos: string[] = [];
  for (const dia of ORDEM_SEMANA) {
    const antesIds = a.get(dia) ?? [];
    const depoisIds = b.get(dia) ?? [];
    for (const id of depoisIds) (antesIds.includes(id) ? mantidos : adicionados).push(id);
    for (const id of antesIds) if (!depoisIds.includes(id)) removidos.push(id);
  }
  return {
    mantidos,
    adicionados,
    removidos,
    diasAdicionados: ORDEM_SEMANA.filter((d) => b.has(d) && !a.has(d)),
    diasRemovidos: ORDEM_SEMANA.filter((d) => a.has(d) && !b.has(d)),
    identica: assinaturaDoTreino(antes, agenda) === assinaturaDoTreino(depois, agenda),
  };
}

/**
 * 🧭 ATUALIZAR UM DESENHO MANUAL — o que ainda cabe é preservado; só o resto é preenchido.
 *
 * Preserva: os exercícios ainda elegíveis, na ORDEM em que a pessoa os pôs; o nome do dia; as
 * séries que ela escolheu para os que ficaram; e o dia da semana, quando ele continua na
 * agenda.
 *
 * Preenche/ajusta apenas o que a preferência atual invalidou:
 *  · exercício que saiu do pool (banido, equipamento perdido, acima do nível) é removido;
 *  · dia cujo `diaId` saiu da agenda vai para um dia de treino ainda livre — e, se não houver
 *    nenhum, sai (a agenda é a decisão da pessoa, e inventar um dia seria escolher por ela);
 *  · dia que ficou VAZIO e dia de agenda que o desenho não cobre recebem o dia correspondente
 *    da proposta automática — quando ela tem um para aquele dia da semana. Se não tiver, nada
 *    é inventado.
 *
 * 🔒 `origem` continua `'usuario'`: atualizar um desenho manual não o converte em automático.
 */
export function atualizarDesenho(
  custom: RotinaCustom,
  args: {
    elegiveis: ReadonlySet<string>;
    /** Agenda atual (`perfil.treinoDias`), em ordem da semana. */
    agenda: readonly Weekday[];
    /** Dias da proposta automática, para preencher o que o desenho não cobre. */
    automatico: readonly DiaTreino[];
  },
): RotinaCustom {
  const agenda = ORDEM_SEMANA.filter((d) => args.agenda.includes(d));
  const doAutomatico = mapaPorDia(args.automatico, agenda);
  const nomeAutomatico = new Map<Weekday, string>();
  args.automatico.forEach((d, i) => {
    if (d.slots.length > 0) nomeAutomatico.set(diaDoPlano(d, i, agenda), d.nome);
  });

  const podados = custom.dias.map((d, i) => ({
    ...d,
    diaId: d.diaId ?? agenda[i],
    exercicioIds: d.exercicioIds.filter((id) => args.elegiveis.has(id)),
  }));

  // 1) Quem já está num dia da agenda fica onde está. Um dia por dia da semana.
  const ocupados = new Set<Weekday>();
  const fixos = podados.filter((d) => {
    if (!d.diaId || !agenda.includes(d.diaId) || ocupados.has(d.diaId)) return false;
    ocupados.add(d.diaId);
    return true;
  });
  // 2) Os demais ocupam, em ordem, os dias de treino que sobraram. Sem dia livre, saem.
  const soltos = podados.filter((d) => !fixos.includes(d));
  const livres = agenda.filter((d) => !ocupados.has(d));
  const realocados = soltos.flatMap((d, i) => {
    const destino = livres[i];
    if (!destino) return [];
    ocupados.add(destino);
    return [{ ...d, diaId: destino }];
  });

  const porDia = new Map<Weekday, (typeof podados)[number]>();
  for (const d of [...fixos, ...realocados]) if (d.diaId) porDia.set(d.diaId, d);

  const dias = agenda.flatMap((dia) => {
    const desenho = porDia.get(dia);
    const ids = desenho?.exercicioIds ?? [];
    if (ids.length > 0) {
      const series = Object.fromEntries(
        Object.entries(desenho!.seriesPorExercicio ?? {}).filter(([id]) => ids.includes(id)),
      );
      return [{
        ...(desenho!.referenciaDose ? { referenciaDose: desenho!.referenciaDose } : {}),
        nome: desenho!.nome,
        diaId: dia,
        exercicioIds: ids,
        ...(Object.keys(series).length > 0 ? { seriesPorExercicio: series } : {}),
      }];
    }
    // 3) Vazio ou inexistente: o dia automático correspondente, se existir. Nunca inventado.
    const automatico = doAutomatico.get(dia);
    if (!automatico || automatico.length === 0) return [];
    return [{ nome: desenho?.nome ?? nomeAutomatico.get(dia) ?? 'Treino', diaId: dia, exercicioIds: [...automatico] }];
  });

  return { origem: 'usuario', dias };
}

/** A sequência de variações a testar, começando pela vigente e sem sair do teto de forma. */
function variacoesATestar(atual: number, tentativas: number): number[] {
  const total = VARIACAO_TREINO_MAX + 1;
  const base = Math.max(0, Math.trunc(atual)) % total;
  return Array.from({ length: Math.min(tentativas, total) }, (_, k) => (base + k) % total);
}

/**
 * Monta a proposta. Devolve `null` quando o motor não entrega rotina nenhuma (gate ROTEAR,
 * perfil suspenso) — e aí a tela não tem o que propor, o que também é um resultado honesto.
 */
export function proporTreino(args: {
  tipo: TipoDeProposta;
  perfil: PerfilResumo;
  /** O treino que está na tela agora — a referência da comparação. */
  rotinaAtual: readonly DiaTreino[];
  gerar: GerarRotina;
  /** Pool elegível atual, só para `atualizar`. */
  elegiveis?: ReadonlySet<string>;
  /** Entrada canônica desta geração — vira a assinatura que detecta proposta velha. */
  entrada?: EntradaPlanoVisivel;
  tentativas?: number;
}): Proposta | null {
  const { perfil, rotinaAtual, gerar } = args;
  const agenda = ORDEM_SEMANA.filter((d) => (perfil.treinoDias ?? []).includes(d));
  const origemAntes: OrigemDoTreino = perfil.rotinaCustom ? 'manual' : 'automatico';
  const assinatura = args.entrada ? assinaturaDasEntradas(perfil, args.entrada) : undefined;

  if (args.tipo === 'atualizar') return propostaDeAtualizacao({ ...args, agenda, origemAntes, assinatura });

  /**
   * 🔴 A proposta automática é montada com `rotinaCustom` FORA da entrada. É a diferença
   * entre "gerar" e "devolver o que já existe": com o desenho na entrada, o montador o
   * respeita (é a DF② do editor) e nenhuma montagem nova apareceria.
   *
   * ⚠️ O perfil vigente NÃO é tocado — `base` é uma cópia. O desenho salvo só sai do perfil
   * se a pessoa confirmar a substituição.
   */
  const base: PerfilResumo = { ...perfil, rotinaCustom: undefined };
  const atual = assinaturaDoTreino(rotinaAtual, agenda);
  const candidatas = variacoesATestar(perfil.variacaoTreino ?? 0, args.tentativas ?? VARIACOES_TENTATIVAS_MAX);

  let primeira: { rotina: RotinaSemanal; perfilProposto: PerfilResumo } | null = null;
  let tentativas = 0;
  for (const variacao of candidatas) {
    tentativas += 1;
    const perfilProposto: PerfilResumo = variacao > 0
      ? { ...base, variacaoTreino: variacao }
      : { ...base, variacaoTreino: undefined };
    const rotina = gerar(perfilProposto);
    if (!rotina) continue;
    primeira ??= { rotina, perfilProposto };
    if (assinaturaDoTreino(rotina.dias, agenda) !== atual) {
      return montar({
        tipo: 'gerar', perfil, perfilProposto, rotina, rotinaAtual, agenda, assinatura,
        origemAntes, origemDepois: 'automatico', variedade: 'nova', tentativas,
      });
    }
  }
  if (!primeira) return null;
  // Nenhuma das montagens testadas difere da atual. Isso é dito, não maquiado.
  return montar({
    tipo: 'gerar', perfil, perfilProposto: primeira.perfilProposto, rotina: primeira.rotina,
    rotinaAtual, agenda, origemAntes, origemDepois: 'automatico', assinatura,
    variedade: 'sem_alternativa', tentativas,
  });
}

function propostaDeAtualizacao(args: {
  perfil: PerfilResumo;
  rotinaAtual: readonly DiaTreino[];
  gerar: GerarRotina;
  elegiveis?: ReadonlySet<string>;
  agenda: readonly Weekday[];
  origemAntes: OrigemDoTreino;
  assinatura: string | undefined;
}): Proposta | null {
  const { perfil, rotinaAtual, gerar, agenda, origemAntes } = args;
  const custom = perfil.rotinaCustom;
  if (!custom) {
    /**
     * Plano AUTOMÁTICO: ele já é recomputado das preferências vigentes a cada mudança, então
     * "atualizar" não tem o que adaptar. A proposta é o próprio plano — e `identica` é o que
     * faz a tela dizer isso, em vez de encenar uma atualização que não aconteceu.
     */
    const rotina = gerar(perfil);
    if (!rotina) return null;
    return montar({
      tipo: 'atualizar', perfil, perfilProposto: { ...perfil }, rotina, rotinaAtual, agenda,
      origemAntes, origemDepois: 'automatico', variedade: 'sem_alternativa', tentativas: 1,
      assinatura: args.assinatura,
    });
  }

  // Para preencher o que deixou de caber, precisa-se da montagem automática de referência.
  const automatica = gerar({ ...perfil, rotinaCustom: undefined });
  const atualizado = atualizarDesenho(custom, {
    elegiveis: args.elegiveis ?? new Set(),
    agenda,
    automatico: automatica?.dias ?? [],
  });
  const perfilProposto: PerfilResumo = atualizado.dias.length > 0
    ? { ...perfil, rotinaCustom: atualizado }
    // Desenho inteiro invalidado e nada automático para pôr no lugar: o campo sai, e o app
    // volta a montar. Manter um desenho vazio seria guardar um treino que não existe.
    : { ...perfil, rotinaCustom: undefined };
  const rotina = gerar(perfilProposto);
  if (!rotina) return null;
  return montar({
    tipo: 'atualizar', perfil, perfilProposto, rotina, rotinaAtual, agenda, origemAntes,
    origemDepois: perfilProposto.rotinaCustom ? 'manual' : 'automatico',
    variedade: 'sem_alternativa', tentativas: 1, assinatura: args.assinatura,
  });
}

/** A forma canônica de um desenho, para comparar dois deles sem depender de chave ausente. */
function formaDoDesenho(custom: RotinaCustom | undefined): string {
  if (!custom) return '';
  return JSON.stringify(custom.dias.map((d) => [d.diaId ?? '', d.exercicioIds, d.seriesPorExercicio ?? {}]));
}

function desenhoAlterado(antes: RotinaCustom | undefined, depois: RotinaCustom | undefined): DesenhoAlterado {
  const idsAntes = new Set((antes?.dias ?? []).flatMap((d) => d.exercicioIds));
  const idsDepois = new Set((depois?.dias ?? []).flatMap((d) => d.exercicioIds));
  return {
    mudou: formaDoDesenho(antes) !== formaDoDesenho(depois),
    idsRemovidos: [...idsAntes].filter((id) => !idsDepois.has(id)),
  };
}

function montar(args: {
  tipo: TipoDeProposta;
  perfil: PerfilResumo;
  perfilProposto: PerfilResumo;
  rotina: RotinaSemanal;
  rotinaAtual: readonly DiaTreino[];
  agenda: readonly Weekday[];
  origemAntes: OrigemDoTreino;
  origemDepois: OrigemDoTreino;
  variedade: Variedade;
  tentativas: number;
  assinatura?: string | undefined;
}): Proposta {
  return {
    ...(args.assinatura ? { assinaturaDasEntradas: args.assinatura } : {}),
    tipo: args.tipo,
    perfilProposto: args.perfilProposto,
    rotina: args.rotina,
    mudancas: compararTreinos(args.rotinaAtual, args.rotina.dias, args.agenda),
    origemAntes: args.origemAntes,
    origemDepois: args.origemDepois,
    variedade: args.variedade,
    desenhoAlterado: desenhoAlterado(args.perfil.rotinaCustom, args.perfilProposto.rotinaCustom),
    tentativas: args.tentativas,
  };
}
