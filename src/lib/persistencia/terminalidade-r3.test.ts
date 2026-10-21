import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { OutboxDB } from './outbox-db';
import { rascunhoDisponivel, capturarRascunho, type RascunhoLocal } from './rascunho-sessao';
import { novoComando } from './sync-contrato';

const abertos: OutboxDB[] = [];
const r = (id = 's', revision = 1): RascunhoLocal => ({ schemaVersion: 1, origem: 'manual', chave: 'manual', sessaoId: id, localVersion: 'v', dirty: true, baseRevision: revision, dados: { exs: [{ nome: 'preservado' }] } });
const final = (id = 's') => novoComando('A', { tipo: 'SESSAO', payload: { sessao: { id, n: 1, dataISO: '2026-10-19', dia: 'A', series: 1, volumeKg: 10, feedback: {}, exercicios: [] } } });
const parcial = (id = 's') => novoComando('A', { tipo: 'RASCUNHO_SESSAO', payload: { id: 'ativa', expectedRevision: 1, estado: { sessaoId: id, dados: { valor: 1 } } } });
async function abrir(projeto = crypto.randomUUID()) { const db = await OutboxDB.abrir(projeto); abertos.push(db); return db; }
afterEach(() => { abertos.splice(0).forEach(db => db.fechar()); vi.restoreAllMocks(); });

