import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { APOIO_CHAMA, MARCOS_CHAMA, bandaChama, chamaAtual, diasDeTreino, marcosAlcancados, pillChama, proximosMarcos } from './chama';

/**
 * Âncoras da spec (design_handoff_chama_marcos + cofre registro-de-aderencia §Contador):
 * marcos 15/25/50/100 · âmbar desde o dia 1 (nunca apagada) · ênfase só ao cruzar o 1º marco ·
 * contador = dias DISTINTOS (dedupe por dia calendário) · copy final por faixa.
 */
describe('chama dos 4 marcos (contador de treinos)', () => {
  it('marcos canônicos: 15 âmbar · 25 azul · 50 roxo · 100 verde Folha', () => {
    expect(MARCOS_CHAMA.map((m) => [m.dias, m.cor])).toEqual([[15, 'amber'], [25, 'azul'], [50, 'roxo'], [100, 'verde']]);
  });

  it('bandas nas fronteiras exatas (14→0, 15→1, 24→1, 25→2, 49→2, 50→3, 99→3, 100→4)', () => {
    expect(bandaChama(0)).toBe(0);
    expect(bandaChama(14)).toBe(0);
    expect(bandaChama(15)).toBe(1);
    expect(bandaChama(24)).toBe(1);
    expect(bandaChama(25)).toBe(2);
    expect(bandaChama(49)).toBe(2);
    expect(bandaChama(50)).toBe(3);
    expect(bandaChama(99)).toBe(3);
    expect(bandaChama(100)).toBe(4);
    expect(bandaChama(365)).toBe(4);
  });

  it('acesa desde o dia 1: X<15 é âmbar SEM ênfase (nunca cinza), X≥15 com ênfase', () => {
    expect(chamaAtual(0)).toEqual({ cor: 'amber', enfase: false, nome: 'Âmbar', marco: 0 });
    expect(chamaAtual(1).cor).toBe('amber');
    expect(chamaAtual(1).enfase).toBe(false);
    expect(chamaAtual(15)).toEqual({ cor: 'amber', enfase: true, nome: 'Âmbar', marco: 15 });
    expect(chamaAtual(120)).toEqual({ cor: 'verde', enfase: true, nome: 'Verde Folha', marco: 100 });
  });

  it('pill: "Aquecendo" antes do 1º marco; "Marco N dias · Nome" depois', () => {
    expect(pillChama(8)).toBe('Aquecendo · antes do 1º marco');
    expect(pillChama(15)).toBe('Marco 15 dias · Âmbar');
    expect(pillChama(50)).toBe('Marco 50 dias · Roxo');
    expect(pillChama(100)).toBe('Marco 100 dias · Verde Folha');
  });

  it('copy de apoio por faixa é a copy FINAL do handoff (nunca fala em perder/zerar)', () => {
    expect(APOIO_CHAMA[0]).toBe('Um total que só cresce — sem sequência pra perder.');
    expect(APOIO_CHAMA[4]).toBe('Chama verde Folha: 100 dias somados. Isso é constância.');
    for (const linha of APOIO_CHAMA) {
      expect(linha).not.toMatch(/perdeu|zerou|apagou|faltou/i);
    }
  });

  /**
   * 🔻 O "faltam N dias" SAIU (DF 2026-08-01). Os marcos à frente viram LISTA ESTÁTICA: os
   * mesmos números para todo mundo, mudando só quais já saíram da lista. Sem contador.
   */
  it('marcos à frente: lista ESTÁTICA, sem distância até a pessoa', () => {
    expect(proximosMarcos(12)).toEqual([
      { cor: 'amber', dias: 15, nome: 'Âmbar' },
      { cor: 'azul', dias: 25, nome: 'Azul' },
      { cor: 'roxo', dias: 50, nome: 'Roxo' },
      { cor: 'verde', dias: 100, nome: 'Verde Folha' },
    ]);
    expect(proximosMarcos(50).map((m) => m.dias)).toEqual([100]);
    expect(proximosMarcos(100)).toEqual([]);
  });

  /**
   * 🔑 A PROVA DE QUE É ESTÁTICA: duas pessoas com contadores diferentes veem os MESMOS
   * marcos, com os mesmos números. Se algum campo variasse com `x`, ele seria a distância
   * de volta com outro nome — que é exatamente como "faltam N" voltaria.
   */
  it('nenhum campo varia com o contador — só quais marcos já saíram da lista', () => {
    const a = proximosMarcos(1);
    const b = proximosMarcos(14);
    // Os 4 estão à frente nos dois casos, e os objetos são idênticos campo a campo.
    expect(a).toHaveLength(4);
    expect(b).toHaveLength(4);
    expect(a).toEqual(b);
    // …e o único efeito de avançar é o marco SAIR da lista.
    expect(proximosMarcos(15).map((m) => m.dias)).toEqual([25, 50, 100]);
  });

  it('marcos ALCANÇADOS são passado, e crescem com o contador', () => {
    expect(marcosAlcancados(0)).toEqual([]);
    expect(marcosAlcancados(14)).toEqual([]);
    expect(marcosAlcancados(15).map((m) => m.dias)).toEqual([15]);
    expect(marcosAlcancados(100).map((m) => m.dias)).toEqual([15, 25, 50, 100]);
    // Alcançados + à frente = o sistema inteiro, sempre.
    for (const x of [0, 14, 15, 40, 99, 100, 500]) {
      expect(marcosAlcancados(x).length + proximosMarcos(x).length, `x=${x}`).toBe(4);
    }
  });

  it('contador conta dias DISTINTOS: dois treinos no mesmo dia = 1 dia (dedupe)', () => {
    expect(diasDeTreino([])).toBe(0);
    expect(diasDeTreino(['2026-07-01', '2026-07-01', '2026-07-02'])).toBe(2);
    expect(diasDeTreino(['2026-07-01', '', '2026-07-03'])).toBe(2);
  });

  it('nunca regride: banda é monotônica no total de dias', () => {
    let prev = 0;
    for (let x = 0; x <= 130; x++) {
      const b = bandaChama(x);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });
});

/**
 * 🔒 O GUARD DA AUSÊNCIA (DF 2026-08-01): "faltam" não pode reaparecer em copy de marco,
 * **em nenhum modo**.
 *
 * 🔻 Por que este guard existe com esta forma: o argumento contra o "faltam N dias" já
 * estava escrito no JSDoc do `ChamaContador` desde 2026-07-29 — e a remoção foi escopada ao
 * MODO DIÁRIO. Reconhecer um defeito e removê-lo só num caso é deixá-lo vivo nos outros.
 * O guard varre os dois arquivos inteiros, sem ramo de modo.
 */
describe('🔒 "faltam" não volta à copy de marco — em modo nenhum', () => {
  const ARQUIVOS = ['src/lib/chama.ts', 'src/components/painel/ChamaContador.tsx'] as const;
  const ler = (p: string) => readFileSync(p, 'utf8');
  /** Só o CÓDIGO: os JSDoc citam a frase proibida para explicar por que ela saiu. */
  const podar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

  it.each(ARQUIVOS)('%s não produz nem renderiza contagem regressiva de marco', (arq) => {
    const src = podar(ler(arq));
    expect(src, 'a dívida voltou').not.toMatch(/faltam?\s/i);
    expect(src, 'o campo do contador voltou').not.toMatch(/faltamTxt/);
    expect(src, 'contagem regressiva por outro nome').not.toMatch(/restam?\s|dias restantes|m\.dias - x|dias - x\b/);
  });

  it('🔑 e nenhum campo do marco à frente DERIVA do contador — a lista é estática', () => {
    const src = podar(ler('src/lib/chama.ts'));
    const i = src.indexOf('export function proximosMarcos');
    // ⚠️ Do `{` de abertura, não da assinatura: o `x` do PARÂMETRO não é uso, e contá-lo
    // fazia o guard acusar a declaração. (Falhou assim na primeira escrita.)
    const corpo = src.slice(src.indexOf('{', i), src.indexOf('\n}', i));
    // Só `m.dias > x` pode usar `x` — é o filtro de quais marcos JÁ saíram da lista.
    // Qualquer outra aritmética com `x` seria a distância de volta com outro nome.
    const usosDeX = corpo.match(/\bx\b/g) ?? [];
    expect(usosDeX, `o contador aparece ${usosDeX.length}× no corpo de proximosMarcos`).toHaveLength(1);
    expect(corpo).toMatch(/m\.dias > x/);
  });

  it('os marcos ALCANÇADOS podem ler o contador — passado é leitura', () => {
    const src = podar(ler('src/lib/chama.ts'));
    expect(src).toMatch(/export function marcosAlcancados/);
    expect(src).toMatch(/m\.dias <= x/);
  });

  it('anti-vacuidade: a varredura lê arquivos de verdade e o léxico funciona', () => {
    for (const a of ARQUIVOS) expect(ler(a).length, a).toBeGreaterThan(1000);
    // O léxico pega a frase que saiu (prova de que ele não é cego).
    expect(/faltam?\s/i.test('faltam 7 dias')).toBe(true);
    expect(/faltam?\s/i.test('Você já completou 14 dias de treino.')).toBe(false);
  });
});
