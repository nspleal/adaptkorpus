import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve:{alias:{'@':fileURLToPath(new URL('../src',import.meta.url))}},
  test:{include:['test-support/qa-server.ts'],testTimeout:3_600_000,hookTimeout:30_000,maxWorkers:1},
});
