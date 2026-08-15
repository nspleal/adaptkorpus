import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { temCarga, temCargaProgressivel } from './equipamento';
import { EXERCISES_SEED } from '../data/seed';
import { repUnitDe } from './isometricos';

/**
 * 🔒 O predicado de carga tem UMA fonte (Leva A, DF 2026-07-31).
 *
 * Antes eram 4 cópias inline em 2 variantes — `treino-montador.ts` (retomada),
 * `treino.ts` (progressão), `SessaoTreino.tsx`, `RegistrarTreino.tsx`. O guard falha na
 * **5ª** comparação literal a `'Peso corporal'` fora do helper, que é como a divergência
 * nasce: alguém precisa da regra num lugar novo, copia, e um dos cinco pontos passa a
 * discordar dos outros sem que nada quebre.
 *
 * ⚠️ Este arquivo é o único teste que pode citar o literal — por isso a varredura ignora
 * `*.test.ts` e o próprio `equipamento.ts`. Sem essa isenção, o guard falharia lendo a
 * própria lápide (aconteceu duas vezes nesta série: `/conta` e `user_metadata`).
 */

const HELPER = join('engine', 'equipamento.ts');

/** Arquivos de `src/` que comparam literalmente a `'Peso corporal'`, fora do helper. */
function comparacoesLiterais(): string[] {
  const achados: string[] = [];
  const anda = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) { anda(p); continue; }
      if (!/\.tsx?$/.test(p) || /\.test\.tsx?$/.test(p)) continue;
      if (p.endsWith(HELPER)) continue; // a fonte única
      const src = readFileSync(p, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/^[ \t]*\/\/.*$/gm, ' ');
      // Só COMPARAÇÃO conta; a string pode aparecer como rótulo de UI sem ser regra.
      for (const m of src.matchAll(/[!=]==\s*['"]Peso corporal['"]|['"]Peso corporal['"]\s*[!=]==/g)) {
        achados.push(`${p} → ${m[0]}`);
      }
    }
  };
  anda('src');
  return achados;
}

