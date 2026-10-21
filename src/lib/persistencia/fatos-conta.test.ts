import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const controle=vi.hoisted(()=>({trocar:false,owner:'A',fatos:[] as unknown[]}));
vi.mock('./sync',()=>({carregarHistoricoServidor:async()=>controle.fatos,carregarPesosServidor:async()=>[],carregarAderenciaServidor:async()=>({})}));
vi.mock('@/lib/escopo-local',()=>({escopoLocal:()=>controle.owner,chaveLocal:(k:string)=>k+':'+controle.owner}));
const storage=new Map<string,string>();
import {atualizarFatosConta} from './fatos-conta';
import type {OutboxDB} from './outbox-db';
import { novoComando } from './sync-contrato';
import type { SessaoHistorico } from '@/lib/treino-historico';
beforeEach(()=>{controle.owner='A';controle.trocar=false;controle.fatos=[{id:'sessao-a',n:1,dataISO:'2026-10-19',dia:'A',series:1,volumeKg:0,feedback:{},exercicios:[]}];storage.clear();vi.stubGlobal('window',new EventTarget());vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)});});
afterEach(()=>vi.unstubAllGlobals());
describe('C01 — hidratação tardia não muda a gaveta da próxima conta',()=>{
 it('trocar durante a leitura do IDB impede toda escrita local e evento de fatos',async()=>{
  storage.set('evk_treinos:B','["sentinela-B"]');const evento=vi.fn();window.addEventListener('evk:fatos-atualizados',evento);
  const db={listar:async()=>[],lerRascunhosSessao:async()=>{controle.owner='B';return {geracao:0,pendente:false};},ler:async()=>undefined,guardar:vi.fn()} as unknown as OutboxDB;
  await atualizarFatosConta(db,'A');expect([...storage]).toEqual([['evk_treinos:B','["sentinela-B"]']]);expect(evento).not.toHaveBeenCalled();
 });
 it('mesma conta hidrata fatos e notifica; nova chamada sem mudança não duplica',async()=>{
  const db={listar:async()=>[],lerRascunhosSessao:async()=>({geracao:0,pendente:false}),ler:async()=>undefined,guardar:vi.fn()} as unknown as OutboxDB;const evento=vi.fn();window.addEventListener('evk:fatos-atualizados',evento);
  await atualizarFatosConta(db,'A');await atualizarFatosConta(db,'A');expect(JSON.parse(storage.get('evk_treinos:A')!)).toHaveLength(1);expect(evento).toHaveBeenCalledTimes(1);
 });
});

it('R6: dez hidratações unem cache e intenção pelo ID, curam repetição e preservam sessões distintas', async () => {
 const sessao = controle.fatos[0] as SessaoHistorico;
 controle.fatos = [];
 storage.set('evk_treinos:A', JSON.stringify([sessao, sessao]));
 storage.set('evk_treinos:B', '["sentinela-B"]');
 const enfileirar = vi.fn();
 const outra = { ...sessao, id: 'sessao-distinta', n: 2 };
 const pendentes = [sessao, outra].map((s, i) => ({ comando: novoComando('A', { tipo: 'SESSAO', payload: { sessao: s } }), criadoEm: 0, sequencia: i }));
 const db = { listar: async () => pendentes, lerRascunhosSessao: async () => ({geracao:0,pendente:false}), ler: async () => undefined, guardar: vi.fn(), enfileirar } as unknown as OutboxDB;
 for (let i = 0; i < 10; i++) await atualizarFatosConta(db, 'A');
 const cache = JSON.parse(storage.get('evk_treinos:A')!) as SessaoHistorico[];
 expect(cache).toHaveLength(2); expect(new Set(cache.map(s => s.id)).size).toBe(2);
 expect(storage.get('evk_treinos:B')).toBe('["sentinela-B"]');
 expect(enfileirar).not.toHaveBeenCalled();
});
