/**
 * 🔒 C1 — CURADORIA DE LATERALIDADE (execucao) — decisão do autor A (2026-08-20): campo
 * estruturado + catálogo curado. Fonte de verdade da lateralidade por exercício.
 *
 * Por que aqui, e não em exercises.ts: aquele arquivo é GERADO do xlsx do cofre ("NÃO editar
 * à mão") e esta sessão não escreve no cofre. Esta curadoria é mesclada em EXERCISES no load
 * (exercises.ts), e o load FALHA se algum exercício não estiver curado. 📌 Resíduo documental:
 * o gerador/xlsx do cofre deve ganhar a coluna `execucao` para preservar isto numa regeneração.
 *
 * Semântica temporal (handoff §4.1, spec §3-§4):
 *  - BILATERAL: execução normal (os dois lados no mesmo movimento).
 *  - UNILATERAL_ALTERNADO: a série JÁ representa o conjunto alternado completo — NÃO dobra.
 *  - UNILATERAL_DOIS_LADOS: série completa por lado, repetida no outro — dobra SÓ a execução.
 *
 * 🔴 Curadoria por LEITURA (nome/execução), nunca por regex em runtime. Cardio (item contínuo)
 * não dobra execução resistida; recebe BILATERAL como valor neutro do campo obrigatório.
 */

export type ExecucaoLateralidade = "BILATERAL" | "UNILATERAL_ALTERNADO" | "UNILATERAL_DOIS_LADOS";

