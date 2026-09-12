/**
 * Escadas de dificuldade — progressão VERTICAL ("sobe de variação"), só peso corporal.
 * Fonte TRAVADA: cofre `fontes/ranking-exercicios-adaptkorpus` §"Escadas de dificuldade"
 * (DF 2026-07-03). Portado do motor standalone do autor (`motor-exercicios.ts`) para os
 * IDs REAIS do app: `"eN"`, onde N é exatamente o `#` do ranking A1 (mapeamento lossless).
 *
 * Natureza (cofre §Passo 2): a dificuldade tem dois eixos. O eixo GROSSO é o atributo
 * `nivel` (governa o que a troca/seleção liberam). O eixo FINO, aqui, é a POSIÇÃO na
 * escada de peso corporal — o que vem DEPOIS quando o movimento fica fácil. Com CARGA a
 * progressão é por PESO (não por variação), por isso os exercícios com carga não têm
 * escada e a função devolve `null` para eles.
 *
 * Contrato: é HINT (o app sugere; o usuário escolhe — nada auto-troca). Um degrau com
 * vários ids = variantes equivalentes na MESMA dificuldade. Regressão ("Difícil" 2×) = a
 * mesma escada ao contrário. RESPEITA equipamento: degrau indisponível → sem hint (não
 * pula degrau — regra do cofre "barra fixa exige barra"). Puro, determinístico, sem I/O.
 */
import { exercicioDisponivel } from './equipamento';
import type { EquipamentoCasa, EquipamentoDisp, Exercise } from '../data/types';

/** Um degrau = um ou mais IDs equivalentes na mesma dificuldade (ordem estável). */
export type Degrau = readonly string[];

/**
 * As 10 escadas travadas do cofre (35 exercícios), com IDs reais do app.
 * Ordem do array = do mais fácil (base) ao mais difícil (topo).
 * 5 degraus exigem implemento (e22/e21 barra · e88 barra · e8 roda · e102 halter) —
 * o hint filtra por equipamento (ver `filtrarDegrau`).
 */
export const ESCADAS_DIFICULDADE: Readonly<Record<string, readonly Degrau[]>> = {
  empurrarHorizontal: [['e157'], ['e156'], ['e1'], ['e113'], ['e2'], ['e100']],
  empurrarVertical: [['e114']], // topo em peso corporal; acima → desenvolvimento COM carga
  agachar: [['e3'], ['e16', 'e160', 'e17'], ['e78'], ['e145']],
  // 🔒 DF do autor 2026-08-15 — a escada de puxar ganhou os degraus do meio que faltavam.
  // Antes: e116 → e22 → e21, um salto de "remada na mesa" direto para "barra fixa", que em
  // casa-sem simplesmente não tinha continuação. Agora a rampa de peso corporal é inteira,
  // e o ramo da barra continua no fim: e165 ⟶ (com barra_fixa) e22 → e21.
  // O ramo NÃO precisa de código: `filtrarDegrau` já devolve `null` quando o degrau inteiro
  // é indisponível ("não pula degrau"), então em casa-sem o topo é e165 e com barra o
  // caminho segue. 📌 e167/e168 ficam FORA da malha por decisão — são laterais do e116
  // (mesma dificuldade), não degraus.
  puxar: [['e116'], ['e166'], ['e164'], ['e165'], ['e22'], ['e21']],
  dobradicaGluteo: [['e57'], ['e58', 'e59'], ['e161']],
  dobradicaPosterior: [['e86'], ['e83']],
  coreFlexaoTronco: [['e4'], ['e149'], ['e85'], ['e115'], ['e88']],
  coreEstabilidade: [['e148', 'e147'], ['e7'], ['e146'], ['e8']], // holds sobem por tempo dentro do degrau
  coreObliquo: [['e102', 'e101'], ['e90'], ['e91']],
  panturrilha: [['e36'], ['e37']],
};

/** Localiza um exercício na malha de escadas (qual escada, qual degrau). */
export function localizarNaEscada(id: string): { escada: string; degrau: number } | null {
  for (const [escada, degraus] of Object.entries(ESCADAS_DIFICULDADE)) {
    const degrau = degraus.findIndex((d) => d.includes(id));
    if (degrau !== -1) return { escada, degrau };
  }
  return null;
}

