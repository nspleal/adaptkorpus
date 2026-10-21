import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ states: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as (() => (() => void) | void)[], si: 0, ri: 0, owner: 'A' as string | null, signOut: vi.fn() }));
vi.mock('react', () => ({ useState: (x: unknown) => { const i = h.si++; if (!(i in h.states)) h.states[i] = x; return [h.states[i], (v: unknown) => h.states[i] = v]; }, useRef: (x: unknown) => h.refs[h.ri++] ?? (h.refs[h.ri - 1] = { current: x }), useEffect: (f: () => (() => void) | void) => h.effects.push(f) }));
vi.mock('@/lib/escopo-local', () => ({ escopoLocal: () => h.owner, definirEscopoLocal: (v: string | null) => { if (h.owner !== v) invalidarContinuacoesConta(); h.owner = v; }, CHAVES_SESSAO: ['evk_email'] }));
vi.mock('@/lib/supabase/env', () => ({ supabaseConfigurado: () => true }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut: h.signOut } }) }));
vi.mock('@/lib/session', () => ({ limparDadosLocais: vi.fn() }));
import { continuacaoDaConta, invalidarContinuacoesConta } from './continuidade-conta';
import { useGravacaoLocal } from './use-gravacao-local';
import { sairDaConta } from '@/lib/auth/sair';
const gate = () => { let release!: () => void, reject!: (e: Error) => void; const promise = new Promise<void>((r, j) => { release = r; reject = j; }); return { promise, release, reject }; };
function trocar(v: string | null) { if (v !== h.owner) invalidarContinuacoesConta(); h.owner = v; }
beforeEach(() => { Object.assign(h, { states: [], refs: [], effects: [], si: 0, ri: 0, owner: 'A' }); h.signOut.mockReset().mockResolvedValue({}); vi.stubGlobal('sessionStorage', { removeItem: vi.fn() }); });
afterEach(() => vi.unstubAllGlobals());
it('epoch invalida A→B→A; refresh de A e continuidade nova continuam válidos', () => {
  const antigo = continuacaoDaConta(() => h.owner); trocar('A'); expect(antigo()).toBe(true);
  trocar('B'); trocar('A'); expect(antigo()).toBe(false); expect(continuacaoDaConta(() => h.owner)()).toBe(true);
});
it('commit próprio pode terminar após A→B→A, sem confirmar UI antiga', async () => {
  const gravacao = useGravacaoLocal(), espera = gate(), confirmar = vi.fn();
  const resultado = gravacao.gravar(() => espera.promise, confirmar); trocar('B'); trocar('A'); espera.release();
  expect(await resultado).toBe(false); expect(confirmar).not.toHaveBeenCalled();
});
it('cleanup seguido de remontagem estrita não revalida a Promise da vida anterior', async () => {
  const gravacao = useGravacaoLocal(), cleanup = h.effects[0]!()!, espera = gate(), confirmar = vi.fn();
  const resultado = gravacao.gravar(() => espera.promise, confirmar); cleanup(); h.effects[0]!(); espera.release();
  expect(await resultado).toBe(false); expect(confirmar).not.toHaveBeenCalled();
});
it('falha tardia não publica erro em B; controle positivo confirma após commit', async () => {
  const gravacao = useGravacaoLocal(), espera = gate(); const resultado = gravacao.gravar(() => espera.promise);
  trocar('B'); espera.reject(new Error('quota')); expect(await resultado).toBe(false); expect(h.states[1]).toBe(false);
  h.si = 0; h.ri = 0; const nova = useGravacaoLocal(), confirmar = vi.fn();
  expect(await nova.gravar(async () => { }, confirmar)).toBe(true); expect(confirmar).toHaveBeenCalledOnce();
});
it('logout suspenso no import não chama signOut da nova conta', async () => {
  const resultado = sairDaConta(); trocar('B'); expect(await resultado).toBe(false);
  expect(h.signOut).not.toHaveBeenCalled(); expect(h.owner).toBe('B'); expect(sessionStorage.removeItem).not.toHaveBeenCalled();
});
it('logout já iniciado não limpa nem redireciona B quando sua resposta chega', async () => {
  const espera = gate(); h.signOut.mockReturnValue(espera.promise); const resultado = sairDaConta();
  await vi.waitFor(() => expect(h.signOut).toHaveBeenCalledOnce()); trocar('B'); espera.release();
  expect(await resultado).toBe(false); expect(h.owner).toBe('B'); expect(sessionStorage.removeItem).not.toHaveBeenCalled();
});
it('logout sem troca conclui pausa local; uma falha de rede conserva a intenção de sair', async () => {
  h.signOut.mockRejectedValue(new Error('offline')); expect(await sairDaConta()).toBe(true); expect(h.owner).toBeNull(); expect(sessionStorage.removeItem).toHaveBeenCalledWith('evk_email');
});
