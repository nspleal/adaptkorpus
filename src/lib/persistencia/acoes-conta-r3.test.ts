import { afterEach, beforeEach, expect, it, vi } from 'vitest';
type Visivel = { perfil?: { dono?: string; favoritos?: string[] } };
type SessaoAuth = { user: { id: string }; access_token: string };
const h = vi.hoisted(() => ({ effects: [] as (() => (() => void) | void)[], states: [] as unknown[], refs: [] as { current: unknown }[], callbacks: [] as { fn: unknown; deps: unknown[] }[], ci: 0, si: 0, ri: 0, subject: 'A' as string | null, auth: null as null | ((evento: string, sessao: SessaoAuth) => void), waitKey: '', waited: false, release: null as null | (() => void), blockWrite: false, draft: false }));
vi.mock('react', () => ({ useCallback: (fn: unknown, deps: unknown[]) => {
  const i = h.ci++, anterior = h.callbacks[i];
  if (!anterior || anterior.deps.length !== deps.length || deps.some((v, n) => !Object.is(v, anterior.deps[n]))) h.callbacks[i] = { fn, deps };
  return h.callbacks[i]!.fn;
}, useRef: (x: unknown) => { const i = h.ri++; return h.refs[i] ??= ({ current: x }); }, useState: (x: unknown) => { const i = h.si++; if (!(i in h.states)) h.states[i] = x; return [h.states[i], (v: unknown) => h.states[i] = typeof v === 'function' ? v(h.states[i]) : v]; }, useEffect: (f: () => void) => h.effects.push(f) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/lib/escopo-local', () => ({ escopoLocal: () => h.subject, resolverEscopoLocal: async () => h.subject, definirEscopoLocal: (v: string | null) => h.subject = v }));
vi.mock('@/lib/supabase/env', () => ({ supabaseConfigurado: () => true }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { onAuthStateChange: (cb: (evento: string, sessao: SessaoAuth) => void) => { h.auth = cb; return { data: { subscription: { unsubscribe() { } } } }; } }, realtime: { setAuth: async () => { } } }) }));
vi.mock('@/lib/session', () => ({ lerSessaoCompleta: () => null, salvarSessao: vi.fn() }));
vi.mock('@/lib/persistencia/sync', () => ({ consultarAcesso: async () => ({ liberado: true }) }));
vi.mock('@/lib/persistencia/fatos-conta', () => ({ atualizarFatosConta: async () => { } }));
vi.mock('@/lib/metricas/registrar', () => ({ registrarEvento: vi.fn() }));
vi.mock('@/lib/persistencia/sync-cliente', () => ({ EVENTO_SYNC: 'atual-sync', enfileirarOperacao: vi.fn(), sincronizarConta: async () => { }, lerSnapshotRemoto: async () => ({ revision: 1, perfil: { idade: 30, dono: 'A', favoritos: ['remote'] }, versoesTreino: { atual: { id: 'atual' }, anterior: { id: 'anterior' } } }), bancoSync: async () => ({ listar: async () => [], guardar: async (_s: string, k: string) => { if (h.blockWrite && k === 'rascunhoTreino') { h.waited = true; await new Promise<void>(r => h.release = r); } }, ler: async (_s: string, k: string) => { if (k === h.waitKey) { h.waited = true; await new Promise<void>(r => h.release = r); } return k === 'rascunhoTreino' && h.draft ? { base: { revision: 1, perfil: { idade: 30, favoritos: ['base'] } }, perfil: { idade: 30, dono: 'A', favoritos: ['local'] } } : undefined; } }) }));
import { useContaSync } from '@/lib/persistencia/use-conta-sync';
import { enfileirarOperacao } from '@/lib/persistencia/sync-cliente';
import { continuacaoDaConta, invalidarContinuacoesConta } from '@/lib/persistencia/continuidade-conta';
import { registrarEvento } from '@/lib/metricas/registrar';
let cleanups: ((() => void) | void)[] = [];
beforeEach(() => { Object.assign(h, { effects: [], states: [], refs: [], callbacks: [], ci: 0, si: 0, ri: 0, subject: 'A', auth: null, waitKey: '', waited: false, release: null, blockWrite: false, draft: false }); vi.clearAllMocks(); vi.mocked(enfileirarOperacao).mockResolvedValue({ comando: { operationId: 'sintetico' } as never }); vi.stubGlobal('window', { addEventListener() { }, removeEventListener() { } }); vi.stubGlobal('document', { visibilityState: 'visible', addEventListener() { }, removeEventListener() { } }); });
afterEach(() => { h.release?.(); cleanups.forEach(c => c?.()); cleanups = []; vi.unstubAllGlobals(); });
function useMontar() { const result = useContaSync(); cleanups = [h.effects[0]!(), h.effects[1]!()]; return result; }
async function drain() { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); }
it('R4 critério preservado: não publicar A após troca durante a última leitura do boot', async () => {
  h.waitKey = 'rascunhoTreino'; useMontar(); await vi.waitFor(() => expect(h.waited).toBe(true));
  h.auth!('SIGNED_IN', { user: { id: 'B' }, access_token: 'sintetico' }); h.release!(); await drain();
  expect(h.states[0]).toBeNull(); expect(registrarEvento).not.toHaveBeenCalled();
});
it('R4 controle positivo: boot sem troca publica A', async () => { useMontar(); await vi.waitFor(() => expect((h.states[0] as Visivel | null)?.perfil?.dono).toBe('A')); });
it('R4 vizinho: Manter minha edição não repõe A após troca durante escrita do rascunho', async () => {
  h.draft = true; const result = useMontar(); await vi.waitFor(() => expect((h.states[0] as Visivel | null)?.perfil?.dono).toBe('A')); await drain();
  h.blockWrite = true; h.waited = false; const pending = result.manterRascunho(); await vi.waitFor(() => expect(h.waited).toBe(true));
  h.auth!('SIGNED_IN', { user: { id: 'B' }, access_token: 'sintetico' }); expect(h.states[0]).toBeNull(); h.release!(); await pending; await drain();
  console.log('R4 VIZINHO', JSON.stringify({ scope: h.subject, visivel: h.states[0] })); expect(h.states[0]).toBeNull();
});

