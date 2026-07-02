/**
 * Marcos de constância — celebração leve de dias de treino, NUNCA punitiva.
 *
 * Regra travada (handoff V6.2 §Peça5): conta **dias distintos** com ≥1 treino concluído; é
 * **cumulativo por nível**, nunca uma sequência (streak) que zera. Uma pausa não subtrai
 * nem reseta — só não soma. Pura e sem relógio embutido (o "hoje" entra por parâmetro): a
 * detecção de hiato usa datas passadas explicitamente.
 */

export type MarcoMode = 'progresso' | 'atingido' | 'poshiato';

export interface Marco {
  atual: number;      // dias acumulados (exibidos; cap em 30 no nível 2)
  tier: 7 | 30;       // marco atual
  restantes: number;  // dias que faltam para o tier
  mode: MarcoMode;
}

/** Nº de dias DISTINTOS com treino (a partir das datas ISO das sessões). */
export function diasDeTreino(datasISO: readonly string[]): number {
  return new Set(datasISO.filter(Boolean)).size;
}

/** Dias inteiros entre duas datas ISO (b − a); NaN-safe → 0. */
export function diasEntreISO(aISO: string, bISO: string): number {
  const a = Date.parse(aISO + 'T00:00:00Z');
  const b = Date.parse(bISO + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Estado do marco a partir dos dias acumulados. `diasDesdeUltimo` (opcional) dispara o estado
 * pós-hiato quando ≥ 7 (voltou depois de uma pausa) e ainda não está no momento de celebração.
 * Nível 1 = 7 dias, nível 2 = 30 dias; ≥30 fica em 30/30 (o que vem depois é decisão de produto).
 */
export function marco(dias: number, diasDesdeUltimo?: number): Marco {
  let atual: number;
  let tier: 7 | 30;
  if (dias <= 0) { atual = 0; tier = 7; }
  else if (dias < 7) { atual = dias; tier = 7; }
  else if (dias === 7) { atual = 7; tier = 7; }
  else if (dias < 30) { atual = dias; tier = 30; }
  else { atual = 30; tier = 30; }

  const atingido = dias >= 7 && atual === tier;
  const hiato = !atingido && dias > 0 && (diasDesdeUltimo ?? 0) >= 7;
  const mode: MarcoMode = atingido ? 'atingido' : hiato ? 'poshiato' : 'progresso';
  return { atual, tier, restantes: Math.max(0, tier - atual), mode };
}
