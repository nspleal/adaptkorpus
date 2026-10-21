import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const c=vi.hoisted(()=>({owner:'A',baixar:vi.fn()}));
vi.mock('@/lib/supabase/client',()=>({createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:c.owner}}}})}})}));
vi.mock('@/lib/export',()=>({baixarArquivo:c.baixar}));
import {baixarDadosCompletosDaConta} from './baixar-dados-conta';
beforeEach(()=>{c.owner='A';c.baixar.mockClear();});afterEach(()=>vi.unstubAllGlobals());
describe('portabilidade completa e dono no momento do download',()=>{
 it('resposta completa da mesma conta gera um arquivo',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({usuario:{id:'A'},logs:[],recibos:[]}))));await baixarDadosCompletosDaConta('A');expect(c.baixar).toHaveBeenCalledOnce();});
 it('erro da API não vira download parcial',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:503})));await expect(baixarDadosCompletosDaConta('A')).rejects.toThrow();expect(c.baixar).not.toHaveBeenCalled();});
 it('trocar conta durante leitura impede download de A na aba de B',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>{c.owner='B';return{usuario:{id:'A'}};}}));await expect(baixarDadosCompletosDaConta('A')).rejects.toThrow('conta_mudou');expect(c.baixar).not.toHaveBeenCalled();});
 it('corpo de outra conta ou sessão já trocada nunca baixa',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({usuario:{id:'B'}}))));await expect(baixarDadosCompletosDaConta('A')).rejects.toThrow('conta_mudou');c.owner='B';await expect(baixarDadosCompletosDaConta('A')).rejects.toThrow('conta_mudou');expect(c.baixar).not.toHaveBeenCalled();});
});
