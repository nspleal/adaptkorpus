import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * VARREDURA DE CALL SITES DOS TRILHOS (Leva A.2, DF 2026-07-31).
 *
 * 🔑 A lição que motivou: **a suíte prova função, não montagem.** Dois casos idênticos em
 * 2026-07-29/30 — `caminhoRelativoSeguro` tinha 3 testes e a rota `/auth/callback` tinha
 * zero (apagar a chamada passava nos 731); `semanaDoCiclo` estava certo e nada impedia o
 * Painel de alimentar o montador com a semana GRAVADA. Nos dois, a peça pura estava provada
 * e o ponto de uso não.
 *
 * Este arquivo trava o PONTO DE USO de cada trilho. Sondagem feita antes de escrever
 * (regra 2026-07-29 — não perseguir placar): burlando a chamada no call site e rodando a
 * suíte inteira, **6 dos 7 já caíam** por testes de comportamento existentes. Os guards
 * abaixo não corrigem buraco nesses 6 — tornam a cobertura **explícita e nomeada**, em vez
 * de incidental a um teste que pode ser reescrito sem que ninguém note o que ele segurava.
 *
 * 🔒 São guards ESTRUTURAIS. O aceite da Leva A é "a suíte passa sem nenhum teste novo de
 * COMPORTAMENTO" — nenhuma asserção aqui roda o motor esperando número.
 */

