/**
 * "Cansei deste prato" — descanso na rotação (cofre, parametros-motor-substituicao-adaptkorpus
 * §Variedade, DF 2026-07-01). É do nível do **PRATO** (rotação), distinto do "não curto" (nível
 * do alimento): cansaço de receita ≠ desgosto do ingrediente.
 *
 * Puro e sem relógio embutido — o "agora" entra por parâmetro. Assim o prazo de 21 dias e o
 * retorno automático ficam **fora do motor determinístico** (que nunca lê relógio) e também
 * fora de qualquer dependência de React/Next, para serem testáveis em isolamento.
 */

/** Prato em descanso: id do prato + quando ele retorna automaticamente à rotação (ISO). */
export interface PratoCansado {
  id: string;
  ate: string;
}

/** Janela de descanso de um prato marcado como "Cansei deste prato". */
export const DESCANSO_PRATO_DIAS = 21;

const DIA_MS = 86_400_000;

/**
 * Marca um prato como "cansado" a partir de `agora`, com retorno automático em 21 dias.
 * Se o prato já estava em descanso, substitui a entrada (reinicia a contagem).
 */
export function marcarPratoCansado(
  atual: readonly PratoCansado[],
  pratoId: string,
  agora: Date = new Date(),
): PratoCansado[] {
  const ate = new Date(agora.getTime() + DESCANSO_PRATO_DIAS * DIA_MS).toISOString();
  return [...atual.filter((c) => c.id !== pratoId), { id: pratoId, ate }];
}

/**
 * IDs dos pratos ainda em descanso (não expirados) em `agora`. O retorno automático de 21 dias
 * é resolvido aqui — o motor recebe só a lista já resolvida.
 */
export function pratosCansadosAtivos(
  cansados: readonly PratoCansado[] | undefined,
  agora: Date = new Date(),
): string[] {
  if (!Array.isArray(cansados)) return [];
  const t = agora.getTime();
  return cansados
    .filter((c) => c && typeof c.ate === 'string' && Date.parse(c.ate) > t)
    .map((c) => c.id);
}
