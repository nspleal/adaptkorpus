/**
 * 🔴 R4 (revisão conjunta peso × registro, 2026-09-11) — REGRESSÃO DO COMPORTAMENTO CORRETO.
 *
 * O defeito: `registrarPesoServidor` fazia `Number(corpo?.pesoKg)` e aceitava o resultado
 * quando `Number.isFinite`. `Number(null)` é `0` e `0` é finito — então a resposta 409
 * `{ estado: 'RECUSADO_DIA', pesoKg: null }` voltava como `{ tipo: 'RECUSADO_DIA',
 * pesoKg: 0 }`, e o consumidor escrevia esse zero na série e no perfil.
 *
 * A reprodução original AFIRMAVA o defeito (`pesoKg: 0`). Aqui ela é a afirmação do certo:
 * `pesoKg: null` — ausência continua ausência.
 *
 * Guard em quatro pernas:
 *  ① a reprodução exata, invertida;
 *  ② tipo e domínio ANTES da conversão (null, vazio, string, NaN, 0, fora da faixa);
 *  ③ peso desconhecido não modifica perfil nem histórico;
 *  ④ falhas de rede/backend continuam `FALHA`, e o domínio é fonte única.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PESO_MAX_KG, PESO_MIN_KG, noDominioDoPeso, pesoKgDaResposta } from '../lib/peso-dominio';
import { reconciliarPerfilComPesoAceito } from '../lib/peso-reconciliacao';

vi.mock('../lib/supabase/env', () => ({ supabaseConfigurado: () => true }));
const { registrarPesoServidor } = await import('../lib/persistencia/sync');

const HOJE = '2026-09-11';
const CONTA = 'user-a';
afterEach(() => vi.unstubAllGlobals());

const responde = (corpo: unknown, status: number) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status })));

describe('🔴 R4 ① — recusa sem peso legível volta como desconhecido, não zero', () => {
  it('409 com `pesoKg: null` → `{ tipo: RECUSADO_DIA, pesoKg: null }`', async () => {
    responde({ estado: 'RECUSADO_DIA', pesoKg: null }, 409);
    expect(await registrarPesoServidor(80, HOJE)).toEqual({ tipo: 'RECUSADO_DIA', pesoKg: null });
  });

  it('409 com peso legítimo continua chegando (o guard não é um "sempre null")', async () => {
    responde({ estado: 'RECUSADO_DIA', pesoKg: 79.5 }, 409);
    expect(await registrarPesoServidor(80, HOJE)).toEqual({ tipo: 'RECUSADO_DIA', pesoKg: 79.5 });
  });

  it('corpo ilegível num 409 não inventa número', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nao é json', { status: 409 })));
    expect(await registrarPesoServidor(80, HOJE)).toEqual({ tipo: 'RECUSADO_DIA', pesoKg: null });
  });
});

describe('🔴 R4 ② — tipo e domínio antes da conversão', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string vazia', ''],
    ['string numérica', '81'],
    ['string qualquer', 'oitenta'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['zero', 0],
    ['negativo', -80],
    ['abaixo do mínimo', PESO_MIN_KG - 0.1],
    ['acima do máximo', PESO_MAX_KG + 0.1],
    ['objeto', { kg: 80 }],
    ['array', [80]],
    ['booleano', true],
  ])('%s não é peso', (_rotulo, valor) => {
    expect(pesoKgDaResposta(valor)).toBeNull();
  });

  it.each([PESO_MIN_KG, 63, 63.4, 68, 80.25, PESO_MAX_KG])('%s kg é peso', (v) => {
    expect(pesoKgDaResposta(v)).toBe(v);
    expect(noDominioDoPeso(v)).toBe(true);
  });

  it.each([
    ['null', null],
    ['string vazia', ''],
    ['zero', 0],
    ['fora da faixa', 1000],
  ])('409 com %s nunca produz um número', async (_rotulo, valor) => {
    responde({ estado: 'RECUSADO_DIA', pesoKg: valor }, 409);
    const r = await registrarPesoServidor(80, HOJE);
    expect(r).toEqual({ tipo: 'RECUSADO_DIA', pesoKg: null });
  });

  it('IDEMPOTENTE sem peso legível cai no peso ENVIADO, nunca em zero', async () => {
    for (const invalido of [null, '', 0, 'abc']) {
      responde({ ok: true, estado: 'IDEMPOTENTE', pesoKg: invalido }, 200);
      expect(await registrarPesoServidor(81, HOJE)).toEqual({ tipo: 'IDEMPOTENTE', pesoKg: 81 });
    }
  });

  it('IDEMPOTENTE com peso legível usa o do servidor', async () => {
    responde({ ok: true, estado: 'IDEMPOTENTE', pesoKg: 81 }, 200);
    expect(await registrarPesoServidor(81, HOJE)).toEqual({ tipo: 'IDEMPOTENTE', pesoKg: 81 });
  });
});

describe('🔴 R4 ③ — peso desconhecido não modifica perfil nem histórico', () => {
  const reconciliar = (pesoAceito: unknown) =>
    reconciliarPerfilComPesoAceito({ pesoKg: 81, nome: 'n' }, {
      pesoAceito,
      diaDaResposta: HOJE,
      diaGovernante: HOJE,
      montado: true,
      contaDaChamada: CONTA,
      contaAgora: CONTA,
    });

  it.each([null, undefined, '', 0, -1, 'abc', 29, 301])('peso %s não toca o perfil', (v) => {
    expect(reconciliar(v)).toEqual({ perfil: null, motivo: 'FORA_DO_DOMINIO' });
  });

  it('zero é rejeitado como valor, não tratado como "peso 0 kg"', () => {
    const r = reconciliar(0);
    expect(r.perfil).toBeNull();
    expect(r.motivo).toBe('FORA_DO_DOMINIO');
  });

  it('o Painel só alinha série/perfil quando o peso aceito existe', async () => {
    const { readFileSync } = await import('node:fs');
    const fonte = readFileSync('src/components/painel/Painel.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(fonte).toContain('if (aceito == null) return;');
    expect(fonte).toContain("r.pesoKg == null");
  });
});

describe('🔴 R4 ④ — falhas continuam falhas e o domínio é fonte única', () => {
  it('rede caída → FALHA (o registro local segue pendente)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await registrarPesoServidor(80, HOJE)).toEqual({ tipo: 'FALHA' });
  });

  it('500 → FALHA, não recusa', async () => {
    responde({ error: 'falha_gravacao' }, 500);
    expect(await registrarPesoServidor(80, HOJE)).toEqual({ tipo: 'FALHA' });
  });

  it('400 (entrada inválida) → FALHA, e nenhum peso é devolvido', async () => {
    responde({ error: 'entrada inválida' }, 400);
    expect(await registrarPesoServidor(10, HOJE)).toEqual({ tipo: 'FALHA' });
  });

  it('201 sem estado → REGISTRADO', async () => {
    responde({ ok: true, estado: 'REGISTRADO' }, 200);
    expect(await registrarPesoServidor(80, HOJE)).toEqual({ tipo: 'REGISTRADO' });
  });

  it('a faixa 30–300 não está mais redigitada em três arquivos', async () => {
    const { readFileSync } = await import('node:fs');
    for (const arq of ['src/app/api/dados/peso/route.ts', 'src/components/painel/Painel.tsx', 'src/lib/persistencia/sync.ts']) {
      const fonte = readFileSync(arq, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(/<\s*30\b|>\s*300\b/.test(fonte), `${arq}: limite de peso redigitado`).toBe(false);
    }
    expect([PESO_MIN_KG, PESO_MAX_KG]).toEqual([30, 300]);
  });
});
