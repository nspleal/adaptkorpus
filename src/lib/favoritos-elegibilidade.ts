import { locaisPermitidos } from '@/lib/engine';
import { DIFICULDADE_LIBERADA } from '@/lib/engine/treino-constants';
import type { EquipamentoDisp, Exercise } from '@/lib/data/types';
import type { NivelExperiencia, RotinaSemanal } from '@/lib/engine';
import type { SessaoHistorico } from '@/lib/treino-historico';

/**
 * Elegibilidade de um exercício FAVORITO no plano atual (V8.2 Estado 5 — "não aparece
 * agora"). Motivos = CONJUNTO FECHADO de 4, copy exata TRAVADA no cofre (B5, DF
 * 2026-07-04). Descompasso NUNCA é erro (sem vermelho): o item continua favoritado —
 * é só transparência sobre por que não está no plano de hoje.
 * Função pura e determinística.
 */

export type MotivoDescompasso =
  | 'pede equipamento de academia'
  | 'é de um nível acima do seu atual'
  | 'não coube nos seus dias de treino'
  | 'em pausa por dor';

export interface ElegibilidadeFavorito {
  elegivel: boolean;
  motivo?: MotivoDescompasso;
}

/** true se a ocorrência MAIS RECENTE do exercício no histórico foi pausada por dor. */
export function emPausaPorDor(exercicioId: string, historico: readonly SessaoHistorico[]): boolean {
  // histórico vem mais-recente-primeiro (lerHistorico); a 1ª ocorrência é a mais recente.
  for (const s of historico) {
    if (s.tipo === 'calibracao') continue;
    const ex = s.exercicios.find((e) => e.id === exercicioId);
    if (ex) return ex.pausado === true;
  }
  return false;
}

export function elegibilidadeFavorito(
  ex: Exercise,
  perfil: { equipamento: EquipamentoDisp; nivelExperiencia: NivelExperiencia },
  rotina: RotinaSemanal | null,
  historico: readonly SessaoHistorico[] = [],
): ElegibilidadeFavorito {
  // 1) Pausa por dor (re-check de runtime): o movimento está pausado até novo registro.
  if (emPausaPorDor(ex.id, historico)) return { elegivel: false, motivo: 'em pausa por dor' };
  // 2) Equipamento — filtro duro do montador (locais cumulativos).
  if (!locaisPermitidos(perfil.equipamento).includes(ex.local)) {
    return { elegivel: false, motivo: 'pede equipamento de academia' };
  }
  // 3) Dificuldade liberada — favoritar NÃO fura o nível (DF #12).
  if (!DIFICULDADE_LIBERADA[perfil.nivelExperiencia].includes(ex.nivel)) {
    return { elegivel: false, motivo: 'é de um nível acima do seu atual' };
  }
  // 4) Cabe nos filtros mas não entrou em nenhum slot da semana montada.
  if (rotina && !rotina.dias.some((d) => d.slots.some((s) => s.exercicio.id === ex.id))) {
    return { elegivel: false, motivo: 'não coube nos seus dias de treino' };
  }
  return { elegivel: true };
}
