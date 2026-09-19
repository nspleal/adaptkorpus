import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('..',import.meta.url)),test:{include:process.env.ADAPT_DIAGNOSTICO?['scripts/diagnosticar-posterior.test.ts']:process.env.ADAPT_SEARCH?['scripts/buscar-posterior.test.ts']:['scripts/medir-complemento.test.ts'],environment:'node'},resolve:{alias:{'@':fileURLToPath(new URL('../src',import.meta.url))}}});
