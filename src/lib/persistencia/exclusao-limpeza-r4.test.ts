import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({
  states: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as (() => void | (() => void))[], si: 0, ri: 0,
  owner: 'A' as string | null, auth: null as null | ((event: string, session: { user: { id: string; email: string; user_metadata: { nome: string } } } | null) => void),
  db: null as import('./outbox-db').OutboxDB | null, replace: vi.fn(), failLS: false, failOpen: false, failIDB: false, failLogout: false, autoSignout: false, beforeAutoSignout: null as null | (() => void),
  idbGate: null as Promise<void> | null, fetchGate: null as Promise<void> | null, idbCalls: [] as string[], logoutCalls: 0, sdkReads: 0,
  httpStatus: 200, autoBeforeResponse: false, local: new Map<string, string>(), session: new Map<string, string>(), removed: [] as string[],
}));
vi.mock('react', () => ({
  useState: (x: unknown) => { const i = h.si++; if (!(i in h.states)) h.states[i] = x; return [h.states[i], (v: unknown) => h.states[i] = typeof v === 'function' ? v(h.states[i]) : v]; },
  useRef: (x: unknown) => { const i = h.ri++; return h.refs[i] ??= { current: x }; },
  useEffect: (f: () => void | (() => void)) => h.effects.push(f),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: h.replace, push: vi.fn() }) }));
vi.mock('@/lib/supabase/env', () => ({ supabaseConfigurado: () => true, supabaseUrl: () => 'https://r4-account.invalid' }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: {
  getSession: async () => {
    h.sdkReads++;
    if (h.autoSignout && h.sdkReads === 3) { h.beforeAutoSignout?.(); h.owner = null; h.auth?.('SIGNED_OUT', null); }
    return { data: { session: h.owner ? { user: { id: h.owner, email: h.owner.toLowerCase() + '@example.invalid', user_metadata: { nome: h.owner } } } : null } };
  },
  onAuthStateChange: (cb: typeof h.auth) => { h.auth = cb; return { data: { subscription: { unsubscribe() {} } } }; },
  signOut: async () => { h.logoutCalls++; if (h.failLogout) throw new Error('rede indisponível'); h.owner = null; h.auth?.('SIGNED_OUT', null); return { error: null }; },
} }) }));
vi.mock('./sync-cliente', () => ({ bancoSync: async () => {
  if (h.failOpen) throw new DOMException('abertura IDB bloqueada', 'SecurityError');
  return { apagarConta: async (subject: string) => {
    h.idbCalls.push(subject); if (h.idbGate) await h.idbGate;
    if (h.failIDB) throw new DOMException('commit IDB abortado', 'AbortError');
    await h.db!.apagarConta(subject);
  } };
} }));
import ContaPage from '@/app/conta/page';
import { definirEscopoLocal, escopoLocal } from '@/lib/escopo-local';
import { OutboxDB } from './outbox-db';
import { novoComando } from './sync-contrato';