/** Curadoria explícita de TODOS os exercícios (gate: nenhum pode faltar). */
export const LATERALIDADE: Record<string, ExecucaoLateralidade> = {
  e1: "BILATERAL", // Flexão de braço
  e2: "BILATERAL", // Flexão com pés elevados
  e3: "BILATERAL", // Agachamento livre
  e4: "BILATERAL", // Abdominal (crunch)
  e5: "BILATERAL", // Abdominal na polia
  e6: "BILATERAL", // Abdominal na máquina
  e7: "BILATERAL", // Prancha
  e8: "BILATERAL", // Roda abdominal
  e9: "BILATERAL", // Supino reto
  e10: "BILATERAL", // Supino inclinado
  e11: "BILATERAL", // Supino com halteres
  e12: "BILATERAL", // Supino inclinado com halteres
  e13: "BILATERAL", // Supino declinado
  e14: "BILATERAL", // Crucifixo na polia (cabos)
  e15: "BILATERAL", // Supino na máquina
  e16: "UNILATERAL_DOIS_LADOS", // Afundo (avanço)
  e17: "UNILATERAL_ALTERNADO", // Passada andando
  e18: "UNILATERAL_DOIS_LADOS", // Avanço lateral
  e19: "BILATERAL", // Rosca direta
  e20: "BILATERAL", // Rosca com elástico
  e21: "BILATERAL", // Barra fixa
  e22: "BILATERAL", // Barra fixa supinada (chin-up)
  e23: "BILATERAL", // Polichinelo
  e24: "BILATERAL", // Corrida na esteira
  e25: "BILATERAL", // Polichinelo agachado
  e26: "BILATERAL", // Levantamento terra
  e27: "BILATERAL", // Levantamento terra sumô
  e28: "BILATERAL", // Leg press
  e29: "BILATERAL", // Bicicleta ergométrica
  e30: "BILATERAL", // Burpee
  e31: "BILATERAL", // Elíptico
  e32: "BILATERAL", // Agachamento com barra
  e33: "BILATERAL", // Agachamento goblet
  e34: "BILATERAL", // Agachamento no Smith
  e35: "BILATERAL", // Escalador (mountain climber)
  e36: "BILATERAL", // Elevação de panturrilha
  e37: "UNILATERAL_DOIS_LADOS", // Panturrilha unilateral
  e38: "BILATERAL", // Panturrilha em pé (máquina)
  e39: "BILATERAL", // Panturrilha no leg press
  e40: "BILATERAL", // Mergulho no banco (tríceps)
  e41: "BILATERAL", // Desenvolvimento de ombros
  e42: "BILATERAL", // Desenvolvimento com halteres (sentado)
  e43: "BILATERAL", // Desenvolvimento na máquina
  e44: "BILATERAL", // Desenvolvimento com elástico
  e45: "BILATERAL", // Remada curvada
  e46: "BILATERAL", // Remada baixa (na polia)
  e47: "BILATERAL", // Remada na máquina
  e48: "BILATERAL", // Remada no Smith
  e49: "BILATERAL", // Puxada alta na polia (lat pulldown)
  e50: "BILATERAL", // Puxada triângulo (pegada fechada)
  e51: "UNILATERAL_DOIS_LADOS", // Puxada unilateral na polia
  e52: "BILATERAL", // Elevação lateral
  e53: "UNILATERAL_DOIS_LADOS", // Elevação lateral na polia
  e54: "UNILATERAL_DOIS_LADOS", // Elevação lateral deitado
  e55: "BILATERAL", // Crucifixo
  e56: "BILATERAL", // Crucifixo inclinado
  e57: "BILATERAL", // Ponte de glúteo
  e58: "BILATERAL", // Ponte de glúteo com pés elevados
  e59: "BILATERAL", // Elevação de quadril (hip thrust)
  e60: "UNILATERAL_DOIS_LADOS", // Coice de glúteo na polia
  e61: "UNILATERAL_DOIS_LADOS", // Afundo com halteres
  e62: "BILATERAL", // Cadeira extensora
  e63: "UNILATERAL_DOIS_LADOS", // Cadeira extensora unilateral
  e64: "BILATERAL", // Mesa flexora
  e65: "BILATERAL", // Mesa flexora sentada
  e66: "UNILATERAL_DOIS_LADOS", // Cadeira flexora em pé
  e67: "BILATERAL", // Tríceps testa
  e68: "BILATERAL", // Tríceps na polia
  e69: "BILATERAL", // Tríceps na corda
  e70: "BILATERAL", // Supino fechado
  e71: "BILATERAL", // Tríceps testa na polia
  // 🔒 e72 é CASO COM ESCOLHA DO USUÁRIO (ver LATERALIDADE_ESCOLHA). O valor aqui é o
  // FALLBACK temporalmente neutro (todas as opções permitidas têm o MESMO multiplicador:
  // nenhuma dobra). A escolha real do usuário vive no slot (`execucaoSelecionada`).
  e72: "BILATERAL", // Rosca martelo
  e73: "BILATERAL", // Rosca inversa
  e74: "UNILATERAL_DOIS_LADOS", // Rosca concentrada
  e75: "BILATERAL", // Rosca na polia
  e76: "BILATERAL", // Rosca inclinada
  e77: "BILATERAL", // Rosca martelo na corda
  e78: "UNILATERAL_DOIS_LADOS", // Agachamento búlgaro
  e79: "UNILATERAL_DOIS_LADOS", // Afundo no Smith
  e80: "BILATERAL", // Stiff (terra romeno)
  e81: "BILATERAL", // Stiff com halteres
  e82: "UNILATERAL_DOIS_LADOS", // Stiff unilateral
  e83: "BILATERAL", // Flexão nórdica
  e84: "UNILATERAL_DOIS_LADOS", // Remada unilateral (serrote)
  e85: "BILATERAL", // Elevação de pernas
  e86: "BILATERAL", // Curl de posterior deslizante
  e87: "BILATERAL", // Mesa flexora com elástico
  e88: "BILATERAL", // Elevação de pernas suspenso
  e89: "BILATERAL", // Elevação de joelhos no apoio
  e90: "UNILATERAL_DOIS_LADOS", // Prancha lateral
  e91: "UNILATERAL_DOIS_LADOS", // Prancha lateral com rotação
  e92: "BILATERAL", // Pular corda
  e93: "BILATERAL", // Remo (máquina)
  e94: "BILATERAL", // Agachamento na parede (isométrico)
  e95: "BILATERAL", // Remada alta
  e96: "BILATERAL", // Remada alta com elástico
  e97: "BILATERAL", // Encolhimento (trapézio)
  e98: "BILATERAL", // Elevação frontal
  e99: "UNILATERAL_DOIS_LADOS", // Elevação frontal na polia
  e100: "BILATERAL", // Paralelas (mergulho)
  e101: "UNILATERAL_DOIS_LADOS", // Giro russo (curadoria final do autor, 2026-08-21)
  e102: "UNILATERAL_DOIS_LADOS", // Flexão lateral (oblíquo)
  e103: "BILATERAL", // Superman (extensão lombar)
  e104: "BILATERAL", // Hiperextensão lombar
  e105: "UNILATERAL_DOIS_LADOS", // Subida no banco (step-up)
  e106: "BILATERAL", // Crucifixo invertido
  e107: "BILATERAL", // Crucifixo invertido na máquina
  e108: "BILATERAL", // Balanço com kettlebell (swing)
  e109: "BILATERAL", // Caminhada do fazendeiro
  e110: "BILATERAL", // Corda naval (battle rope)
  e111: "BILATERAL", // Desenvolvimento Arnold
  e112: "UNILATERAL_ALTERNADO", // Rosca alternada
  e113: "BILATERAL", // Flexão diamante
  e114: "BILATERAL", // Flexão pique (pike)
  e115: "BILATERAL", // Abdominal infra (canivete)
  e116: "BILATERAL", // Remada invertida (na mesa)
  e117: "BILATERAL", // Bom dia (good morning)
  e118: "BILATERAL", // Pendura na barra
  e119: "BILATERAL", // Puxada para o rosto (face pull)
  e120: "BILATERAL", // Puxada com elástico
  e121: "BILATERAL", // Agachamento frontal
  e122: "BILATERAL", // Rosca scott
  e123: "BILATERAL", // Flexora no banco romano (glute-ham raise)
  e124: "BILATERAL", // Rosca scott na máquina
  e125: "BILATERAL", // Pullover
  e126: "BILATERAL", // Pullover na polia (pulldown de braços estendidos)
  e127: "BILATERAL", // Cadeira abdutora
  e128: "UNILATERAL_DOIS_LADOS", // Abdução de quadril na polia
  e129: "BILATERAL", // Cadeira adutora
  e130: "BILATERAL", // Voador (peck deck)
  e131: "BILATERAL", // Crossover (cabo cruzado)
  e132: "BILATERAL", // Crossover na polia baixa
  e133: "UNILATERAL_DOIS_LADOS", // Tríceps coice
  e134: "UNILATERAL_DOIS_LADOS", // Tríceps unilateral na polia
  e135: "BILATERAL", // Tríceps francês
  e136: "BILATERAL", // Rosca 21
  e137: "BILATERAL", // Rosca de punho
  e138: "BILATERAL", // Rosca de punho invertida
  e139: "BILATERAL", // Rolo de punho
  e140: "BILATERAL", // Pegada estática (farmer hold)
  e141: "BILATERAL", // Agachamento hack
  e142: "BILATERAL", // Agachamento sissy
  e143: "UNILATERAL_ALTERNADO", // Avanço com salto
  e144: "BILATERAL", // Thruster (agachamento + desenvolvimento)
  e145: "UNILATERAL_DOIS_LADOS", // Agachamento unilateral (pistol)
  e146: "UNILATERAL_ALTERNADO", // Prancha com toque no ombro (curadoria final do autor, 2026-08-21)
  e147: "UNILATERAL_ALTERNADO", // Bird dog (perdigueiro)
  e148: "UNILATERAL_ALTERNADO", // Inseto morto (dead bug)
  e149: "UNILATERAL_ALTERNADO", // Abdominal bicicleta
  e150: "BILATERAL", // Corrida no lugar (joelho alto)
  e151: "BILATERAL", // Patinador (skater)
  e152: "BILATERAL", // Agachamento sumô
  e153: "BILATERAL", // Elevação pélvica na máquina
  e154: "BILATERAL", // Remada cavalinho (T-bar)
  e155: "BILATERAL", // Desenvolvimento militar
  e156: "BILATERAL", // Flexão inclinada (mãos elevadas)
  e157: "BILATERAL", // Flexão na parede
  e158: "BILATERAL", // Panturrilha sentado
  e159: "BILATERAL", // Abdominal remador
  e160: "UNILATERAL_DOIS_LADOS", // Afundo reverso
  e161: "UNILATERAL_DOIS_LADOS", // Ponte unilateral de glúteo
  e162: "BILATERAL", // Remada com elástico
  e163: "BILATERAL", // Agachamento com salto
  e164: "BILATERAL", // Remada invertida com pés elevados
  e165: "UNILATERAL_DOIS_LADOS", // Remada invertida unilateral
  e166: "BILATERAL", // Remada invertida com cabo de vassoura
  e167: "BILATERAL", // Elevação em Y-T-W de bruços
  e168: "BILATERAL", // Remada invertida com pegada supinada
};

