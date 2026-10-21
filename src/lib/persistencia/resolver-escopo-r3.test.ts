import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const c = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock('@/lib/supabase/env', () => ({ supabaseConfigurado: () => true, supabaseUrl: () => 'https://fixture.invalid' }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { getSession: c.session } }) }));
import { definirEscopoLocal, escopoLocal, resolverEscopoLocal } from '@/lib/escopo-local';
beforeEach(() => { definirEscopoLocal(null); c.session.mockReset(); });
afterEach(() => definirEscopoLocal(null));
it.each(['B', 'ABA'])('resolver iniciado sem escopo não aplica sessão antiga após %s', async modo => {
  let liberar!: (v: unknown) => void;
  c.session.mockImplementation(() => new Promise(r => liberar = r));
  const resultado = resolverEscopoLocal(); await vi.waitFor(() => expect(c.session).toHaveBeenCalledOnce());
  definirEscopoLocal('B'); if (modo === 'ABA') { definirEscopoLocal('A'); definirEscopoLocal('B'); }
  liberar({ data: { session: { user: { id: 'A' } } } });
  expect(await resultado).toBe('B'); expect(escopoLocal()).toBe('B');
});
it('falha antiga de getSession não pausa a conta que entrou durante a espera', async () => {
  let rejeitar!: (e: Error) => void; c.session.mockImplementation(() => new Promise((_r, j) => rejeitar = j));
  const resultado = resolverEscopoLocal(); await vi.waitFor(() => expect(c.session).toHaveBeenCalledOnce());
  definirEscopoLocal('B'); rejeitar(new Error('offline')); expect(await resultado).toBe('B'); expect(escopoLocal()).toBe('B');
});
it('controle positivo seleciona A e refresh do mesmo UUID não cancela leitura', async () => {
  definirEscopoLocal('A'); c.session.mockImplementation(async () => { definirEscopoLocal('A'); return { data: { session: { user: { id: 'A' } } } }; });
  expect(await resolverEscopoLocal()).toBe('A');
});
