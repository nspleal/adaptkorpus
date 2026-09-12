import { describe, expect, it, vi } from 'vitest';
import { criarPersistenciaAderencia, mesclarAderencia, type HistoricoAderencia } from './aderencia-persistencia';
const DIA = '2026-09-12';
const registro = (valor: 'seguiu' | 'fora', pendenteSync = false) => ({ logs: { cafe: valor }, notes: {}, pendenteSync });
const drenar = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function cenario(inicial: HistoricoAderencia = {}) {
  let storage = structuredClone(inicial);
  let ativo = true;
  const enviar = vi.fn<(...args: unknown[]) => Promise<boolean>>().mockResolvedValue(true);
  const mostrar = vi.fn();
  const gravar = vi.fn((h: HistoricoAderencia) => { storage = structuredClone(h); });
  const deps = { ativo: () => ativo, online: true, ler: () => structuredClone(storage), gravar, enviar, mostrar };
  const p = criarPersistenciaAderencia(deps);
  return { p, deps, enviar, mostrar, gravar, ler: () => storage, parar: () => { ativo = false; } };
}
describe('Aderência: falha e recuperação sem sobrescrever dados', () => {
  it('iniciar não grava estado vazio nem chama PUT', () => {
    const c = cenario({ [DIA]: registro('seguiu') });
    expect(c.enviar).not.toHaveBeenCalled(); expect(c.gravar).not.toHaveBeenCalled();
    expect(c.ler()[DIA]!.logs.cafe).toBe('seguiu');
  });
  it('hidratação do servidor sem edição não dispara escrita', async () => {
    const c = cenario(); c.p.receber({ [DIA]: registro('seguiu') }, DIA); await drenar();
    expect(c.enviar).not.toHaveBeenCalled(); expect(c.ler()[DIA]!.logs.cafe).toBe('seguiu');
  });
  it('falha mantém pendência; reload e reenvio recuperam mesmo dia existente no servidor', async () => {
    const c = cenario({ [DIA]: registro('seguiu') }); c.enviar.mockResolvedValue(false);
    c.p.editar(DIA, () => registro('fora')); await drenar();
    expect(c.ler()[DIA]).toEqual(registro('fora', true)); expect(c.mostrar).toHaveBeenLastCalledWith('pendente');
    const novo = cenario(c.ler()); novo.p.receber({ [DIA]: registro('seguiu') }, DIA); await drenar();
    expect(novo.enviar).toHaveBeenCalledTimes(1); expect(novo.ler()[DIA]).toEqual(registro('fora'));
  });
  it('não repete falha em loop; tentativa explícita reenvia', async () => {
    const c = cenario(); c.enviar.mockResolvedValueOnce(false).mockResolvedValue(true);
    c.p.editar(DIA, () => registro('seguiu')); await drenar(); expect(c.enviar).toHaveBeenCalledTimes(1);
    await c.p.sincronizar(); expect(c.enviar).toHaveBeenCalledTimes(2); expect(c.ler()[DIA]!.pendenteSync).toBe(false);
  });
  it('serializa edições e uma confirmação antiga não apaga a mais nova', async () => {
    const c = cenario(); let confirmar!: (ok: boolean) => void;
    c.enviar.mockImplementationOnce(() => new Promise(r => { confirmar = r; }));
    c.p.editar(DIA, () => registro('seguiu')); c.p.editar(DIA, () => registro('fora'));
    expect(c.enviar).toHaveBeenCalledTimes(1); confirmar(true); await drenar();
    expect(c.enviar).toHaveBeenCalledTimes(2); expect(c.ler()[DIA]).toEqual(registro('fora'));
  });
  it('GET atrasado não desfaz edição já confirmada', async () => {
    const c = cenario(); c.p.editar(DIA, () => registro('fora')); await drenar();
    c.p.receber({ [DIA]: registro('seguiu') }, DIA); await drenar();
    expect(c.ler()[DIA]).toEqual(registro('fora')); expect(c.enviar).toHaveBeenCalledTimes(1);
  });
  it('troca de conta ou unmount impede callback e próximos envios', async () => {
    const c = cenario(); let confirmar!: (ok: boolean) => void;
    c.enviar.mockImplementationOnce(() => new Promise(r => { confirmar = r; }));
    c.p.editar(DIA, () => registro('seguiu')); c.parar(); c.gravar.mockClear();
    confirmar(true); await drenar(); c.p.receber({}, DIA); await c.p.sincronizar();
    expect(c.gravar).not.toHaveBeenCalled(); expect(c.enviar).toHaveBeenCalledTimes(1);
  });
  it('histórico também conserva pendentes de dias anteriores', () => {
    const local = { '2026-09-11': registro('fora', true) };
    expect(mesclarAderencia(local, { '2026-09-11': registro('seguiu') })).toEqual(local);
  });
  it('falha de storage e rede é visível, sem alegar cópia local salva', async () => {
    const c = cenario(); c.gravar.mockImplementation(() => { throw new Error('quota'); }); c.enviar.mockResolvedValue(false);
    c.p.editar(DIA, () => registro('fora')); await drenar();
    expect(c.mostrar).toHaveBeenLastCalledWith('falha-local');
    c.enviar.mockResolvedValue(true); await c.p.sincronizar();
    expect(c.enviar).toHaveBeenCalledTimes(2);
  });
  it('modo local não envia nada', async () => {
    const c = cenario(); const p = criarPersistenciaAderencia({ ...c.deps, online: false });
    p.editar(DIA, () => registro('seguiu')); await drenar();
    expect(c.enviar).not.toHaveBeenCalled(); expect(c.mostrar).toHaveBeenLastCalledWith('local');
  });
});
