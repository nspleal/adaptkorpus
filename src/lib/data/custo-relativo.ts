/**
 * `custoRelativo` — faixa de custo (1 = mais barato · 3 = mais caro) dos 167 alimentos da
 * paleta. TETO, NUNCA ALVO: o montador PREFERE a faixa e sobe quando o piso de proteína ou a
 * janela de kcal não fecham (cofre, parametros-motor-dieta-evokorpus §`custoRelativo`,
 * DF 2026-07-26).
 *
 * 🔒 PROCEDÊNCIA E VERSÃO (rótulo que viaja com o dado, como os trilhos do v3):
 *   curadoria 2026-07-28 (`raw/curadoria-custo-relativo-evokorpus-167-2026-07-28.xlsx`,
 *   SHA-256 4fc2d62b…) + regra 6 (agrupamento encadeado ≤10%, maioria, empate → faixa mais
 *   cara), recomputada e validada em 2026-08-06.
 *
 * ⚠️ ARBITRARIEDADE DECLARADA, não escondida: o teste de perturbação mostrou que ~1 em 4
 * itens com base de preço trocaria de faixa com ±10% de variação. 47 dos 167 são julgamento
 * declarado (sem base de preço) — a faixa 2 é 46% julgamento. Por isso o dado entra rotulado:
 * trocar a forma do corte no futuro é RE-SEED DE DADO, não re-arquitetura. Nenhuma copy de
 * tela afirma precisão que este dado não tem, e o app nunca exibe dinheiro.
 *
 * 🔑 POR QUE MÓDULO SEPARADO e não uma coluna em `foods.ts`: aquele arquivo é GERADO do xlsx
 * do autor e se sobrescreve inteiro na regeneração. Esta curadoria tem outra fonte e outro
 * ciclo de vida. A ligação entre os dois é garantida pelo teste de EXAUSTIVIDADE BILATERAL
 * (`custo-relativo.test.ts`): alimento sem faixa — ou faixa sem alimento — derruba a suíte.
 */

/** Faixa de custo relativo. Vocabulário fechado. */
export type CustoRelativo = 1 | 2 | 3;

/** Rótulo de procedência do dado (viaja junto, como `PREFERENCIAS_TRILHO`). */
export const CUSTO_RELATIVO_TRILHO = {
  procedencia: 'curadoria',
  versao: 'curadoria 2026-07-28 + regra 6, recomputada 2026-08-06',
  desde: '2026-08-06',
  origem: 'curadoria de 167 alimentos, 4 rodadas; 11 faixas movidas pela regra 6; 47 sem base de preço',
} as const;

