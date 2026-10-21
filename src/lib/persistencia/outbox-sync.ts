import type { OutboxDB } from './outbox-db';
import { validarReciboSync } from './recibo-sync';
import { cabecalhosSync, entidadeComando, STORAGE_GENERATION } from './sync-contrato';
export type TransporteSync = (url: string, init?: RequestInit) => Promise<Response>;
export type EstadoAutenticacaoSync = 'VALIDADA' | 'REAUTENTICAR' | 'INDISPONIVEL' | 'CONTA_MUDOU' | 'ATUALIZAR';
function estadoDaResposta(status: number): EstadoAutenticacaoSync {
    return status === 401 || status === 403 ? 'REAUTENTICAR' : status === 409 ? 'CONTA_MUDOU' : status === 426 ? 'ATUALIZAR' : 'INDISPONIVEL';
}
export async function consultarIdentidadeSync(subject: string, transporte: TransporteSync = fetch, aoEstado?: (v: EstadoAutenticacaoSync) => Promise<void>): Promise<{
    subject: string;
    generation: string;
    rascunho?: unknown;
} | null> {
    let r: Response;
    try {
        r = await transporte('/api/dados/sync', { headers: cabecalhosSync(subject), cache: 'no-store', signal: AbortSignal.timeout(10000) });
    }
    catch (e) {
        await aoEstado?.('INDISPONIVEL');
        throw e;
    }
    if (!r.ok) {
        await aoEstado?.(estadoDaResposta(r.status));
        return null;
    }
    const j = await r.json() as {
        subject: string;
        generation: string;
        rascunho?: unknown;
    };
    if (j.subject !== subject) {
        await aoEstado?.('CONTA_MUDOU');
        return null;
    }
    if (j.generation !== STORAGE_GENERATION) {
        await aoEstado?.('ATUALIZAR');
        return null;
    }
    await aoEstado?.('VALIDADA');
    return j;
}
/** Sem getSession como prova de validade. Cada drenagem valida getUser no servidor e
 * cada mutação repete o vínculo do subject. 401/403/rede pausam; nunca apagam a conta. */
export async function drenarOutbox(db: OutboxDB, subject: string, ativo: () => boolean, transporte: TransporteSync = fetch): Promise<void> {
    if (!ativo())
        return;
    const headers = cabecalhosSync(subject);
    const aoEstado = (v: EstadoAutenticacaoSync) => ativo() ? db.guardar(subject, 'estadoSync', v) : Promise.resolve();
    const geracao = (await db.lerRascunhosSessao(subject)).geracao;
    if (!ativo()) return;
    const identidade = await consultarIdentidadeSync(subject, transporte, aoEstado);
    if (!identidade || !ativo())
        return;
    if (Object.hasOwn(identidade, 'rascunho'))
        await db.guardarRascunhoRemoto(subject, identidade.rascunho, geracao);
    if (!ativo()) return;
    const bloqueadas = new Set<string>(), operacoesBloqueadas = new Set<string>();
    for (const item of await db.listar(subject)) {
        if (!ativo())
            return;
        if (item.substituidoPor)
            continue;
        const entidade = entidadeComando(item.comando);
        if (item.recibo || bloqueadas.has(entidade) || (item.comando.dependsOn && operacoesBloqueadas.has(item.comando.dependsOn))) {
            bloqueadas.add(entidade);
            operacoesBloqueadas.add(item.comando.operationId);
            continue;
        }
        const r = await transporte('/api/dados/sync', { method: 'POST', headers, body: JSON.stringify(item.comando), signal: AbortSignal.timeout(10000) });
        if (!ativo())
            return;
        if (!r.ok && r.status !== 409 && r.status !== 422) {
            await aoEstado(estadoDaResposta(r.status));
            return;
        }
        const corpo = await r.json();
        if (!ativo()) return;
        const recibo = validarReciboSync(item.comando, corpo);
        if (!recibo)
            return;
        await db.confirmar(subject, recibo);
        if (recibo.tipo !== 'ACK') {
            bloqueadas.add(entidade);
            operacoesBloqueadas.add(item.comando.operationId);
        }
    }
}