type El = { type: unknown; props: Record<string, unknown> & { children?: unknown; onClick?: () => void | Promise<void>; disabled?: boolean } };
function elements(root: unknown): El[] {
  if (!root || typeof root !== 'object' || !('props' in root)) return [];
  const el = root as El;
  return [el, ...(Array.isArray(el.props.children) ? el.props.children : [el.props.children]).flatMap(elements)];
}
function text(root: unknown): string {
  if (typeof root === 'string' || typeof root === 'number') return String(root);
  if (Array.isArray(root)) return root.map(text).join(' ');
  return root && typeof root === 'object' && 'props' in root ? text((root as El).props.children) : '';
}
function render() { h.si = 0; h.ri = 0; return ContaPage(); }
function primary() { return elements(render()).find(e => e.type === 'button' && e.props.onClick?.name === 'excluirConta')!; }
function button(label: string) { return elements(render()).find(e => e.type === 'button' && text(e).includes(label))!; }
function gate() { let release!: () => void; const promise = new Promise<void>(r => release = r); return { promise, release }; }
function enter(owner: string | null) {
  h.owner = owner;
  if (owner) h.session.set('evk_email', owner);
  h.auth?.(owner ? 'SIGNED_IN' : 'SIGNED_OUT', owner ? { user: { id: owner, email: owner.toLowerCase() + '@example.invalid', user_metadata: { nome: owner } } } : null);
}
const key = (subject: string) => `evk_treinos:s2:r4-account.invalid:${subject}`;
let cleanups: (() => void)[] = [];
async function mount() {
  render(); cleanups = h.effects.slice().map(f => f()).filter((c): c is () => void => !!c);
  await vi.waitFor(() => expect(elements(render()).some(e => e.props.valor === 'a@example.invalid')).toBe(true));
  button('Excluir minha conta e meus dados').props.onClick!();
  const input = elements(render()).find(e => e.props.id === 'evk-senha-exclusao')!;
  (input.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'senha-sintetica' } });
}
function pending() {
  expect(text(render())).toMatch(/excluída no servidor.*limpeza.*pendente/i);
  expect(primary().props.disabled).toBe(false);
  expect(text(primary())).toBe('Concluir limpeza neste aparelho');
  expect(elements(render()).some(e => e.props.id === 'evk-senha-exclusao')).toBe(false);
}
async function assertB() {
  expect(h.local.get(key('B'))).toBe('local-B'); expect(h.local.get('outro-app')).toBe('sentinela');
  expect(await h.db!.ler('B', 'sentinela')).toBe('IDB-B'); expect(await h.db!.listar('B')).toHaveLength(1);
  expect(h.removed.some(k => k.endsWith(':B'))).toBe(false);
}
beforeEach(async () => {
  Object.assign(h, { states: [], refs: [], effects: [], si: 0, ri: 0, owner: 'A', auth: null, failLS: false, failOpen: false, failIDB: false, failLogout: false, autoSignout: false, beforeAutoSignout: null, autoBeforeResponse: false, idbGate: null, fetchGate: null, idbCalls: [], logoutCalls: 0, sdkReads: 0, httpStatus: 200, local: new Map([[key('A'), 'local-A'], [key('B'), 'local-B'], ['outro-app', 'sentinela']]), session: new Map([['evk_email', 'A']]), removed: [] });
  h.replace.mockClear(); definirEscopoLocal('A'); h.db = await OutboxDB.abrir('r4-' + crypto.randomUUID());
  for (const subject of ['A', 'B']) {
    await h.db.guardar(subject, 'sentinela', 'IDB-' + subject);
    await h.db.enfileirar(novoComando(subject, { tipo: 'PESO', payload: { pesoKg: 80, dataISO: '2026-10-20' } }));
  }
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', { getItem: (k: string) => h.local.get(k) ?? null, setItem: (k: string, v: string) => h.local.set(k, v), removeItem: (k: string) => { h.removed.push(k); if (h.failLS) throw new DOMException('LS bloqueado', 'SecurityError'); h.local.delete(k); } });
  vi.stubGlobal('sessionStorage', { removeItem: (k: string) => h.session.delete(k) });
  vi.stubGlobal('fetch', vi.fn(async () => { if (h.fetchGate) await h.fetchGate; if (h.autoBeforeResponse) enter(null); return new Response('{}', { status: h.httpStatus }); }));
});
afterEach(() => { cleanups.splice(0).forEach(c => c()); h.db?.fechar(); definirEscopoLocal(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(['LS', 'abertura IDB', 'commit IDB'])('R02a %s: informa pendência e retry conclui A sem Auth nem segundo POST', async modo => {
  h.failLS = modo === 'LS'; h.failOpen = modo === 'abertura IDB'; h.failIDB = modo === 'commit IDB';
  await mount(); await primary().props.onClick!(); pending(); expect(escopoLocal()).toBeNull(); await assertB();
  const reads = h.sdkReads; h.failLS = false; h.failOpen = false; h.failIDB = false;
  await primary().props.onClick!();
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith('/api/lgpd/excluir', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'x-evk-subject': 'A' }) }));
  expect(h.logoutCalls).toBe(1); expect(h.sdkReads).toBe(reads);
  expect(h.idbCalls.every(s => s === 'A')).toBe(true); expect(await h.db!.ler('A', 'sentinela')).toBeUndefined();
  expect(await h.db!.listar('A')).toEqual([]); expect(h.local.has(key('A'))).toBe(false);
  expect(h.replace).toHaveBeenCalledOnce(); expect(h.replace).toHaveBeenCalledWith('/'); await assertB();
});
it.each(['LS', 'IDB'])('R02a %s: falha repetida mantém alvo e botão recuperável', async modo => {
  h.failLS = modo === 'LS'; h.failIDB = modo === 'IDB'; await mount();
  await primary().props.onClick!(); await primary().props.onClick!(); pending();
  expect(fetch).toHaveBeenCalledOnce(); expect(h.logoutCalls).toBe(1); expect(h.replace).not.toHaveBeenCalled();
  h.failLS = false; h.failIDB = false; await primary().props.onClick!(); expect(h.replace).toHaveBeenCalledWith('/'); await assertB();
});
it('R02a fechar e reabrir o aviso preserva o retry local sem senha', async () => {
  h.failLS = true; await mount(); await primary().props.onClick!(); pending(); button('Fechar').props.onClick!();
  expect(text(render())).toMatch(/limpeza.*pendente/i); expect(button('Retomar limpeza neste aparelho')).toBeDefined();
  button('Retomar limpeza neste aparelho').props.onClick!(); pending(); h.failLS = false; await primary().props.onClick!();
  expect(fetch).toHaveBeenCalledOnce(); await assertB();
});
it('R02a servidor 503 não vira limpeza confirmada nem remove dados locais', async () => {
  h.httpStatus = 503; await mount(); await primary().props.onClick!();
  expect(text(render())).toContain('exclusão está temporariamente indisponível'); expect(text(primary())).toBe('Excluir definitivamente');
  expect(primary().props.disabled).toBe(false); expect(h.logoutCalls).toBe(0); expect(h.idbCalls).toEqual([]);
  expect(h.local.get(key('A'))).toBe('local-A'); expect(await h.db!.ler('A', 'sentinela')).toBe('IDB-A'); await assertB();
});
it('R02a B durante HTTP: confirmação de A limpa só A e não encerra nem altera a tela de B', async () => {
  const espera = gate(); h.fetchGate = espera.promise; await mount(); const tarefa = primary().props.onClick!();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce()); enter('B'); const antes = JSON.stringify(h.states); espera.release(); await tarefa;
  expect(JSON.stringify(h.states)).toBe(antes); expect(escopoLocal()).toBe('B'); expect(h.owner).toBe('B');
  expect(h.logoutCalls).toBe(0); expect(h.session.get('evk_email')).toBe('B'); expect(h.replace).not.toHaveBeenCalled();
  expect(h.idbCalls).toEqual(['A']); await assertB();
});
it.each([false, true])('R02a B durante limpeza IDB com falha=%s: não recebe erro, retry, logout ou navegação de A', async falha => {
  const espera = gate(); h.idbGate = espera.promise; h.failIDB = falha; await mount(); const tarefa = primary().props.onClick!();
  await vi.waitFor(() => expect(h.idbCalls).toEqual(['A'])); enter('B'); const antes = JSON.stringify(h.states); espera.release(); await tarefa;
  expect(JSON.stringify(h.states)).toBe(antes); expect(escopoLocal()).toBe('B'); expect(h.owner).toBe('B');
  expect(h.session.get('evk_email')).toBe('B'); expect(h.logoutCalls).toBe(1); expect(h.replace).not.toHaveBeenCalled();
  expect(text(render())).not.toMatch(/limpeza.*pendente/i); await assertB();
});
it('R02a B→null durante limpeza não revalida o contexto antigo pós-logout', async () => {
  const espera = gate(); h.idbGate = espera.promise; h.failIDB = true; await mount(); const tarefa = primary().props.onClick!();
  await vi.waitFor(() => expect(h.idbCalls).toHaveLength(1)); enter('B'); enter(null); const antes = JSON.stringify(h.states); espera.release(); await tarefa;
  expect(JSON.stringify(h.states)).toBe(antes); expect(h.replace).not.toHaveBeenCalled(); await assertB();
});
it('R02a Auth B limpa a tela antiga mesmo se outro callback já atualizou o escopo global', async () => {
  const espera = gate(); h.idbGate = espera.promise; h.failIDB = true; await mount(); const tarefa = primary().props.onClick!();
  await vi.waitFor(() => expect(h.idbCalls).toHaveLength(1)); definirEscopoLocal('B'); enter('B');
  expect(text(render())).not.toMatch(/limpeza.*pendente|Concluir limpeza neste aparelho/i);
  const antes = JSON.stringify(h.states); espera.release(); await tarefa;
  expect(JSON.stringify(h.states)).toBe(antes); expect(h.owner).toBe('B'); expect(h.replace).not.toHaveBeenCalled(); await assertB();
});
it('R02a desmontar durante limpeza preserva A como alvo sem publicar no componente morto', async () => {
  const espera = gate(); h.idbGate = espera.promise; h.failIDB = true; await mount(); const tarefa = primary().props.onClick!();
  await vi.waitFor(() => expect(h.idbCalls).toHaveLength(1)); cleanups.splice(0).forEach(c => c()); const antes = JSON.stringify(h.states); espera.release(); await tarefa;
  expect(JSON.stringify(h.states)).toBe(antes); expect(h.replace).not.toHaveBeenCalled(); await assertB();
});
it('R02a falha de rede no logout não oculta a pendência local confirmada', async () => {
  h.failLogout = true; h.failLS = true; await mount(); await primary().props.onClick!(); pending();
  h.failLS = false; await primary().props.onClick!(); expect(fetch).toHaveBeenCalledOnce(); expect(h.logoutCalls).toBe(1); await assertB();
});
it('R02a saída Auth automática após confirmação também conserva pendência e retry sem login', async () => {
  h.autoSignout = true; h.failLS = true; await mount(); await primary().props.onClick!(); pending();
  expect(escopoLocal()).toBeNull(); expect(h.logoutCalls).toBe(0);
  h.failLS = false; await primary().props.onClick!(); expect(fetch).toHaveBeenCalledOnce(); expect(h.replace).toHaveBeenCalledWith('/'); await assertB();
});
it('R02a saída automática não revalida tentativa já invalidada por escopo A→B→A', async () => {
  h.autoSignout = true; h.failLS = true;
  h.beforeAutoSignout = () => { definirEscopoLocal('B'); definirEscopoLocal('A'); };
  await mount(); await primary().props.onClick!();
  expect(text(render())).not.toMatch(/limpeza.*pendente|Concluir limpeza neste aparelho/i);
  expect(h.replace).not.toHaveBeenCalled(); expect(h.logoutCalls).toBe(0); expect(fetch).toHaveBeenCalledOnce(); await assertB();
});
it('R02a Auth encerra A antes da resposta 200: confirmado depois, retry local segue sem login', async () => {
  h.autoBeforeResponse = true; h.failLS = true; await mount(); await primary().props.onClick!(); pending();
  expect(h.logoutCalls).toBe(0); h.failLS = false; await primary().props.onClick!();
  expect(fetch).toHaveBeenCalledOnce(); expect(h.replace).toHaveBeenCalledWith('/'); await assertB();
});
it('R02a Auth encerra A antes da resposta 503: não inventa confirmação nem limpa', async () => {
  h.autoBeforeResponse = true; h.httpStatus = 503; await mount(); await primary().props.onClick!();
  expect(text(render())).toContain('exclusão está temporariamente indisponível');
  expect(text(render())).not.toMatch(/limpeza.*pendente|Concluir limpeza neste aparelho/i);
  expect(h.idbCalls).toEqual([]); expect(h.local.get(key('A'))).toBe('local-A'); await assertB();
});
it.each([false, true])('R02a botão antigo de retry depois de B e retorno a null=%s não atua nem navega', async voltar => {
  h.failLS = true; await mount(); await primary().props.onClick!(); pending(); const antigo = primary().props.onClick!;
  enter('B'); if (voltar) enter(null); h.failLS = false; const antes = JSON.stringify(h.states), calls = h.idbCalls.length;
  await antigo(); expect(JSON.stringify(h.states)).toBe(antes); expect(h.idbCalls).toHaveLength(calls);
  expect(h.replace).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledOnce(); await assertB();
});
it('R02a clique duplicado enquanto o POST está pendente não inicia outra exclusão', async () => {
  const espera = gate(); h.fetchGate = espera.promise; h.failLS = true; await mount(); const acao = primary().props.onClick!, primeira = acao();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce()); const segunda = acao();
  try { await new Promise(r => setTimeout(r, 0)); expect(fetch).toHaveBeenCalledOnce(); }
  finally { espera.release(); await Promise.allSettled([primeira, segunda]); }
  pending(); h.failLS = false; await primary().props.onClick!(); expect(fetch).toHaveBeenCalledOnce(); await assertB();
});
it('R02a clique duplicado no retry enquanto IDB está pendente faz uma única limpeza', async () => {
  h.failLS = true; await mount(); await primary().props.onClick!(); pending(); h.failLS = false;
  const espera = gate(); h.idbGate = espera.promise; const acao = primary().props.onClick!, primeira = acao();
  await vi.waitFor(() => expect(h.idbCalls).toHaveLength(1)); const segunda = acao();
  try { await new Promise(r => setTimeout(r, 0)); expect(h.idbCalls).toHaveLength(1); }
  finally { espera.release(); await Promise.allSettled([primeira, segunda]); }
  expect(h.replace).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledOnce(); await assertB();
});
it('R02a abort real no callback IDB reverte A; retry remove A sem tocar B', async () => {
  const del = IDBObjectStore.prototype.delete;
  const spy = vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function(this: IDBObjectStore, k: IDBValidKey | IDBKeyRange) {
    if (typeof k === 'string' && k.startsWith('A:')) throw new DOMException('quota sintética', 'QuotaExceededError');
    return del.call(this, k);
  });
  await mount(); await primary().props.onClick!(); pending(); expect(await h.db!.listar('A')).toHaveLength(1); await assertB();
  spy.mockRestore(); await primary().props.onClick!(); expect(await h.db!.listar('A')).toEqual([]); expect(fetch).toHaveBeenCalledOnce(); await assertB();
});