it.each(['antes', 'depois'])('R1b: GET %s do ACK nunca reabre S sem rascunho local', async ordem => {
  const db = await abrir(), c = final(); await db.enfileirar(c);
  if (ordem === 'antes') await db.guardarRascunhoRemoto('A', { revision: 1, estado: r() });
  await db.confirmar('A', { tipo: 'ACK', operationId: c.operationId });
  if (ordem === 'depois') await db.guardarRascunhoRemoto('A', { revision: 1, estado: r() });
  expect(await db.ler('A', 'rascunhoSessao')).toBeUndefined();
  expect(await rascunhoDisponivel(db, 'A')).toBeUndefined();
  expect(await db.ler('A', 'sessaoEncerrada:s')).toBe(true);
});
it('token de GET antigo, inclusive null, não substitui edição posterior de outra sessão', async () => {
  const db = await abrir(), token = (await db.lerRascunhosSessao('A')).geracao;
  await db.guardarRascunhoSessao('A', r('nova'));
  expect(await db.guardarRascunhoRemoto('A', null, token)).toBeUndefined();
  expect(await db.guardarRascunhoRemoto('A', { revision: 2, estado: r('antiga') }, token)).toBeUndefined();
  expect(await rascunhoDisponivel(db, 'A')).toMatchObject({ sessaoId: 'nova', dirty: true });
});
it('escolha remota capturada antes de edição local perde CAS e preserva a edição', async () => {
  const db = await abrir(); await db.guardarRascunhoSessao('A', r());
  const token = (await db.lerRascunhosSessao('A')).geracao;
  await db.guardarRascunhoSessao('A', { ...r(), localVersion: 'nova', dados: { obs: 'edição posterior' } });
  expect(await db.guardarRascunhoSessao('A', r('remota'), token)).toBe(false);
  expect(await db.encerrarSessao('A', 's', token)).toBe(false);
  expect(await rascunhoDisponivel(db, 'A')).toMatchObject({ dados: { obs: 'edição posterior' } });
});
it('ACK de S não elimina local/remoto de T; replay do ACK também preserva T', async () => {
  const db = await abrir(), c = final(); await db.enfileirar(c);
  await db.guardarRascunhoSessao('A', r('t')); await db.guardarRascunhoRemoto('A', { revision: 2, estado: r('t') });
  const ack = { tipo: 'ACK' as const, operationId: c.operationId };
  await db.confirmar('A', ack); await db.confirmar('A', ack);
  expect(await rascunhoDisponivel(db, 'A')).toMatchObject({ sessaoId: 't' });
  expect((await db.lerRascunhosSessao('A')).remoto?.estado.sessaoId).toBe('t');
});
it('ACK parcial fora de ordem não reduz revisão; ACK terminal prevalece sobre todos', async () => {
  const db = await abrir(); await db.guardarRascunhoSessao('A', r('s', 5));
  const p = parcial(); await db.enfileirar(p);
  await db.confirmar('A', { tipo: 'ACK', operationId: p.operationId, revision: 2 });
  expect((await db.lerRascunhosSessao('A')).local?.baseRevision).toBe(5);
  const p2 = parcial(); await db.enfileirar(p2); const c = final(); await db.enfileirar(c);
  await db.confirmar('A', { tipo: 'ACK', operationId: c.operationId });
  await db.confirmar('A', { tipo: 'ACK', operationId: p2.operationId, revision: 7 });
  expect(await rascunhoDisponivel(db, 'A')).toBeUndefined();
});
it('recusa CAS de substituição terminal preserva o conflito e seu conteúdo para conferência', async () => {
  const db = await abrir(), p = parcial(); await db.enfileirar(p);
  await db.confirmar('A', { tipo: 'CONFLITO', operationId: p.operationId, motivo: 'teste' });
  await db.encerrarSessao('A', 's');
  expect(await db.resolver('A', p.operationId, parcial())).toBe(false);
  const fila = await db.listar('A'); expect(fila).toHaveLength(1);
  expect(fila[0]).toMatchObject({ comando: { operationId: p.operationId, payload: p.payload }, recibo: { tipo: 'CONFLITO' } });
});
it('marcador não aceita falso; escritor genérico e captura não contornam terminalidade', async () => {
  const db = await abrir(); await db.encerrarSessao('A', 's');
  await expect(db.guardar('A', 'sessaoEncerrada:s', false)).rejects.toThrow();
  await db.guardar('A', 'rascunhoSessao', r()); await db.guardar('A', 'rascunhoRemoto', { revision: 50, estado: r() });
  await capturarRascunho(db, 'A'); expect(await rascunhoDisponivel(db, 'A')).toBeUndefined(); expect(await db.listar('A')).toEqual([]);
  await db.guardar('B', 'rascunhoSessao', r()); expect(await rascunhoDisponivel(db, 'B')).toMatchObject({ sessaoId: 's' });
});
it('encerramento comprovado preserva payload sujo fechado; reload mantém terminalidade', async () => {
  const projeto = crypto.randomUUID(), db = await abrir(projeto); await db.guardarRascunhoSessao('A', r());
  await db.encerrarSessao('A', 's');
  const novaAba = await abrir(projeto);
  expect((await novaAba.lerRascunhosSessao('A')).local).toMatchObject({ encerrado: true, dirty: false, dados: r().dados });
  expect(await rascunhoDisponivel(novaAba, 'A')).toBeUndefined();
});
it('quota lançada dentro do callback reverte marcador, rascunho e geração juntos', async () => {
  const db = await abrir(); await db.guardarRascunhoSessao('A', r()); const antes = await db.lerRascunhosSessao('A');
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (key === 'A:rascunhoSessao') throw new DOMException('quota sintética', 'QuotaExceededError');
    return put.call(this, value, key);
  });
  await expect(db.encerrarSessao('A', 's')).rejects.toThrow(); vi.restoreAllMocks();
  expect(await db.lerRascunhosSessao('A')).toEqual(antes); expect(await db.ler('A', 'sessaoEncerrada:s')).toBeUndefined();
});
it('duas adesões offline preservam intenções e a base do último payload na mesma transação', async () => {
  const db = await abrir();
  for (const logs of [{ cafe: 'seguiu' }, { almoco: 'parcial' }]) await db.enfileirar(novoComando('A', { tipo: 'ADERENCIA', payload: { dia: '2026-10-19', logs, notes: {}, base: { logs: {}, notes: {} } } }));
  expect(await db.ler('A', 'aderenciaBase')).toEqual({ '2026-10-19': { logs: { almoco: 'parcial' }, notes: {} } });
  const fila = await db.listar('A'); expect(fila).toHaveLength(2);
  expect(fila[0]?.comando.payload).toMatchObject({ logs: { cafe: 'seguiu' } });
  expect(fila[1]?.comando.payload).toMatchObject({ logs: { almoco: 'parcial' } });
});
