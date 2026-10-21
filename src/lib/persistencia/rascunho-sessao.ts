'use client';
import { useEffect, useRef, useState } from 'react';
import { escopoLocal } from '@/lib/escopo-local';
import { bancoSync, sincronizarConta, EVENTO_SYNC } from './sync-cliente';
import { mesclarTresVias } from './mescla';
import { novoComando } from './sync-contrato';
import type { OutboxDB } from './outbox-db';
import { continuacaoDaConta } from './continuidade-conta';
export interface RascunhoLocal {
    schemaVersion: 1;
    origem: 'guiada' | 'manual';
    chave: string;
    sessaoId: string;
    localVersion: string;
    dirty: boolean;
    baseRevision: number;
    dados: Record<string, unknown>;
    contexto?: Record<string, unknown>;
    encerrado?: boolean;
    baseEstado?: Record<string, unknown>;
}
export async function rascunhoDisponivel(db: OutboxDB, subject: string): Promise<RascunhoLocal | undefined> {
    const { local, remoto, pendente } = await db.lerRascunhosSessao(subject);
    if (local?.encerrado) {
        if (!remoto || remoto.estado.sessaoId === local.sessaoId) return undefined;
        return { ...remoto.estado, dirty: false, baseRevision: remoto.revision, baseEstado: remoto.estado as unknown as Record<string, unknown> };
    }
    if (local?.dirty || pendente || !remoto || (local && local.baseRevision >= remoto.revision))
        return local;
    return { ...remoto.estado, dirty: false, baseRevision: remoto.revision, baseEstado: remoto.estado as unknown as Record<string, unknown> };
}
/** Um único estado mutável por conta; captura em comando imutável apenas para transporte.
 * A comparação de localVersion é feita na mesma transação que enfileira e limpa dirty. */