/**
 * 🔒 CURADORIA FINAL DO AUTOR (2026-08-21) — os 11 casos antes provisórios foram RESOLVIDOS.
 * Esta lista SUBSTITUI a antiga `LATERALIDADE_AMBIGUA`; a ambiguidade acabou (zero restante).
 * Serve de trilha de auditoria: prova que cada caso saiu de "provisório" para "travado" com o
 * valor final. `e72` NÃO entra aqui como valor único — é caso com escolha (ver LATERALIDADE_ESCOLHA).
 */
export const LATERALIDADE_RESOLVIDA_AUTOR: ReadonlyArray<{ id: string; nome: string; final: ExecucaoLateralidade | "ESCOLHA_USUARIO" }> = [
  { id: "e16", nome: "Afundo (avanço)", final: "UNILATERAL_DOIS_LADOS" },
  { id: "e53", nome: "Elevação lateral na polia", final: "UNILATERAL_DOIS_LADOS" },
  { id: "e54", nome: "Elevação lateral deitado", final: "UNILATERAL_DOIS_LADOS" },
  { id: "e66", nome: "Cadeira flexora em pé", final: "UNILATERAL_DOIS_LADOS" },
  { id: "e99", nome: "Elevação frontal na polia", final: "UNILATERAL_DOIS_LADOS" },
  { id: "e101", nome: "Giro russo", final: "UNILATERAL_DOIS_LADOS" },
  { id: "e133", nome: "Tríceps coice", final: "UNILATERAL_DOIS_LADOS" },
  { id: "e98", nome: "Elevação frontal", final: "BILATERAL" },
  { id: "e143", nome: "Avanço com salto", final: "UNILATERAL_ALTERNADO" },
  { id: "e146", nome: "Prancha com toque no ombro", final: "UNILATERAL_ALTERNADO" },
  { id: "e72", nome: "Rosca martelo", final: "ESCOLHA_USUARIO" },
];

