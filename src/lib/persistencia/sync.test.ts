import 'fake-indexeddb/auto';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { carregarHistoricoServidor,carregarPerfilServidor,enviarSessaoTreino,salvarPerfilServidor } from './sync';
import { definirEscopoLocal } from '../escopo-local';
import { bancoSync } from './sync-cliente';
import { STORAGE_GENERATION } from './sync-contrato';
import type { SessaoHistorico } from '../treino-historico';
const A='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const S: SessaoHistorico={id:'sessao-1',n:1,dataISO:'2026-10-19',dia:'A',series:1,volumeKg:0,feedback:{},exercicios:[]};
const resposta=(status:number,body:unknown={})=>new Response(JSON.stringify(body),{status});
beforeEach(async()=>{vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://fixture.invalid');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','placeholder');definirEscopoLocal(A);await (await bancoSync()).apagarConta(A);vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});});
afterEach(()=>{definirEscopoLocal(null);vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers();});
describe('sync v2 — leitura por dono, fila durável e confirmação tipada',()=>{
  it('401 transitório na leitura tem um retry; escrita exige validação da identidade e ACK',async()=>{
    const f=vi.fn().mockResolvedValueOnce(resposta(401)).mockResolvedValueOnce(resposta(200,{sessoes:[S]}));vi.stubGlobal('fetch',f);
    const p=carregarHistoricoServidor();await vi.runAllTimersAsync();expect(await p).toEqual([S]);expect(f).toHaveBeenCalledTimes(2);
    const w=vi.fn(async(_url:string,init?:RequestInit)=>init?.body?resposta(200,{tipo:'ACK',operationId:JSON.parse(String(init.body)).operationId}):resposta(200,{subject:A,generation:STORAGE_GENERATION}));
    vi.stubGlobal('fetch',w);expect(await enviarSessaoTreino(S)).toBe(true);expect(w.mock.calls.filter(c=>c[1]?.body)).toHaveLength(1);
  });
  it('401 persistente pausa e preserva o comando sem loop nem exclusão',async()=>{
    const f=vi.fn().mockImplementation(()=>Promise.resolve(resposta(401)));vi.stubGlobal('fetch',f);
    const p=carregarHistoricoServidor();await vi.runAllTimersAsync();expect(await p).toBeNull();expect(f).toHaveBeenCalledTimes(2);
    expect(await enviarSessaoTreino(S)).toBe(false);expect(await (await bancoSync()).listar(A)).toHaveLength(1);
  });
  it('perfil distingue 200, 404 sem perfil e falha de rede/500',async()=>{
    for(const [status,body,expected]of [[200,{perfil:{idade:30},revision:4},{perfil:{idade:30},revision:4}],[404,{},'sem_perfil'],[500,{},null]] as const){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(resposta(status,body)));expect(await carregarPerfilServidor()).toEqual(expected);}
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('rede')));expect(await carregarPerfilServidor()).toBeNull();
  });
  it('save diferencia ACK, conflito, pendência de rede e falha local',async()=>{
    const entrada={pesoEfetivoKg:80,diasOferecidosCardio:[],semanaCiclo:{semana:1,feedbackGrupos:[]},escolhasExecucao:[]} as never;
    let modo='ACK';vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
      if(url==='/api/dados/perfil')return resposta(200,{perfil:{idade:30},revision:2,entradaPlano:entrada});
      if(!init?.body)return resposta(200,{subject:A,generation:STORAGE_GENERATION});
      const id=JSON.parse(String(init.body)).operationId;return modo==='ACK'?resposta(200,{tipo:'ACK',operationId:id,revision:2}):resposta(409,{tipo:'CONFLITO',operationId:id,motivo:'revisao',revision:7});
    }));
    expect(await salvarPerfilServidor({idade:30} as never,1,entrada)).toEqual({tipo:'CONFIRMADO',revision:2,entradaPlano:entrada});
    modo='CONFLITO';expect(await salvarPerfilServidor({idade:30} as never,1,entrada)).toEqual({tipo:'CONFLITO_REVISAO',revisaoAtual:7});
    await (await bancoSync()).apagarConta(A);vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
    expect(await salvarPerfilServidor({idade:30} as never,1,entrada)).toEqual({tipo:'PENDENTE'});
  });
  it('sem backend é no-op, sem tocar fetch nem importar legado',async()=>{vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','');const f=vi.fn();vi.stubGlobal('fetch',f);expect(await carregarHistoricoServidor()).toBeNull();expect(await carregarPerfilServidor()).toBeNull();expect(await enviarSessaoTreino(S)).toBe(false);expect(f).not.toHaveBeenCalled();});
  it('falha de página posterior não retorna histórico parcial e cursor repetido não dá loop',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(resposta(200,{sessoes:[S],nextCursor:'pagina2'})).mockResolvedValueOnce(resposta(503)));
    expect(await carregarHistoricoServidor()).toBeNull();
    const f=vi.fn().mockImplementation(()=>Promise.resolve(resposta(200,{sessoes:[S],nextCursor:'repetido'})));vi.stubGlobal('fetch',f);expect(await carregarHistoricoServidor()).toBeNull();expect(f).toHaveBeenCalledTimes(2);
  });
  it('primeiro cadastro só retorna depois de persistir perfil e consentimentos na outbox',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve(resposta(503))));
    const consent={aceite18:true,aceiteTermos:true,aceiteLgpd:true};
    expect(await salvarPerfilServidor({idade:30} as never,0,undefined,consent,{aguardarConfirmacao:false})).toEqual({tipo:'PENDENTE'});
    const fila=await (await bancoSync()).listar(A);expect(fila).toHaveLength(1);expect(fila[0]!.comando).toMatchObject({subject:A,tipo:'PERFIL',payload:{consentimentos:consent}});
  });

});
