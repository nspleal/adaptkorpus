/**
 * 🦴 COBERTURA MUSCULAR DO DIA EM EDIÇÃO — o que os exercícios escolhidos abordam, o que
 * ficou sem exercício identificado, e o que o catálogo elegível ainda oferece.
 *
 * 🔒 NÃO É PESQUISA NOVA. Todo fato vem das MESMAS funções que o motor e o detalhe do
 * exercício já usam (`alvosDoExercicio`, `candidatosParaAlvo`, `ALVOS_ANATOMICOS`,
 * `alvosDesejadosDoDia`, `diretosDoExercicio`). Este módulo só recorta o que já existe para a
 * pergunta do editor — "estou deixando alguma parte destes grupos sem exercício?" — e nada
 * aqui reclassifica, pontua ou pesa exercício.
 *
 * 🔴 O que ele deliberadamente NÃO faz:
 *  · não afirma dose suficiente, ênfase predominante nem hipertrofia — presença anatômica é
 *    presença anatômica (`RESSALVA_COBERTURA`);
 *  · não diz "esta região não é ativada". Diz **sem exercício identificado para esta região**,
 *    que é o que o dado sustenta;
 *  · não presume condição de execução: alvo que só é direto sob uma execução NÃO DECLARADA
 *    fica PENDENTE — nem coberto, nem negado;
 *  · não inventa cobertura para lacuna do catálogo: alvo sem candidato é declarado como tal;
 *  · não exige um exercício por parte — um exercício pode fechar várias, e é por isso que a
 *    conta é por PARTE abordada, nunca por exercício;
 *  · não bloqueia, não adiciona, não substitui e não remove nada: é diagnóstico.
 *
 * PURO e determinístico.
 */
import type { Exercise, GrupoPrimario } from '../data/types';
import type { AlvoId, CondicaoExecucao, TipoDeAlvo } from '../data/alvos-anatomicos-tipos';
import {
  ALVOS_ANATOMICOS, ANATOMIA_POR_EXERCICIO, RESSALVA_COBERTURA, alvosDoExercicio,
  candidatosParaAlvo,
} from '../data/alvos-anatomicos';
import { GRUPOS_COM_ALVOS, alvosDesejadosDoDia } from './cobertura-anatomica';

/**
 * Estado de UMA parte (alvo) dentro dos grupos do dia.
 *
 * 🔴 Os três primeiros são graus de EVIDÊNCIA diferentes e não se colapsam: identificada é
 * ação direta declarada; auxiliar é participação por inferência anatômica que **não fecha**
 * cobertura; pendente é informação que falta, não ausência de fenômeno.
 */
export type EstadoDaParte =
  /** Algum exercício escolhido a aborda como alvo DIRETO (sem depender de condição). */
  | 'identificada'
  /** Só participação AUXILIAR entre os escolhidos. Participa; não fecha cobertura direta. */
  | 'participacao_auxiliar'
  /** Seria direta sob uma execução que não foi declarada. Nem coberta, nem negada. */
  | 'condicional_pendente'
  /** Nenhum escolhido a aborda, e o catálogo elegível oferece alternativa. */
  | 'sem_exercicio_identificado'
  /** Há candidato no catálogo, nenhum elegível com o equipamento/nível atuais. */
  | 'sem_candidato_elegivel'
  /** Lacuna do CATÁLOGO: nenhum exercício a aborda diretamente, em condição nenhuma. */
  | 'sem_candidato_no_catalogo';

/** Sugestão elegível para uma parte sem exercício identificado. */
export interface SugestaoDeParte {
  id: string;
  /**
   * `true` quando a cobertura deste candidato depende de uma execução declarada. A tela
   * precisa dizer isso: prometer cobertura garantida aqui seria inventar a condição.
   */
  dependeDeExecucao: boolean;
  /** As condições que tornariam a cobertura direta — vazio quando ela já é incondicional. */
  condicoes: readonly CondicaoExecucao[];
}

