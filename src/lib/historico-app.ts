/**
 * 🔴 O VOLTAR DO NAVEGADOR DENTRO DO APP (pedido-ui-biblioteca-e-voltar-2026-08-13, item 2).
 *
 * Nas palavras do autor: *"quando eu estou dentro do app em qualquer menu, quando eu aperto o
 * botão lateral do mouse para voltar, ele volta direto para a página inicial onde tem que
 * fazer login — e não para a última página visitada de fato."* Pedido REPETIDO.
 *
 * A causa confirmada na leitura: a navegação interna do painel é **estado de componente**
 * (`aba`, `modal`, `biblioteca`, `editorDias`, `detalhe`, …) e **nada** chamava `pushState` —
 * então para o navegador o app inteiro é UMA entrada de histórico, e o Voltar sai da rota
 * `/app` para o que veio antes (landing/login).
 *
 * 🔒 O DESENHO, e por que este e não outro:
 *  · cada abertura de camada (modal/editor/detalhe) e cada troca de aba empilham UMA entrada
 *    `pushState` **na mesma URL**. Mesma URL importa: o App Router do Next só navega quando o
 *    pathname muda, então o boot server-first de `/app` (sessão → perfil → painel) não é
 *    tocado — o handler de histórico e o redirect de sessão não brigam;
 *  · a reconciliação é por **profundidade** (`state.evk` = tamanho da pilha), nunca por
 *    "recebi um popstate, fecho alguma coisa". É isso que faz o AVANÇAR não quebrar: voltar
 *    é `alvo < atual`, avançar é `alvo > atual`, e só o primeiro consome;
 *  · fechar pela UI (o × do modal) desempilha e chama `back()` — a entrada não fica órfã, e
 *    a reconciliação por profundidade absorve o `popstate` que isso gera sem fechar nada a
 *    mais (alvo == atual);
 *  · quando a pilha está vazia o `popstate` **não é consumido** — o app sai, que é o aceite
 *    2c. Sair continua possível; o que morre é sair sem ter voltado nada antes.
 *
 * PURO o bastante para teste em node: a `History` entra por injeção (`HistoriaMinima`), sem
 * jsdom. O hook de React que usa isto vive em `usar-voltar.ts`.
 */

/** O pedaço de `window.history` de que precisamos — injetável para teste. */
export interface HistoriaMinima {
  pushState(state: unknown, unused: string, url?: string | null): void;
  back(): void;
}

export type Entrada =
  /** Camada visual: modal, editor, detalhe, menu. Voltar FECHA (aceite 2a). */
  | { tipo: 'camada'; id: number; nome: string; fechar: () => void }
  /** Troca de aba: Voltar restaura a aba ANTERIOR, na ordem visitada (aceite 2b). */
  | { tipo: 'aba'; id: number; anterior: string; restaurar: (aba: string) => void };

export type ResultadoPop = 'consumido' | 'ignorado' | 'avancou';

/** `Omit` sobre união precisa distribuir, senão só sobram as chaves comuns aos dois ramos. */
type SemId<T> = T extends { id: number } ? Omit<T, 'id'> : never;
export type EntradaNova = SemId<Entrada>;

export class HistoricoApp {
  private pilha: Entrada[] = [];
  private proximoId = 1;

  constructor(private readonly historia: HistoriaMinima) {}

  get profundidade(): number { return this.pilha.length; }
  /** Só para diagnóstico/teste: os nomes das camadas abertas, de baixo para cima. */
  get nomes(): string[] { return this.pilha.map((e) => (e.tipo === 'camada' ? e.nome : `aba:${e.anterior}`)); }

  /** Abre uma camada (ou registra a troca de aba) e cria a entrada de histórico. */
  empilhar(entrada: EntradaNova): number {
    const id = this.proximoId++;
    this.pilha.push({ ...entrada, id } as Entrada);
    this.historia.pushState({ evk: this.pilha.length }, '');
    return id;
  }

  estaNaPilha(id: number): boolean { return this.pilha.some((e) => e.id === id); }

  /**
   * A UI fechou a camada sozinha (o × do modal, "Cancelar"). Tira a entrada e desfaz o
   * `pushState` correspondente — senão sobraria uma entrada fantasma e o próximo Voltar não
   * faria nada visível. O `popstate` que o `back()` dispara chega com `alvo == profundidade`
   * e a reconciliação o ignora sozinha, sem precisar de flag.
   */
  desempilharPorApp(id: number): void {
    const i = this.pilha.findIndex((e) => e.id === id);
    if (i < 0) return;
    // Só o topo pode ser desfeito com um `back()`; camadas do meio saem sem mexer no
    // histórico (caso raro — fechar por baixo — em que uma entrada a mais é preferível a
    // um `go(-n)` que atropelaria camadas ainda abertas).
    const eraTopo = i === this.pilha.length - 1;
    this.pilha.splice(i, 1);
    if (eraTopo) this.historia.back();
  }

  /**
   * Chegou um `popstate`. `state` é o `event.state` bruto.
   * · `alvo < profundidade` → VOLTOU: desempilha e aplica cada entrada, do topo para baixo;
   * · `alvo > profundidade` → AVANÇOU para entradas que já não temos: não quebra, só ignora
   *   (aceite 2f — não duplica entrada nem trava);
   * · igual → nada a fazer (é o eco do nosso próprio `back()`).
   */
  aoVoltar(state: unknown): ResultadoPop {
    const alvo = typeof state === 'object' && state !== null && typeof (state as { evk?: unknown }).evk === 'number'
      ? (state as { evk: number }).evk
      : 0;
    if (alvo > this.pilha.length) return 'avancou';
    if (alvo === this.pilha.length) return 'ignorado';
    let consumiu = false;
    while (this.pilha.length > alvo) {
      const e = this.pilha.pop()!;
      consumiu = true;
      if (e.tipo === 'camada') e.fechar();
      else e.restaurar(e.anterior);
    }
    return consumiu ? 'consumido' : 'ignorado';
  }

  /** Zera (troca de rota, logout). Não mexe no histórico do navegador. */
  limpar(): void { this.pilha = []; }
}
