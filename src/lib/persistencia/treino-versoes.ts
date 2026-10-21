import type { PerfilResumo } from '@/components/painel/Painel';
import { canonicalInputHash } from '@/lib/engine/cas';

/** Somente estrutura editável. Cargas, saúde, dieta, peso, ciclo e histórico não entram
 * no Desfazer. Decisão do autor e67139fe (19/10/2026); motor permanece intocado. */
export const CAMPOS_DEFINICAO_TREINO = [
  'treinoDias', 'diasDisponiveis', 'tempoPorSessaoMin', 'limiteTempoTreino',
  'favoritos', 'preferencias', 'foco', 'focoAgregado', 'divisaoPreferida',
  'rotinaCustom', 'variacaoTreino', 'modoForca', 'tecnicasAvancadas', 'cardioFavorito',
] as const satisfies readonly (keyof PerfilResumo)[];
export type DefinicaoTreino = Partial<Pick<PerfilResumo, (typeof CAMPOS_DEFINICAO_TREINO)[number]>>;
export interface VersaoTreino { id: string; definicao: DefinicaoTreino }
export interface VersoesTreino { atual: VersaoTreino; anterior?: VersaoTreino }

export function extrairDefinicaoTreino(perfil: PerfilResumo): DefinicaoTreino {
  return structuredClone(Object.fromEntries(
    CAMPOS_DEFINICAO_TREINO.filter((k) => perfil[k] !== undefined).map((k) => [k, perfil[k]]),
  )) as DefinicaoTreino;
}

export function restaurarDefinicaoTreino(perfilAtual: PerfilResumo, definicao: DefinicaoTreino): PerfilResumo {
  const perfil = { ...perfilAtual };
  for (const k of CAMPOS_DEFINICAO_TREINO) delete (perfil as Partial<PerfilResumo>)[k];
  return Object.assign(perfil, structuredClone(definicao));
}

export type ResultadoVersao =
  | { tipo: 'CONFIRMADO' | 'SEM_MUDANCA'; versoes: VersoesTreino }
  | { tipo: 'CONFLITO_ALVO' };

/** Apenas duas definições completas. IDs/revisão do commit são novos mesmo no Desfazer;
 * recibos de operação vivem fora das definições e impedem uma segunda rotação no retry. */
export function promoverDefinicaoTreino(
  versoes: VersoesTreino,
  nova: VersaoTreino,
): ResultadoVersao {
  if (canonicalInputHash(versoes.atual.definicao) === canonicalInputHash(nova.definicao)) {
    return { tipo: 'SEM_MUDANCA', versoes };
  }
  return { tipo: 'CONFIRMADO', versoes: { atual: structuredClone(nova), anterior: structuredClone(versoes.atual) } };
}

export function desfazerDefinicaoTreino(
  versoes: VersoesTreino, alvoId: string, novoId: string,
): ResultadoVersao {
  if (!versoes.anterior || versoes.anterior.id !== alvoId) return { tipo: 'CONFLITO_ALVO' };
  return promoverDefinicaoTreino(versoes, { id: novoId, definicao: versoes.anterior.definicao });
}
