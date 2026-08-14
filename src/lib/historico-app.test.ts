/**
 * 🔴 O VOLTAR DO NAVEGADOR — os aceites 2a–2f do pedido-ui-biblioteca-e-voltar-2026-08-13,
 * um a um, contra a máquina real (`HistoricoApp`) com uma `History` falsa.
 *
 * A falsa não é um dublê de mentirinha: ela mantém a MESMA semântica que importa aqui — uma
 * lista de estados e um cursor — então `back()` devolve o `state` anterior de verdade, e um
 * conserto que só funcionasse "no papel" quebraria estes testes.
 */
import { describe, expect, it } from 'vitest';
import { HistoricoApp, type HistoriaMinima } from './historico-app';

/** Histórico de mentira com a semântica de verdade: pilha de estados + cursor. */
class HistoriaFake implements HistoriaMinima {
  estados: unknown[] = [null]; // a entrada base (a rota /app em si)
  cursor = 0;
  private ouvinte: ((state: unknown) => void) | null = null;

  ouvir(f: (state: unknown) => void) { this.ouvinte = f; }
  pushState(state: unknown) {
    this.estados = this.estados.slice(0, this.cursor + 1);
    this.estados.push(state);
    this.cursor += 1;
  }
  back() { this.ir(-1); }
  avancar() { this.ir(1); }
  /** `saiu`: o cursor tentou passar da entrada base — na vida real, sair do app. */
  private ir(d: number) {
    const alvo = this.cursor + d;
    if (alvo < 0) { this.saiu = true; return; }
    if (alvo >= this.estados.length) return;
    this.cursor = alvo;
    this.ouvinte?.(this.estados[this.cursor]);
  }
  saiu = false;
  get entradas() { return this.estados.length; }
}

const montar = () => {
  const h = new HistoriaFake();
  const app = new HistoricoApp(h);
  h.ouvir((s) => app.aoVoltar(s));
  return { h, app };
};

describe('🔴 Voltar do navegador — aceites 2a–2f', () => {
  it('2a — com um modal aberto, Voltar FECHA o modal e não sai do app', () => {
    const { h, app } = montar();
    let biblioteca = true;
    app.empilhar({ tipo: 'camada', nome: 'biblioteca', fechar: () => { biblioteca = false; } });
    expect(app.profundidade).toBe(1);

    h.back();

    expect(biblioteca, 'o Voltar tinha que fechar a biblioteca').toBe(false);
    expect(h.saiu, 'não pode ter saído do app').toBe(false);
    expect(app.profundidade).toBe(0);
  });

  it('2a — camadas empilhadas fecham de cima para baixo, uma por Voltar', () => {
    const { h, app } = montar();
    const aberto = { troca: true, biblioteca: true };
    app.empilhar({ tipo: 'camada', nome: 'troca', fechar: () => { aberto.troca = false; } });
    app.empilhar({ tipo: 'camada', nome: 'biblioteca', fechar: () => { aberto.biblioteca = false; } });

    h.back();
    expect(aberto, 'só a de cima fecha no primeiro Voltar').toEqual({ troca: true, biblioteca: false });
    h.back();
    expect(aberto).toEqual({ troca: false, biblioteca: false });
    expect(h.saiu).toBe(false);
  });

  it('2b — sem modal, Voltar navega as abas na ORDEM VISITADA', () => {
    const { h, app } = montar();
    let aba = 'hoje';
    const ir = (destino: string) => {
      app.empilhar({ tipo: 'aba', anterior: aba, restaurar: (a) => { aba = a; } });
      aba = destino;
    };
    ir('treino'); ir('dieta'); ir('progresso');
    expect(aba).toBe('progresso');

    h.back(); expect(aba).toBe('dieta');
    h.back(); expect(aba).toBe('treino');
    h.back(); expect(aba).toBe('hoje');
    expect(h.saiu, 'ainda havia histórico interno — não podia sair').toBe(false);
  });

  it('2c — só sai do app quando o histórico interno acabou', () => {
    const { h, app } = montar();
    let aba = 'hoje';
    app.empilhar({ tipo: 'aba', anterior: aba, restaurar: (a) => { aba = a; } });
    aba = 'treino';
    app.empilhar({ tipo: 'camada', nome: 'biblioteca', fechar: () => {} });

    h.back(); // fecha a biblioteca
    expect(h.saiu).toBe(false);
    h.back(); // volta para 'hoje'
    expect(aba).toBe('hoje');
    expect(h.saiu).toBe(false);
    expect(app.profundidade).toBe(0);

    h.back(); // agora sim: nada mais nosso na pilha
    expect(h.saiu, 'com a pilha vazia o app TEM que poder sair').toBe(true);
  });

  it('fechar pela UI (o × do modal) não deixa entrada fantasma no histórico', () => {
    const { h, app } = montar();
    const antes = h.entradas;
    const id = app.empilhar({ tipo: 'camada', nome: 'detalhe', fechar: () => {} });
    expect(h.entradas).toBe(antes + 1);

    app.desempilharPorApp(id); // o usuário clicou no ×

    expect(app.profundidade).toBe(0);
    expect(h.cursor, 'o cursor tem que ter voltado para a entrada de baixo').toBe(antes - 1);
    // e o Voltar seguinte sai do app, em vez de "desfazer" um modal já fechado
    h.back();
    expect(h.saiu).toBe(true);
  });

  it('2f — ir e voltar duas vezes não duplica entradas nem trava', () => {
    const { h, app } = montar();
    let aba = 'hoje';
    const ir = (destino: string) => {
      app.empilhar({ tipo: 'aba', anterior: aba, restaurar: (a) => { aba = a; } });
      aba = destino;
    };
    ir('treino');
    const entradasApos1 = h.entradas;

    h.back(); expect(aba).toBe('hoje');
    ir('treino');
    h.back(); expect(aba).toBe('hoje');

    expect(h.entradas, 'o histórico não pode inchar a cada ida e volta').toBe(entradasApos1);
    expect(app.profundidade).toBe(0);
  });

  it('2f — o AVANÇAR não quebra: não fecha camada nem embaralha a pilha', () => {
    const { h, app } = montar();
    let biblioteca = true;
    app.empilhar({ tipo: 'camada', nome: 'biblioteca', fechar: () => { biblioteca = false; } });

    h.back();
    expect(biblioteca).toBe(false);
    expect(app.profundidade).toBe(0);

    h.avancar(); // Avançar para uma entrada que já não é nossa

    expect(app.aoVoltar({ evk: 1 })).toBe('avancou');
    expect(app.profundidade, 'avançar não pode inventar camada na pilha').toBe(0);
    expect(h.saiu).toBe(false);
  });

  it('um popstate de fora (state alheio) não fecha nada quando a pilha está vazia', () => {
    const { app } = montar();
    expect(app.aoVoltar(undefined)).toBe('ignorado');
    expect(app.aoVoltar({ outraCoisa: 9 })).toBe('ignorado');
    expect(app.profundidade).toBe(0);
  });
});
