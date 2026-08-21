/**
 * 🔒 C1 §8.1 — GATE ESTÁTICO de fonte única (barreira arquitetural comprovável). Prova, por
 * dependência/importação, que:
 *  - gerador (`treino-montador`) e crítico (`critico`) consomem a fórmula canônica de duração;
 *  - o adaptador de plano roteia para `avaliarDuracaoSessao` (não copia a aritmética);
 *  - o construtor semanal e a geração temporal consomem `calcularUsosCardioNaOrigem` / a canônica;
 *  - existe UMA só definição da constante de repetições e UMA só da primitiva de cardio.
 * Igualdade apenas numérica não prova fonte única — este gate prova o CONSUMO da exportação.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ENGINE = join(__dirname);
const ler = (arquivo: string) => readFileSync(join(ENGINE, arquivo), 'utf-8');

describe('C1 §8.1 · fonte única de duração (gerador + crítico convergem)', () => {
  it('o crítico importa a fórmula canônica (avaliarDuracaoResistida → avaliarDuracaoSessao)', () => {
    const src = ler('critico.ts');
    expect(src).toMatch(/import\s*\{[^}]*avaliarDuracaoResistida[^}]*\}\s*from\s*['"]\.\/duracao-plano['"]/);
  });

  it('o gerador importa a fórmula canônica e reavalia o plano final', () => {
    const src = ler('treino-montador.ts');
    expect(src).toMatch(/from\s*['"]\.\/duracao-plano['"]/);
    expect(src).toMatch(/from\s*['"]\.\/duracao-sessao['"]/);
    expect(src).toMatch(/certificarDuracao/); // reavaliação do plano final
  });

  it('o adaptador de plano roteia para a canônica `avaliarDuracaoSessao` (sem aritmética própria)', () => {
    const src = ler('duracao-plano.ts');
    expect(src).toMatch(/import\s*\{[^}]*avaliarDuracaoSessao[^}]*\}\s*from\s*['"]\.\/duracao-sessao['"]/);
  });
});

describe('C1 §8.1 · primitiva única de cardio (avaliador e construtor semanal a consomem)', () => {
  it('o construtor semanal importa `calcularUsosCardioNaOrigem`', () => {
    const src = ler('distribuicao-cardio-semana.ts');
    expect(src).toMatch(/import\s*\{[^}]*calcularUsosCardioNaOrigem[^}]*\}\s*from\s*['"]\.\/cardio-sessao['"]/);
  });

  it('a geração temporal consome a canônica de duração', () => {
    const src = ler('geracao-temporal.ts');
    expect(src).toMatch(/import\s*\{[^}]*avaliarDuracaoSessao[^}]*\}\s*from\s*['"]\.\/duracao-sessao['"]/);
  });
});

describe('C1 §8.1 · uma única definição (proíbe cópia local)', () => {
  const arquivos = [
    'duracao-sessao.ts', 'duracao-plano.ts', 'cardio-sessao.ts', 'distribuicao-cardio-semana.ts',
    'geracao-temporal.ts', 'critico.ts', 'treino-montador.ts',
  ];

  it('há exatamente UMA definição de TEMPO_EXECUCAO_SERIE_REPS_SEG', () => {
    const defs = arquivos.filter((a) => /export const TEMPO_EXECUCAO_SERIE_REPS_SEG/.test(ler(a)));
    expect(defs).toEqual(['duracao-sessao.ts']);
  });

  it('há exatamente UMA definição de calcularUsosCardioNaOrigem', () => {
    const defs = arquivos.filter((a) => /export function calcularUsosCardioNaOrigem/.test(ler(a)));
    expect(defs).toEqual(['cardio-sessao.ts']);
  });

  it('nenhum consumidor recria o fallback proibido `series ?? 1` / `descanso ?? 90` no critério temporal', () => {
    // o fallback 1/90 foi removido do critério temporal (spec §1/§8.4). Guard contra reintrodução.
    for (const a of ['duracao-plano.ts', 'duracao-sessao.ts']) {
      expect(ler(a)).not.toMatch(/\?\?\s*90\b/);
      expect(ler(a)).not.toMatch(/series\s*\?\?\s*1\b/);
    }
  });
});
