import 'fake-indexeddb/auto';
import {afterEach,expect,it,vi} from 'vitest';
import {OutboxDB} from './persistencia/outbox-db';
import {drenarOutbox} from './persistencia/outbox-sync';
import {novoComando,STORAGE_GENERATION} from './persistencia/sync-contrato';
afterEach(()=>vi.unstubAllGlobals());
it('troca de conta durante validação de identidade não envia a aderência anterior',async()=>{
 const db=await OutboxDB.abrir('escopo-aderencia');let conta='A';
 await db.enfileirar(novoComando('A',{tipo:'ADERENCIA',payload:{dia:'2026-09-12',logs:{cafe:'seguiu'},notes:{},base:{logs:{},notes:{}}}}));
 let resolver!:(r:Response)=>void;const f=vi.fn(()=>new Promise<Response>(r=>{resolver=r;}));
 const p=drenarOutbox(db,'A',()=>conta==='A',f);await vi.waitFor(()=>expect(f).toHaveBeenCalledOnce());conta='B';resolver(new Response(JSON.stringify({subject:'A',generation:STORAGE_GENERATION})));await p;
 expect(f).toHaveBeenCalledTimes(1);expect(await db.listar('A')).toHaveLength(1);expect(await db.listar('B')).toHaveLength(0);db.fechar();
});