describe('predicado de carga — fonte única', () => {
  it('nenhuma comparação literal a "Peso corporal" fora do helper', () => {
    const fora = comparacoesLiterais();
    expect(fora, `5ª cópia do predicado: ${fora.join(' · ')}`).toEqual([]);
  });

  /**
   * A varredura tem de ser capaz de ACHAR — senão ela passa por vacuidade e o guard vira
   * decoração. Prova o extrator contra uma amostra sintética das duas formas.
   */
  it('a varredura reconhece as duas formas de comparação (não passa por vacuidade)', () => {
    const re = /[!=]==\s*['"]Peso corporal['"]|['"]Peso corporal['"]\s*[!=]==/;
    expect(re.test("(x ?? '') !== 'Peso corporal'")).toBe(true);
    expect(re.test('x === "Peso corporal"')).toBe(true);
    expect(re.test("'Peso corporal' === x")).toBe(true);
    // Rótulo de UI não é regra — não pode acusar.
    expect(re.test("<span>Peso corporal</span>")).toBe(false);
    expect(re.test("equipamentoDetalhe: 'Peso corporal',")).toBe(false);
  });

  it('os 4 call sites passaram a chamar o helper', () => {
    const usa = (arq: string, fn: string) => {
      const src = readFileSync(arq, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
      expect(src, `${arq} não chama ${fn}`).toMatch(new RegExp(`\\b${fn}\\(`));
    };
    // Variante CRUA — a retomada computa IRV e precisa da leitura de equipamento.
    usa('src/lib/engine/treino-montador.ts', 'temCarga');
    // Variante PROGRESSÍVEL — as três que decidem "modo carga × peso corporal".
    usa('src/lib/engine/treino.ts', 'temCargaProgressivel');
    usa('src/components/painel/SessaoTreino.tsx', 'temCargaProgressivel');
    usa('src/components/painel/RegistrarTreino.tsx', 'temCargaProgressivel');
  });
});

describe('as duas variantes são MESMO diferentes (não colapsar)', () => {
  /**
   * Se as duas dessem sempre o mesmo resultado, unificá-las seria correto e este bloco
   * provaria o contrário do que a spec afirma. Aqui está a testemunha concreta: um
   * isométrico **com** carga externa — `temCarga` true, `temCargaProgressivel` false.
   */
  it('existe exercício onde elas DIVERGEM na biblioteca real', () => {
    const divergem = EXERCISES_SEED.filter((e) => temCarga(e) !== temCargaProgressivel(e));
    expect(
      divergem.length,
      'nenhum caso de divergência — se isto zerar de verdade, reveja a spec antes de unificar',
    ).toBeGreaterThan(0);
    // Toda divergência é, por construção, isométrico com carga.
    for (const e of divergem) {
      expect(repUnitDe(e.id), `${e.id} diverge sem ser isométrico`).toBe('segundos');
      expect(temCarga(e)).toBe(true);
      expect(temCargaProgressivel(e)).toBe(false);
    }
  });

  it('`temCargaProgressivel` é DERIVADA de `temCarga` (nunca true onde a base é false)', () => {
    for (const e of EXERCISES_SEED) {
      if (!temCarga(e)) expect(temCargaProgressivel(e), `${e.id}`).toBe(false);
    }
  });

  it('peso corporal é falso nas duas; equipamento externo é verdadeiro na base', () => {
    const pc = EXERCISES_SEED.filter((e) => e.equipamentoDetalhe === 'Peso corporal');
    expect(pc.length).toBeGreaterThan(0);
    for (const e of pc) {
      expect(temCarga(e), `${e.id}`).toBe(false);
      expect(temCargaProgressivel(e), `${e.id}`).toBe(false);
    }
  });
});

/**
 * 🔒 `temCarga` com ANOTAÇÃO (DF do autor 2026-08-15) — o conserto do falso-positivo.
 *
 * `temCarga` era `equipamentoDetalhe !== 'Peso corporal'` (igualdade). `Peso corporal
 * (mesa firme)` NÃO é igual à string exata → dava `true`, e 7 exercícios de puro peso
 * corporal caíam em `modo='carga'` (`treino.ts:245`) — o app oferecia +peso onde não há
 * peso, e `e168` (troca nº 1 do `e116`) estava nesse caminho quente.
 *
 * A regra travada: peso corporal é a string sozinha OU com uma anotação de SETUP entre
 * parênteses. A barra `/ Halteres` é ALTERNATIVA com carga — não é anotação, e continua
 * `temCarga = true`. É o par discriminante que separa este conserto do `startsWith` largo
 * demais que viraria `e17`/`e152` para false (prescrição errada na direção oposta).
 */
describe('🔒 temCarga com anotação — peso corporal (…) NÃO é carga', () => {
  const anotados = EXERCISES_SEED.filter((e) => {
    const d = e.equipamentoDetalhe ?? '';
    return d.startsWith('Peso corporal (') && d.endsWith(')');
  });

  it('existem exercícios com anotação de setup na base (senão o guard não guarda nada)', () => {
    expect(anotados.length, 'nenhum "Peso corporal (…)": o falso-positivo não teria como aparecer').toBeGreaterThan(0);
  });

  it('TODO "Peso corporal (anotação)" tem temCarga FALSE — mata o falso-positivo da igualdade', () => {
    for (const e of anotados) {
      expect(temCarga(e), `${e.id} "${e.equipamentoDetalhe}"`).toBe(false);
      // e a derivada segue: sem carga, sem carga progressível → modo peso_corporal.
      expect(temCargaProgressivel(e), `${e.id}`).toBe(false);
    }
  });

  /**
   * 🔑 O PAR DISCRIMINANTE: a barra `/ Halteres` é carga de verdade. Uma implementação
   * `startsWith('Peso corporal')` passaria em tudo acima e viraria estes dois para false —
   * exatamente a prescrição errada oposta que a medição de 2026-08-15 barrou.
   */
  it('"Peso corporal / Halteres" (e17/e152) CONTINUA temCarga TRUE — barra é carga, não anotação', () => {
    const duais = EXERCISES_SEED.filter((e) => (e.equipamentoDetalhe ?? '').includes('Peso corporal /'));
    expect(duais.length, 'a base perdeu os duais — o par discriminante sumiu').toBeGreaterThan(0);
    for (const e of duais) {
      expect(temCarga(e), `${e.id} "${e.equipamentoDetalhe}" — a alternativa com halteres aceita quilo`).toBe(true);
    }
  });
});
