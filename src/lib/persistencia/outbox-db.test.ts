import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { OutboxDB } from './outbox-db';
import { novoComando, STORAGE_GENERATION } from './sync-contrato';
import { drenarOutbox } from './outbox-sync';

const resposta = (status: number, v: unknown) => new Response(JSON.stringify(v), { status });
describe('IndexedDB e transporte', () => {
  it('persiste antes de enviar e sobrevive ao fechamento; ACK perdido reenvia o MESMO ID', async () => {
    let db = await OutboxDB.abrir('teste-reload');
    const c = novoComando('a', { tipo: 'PESO', payload: { pesoKg: 82, dataISO: '2026-10-19' } });
    await db.enfileirar(c, { chave: 'peso', valor: 82 }); db.fechar();
    db = await OutboxDB.abrir('teste-reload');
    expect(await db.ler('a', 'peso')).toBe(82);
    const enviados: string[] = [];
    const transporte = async (_: string, init?: RequestInit) => {
      if (!init?.body) return resposta(200, { subject: 'a', generation: STORAGE_GENERATION });
      enviados.push(JSON.parse(init.body as string).operationId);
      if (enviados.length === 1) throw new Error('ACK perdido');
      return resposta(200, { tipo: 'ACK', operationId: c.operationId, estado:'REGISTRADO',pesoKg:82 });
    };
    await expect(drenarOutbox(db, 'a', () => true, transporte)).rejects.toThrow('ACK perdido');
    expect((await db.listar('a')).length).toBe(1);
    await drenarOutbox(db, 'a', () => true, transporte);
    expect(enviados).toEqual([c.operationId, c.operationId]);
    expect(await db.listar('a')).toEqual([]); db.fechar();
  });
  it('não drena conta A com cookie B ou durante indisponibilidade, e não apaga os dados', async () => {
    const db = await OutboxDB.abrir('teste-contas');
    const c = novoComando('a', { tipo: 'PESO', payload: { pesoKg: 82, dataISO: '2026-10-19' } });
    await db.enfileirar(c);
    for (const r of [resposta(401, {}), resposta(503, {}), resposta(200, { subject: 'b', generation: STORAGE_GENERATION })]) {
      let chamadas = 0;
      await drenarOutbox(db, 'a', () => true, async () => { chamadas++; return r; });
      expect(chamadas).toBe(1);
      expect((await db.listar('a')).length).toBe(1);
    }
    expect(await db.listar('b')).toEqual([]);
    await expect(db.confirmar('b', { tipo: 'ACK', operationId: c.operationId, estado:'REGISTRADO',pesoKg:82 })).rejects.toThrow();
    db.fechar();
  });
  it('comando incerto não pode ser reescrito; conflito confirmado pode receber novo ID', async () => {
    const db = await OutboxDB.abrir('teste-conflito');
    const c = novoComando('a', { tipo: 'PESO', payload: { pesoKg: 82, dataISO: '2026-10-19' } });
    await db.enfileirar(c);
    await expect(db.resolver('a', c.operationId)).rejects.toThrow();
    await db.confirmar('a', { tipo: 'CONFLITO', operationId: c.operationId, motivo: 'teste' });
    const novo = novoComando('a', { tipo: 'PESO', payload: { pesoKg: 83, dataISO: '2026-10-19' } });
    await db.resolver('a', c.operationId, novo);
    const pendentes = await db.listar('a');
    expect(pendentes.find((i) => i.comando.operationId === c.operationId)?.substituidoPor).toBe(novo.operationId);
    expect(pendentes.find((i) => i.comando.operationId === novo.operationId)).toBeTruthy();
    await db.confirmar('a', { tipo: 'ACK', operationId: novo.operationId });
    expect(await db.listar('a')).toEqual([]); db.fechar();
  });
});
