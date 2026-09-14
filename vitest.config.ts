import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

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

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
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
          name: 'historico-seletor-etapa1', include: arquivos,
          env: { ADAPT_TEST_SELETOR_ATUAL: '0' },
        },
      },
    ],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
