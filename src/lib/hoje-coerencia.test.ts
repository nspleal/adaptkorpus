import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { montarSemana, sessaoDeHojeIdx, type Weekday } from './semana';

/**
 * 🔒 A TELA HOJE NÃO PODE SE CONTRADIZER (DF 2026-08-04, varredura de produção de 04/08).
 *
 * 🔴 Medido em produção, terça 04/08: "Sua semana" marca **Ter · Lower A** com selo HOJE; o
 * banner diz **Lower A** ("Ir para a sessão"); o cartão "TREINO DE HOJE" diz **Upper A**.
 * Dois elementos dizem uma coisa, um diz outra, na mesma tela.
 *
 * 🔑 A hipótese do handoff era "o cartão mostra a próxima sessão não feita do ciclo". **É
 * mais simples e mais grave:** o cartão lê `rotinaDias[0]` — a **primeira sessão da rotina,
 * sempre**, sem olhar o calendário. Ele só acerta no dia da semana que calha de mapear para
 * a sessão 0: **1 dia em 7**. E num dia de DESCANSO ele anuncia um treino que não existe.
 *
 * ⚠️ E o que o diagnóstico achou além do rótulo: o **botão** do cartão chamava
 * `iniciarSessaoGuiada(0)`. Na terça, "Começar treino" abria **Upper A** enquanto "Ir para a
 * sessão" abria **Lower A** — dois botões na mesma tela iniciando treinos diferentes, e a
 * métrica de ativação (`sessao_iniciada`) carimbando a sessão errada. Não era defeito de
 * rótulo: era **ação errada**.
 */

const PAINEL = join(process.cwd(), 'src/components/painel/Painel.tsx');
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

/** A conta do autor na varredura: 4 sessões de força, treino seg/ter/qui/sex. */
const DIAS_AUTOR: Weekday[] = ['seg', 'ter', 'qui', 'sex'];
const NOMES = ['Upper A', 'Lower A', 'Upper B', 'Lower B'];

describe('🔒 os três elementos da Hoje leem a MESMA fonte', () => {
  /**
   * 🔑 A COERÊNCIA, afirmada entre os elementos e não contra um valor fixo: o que o cartão
   * mostra tem de ser o que a faixa "Sua semana" marca como hoje. Se um dia os dois mudarem
   * juntos, o teste continua válido; se um mudar sozinho, ele cai.
   */
  it.each([0, 1, 2, 3, 4, 5, 6])('dia %i da semana: cartão e faixa apontam a MESMA sessão', (hojeIdx) => {
    const semana = montarSemana(DIAS_AUTOR, NOMES, hojeIdx);
    const naFaixa = semana[hojeIdx]!.sessionIdx ?? null;
    // ⚠️ A 1ª escrita comparava a faixa consigo mesma — teste VACUOSO, passava com a tela
    // quebrada. O lado do cartão tem de ser a função que a PRODUÇÃO usa: assim uma mutação
    // nela (voltar a devolver 0, por exemplo) derruba a prova.
    const noCartao = sessaoDeHojeIdx(DIAS_AUTOR, NOMES, hojeIdx);
    expect(noCartao, `faixa e cartão divergem no dia ${hojeIdx}`).toBe(naFaixa);
  });

  it('🔴 o caso da varredura: terça com treino ≠ 1ª sessão do ciclo', () => {
    const semana = montarSemana(DIAS_AUTOR, NOMES, 1); // 04/08/2026 = terça
    expect(semana[1]!.sessionIdx, 'a terça deixou de ser a 2ª sessão').toBe(1);
    expect(semana[1]!.sessionLabel).toBe('Lower A');
    // 🔑 É este o par que prova o defeito: o índice fixo 0 NÃO é o de hoje.
    expect(semana[1]!.sessionIdx).not.toBe(0);
  });

  it('num dia de DESCANSO não existe sessão de hoje — nem para o cartão', () => {
    const semana = montarSemana(DIAS_AUTOR, NOMES, 5); // sábado
    expect(semana[5]!.tipo).toBe('descanso');
    expect(semana[5]!.sessionIdx).toBeUndefined();
  });

  /**
   * 🔒 A PROVA ESTRUTURAL, que é a que falha no código do defeito: o cartão e o seu botão
   * não podem receber um índice literal. Sem ela, as asserções acima são sobre a biblioteca
   * e passam com a tela quebrada — a lição de "a suíte prova função, não montagem".
   */
  it('o cartão da Hoje NÃO recebe índice fixo — nem para exibir, nem para iniciar', () => {
    const src = semComentarios(readFileSync(PAINEL, 'utf8'));
    const i = src.indexOf('<Hoje ');
    expect(i, 'o cartão <Hoje> sumiu do Painel').toBeGreaterThan(-1);
    const tag = src.slice(i, src.indexOf('/>', i));
    expect(tag, 'o cartão exibe a 1ª sessão da rotina, não a de hoje').not.toMatch(/dia=\{rotinaDias\[0\]\}/);
    expect(tag, 'o botão do cartão inicia a sessão 0, não a de hoje').not.toMatch(/iniciarSessaoGuiada\(0\)/);
  });

  it('o registro manual também parte da sessão de HOJE', () => {
    const src = semComentarios(readFileSync(PAINEL, 'utf8'));
    expect(src, '`diaHoje` recebia a 1ª sessão da rotina — o registro manual pré-preenchia o treino errado')
      .not.toMatch(/diaHoje=\{rotinaDias\[0\]\}/);
  });

  it('anti-vacuidade: o recorte da tag é a tag, não o arquivo', () => {
    const src = semComentarios(readFileSync(PAINEL, 'utf8'));
    const i = src.indexOf('<Hoje ');
    const tag = src.slice(i, src.indexOf('/>', i));
    expect(tag.length).toBeGreaterThan(80);
    expect(tag.length).toBeLessThan(src.length / 4);
    expect(tag).toMatch(/dia=\{/);
  });
});
