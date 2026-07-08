import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { carregarHistoricoServidor, carregarPerfilServidor, enviarSessaoTreino } from './sync';
import type { SessaoHistorico } from '@/lib/treino-historico';

/**
 * Fix bloqueador 2026-07-08 (cofre outputs/bug-persistencia-e-avatar):
 *  - retry ÚNICO em 401 (corrida de rotação do refresh-token no boot);
 *  - `carregarPerfilServidor` tri-estado: perfil | 'sem_perfil' (404) | null (falha) —
 *    só 'sem_perfil' autoriza o boot a migrar o perfil local p/ o servidor.
 */

const SESSAO: SessaoHistorico = { dia: 'Treino', series: 1, volumeKg: 0, feedback: {}, exercicios: [], n: 1, dataISO: '2026-07-08' };

function resposta(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('sync — retry em 401 + tri-estado do perfil', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://exemplo.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_teste');
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('401 na 1ª ida → UMA nova tentativa; 200 na 2ª → sucesso (leitura e escrita)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resposta(401, { error: 'nao_autenticado' }))
      .mockResolvedValueOnce(resposta(200, { sessoes: [SESSAO] }));
    vi.stubGlobal('fetch', fetchMock);
    const p = carregarHistoricoServidor();
    await vi.runAllTimersAsync();
    expect(await p).toEqual([SESSAO]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const fetchMock2 = vi.fn()
      .mockResolvedValueOnce(resposta(401))
      .mockResolvedValueOnce(resposta(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock2);
    const e = enviarSessaoTreino(SESSAO);
    await vi.runAllTimersAsync();
    expect(await e).toBe(true);
    expect(fetchMock2).toHaveBeenCalledTimes(2);
  });

  it('401 persistente → null/false (sem loop); a hidratação trata null como "não mexe no local"', async () => {
    const fetchMock = vi.fn().mockResolvedValue(resposta(401));
    vi.stubGlobal('fetch', fetchMock);
    const p = carregarHistoricoServidor();
    await vi.runAllTimersAsync();
    expect(await p).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2); // exatamente 1 retry

    const e = enviarSessaoTreino(SESSAO);
    await vi.runAllTimersAsync();
    expect(await e).toBe(false);
  });

  it('carregarPerfilServidor: 200 → perfil; 404 → sem_perfil; 500/erro de rede → null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(200, { perfil: { idade: 30 } })));
    expect(await carregarPerfilServidor()).toEqual({ idade: 30 });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(404, { error: 'sem_perfil' })));
    expect(await carregarPerfilServidor()).toBe('sem_perfil');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(500, { error: 'x' })));
    expect(await carregarPerfilServidor()).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede')));
    expect(await carregarPerfilServidor()).toBeNull();
  });

  it('sem backend configurado (mock) tudo é no-op: null/false sem tocar o fetch', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await carregarHistoricoServidor()).toBeNull();
    expect(await carregarPerfilServidor()).toBeNull();
    expect(await enviarSessaoTreino(SESSAO)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
