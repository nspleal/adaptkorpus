import type { Avaliacao, ItemCritico } from '@/lib/engine/critico';
import type { RotinaSemanal } from '@/lib/engine/treino-types';

/**
 * 🔴 D16 (auditoria 2026-09-11 sobre `a40f8af`) — UMA VOZ POR FATO.
 *
 * Na aba Treino conviviam, sobre o MESMO grupo e a MESMA semana:
 *   · do motor:   "Atenção: o volume de ombros ficou abaixo do mínimo desta semana."
 *   · do crítico: "Ombros está abaixo da faixa mínima desta semana (10 de 13 séries)."
 * Não há erro de cálculo em nenhuma das duas — é a mesma medição, dita duas vezes, e só uma
 * delas traz os números. O comentário de D1 em `veredito-motor.ts` já advertia contra "o
 * segundo sistema de avisos"; este módulo é onde a sobreposição é resolvida.
 *
 * 🔒 O que este módulo é, e o que ele não é:
 *
 *  · Ele compara FATOS — grupo, semana, escopo, métrica e limiar —, nunca texto. Deduplicar
 *    por string acharia igualdade onde não há (dois grupos com a mesma frase) e deixaria
 *    passar duplicata onde há (a mesma medição com redações diferentes, que é este caso).
 *  · Ele NÃO apaga aviso de risco e não escolhe por severidade. O único par que ele resolve é
 *    o do grupo abaixo do MEV, em que as duas falas afirmam a mesma coisa e a do crítico
 *    carrega o número; a do motor é o eco.
 *  · Diferenças LEGÍTIMAS ficam. A variante de CATÁLOGO do motor ("seu equipamento disponível
 *    limita...") diz a CAUSA, que o crítico não tem: fato parecido, conteúdo diferente — fica.
 *  · Nada é reescrito. A supressão remove a linha exata que o motor emitiu (`fato.aviso`), e
 *    a lista do crítico sai intacta: quem fala é sempre um produtor, nunca a tela.
 *
 * PURO e testável em Node, como o resto da casa. A tela só renderiza o que sai daqui.
 */

export interface AvisosUnificados {
  /** Avisos do motor que a tela deve renderizar, na ordem em que o motor os emitiu. */
  avisosMotor: string[];
  /** O que foi suprimido e por quê — para o teste (e a telemetria) não precisarem adivinhar. */
  suprimidos: { aviso: string; porque: string }[];
}

/** Dois itens falam do mesmo fato? A comparação é campo a campo, e exige TODOS iguais. */
function mesmoFato(
  a: NonNullable<ItemCritico['fato']>,
  b: { grupo: string; semana: number; valor?: number; escopo: string; metrica: string; limiar: string; alvo: number },
): boolean {
  return a.grupo === b.grupo && a.escopo === b.escopo && a.metrica === b.metrica
    && a.limiar === b.limiar && a.alvo === b.alvo
    && a.semana === b.semana && Number.isFinite(a.valor) && a.valor === b.valor;
}

export function unificarAvisos(
  rotina: Pick<RotinaSemanal, 'avisos' | 'fatosCobertura' | 'fatosInvariantes'> | null | undefined,
  avaliacao: (Pick<Avaliacao, 'recomendacoes' | 'avisos'> & Partial<Pick<Avaliacao, 'medidas'>>) | null | undefined,
): AvisosUnificados {
  const avisosMotor = rotina?.avisos ?? [];
  const fatos = rotina?.fatosCobertura ?? [];
  const fatosInv = rotina?.fatosInvariantes ?? [];
  if ((fatos.length === 0 && fatosInv.length === 0) || !avaliacao) {
    return { avisosMotor: [...avisosMotor], suprimidos: [] };
  }

  const doCritico = [...avaliacao.recomendacoes, ...avaliacao.avisos]
    .map((i) => i.fato)
    .filter((f): f is NonNullable<ItemCritico['fato']> => f != null);

  const suprimidos: { aviso: string; porque: string }[] = [];
  const aRemover = new Set<string>();
  for (const fato of fatos) {
    // A frase de CATÁLOGO carrega a causa (o equipamento que fecharia a conta). O crítico não
    // diz isso; suprimi-la trocaria duas falas por uma fala pior.
    if (fato.causa !== 'orcamento') continue;
    if (!doCritico.some((f) => mesmoFato(f, fato))) continue;
    aRemover.add(fato.aviso);
    suprimidos.push({
      aviso: fato.aviso,
      porque: `mesmo fato já dito pelo crítico, com os números: ${fato.grupo} · ${fato.escopo} · ${fato.metrica} · ${fato.limiar} ${fato.alvo}`,
    });
  }
  /**
   * 🔴 INVARIANTES DE PADRÃO (2026-09-16) — o mesmo desequilíbrio dito duas vezes.
   *
   * ⚠️ Medido: com um desenho só de empurrar, a tela mostrava *"Atenção: volume de puxar
   * ficou abaixo do de empurrar (alvo: puxar ≥ empurrar)"* (motor) E *"Sua semana tem mais
   * exercícios de empurrar (8) que de puxar (0)…"* (crítico). Um fato, duas falas, e a do
   * crítico é estritamente mais informativa — tem os números e o porquê.
   *
   * 🔒 A decisão é por DADO: mesmo invariante, mesmo escopo e as MESMAS contagens. Se o
   * crítico não estiver na tela, ou estiver medindo outro recorte, a linha do motor fica.
   */
  const invDoCritico = [...avaliacao.recomendacoes, ...avaliacao.avisos]
    .map((i) => i.fatoInvariante)
    .filter((f): f is NonNullable<ItemCritico['fatoInvariante']> => f != null);
  const medida = avaliacao.medidas?.puxarEmpurrar;
  for (const fato of fatosInv) {
    if (fato.invariante !== 'puxar_maior_igual_empurrar') continue;
    const mesmaFala = invDoCritico.some((f) => f.invariante === fato.invariante && f.escopo === fato.escopo
      && f.puxar === fato.puxar && f.empurrar === fato.empurrar);
    /**
     * 🔴 O CRÍTICO MEDIU O MESMO INVARIANTE COM MAIS INFORMAÇÃO.
     *
     * ⚠️ Caso medido no QA: o desenho aberto a partir do plano leva a procedência do bloco
     * do foco por id, e o crítico conta 5 × 5; o montador, no caminho custom, não monta bloco
     * nenhum e conta 5 × 7. A linha do motor afirmaria um desequilíbrio que o recorte certo
     * não tem — o mesmo defeito do relato, do outro lado da tela.
     *
     * 🔒 A regra é estreita: só quando o crítico MEDIU este invariante (`medidas`, publicada
     * mesmo sem aviso). Sem medição na tela, a linha do motor fica.
     */
    const medidoSemDesequilibrio = medida != null && medida.escopo === fato.escopo && medida.puxar >= medida.empurrar;
    if (!mesmaFala && !medidoSemDesequilibrio) continue;
    aRemover.add(fato.aviso);
    suprimidos.push({
      aviso: fato.aviso,
      porque: mesmaFala
        ? `mesmo fato já dito pelo crítico, com os números: ${fato.invariante} · ${fato.escopo} · puxar ${fato.puxar} × empurrar ${fato.empurrar}`
        : `o crítico mediu o mesmo invariante com a procedência do bloco (${fato.escopo}): puxar ${medida!.puxar} × empurrar ${medida!.empurrar} — não há desequilíbrio a afirmar`,
    });
  }

  return { avisosMotor: avisosMotor.filter((a) => !aRemover.has(a)), suprimidos };
}
