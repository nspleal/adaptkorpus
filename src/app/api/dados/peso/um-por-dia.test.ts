import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fixture, iniciarFixture, fecharFixture, pedido } from '../../../../../test-support/sync-http-fixture';
import { CONTA_A } from '../../../../../test-support/sync-fixture';
import { POST } from '../sync/route';
import { POST as legado } from './route';

beforeAll(iniciarFixture,30_000); afterAll(fecharFixture);
beforeEach(async()=>{ await fixture.db.exec('truncate logs, app_private.sync_recibos cascade'); });
const gravar=async(pesoKg:unknown,dataISO:unknown='2026-09-11')=>{ const r=await POST(pedido('PESO',{pesoKg,dataISO}));return {status:r.status,body:await r.json()}; };
const linhas=async()=> (await fixture.db.query<{data:string;payload:Record<string,unknown>}>('select data::text,payload from logs where user_id=$1 and tipo=\'peso\'',[CONTA_A])).rows;

describe('peso por dia — contrato v2, API e SQL reais em fixture',()=>{
  it('primeiro registro é aceito e o writer legado está bloqueado',async()=>{
    expect((await gravar(80))).toMatchObject({status:200,body:{tipo:'ACK',estado:'REGISTRADO',pesoKg:80}});
    expect((await legado(pedido('PESO',{pesoKg:74,dataISO:'2026-09-11'}))).status).toBe(426);
    expect(await linhas()).toHaveLength(1);
  });
  it('segundo valor diferente é recusado e preserva o primeiro',async()=>{
    await gravar(80);expect((await gravar(74))).toMatchObject({status:422,body:{tipo:'RECUSADO',motivo:'peso_ja_registrado_hoje',pesoKg:80}});
    expect((await linhas())[0]!.payload).toMatchObject({pesoKg:80});
  });
  it('retry idêntico é idempotente e não duplica',async()=>{
    await gravar(80);expect((await gravar(80))).toMatchObject({status:200,body:{tipo:'ACK',estado:'IDEMPOTENTE',pesoKg:80}});expect(await linhas()).toHaveLength(1);
  });
  it('concorrentes arbitram uma única linha no banco',async()=>{
    const r=await Promise.all([gravar(80),gravar(74)]);expect(r.map(x=>x.status).sort()).toEqual([200,422]);expect(await linhas()).toHaveLength(1);
  });
  it('dia seguinte é novo registro',async()=>{await gravar(80);await gravar(79.4,'2026-09-12');expect(await linhas()).toHaveLength(2);});
  it('dia civil do cliente chega ao banco inclusive UTC+13',async()=>{
    const dia=new Date(Date.now()+86_400_000).toISOString().slice(0,10);expect((await gravar(80,dia)).status).toBe(200);expect(String((await linhas())[0]!.data)).toContain(dia);
  });
  it('data ausente, impossível ou inválida é recusada, sem redatar offline como hoje',async()=>{
    for(const dia of [undefined,'11/09/2026','2026-02-30'])expect((await gravar(80,dia===undefined?null:dia)).status).toBe(422);expect(await linhas()).toHaveLength(0);
  });
  it('tipo e domínio inválidos não chegam aos logs',async()=>{for(const p of [12,'80',null,301])expect((await gravar(p)).status).toBe(422);expect(await linhas()).toHaveLength(0);});
  it('falha transacional não produz ACK nem escrita parcial',async()=>{
    await fixture.db.exec("create function pg_temp.falha_peso() returns trigger language plpgsql as $$ begin raise exception 'fixture_fault'; end $$; create trigger fixture_fault before insert on logs for each row execute function pg_temp.falha_peso()");
    try{expect((await gravar(80))).toMatchObject({status:503,body:{error:'falha_atomica'}});expect(await linhas()).toHaveLength(0);expect((await fixture.db.query('select * from app_private.sync_recibos')).rows).toHaveLength(0);}
    finally{await fixture.db.exec('drop trigger fixture_fault on logs');}
  });
});
