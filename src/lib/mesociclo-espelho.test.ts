import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { estadoDoCiclo, semanaDoCiclo } from './engine/treino-mesociclo';

/**
 * `preferencias.mesocicloSemana` é ESPELHO, nunca ENTRADA (fix do relógio, `9ebf1bd`).
 *
 * 🔴 O cenário que motiva isto (achado 2026-07-30): existe conta com `mesocicloSemana: 2`
 * e **ZERO treinos** — fóssil de antes da Leva 1, quando a semana avançava por tempo
 * decorrido em vez de por semana TREINADA. Se o motor lesse o valor gravado, quem voltasse
 * retomaria na semana 2 do mesociclo **sem nunca ter treinado**: volume rampado e RIR mais
 * baixo para um corpo destreinado — exatamente o defeito que o `9ebf1bd` fechou, e o mesmo
 * risco (rabdomiólise por esforço) que a rampa de retomada existe para evitar.
 *
 * O motor RECOMPUTA: `estadoDoCiclo` recebe âncora + `datasSessao` e **não aceita** a semana
 * gravada. O valor persistido serve para telemetria/2º device e é sobrescrito pelo
 * recomputado no efeito de espelho do Painel.
 *
 * ⚠️ Comportamento já estava certo e testado. O que FALTAVA era a trava estrutural: passar
 * `perfil.mesocicloSemana` ao montador em vez de `ciclo.semanaEfetiva` **passava na suíte
 * inteira** (749 testes). Peça pura provada, uso não provado — a mesma lição de
 * `/auth/callback`.
 */

const ANCORA = '2026-06-01';

