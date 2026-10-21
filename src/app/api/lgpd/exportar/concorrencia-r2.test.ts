import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { fixture, iniciarFixture, fecharFixture, pedido } from '../../../../../test-support/sync-http-fixture';
import { CONTA_A, CONTA_B, ClienteFixture, limitarLinhasFixture, PERFIL_FIXTURE } from '../../../../../test-support/sync-fixture';
import { POST } from '../../dados/sync/route';
import { GET } from './route';
import { cabecalhosSync } from '@/lib/persistencia/sync-contrato';
import { registrarDesempenho } from '@/lib/persistencia/carga-estados';

beforeAll(iniciarFixture, 60000); afterAll(fecharFixture);
afterEach(() => { vi.restoreAllMocks(); limitarLinhasFixture(1000); });
const exportar = () => GET(new NextRequest('http://localhost/api/lgpd/exportar', { headers: cabecalhosSync(CONTA_A) }));
const sessao = (id: string, kg = 20, fb: 'facil' | 'dificil' = 'facil') => ({ id, n: 1, dataISO: '2026-10-19', dia: 'A', series: 1, volumeKg: kg * 10, feedback: { e: fb }, exercicios: [{ id: 'e', nome: 'Exercício', loaded: true, fb, sets: [{ reps: '10', kg: String(kg) }], desempenho: registrarDesempenho(id + ':e', [{ reps: '10', kg: String(kg), done: true }], fb) }] });

it('R2: correção durante leitura obriga nova coleta e 200 contém sessão e feedback compatíveis', async () => {
  const antes = sessao('r2-correcao'), depois = sessao('r2-correcao', 26, 'dificil');
  expect((await POST(pedido('SESSAO', { sessao: antes }))).status).toBe(200);
  let corrigiu = false, leituras = 0;
  const executar = ClienteFixture.prototype.executar;
  vi.spyOn(ClienteFixture.prototype, 'executar').mockImplementation(async function(this: ClienteFixture, sql: string, valores: unknown[] = []) {
    const r = await executar.call(this, sql, valores);
    if (sql.includes('ler_revisao_exportacao_sync_v2')) leituras++;
    if (sql.includes('from public."feedback"') && !corrigiu) {
      corrigiu = true;
      expect((await POST(pedido('SESSAO', { sessao: depois, substituirBase: antes }))).status).toBe(200);
    }
    return r;
  });
  const r = await exportar(), b = await r.json();
  expect(corrigiu).toBe(true); expect(leituras).toBe(4); expect(r.status).toBe(200);
  const log = b.logs.find((x: { payload: { id: string } }) => x.payload.id === depois.id);
  const fb = b.feedback.find((x: { payload: { sessaoId: string } }) => x.payload.sessaoId === depois.id);
  expect(log.payload.volumeKg).toBe(260); expect(fb.payload.feedback).toEqual(log.payload.feedback);
});

it('R2: mil linhas com teto 37 e inserção concorrente continuam completas, sem misturar dono', async () => {
  await fixture.db.query(`insert into public.logs(user_id,tipo,data,payload) select $1,'treino','2026-10-19',jsonb_build_object('id','r2-grande-'||n) from generate_series(1,1050) n`, [CONTA_A]);
  await fixture.db.query(`insert into public.logs(user_id,tipo,data,created_at,payload) values($1,'treino','2026-10-19','2030-01-01','{"id":"r2-relogio-adiantado"}')`, [CONTA_A]);
  limitarLinhasFixture(37);
  let inseriu = false;
  const executar = ClienteFixture.prototype.executar;
  vi.spyOn(ClienteFixture.prototype, 'executar').mockImplementation(async function(this: ClienteFixture, sql: string, valores: unknown[] = []) {
    const r = await executar.call(this, sql, valores);
    if (sql.includes('from public."feedback"') && !inseriu) {
      inseriu = true;
      await fixture.db.query(`insert into public.logs(user_id,tipo,data,payload) values($1,'treino','2026-10-19','{"id":"r2-inserida"}'),($2,'treino','2026-10-19','{"id":"NAO_EXPORTAR_B"}')`, [CONTA_A, CONTA_B]);
    }
    return r;
  });
  const r = await exportar(), b = await r.json(); expect(r.status).toBe(200);
  expect(b.logs.filter((x: { payload: { id: string } }) => x.payload.id?.startsWith('r2-grande-'))).toHaveLength(1050);
  expect(b.logs.some((x: { payload: { id: string } }) => x.payload.id === 'r2-inserida')).toBe(true);
  expect(b.logs.some((x: { payload: { id: string } }) => x.payload.id === 'r2-relogio-adiantado')).toBe(true);
  expect(JSON.stringify(b)).not.toContain('NAO_EXPORTAR_B');
});

it('R2: mudanças contínuas terminam em 503 sem exportação parcial', async () => {
  const executar = ClienteFixture.prototype.executar;
  vi.spyOn(ClienteFixture.prototype, 'executar').mockImplementation(async function(this: ClienteFixture, sql: string, valores: unknown[] = []) {
    const r = await executar.call(this, sql, valores);
    if (sql.includes('from public."feedback"')) await fixture.db.query(`insert into public.eventos(user_id,tipo,payload) values($1,'app_aberto','{}')`, [CONTA_A]);
    return r;
  });
  const r = await exportar(), b = await r.json(); expect(r.status).toBe(503);
  expect(b.error).toBe('exportacao_alterada_tente_novamente'); expect(b.logs).toBeUndefined(); expect(b.profile).toBeUndefined();
});

