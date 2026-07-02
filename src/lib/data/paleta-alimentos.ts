/**
 * Paleta curada de alimentos para o seletor "Alimentos que não curto".
 *
 * Fonte de verdade: a **base real** (FOODS_SEED) restrita aos alimentos que **de fato
 * aparecem nos pratos** (RECIPES_SEED) — não a TACO inteira (handoff Dias-e-Preferências §9,
 * §6). Os IDs são os REAIS da base (o motor recebe IDs, nunca texto). O nome de exibição é o
 * **`rotuloAmigavel` do seed** — vocabulário OFICIAL do cofre (DF 2026-07-01,
 * conceitos/rotulos-amigaveis-alimentos-evokorpus), não mais um mapa hardcoded aqui.
 */
import type { GrupoAlimentar } from './types';
import { FOODS_SEED, RECIPES_SEED } from './seed';

export interface AlimentoPaleta {
  id: string;       // ID real da base (a chave usada pelo motor)
  nome: string;     // rótulo amigável (exibição)
  grupo: string;    // rótulo de grupo (exibição, secundário)
  busca: string;    // nome normalizado (sem acento/caixa) para a busca por substring
}

const GRUPO_LABEL: Record<GrupoAlimentar, string> = {
  proteina_animal: 'Carnes, aves e peixes',
  leguminosa_proteina_vegetal: 'Leguminosas',
  verdura_legume: 'Legumes e verduras',
  fruta: 'Frutas',
  grao_cereal_tuberculo: 'Grãos e tubérculos',
  gordura: 'Gorduras e sementes',
  laticinio: 'Laticínios',
};

/** Normaliza para busca: minúsculas, sem acento (NFD + remove diacríticos). */
export function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function construirPaleta(): AlimentoPaleta[] {
  const usados = new Set<string>();
  for (const r of RECIPES_SEED) for (const it of r.itens) usados.add(it.alimentoId);
  const out: AlimentoPaleta[] = [];
  for (const f of FOODS_SEED) {
    if (!usados.has(f.id)) continue;
    const nome = f.rotuloAmigavel ?? f.nome; // vocabulário do cofre (100% no seed real)
    out.push({ id: f.id, nome, grupo: GRUPO_LABEL[f.grupo] ?? f.grupo, busca: normalizar(nome) });
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
}

/** Paleta curada (alimentos reais que aparecem nos pratos), ordenada por nome. */
export const PALETA_ALIMENTOS: AlimentoPaleta[] = construirPaleta();

const PALETA_POR_ID = new Map(PALETA_ALIMENTOS.map((a) => [a.id, a]));

/** Busca por substring normalizada; exclui os já selecionados; limita (~8). */
export function buscarAlimentos(query: string, excluir: readonly string[] = [], limite = 8): AlimentoPaleta[] {
  const nq = normalizar(query.trim());
  if (!nq) return [];
  const ex = new Set(excluir);
  const res: AlimentoPaleta[] = [];
  for (const a of PALETA_ALIMENTOS) {
    if (ex.has(a.id) || !a.busca.includes(nq)) continue;
    res.push(a);
    if (res.length >= limite) break;
  }
  return res;
}

/** Rótulo amigável de um ID (para os chips). Cai no próprio id se não estiver na paleta. */
export function nomeAlimento(id: string): string {
  return PALETA_POR_ID.get(id)?.nome ?? id;
}
