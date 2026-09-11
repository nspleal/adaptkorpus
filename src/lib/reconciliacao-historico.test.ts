import { describe, expect, it } from 'vitest';
import { reconciliarHistorico, type SessaoHistorico } from './treino-historico';

/**
 * 🔴 D8a (verificação de 2026-09-07, reconfirmada no diagnóstico de 2026-09-10, §6.9.1) —
 * a sessão feita offline pode SUMIR na conciliação.
 *
 * A chave de reconciliação era `` `${dataISO}|${n}|${tipo}` `` — e `n` é local: cada aparelho
 * atribui `max(n) + 1` sobre o SEU histórico. Dois aparelhos que treinam no mesmo dia geram o
 * mesmo `n` para sessões DIFERENTES. A local é então considerada "já está no servidor", sai
 * de `faltantes` (não é re-subida) e perde para a do servidor na união: some da tela e do
 * banco, sem erro nenhum.
 *
 * 🔒 O conserto é um identificador GLOBAL na sessão (`id`), atribuído na criação e que viaja
 * no payload (`logs.payload` é `SessaoHistorico` verbatim, e o schema é `passthrough`). Linha
 * legada sem `id` continua casando pela chave composta — que, para ela, é a chave certa: são
 * as duas cópias da MESMA sessão, gravadas antes de o campo existir.
 */

const sessao = (o: Partial<SessaoHistorico>): SessaoHistorico => ({
  dataISO: '2026-09-10', n: 1, exercicios: [], ...o,
} as unknown as SessaoHistorico);

describe('D8a — a sessão offline sobrevive à conciliação', () => {
  it('mesma data e mesmo `n` em aparelhos diferentes: as DUAS sobrevivem', () => {
    const local = sessao({ id: 'local-1', n: 3, dia: 'Upper A', volumeKg: 1000 });
    const servidor = sessao({ id: 'outro-1', n: 3, dia: 'Lower B', volumeKg: 2000 });
    const { uniao, faltantes } = reconciliarHistorico([local], [servidor]);
    expect(uniao.map((s) => s.id).sort(), 'a sessão local foi engolida pela do servidor')
      .toEqual(['local-1', 'outro-1']);
    expect(faltantes.map((s) => s.id), 'a local não foi marcada para re-subir').toEqual(['local-1']);
  });

  it('anti-vacuidade: sem `id`, o mesmo par colide — é exatamente o defeito medido', () => {
    const local = sessao({ n: 3, dia: 'Upper A', volumeKg: 1000 });
    const servidor = sessao({ n: 3, dia: 'Lower B', volumeKg: 2000 });
    const { uniao } = reconciliarHistorico([local], [servidor]);
    expect(uniao).toHaveLength(1);
    expect(uniao[0]!.dia, 'a cópia local sumiu (comportamento legado, preservado de propósito)').toBe('Lower B');
  });

  it('a MESMA sessão dos dois lados não vira duplicata (o servidor vence, como sempre)', () => {
    const s = sessao({ id: 'abc', n: 3, volumeKg: 1000 });
    const { uniao, faltantes } = reconciliarHistorico([s], [{ ...s, volumeKg: 1200 }]);
    expect(uniao).toHaveLength(1);
    expect(uniao[0]!.volumeKg, 'a regra do write-through mudou').toBe(1200);
    expect(faltantes).toEqual([]);
  });

  it('servidor vazio + local não-vazio: nada é apagado e tudo é faltante', () => {
    const locais = [sessao({ id: 'a', n: 1 }), sessao({ id: 'b', n: 2, dataISO: '2026-09-09' })];
    const { uniao, faltantes } = reconciliarHistorico(locais, []);
    expect(uniao).toHaveLength(2);
    expect(faltantes).toHaveLength(2);
  });

  it('a união mantém a ordem canônica (data desc, depois n desc)', () => {
    const { uniao } = reconciliarHistorico(
      [sessao({ id: 'a', n: 5, dataISO: '2026-09-08' })],
      [sessao({ id: 'b', n: 1, dataISO: '2026-09-10' }), sessao({ id: 'c', n: 2, dataISO: '2026-09-10' })],
    );
    expect(uniao.map((s) => s.id)).toEqual(['c', 'b', 'a']);
  });

  it('local com `id` × servidor legado sem `id`: nenhuma some (a pior é a duplicata)', () => {
    const local = sessao({ id: 'novo', n: 4 });
    const servidor = sessao({ n: 4 });
    const { uniao } = reconciliarHistorico([local], [servidor]);
    expect(uniao).toHaveLength(2);
  });

  it('tipos diferentes no mesmo dia continuam distintos (cardio × treino)', () => {
    const { uniao } = reconciliarHistorico(
      [sessao({ id: 'c1', n: 1, tipo: 'cardio' })],
      [sessao({ id: 't1', n: 1 })],
    );
    expect(uniao).toHaveLength(2);
  });
});
