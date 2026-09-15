import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

interface Classificacao {
  arquivos: { arquivo: string; historicos: { nome: string; motivo: string; sucessor: string }[] }[];
}
const classificacao: Classificacao = JSON.parse(readFileSync(
  new URL('./test-support/selecao-etapa1-classificacao.json', import.meta.url), 'utf8',
));
const arquivos = classificacao.arquivos.map((x) => x.arquivo);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Classificação versionada, localizada por arquivo e por nome COMPLETO. Novos testes
// não entram nas exclusões. As fotografias continuam rodando no projeto histórico.
for (const { arquivo, historicos } of classificacao.arquivos) {
  if (new Set(historicos.map((x) => x.nome)).size !== historicos.length
    || historicos.some((x) => !x.nome || !x.motivo || !x.sucessor)) {
    throw new Error(`Classificação histórica inválida: ${arquivo}`);
  }
}

/**
 * O mesmo arquivo de caracterização roda em dois projetos, e o nome do `describe` vem de
 * ADAPT_TEST_SELETOR_ATUAL — logo cada projeto registra só metade das chaves. Com uma única
 * fotografia compartilhada, cada projeto enxerga a metade do outro como obsoleta e o gate cai
 * em CI. Cada projeto passa a ter a sua própria fotografia.
 *
 * 🔴 O resolvedor vale só na RAIZ: o Vitest monta um único SnapshotManager a partir da config
 * raiz e apaga `resolveSnapshotPath` das configs de projeto antes de serializá-las. Declarado
 * dentro de um projeto, ele é silenciosamente ignorado. O projeto vem pelo 3º argumento,
 * em `context.config.name` — verificado em execução nesta versão (Vitest 4.1.11).
 */
const PROJETO_HISTORICO = 'historico-seletor-etapa1';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    resolveSnapshotPath: (arquivo, extensao, contexto) => {
      const projeto = (contexto as { config?: { name?: string } } | undefined)?.config?.name;
      const base = join(dirname(arquivo), '__snapshots__', basename(arquivo));
      return projeto === PROJETO_HISTORICO ? `${base}.${PROJETO_HISTORICO}${extensao}` : `${base}${extensao}`;
    },
    projects: [
      {
        extends: true,
        test: { name: 'atual', include: ['src/**/*.{test,spec}.ts'], exclude: arquivos, env: { ADAPT_TEST_SELETOR_ATUAL: '1' } },
      },
      ...classificacao.arquivos.map(({ arquivo, historicos }) => ({
        extends: true as const,
        test: {
          name: `atual:${arquivo}`,
          include: [arquivo],
          env: { ADAPT_TEST_SELETOR_ATUAL: '1' },
          testNamePattern: new RegExp(`^(?!(?:${historicos.map((x) => escapeRegex(x.nome)).join('|')})$).*`),
        },
      })),
      {
        extends: true,
        test: {
          name: PROJETO_HISTORICO, include: arquivos,
          env: { ADAPT_TEST_SELETOR_ATUAL: '0' },
        },
      },
    ],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
