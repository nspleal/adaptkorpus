/**
 * Paleta curada de alimentos para o seletor "Alimentos que não curto".
 *
 * Fonte de verdade: a **base real** (FOODS_SEED) restrita aos alimentos que **de fato
 * aparecem nos pratos** (RECIPES_SEED) — não a TACO inteira (handoff Dias-e-Preferências §9,
 * §6). Os IDs são os REAIS da base (o motor recebe IDs, nunca texto). Os nomes da TACO são
 * clínicos ("Carne, bovina, acém, moído, cozido"); aqui damos um **rótulo amigável** só para
 * exibição (chips/autocomplete) — a chave que vai ao motor continua sendo `id`.
 */
import type { GrupoAlimentar } from './types';
import { FOODS_SEED, RECIPES_SEED } from './seed';

export interface AlimentoPaleta {
  id: string;       // ID real da base (a chave usada pelo motor)
  nome: string;     // rótulo amigável (exibição)
  grupo: string;    // rótulo de grupo (exibição, secundário)
  busca: string;    // nome normalizado (sem acento/caixa) para a busca por substring
}

/** Rótulo amigável por ID real (a base TACO tem nomes longos/clínicos). */
const APELIDO: Record<string, string> = {
  // frutas
  a68: 'Abacate', a72: 'Banana', a79: 'Mamão', a85: 'Morango',
  // gorduras e sementes
  a113: 'Amendoim', a115: 'Azeite de oliva', a116: 'Castanha-de-caju', a119: 'Gergelim', a120: 'Linhaça',
  // grãos, cereais e tubérculos
  a48: 'Arroz integral', a49: 'Arroz branco', a50: 'Aveia', a52: 'Batata-doce', a53: 'Batata',
  a54: 'Cará', a55: 'Farinha de mandioca', a57: 'Farinha de trigo', a59: 'Macarrão', a60: 'Mandioca',
  a62: 'Milho verde', a66: 'Pão integral', a67: 'Pão francês', a64: 'Polenta',
  // laticínios
  a28: 'Creme de leite', a29: 'Iogurte natural', a32: 'Leite', a34: 'Queijo minas',
  a35: 'Muçarela', a36: 'Parmesão', a39: 'Ricota',
  // leguminosas
  a41: 'Feijão carioca', a42: 'Feijão-fradinho', a43: 'Feijão preto', a44: 'Feijão roxo', a46: 'Lentilha', a47: 'Tofu',
  // carnes, aves e peixes
  a1: 'Atum', a3: 'Camarão', a4: 'Carne moída (acém)', a5: 'Contrafilé', a8: 'Lagarto', a9: 'Patinho',
  a14: 'Peito de frango', a16: 'Merluza', a18: 'Ovo cozido', a19: 'Ovo frito',
  a22: 'Bisteca de porco', a23: 'Lombo de porco', a25: 'Salmão', a26: 'Sardinha',
  // legumes e verduras
  a91: 'Abóbora', a90: 'Abobrinha', a93: 'Alface', a94: 'Alho', a97: 'Brócolis', a98: 'Cebola',
  a100: 'Cenoura', a103: 'Couve', a105: 'Espinafre', a107: 'Pimentão', a110: 'Rúcula', a111: 'Tomate', a112: 'Vagem',
};

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
    const nome = APELIDO[f.id] ?? f.nome.split(',')[0]!.trim(); // fallback: 1º segmento do nome TACO
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
