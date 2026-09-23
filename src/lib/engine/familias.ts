/**
 * Famílias de equivalência — "mesmo movimento, outro implemento".
 * Fonte TRAVADA: cofre `conceitos/parametros-motor-substituicao-adaptkorpus` §"Famílias
 * de equivalência" (⭐ aprovadas — DF 2026-07-04). 20 famílias.
 * Correção 20/09: e120 segue a execução e o mapa anatômico de puxada vertical;
 * sua inclusão histórica em remada horizontal contradizia ambos.
 *
 * Papel na troca (F.2): rank EXTRA dentro do nível 0 de preservação — candidato da
 * MESMA família rankeia antes do "mesmo grupo+padrão" genérico. Não toca nenhum
 * filtro duro. A ordem dentro de cada família = demanda de estabilidade/técnica
 * (curadoria), NÃO progressão. One-offs (swing, superman, pendura…) ficam fora de
 * propósito — caem na preservação genérica.
 */

export const FAMILIAS: Readonly<Record<string, readonly string[]>> = {
  flexao: ['e157', 'e156', 'e1', 'e113', 'e2', 'e100'],
  'supino-horizontal': ['e15', 'e11', 'e9'],
  'supino-inclinado': ['e12', 'e10'],
  desenvolvimento: ['e43', 'e44', 'e42', 'e41', 'e111', 'e155'],
  'remada-horizontal': ['e47', 'e48', 'e46', 'e162', 'e84', 'e45', 'e154'],
  'puxada-vertical': ['e49', 'e50', 'e51', 'e120'],
  'barra-fixa': ['e116', 'e22', 'e21'],
  'agachamento-bilateral': ['e3', 'e33', 'e34', 'e28', 'e141', 'e32', 'e121'],
  afundo: ['e16', 'e160', 'e17', 'e18', 'e79', 'e61', 'e78', 'e143'],
  'ponte-hip-thrust': ['e57', 'e58', 'e59', 'e161', 'e153'],
  'stiff-terra': ['e80', 'e81', 'e82', 'e26', 'e27', 'e117'],
  'flexora-posterior': ['e64', 'e65', 'e66', 'e87', 'e86', 'e123'],
  'rosca-biceps': ['e19', 'e20', 'e72', 'e74', 'e75', 'e77', 'e112', 'e122', 'e124', 'e76', 'e136'],
  'triceps-extensao': ['e68', 'e69', 'e71', 'e133', 'e134', 'e67', 'e135', 'e40'],
  'elevacao-lateral': ['e52', 'e53', 'e54'],
  'crucifixo-peito': ['e14', 'e55', 'e130', 'e131', 'e132', 'e56'],
  'crucifixo-invertido': ['e106', 'e107', 'e119'],
  panturrilha: ['e36', 'e37', 'e38', 'e39'],
  'abdominal-flexao': ['e4', 'e5', 'e6', 'e149', 'e159'],
  'cardio-continuo': ['e24', 'e29', 'e31', 'e93'],
};

const FAMILIA_POR_ID: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [fam, ids] of Object.entries(FAMILIAS)) for (const id of ids) m.set(id, fam);
  return m;
})();

/** Família do exercício, ou null (one-off legítimo — cai na preservação genérica). */
export function familiaDe(id: string): string | null {
  return FAMILIA_POR_ID.get(id) ?? null;
}

/** true se os dois exercícios pertencem à MESMA família de equivalência. */
export function mesmaFamilia(a: string, b: string): boolean {
  const fa = FAMILIA_POR_ID.get(a);
  return fa !== undefined && fa === FAMILIA_POR_ID.get(b);
}
