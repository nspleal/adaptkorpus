import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,expect,it,vi} from 'vitest';
function instalar(){
 const eventos:Record<string,(e:unknown)=>void>={};const objetos=new Map<string,Map<string,Response>>();
 const caches={keys:async()=>[...objetos.keys()],delete:vi.fn(async(k:string)=>objetos.delete(k)),open:async(k:string)=>{if(!objetos.has(k))objetos.set(k,new Map());const m=objetos.get(k)!;return{match:async(r:string|Request)=>m.get(typeof r==='string'?r:r.url),put:async(r:string|Request,v:Response)=>{m.set(typeof r==='string'?r:r.url,v);}};}};
 const fetch=vi.fn(async()=>new Response('fixture'));const claim=vi.fn();
 runInNewContext(readFileSync('public/sw.js','utf8'),{self:{addEventListener:(n:string,f:(e:unknown)=>void)=>{eventos[n]=f;},location:{origin:'https://fixture.invalid'},clients:{claim},skipWaiting:vi.fn()},caches,fetch,URL,Response});
 return{eventos,caches,objetos,fetch,claim};
}
describe('upgrade do SW — escopo fechado e nenhum dado da API em cache',()=>{
 it('ativação apaga somente nomes antigos próprios; outros caches ficam byte a byte',async()=>{
  const c=instalar();for(const k of ['evk-pages-v1','evk-static-v2','evk-pages-v3','evk-static-v3','outro-app','evk-pages-personal','evk-qualquer-v1'])c.objetos.set(k,new Map([['sentinela',new Response(k)]]));
  let p!:Promise<unknown>;c.eventos.activate!({waitUntil:(v:Promise<unknown>)=>{p=v;}});await p;
  expect(c.caches.delete.mock.calls.flat()).toEqual(['evk-pages-v1','evk-static-v2']);expect(await c.objetos.get('outro-app')!.get('sentinela')!.text()).toBe('outro-app');expect(c.claim).toHaveBeenCalledOnce();
 });
 it('POST/PUT, API GET e Supabase ficam fora do worker',()=>{
  const c=instalar();for(const r of [{method:'POST',url:'https://fixture.invalid/app'},{method:'PUT',url:'https://fixture.invalid/api/dados/sync'},{method:'GET',url:'https://fixture.invalid/api/dados/perfil',mode:'navigate'},{method:'GET',url:'https://projeto.supabase.co/rest/v1/logs'}]){
   const responder=vi.fn();c.eventos.fetch!({request:r,respondWith:responder});expect(responder).not.toHaveBeenCalled();
  }expect(c.fetch).not.toHaveBeenCalled();
 });
 it('app previamente visitado tem fallback; rota sem cópia informa indisponibilidade',async()=>{
  const c=instalar();const req={method:'GET',url:'https://fixture.invalid/app',mode:'navigate'};
  let p!:Promise<Response>;c.eventos.fetch!({request:req,respondWith:(r:Promise<Response>)=>{p=r;}});expect(await (await p).text()).toBe('fixture');
  c.fetch.mockRejectedValue(new Error('offline'));c.eventos.fetch!({request:req,respondWith:(r:Promise<Response>)=>{p=r;}});expect(await (await p).text()).toBe('fixture');
  c.eventos.fetch!({request:{...req,url:'https://fixture.invalid/conta'},respondWith:(r:Promise<Response>)=>{p=r;}});expect((await p).status).toBe(503);
 });
 it('redirecionamento para login não envenena a cópia offline de /app',async()=>{
  const c=instalar();c.fetch.mockResolvedValue({ok:true,redirected:true,url:'https://fixture.invalid/login'} as Response);
  let p!:Promise<Response>;const request={method:'GET',url:'https://fixture.invalid/app',mode:'navigate'};
  c.eventos.fetch!({request,respondWith:(r:Promise<Response>)=>{p=r;}});await p;
  expect(c.objetos.get('evk-pages-v3')?.size ?? 0).toBe(0);
  c.fetch.mockRejectedValue(new Error('offline'));c.eventos.fetch!({request,respondWith:(r:Promise<Response>)=>{p=r;}});expect((await p).status).toBe(503);
 });

});
