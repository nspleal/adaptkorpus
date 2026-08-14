/**
 * 🔒 C1 — O GRUPO MUSCULAR APARECE (pedido do autor, 2026-08-14): *"acho bom colocar do lado
 * de cada exercício que grupo muscular ele aborda"*.
 *
 * O card mostrava só o PADRÃO (`EMPURRAR`/`ISOLADO`), que é vocabulário do MOTOR — a pessoa
 * quer saber o músculo. Guard estático (o padrão da casa para componentes): o card lê
 * `grupoPrimario` e o detalhe lê os SECUNDÁRIOS pela normalização do v4, não pelo texto livre.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const semComentarios = (f: string) =>
  readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

describe('🔒 C1 — músculo visível no plano', () => {
  it('o card do plano mostra o grupo primário, com rótulo humano', () => {
    const p = semComentarios('src/components/painel/Painel.tsx');
    expect(p, 'o card não lê o grupoPrimario do exercício').toMatch(/ROTULO_GRUPO\[\s*efetivo\.grupoPrimario/);
  });

  /**
   * PAR DISCRIMINANTE: mostrar o grupo não pode ter CUSTADO o padrão — os dois informam
   * coisas diferentes (músculo × movimento), e trocar um pelo outro seria perder dado.
   */
  it('o padrão continua no card (o grupo somou, não substituiu)', () => {
    const p = semComentarios('src/components/painel/Painel.tsx');
    expect(p).toMatch(/PADRAO_LABEL\[sl\.padrao\]/);
  });

  it('o detalhe nomeia os SECUNDÁRIOS pela normalização do v4, não pelo texto livre', () => {
    const d = semComentarios('src/components/painel/DetalheModais.tsx');
    expect(d, 'os secundários não vêm de secundariosDe').toMatch(/secundariosDe\(ex\)/);
    expect(d, 'o rótulo do secundário tem de ser humano').toMatch(/ROTULO_GRUPO/);
  });
});
