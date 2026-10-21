import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ states: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as (() => (() => void) | void)[], stateIndex: 0, refIndex: 0, subject: 'A' as string | null }));
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const i = h.stateIndex++;
    if (!(i in h.states)) h.states[i] = typeof initial === 'function' ? initial() : initial;
    return [h.states[i], (v: unknown) => { h.states[i] = typeof v === 'function' ? v(h.states[i]) : v; }];
  },
  useRef: (initial: unknown) => { const i = h.refIndex++; return h.refs[i] ?? (h.refs[i] = { current: initial }); },
  useEffect: (f: () => (() => void) | void) => h.effects.push(f),
}));
vi.mock('@/lib/escopo-local', () => ({ escopoLocal: () => h.subject }));
import RegistrarCardio from '@/components/painel/Cardio';
import CalibracaoModal from '@/components/painel/CalibracaoModal';

type Elemento = { type: unknown; props: { children?: unknown; onClick?: () => Promise<unknown>; role?: string; disabled?: boolean } };
function elementos(e: unknown): Elemento[] {
  if (!e || typeof e !== 'object' || !('props' in e)) return [];
  const el = e as Elemento, filhos = Array.isArray(el.props.children) ? el.props.children : [el.props.children];
  return [el, ...filhos.flatMap(elementos)];
}
function renderizar<T>(f: () => T): T { h.stateIndex = 0; h.refIndex = 0; return f(); }
function salvar(tree: unknown) { const btn = elementos(tree).find(e => e.type === 'button' && e.props.onClick?.name === 'salvar'); expect(btn).toBeDefined(); return btn!.props.onClick!(); }
function pendencia() { let resolve!: () => void, reject!: (e: Error) => void; const promise = new Promise<void>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
beforeEach(() => { h.states = []; h.refs = []; h.effects = []; h.subject = 'A'; });
afterEach(() => vi.restoreAllMocks());

it('R5: cardio aguarda commit local, bloqueia clique concorrente e confirma sucesso offline', async () => {
  const gate = pendencia(), onSalvar = vi.fn(() => gate.promise);
  const props = { pesoKg: 80, minutosInicial: 45, onSalvar, onCancelar() {} };
  const tree = renderizar(() => RegistrarCardio(props));
  const primeiro = salvar(tree); await salvar(tree);
  expect(onSalvar).toHaveBeenCalledOnce(); expect(h.states[3]).toBeNull();
  expect(elementos(renderizar(() => RegistrarCardio(props))).some(e => e.props.disabled)).toBe(true);
  gate.resolve(); await primeiro;
  expect(h.states[3]).toMatchObject({ minutos: 45, modalidade: 'caminhada' });
});

it('R5: abort mantém campos e erro; retry não confirma antes do segundo commit', async () => {
  const gate = pendencia(), onSalvar = vi.fn(() => gate.promise);
  const props = { pesoKg: 80, minutosInicial: 45, onSalvar, onCancelar() {} };
  const primeiro = salvar(renderizar(() => RegistrarCardio(props)));
  gate.reject(new Error('storage_abortado')); await primeiro;
  expect(h.states[3]).toBeNull(); expect(h.states[2]).toBe(45);
  const novamente = renderizar(() => RegistrarCardio(props));
  expect(elementos(novamente).some(e => e.props.role === 'alert')).toBe(true);
  const segundo = pendencia(); onSalvar.mockImplementation(() => segundo.promise);
  const retry = salvar(novamente); expect(h.states[3]).toBeNull();
  segundo.resolve(); await retry; expect(h.states[3]).toMatchObject({ minutos: 45 });
  expect(onSalvar).toHaveBeenCalledTimes(2);
});

it('R5: retorno tardio após troca de conta não publica confirmação', async () => {
  const gate = pendencia();
  const task = salvar(renderizar(() => RegistrarCardio({ pesoKg: 80, onSalvar: () => gate.promise, onCancelar() {} })));
  h.subject = 'B'; gate.resolve(); await task; expect(h.states[3]).toBeNull();
});

it('R5: cardio embutido só avança após commit; cancelamento/desmontagem impede avanço tardio', async () => {
  const gate = pendencia(), avancar = vi.fn();
  const props = { pesoKg: 80, embutido: true, onSalvar: () => gate.promise, onConfirmado: avancar, onCancelar() {} };
  const task = salvar(renderizar(() => RegistrarCardio(props)));
  expect(avancar).not.toHaveBeenCalled();
  gate.resolve(); await task; expect(avancar).toHaveBeenCalledOnce();
  const segunda = pendencia();
  const outro = salvar(renderizar(() => RegistrarCardio({ ...props, onSalvar: () => segunda.promise })));
  const limpar = h.effects[0]!(); limpar?.();
  segunda.resolve(); await outro; expect(avancar).toHaveBeenCalledOnce();
});

it('R5: calibração permanece aberta em pendência/abort; fecha só depois do retry durável', async () => {
  const gate = pendencia(), onSalvar = vi.fn(() => gate.promise), onFechar = vi.fn();
  const props: Parameters<typeof CalibracaoModal>[0] = {
    exercicioEfetivo: { id: 'e_sup', nomePt: 'Supino' } as Parameters<typeof CalibracaoModal>[0]['exercicioEfetivo'],
    loaded: true, nivel: 'iniciante', exercicioPorId: () => undefined, onSalvar, onFechar,
  };
  const tree = renderizar(() => CalibracaoModal(props)), task = salvar(tree); await salvar(tree);
  expect(onSalvar).toHaveBeenCalledOnce(); expect(onFechar).not.toHaveBeenCalled();
  gate.reject(new Error('quota')); await task; expect(onFechar).not.toHaveBeenCalled();
  const again = renderizar(() => CalibracaoModal(props));
  expect(elementos(again).some(e => e.props.role === 'alert')).toBe(true);
  onSalvar.mockResolvedValue(); await salvar(again); expect(onFechar).toHaveBeenCalledOnce();
});
