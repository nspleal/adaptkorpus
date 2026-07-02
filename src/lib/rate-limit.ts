/**
 * Rate limit em memória — simples e auditável, sem dependência externa.
 *
 * Puro no espírito do resto do código (`rotacao-pratos.ts`): o relógio entra por
 * parâmetro, então a lógica é determinística e testável. O estado (Map por chave) vive no
 * processo — em serverless isso é best-effort por instância, o que é suficiente como
 * primeira barreira do formulário de suporte (a barreira global/fiel vem com o backend —
 * tarefa Hardening-1). Nunca guarda conteúdo, só timestamps por chave.
 */

export interface JanelaRateLimit {
  /** máx. de eventos permitidos dentro da janela */
  limite: number;
  /** tamanho da janela em ms */
  janelaMs: number;
}

export function criarRateLimit({ limite, janelaMs }: JanelaRateLimit) {
  const eventos = new Map<string, number[]>();
  return {
    /** true = permitido (e registra); false = estourou o limite. */
    permitir(chave: string, agora: number = Date.now()): boolean {
      const corte = agora - janelaMs;
      const lista = (eventos.get(chave) ?? []).filter((t) => t > corte);
      if (lista.length >= limite) {
        eventos.set(chave, lista); // poda mesmo quando nega (autolimpeza)
        return false;
      }
      lista.push(agora);
      eventos.set(chave, lista);
      return true;
    },
  };
}
