/**
 * 🔒 C1.1-B — funções PURAS da oferta transitória de dias para cardio.
 *
 * O elo entre o CONTROLE do usuário (`components/painel/OfertaCardio.tsx`) e o motor:
 *   controle React do Painel → ESTAS funções puras → `recomputarPlano({ diasOferecidosCardio })` →
 *   `gerarTreino` → `montarRotina` → `construirDistribuicaoCardioSemana` → `canonical_input_hash`.
 *
 * A oferta é estado local do Painel: transiente, não persistida e isolada por montagem/conta.
 * Este módulo NÃO guarda estado de módulo. Isso impede que a escolha de uma conta vaze para
 * outra no mesmo processo do navegador/servidor. Distinta de `diasDisponiveis`, que é só uma
 * contagem, a oferta nomeia dias reais da semana.
 */
import { ORDEM_SEMANA, type Weekday } from './semana';

const eWeekday = (dia: unknown): dia is Weekday =>
  typeof dia === 'string' && (ORDEM_SEMANA as readonly string[]).includes(dia);

/** Normaliza dias reais, remove duplicatas e preserva a ordem canônica Seg→Dom. */
export function normalizarDiasOferecidosCardio(entrada: readonly unknown[]): Weekday[] {
  const recebidos = new Set(entrada.filter(eWeekday));
  return ORDEM_SEMANA.filter((dia) => recebidos.has(dia));
}

/** Alterna um dia sem mutar a oferta recebida; o dono do estado decide onde armazená-la. */
export function alternarDiaOferecidoCardio(atual: readonly Weekday[], dia: Weekday): Weekday[] {
  return normalizarDiasOferecidosCardio(
    atual.includes(dia) ? atual.filter((item) => item !== dia) : [...atual, dia],
  );
}
