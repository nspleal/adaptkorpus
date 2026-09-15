/** Escreve os despejos de cenário em disco. Roda só quando ADAPT_DUMP está setado. */
import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { dumpTodos } from './dump-planos';

describe.runIf(process.env.ADAPT_DUMP)('despejo de cenários', () => {
  it('escreve o JSON', () => {
    writeFileSync(process.env.ADAPT_DUMP!, JSON.stringify(dumpTodos(), null, 1), 'utf8');
  });
});
