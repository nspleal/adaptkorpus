/** R4 preservado no protocolo v2: ausência nunca vira zero; resposta incompleta não é ACK.
 * A rota antiga 409 foi aposentada. A arbitragem real do peso/dia está em um-por-dia.test.ts. */
import {afterEach,describe,expect,it,vi} from 'vitest';
import {PESO_MIN_KG,PESO_MAX_KG,noDominioDoPeso,pesoKgDaResposta} from '../lib/peso-dominio';
import {reconciliarPerfilComPesoAceito} from '../lib/peso-reconciliacao';
import {novoComando,type ReciboSync} from '../lib/persistencia/sync-contrato';
import {validarReciboSync} from '../lib/persistencia/recibo-sync';
const controle=vi.hoisted(()=>({recibo:undefined as ReciboSync|undefined,falha:false}));
vi.mock('../lib/supabase/env',()=>({supabaseConfigurado:()=>true}));
vi.mock('../lib/escopo-local',()=>({escopoLocal:()=> 'user-a'}));
vi.mock('../lib/persistencia/sync-cliente',()=>({
 bancoSync:async()=>({listar:async()=>[],ler:async()=>undefined}),
 enfileirarOperacao:async()=>{if(controle.falha)throw Error('storage');return {comando:{operationId:'operacao'},recibo:controle.recibo};},
 lerSnapshotRemoto:vi.fn(),sincronizarConta:vi.fn(),
}));
import {registrarPesoServidor} from '../lib/persistencia/sync';
const HOJE='2026-09-11',CONTA='user-a';
const c=novoComando(CONTA,{tipo:'PESO',payload:{pesoKg:80,dataISO:HOJE}});
afterEach(()=>{controle.recibo=undefined;controle.falha=false;vi.unstubAllGlobals();});
const invalidos=[null,undefined,'','81','oitenta',NaN,Infinity,0,-80,PESO_MIN_KG-0.1,PESO_MAX_KG+0.1,{},[80],true];
describe('R4 — tipo e domínio antes da conversão',()=>{
 it.each(invalidos)('%j não é peso',v=>{expect(pesoKgDaResposta(v)).toBeNull();});
 it.each([PESO_MIN_KG,63,63.4,68,80.25,PESO_MAX_KG])('%s kg continua sendo peso',v=>{expect(pesoKgDaResposta(v)).toBe(v);expect(noDominioDoPeso(v)).toBe(true);});
 it.each(invalidos)('recusa com %j mantém desconhecido',async v=>{
   const r=validarReciboSync(c,{tipo:'RECUSADO',operationId:c.operationId,motivo:'peso_ja_registrado_hoje',pesoKg:v});
   expect(r?.tipo).toBe('RECUSADO');expect(pesoKgDaResposta(r?.tipo === 'RECUSADO' ? r.pesoKg : undefined)).toBeNull();
   controle.recibo=r!;expect(await registrarPesoServidor(80,HOJE)).toEqual({tipo:'RECUSADO_DIA',pesoKg:null});
 });
 it('recusa com peso legível preserva o valor do servidor',async()=>{
   controle.recibo=validarReciboSync(c,{tipo:'RECUSADO',operationId:c.operationId,motivo:'peso_ja_registrado_hoje',pesoKg:79.5})!;
   expect(await registrarPesoServidor(80,HOJE)).toEqual({tipo:'RECUSADO_DIA',pesoKg:79.5});
 });
 it.each([null,'',0,'abc'])('ACK idempotente sem peso legível (%j) não comprova commit',v=>{
   expect(validarReciboSync(c,{tipo:'ACK',operationId:c.operationId,estado:'IDEMPOTENTE',pesoKg:v})).toBeNull();
 });
 it('IDEMPOTENTE válido usa o peso do servidor e não duplica',async()=>{
   controle.recibo=validarReciboSync(c,{tipo:'ACK',operationId:c.operationId,estado:'IDEMPOTENTE',pesoKg:81})!;
   expect(await registrarPesoServidor(81,HOJE)).toEqual({tipo:'IDEMPOTENTE',pesoKg:81});
 });
 it('corpo ilegível, outro ID ou ausência de estado não inventam sucesso',()=>{
   for(const r of ['não é json',null,{tipo:'ACK',operationId:'outro',pesoKg:80,estado:'REGISTRADO'},{tipo:'ACK',operationId:c.operationId,pesoKg:80}])expect(validarReciboSync(c,r)).toBeNull();
 });
});
describe('R4 — desconhecido não modifica perfil nem histórico',()=>{
 it.each([null,undefined,'',0,-1,'abc',29,301])('peso %j não toca o perfil',v=>{
   expect(reconciliarPerfilComPesoAceito({pesoKg:81,nome:'n'},{pesoAceito:v,diaDaResposta:HOJE,diaGovernante:HOJE,montado:true,contaDaChamada:CONTA,contaAgora:CONTA})).toEqual({perfil:null,motivo:'FORA_DO_DOMINIO'});
 });
 it('consumidor exige valor aceito legível antes de alterar perfil/série',async()=>{
   const {readFileSync}=await import('node:fs');const s=readFileSync('src/components/painel/Painel.tsx','utf8');
   const guard=s.indexOf('if (aceito == null)');expect(guard).toBeGreaterThan(-1);expect(s.indexOf('const serie =',guard)).toBeGreaterThan(guard);expect(s).toContain('r.pesoKg == null');
 });
});
describe('R4 — falha local, pendência de transporte e ACK são estados distintos',()=>{
 it('falha do armazenamento é FALHA, sem inventar peso',async()=>{controle.falha=true;expect(await registrarPesoServidor(80,HOJE)).toEqual({tipo:'FALHA'});});
 it('rede/5xx sem ACK preservam o comando como PENDENTE',async()=>{expect(await registrarPesoServidor(80,HOJE)).toEqual({tipo:'PENDENTE'});});
 it('ACK registrado exige estado e peso legíveis',async()=>{controle.recibo=validarReciboSync(c,{tipo:'ACK',operationId:c.operationId,estado:'REGISTRADO',pesoKg:80})!;expect(await registrarPesoServidor(80,HOJE)).toEqual({tipo:'REGISTRADO'});});
 it('domínio continua sendo fonte única',async()=>{const {readFileSync}=await import('node:fs');for(const p of ['src/lib/persistencia/recibo-sync.ts','src/lib/persistencia/sync.ts','src/components/painel/Painel.tsx'])expect(readFileSync(p,'utf8')).not.toMatch(/<\s*30\b|>\s*300\b/);expect([PESO_MIN_KG,PESO_MAX_KG]).toEqual([30,300]);});
});
