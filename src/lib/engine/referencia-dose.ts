/** Fotografia real de uma edição. Não substitui a intenção nem os tetos da recuperação. */
export interface ReferenciaDose {
  versao: 1;
  contexto: string;
  series: Record<string, number>;
  escolhas: Record<string, number>;
}

export function contextoDaDose(retomada?: { semana: number; fator: number; volumeReferencia: number }): string | undefined {
  return retomada ? `retomada:1:${retomada.semana}:${retomada.fator}:${retomada.volumeReferencia}` : undefined;
}

function mapaValido(m: unknown): m is Record<string, number> {
  return m != null && typeof m === 'object' && !Array.isArray(m)
    && Object.entries(m).length <= 20
    && Object.entries(m).every(([k, v]) => k.length <= 24 && typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 99);
}

/** Defesa também para chamadas diretas do motor, que não atravessam o schema HTTP. */
export function referenciaValida(r: unknown, contexto: string): r is ReferenciaDose {
  if (r == null || typeof r !== 'object') return false;
  const ref = r as ReferenciaDose;
  return ref.versao === 1 && ref.contexto === contexto && mapaValido(ref.series) && mapaValido(ref.escolhas);
}

/**
 * A base não depende do pedido atual. Sem fotografia válida, usa cotas calculadas sem escolhas.
 * Com fotografia, mantém os donos da dose observada. Aumentos usam apenas folga que já existia
 * na base: reduzir outro slot não destrava um pedido antes recusado. A UI captura nova base
 * antes da próxima edição explícita, permitindo usar a folga em um pedido posterior.
 */
export function aplicarDoseReferenciada(
  slots: readonly { id: string; referencia?: ReferenciaDose; escolha?: number }[],
  cotas: readonly number[], tetos: readonly number[], alvo: number, contexto: string,
): number[] {
  const referencias = slots.map((s) => referenciaValida(s.referencia, contexto) ? s.referencia : undefined);
  const base = slots.map((s, i) => referencias[i]?.series[s.id]);
  const completa = base.every((v, i) => v != null && v <= tetos[i]!);
  // Fotografia impossível no contexto atual nunca contorna IRV/volume. Recalcular não usa escolhas.
  if (!completa || base.reduce<number>((n, v) => n + (v ?? 0), 0) > Math.max(alvo, slots.length)) {
    return slots.map((s, i) => Math.min(s.escolha ?? cotas[i]!, cotas[i]!));
  }
  let folga = Math.max(0, alvo - base.reduce<number>((n, v) => n + v!, 0));
  return slots.map((s, i) => {
    const entregue = base[i]!;
    const anterior = referencias[i]!.escolhas[s.id];
    if (s.escolha == null || s.escolha === anterior) return entregue;
    if (s.escolha <= (anterior ?? entregue)) return Math.min(entregue, s.escolha);
    const incremento = Math.min(folga, Math.max(0, Math.min(tetos[i]!, s.escolha) - entregue));
    folga -= incremento;
    return entregue + incremento;
  });
}
