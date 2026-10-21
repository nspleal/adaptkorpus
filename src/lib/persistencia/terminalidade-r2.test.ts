import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { OutboxDB } from './outbox-db';
import { capturarRascunho, rascunhoDisponivel, type RascunhoLocal } from './rascunho-sessao';
import { novoComando } from './sync-contrato';

const abertos: OutboxDB[] = [];
async function abrir(projeto = crypto.randomUUID()) {
  const db = await OutboxDB.abrir(projeto); abertos.push(db); return db;
}
const rascunho = (id = 's'): RascunhoLocal => ({ schemaVersion: 1, origem: 'manual', chave: 'manual', sessaoId: id, localVersion: 'v', dirty: true, baseRevision: 0, dados: { exs: [] } });
const sessao = (id = 's') => ({ id, n: 1, dataISO: '2026-10-19', dia: 'Cardio', series: 0, volumeKg: 0, feedback: {}, tipo: 'cardio' as const, exercicios: [] });
afterEach(() => { abertos.splice(0).forEach(db => db.fechar()); vi.restoreAllMocks(); });

it('R1: captura suspensa não apaga terminalidade quando outro executor encerra', async () => {
  const projeto = crypto.randomUUID(), a = await abrir(projeto), b = await abrir(projeto);
  await a.guardarRascunhoSessao('A', rascunho());
  let liberar!: () => void;
  const gate = new Promise<void>(r => { liberar = r; });
  const original = a.enfileirar.bind(a);
  const spy = vi.spyOn(a, 'enfileirar').mockImplementation(async (c, e) => { await gate; return original(c, e); });
  const captura = capturarRascunho(a, 'A');
  await vi.waitFor(() => expect(spy).toHaveBeenCalledOnce());
  await b.enfileirar(novoComando('A', { tipo: 'SESSAO', payload: { sessao: sessao() } }));
  liberar(); await captura;
  expect((await a.listar('A')).map(i => i.comando.tipo)).toEqual(['SESSAO']);
  expect(await a.ler('A', 'rascunhoSessao')).toMatchObject({ encerrado: true, dirty: false });
  expect(await a.guardarRascunhoSessao('A', rascunho())).toBe(false);
  expect(await a.guardarRascunhoSessao('A', rascunho('nova'))).toBe(true);
  await capturarRascunho(a, 'A');
  expect((await b.listar('A')).at(-1)?.comando.tipo).toBe('RASCUNHO_SESSAO');
});

it('R1: captura primeiro, encerramento depois e ACK atrasado não reativam o rascunho', async () => {
  const db = await abrir();
  await db.guardarRascunhoSessao('A', rascunho()); await capturarRascunho(db, 'A');
  const parcial = (await db.listar('A'))[0]!.comando;
  await db.enfileirar(novoComando('A', { tipo: 'SESSAO', payload: { sessao: sessao() } }));
  await db.confirmar('A', { tipo: 'ACK', operationId: parcial.operationId, revision: 1 });
  await capturarRascunho(db, 'A');
  expect(await db.ler('A', 'rascunhoSessao')).toMatchObject({ encerrado: true, dirty: false });
  expect((await db.listar('A')).map(i => i.comando.tipo)).toEqual(['SESSAO']);
  await db.guardar('A', 'rascunhoRemoto', { revision: 1, estado: rascunho('nova-remota') });
  expect(await rascunhoDisponivel(db, 'A')).toMatchObject({ sessaoId: 'nova-remota' });
});

it('R1: versão local substituída durante captura não sobrescreve a nova edição', async () => {
  const db = await abrir(); await db.guardarRascunhoSessao('A', rascunho());
  const antigo = rascunho();
  await db.guardarRascunhoSessao('A', { ...antigo, localVersion: 'nova', dados: { valor: 2 } });
  await expect(db.enfileirar(novoComando('A', { tipo: 'RASCUNHO_SESSAO', payload: { id: 'ativa', expectedRevision: 0, estado: { sessaoId: 's' } } }), { chave: 'rascunhoSessao', valor: antigo, esperado: 'v' })).rejects.toThrow();
  expect(await db.listar('A')).toEqual([]);
  expect(await db.ler('A', 'rascunhoSessao')).toMatchObject({ localVersion: 'nova', dirty: true });
});

it('R6: dez reloads e dois executores preservam uma intenção; ACK perdido mantém seu ID', async () => {
  const projeto = crypto.randomUUID(), a = await abrir(projeto), b = await abrir(projeto);
  const enviar = (db: OutboxDB, owner = 'A') => db.enfileirar(novoComando(owner, { tipo: 'SESSAO', payload: { sessao: sessao() } }));
  const comandos = await Promise.all(Array.from({ length: 10 }, (_, i) => enviar(i % 2 ? a : b)));
  const id = comandos[0]!.operationId;
  expect(new Set(comandos.map(c => c!.operationId)).size).toBe(1);
  expect(await a.listar('A')).toHaveLength(1);
  expect((await enviar(b))!.operationId).toBe(id);
  await a.confirmar('A', { tipo: 'ACK', operationId: id, revision: 0 });
  expect((await enviar(b))!.operationId).toBe(id);
  expect(await b.listar('A')).toHaveLength(0);
  await b.enfileirar(novoComando('A', { tipo: 'SESSAO', payload: { sessao: { ...sessao(), n: 2 }, substituirBase: sessao() } }));
  expect(await a.listar('A')).toHaveLength(1);
  await enviar(a, 'B'); expect(await b.listar('B')).toHaveLength(1);
});

it('R5: add que lança aborta sem confirmar comando, estado ou contador', async () => {
  const db = await abrir();
  const add = IDBObjectStore.prototype.add;
  const spy = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function(this: IDBObjectStore, valor: unknown, chave?: IDBValidKey) {
    if (this.name === 'fila') { this.transaction.abort(); throw new DOMException('Quota sintética', 'QuotaExceededError'); }
    return add.call(this, valor, chave);
  });
  await expect(db.enfileirar(novoComando('A', { tipo: 'SESSAO', payload: { sessao: sessao() } }))).rejects.toThrow();
  spy.mockRestore();
  expect(await db.listar('A')).toHaveLength(0);
  expect(await db.ler('A', 'sequencia')).toBeUndefined();
  expect(await db.ler('A', 'sessaoEncerrada:s')).toBeUndefined();
});