export async function capturarRascunho(db: OutboxDB, subject: string): Promise<void> {
    const { local: r } = await db.lerRascunhosSessao(subject);
    if (!r?.dirty || r.encerrado)
        return;
    const comando = novoComando(subject, { tipo: 'RASCUNHO_SESSAO', payload: { id: 'ativa', expectedRevision: r.baseRevision, estado: estadoCompartilhado(r), base: r.baseEstado } });
    await db.enfileirar(comando, { chave: 'rascunhoSessao', valor: { ...r, dirty: false }, esperado: r.localVersion });
}
export function estadoCompartilhado(r: Pick<RascunhoLocal, 'origem' | 'chave' | 'sessaoId' | 'dados' | 'contexto'>): Record<string, unknown> {
    const dados = { ...r.dados };
    delete dados.cur;
    delete dados.fase;
    return { schemaVersion: 1, origem: r.origem, chave: r.chave, sessaoId: r.sessaoId, dados, ...(r.contexto ? { contexto: r.contexto } : {}) };
}
export function useRascunhoSessao(opcoes: {
    origem: RascunhoLocal['origem'];
    chave: string;
    sessaoId: string;
    ativo?: boolean;
    dados: Record<string, unknown>;
    contexto?: Record<string, unknown>;
    restaurar: (r: RascunhoLocal) => boolean;
}) {
    const [pronto, setPronto] = useState(false), [guardado, setGuardado] = useState(false);
    const [outro, setOutro] = useState<RascunhoLocal | null>(null), [erro, setErro] = useState(false);
    const base = useRef(0), estadoBase = useRef<Record<string, unknown> | undefined>(undefined), restaurar = useRef(opcoes.restaurar), ultimo = useRef('');
    const serializado = JSON.stringify({ origem: opcoes.origem, chave: opcoes.chave, sessaoId: opcoes.sessaoId, dados: opcoes.dados, contexto: opcoes.contexto });
    const atuais = useRef(opcoes);
    const vida = useRef(true), limite = useRef(continuacaoDaConta(escopoLocal, escopoLocal(), () => vida.current));
    useEffect(() => { vida.current = true; return () => { vida.current = false; }; }, []);
    atuais.current = opcoes;
    useEffect(() => {
        const subject = escopoLocal();
        if (!subject)
            return;
        let vivo = true;
        const ativo = continuacaoDaConta(escopoLocal, subject, () => vivo && limite.current());
        const receber = async () => {
            const db = await bancoSync();
            if (!ativo()) return;
            const { local, remoto } = await db.lerRascunhosSessao(subject);
            if (!ativo() || !local || local.encerrado || !remoto || remoto.estado.sessaoId !== atuais.current.sessaoId)
                return;
            const m = mesclarTresVias(local.baseEstado ?? {}, estadoCompartilhado(atuais.current), remoto.estado as unknown as Record<string, unknown>);
            if (m.conflitos.length)
                return; // o recibo durável e a faixa do app oferecem a escolha
            if (JSON.stringify(m.valor) === JSON.stringify(estadoCompartilhado(atuais.current)))
                return;
            const dados = { ...(m.valor.dados as Record<string, unknown>), cur: atuais.current.dados.cur, fase: atuais.current.dados.fase };
            if (!restaurar.current({ ...local, ...m.valor, dados } as RascunhoLocal))
                return;
            base.current = remoto.revision;
            estadoBase.current = remoto.estado as unknown as Record<string, unknown>;
        };
        const listener = () => { void receber().catch(() => undefined); };
        window.addEventListener(EVENTO_SYNC, listener);
        return () => { vivo = false; window.removeEventListener(EVENTO_SYNC, listener); };
    }, []);
    useEffect(() => {
        let vivo = true;
        const subject = escopoLocal();
        const ativo = continuacaoDaConta(escopoLocal, subject, () => vivo && limite.current());
        if (!subject) {
            setPronto(true);
            return;
        }
        void bancoSync().then(async (db) => {
            if (!ativo()) return;
            const r = await rascunhoDisponivel(db, subject);
            if (!ativo())
                return;
            base.current = r?.baseRevision ?? 0;
            estadoBase.current = r?.baseEstado;
            if (r && (r.origem !== opcoes.origem || r.chave !== opcoes.chave || !restaurar.current(r))) {
                setOutro(r);
                return;
            }
            setPronto(true);
        }).catch(() => { if (ativo())
            setErro(true); });
        return () => { vivo = false; };
    }, [opcoes.origem, opcoes.chave]);
    useEffect(() => {
        const subject = escopoLocal();
        if (!pronto || !subject || opcoes.ativo === false || ultimo.current === serializado)
            return;
        let vivo = true;
        const ativo = continuacaoDaConta(escopoLocal, subject, () => vivo && limite.current());
        setGuardado(false);
        const r: RascunhoLocal = { ...JSON.parse(serializado), schemaVersion: 1, localVersion: crypto.randomUUID(), dirty: true, baseRevision: base.current, baseEstado: estadoBase.current };
        void bancoSync().then(async (db) => {
            if (!ativo())
                return;
            // Não rebaixa a revisão de uma confirmação da própria tentativa recebida em paralelo.
            const { local: anterior } = await db.lerRascunhosSessao(subject);
            if (!ativo()) return;
            if (anterior?.encerrado && anterior.sessaoId === r.sessaoId)
                return;
            if (anterior?.encerrado) {
                r.baseRevision = 0;
                r.baseEstado = undefined;
            }
            else if (anterior?.sessaoId === r.sessaoId && anterior.baseRevision > r.baseRevision) {
                r.baseRevision = anterior.baseRevision;
                r.baseEstado = anterior.baseEstado ?? r.baseEstado;
            }
            if (!await db.guardarRascunhoSessao(subject, r))
                return;
            if (ativo()) {
                ultimo.current = serializado;
                setGuardado(true);
            }
        }).catch(() => { if (ativo())
            setErro(true); });
        const timer = setTimeout(() => { if (ativo()) void sincronizarConta(subject).catch(() => undefined); }, 500);
        return () => { vivo = false; clearTimeout(timer); };
    }, [pronto, serializado, opcoes.ativo]);
    return { pronto, guardado, outro, erro, iniciarNovo: () => { if (limite.current()) { setOutro(null); setPronto(true); } } };
}