for (const acao of ['manterRascunho', 'descartarRascunho', 'editar'] as const) for (const invalidacao of ['troca', 'ABA', 'unmount'] as const) it('R3 guarda caller de ' + acao + ' com ' + invalidacao + ' durante IDB', async () => {
  h.draft = true; const result = useMontar(); await vi.waitFor(() => expect((h.states[0] as Visivel | null)?.perfil?.dono).toBe('A')); await drain();
  h.blockWrite = true; h.waited = false;
  const pending = acao === 'editar' ? result.editar({ idade: 31, favoritos: ['editada'] } as never, {} as never) : result[acao]();
  await vi.waitFor(() => expect(h.waited).toBe(true));
  if (invalidacao === 'unmount') { cleanups.forEach(c => c?.()); cleanups = []; }
  else { h.auth!('SIGNED_IN', { user: { id: 'B' }, access_token: 'sintetico' }); if (invalidacao === 'ABA') { invalidarContinuacoesConta(); h.subject = 'A'; } }
  const snapshot = JSON.stringify(h.states); h.release!(); await pending; await drain();
  expect(JSON.stringify(h.states)).toBe(snapshot); expect(enfileirarOperacao).not.toHaveBeenCalled();
});
for (const acao of ['aplicar', 'desfazer'] as const) it('R3 ' + acao + ' não confirma UI após troca durante enqueue', async () => {
  h.draft = true; const result = useMontar(); await vi.waitFor(() => expect((h.states[0] as Visivel | null)?.perfil?.dono).toBe('A')); await drain();
  let release!: () => void; const gate = new Promise<void>(r => release = r); vi.mocked(enfileirarOperacao).mockImplementation(async () => { await gate; return { comando: { operationId: 'own-A-committed' } as never }; });
  const pending = result[acao](); await vi.waitFor(() => expect(enfileirarOperacao).toHaveBeenCalledOnce());
  h.auth!('SIGNED_IN', { user: { id: 'B' }, access_token: 'sintetico' }); const snapshot = JSON.stringify(h.states);
  release(); await pending; await drain(); expect(JSON.stringify(h.states)).toBe(snapshot);
  expect(vi.mocked(enfileirarOperacao).mock.calls[0]![1]?.ativo?.()).toBe(false);
});
it('R3 escolha válida publica somente após commit; busy antigo não afeta nova conta', async () => {
  h.draft = true; useMontar(); await vi.waitFor(() => expect((h.states[0] as Visivel | null)?.perfil?.dono).toBe('A')); await drain();
  h.si = 0; h.ri = 0; h.ci = 0; const result = useContaSync(); h.blockWrite = true; h.waited = false; const pending = result.manterRascunho();
  await vi.waitFor(() => expect(h.waited).toBe(true)); h.release!(); await pending;
  expect((h.states[0] as Visivel | null)?.perfil?.favoritos).toEqual(['local']);
  h.auth!('SIGNED_IN', { user: { id: 'B' }, access_token: 'sintetico' }); const snapshot = JSON.stringify(h.states); result.aoOcupado(true); expect(JSON.stringify(h.states)).toBe(snapshot);
});

it('R3 Auth inicial sem gaveta seleciona a identidade atual sem publicar uma resposta antiga', async () => {
  h.subject = null; useMontar(); h.auth!('INITIAL_SESSION', { user: { id: 'B' }, access_token: 'sintetico' });
  await drain(); expect(h.subject).toBe('B'); expect(h.states[0]).toBeNull();
});

it('R3 refresh não reativa escopo que logout pausou após carregar A', async () => {
  useMontar(); await vi.waitFor(() => expect((h.states[0] as Visivel | null)?.perfil?.dono).toBe('A')); await drain();
  h.subject = null; h.auth!('TOKEN_REFRESHED', { user: { id: 'A' }, access_token: 'sintetico' });
  expect(h.subject).toBeNull();
});

it('R3 Auth B durante logout pausado limpa A e invalida a continuação da pausa', async () => {
  useMontar(); await vi.waitFor(() => expect((h.states[0] as Visivel | null)?.perfil?.dono).toBe('A')); await drain();
  h.subject = null; const pausa = continuacaoDaConta(() => h.subject, null);
  h.auth!('SIGNED_IN', { user: { id: 'B' }, access_token: 'sintetico' });
  expect(h.states[0]).toBeNull(); expect(h.subject).toBeNull(); expect(pausa()).toBe(false);
});

it('R3 callback de ocupado é estável entre renders da mesma geração e cancela após Auth B', async () => {
  useMontar(); await vi.waitFor(() => expect((h.states[0] as Visivel | null)?.perfil?.dono).toBe('A')); await drain();
  h.si = 0; h.ri = 0; h.ci = 0; const primeiro = useContaSync();
  h.si = 0; h.ri = 0; h.ci = 0; const segundo = useContaSync();
  expect(primeiro.aoOcupado).toBe(segundo.aoOcupado);
  primeiro.aoOcupado(true); h.si = 0; h.ri = 0; h.ci = 0; expect(useContaSync().ocupado).toBe(true);
  h.auth!('SIGNED_IN', { user: { id: 'B' }, access_token: 'sintetico' }); const antes = JSON.stringify(h.states);
  primeiro.aoOcupado(false); expect(JSON.stringify(h.states)).toBe(antes);
});
