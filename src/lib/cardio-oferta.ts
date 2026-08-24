/**
 * 🔒 C1 — ESTADO TRANSITÓRIO da OFERTA DE DIAS PARA CARDIO (autor 2026-08-21, rodada 2).
 *
 * O elo entre o CONTROLE do usuário (`components/painel/OfertaCardio.tsx`) e o motor:
 *   controle → ESTE estado transitório → `recomputarPlano({ diasOferecidosCardio })` →
 *   `gerarTreino` → `montarRotina` → `construirDistribuicaoCardioSemana` → `canonical_input_hash`.
 *
 * DELIBERADAMENTE transiente e client-side (decisão do autor, item 10 da fiação): NÃO é
 * preferência permanente do perfil, não persiste, não é importado por código de servidor
 * (estado de módulo no servidor vazaria entre usuários). Zera a cada carga da página.
 * Distinto de `diasDisponiveis` (que é só uma contagem).
 */

let dias: number[] = [];

/** Normaliza: inteiros seguros >= 0, sem duplicata, ordem crescente (ordem canônica do hash). */
function normalizar(entrada: readonly number[]): number[] {
  return [...new Set(entrada.filter((i) => Number.isSafeInteger(i) && i >= 0))].sort((a, b) => a - b);
}

/** Substitui a oferta inteira (ex.: hidratação de um formulário). */
export function setDiasOferecidosCardio(novos: readonly number[]): readonly number[] {
  dias = normalizar(novos);
  return dias;
}

/** A oferta vigente, em ordem canônica. É ISTO que o Painel injeta no recompute. */
export function getDiasOferecidosCardio(): readonly number[] {
  return dias;
}

/** Alterna um dia (gesto do controle). Devolve a oferta resultante. */
export function toggleDiaOferecidoCardio(indice: number): readonly number[] {
  dias = dias.includes(indice) ? dias.filter((d) => d !== indice) : normalizar([...dias, indice]);
  return dias;
}

/** Limpa a oferta (testes / troca de conta). */
export function limparOfertaCardio(): void {
  dias = [];
}