/** id do alimento → faixa. Os 167, exaustivo (imposto por teste). */
export const CUSTO_RELATIVO: Readonly<Record<string, CustoRelativo>> = {
  a1: 2, // julgamento declarado
  a2: 2,
  a3: 3,
  a4: 3,
  a5: 3, // julgamento declarado
  a6: 3,
  a7: 3, // julgamento declarado
  a8: 2, // julgamento declarado
  a9: 3,
  a10: 3, // julgamento declarado
  a11: 2,
  a12: 2,
  a13: 2,
  a14: 2,
  a15: 2,
  a16: 3,
  a17: 1,
  a18: 1,
  a19: 2, // ⚠️ regra 6
  a20: 3, // julgamento declarado
  a21: 3,
  a22: 2, // julgamento declarado
  a23: 2, // julgamento declarado
  a24: 3, // ⚠️ regra 6
  a25: 3,
  a26: 1,
  a27: 2, // julgamento declarado
  a28: 2, // julgamento declarado
  a29: 1,
  a30: 1,
  a31: 1,
  a32: 1,
  a33: 2, // julgamento declarado
  a34: 3,
  a35: 3,
  a36: 3, // julgamento declarado
  a37: 2, // julgamento declarado
  a38: 3, // ⚠️ regra 6
  a39: 2, // julgamento declarado
  a40: 3,
  a41: 3, // ⚠️ regra 6
  a42: 1,
  a43: 1,
  a44: 1, // ⚠️ regra 6
  a45: 2, // julgamento declarado
  a46: 2, // julgamento declarado
  a47: 2, // julgamento declarado
  a48: 1, // julgamento declarado
  a49: 1,
  a50: 2, // julgamento declarado
  a51: 2,
  a52: 1,
  a53: 3, // ⚠️ regra 6
  a54: 1,
  a55: 2,
  a56: 3,
  a57: 2,
  a58: 1,
  a59: 3,
  a60: 2,
  a61: 2,
  a62: 2, // julgamento declarado
  a63: 1,
  a64: 1, // julgamento declarado
  a65: 2, // julgamento declarado
  a66: 2, // julgamento declarado
  a67: 3,
  a68: 1,
  a69: 1,
  a70: 3,
  a71: 1,
  a72: 1,
  a73: 2,
  a74: 3,
  a75: 1,
  a76: 3,
  a77: 1,
  a78: 1,
  a79: 2,
  a80: 2,
  a81: 2,
  a82: 2,
  a83: 1,
  a84: 2,
  a85: 3,
  a86: 2,
  a87: 3, // ⚠️ regra 6
  a88: 1,
  a89: 3,
  a90: 1,
  a91: 2, // ⚠️ regra 6
  a92: 3,
  a93: 2,
  a94: 3,
  a95: 1,
  a96: 1,
  a97: 2, // ⚠️ regra 6
  a98: 2,
  a99: 3,
  a100: 2,
  a101: 3, // ⚠️ regra 6
  a102: 1,
  a103: 3,
  a104: 1,
  a105: 3,
  a106: 1,
  a107: 2,
  a108: 3,
  a109: 1,
  a110: 3,
  a111: 2,
  a112: 3,
  a113: 1,
  a114: 3,
  a115: 2,
  a116: 2,
  a117: 2, // ⚠️ regra 6
  a118: 1,
  a119: 2, // julgamento declarado
  a120: 2, // julgamento declarado
  a121: 3,
  a122: 2,
  a123: 2, // julgamento declarado
  a124: 2, // julgamento declarado
  a125: 1,
  a126: 2, // julgamento declarado
  a128: 3,
  a129: 2,
  a130: 1,
  a132: 1, // julgamento declarado
  a133: 2, // julgamento declarado
  a138: 3,
  a139: 2, // julgamento declarado
  a140: 1,
  a141: 2, // julgamento declarado
  a142: 2, // julgamento declarado
  a143: 3,
  a144: 2, // julgamento declarado
  a145: 2, // julgamento declarado
  a146: 2, // julgamento declarado
  a147: 2, // julgamento declarado
  a148: 3, // julgamento declarado
  a149: 2, // julgamento declarado
  a150: 1,
  a151: 2, // julgamento declarado
  a152: 3, // julgamento declarado
  a153: 3,
  a154: 2, // julgamento declarado
  a155: 2,
  a156: 2,
  a157: 1, // julgamento declarado
  a158: 2, // julgamento declarado
  a159: 2,
  a160: 2,
  a161: 2,
  a163: 2, // julgamento declarado
  a164: 3,
  a165: 2,
  a166: 2, // julgamento declarado
  a168: 3,
  a169: 3,
  a170: 1,
  a173: 1,
  a175: 2,
  a176: 3, // julgamento declarado
  a177: 3,
  a178: 3,
};

/** Alimentos cuja faixa foi movida pela regra 6 (11) — rastro da curadoria. */
export const MOVIDOS_REGRA_6: readonly string[] = ['a19', 'a24', 'a38', 'a41', 'a44', 'a53', 'a87', 'a91', 'a97', 'a101', 'a117'];

/** Alimentos sem base de preço, faixa por julgamento declarado (47). */
export const JULGAMENTO_DECLARADO: readonly string[] = ['a1', 'a5', 'a7', 'a8', 'a10', 'a20', 'a22', 'a23', 'a27', 'a28', 'a33', 'a36', 'a37', 'a39', 'a45', 'a46', 'a47', 'a48', 'a50', 'a62', 'a64', 'a65', 'a66', 'a119', 'a120', 'a123', 'a124', 'a126', 'a132', 'a133', 'a139', 'a141', 'a142', 'a144', 'a145', 'a146', 'a147', 'a148', 'a149', 'a151', 'a152', 'a154', 'a157', 'a158', 'a163', 'a166', 'a176'];