export interface ParteDoGrupo {
  alvo: AlvoId;
  /** Nome humano da ficha do pacote — nunca o id interno. */
  nome: string;
  /** Porção/cabeça dentro do músculo, quando há. */
  parte: string | null;
  tipo: TipoDeAlvo;
  estado: EstadoDaParte;
  /** Ids ESCOLHIDOS que a abordam diretamente (`identificada`). */
  porExercicios: readonly string[];
  /** Ids ESCOLHIDOS cuja participação é auxiliar (`participacao_auxiliar`). */
  auxiliaresNoDia: readonly string[];
  /** Condição pendente de um id ESCOLHIDO (`condicional_pendente`). */
  condicoesPendentes: readonly { exercicioId: string; quando: CondicaoExecucao }[];
  /** Alternativas elegíveis, já sem os que estão no dia. Vazio quando não há. */
  sugestoes: readonly SugestaoDeParte[];
}

export interface CoberturaDoGrupo {
  grupo: GrupoPrimario;
  partes: readonly ParteDoGrupo[];
  /** Partes com ação direta identificada. */
  identificadas: number;
  /** Partes sem exercício identificado, em qualquer um dos três motivos. */
  semExercicio: number;
}

export interface CoberturaDoDia {
  nome: string;
  grupos: readonly CoberturaDoGrupo[];
  /** Ids do dia que o pacote anatômico não classifica. Ausência de DADO, não de fenômeno. */
  semClassificacao: readonly string[];
  identificadas: number;
  semExercicio: number;
  ressalva: string;
}

const ESTADOS_SEM_EXERCICIO: ReadonlySet<EstadoDaParte> = new Set<EstadoDaParte>([
  'sem_exercicio_identificado', 'sem_candidato_elegivel', 'sem_candidato_no_catalogo',
]);

/** Quantas alternativas a tela mostra por parte. Teto de LEITURA, não de catálogo. */
const SUGESTOES_POR_PARTE = 3;

/**
 * Grupos do DIA = os grupos primários dos exercícios que a pessoa escolheu, e só eles.
 *
 * 🔴 É o que impede a tela de listar o corpo inteiro como faltante: um dia de peito e
 * tríceps não deve nada a panturrilha. Grupo fora de `GRUPOS_COM_ALVOS` (nenhum hoje) e id
 * sem grupo (cardio) ficam de fora — o pacote não tem alvo para eles.
 */
export function gruposDoDia(escolhidos: readonly Exercise[]): GrupoPrimario[] {
  const admitidos = new Set<GrupoPrimario>(GRUPOS_COM_ALVOS);
  const vistos = new Set<GrupoPrimario>();
  for (const e of escolhidos) {
    if (e.padraoMovimento === 'cardio') continue;
    if (e.grupoPrimario && admitidos.has(e.grupoPrimario)) vistos.add(e.grupoPrimario);
  }
  return GRUPOS_COM_ALVOS.filter((g) => vistos.has(g));
}

/** Consulta segura: id fora do pacote não derruba a tela, é declarado em `semClassificacao`. */
function consultar(id: string, condicoes?: CondicaoExecucao) {
  if (!Object.hasOwn(ANATOMIA_POR_EXERCICIO, id)) return null;
  try {
    return alvosDoExercicio(id, condicoes);
  } catch {
    // Condição inválida vinda de fora: cai para a consulta SEM condição. Nunca presume.
    return alvosDoExercicio(id);
  }
}

/**
 * A cobertura de um dia do editor.
 *
 * `elegiveis` deve ser o pool do motor (`poolElegivel`) — a mesma autoridade que decide o que
 * entra no plano. Passar o catálogo inteiro faria a tela sugerir o que o motor recusa.
 */
