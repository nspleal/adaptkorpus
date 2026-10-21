import 'fake-indexeddb/auto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { iniciarFixture, fecharFixture, fixture } from '../../../../../test-support/sync-http-fixture';
import { CONTA_A } from '../../../../../test-support/sync-fixture';
import { OutboxDB } from '@/lib/persistencia/outbox-db';
import { novoComando, cabecalhosSync } from '@/lib/persistencia/sync-contrato';
import { drenarOutbox } from '@/lib/persistencia/outbox-sync';
import { GET, POST } from './route';
beforeAll(iniciarFixture, 60000); afterAll(fecharFixture);

it('R6: dez reloads, ACK perdido e novo envio geram um fato e um recibo; sessão distinta continua válida', async () => {
  const db = await OutboxDB.abrir('r2-retry-integrado');
  const sessao = { id: 'r2-cardio', n: 1, dataISO: '2026-10-19', dia: 'Cardio', tipo: 'cardio' as const, series: 0, volumeKg: 0, feedback: {}, exercicios: [], cardio: { modalidade: 'caminhada', intensidade: 'moderado', minutos: 30, met: 3.5, kcal: 100 } };
  const enfileirar = () => db.enfileirar(novoComando(CONTA_A, { tipo: 'SESSAO', payload: { sessao } }));
  try {
    const inicial = (await enfileirar())!;
    for (let i = 0; i < 10; i++) expect((await enfileirar())!.operationId).toBe(inicial.operationId);
    let perder = true;
    const transporte = async (_url: string, init?: RequestInit) => {
      const req = new NextRequest('http://localhost/api/dados/sync', { method: init?.body ? 'POST' : 'GET', headers: cabecalhosSync(CONTA_A), ...(init?.body ? { body: String(init.body) } : {}) });
      const r = init?.body ? await POST(req) : await GET(req);
      if (init?.body && perder) { perder = false; throw new Error('ACK_perdido'); }
      return r;
    };
    await expect(drenarOutbox(db, CONTA_A, () => true, transporte)).rejects.toThrow('ACK_perdido');
    for (let i = 0; i < 10; i++) expect((await enfileirar())!.operationId).toBe(inicial.operationId);
    expect(await db.listar(CONTA_A)).toHaveLength(1);
    await drenarOutbox(db, CONTA_A, () => true, transporte);
    expect(await db.listar(CONTA_A)).toHaveLength(0);
    expect((await enfileirar())!.operationId).toBe(inicial.operationId);
    expect(await db.listar(CONTA_A)).toHaveLength(0);
    expect((await fixture.db.query("select id from public.logs where user_id=$1 and tipo='treino'", [CONTA_A])).rows).toHaveLength(1);
    expect((await fixture.db.query('select operation_id from app_private.sync_recibos where user_id=$1', [CONTA_A])).rows).toHaveLength(1);
    await db.enfileirar(novoComando(CONTA_A, { tipo: 'SESSAO', payload: { sessao: { ...sessao, id: 'r2-legitima', n: 2 } } }));
    await drenarOutbox(db, CONTA_A, () => true, transporte);
    expect((await fixture.db.query("select id from public.logs where user_id=$1 and tipo='treino'", [CONTA_A])).rows).toHaveLength(2);
  } finally { db.fechar(); }
});
