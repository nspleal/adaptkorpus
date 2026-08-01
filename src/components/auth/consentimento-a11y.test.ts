import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * 🔴 3.3 — O CONSENTIMENTO TEM DE SER ACIONÁVEL SÓ PELO TECLADO.
 *
 * O defeito, aberto em 26/07 e marcado "leva futura" sem nunca entrar em leva: o aceite era
 * um `<div onClick>` sem `role`, sem `aria-checked` e sem `tabIndex`. Quem navega por
 * teclado ou usa leitor de tela **não conseguia consentir** — e esta é a tela do
 * consentimento, que tem peso legal (LGPD/CDC). Não é acabamento: é a porta de entrada.
 *
 * ⚠️ São DUAS telas de aceite, e é aí que este tipo de defeito volta: consertar uma e
 * esquecer a outra. Por isso o guard varre as duas e cobra a MESMA peça nas duas.
 */

const UI = 'src/components/auth/ui.tsx';
const TELAS = ['src/app/cadastro/page.tsx', 'src/app/onboarding/page.tsx'] as const;
const ler = (p: string) => readFileSync(p, 'utf8');
const podar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

/** O corpo do `LinhaConsentimento`, recortado por âncoras de código. */
function bloco(): string {
  const s = podar(ler(UI));
  const i = s.indexOf('export function LinhaConsentimento');
  expect(i, 'a peça de consentimento sumiu').toBeGreaterThanOrEqual(0);
  const fim = s.indexOf('export ', i + 10);
  return s.slice(i, fim > i ? fim : undefined);
}

describe('🔴 3.3 — a linha de consentimento é operável por teclado', () => {
  it('tem role, estado e foco — os três, ou o leitor de tela não anuncia nada', () => {
    const b = bloco();
    expect(b, 'sem role="checkbox" o elemento é um div qualquer').toMatch(/role="checkbox"/);
    expect(b, 'sem aria-checked o leitor não sabe se está marcado').toMatch(/aria-checked=\{on\}/);
    expect(b, 'sem tabIndex o teclado nunca chega nele').toMatch(/tabIndex=\{0\}/);
  });

  it('aciona por ESPAÇO (canônico) e por Enter', () => {
    const b = bloco();
    expect(b).toMatch(/onKeyDown=/);
    expect(b, 'espaço é o acionador canônico de checkbox').toMatch(/e\.key === ' '/);
    expect(b).toMatch(/e\.key === 'Enter'/);
    // 🔒 `preventDefault` no espaço: sem ele a página ROLA a cada aceite marcado.
    expect(b).toMatch(/preventDefault\(\)/);
  });

  it('🔒 o ARIA fica no BOX, nunca na linha inteira', () => {
    const b = bloco();
    // O rótulo contém LINKS. `role="checkbox"` na linha inteira esconderia o link da ordem
    // de leitura — trocaria um defeito de acessibilidade por outro.
    const linha = b.slice(b.indexOf('<div onClick={onToggle}'), b.indexOf('<span'));
    expect(linha, 'o role subiu para a linha e engoliu os links').not.toMatch(/role=|aria-checked|tabIndex/);
  });

  it('o box para a propagação — senão clicar nele conta duas vezes e o valor volta', () => {
    expect(bloco()).toMatch(/stopPropagation\(\)/);
  });

  it('🔒 ler o documento NÃO marca o consentimento (o guard do LinkLegal segue de pé)', () => {
    const s = podar(ler(UI));
    const i = s.indexOf('export function LinkLegal');
    expect(i, 'o LinkLegal sumiu').toBeGreaterThanOrEqual(0);
    const linkLegal = s.slice(i, i + 500);
    // 🔴 Consentimento tem de ser ato DELIBERADO, nunca efeito colateral de abrir o texto.
    expect(linkLegal).toMatch(/onClick=\{\(e\) => e\.stopPropagation\(\)\}/);
    expect(linkLegal, 'o documento tem de abrir em outra aba').toMatch(/target="_blank"/);
    expect(linkLegal).toMatch(/rel="noopener noreferrer"/);
  });
});

describe('🔴 3.3 — as DUAS telas de aceite usam a MESMA peça', () => {
  it.each(TELAS)('%s usa `LinhaConsentimento`', (tela) => {
    const s = podar(ler(tela));
    expect(s).toMatch(/import \{[^}]*LinhaConsentimento/);
    expect(s).toMatch(/<LinhaConsentimento/);
  });

  it.each(TELAS)('%s NÃO tem caixa de aceite artesanal sobrando', (tela) => {
    const s = podar(ler(tela));
    // 🔒 A forma exata do defeito: um `<div onClick>` com uma caixinha dentro. Se voltar a
    // existir uma cópia local, a próxima correção conserta uma tela e esquece a outra.
    expect(s, 'voltou a existir um Box local').not.toMatch(/const Box = /);
    expect(s, 'a caixinha de 24px foi recriada na tela').not.toMatch(/width: 24, height: 24, minWidth: 24/);
  });

  it('🔒 o CheckBox mudo saiu do repositório — some como CLASSE, não como linha', () => {
    // Deixá-lo exportado convidaria a próxima tela a reusá-lo e reabrir o defeito.
    const s = ler(UI);
    expect(s, 'o CheckBox sem ARIA voltou').not.toMatch(/export function CheckBox/);
  });

  it('anti-vacuidade: o extrator lê arquivo de verdade e acha o que existe', () => {
    expect(ler(UI).length).toBeGreaterThan(2000);
    expect(bloco().length, 'o recorte do bloco veio vazio').toBeGreaterThan(600);
    expect(bloco()).toMatch(/LinhaConsentimento/);
  });
});
