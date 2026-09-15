/** Config mínima só para `scripts/dump-planos.test.ts` (instrumento de verificação). */
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: { environment: 'node', include: ['scripts/dump-planos.test.ts','scripts/analisar-complementaridade.test.ts'] },
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
});