it('R2: escrita de B não invalida exportação A; contador/RPC não ficam públicos', async () => {
  let mudou = false, leituras = 0;
  const executar = ClienteFixture.prototype.executar;
  vi.spyOn(ClienteFixture.prototype, 'executar').mockImplementation(async function(this: ClienteFixture, sql: string, valores: unknown[] = []) {
    const r = await executar.call(this, sql, valores);
    if (sql.includes('ler_revisao_exportacao_sync_v2')) leituras++;
    if (sql.includes('from public."feedback"') && !mudou) { mudou = true; await fixture.db.query(`insert into public.logs(user_id,tipo,data,payload) values($1,'treino','2026-10-19','{"id":"outra-conta"}')`, [CONTA_B]); }
    return r;
  });
  expect((await exportar()).status).toBe(200); expect(leituras).toBe(2);
  const cliente = new ClienteFixture(fixture.db, CONTA_B);
  await expect(cliente.executar('select public.ler_revisao_exportacao_sync_v2($1)', [CONTA_A])).rejects.toThrow(/permission denied/);
  await expect(cliente.executar('select * from app_private.sync_export_revision')).rejects.toThrow(/permission denied/);
});

it('R3: predecessor entre preparo e RPC causa conflito; retry sobre a revisão nova conserva peso', async () => {
  expect((await POST(pedido('PERFIL', { perfil: PERFIL_FIXTURE, expectedRevision: 0 }))).status).toBe(200);
  const linha = (await fixture.db.query<{ revision: number; payload: { entrada: { perfil: typeof PERFIL_FIXTURE; opcoes: unknown } } }>('select revision,payload from public.plano_cas where user_id=$1', [CONTA_A])).rows[0]!;
  const base = { revision: linha.revision, perfil: linha.payload.entrada.perfil, entradaPlano: linha.payload.entrada.opcoes };
  let injetou = false;
  const executar = ClienteFixture.prototype.executar;
  vi.spyOn(ClienteFixture.prototype, 'executar').mockImplementation(async function(this: ClienteFixture, sql: string, valores: unknown[] = []) {
    if (sql.includes('executar_comando_sync_v2') && !injetou) {
      injetou = true;
      expect((await POST(pedido('PERFIL', { perfil: { ...base.perfil, pesoKg: 85 }, expectedRevision: base.revision, entradaPlano: base.entradaPlano, base }))).status).toBe(200);
    }
    return executar.call(this, sql, valores);
  });
  const r = await POST(pedido('PERFIL', { perfil: { ...base.perfil, idade: 31 }, expectedRevision: base.revision, entradaPlano: base.entradaPlano, base }));
  expect(r.status).toBe(409);
  const atual = (await fixture.db.query<{ revision: number; payload: { entrada: { perfil: typeof PERFIL_FIXTURE } } }>('select revision,payload from public.plano_cas where user_id=$1', [CONTA_A])).rows[0]!;
  expect(atual.payload.entrada.perfil.pesoKg).toBe(85);
  expect((await POST(pedido('PERFIL', { perfil: { ...atual.payload.entrada.perfil, idade: 31 }, expectedRevision: atual.revision, entradaPlano: base.entradaPlano, base: { ...base, revision: atual.revision, perfil: atual.payload.entrada.perfil } }))).status).toBe(200);
});

it('R2: falha na segunda página não produz arquivo parcial', async () => {
  limitarLinhasFixture(37); let paginas = 0;
  const executar = ClienteFixture.prototype.executar;
  vi.spyOn(ClienteFixture.prototype, 'executar').mockImplementation(async function(this: ClienteFixture, sql: string, valores: unknown[] = []) {
    if (sql.includes('from public."logs"') && ++paginas === 2) throw new Error('pagina_indisponivel');
    return executar.call(this, sql, valores);
  });
  const r = await exportar(), b = await r.json();
  expect(paginas).toBeGreaterThanOrEqual(2); expect(r.status).toBe(503);
  expect(b.secoes).toContain('logs'); expect(b.logs).toBeUndefined(); expect(b.feedback).toBeUndefined();
});

it('R2: rollback não avança revisão; cascata sintética não recria contador da conta removida', async () => {
  const revisao = async () => (await fixture.db.query<{ r: { revision: string } }>('select public.ler_revisao_exportacao_sync_v2($1) r', [CONTA_A])).rows[0]!.r.revision;
  const antes = await revisao();
  await expect(fixture.db.transaction(async tx => {
    await tx.query(`insert into public.logs(user_id,tipo,data,payload) values($1,'treino','2026-10-19','{"id":"revertida"}')`, [CONTA_A]);
    throw new Error('reverter');
  })).rejects.toThrow('reverter');
  expect(await revisao()).toBe(antes);
  await fixture.db.query('delete from auth.users where id=$1', [CONTA_B]);
  expect((await fixture.db.query('select * from app_private.sync_export_revision where user_id=$1', [CONTA_B])).rows).toHaveLength(0);
});
