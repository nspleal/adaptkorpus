import { ROTULO_EQUIPAMENTO_CASA, exercicioDisponivel } from '@/lib/engine';
import { DIFICULDADE_LIBERADA } from '@/lib/engine/treino-constants';
import type { EquipamentoCasa, EquipamentoDisp, Exercise } from '@/lib/data/types';
import type { NivelExperiencia, RotinaSemanal } from '@/lib/engine';
import type { SessaoHistorico } from '@/lib/treino-historico';

/**
 * Elegibilidade de um exercício FAVORITO no plano atual (V8.2 Estado 5 — "não aparece
 * agora"). Motivos travados no cofre (B5, DF 2026-07-04; refinado no V8.5, DF
 * 2026-07-04): nível/dias/pausa são FIXOS; o de equipamento é DINÂMICO — "pede
 * academia" (exercício `local: academia`) ou "pede {o que falta}" nos casa-com
 * (rótulos do vocabulário de casa, ex.: "pede halteres + banco"). Descompasso NUNCA
 * é erro (sem vermelho): o item continua favoritado — é só transparência sobre por
 * que não está no plano de hoje. Função pura e determinística.
 */

export type MotivoDescompasso =
  | 'é de um nível acima do seu atual'
  | 'não coube nos seus dias de treino'
  | 'em pausa por dor'
  | `pede ${string}`;

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

const rotuloMin = (eq: EquipamentoCasa): string =>
  ROTULO_EQUIPAMENTO_CASA[eq].toLocaleLowerCase('pt-BR');

/**
 * Motivo DINÂMICO de equipamento (V8.5): `local: academia` → "pede academia";
 * `casa_com` → "pede {falta}" com os rótulos do vocabulário — exigidos (E) faltantes
 * unidos por " + " e a lista any-of insatisfeita como cláusula "x ou y".
 * Só é chamado quando `exercicioDisponivel` já reprovou.
 */
function motivoEquipamento(
  ex: Exercise,
  equipamentosCasa?: readonly EquipamentoCasa[],
): MotivoDescompasso {
  if (ex.local === 'academia') return 'pede academia';
  const marcados = equipamentosCasa ?? [];
  const partes = (ex.equipamentoExigido ?? [])
    .filter((eq) => !marcados.includes(eq))
    .map(rotuloMin);
  const qualquerUm = ex.equipamentoExigidoQualquerUm;
  if (qualquerUm && qualquerUm.length > 0 && !qualquerUm.some((eq) => marcados.includes(eq))) {
    partes.push(qualquerUm.map(rotuloMin).join(' ou '));
  }
  // casa_com sem curadoria (fail-closed do filtro) — inalcançável com os 53 curados.
  if (partes.length === 0) return 'pede equipamento de casa';
  return `pede ${partes.join(' + ')}`;
}

export function elegibilidadeFavorito(
  ex: Exercise,
  perfil: { equipamento: EquipamentoDisp; nivelExperiencia: NivelExperiencia; equipamentosCasa?: readonly EquipamentoCasa[] },
  rotina: RotinaSemanal | null,
  historico: readonly SessaoHistorico[] = [],
): ElegibilidadeFavorito {
  // 1) Pausa por dor (re-check de runtime): o movimento está pausado até novo registro.
  if (emPausaPorDor(ex.id, historico)) return { elegivel: false, motivo: 'em pausa por dor' };
  // 2) Equipamento — filtro duro do montador (modelo 2 níveis: checklist de casa).
  if (!exercicioDisponivel(ex, perfil.equipamento, perfil.equipamentosCasa)) {
    return { elegivel: false, motivo: motivoEquipamento(ex, perfil.equipamentosCasa) };
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
