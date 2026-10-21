import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const c=vi.hoisted(()=>({owner:'A',trocar:false,enfileirar:vi.fn()}));
vi.mock('../escopo-local',()=>({escopoLocal:()=>c.owner}));
vi.mock('../supabase/env',()=>({supabaseConfigurado:()=>true}));
vi.mock('./sync-cliente',()=>({
 bancoSync:async()=>({ler:async()=>{if(c.trocar)c.owner='B';return {};},listar:async()=>{if(c.trocar)c.owner='B';return [];},guardar:vi.fn()}),
 enfileirarOperacao:c.enfileirar,sincronizarConta:vi.fn(),lerSnapshotRemoto:vi.fn(),
}));
import {salvarAderenciaDia,registrarPesoServidor} from './sync';
beforeEach(()=>{c.owner='A';c.trocar=false;c.enfileirar.mockReset().mockResolvedValue({});});afterEach(()=>vi.restoreAllMocks());
describe('C01 — wrappers mantêm dono capturado antes de esperar storage',()=>{
 it('aderência não enfileira dados de A se B assume durante a espera',async()=>{c.trocar=true;expect(await salvarAderenciaDia('2026-10-19',{cafe:'seguiu'},{})).toBe(false);expect(c.enfileirar).not.toHaveBeenCalled();});
 it('peso não enfileira dados de A se B assume durante a espera',async()=>{c.trocar=true;expect(await registrarPesoServidor(80,'2026-10-19')).toEqual({tipo:'FALHA'});expect(c.enfileirar).not.toHaveBeenCalled();});
 it('aderência válida carrega dono esperado até a fronteira da fila',async()=>{await salvarAderenciaDia('2026-10-19',{},{});expect(c.enfileirar).toHaveBeenCalledWith(expect.anything(),{expectedSubject:'A',ativo:expect.any(Function)});expect(c.enfileirar.mock.calls[0]![1].ativo()).toBe(true);c.owner='B';expect(c.enfileirar.mock.calls[0]![1].ativo()).toBe(false);});
});