const semComentarios = (arq: string) =>
  readFileSync(arq, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

/**
 * Corpo de uma função nomeada.
 *
 * ⚠️ Fecha os PARÊNTESES da lista de parâmetros ANTES de procurar o `{`. A 1ª versão pegava
 * o primeiro `{` depois do nome — que, em `estadoDoCiclo(args: { … })`, é a chave do objeto
 * de parâmetros: o "corpo" extraído era a assinatura, e as asserções falhavam contra código
 * que estava correto. É a 5ª vez nesta série que o extrator é a parte frágil do guard.
 */
function corpoDe(src: string, nome: string): string {
  const i = src.search(new RegExp(`(export\\s+)?(async\\s+)?function\\s+${nome}\\s*\\(`));
  if (i < 0) return '';
  const abreP = src.indexOf('(', i);
  let p = 0;
  let fimParams = -1;
  for (let j = abreP; j < src.length; j += 1) {
    if (src[j] === '(') p += 1;
    else if (src[j] === ')') { p -= 1; if (p === 0) { fimParams = j; break; } }
  }
  if (fimParams < 0) return '';
  const abre = src.indexOf('{', fimParams);
  if (abre < 0) return '';
  let n = 0;
  for (let j = abre; j < src.length; j += 1) {
    if (src[j] === '{') n += 1;
    else if (src[j] === '}') { n -= 1; if (n === 0) return src.slice(abre, j + 1); }
  }
  return src.slice(abre);
}

describe('trilho 1 — gate de saúde: o pipeline CONSULTA o gate e obedece ao ROTEAR', () => {
  const src = semComentarios('src/lib/engine/index.ts');

  it('`gerarDieta` chama `avaliarGateSaude` e não fabrica o comportamento', () => {
    const c = corpoDe(src, 'gerarDieta');
    expect(c, 'gerarDieta sumiu — reveja este guard').not.toBe('');
    expect(c).toMatch(/const gate = avaliarGateSaude\(perfil\)/);
    // O defeito que isto pega: sobrescrever o comportamento vindo do gate.
    expect(/comportamento:\s*'(SEGUIR|RESTRINGIR|PISAR)'/.test(c), 'comportamento hardcoded no pipeline').toBe(false);
  });

  it('ROTEAR não gera plano — a decisão está no pipeline, não só no gate', () => {
    const c = corpoDe(src, 'gerarDieta');
    expect(c).toMatch(/ROTEAR/);
    expect(c).toMatch(/plano:\s*null|=== 'ROTEAR'/);
  });

  it('o treino tem o mesmo trilho (`avaliarGateTreino`, prescrição null no ROTEAR)', () => {
    const c = corpoDe(src, 'gerarTreino');
    expect(c).toMatch(/avaliarGateTreino\(/);
    expect(c).toMatch(/ROTEAR/);
  });
});

describe('trilho 2 — piso de 6 reps: o modo força usa a constante, não um literal', () => {
  const src = semComentarios('src/lib/engine/treino.ts');

  it('`repsComposto` do modo força vem de `MODO_FORCA_REPS`', () => {
    expect(src).toMatch(/min:\s*MODO_FORCA_REPS,\s*max:\s*MODO_FORCA_REPS/);
    // Um `{ min: 6, max: 6 }` literal passaria hoje e divergiria da spec amanhã.
    expect(/min:\s*6,\s*max:\s*6/.test(src), 'piso de 6 reps virou literal').toBe(false);
  });

  it('o modo força exclui iniciante no ponto de uso', () => {
    expect(src).toMatch(/perfil\.modoForca === true && nivel !== 'iniciante'/);
  });
});

describe('trilho 3 — RIR mínimo: o piso do nível é aplicado na prescrição', () => {
  const src = semComentarios('src/lib/engine/treino.ts');

  it('`rirMin` passa por `Math.max` com o piso do nível', () => {
    expect(src).toMatch(/Math\.max\(\s*base\.rir\.min,\s*nivel === 'iniciante' \? RIR_MIN_INICIANTE : RIR_MIN_GLOBAL\s*\)/);
  });

  it('e o valor prescrito é o `rirMin` derivado, não `base.rir.min` cru', () => {
    expect(src).toMatch(/rir:\s*\{\s*min:\s*rirMin,\s*max:\s*base\.rir\.max\s*\}/);
  });
});

describe('trilho 4 — `caminhoRelativoSeguro`: a rota passa pelo helper', () => {
  const src = semComentarios('src/app/auth/callback/route.ts');

  it('o `next` da rota é sanitizado antes de virar destino', () => {
    expect(src).toMatch(/caminhoRelativoSeguro\(\s*url\.searchParams\.get\('next'\)/);
    expect(/new URL\(\s*url\.searchParams\.get\('next'\)/.test(src), 'usa o `next` cru no redirect').toBe(false);
  });
});

describe('trilho 5 — `semanaDoCiclo`: a semana vem do histórico, não do valor gravado', () => {
  it('`estadoDoCiclo` deriva a semana chamando `semanaDoCiclo`', () => {
    const src = semComentarios('src/lib/engine/treino-mesociclo.ts');
    const c = corpoDe(src, 'estadoDoCiclo');
    expect(c, 'estadoDoCiclo sumiu').not.toBe('');
    expect(c).toMatch(/semanaDoCiclo\(/);
  });

  it('o Painel entrega ao montador o recomputado (espelho nunca é entrada)', () => {
    const src = semComentarios('src/components/painel/Painel.tsx');
    const c = corpoDe(src, 'opcoesDaSemana');
    expect(c).toMatch(/semana:\s*ciclo\.semanaEfetiva/);
    expect(/perfil\.mesocicloSemana/.test(c), 'o valor gravado voltou a alimentar o montador').toBe(false);
  });
});

describe('trilho 6 — escala de porção: o clamp está no ponto de uso', () => {
  it('o montador de cardápio limita a escala pela faixa realista', () => {
    const src = semComentarios('src/lib/engine/assembler.ts');
    expect(src).toMatch(/clamp\([^)]*ESCALA_PORCAO\.min,\s*ESCALA_PORCAO\.max\)/);
    // A divisão crua sem clamp é o defeito: porção de 8× para fechar kcal.
    expect(/\?\s*\(?alvoKcal \/ kcalBase\)?\s*$/m.test(src), 'escala sem clamp').toBe(false);
  });

  it('a substituição usa o MESMO trilho (não uma faixa própria)', () => {
    const src = semComentarios('src/lib/engine/substituicao.ts');
    expect(src).toMatch(/clamp\([^)]*ESCALA_PORCAO\.min,\s*ESCALA_PORCAO\.max\)/);
  });
});

describe('trilho 7 — tetos de volume: banda e IRV entram na alocação', () => {
  const mont = semComentarios('src/lib/engine/treino-montador.ts');

  it('a alocação da rampa usa `prescricao.volumePorGrupoSemana`', () => {
    // 🔒 O CRITÉRIO é "toda banda vem da prescrição", não uma contagem: quem lê a banda são
    // o orçamento de TEMPO, a ALOCAÇÃO e — desde a cascata do foco (2026-08-14) — a decisão
    // do degrau. Travar o número em 2 fazia o guard falhar por um call site NOVO e legítimo,
    // que é ruído; o que não pode aparecer é banda literal, e disso cuida a linha abaixo.
    const n = [...mont.matchAll(/const banda = prescricao\.volumePorGrupoSemana;/g)].length;
    expect(n, 'a banda deixou de vir da prescrição em algum ponto').toBeGreaterThanOrEqual(2);
    expect(/const banda = \{\s*min:\s*\d/.test(mont), 'banda de volume virou literal').toBe(false);
  });

  it('o teto de séries da retomada passa pelo IRV, não por número solto', () => {
    const ret = semComentarios('src/lib/engine/treino-retomada.ts');
    expect(ret).toMatch(/RETOMADA_IRV_TETO \/ \(reps \* pct1rm\)/);
    expect(ret).toMatch(/irvComCarga\([^)]*\) <= RETOMADA_IRV_TETO/);
  });

  it('o montador consulta `tetoSeriesDaRetomada` (não replica a conta)', () => {
    expect(mont).toMatch(/tetoSeriesDaRetomada\(/);
  });
});

/**
 * 🟡 ACHADO DA SONDAGEM — não é um dos 7 trilhos, e por isso não ganhou teste de
 * comportamento (fora do escopo da Leva A).
 *
 * `treino-montador.ts:176` também lê `volumePorGrupoSemana`, mas ali a banda **não é teto de
 * volume**: alimenta `sPlan`, que é o estimador de quantos exercícios cabem no tempo da
 * sessão. Trocá-la por `{min:1,max:99}` **sobreviveu à suíte inteira** — enquanto a mesma
 * troca na alocação (linha 263) derruba. Ou seja: a composição da sessão por orçamento de
 * tempo não tem teste de comportamento. Registrado para a leva que tocar o orçamento de
 * tempo (a Leva B mexe exatamente aí — "o orçamento passa a somar por item").
 *
 * O guard estrutural do trilho 7 já impede a regressão mais grosseira (banda virar literal)
 * nos DOIS pontos; o que falta é comportamento, e ele não entra aqui por disciplina de
 * escopo, não por esquecimento.
 */
