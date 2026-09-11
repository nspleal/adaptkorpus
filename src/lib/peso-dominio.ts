/**
 * 🔒 DOMÍNIO DO PESO — fonte única dos limites (30–300 kg).
 *
 * 🔴 R4 (revisão conjunta 2026-09-11): `Number(corpo?.pesoKg)` transformava `null` em `0`, e
 * `Number.isFinite(0)` é `true` — então "o servidor não sabe qual peso está registrado" virava
 * "o peso registrado é 0 kg", um número que o consumidor aceitava e escrevia no perfil e no
 * histórico. `Number('')` tem o mesmo desfecho.
 *
 * A correção é ordem de operações: **valida tipo e domínio ANTES de converter**. Nada é
 * coagido; ausência continua ausência. Os limites são os MESMOS que a rota já aplica na
 * entrada (`POST /api/dados/peso`) — antes estavam redigitados em três arquivos, e um
 * domínio redigitado é um domínio que divergiu.
 *
 * ⚠️ Decimais entram: 63,4 kg é peso legítimo. Não há arredondamento nem piso de precisão
 * aqui — a estimativa de cardio é linear no peso e truncar aqui mentiria nela.
 */
export const PESO_MIN_KG = 30;
export const PESO_MAX_KG = 300;

/** `true` só para número finito dentro da faixa aceita pelo schema. */
export function noDominioDoPeso(n: number): boolean {
  return Number.isFinite(n) && n >= PESO_MIN_KG && n <= PESO_MAX_KG;
}

/**
 * Peso vindo de uma RESPOSTA do servidor: devolve o número quando ele é um peso de verdade,
 * `null` em qualquer outro caso (`null`, `undefined`, `''`, `'81'`, `NaN`, 0, fora da faixa).
 *
 * 🔴 `typeof v !== 'number'` é deliberado, não excesso: a rota devolve JSON com número, e
 * aceitar string aqui reabriria a coerção que é o defeito. Um dia em que o servidor passe a
 * mandar string, o cliente prefere dizer "não sei" a adivinhar.
 */
export function pesoKgDaResposta(v: unknown): number | null {
  if (typeof v !== 'number' || !noDominioDoPeso(v)) return null;
  return v;
}
