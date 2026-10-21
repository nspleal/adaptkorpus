'use client';
import { escopoLocal, chaveLocal } from '@/lib/escopo-local';
import { carregarHistoricoServidor, carregarPesosServidor, carregarAderenciaServidor } from './sync';
import { reconciliarHistorico, lerHistorico, substituirHistorico, substituirPesos, chaveSessao } from '@/lib/treino-historico';
import { canonicalInputHash } from '@/lib/engine/cas';
import { EVENTO_FATOS } from './sync-contrato';
import type { OutboxDB } from './outbox-db';
import type { HistoricoAderencia } from '@/lib/aderencia-persistencia';
import { continuacaoDaConta } from './continuidade-conta';
/** Fatos confirmados são hidratados separadamente do rascunho do plano. Pendência fica
 * na outbox; um peso ainda sem ACK não entra na série usada pelas fórmulas existentes. */
export async function atualizarFatosConta(db: OutboxDB, subject: string): Promise<void> {
    const ativo = continuacaoDaConta(escopoLocal, subject);
    if (!ativo()) return;
    const [historico, pesos, dias] = await Promise.all([carregarHistoricoServidor(), carregarPesosServidor(), carregarAderenciaServidor()]);
    if (!ativo())
        return;
    const fila = await db.listar(subject);
    if (!ativo()) return;
    const { local, remoto } = await db.lerRascunhosSessao(subject);
    if (!ativo()) return;
    for (const id of new Set([local?.sessaoId, remoto?.estado.sessaoId])) {
        if (id && historico?.some(s => s.id === id)) { await db.encerrarSessao(subject, id); if (!ativo()) return; }
    }
    const chaves = (['evk_treinos', 'evk_pesos', 'evk_aderencia'] as const).map(chaveLocal);
    const antes = chaves.map((k) => localStorage.getItem(k));
    const pendentes = fila.flatMap(i => i.comando.tipo === 'SESSAO' && !i.substituidoPor && !i.recibo ? [i.comando.payload.sessao] : []);
    if (historico || pendentes.length) {
        const locais = new Map(lerHistorico().map(s => [chaveSessao(s), s]));
        for (const sessao of pendentes) locais.set(chaveSessao(sessao), sessao);
        substituirHistorico(reconciliarHistorico([...locais.values()], historico ?? []).uniao);
    }
    if (pesos)
        substituirPesos(pesos);
    if (dias) {
        const local = JSON.parse(localStorage.getItem(chaveLocal('evk_aderencia')) ?? '{}') as HistoricoAderencia;
        const mesclado: HistoricoAderencia = { ...local };
        for (const [dia, remoto] of Object.entries(dias)) {
            const pendente = fila.some((i) => !i.substituidoPor && i.comando.tipo === 'ADERENCIA' && i.comando.payload.dia === dia);
            if (!pendente && (!local[dia]?.pendenteSync || canonicalInputHash({ logs: local[dia]?.logs, notes: local[dia]?.notes }) === canonicalInputHash(remoto))) {
                mesclado[dia] = { ...remoto, pendenteSync: false } as HistoricoAderencia[string];
            }
        }
        localStorage.setItem(chaveLocal('evk_aderencia'), JSON.stringify(mesclado));
    }
    for (const i of fila) {
        if (i.comando.tipo !== 'PESO' || i.recibo?.tipo !== 'RECUSADO' || i.recibo.motivo !== 'peso_ja_registrado_hoje')
            continue;
        const c = i.comando;
        const oficial = pesos?.find((p) => p.dataISO === c.payload.dataISO);
        if (!oficial)
            continue;
        await db.guardar(subject, 'avisoRecusa', `A conta manteve ${oficial.kg} kg em ${oficial.dataISO}; o segundo valor não foi aplicado.`);
        if (!ativo()) return;
        await db.resolver(subject, c.operationId);
        if (!ativo()) return;
    }
    if (!ativo()) return;
    const depois = chaves.map((k) => localStorage.getItem(k));
    if (JSON.stringify(antes) !== JSON.stringify(depois))
        window.dispatchEvent(new Event(EVENTO_FATOS));
}
