import { beforeAll, afterAll, it } from 'vitest';
import { createServer } from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { fixture, iniciarFixture, fecharFixture, pedido } from './sync-http-fixture';
import { CONTA_A, CONTA_B, PERFIL_FIXTURE } from './sync-fixture';
import { NextRequest } from 'next/server';
import * as sync from '../src/app/api/dados/sync/route';
import { GET as perfil } from '../src/app/api/dados/perfil/route';
import { GET as historico } from '../src/app/api/dados/historico/route';
import { GET as peso } from '../src/app/api/dados/peso/route';
import { GET as aderencia } from '../src/app/api/dados/aderencia/route';
import { GET as exportar } from '../src/app/api/lgpd/exportar/route';
import { POST as metricas } from '../src/app/api/metricas/route';

const contexto = new AsyncLocalStorage<string>();
let parar: () => void, indisponivel=false, perderAck=false;
const servidor=createServer((req,res) => {
  const subject = /(?:^|;\s*)evk_fixture_subject=([a-f0-9-]+)/.exec(req.headers.cookie ?? '')?.[1] ?? CONTA_A;
  void contexto.run(subject,async () => {
    try {
      const u=new URL(req.url ?? '/','http://127.0.0.1:3028');
      if (u.pathname==='/__qa/estado') {
        const counts=await fixture.db.query("select (select count(*)::int from logs where tipo='treino') sessoes,(select count(*)::int from plans) snapshots,(select count(*)::int from app_private.sync_recibos) recibos");
        const planos=await fixture.db.query('select user_id,revision,payload->\'entrada\'->\'perfil\'->\'tempoPorSessaoMin\' tempo from plano_cas');
        res.setHeader('content-type','application/json');res.end(JSON.stringify({indisponivel,counts:counts.rows[0],planos:planos.rows})); return;
      }
      if (u.pathname==='/__qa/parar') { res.end('Encerrando fixture local.'); parar();return; }
      if (u.pathname.startsWith('/__qa/login/')) {
        const conta=u.pathname.endsWith('/B')?CONTA_B:CONTA_A;
        res.setHeader('set-cookie',`evk_fixture_subject=${conta}; Path=/; SameSite=Lax`);res.writeHead(302,{location:'/app'});res.end();return;
      }
      if (u.pathname==='/__qa/falha') { indisponivel=u.searchParams.get('ativa')==='1';res.writeHead(302,{location:'/__qa'});res.end();return; }
      if (u.pathname==='/__qa/ack') { perderAck=true;res.writeHead(302,{location:'/__qa'});res.end();return; }
      if (u.pathname==='/__qa/realtime') {
        const since=Number(u.searchParams.get('since') ?? 0);
        const r=await fixture.db.query('select seq,payload from realtime_test_outbox where topic=$1 and seq>$2 order by seq',[`user:${subject}:plano`,since]);
        res.setHeader('content-type','application/json');res.end(JSON.stringify(r.rows));return;
      }
      if (u.pathname==='/__qa') {
        res.setHeader('content-type','text/html; charset=utf-8');
        res.end(`<h1>QA local — dados sintéticos descartáveis</h1><p>Sem Supabase real ou credenciais.</p><a href="/__qa/login/A">Abrir conta sintética A</a><p><a href="/__qa/login/B">Abrir conta sintética B</a></p><p>API: ${indisponivel?'indisponível':'normal'}</p><a href="/__qa/falha?ativa=1">Simular indisponibilidade</a><p><a href="/__qa/falha?ativa=0">Restabelecer API</a></p><a href="/__qa/ack">Perder próximo ACK após commit</a>`); return;
      }
      if (indisponivel && u.pathname.startsWith('/api/')) { res.writeHead(503,{'content-type':'application/json'});res.end('{"error":"fixture_indisponivel"}');return; }
      if (u.pathname==='/api/acesso') {res.setHeader('content-type','application/json');res.end('{"liberado":true,"via":"fixture_local"}');return;}
      const rotas: Record<string,(r:NextRequest)=>Promise<Response>> = {
        'GET /api/dados/sync':sync.GET,'POST /api/dados/sync':sync.POST,
        'GET /api/dados/perfil':perfil,'GET /api/dados/historico':historico,'GET /api/dados/peso':peso,
        'GET /api/dados/aderencia':aderencia,'GET /api/lgpd/exportar':exportar,'POST /api/metricas':metricas,
      };
      const handler=rotas[`${req.method} ${u.pathname}`];if(!handler){res.writeHead(404);res.end();return;}
      const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));
      const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);
      const next=new NextRequest(u,{method:req.method,headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
      const resposta=await handler(next);
      if(perderAck && req.method==='POST' && resposta.ok && u.pathname==='/api/dados/sync'){perderAck=false;res.destroy();return;}
      res.writeHead(resposta.status,Object.fromEntries(resposta.headers));res.end(Buffer.from(await resposta.arrayBuffer()));
    }catch(e){console.error('fixture_http_falhou',e instanceof Error?e.message:'erro');res.writeHead(500);res.end();}
  });
});
beforeAll(async()=>{
  await iniciarFixture();fixture.contexto=contexto;
  for(const subject of [CONTA_A,CONTA_B]) await contexto.run(subject,()=>sync.POST(pedido('PERFIL',{perfil:PERFIL_FIXTURE,expectedRevision:0},subject)));
  await new Promise<void>((resolve,reject)=>{servidor.once('error',reject);servidor.listen(3028,'127.0.0.1',resolve);});
  console.log('QA_API_PRONTA http://127.0.0.1:3028/__qa');
},30_000);
afterAll(async()=>{await new Promise<void>(resolve=>servidor.close(()=>resolve()));await fecharFixture();});
it('sessão manual de navegador, encerrada pelo controle local',async()=>{await new Promise<void>(resolve=>{parar=resolve;});});