/**
 * 🔒 CASO COM ESCOLHA DO USUÁRIO (autor, 2026-08-21) — exercícios cuja execução o usuário
 * escolhe entre um conjunto de opções PERMITIDAS. O catálogo registra as opções; o motor NÃO
 * inventa preferência global. Invariantes travadas (testadas):
 *  - TODAS as opções permitidas têm o MESMO multiplicador temporal (nenhuma é DOIS_LADOS), então
 *    a AUSÊNCIA de escolha não torna a duração incalculável;
 *  - `UNILATERAL_DOIS_LADOS` NUNCA é opção permitida aqui (não dobra a execução por escolha);
 *  - o valor default em `LATERALIDADE[id]` é apenas o FALLBACK neutro e DEVE estar entre as opções.
 *
 * e72 — rosca martelo: alternado (UNILATERAL_ALTERNADO) ou simultâneo (BILATERAL).
 */
export const LATERALIDADE_ESCOLHA: Record<string, ExecucaoLateralidade[]> = {
  e72: ["UNILATERAL_ALTERNADO", "BILATERAL"],
};

/** Conveniência: um exercício tem escolha de execução? (contrato do catálogo) */
export function temEscolhaDeExecucao(id: string): boolean {
  return LATERALIDADE_ESCOLHA[id] != null;
}

/**
 * 🔒 Resolve a execução EFETIVA de um exercício, honrando a escolha materializada do usuário.
 * Determinístico e fail-safe (motor puro, sem default silencioso):
 *  - exercício SEM escolha: `execucaoSelecionada` só pode repetir o valor curado; divergir LANÇA;
 *  - exercício COM escolha (e72): a seleção precisa estar entre as opções permitidas; fora
 *    disso LANÇA (em especial UNILATERAL_DOIS_LADOS é sempre rejeitado para e72). Sem seleção,
 *    cai no fallback neutro `execucaoBase` — temporalmente idêntico a qualquer opção permitida.
 */
export function resolverExecucao(
  id: string,
  execucaoBase: ExecucaoLateralidade,
  execucaoSelecionada?: ExecucaoLateralidade,
): ExecucaoLateralidade {
  const permitidas = LATERALIDADE_ESCOLHA[id];
  if (permitidas == null) {
    // Sem escolha: a seleção (se houver) não pode contradizer a curadoria única.
    if (execucaoSelecionada != null && execucaoSelecionada !== execucaoBase) {
      throw new Error(`[lateralidade] ${id} não admite escolha de execução; recebido '${execucaoSelecionada}' ≠ curadoria '${execucaoBase}'`);
    }
    return execucaoBase;
  }
  if (execucaoSelecionada == null) return execucaoBase; // fallback neutro (mesmo multiplicador)
  if (!permitidas.includes(execucaoSelecionada)) {
    throw new Error(`[lateralidade] ${id}: execução '${execucaoSelecionada}' fora das permitidas [${permitidas.join(', ')}]`);
  }
  return execucaoSelecionada;
}

/**
 * 🔵 PREFERÊNCIA POR EXECUÇÃO BILATERAL (pedido do autor, 2026-09-19): *"quero exercícios
 * bilaterais como padrão, para facilitar a execução"* — o relato nomeou "Stiff unilateral"
 * (e82) e a captura trouxe "Puxada unilateral na polia" (e51).
 *
 * 🔒 É PREFERÊNCIA DE DESEMPATE, nunca filtro: o unilateral continua elegível e continua
 * entrando quando é a única opção da função (a família `afundo`, por exemplo, é inteira
 * unilateral). E não afirma nada sobre valor científico de uma execução ou da outra — é a
 * facilidade de execução que o autor pediu.
 *
 * `UNILATERAL_ALTERNADO` entra junto do `UNILATERAL_DOIS_LADOS` no lado "não bilateral":
 * a pergunta aqui é "os dois lados no mesmo movimento?", e a resposta é a mesma para os dois.
 */
export function ehBilateral(ex: { execucao: ExecucaoLateralidade }): boolean {
  return ex.execucao === 'BILATERAL';
}
