import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixture, iniciarFixture, fecharFixture, pedido } from '../../../../../test-support/sync-http-fixture';
import { CONTA_A, CONTA_B, ClienteFixture, PERFIL_FIXTURE, limitarLinhasFixture } from '../../../../../test-support/sync-fixture';
import { POST, GET } from './route';
import { GET as perfilGET, PUT as perfilLegado } from '../perfil/route';
import { GET as historicoGET, POST as historicoLegado } from '../historico/route';
import { GET as exportarGET } from '../../lgpd/exportar/route';
import { NextRequest } from 'next/server';
import { cabecalhosSync } from '@/lib/persistencia/sync-contrato';
import { registrarDesempenho } from '@/lib/persistencia/carga-estados';

const req = (url: string, subject=CONTA_A) => new NextRequest(`http://localhost${url}`,{ headers:cabecalhosSync(subject) });
const ler = async () => (await perfilGET(req('/api/dados/perfil'))).json();
const post = async (tipo: Parameters<typeof pedido>[0], payload: unknown) => { const r=await POST(pedido(tipo,payload)); return { status:r.status, body:await r.json() }; };
beforeAll(iniciarFixture,30_000); afterAll(fecharFixture);
describe('browser/API → validação real → transação Postgres sintética → ACK', () => {
  it('autentica, rejeita protocolo antigo e vínculo de outra conta antes do writer', async () => {
    expect((await GET(new NextRequest('http://localhost/api/dados/sync'))).status).toBe(426);
    expect((await POST(pedido('PESO',{pesoKg:80,dataISO:'2026-10-19'},CONTA_B))).status).toBe(409);
    fixture.erroAuth=503; expect((await GET(req('/api/dados/sync'))).status).toBe(503);
    fixture.erroAuth=401; expect((await GET(req('/api/dados/sync'))).status).toBe(401);
    fixture.erroAuth=0; expect((await GET(req('/api/dados/sync'))).status).toBe(200);
    expect((await perfilLegado(pedido('PERFIL',{}))).status).toBe(426);
    expect((await historicoLegado(pedido('SESSAO',{}))).status).toBe(426);
  });
  it('primeiro cadastro e no-op preservam consentimentos e não acrescentam plans', async () => {
    expect((await perfilGET(req('/api/dados/perfil'))).status).toBe(404);
    const primeiro=await post('PERFIL',{perfil:PERFIL_FIXTURE,expectedRevision:0,consentimentos:{aceite18:true,aceiteTermos:true,aceiteLgpd:true}});
    expect(primeiro).toMatchObject({status:200,body:{tipo:'ACK',revision:1}});
    const atual=await ler();
    const igual=await post('PERFIL',{perfil:atual.perfil,entradaPlano:atual.entradaPlano,expectedRevision:1,base:atual});
    expect(igual).toMatchObject({status:200,body:{tipo:'ACK',revision:1,semMudanca:true}});
    expect((await fixture.db.query<{ n:number }>('select count(*)::integer n from plans')).rows[0]!.n).toBe(0);
    expect((await fixture.db.query('select aceite_18,aceite_lgpd from profile')).rows[0]).toMatchObject({aceite_18:true,aceite_lgpd:true});
  });
  it('duas aplicações concorrentes, resolução com novo ID e retry de ACK não giram duas vezes', async () => {
    const base=await ler(), id=crypto.randomUUID();
    const body={perfil:{...base.perfil,tempoPorSessaoMin:65},entradaPlano:base.entradaPlano,expectedRevision:base.revision,base};
    const a=await POST(pedido('APLICAR_TREINO',body,CONTA_A,id)); const ack=await a.json();
    expect(a.status).toBe(200);
    expect(await (await POST(pedido('APLICAR_TREINO',body,CONTA_A,id))).json()).toEqual(ack);
    expect((await post('APLICAR_TREINO',{...body,perfil:{...body.perfil,tempoPorSessaoMin:70}})).body.tipo).toBe('CONFLITO');
    const novo=await ler();
    expect(novo.versoesTreino.anterior.definicao.tempoPorSessaoMin).toBe(60);
    expect((await post('APLICAR_TREINO',{perfil:{...novo.perfil,tempoPorSessaoMin:70},entradaPlano:novo.entradaPlano,expectedRevision:novo.revision,base:novo})).status).toBe(200);
    const ultimo=await ler(); expect(ultimo.versoesTreino.atual.definicao.tempoPorSessaoMin).toBe(70);
    expect(ultimo.versoesTreino.anterior.definicao.tempoPorSessaoMin).toBe(65);
  });
  it('mescla campos independentes na borda, inclusive se a revisão foi avançada por dependência', async () => {
    const base=await ler();
    expect((await post('PERFIL',{perfil:{...base.perfil,idade:31},expectedRevision:base.revision,entradaPlano:base.entradaPlano,base})).status).toBe(200);
    const novo=await ler();
    // A UI ainda vê idade 30; somente altura foi alterada. expectedRevision sozinho não prova conteúdo-base.
    expect((await post('PERFIL',{perfil:{...base.perfil,alturaCm:181},expectedRevision:novo.revision,entradaPlano:base.entradaPlano,base})).status).toBe(200);
    expect((await ler()).perfil).toMatchObject({idade:31,alturaCm:181});
  });
  it('Desfazer captura o alvo e preserva peso/ciclo atuais; alvo obsoleto não é redirecionado', async () => {
    const antes=await ler(), alvo=antes.versoesTreino.anterior.id;
    await post('PERFIL',{perfil:{...antes.perfil,pesoKg:82,mesocicloInicio:'2026-10-18'},expectedRevision:antes.revision,entradaPlano:antes.entradaPlano,base:antes});
    const atual=await ler();
    const undo=await post('DESFAZER_TREINO',{perfil:antes.perfil,expectedRevision:atual.revision,alvoId:alvo});
    expect(undo.status).toBe(200);
    expect((await ler()).perfil).toMatchObject({pesoKg:82,mesocicloInicio:'2026-10-18',tempoPorSessaoMin:65});
    const depois=await ler();
    expect((await post('DESFAZER_TREINO',{perfil:depois.perfil,expectedRevision:depois.revision,alvoId:alvo})).body).toMatchObject({tipo:'CONFLITO',motivo:'alvo_desfazer_mudou'});
  });
  it('sessão realizada tem identidade própria e correção explícita é CAS, com feedback atômico', async () => {
    const sets=[{reps:'10',kg:'20',done:true}];
    const sessao={id:'s-api',n:1,dataISO:'2026-10-19',dia:'A',series:1,volumeKg:200,feedback:{e1:'facil'},exercicios:[{id:'e1',nome:'Exercício',loaded:true,fb:'facil',sets:[{reps:'10',kg:'20'}],desempenho:registrarDesempenho('t-1',sets,'facil')}]};
    expect((await post('SESSAO',{sessao})).status).toBe(200);
    expect((await post('SESSAO',{sessao})).status).toBe(200);
    const outra={...sessao,obs:'Correção confirmada'};
    expect((await post('SESSAO',{sessao:outra})).body.tipo).toBe('CONFLITO');
    expect((await post('SESSAO',{sessao:outra,substituirBase:sessao})).status).toBe(200);
    expect((await post('SESSAO',{sessao:{...outra,obs:'Outra alteração'},substituirBase:sessao})).body.tipo).toBe('CONFLITO');
    expect((await fixture.db.query<{ n:number }>("select count(*)::integer n from logs where tipo='treino'")).rows[0]!.n).toBe(1);
    expect((await fixture.db.query<{ n:number }>('select count(*)::integer n from feedback')).rows[0]!.n).toBe(1);
  });
  it('valida declaração de execução, tamanho e data impossível antes do banco', async () => {
    expect((await post('PESO',{pesoKg:80,dataISO:'2026-02-30'})).status).toBe(422);
    expect((await post('SESSAO',{sessao:{id:'sem-declaracao',n:1,dataISO:'2026-10-19',exercicios:[{id:'e1',sets:[{kg:'26',reps:'10'}],fb:'facil'}]}})).status).toBe(422);
    const grande=pedido('RASCUNHO_SESSAO',{id:'ativa',expectedRevision:0,estado:{texto:'x'.repeat(140*1024)}});
    expect((await POST(grande)).status).toBe(413);
  });
  it('RLS isola contas, browser não lê recibo privado e RPCs invoker anteriores continuam funcionais', async () => {
    const b=new ClienteFixture(fixture.db,CONTA_B);
    expect((await b.executar('select * from public.profile')).rows).toEqual([]);
    await expect(b.executar('select * from app_private.sync_recibos')).rejects.toThrow(/permission denied/);
    await expect(b.executar("select public.executar_comando_sync_v2($1,null,$2,$3,'PESO',$4,null,null)",[CONTA_B,crypto.randomUUID(),'a'.repeat(64),JSON.stringify({pesoKg:80,dataISO:'2026-10-19'})])).rejects.toThrow(/permission denied/);
    const peso=await b.executar("select * from public.registrar_peso_dia('2026-10-19',70)"); expect(peso.rows[0]).toMatchObject({inserido:true});
    await b.executar("select public.registrar_aderencia_dia('2026-10-19',$1)",[JSON.stringify({logs:{cafe:'seguiu'},notes:{}})]);
  });
  it('mais de mil registros são paginados e exportados sem truncar; CAS e rascunho entram no export', async () => {
    await fixture.db.exec(`insert into logs(user_id,tipo,data,payload) select '${CONTA_A}','treino','2026-10-18',jsonb_build_object('id','longo-'||n,'n',n,'dataISO','2026-10-18','exercicios','[]'::jsonb) from generate_series(1,1001)n`);
    limitarLinhasFixture(37);
    let cursor: string|null=null,total=0; const vistos=new Set<string>();
    do { const p=await (await historicoGET(req('/api/dados/historico'+(cursor?'?cursor='+encodeURIComponent(cursor):'')))).json(); expect(p.error,cursor ? Buffer.from(cursor,'base64url').toString('utf8') : 'primeira página').toBeUndefined(); total+=p.sessoes.length; for(const s of p.sessoes) {expect(vistos.has(s.id)).toBe(false);vistos.add(s.id);} cursor=p.nextCursor; } while(cursor);
    expect(total).toBe(1002);
    const e=await exportarGET(req('/api/lgpd/exportar')); const j=await e.json(); expect(e.status,JSON.stringify({error:j.error,secoes:j.secoes})).toBe(200);
    expect(j.logs.filter((l:{tipo:string})=>l.tipo==='treino')).toHaveLength(total); expect(j.plano_cas).toBeTruthy(); expect(Object.hasOwn(j,'rascunho')).toBe(true); expect(j.recibos.length).toBeGreaterThan(0); limitarLinhasFixture(1000);
  });
  it('100 autosaves sem mudança preservam duas definições; mede bytes sintéticos sem alegar capacidade',async()=>{
    const linha=(await fixture.db.query<{revision:number;payload:Record<string,unknown>;formula_version:string;canonical_input_hash:string}>('select revision,payload,formula_version,canonical_input_hash from plano_cas where user_id=$1',[CONTA_A])).rows[0]!;
    const antes=(await fixture.db.query<{n:number}>('select count(*)::int n from app_private.sync_recibos where user_id=$1',[CONTA_A])).rows[0]!.n;
    const preparado={agregado:linha.payload,formulaVersion:linha.formula_version,canonicalInputHash:linha.canonical_input_hash};
    const inicio=performance.now();
    for(let i=0;i<100;i++){
      const r=await fixture.db.query<{r:{tipo:string;revision:number;semMudanca:boolean}}> ('select public.executar_comando_sync_v2($1,null,$2,$3,$4,$5,$6,null) r',[CONTA_A,crypto.randomUUID(),'a'.repeat(64),'PERFIL',JSON.stringify({expectedRevision:linha.revision}),JSON.stringify(preparado)]);
      expect(r.rows[0]!.r).toMatchObject({tipo:'ACK',revision:linha.revision,semMudanca:true});
    }
    const metricas=(await fixture.db.query<Record<string,unknown>>(
      "select (select count(*)::int from plans where user_id=$1) snapshots,(select count(*)::int from app_private.sync_recibos where user_id=$1) recibos,octet_length(payload::text) agregado_json_bytes,pg_column_size(payload) agregado_armazenado_bytes,(select avg(pg_column_size(r))::int from app_private.sync_recibos r where user_id=$1) recibo_linha_medio_bytes from plano_cas where user_id=$1",[CONTA_A])).rows[0]!;
    const versoes=(linha.payload.armazenamento as {versoesTreino:Record<string,unknown>}).versoesTreino;
    expect(Object.keys(versoes).sort()).toEqual(['anterior','atual']);expect(metricas.snapshots).toBe(0);expect(Number(metricas.recibos)-antes).toBe(100);
    const medicao={tipo:'SINTETICA_LOCAL_SEM_DADOS_REAIS',noops:100,definicoesCompletas:Object.keys(versoes).length,duracaoLoteMs:Math.round(performance.now()-inicio),...metricas,limite:'Postgres WASM local sem rede; não é benchmark de 10 mil usuários nem média real; bytes de linha não incluem índices/TOAST/replicação/backups.'};
    if(process.env.ADAPT_SYNC_EVIDENCIA){const {writeFileSync}=await import('node:fs');writeFileSync(process.env.ADAPT_SYNC_EVIDENCIA,JSON.stringify(medicao,null,2));}
  });

  it('falha durante rotação reverte perfil, CAS, definições e recibo; mesmo ID pode concluir depois',async()=>{
    const antes=await ler(),id=crypto.randomUUID();
    const corpo={perfil:{...antes.perfil,idade:32,tempoPorSessaoMin:45},entradaPlano:antes.entradaPlano,expectedRevision:antes.revision,base:antes};
    const contar=async()=> (await fixture.db.query<{n:number}>('select count(*)::int n from app_private.sync_recibos where user_id=$1',[CONTA_A])).rows[0]!.n;
    const n=await contar();await fixture.db.exec('alter table public.profile add constraint fixture_falha_rotacao check(idade<>32)');
    try{
      const r=await POST(pedido('APLICAR_TREINO',corpo,CONTA_A,id));expect(r.status).toBe(503);
      expect(await ler()).toEqual(antes);expect(await contar()).toBe(n);
    }finally{await fixture.db.exec('alter table public.profile drop constraint fixture_falha_rotacao');}
    const retry=await POST(pedido('APLICAR_TREINO',corpo,CONTA_A,id));expect(retry.status).toBe(200);
    expect((await ler()).revision).toBe(antes.revision+1);expect(await contar()).toBe(n+1);
  });

  it('pausa de escrita preserva fatos e recibos; leitura continua e retry do mesmo ID retoma',async()=>{
    const id=crypto.randomUUID(),r=pedido('PESO',{pesoKg:81,dataISO:'2026-10-17'},CONTA_A,id);
    const antes=(await fixture.db.query<{n:number}>('select count(*)::int n from app_private.sync_recibos')).rows[0]!.n;
    const {vi}=await import('vitest');vi.stubEnv('EVK_SYNC_PAUSA_ESCRITAS','1');
    try{const recusada=await POST(r);expect(recusada.status).toBe(503);expect((await GET(req('/api/dados/sync'))).status).toBe(200);expect((await fixture.db.query<{n:number}>('select count(*)::int n from app_private.sync_recibos')).rows[0]!.n).toBe(antes);}
    finally{vi.stubEnv('EVK_SYNC_PAUSA_ESCRITAS','');}
    expect((await POST(pedido('PESO',{pesoKg:81,dataISO:'2026-10-17'},CONTA_A,id))).status).toBe(200);
  });

  it('exporta mais de mil recibos sem limite implícito e não inclui outra conta; RPC não é pública',async()=>{
    const antes=(await fixture.db.query<{n:number}>('select count(*)::int n from app_private.sync_recibos where user_id=$1',[CONTA_A])).rows[0]!.n;
    await fixture.db.query("insert into app_private.sync_recibos(user_id,operation_id,command_hash,resultado,created_at) select $1,id,repeat('a',64),jsonb_build_object('tipo','ACK','operationId',id),'2026-10-18'::timestamptz from (select gen_random_uuid() id from generate_series(1,1001)) s",[CONTA_A]);
    await fixture.db.query("insert into app_private.sync_recibos(user_id,operation_id,command_hash,resultado) values($1,gen_random_uuid(),repeat('b',64),'{\"sentinelaB\":true}'::jsonb)",[CONTA_B]);
    const r=await exportarGET(req('/api/lgpd/exportar'));expect(r.status).toBe(200);const j=await r.json();expect(j.recibos).toHaveLength(antes+1001);expect(JSON.stringify(j)).not.toContain('sentinelaB');
    const b=new ClienteFixture(fixture.db,CONTA_B);await expect(b.executar('select public.exportar_recibos_sync_v2($1,null,now())',[CONTA_A])).rejects.toThrow(/permission denied/);
  });

  it('escolha isolada pode ser rascunho, mas não vira sessão encerrada; parcial exige séries reais',async()=>{
    const escolha=registrarDesempenho('escolha-26',[{reps:'',kg:'26',done:false}],null,false,22);
    const ex={id:'e9',nome:'Supino',loaded:true,fb:null,sets:[],desempenho:escolha};
    const sessao={id:'so-escolha',n:2,dataISO:'2026-10-19',dia:'A',series:0,volumeKg:0,feedback:{},exercicios:[ex]};
    const antes=(await fixture.db.query<{n:number}>("select count(*)::int n from logs where tipo='treino'")).rows[0]!.n;
    expect((await post('SESSAO',{sessao})).status).toBe(422);
    expect((await post('SESSAO',{sessao:{...sessao,id:'vazia',exercicios:[]}})).status).toBe(422);
    const parcial=registrarDesempenho('parcial',[{reps:'10',kg:'26',done:true},{reps:'',kg:'26',done:false}],null);
    expect((await post('SESSAO',{sessao:{...sessao,id:'parcial-sem-serie',exercicios:[{...ex,desempenho:parcial}]}})).status).toBe(422);
    expect((await fixture.db.query<{n:number}>("select count(*)::int n from logs where tipo='treino'")).rows[0]!.n).toBe(antes);
    const falha=registrarDesempenho('falha',[{reps:'',kg:'26',done:false,falhou:true}],'dificil');
    expect((await post('SESSAO',{sessao:{...sessao,id:'feedback-divergente',feedback:{e9:'facil'},exercicios:[{...ex,fb:'dificil',desempenho:falha}]}})).status).toBe(422);
    expect((await post('SESSAO',{sessao:{...sessao,id:'tentativa-falha',feedback:{e9:'dificil'},exercicios:[{...ex,fb:'dificil',desempenho:falha}]}})).status).toBe(200);
  });

});