describe('o fóssil: semana gravada = 2, zero treinos', () => {
  it('recomputa semana 1 — a semana avança por semana TREINADA, não por tempo', () => {
    // Âncora de 8 semanas atrás: por tempo decorrido cairia na semana 3 do 2º ciclo.
    const r = estadoDoCiclo({
      mesocicloInicioISO: ANCORA,
      hojeISO: '2026-07-27',
      sinaisFadiga: false,
      datasSessao: [], // ZERO treinos — é o fóssil
    });
    expect(r.semanaEfetiva, 'zero treinos tem de dar semana 1').toBe(1);
    expect(r.deload).toBe(false);
  });

  it('nem a assinatura de `estadoDoCiclo` aceita a semana gravada', () => {
    const src = readFileSync('src/lib/engine/treino-mesociclo.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^[ \t]*\/\/.*$/gm, ' ');
    const assinatura = src.slice(src.indexOf('export function estadoDoCiclo'), src.indexOf('): EstadoCiclo'));
    expect(/mesocicloSemana|semanaGravada|semanaSalva/.test(assinatura), 'a semana gravada virou entrada do motor').toBe(false);
  });

  it('só semanas COM sessão contam — tempo decorrido sozinho nunca promove', () => {
    // 3 semanas-calendário de distância, treino só na 1ª → 1 bucket ativo anterior → semana 2.
    expect(semanaDoCiclo(ANCORA, '2026-06-22', ['2026-06-03'])).toBe(2);
    // Mesma distância, nenhum treino → semana 1, por mais tempo que tenha passado.
    expect(semanaDoCiclo(ANCORA, '2026-06-22', [])).toBe(1);
    expect(semanaDoCiclo(ANCORA, '2026-12-01', [])).toBe(1);
  });

  /**
   * ⚠️ Este caso precisa da sessão DENTRO do bucket corrente. A 1ª versão do teste afirmava
   * cobrir "a semana corrente não conta" usando uma sessão de uma semana ANTERIOR — e a
   * mutação `bucket < semanaCorrente` → `<=` passava, porque naquele arranjo as duas
   * comparações dão o mesmo resultado. Asserção que descreve mais do que prova.
   */
  it('a semana CORRENTE não se promove sozinha antes de fechar', () => {
    // Âncora e treino no mesmo bucket 0, hoje ainda no bucket 0.
    expect(semanaDoCiclo(ANCORA, '2026-06-03', ['2026-06-02'])).toBe(1);
    // Fechada a semana (hoje no bucket 1), aí sim o bucket 0 conta.
    expect(semanaDoCiclo(ANCORA, '2026-06-10', ['2026-06-02'])).toBe(2);
  });

  it('sessão ANTERIOR à âncora não promove semana (fóssil de data também é inerte)', () => {
    expect(semanaDoCiclo(ANCORA, '2026-06-22', ['2026-05-01'])).toBe(1);
  });
});

/**
 * A trava estrutural, no ponto de uso. `opcoesDaSemana()` é o único caminho entre a semana
 * do ciclo e o montador (`recomputarPlano(..., { semanaCiclo })`), e ele tem de entregar o
 * valor RECOMPUTADO.
 */
describe('o Painel entrega ao montador a semana recomputada, não a gravada', () => {
  const src = readFileSync('src/components/painel/Painel.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');

  /** Corpo de `opcoesDaSemana`, por contagem de chaves. */
  const corpo = (() => {
    const i = src.indexOf('function opcoesDaSemana');
    if (i < 0) return '';
    const abre = src.indexOf('{', i);
    let n = 0;
    for (let j = abre; j < src.length; j += 1) {
      if (src[j] === '{') n += 1;
      else if (src[j] === '}') { n -= 1; if (n === 0) return src.slice(abre, j + 1); }
    }
    return '';
  })();

  it('a varredura acha `opcoesDaSemana` (senão o teste abaixo é vácuo)', () => {
    expect(corpo, 'opcoesDaSemana sumiu ou foi renomeada — reveja este guard').not.toBe('');
    expect(corpo).toContain('semana:');
  });

  it('`semana:` vem de `ciclo.semanaEfetiva` e NUNCA de `perfil.mesocicloSemana`', () => {
    expect(corpo).toMatch(/semana:\s*ciclo\.semanaEfetiva/);
    expect(
      /perfil\.mesocicloSemana/.test(corpo),
      'o valor GRAVADO voltou a alimentar o montador — o fóssil de semana=2 sem treino reviveria',
    ).toBe(false);
  });

  it('`estadoDoCiclo` é chamado com o histórico, não com a semana do perfil', () => {
    const i = src.indexOf('estadoDoCiclo({');
    const chamada = src.slice(i, src.indexOf('});', i));
    expect(chamada).toContain('datasSessao');
    expect(chamada).toContain('mesocicloInicioISO');
    expect(/mesocicloSemana/.test(chamada), 'a semana gravada entrou na chamada do motor').toBe(false);
  });

  /**
   * 🔻 A REGRA MUDOU, e por isso este guard foi REESCRITO — não apagado (correção 3.5,
   * 2026-08-01).
   *
   * Ele exigia que o espelho, SE escrito, viesse do recomputado: era o que fazia o fóssil se
   * corrigir sozinho no primeiro mount em vez de divergir para sempre. Com o campo removido
   * como classe, o espelho **não é escrito** — o que é estritamente mais forte: não existe
   * valor a divergir. A prova passa de *"grava o certo"* para *"não há o que gravar"*.
   *
   * ⚠️ Guard não se afrouxa porque o CÓDIGO mudou; este mudou porque a REGRA mudou, com
   * aprovação. A varredura de ausência vive em `persistencia/perfil-profile.test.ts`.
   */
  it('o espelho não é mais ESCRITO — não existe valor a divergir', () => {
    expect(src, 'o espelho voltou a ser gravado').not.toMatch(/mesocicloSemana:/);
    // E o que sustenta a regra continua de pé: a semana entregue ao montador é a recomputada.
    expect(corpo).toMatch(/semana:\s*ciclo\.semanaEfetiva/);
  });

  it('a âncora — a fonte de verdade que SOBRA — continua sendo gravada', () => {
    // 🔒 Anti-vacuidade do teste acima: se o efeito inteiro tivesse sumido, "não grava o
    // espelho" passaria por acidente. `mesocicloInicio` prova que o efeito ainda existe.
    expect(src).toMatch(/mesocicloInicio:\s*ancora/);
  });
});
