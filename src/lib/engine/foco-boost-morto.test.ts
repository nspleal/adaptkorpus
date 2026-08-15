/**
 * 🔒 O BOOST POLVILHADOR ESTÁ MORTO — e este guard é o atestado de óbito, com a experiência.
 *
 * 🔑 Contexto (validação do autor, 2026-08-15): a tela mostrou o foco POLVILHANDO peito por
 * vários dias, com bíceps/panturrilha/tríceps pagando a conta — a assinatura do "slot extra
 * saindo de quem tem menos déficit". Medido em TODOS os caminhos do código atual
 * (`plano-caminho-real.test.ts`), o sintoma NÃO se reproduz: o foco de peito entrega +séries
 * no MESMO dia, e nenhum terceiro é tocado.
 *
 * A EXPERIÊNCIA DECISIVA que fecha a divergência (registrada aqui como memória): rodando o
 * repro no build ANTERIOR à cascata (`0d8f392^`), o boost `alvoPonderado.set(foco.grupo,
 * banda.max + ceil(delta/sMax)*sMax + sMax)` REPRODUZ a assinatura — peito cresce, ombros e
 * tríceps cedem — coisa que o código atual (alocação NEUTRA + `decidirFoco`) não faz. Ou
 * seja: o sintoma é comportamento de BUILD VELHO, não de `main`.
 *
 * Este guard trava a propriedade que separa os dois mundos: **o alvo de alocação do foco é
 * NEUTRO** — `alvoPonderado` do grupo focado é exatamente `banda.max`, nunca `banda.max + boost`.
 * Se alguém reintroduzir o boost (por qualquer caminho), a alocação deixa de ser neutra e a
 * cascata perde o chão — e o gate fica VERMELHO aqui, antes de chegar à tela.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fonte = readFileSync(join(__dirname, 'treino-montador.ts'), 'utf8');
// Remove comentários (o texto histórico do boost VIVE num comentário — não é código vivo).
const semComentarios = fonte
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

describe('🔒 o boost polvilhador não existe como CÓDIGO (só como comentário histórico)', () => {
  it('nenhum `alvoPonderado.set(foco.grupo, ...)` — o alvo do foco não é inflado', () => {
    // O boost antigo era exatamente isto: subir o alvo de ALOCAÇÃO do grupo focado.
    expect(semComentarios).not.toMatch(/alvoPonderado\.set\(\s*foco\.grupo/);
  });

  it('nenhuma soma de boost no alvo (`banda.max + ...` ligada a foco/delta)', () => {
    // Padrão do boost: `banda.max + Math.ceil(delta / sMax) * sMax + sMax`.
    expect(semComentarios).not.toMatch(/banda\.max\s*\+\s*Math\.ceil/);
    expect(semComentarios, 'reaparece a soma de boost no alvo').not.toMatch(/deltaAplicado\s*\/\s*sMax\s*\)\s*\*\s*sMax/);
  });

  it('o único `alvoPonderado.set` em laço é o NEUTRO (banda.max para todos os grupos)', () => {
    const sets = [...semComentarios.matchAll(/alvoPonderado\.set\(([^)]*)\)/g)].map((m) => m[1]!.trim());
    expect(sets.length, 'esperado exatamente 1 atribuição de alvoPonderado (a neutra)').toBe(1);
    expect(sets[0], 'a atribuição não é a neutra `g, banda.max`').toMatch(/banda\.max\s*$/);
  });
});
