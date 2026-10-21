import { vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { ClienteFixture, CONTA_A, abrirBancoSync } from './sync-fixture';
import { novoComando, cabecalhosSync, type ComandoSync } from '../src/lib/persistencia/sync-contrato';

const estadoFixture = vi.hoisted(() => ({ db: null as unknown as PGlite, user: '11111111-1111-4111-8111-111111111111', erroAuth: 0, contexto: null as null | { getStore: () => string | undefined } }));
vi.mock('server-only', () => ({}));
vi.mock('../src/lib/supabase/server', () => ({ createClient: async () => {
  const cliente = new ClienteFixture(estadoFixture.db,estadoFixture.contexto?.getStore() ?? estadoFixture.user);
  if (estadoFixture.erroAuth) cliente.auth.getUser = async () => ({ data: { user: null }, error: { status: estadoFixture.erroAuth } }) as never;
  return cliente;
} }));
vi.mock('../src/lib/supabase/admin', () => ({ createAdminClient: () => new ClienteFixture(estadoFixture.db,estadoFixture.contexto?.getStore() ?? estadoFixture.user,true) }));
export const fixture = estadoFixture;

export async function iniciarFixture() {
  fixture.db = await abrirBancoSync(); fixture.user = CONTA_A; fixture.erroAuth = 0;
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://fixture.invalid'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','fixture-public-placeholder');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','fixture-server-placeholder');
  return fixture.db;
}
export async function fecharFixture() { await fixture.db.close(); vi.unstubAllEnvs(); }
export function pedido(tipo: ComandoSync['tipo'], payload: unknown, subject = CONTA_A, operationId?: string) {
  const c = novoComando(subject,{ tipo, payload } as Parameters<typeof novoComando>[1]);
  if (operationId) c.operationId = operationId;
  return new NextRequest('http://localhost/api/dados/sync',{ method:'POST',headers:cabecalhosSync(subject),body:JSON.stringify(c) });
}
