import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./supabase/env', () => ({ supabaseConfigurado: () => true }));
const estado = vi.hoisted(() => ({ conta: 'A' }));
vi.mock('./escopo-local', () => ({ escopoLocal: () => estado.conta }));
import { salvarAderenciaDia } from './persistencia/sync';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); estado.conta = 'A'; });
it('retry de 401 não transmite dados da conta anterior depois de logout/troca', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
  vi.stubGlobal('fetch', fetch);
  const promessa = salvarAderenciaDia('2026-09-12', { cafe: 'seguiu' }, {});
  await Promise.resolve(); estado.conta = 'B'; await vi.advanceTimersByTimeAsync(600);
  expect(await promessa).toBe(false); expect(fetch).toHaveBeenCalledTimes(1);
});
