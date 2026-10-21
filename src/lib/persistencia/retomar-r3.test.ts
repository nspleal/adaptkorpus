import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ states: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as (() => (() => void) | void)[], si: 0, ri: 0, owner: 'A' as string | null, banco: vi.fn() }));
vi.mock('react', () => ({ useState: (x: unknown) => { const i = h.si++; if (!(i in h.states)) h.states[i] = x; return [h.states[i], (v: unknown) => h.states[i] = v]; }, useRef: (x: unknown) => h.refs[h.ri++] ?? (h.refs[h.ri - 1] = { current: x }), useEffect: (f: () => (() => void) | void) => h.effects.push(f) }));
vi.mock('@/lib/escopo-local', () => ({ escopoLocal: () => h.owner }));
vi.mock('./sync-cliente', () => ({ bancoSync: h.banco, EVENTO_SYNC: 'teste-sync' }));
import RetomarSessao, { EVENTO_RETOMAR_SESSAO } from '@/components/painel/RetomarSessao';
import { OutboxDB } from './outbox-db';
const abertos: OutboxDB[] = []; let cleanups: (() => void)[] = [];
function render() { h.si = 0; h.ri = 0; return RetomarSessao({ ocupado: false, modoDiario: false }); }
async function mount() { const db = await OutboxDB.abrir(crypto.randomUUID()); abertos.push(db); h.banco.mockResolvedValue(db); await db.guardarRascunhoSessao('A', { schemaVersion: 1, origem: 'manual', chave: 'manual', sessaoId: 's', localVersion: 'v', dirty: true, baseRevision: 0, dados: {} }); render(); cleanups = h.effects.map(f => f()).filter((c): c is () => void => !!c); await vi.waitFor(() => expect(h.states[0]).toMatchObject({ sessaoId: 's' })); return db; }
beforeEach(() => { Object.assign(h, { states: [], refs: [], effects: [], si: 0, ri: 0, owner: 'A' }); h.banco.mockReset(); vi.stubGlobal('window', new EventTarget()); });
afterEach(() => { cleanups.forEach(c => c()); cleanups = []; abertos.splice(0).forEach(db => db.fechar()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('botão com candidato antigo relê terminalidade no clique e não emite Retomar', async () => {
  const db = await mount(), tree = render(), evento = vi.fn(); window.addEventListener(EVENTO_RETOMAR_SESSAO, evento);
  await db.encerrarSessao('A', 's'); tree!.props.onClick(); await vi.waitFor(() => expect(h.states[0]).toBeNull()); expect(evento).not.toHaveBeenCalled();
});
it.each(['troca', 'unmount'])('leitura de Retomar suspensa com %s não emite evento nem altera estado', async modo => {
  await mount(); let release!: () => void; const gate = new Promise<void>(r => release = r), banco = h.banco.getMockImplementation()!;
  h.banco.mockImplementation(async () => { await gate; return banco(); });
  const evento = vi.fn(); window.addEventListener(EVENTO_RETOMAR_SESSAO, evento); render()!.props.onClick();
  if (modo === 'troca') h.owner = 'B'; else { cleanups.forEach(c => c()); cleanups = []; }
  const antes = JSON.stringify(h.states); release(); await new Promise(r => setTimeout(r, 20)); expect(JSON.stringify(h.states)).toBe(antes); expect(evento).not.toHaveBeenCalled();
});
it('controle positivo retoma a sessão legítima uma vez', async () => {
  await mount(); const evento = vi.fn(); window.addEventListener(EVENTO_RETOMAR_SESSAO, evento); render()!.props.onClick();
  await vi.waitFor(() => expect(evento).toHaveBeenCalledOnce()); expect((evento.mock.calls[0]![0] as CustomEvent).detail.sessaoId).toBe('s');
});
