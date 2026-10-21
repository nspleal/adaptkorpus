import 'fake-indexeddb/auto';
import {describe,expect,it,vi} from 'vitest';
import {OutboxDB} from './outbox-db';
import {novoComando,STORAGE_GENERATION} from './sync-contrato';
import {drenarOutbox} from './outbox-sync';
import {capturarRascunho,rascunhoDisponivel,type RascunhoLocal} from './rascunho-sessao';
const resposta=(status:number,v:unknown)=>new Response(JSON.stringify(v),{status});
const parcial=(id='sessao-a'):RascunhoLocal=>({schemaVersion:1,origem:'manual',chave:'manual',sessaoId:id,localVersion:crypto.randomUUID(),dirty:true,baseRevision:0,dados:{exs:[],cur:3,fase:'exec'},contexto:{origemPlano:{tipo:'rascunho',referencia:'ref-a'}}});

describe('recuperação, concorrência e falha do armazenamento',()=>{
 it('falha de estado aborta também o comando e o contador na mesma transação',async()=>{
  const db=await OutboxDB.abrir('atomic-fault'),c=novoComando('A',{tipo:'PESO',payload:{pesoKg:80,dataISO:'2026-10-19'}});
  const put=IDBObjectStore.prototype.put;const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value:unknown,key?:IDBValidKey){if(key==='A:peso')throw new DOMException('quota','QuotaExceededError');return put.call(this,value,key);});
  try{await expect(db.enfileirar(c,{chave:'peso',valor:80})).rejects.toThrow();}finally{spy.mockRestore();}
  expect(await db.listar('A')).toEqual([]);expect(await db.ler('A','sequencia')).toBeUndefined();expect(await db.ler('A','peso')).toBeUndefined();db.fechar();
 });
 it('duas drenagens concorrentes aceitam o mesmo ACK sem perder nem atribuir a outra conta',async()=>{
  const db=await OutboxDB.abrir('dual-executor'),c=novoComando('A',{tipo:'PESO',payload:{pesoKg:80,dataISO:'2026-10-19'}});await db.enfileirar(c);
  const ids:string[]=[];const transporte=async(_u:string,i?:RequestInit)=>{if(!i?.body)return resposta(200,{subject:'A',generation:STORAGE_GENERATION});ids.push(JSON.parse(String(i.body)).operationId);return resposta(200,{tipo:'ACK',operationId:c.operationId,estado:'REGISTRADO',pesoKg:80});};
  await Promise.all([drenarOutbox(db,'A',()=>true,transporte),drenarOutbox(db,'A',()=>true,transporte)]);
  expect(ids.length).toBeGreaterThan(0);expect(new Set(ids)).toEqual(new Set([c.operationId]));expect(await db.listar('A')).toHaveLength(0);expect(await db.ler('B','ultimoRecibo')).toBeUndefined();db.fechar();
 });
 it('conflito no plano bloqueia dependentes, mas não sessão independente',async()=>{
  const db=await OutboxDB.abrir('entity-block');const p=novoComando('A',{tipo:'PERFIL',payload:{perfil:{} as never,expectedRevision:0}});
  await db.enfileirar(p);await db.enfileirar(novoComando('A',{tipo:'PERFIL',payload:{perfil:{} as never,expectedRevision:0}}));
  const s=novoComando('A',{tipo:'SESSAO',payload:{sessao:{id:'s',n:1,dataISO:'2026-10-19',dia:'A',series:0,volumeKg:0,feedback:{},exercicios:[]}}});await db.enfileirar(s);
  const enviados:string[]=[];
  await drenarOutbox(db,'A',()=>true,async(_u,i)=>{if(!i?.body)return resposta(200,{subject:'A',generation:STORAGE_GENERATION});const c=JSON.parse(String(i.body));enviados.push(c.operationId);return resposta(c.tipo==='PERFIL'?409:200,c.tipo==='PERFIL'?{tipo:'CONFLITO',operationId:c.operationId,motivo:'campos_concorrentes',revision:2}:{tipo:'ACK',operationId:c.operationId});});
  expect(enviados).toEqual([p.operationId,s.operationId]);expect(await db.listar('A')).toHaveLength(2);db.fechar();
 });
 it('rascunho só limpa dirty se a versão capturada ainda é a mesma; mantém contexto e IDs',async()=>{
  const db=await OutboxDB.abrir('draft-atomic'),r=parcial();await db.guardarRascunhoSessao('A',r);await capturarRascunho(db,'A');
  const c=(await db.listar('A'))[0]!.comando;expect(c.tipo).toBe('RASCUNHO_SESSAO');
  if(c.tipo!=='RASCUNHO_SESSAO')throw Error('tipo');expect(c.payload.estado).toMatchObject({sessaoId:r.sessaoId,contexto:r.contexto});expect(c.payload.estado.dados).not.toHaveProperty('cur');
  const nova={...r,localVersion:'nova',dados:{exs:[{uid:'ex-1'}]}};await db.guardarRascunhoSessao('A',nova);
  await expect(db.enfileirar(novoComando('A',{tipo:'RASCUNHO_SESSAO',payload:{id:'ativa',expectedRevision:0,estado:{}}}),{chave:'rascunhoSessao',valor:r,esperado:r.localVersion})).rejects.toThrow();
  expect((await db.ler<RascunhoLocal>('A','rascunhoSessao'))?.localVersion).toBe('nova');expect(await db.listar('A')).toHaveLength(1);db.fechar();
 });
 it('autosave atrasado não ressuscita sessão encerrada, mesmo depois do ACK; nova sessão funciona',async()=>{
  const db=await OutboxDB.abrir('closed-draft'),r=parcial();await db.guardarRascunhoSessao('A',r);
  const c=novoComando('A',{tipo:'SESSAO',payload:{sessao:{id:r.sessaoId,n:1,dataISO:'2026-10-19',dia:'A',series:0,volumeKg:0,feedback:{},exercicios:[]}}});await db.enfileirar(c);
  expect(await db.guardarRascunhoSessao('A',r)).toBe(false);await db.confirmar('A',{tipo:'ACK',operationId:c.operationId});
  expect(await db.guardarRascunhoSessao('A',r)).toBe(false);expect(await rascunhoDisponivel(db,'A')).toBeUndefined();
  const nova=parcial('sessao-b');expect(await db.guardarRascunhoSessao('A',nova)).toBe(true);expect((await rascunhoDisponivel(db,'A'))?.sessaoId).toBe('sessao-b');db.fechar();
 });
 it.each([[401,'REAUTENTICAR'],[503,'INDISPONIVEL'],[426,'ATUALIZAR']])('%s pausa sem apagar e apresenta estado próprio',async(status,estado)=>{
  const db=await OutboxDB.abrir('auth-state-'+status);await db.enfileirar(novoComando('A',{tipo:'PESO',payload:{pesoKg:80,dataISO:'2026-10-19'}}));
  await drenarOutbox(db,'A',()=>true,async()=>resposta(Number(status),{}));expect(await db.ler('A','estadoSync')).toBe(estado);expect(await db.listar('A')).toHaveLength(1);db.fechar();
 });
 it('geração incompatível e ACK incompleto não eliminam a fila',async()=>{
  const db=await OutboxDB.abrir('bad-protocol'),c=novoComando('A',{tipo:'PESO',payload:{pesoKg:80,dataISO:'2026-10-19'}});await db.enfileirar(c);
  await drenarOutbox(db,'A',()=>true,async()=>resposta(200,{subject:'A',generation:'antiga'}));expect(await db.listar('A')).toHaveLength(1);
  await drenarOutbox(db,'A',()=>true,async(_u,i)=>resposta(200,i?.body?{tipo:'ACK',operationId:c.operationId,estado:'REGISTRADO',pesoKg:null}:{subject:'A',generation:STORAGE_GENERATION}));expect(await db.listar('A')).toHaveLength(1);db.fechar();
 });
 it('GET atrasado não rebaixa snapshot confirmado, inclusive entre transações de abas',async()=>{
  const db=await OutboxDB.abrir('snapshot-order');await db.guardarSnapshot('A',{revision:6,perfil:{idade:31}});
  expect(await db.guardarSnapshot('A',{revision:5,perfil:{idade:30}})).toEqual({revision:6,perfil:{idade:31}});
  await Promise.all([db.guardarSnapshot('A',{revision:8,perfil:{idade:33}}),db.guardarSnapshot('A',{revision:7,perfil:{idade:32}})]);
  expect((await db.ler<{revision:number}>('A','snapshot'))?.revision).toBe(8);expect(await db.ler('B','snapshot')).toBeUndefined();db.fechar();
 });

});
