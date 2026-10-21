import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({
  effects: [] as (() => (() => void) | void)[], states: [] as unknown[], subject: 'A' as string | null,
  auth: null as null | ((e: string, s: { user: { id: string }; access_token: string } | null) => void),
  checkpoint: '', esperando: false, liberar: null as null | (() => void),
}));
async function fronteira<T>(nome: string, valor: T): Promise<T> {
  if (h.checkpoint === nome) { h.esperando = true; await new Promise<void>(r => { h.liberar = r; }); }
  return valor;
}
vi.mock('react', () => ({
  useCallback: (f: unknown) => f, useRef: (x: unknown) => ({ current: x }),
  useState: (x: unknown) => { const i = h.states.length; h.states.push(x); return [x, (v: unknown) => { h.states[i] = typeof v === 'function' ? v(h.states[i]) : v; }]; },
  useEffect: (f: () => (() => void) | void) => h.effects.push(f),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/lib/escopo-local', () => ({ escopoLocal: () => h.subject, resolverEscopoLocal: () => fronteira('identidade', 'A'), definirEscopoLocal: (x: string | null) => { h.subject = x; } }));
vi.mock('@/lib/supabase/env', () => ({ supabaseConfigurado: () => true }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { onAuthStateChange: (cb: typeof h.auth) => { h.auth = cb; return { data: { subscription: { unsubscribe() {} } } }; } }, realtime: { setAuth: async () => {} } }) }));
vi.mock('@/lib/session', () => ({ lerSessaoCompleta: () => null, salvarSessao: vi.fn() }));
vi.mock('@/lib/persistencia/sync', () => ({ consultarAcesso: () => fronteira('acesso', { liberado: true }) }));
vi.mock('@/lib/persistencia/fatos-conta', () => ({ atualizarFatosConta: async () => {} }));
vi.mock('@/lib/metricas/registrar', () => ({ registrarEvento: vi.fn() }));
vi.mock('@/lib/persistencia/sync-cliente', () => ({
  EVENTO_SYNC: 'r2-sync', enfileirarOperacao: vi.fn(), sincronizarConta: async () => {},
  lerSnapshotRemoto: () => fronteira('remoto', { revision: 1, perfil: { idade: 30, dono: 'DONO_A' } }),
  bancoSync: () => fronteira('banco', { listar: () => fronteira('fila', []), ler: (_s: string, chave: string) => fronteira(chave, undefined) }),
}));
import { useContaSync } from './use-conta-sync';
import { registrarEvento } from '@/lib/metricas/registrar';
import { salvarSessao } from '@/lib/session';

let limpar: (() => void)[] = [];
beforeEach(() => {
  h.effects = []; h.states = []; h.subject = 'A'; h.auth = null; h.esperando = false; h.liberar = null;
  vi.clearAllMocks();
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' });
});
afterEach(() => { h.liberar?.(); limpar.splice(0).forEach(f => f()); vi.unstubAllGlobals(); });
function Montar() { const hook = useContaSync(); limpar = [h.effects[0]!(), h.effects[1]!()].filter((f): f is () => void => !!f); return hook; }

it.each(['identidade', 'banco', 'acesso', 'remoto', 'fila', 'snapshot', 'intentPerfil', 'rascunhoTreino'])('R4: Auth B durante %s invalida toda publicação de A', async checkpoint => {
  h.checkpoint = checkpoint; Montar();
  await vi.waitFor(() => expect(h.esperando).toBe(true));
  h.auth!('SIGNED_IN', { user: { id: 'B' }, access_token: 'sintetico' });
  h.liberar!(); await new Promise(r => setTimeout(r, 0));
  expect(h.states[0]).toBeNull(); expect(h.states[1]).toBeNull();
  expect(JSON.stringify(h.states)).not.toContain('DONO_A');
  expect(registrarEvento).not.toHaveBeenCalled(); expect(salvarSessao).not.toHaveBeenCalled();
});

it('R4: desmontar durante IDB não permite setters nem app_aberto tardios', async () => {
  h.checkpoint = 'rascunhoTreino'; Montar();
  await vi.waitFor(() => expect(h.esperando).toBe(true));
  limpar.splice(0).forEach(f => f()); h.liberar!();
  await new Promise(r => setTimeout(r, 0));
  expect(h.states[0]).toBeNull(); expect(registrarEvento).not.toHaveBeenCalled();
});

it('R4: A para B para A não revalida o boot antigo por igualdade do UUID', async () => {
  h.checkpoint = 'rascunhoTreino'; Montar();
  await vi.waitFor(() => expect(h.esperando).toBe(true));
  h.auth!('SIGNED_IN', { user: { id: 'B' }, access_token: 'sintetico' });
  h.subject = 'A'; h.auth!('SIGNED_IN', { user: { id: 'A' }, access_token: 'sintetico' });
  h.liberar!(); await new Promise(r => setTimeout(r, 0));
  expect(h.states[0]).toBeNull(); expect(registrarEvento).not.toHaveBeenCalled();
});

it('R4: conta inalterada ainda publica o boot e registra abertura uma vez', async () => {
  h.checkpoint = ''; Montar();
  await vi.waitFor(() => expect(h.states[0]).toMatchObject({ perfil: { dono: 'DONO_A' } }));
  expect(registrarEvento).toHaveBeenCalledOnce();
});
