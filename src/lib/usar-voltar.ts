'use client';

import { useEffect, useRef } from 'react';
import { HistoricoApp } from './historico-app';

/**
 * 🔴 O lado React do Voltar (ver `historico-app.ts` para o desenho e os aceites).
 *
 * Uma instância por aba do navegador, guardada no módulo: as camadas se registram de vários
 * pontos da árvore (o painel tem mais de dez estados de sobreposição) e todas precisam da
 * MESMA pilha para o topo ser o topo de verdade.
 */
let instancia: HistoricoApp | null = null;

export function historicoApp(): HistoricoApp {
  if (!instancia) {
    instancia = new HistoricoApp({
      pushState: (s, u, url) => window.history.pushState(s, u, url ?? null),
      back: () => window.history.back(),
    });
  }
  return instancia;
}

/** 🧪 Só para teste: descarta a instância de módulo. */
export function _resetHistoricoApp(): void { instancia = null; }

/**
 * Liga o `popstate` à pilha. Montado UMA vez, no painel.
 *
 * ⚠️ Não faz `preventDefault` nem `pushState` de compensação: quando a pilha está vazia o
 * evento passa reto e o navegador sai do app (aceite 2c). Prender a pessoa dentro do app
 * seria pior que o defeito.
 */
export function useVoltarDoNavegador(): void {
  useEffect(() => {
    const h = historicoApp();
    const onPop = (e: PopStateEvent) => { h.aoVoltar(e.state); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}

/**
 * 🪟 UMA CAMADA (modal, editor, detalhe, menu): enquanto `aberta`, o Voltar a fecha.
 *
 * `fechar` é lido por ref para o efeito não re-empilhar a cada render (o painel recria os
 * handlers a cada ciclo) — empilhar de novo criaria entradas fantasma, que é justamente o
 * que o aceite 2f proíbe.
 */
export function useCamadaVoltavel(aberta: boolean, fechar: () => void, nome: string): void {
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;
  const idRef = useRef<number | null>(null);

  useEffect(() => {
    const h = historicoApp();
    if (aberta) {
      if (idRef.current === null) {
        idRef.current = h.empilhar({ tipo: 'camada', nome, fechar: () => { idRef.current = null; fecharRef.current(); } });
      }
      return;
    }
    // Fechou. Se a entrada ainda está na pilha, quem fechou foi a UI (o × do modal) — então
    // desfazemos a entrada. Se já saiu, quem fechou foi o próprio Voltar: nada a fazer.
    const id = idRef.current;
    if (id !== null && h.estaNaPilha(id)) { idRef.current = null; h.desempilharPorApp(id); }
    idRef.current = null;
  }, [aberta, nome]);
}

/**
 * 🗂️ AS ABAS: cada troca empilha a aba ANTERIOR, então o Voltar refaz o caminho na ordem em
 * que a pessoa andou (aceite 2b). Devolve a função que a UI deve chamar no lugar de `setAba`.
 */
export function useAbaVoltavel<T extends string>(aba: T, setAba: (a: T) => void): (destino: T) => void {
  const abaRef = useRef(aba);
  abaRef.current = aba;
  const setRef = useRef(setAba);
  setRef.current = setAba;
  const irRef = useRef((destino: T) => {
    const atual = abaRef.current;
    if (destino === atual) return;
    historicoApp().empilhar({ tipo: 'aba', anterior: atual, restaurar: (a) => setRef.current(a as T) });
    setRef.current(destino);
  });
  return irRef.current;
}