/**
 * Filtra um degrau pelo equipamento do usuário: mantém só os ids cujo `local` é
 * permitido. Sem `exercises`/`equipamento`, devolve o degrau bruto. Se o degrau inteiro
 * for indisponível → `null` (sem hint; NÃO pula degrau).
 */
function filtrarDegrau(
  degrau: Degrau | undefined,
  exercises?: readonly Exercise[],
  equipamento?: EquipamentoDisp,
  equipamentosCasa?: readonly EquipamentoCasa[],
): string[] | null {
  if (!degrau) return null;
  if (!exercises || !equipamento) return [...degrau];
  // "Barra fixa exige barra" (cofre) agora é literal: exige `barra_fixa` MARCADA no
  // checklist de casa (modelo 2 níveis — exercicioDisponivel).
  const ok = degrau.filter((id) => {
    const e = exercises.find((x) => x.id === id);
    return !!e && exercicioDisponivel(e, equipamento, equipamentosCasa);
  });
  return ok.length > 0 ? ok : null; // degrau inteiro indisponível → sem hint
}

/**
 * Hint "sobe de variação": IDs do PRÓXIMO degrau (respeitando equipamento se fornecido),
 * ou `null` (topo · fora da malha · com carga · degrau indisponível). Chamar no ramo
 * "Fácil" do Passo 2, DEPOIS do "+1 série até o teto" — o app sugere, o usuário escolhe.
 */
export function sugerirProximaVariacao(
  id: string,
  exercises?: readonly Exercise[],
  equipamento?: EquipamentoDisp,
  equipamentosCasa?: readonly EquipamentoCasa[],
): string[] | null {
  const loc = localizarNaEscada(id);
  if (!loc) return null;
  return filtrarDegrau(ESCADAS_DIFICULDADE[loc.escada]![loc.degrau + 1], exercises, equipamento, equipamentosCasa);
}

/** Regressão: IDs do degrau ANTERIOR, ou `null` (base · fora da malha). */
export function sugerirVariacaoAnterior(
  id: string,
  exercises?: readonly Exercise[],
  equipamento?: EquipamentoDisp,
  equipamentosCasa?: readonly EquipamentoCasa[],
): string[] | null {
  const loc = localizarNaEscada(id);
  if (!loc) return null;
  return filtrarDegrau(ESCADAS_DIFICULDADE[loc.escada]![loc.degrau - 1], exercises, equipamento, equipamentosCasa);
}

/** Posição legível p/ a UI ("degrau 3 de 6") — insumo do componente de escada visual. */
export function posicaoNaEscada(id: string): { degrau: number; total: number; escada: string } | null {
  const loc = localizarNaEscada(id);
  if (!loc) return null;
  return { degrau: loc.degrau + 1, total: ESCADAS_DIFICULDADE[loc.escada]!.length, escada: loc.escada };
}

/** Um degrau resolvido p/ exibição: id representativo (1º do degrau) + nome + se é o atual. */
export interface DegrauComNome {
  idRepresentativo: string;
  nome: string;
  atual: boolean;
}

/**
 * A escada INTEIRA do exercício com nomes resolvidos — insumo da lista expandida
 * read-only e do seletor de degraus (V8.3 §1 / V8.1 Corpo B). Degraus com vários ids
 * (variantes equivalentes) usam o 1º id como representante. A lista mostra a escada
 * COMPLETA (leitura) — a disponibilidade de equipamento só governa os HINTS
 * (`sugerirProximaVariacao`/`Anterior`), não a visualização.
 * Retorna null p/ exercício fora da malha (com carga / one-off).
 */
export function escadaComNomes(
  id: string,
  exercicioPorId: (id: string) => { nomePt: string } | undefined,
): { degraus: DegrauComNome[]; degrau: number; total: number } | null {
  const loc = localizarNaEscada(id);
  if (!loc) return null;
  const escada = ESCADAS_DIFICULDADE[loc.escada]!;
  const degraus = escada.map((d, i) => ({
    idRepresentativo: d[0]!,
    nome: exercicioPorId(d[0]!)?.nomePt ?? d[0]!,
    atual: i === loc.degrau,
  }));
  return { degraus, degrau: loc.degrau + 1, total: escada.length };
}