export function coberturaDoDia(args: {
  nome: string;
  /** Os exercícios que a pessoa colocou neste dia, na ordem. */
  escolhidos: readonly Exercise[];
  /** Pool elegível (equipamento + nível + banidos/preteridos), de `poolElegivel`. */
  elegiveis: readonly Exercise[];
  /**
   * Condições de execução DECLARADAS por id. Hoje o app não declara nenhuma — e é por isso
   * que o estado `condicional_pendente` existe em vez de uma suposição.
   */
  condicoesPorId?: Readonly<Record<string, CondicaoExecucao>>;
  maxSugestoes?: number;
}): CoberturaDoDia {
  const grupos = gruposDoDia(args.escolhidos);
  const desejados = alvosDesejadosDoDia(grupos);
  const idsNoDia = new Set(args.escolhidos.map((e) => e.id));
  const elegiveis = new Set(args.elegiveis.map((e) => e.id));
  const maxSugestoes = args.maxSugestoes ?? SUGESTOES_POR_PARTE;

  const diretos = new Map<AlvoId, string[]>();
  const auxiliares = new Map<AlvoId, string[]>();
  const pendentes = new Map<AlvoId, { exercicioId: string; quando: CondicaoExecucao }[]>();
  const semClassificacao: string[] = [];

  for (const e of args.escolhidos) {
    const consulta = consultar(e.id, args.condicoesPorId?.[e.id]);
    if (!consulta) { semClassificacao.push(e.id); continue; }
    for (const a of consulta.alvos) {
      if (!desejados.has(a.alvo)) continue;
      const destino = a.papel === 'direto' ? diretos : a.papel === 'auxiliar' ? auxiliares : null;
      if (!destino) continue; // informativo_cardio nunca conta como abordado
      const lista = destino.get(a.alvo) ?? [];
      if (!lista.includes(e.id)) lista.push(e.id);
      destino.set(a.alvo, lista);
    }
    for (const c of consulta.condicionaisNaoResolvidas) {
      if (c.papel !== 'direto') continue;
      for (const alvo of c.alvos) {
        if (!desejados.has(alvo)) continue;
        const lista = pendentes.get(alvo) ?? [];
        lista.push({ exercicioId: e.id, quando: c.quando });
        pendentes.set(alvo, lista);
      }
    }
  }

  const porGrupo: CoberturaDoGrupo[] = grupos.map((grupo) => {
    const alvosDoGrupo = [...desejados].filter((a) => ALVOS_ANATOMICOS[a]!.grupo === grupo).sort();
    const partes = alvosDoGrupo.map<ParteDoGrupo>((alvo) => {
      const ficha = ALVOS_ANATOMICOS[alvo]!;
      const base = {
        alvo,
        nome: ficha.nome,
        parte: ficha.parte,
        tipo: ficha.tipo,
        porExercicios: diretos.get(alvo) ?? [],
        auxiliaresNoDia: auxiliares.get(alvo) ?? [],
        condicoesPendentes: pendentes.get(alvo) ?? [],
      };
      if (base.porExercicios.length > 0) return { ...base, estado: 'identificada', sugestoes: [] };
      if (base.auxiliaresNoDia.length > 0) return { ...base, estado: 'participacao_auxiliar', sugestoes: [] };
      if (base.condicoesPendentes.length > 0) return { ...base, estado: 'condicional_pendente', sugestoes: [] };

      const { diretos: candidatosDiretos, condicionais } = candidatosParaAlvo(alvo);
      const incondicionais = candidatosDiretos.filter((id) => elegiveis.has(id) && !idsNoDia.has(id));
      const sobCondicao = condicionais.filter((id) => elegiveis.has(id) && !idsNoDia.has(id)
        && !incondicionais.includes(id));
      const sugestoes: SugestaoDeParte[] = [
        ...incondicionais.map((id) => ({ id, dependeDeExecucao: false, condicoes: [] as readonly CondicaoExecucao[] })),
        ...sobCondicao.map((id) => ({
          id,
          dependeDeExecucao: true,
          condicoes: ANATOMIA_POR_EXERCICIO[id]!.condicionais
            .filter((c) => c.papel === 'direto' && c.alvos.includes(alvo))
            .map((c) => c.quando),
        })),
      ].slice(0, maxSugestoes);

      const estado: EstadoDaParte = sugestoes.length > 0
        ? 'sem_exercicio_identificado'
        : candidatosDiretos.length === 0 && condicionais.length === 0
          ? 'sem_candidato_no_catalogo'
          : 'sem_candidato_elegivel';
      return { ...base, estado, sugestoes };
    });
    return {
      grupo,
      partes,
      identificadas: partes.filter((p) => p.estado === 'identificada').length,
      semExercicio: partes.filter((p) => ESTADOS_SEM_EXERCICIO.has(p.estado)).length,
    };
  });

  return {
    nome: args.nome,
    grupos: porGrupo,
    semClassificacao,
    identificadas: porGrupo.reduce((n, g) => n + g.identificadas, 0),
    semExercicio: porGrupo.reduce((n, g) => n + g.semExercicio, 0),
    ressalva: RESSALVA_COBERTURA,
  };
}
