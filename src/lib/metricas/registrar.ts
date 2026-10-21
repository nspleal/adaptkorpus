'use client';

import { montarPayload, type PayloadPorEvento, type TipoEvento } from './eventos';
import { escopoLocal } from '@/lib/escopo-local';
import { cabecalhosSync } from '@/lib/persistencia/sync-contrato';

/**
 * O ÚNICO caminho de escrita da telemetria (Leva C2).
 *
 * 🔒 Primeira parte: `POST /api/metricas`, que grava em `eventos` sob RLS. Nenhuma
 * biblioteca de terceiro, nenhum pixel, nenhum endpoint externo.
 *
 * 🔒 **Telemetria NUNCA derrota a tela.** Tudo é fire-and-forget e todo erro é engolido: se
 * o endpoint cair, o app segue igual. Medir é secundário ao uso — o inverso seria trocar a
 * experiência da pessoa por um número nosso.
 *
 * ⚠️ Sem backend (modo mock) é no-op silencioso: não há para onde gravar, e inventar fila
 * local criaria dado de comportamento no `localStorage` — exatamente o que a Leva A passou a
 * varrer.
 */
export function registrarEvento<T extends TipoEvento>(tipo: T, dados: PayloadPorEvento[T]): void {
  if (typeof window === 'undefined') return;
  const subject = escopoLocal();
  if (!subject) return;
  let payload: Record<string, unknown>;
  try {
    // Poda e valida contra a denylist. Se lançar, o defeito é de quem chamou — e não pode
    // virar exceção na UI, então morre aqui (o guard estático é quem pega isso no build).
    payload = montarPayload(tipo, dados as Record<string, unknown>);
  } catch {
    return;
  }
  try {
    void fetch('/api/metricas', {
      method: 'POST',
      headers: cabecalhosSync(subject),
      body: JSON.stringify({ tipo, payload }),
      keepalive: true, // sobrevive à navegação que dispara o evento
    }).catch(() => { /* telemetria não fala */ });
  } catch { /* telemetria não fala */ }
}
