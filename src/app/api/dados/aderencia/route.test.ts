import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture, iniciarFixture, fecharFixture, pedido } from '../../../../../test-support/sync-http-fixture';
import { CONTA_A,CONTA_B } from '../../../../../test-support/sync-fixture';
import { POST } from '../sync/route';
import { PUT } from './route';

beforeAll(iniciarFixture,30_000);afterAll(fecharFixture);
beforeEach(async()=>{fixture.erroAuth=0;await fixture.db.exec('truncate logs, app_private.sync_recibos cascade');});
const vazio={logs:{},notes:{}};
const gravar=async(payload:unknown)=>{const r=await POST(pedido('ADERENCIA',payload));return {status:r.status,body:await r.json()};};
const p=(logs:Record<string,string>={cafe:'seguiu'},notes:Record<string,string>={},base:unknown=vazio)=>({dia:'2026-09-10',logs,notes,base});
const linhas=async()=> (await fixture.db.query<{user_id:string;payload:Record<string,unknown>}>('select user_id,payload from logs where tipo=\'refeicao\'')).rows;
async function falhar(){await fixture.db.exec("create or replace function pg_temp.falha_aderencia() returns trigger language plpgsql as $$ begin raise exception 'segredo-fixture'; end $$; create trigger fixture_fault before insert or update on logs for each row execute function pg_temp.falha_aderencia()");}

describe('aderência — protocolo v2 com transação real e conflito parcial',()=>{
  it('grava no contrato v2 e o PUT legado não escreve',async()=>{expect((await gravar(p())).status).toBe(200);expect((await PUT(pedido('ADERENCIA',p()))).status).toBe(426);expect(await linhas()).toHaveLength(1);});
  it('a identidade vem da sessão validada, nunca user_id do corpo',async()=>{
    await gravar({...p(),user_id:CONTA_B});expect((await linhas())[0]!.user_id).toBe(CONTA_A);
    expect((await POST(pedido('ADERENCIA',p(),CONTA_B))).status).toBe(409);expect(await linhas()).toHaveLength(1);
  });
  it('falha da transação devolve erro explícito e nenhum recibo de sucesso',async()=>{
    await falhar();try{expect(await gravar(p())).toEqual({status:503,body:{error:'falha_atomica'}});expect(await linhas()).toHaveLength(0);expect((await fixture.db.query('select * from app_private.sync_recibos')).rows).toHaveLength(0);}finally{await fixture.db.exec('drop trigger fixture_fault on logs');}
  });
  it('entrada inválida é recusada antes do banco',async()=>{expect((await gravar({...p(),dia:'10/09/2026'})).status).toBe(422);expect((await gravar(p({cafe:'inventado'}))).status).toBe(422);expect(await linhas()).toHaveLength(0);});
  it('campos independentes mesclam; o mesmo campo divergente pergunta sem perder nota',async()=>{
    await gravar(p({cafe:'seguiu'},{cafe:'nota'}));expect((await gravar(p({almoco:'fora'}))).status).toBe(200);
    expect((await gravar(p({cafe:'fora'}))).body).toMatchObject({tipo:'CONFLITO'});
    expect((await linhas())[0]!.payload).toMatchObject({logs:{cafe:'seguiu',almoco:'fora'},notes:{cafe:'nota'}});
  });
  it('falha não vaza exceção e retry do MESMO ID conclui uma vez',async()=>{
    const id=crypto.randomUUID();await falhar();try{const r=await POST(pedido('ADERENCIA',p(),CONTA_A,id));expect(r.status).toBe(503);expect(await r.text()).not.toContain('segredo-fixture');}finally{await fixture.db.exec('drop trigger fixture_fault on logs');}
    expect((await POST(pedido('ADERENCIA',p(),CONTA_A,id))).status).toBe(200);expect((await POST(pedido('ADERENCIA',p(),CONTA_A,id))).status).toBe(200);expect(await linhas()).toHaveLength(1);
  });
  it('401 e 503 de autenticação são distintos e não gravam nem alegam exclusão',async()=>{
    for(const status of [401,503]){fixture.erroAuth=status;const r=await gravar(p());expect(r.status).toBe(status);expect(JSON.stringify(r.body)).not.toMatch(/exclu|segredo/);}fixture.erroAuth=0;expect(await linhas()).toHaveLength(0);
  });
  it('sucesso não emite logs pessoais',async()=>{const spy=vi.spyOn(console,'error');try{expect((await gravar(p())).status).toBe(200);expect(spy).not.toHaveBeenCalled();}finally{spy.mockRestore();}});
});
