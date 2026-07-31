import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 🔑 A MUTAÇÃO Nº 1 DA LEVA B: `restSeg = round((min+max)/2)` sobrevivente em qualquer call
 * site **mata o deslocamento por RIR em silêncio**.
 *
 * O motor pode emitir 120 na semana 1, 150 na 3 e 180 na 5 — se a tela recalcular a média da
 * faixa, mostra 150 sempre, e a queixa que originou a leva (*"o tempo de descanso sempre ser
 * o mesmo é extremamente péssimo"*) continua verdadeira **com o motor certo por trás**. É o
 * pior tipo de defeito: o diff parece pronto e a tela não mudou.
 *
 * ⚠️ REGRA ⑩ do cofre — este guard lê código-fonte, então leva os três testes próprios:
 * positivo conhecido, negativo conhecido e anti-vacuidade.
 */

/** Fonte sem comentários: eles CITAM a fórmula proibida para explicar por que ela saiu. */
const semComentarios = (arq: string) =>
  readFileSync(arq, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

/** A média de uma faixa de descanso, em qualquer arranjo de espaços. */
const MEDIA_DA_FAIXA = /Math\.round\(\s*\(\s*\w*[Dd]esc\w*\.min\s*\+\s*\w*[Dd]esc\w*\.max\s*\)\s*\/\s*2\s*\)/;

/** Todo `.tsx?` de `src/`, menos testes. */
function fontes(): string[] {
  const out: string[] = [];
  const anda = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) { anda(p); continue; }
      if (!/\.tsx?$/.test(p) || /\.test\.tsx?$/.test(p)) continue;
      out.push(p);
    }
  };
  anda('src');
  return out;
}

describe('o extrator da média funciona (regra ⑩ — guard que lê fonte se prova antes)', () => {
  it('positivo conhecido: reconhece a fórmula que precisa sair', () => {
    expect(MEDIA_DA_FAIXA.test('restSeg: Math.round((desc.min + desc.max) / 2),')).toBe(true);
    expect(MEDIA_DA_FAIXA.test('const x = Math.round((descanso.min+descanso.max)/2);')).toBe(true);
    expect(MEDIA_DA_FAIXA.test('Math.round( ( desc.min + desc.max ) / 2 )')).toBe(true);
  });

  it('negativo conhecido: não acusa outras médias nem outros arredondamentos', () => {
    expect(MEDIA_DA_FAIXA.test('Math.round((faixa.min + faixa.max) / 2)')).toBe(false); // não é faixa de descanso
    expect(MEDIA_DA_FAIXA.test('Math.round(seg / 60)')).toBe(false);
    expect(MEDIA_DA_FAIXA.test('Math.round((a.min + b.max) / 3)')).toBe(false);
  });

  it('anti-vacuidade: a varredura enxerga arquivos de verdade', () => {
    const arqs = fontes();
    expect(arqs.length).toBeGreaterThan(30);
    expect(arqs).toContain(join('src', 'components', 'painel', 'SessaoTreino.tsx'));
    expect(arqs).toContain(join('src', 'components', 'painel', 'Painel.tsx'));
  });
});

describe('🔒 a média da faixa NÃO volta em nenhum call site', () => {
  it('nenhum arquivo de `src/` recalcula a média do descanso', () => {
    const culpados = fontes().filter((f) => MEDIA_DA_FAIXA.test(semComentarios(f)));
    expect(
      culpados,
      `média da faixa de volta em: ${culpados.join(', ')} — o deslocamento por RIR morre em silêncio`,
    ).toEqual([]);
  });

  /** O outro lado: as telas têm de LER o que o motor emitiu. */
  it.each([
    join('src', 'components', 'painel', 'SessaoTreino.tsx'),
    join('src', 'components', 'painel', 'Painel.tsx'),
  ])('%s lê `descansoSeg` do slot', (arq) => {
    expect(semComentarios(arq)).toMatch(/\bsl\.descansoSeg\b/);
  });

  it('a sessão guiada exibe e cronometra o MESMO valor', () => {
    const src = semComentarios(join('src', 'components', 'painel', 'SessaoTreino.tsx'));
    expect(src).toMatch(/restSeg:\s*sl\.descansoSeg\s*\?\?/);   // vem do motor
    expect(src).toMatch(/rotuloDescanso\(ex\.restSeg\)/);        // é o que aparece
    expect(src).toMatch(/iniciarDescanso\(ex\.restSeg\)/);       // é o que o timer conta
  });
});

describe('🔒 o cronômetro: mais tempo nunca é falha, e ele não grita ao zerar', () => {
  const src = semComentarios(join('src', 'components', 'painel', 'SessaoTreino.tsx'));

  it('existe "mais um pouco" (+30 s) e "Pular descanso" continua', () => {
    expect(src).toMatch(/left:\s*r\.left \+ 30/);
    expect(src).toMatch(/Mais um pouco/);
    expect(src).toMatch(/Pular descanso/);
  });

  /**
   * 🔒 "Descansar mais NUNCA é falha": nada de vermelho, nada de "você passou do tempo".
   * É a forma geral de "ausência não fala" — o app não comenta o que a pessoa fez a mais.
   */
  it('não há copy de cobrança nem cor de alerta no bloco do descanso', () => {
    expect(/passou do tempo|descansou demais|tempo esgotado|acabou o descanso/i.test(src)).toBe(false);
    // `#E5484D` é o Alerta da marca — só para apontar erro, nunca decorativo.
    const blocoTimer = src.slice(src.indexOf('function iniciarDescanso'), src.indexOf('function setSet'));
    expect(/#E5484D/i.test(blocoTimer), 'cor de erro no cronômetro').toBe(false);
  });

  it('ao zerar, o timer simplesmente some (sem emitir nada)', () => {
    expect(src).toMatch(/if \(r\.left <= 1\)[^}]*return null;/);
  });
});
