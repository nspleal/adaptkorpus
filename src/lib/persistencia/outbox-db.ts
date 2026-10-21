import type { ComandoSync, ReciboSync, SnapshotConta } from './sync-contrato';
import { STORAGE_GENERATION } from './sync-contrato';
import { canonicalInputHash } from '@/lib/engine/cas';
import type { RascunhoLocal } from './rascunho-sessao';
export interface RascunhoRemoto { revision: number; estado: RascunhoLocal }
export interface EstadoRascunhos { local?: RascunhoLocal; remoto?: RascunhoRemoto; pendente: boolean; geracao: number }
export interface ItemOutbox {
    comando: ComandoSync;
    criadoEm: number;
    sequencia: number;
    recibo?: ReciboSync;
    substituidoPor?: string;
}
/** Uma base por projeto/origem/geração; proprietário também compõe toda chave.
 * A origem já é isolada pelo browser. Falha/quota/private mode é erro visível, nunca ACK. */
export class OutboxDB {
    private constructor(private readonly db: IDBDatabase) { }
    static abrir(project: string): Promise<OutboxDB> {
        if (!project || !/^[a-z0-9.-]+$/i.test(project))
            return Promise.reject(new Error('projeto_invalido'));
        return new Promise((resolve, reject) => {
            const r = indexedDB.open(`evk:${project}:${STORAGE_GENERATION}`, 1);
            r.onupgradeneeded = () => {
                r.result.createObjectStore('fila', { keyPath: 'comando.operationId' }).createIndex('subject', 'comando.subject');
                r.result.createObjectStore('estado');
            };
            r.onerror = () => reject(r.error);
            r.onblocked = () => reject(new Error('storage_bloqueado'));
            r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); resolve(new OutboxDB(r.result)); };
        });
    }
    fechar() { this.db.close(); }
    /** Chamado somente após exclusão explícita confirmada desta conta; nunca em 401/rede. */
    apagarConta(subject: string): Promise<void> {
        return this.transacao(['fila', 'estado'], (tx, definir) => {
            const fila = tx.objectStore('fila'), estado = tx.objectStore('estado');
            const itens = fila.index('subject').getAllKeys(subject);
            itens.onsuccess = this.proteger(tx, () => {
                for (const k of itens.result)
                    fila.delete(k);
            });
            const cursor = estado.openKeyCursor();
            cursor.onsuccess = this.proteger(tx, () => {
                const c = cursor.result;
                if (!c)
                    return;
                if (typeof c.key === 'string' && c.key.startsWith(`${subject}:`))
                    estado.delete(c.key);
                c.continue();
            });
            definir(undefined);
        });
    }
    private transacao<T>(stores: string[], trabalho: (tx: IDBTransaction, definir: (v: T) => void) => void): Promise<T> {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(stores, 'readwrite');
            let valor: T;
            tx.oncomplete = () => resolve(valor);
            tx.onabort = () => reject(tx.error ?? new Error('storage_abortado'));
            tx.onerror = () => reject(tx.error);
            try {
                trabalho(tx, (v) => { valor = v; });
            }
            catch (e) {
                tx.abort();
                reject(e);
            }
        });
    }
    /** Exceção síncrona de put/add em callback também aborta e rejeita a Promise do commit. */
    private proteger(tx: IDBTransaction, trabalho: () => void): () => void {
        return () => { try { trabalho(); } catch { try { tx.abort(); } catch { /* já encerrada */ } } };
    }
    private avancarRascunho(tx: IDBTransaction, subject: string): void {
        const estado = tx.objectStore('estado'), r = estado.get(`${subject}:geracaoRascunho`);
        r.onsuccess = this.proteger(tx, () => estado.put(Number(r.result ?? 0) + 1, `${subject}:geracaoRascunho`));
    }
    /** O marcador é monotônico. Limpa somente candidatos do ID encerrado, nunca outro treino. */
    private marcarEncerrada(tx: IDBTransaction, subject: string, id: string | undefined, confirmada = false, operationId?: string): void {
        if (!id) return;
        const estado = tx.objectStore('estado');
        estado.put(true, `${subject}:sessaoEncerrada:${id}`);
        this.avancarRascunho(tx, subject);
        const local = estado.get(`${subject}:rascunhoSessao`), remoto = estado.get(`${subject}:rascunhoRemoto`);
        local.onsuccess = this.proteger(tx, () => {
            if (local.result?.sessaoId !== id) return;
            if (confirmada) estado.delete(`${subject}:rascunhoSessao`);
            else estado.put({ ...local.result, dirty: false, encerrado: true }, `${subject}:rascunhoSessao`);
            if (operationId) estado.put(operationId, `${subject}:ultimo:RASCUNHO_SESSAO`);
        });
        remoto.onsuccess = this.proteger(tx, () => { if (remoto.result?.estado?.sessaoId === id) estado.delete(`${subject}:rascunhoRemoto`); });
    }
    encerrarSessao(subject: string, id: string, esperada?: number): Promise<boolean> {
        return this.transacao(['estado'], (tx, definir) => {
            const estado = tx.objectStore('estado'), g = estado.get(`${subject}:geracaoRascunho`);
            const terminal = estado.get(`${subject}:sessaoEncerrada:${id}`);
            terminal.onsuccess = this.proteger(tx, () => {
                if (esperada !== undefined && esperada !== Number(g.result ?? 0)) { definir(false); return; }
                if (!terminal.result) this.marcarEncerrada(tx, subject, id);
                definir(true);
            });
        });
    }
    /** Local/remoto/fila e ambos os marcadores são observados numa única transação. */
    lerRascunhosSessao(subject: string): Promise<EstadoRascunhos> {
        return this.transacao(['estado', 'fila'], (tx, definir) => {
            const estado = tx.objectStore('estado');
            const local = estado.get(`${subject}:rascunhoSessao`), remoto = estado.get(`${subject}:rascunhoRemoto`);
            const geracao = estado.get(`${subject}:geracaoRascunho`), fila = tx.objectStore('fila').index('subject').getAll(subject);
            fila.onsuccess = this.proteger(tx, () => {
                const l = local.result as RascunhoLocal | undefined, r = remoto.result as RascunhoRemoto | null | undefined;
                const terminalLocal = estado.get(`${subject}:sessaoEncerrada:${l?.sessaoId ?? ''}`);
                const terminalRemoto = estado.get(`${subject}:sessaoEncerrada:${r?.estado.sessaoId ?? ''}`);
                terminalRemoto.onsuccess = this.proteger(tx, () => {
                    const fechada = !!(l?.encerrado || terminalLocal.result);
                    definir({
                        local: l ? { ...l, ...(fechada ? { encerrado: true, dirty: false } : {}) } : undefined,
                        remoto: r && !terminalRemoto.result && !(fechada && l?.sessaoId === r.estado.sessaoId) ? r : undefined,
                        pendente: !!l && !fechada && (fila.result as ItemOutbox[]).some(i => i.comando.tipo === 'RASCUNHO_SESSAO' && i.comando.payload.estado.sessaoId === l.sessaoId),
                        geracao: Number(geracao.result ?? 0),
                    });
                });
            });
        });
    }
    /** GET atrasado não substitui uma decisão local/ACK ou resposta mais nova já incorporada. */
    guardarRascunhoRemoto(subject: string, valor: unknown, esperada?: number): Promise<number | undefined> {
        const r = valor as RascunhoRemoto | null;
        if (r !== null && (!r || !Number.isSafeInteger(r.revision) || r.revision < 0 || typeof r.estado?.sessaoId !== 'string'))
            return Promise.reject(new Error('rascunho_remoto_invalido'));
        return this.transacao(['estado'], (tx, definir) => {
            const estado = tx.objectStore('estado'), g = estado.get(`${subject}:geracaoRascunho`);
            const anterior = estado.get(`${subject}:rascunhoRemoto`);
            const terminal = estado.get(`${subject}:sessaoEncerrada:${r?.estado.sessaoId ?? ''}`);
            terminal.onsuccess = this.proteger(tx, () => {
                const atual = Number(g.result ?? 0);
                if ((esperada !== undefined && atual !== esperada) || terminal.result
                    || (r && anterior.result?.estado?.sessaoId === r.estado.sessaoId && anterior.result.revision > r.revision)) { definir(undefined); return; }
                if (canonicalInputHash(anterior.result ?? null) === canonicalInputHash(r)) { definir(atual); return; }
                if (r) estado.put(structuredClone(r), `${subject}:rascunhoRemoto`);
                else estado.delete(`${subject}:rascunhoRemoto`);
                estado.put(atual + 1, `${subject}:geracaoRascunho`);
                definir(atual + 1);
            });
        });
    }
    /** Comando e estado que o originou confirmam juntos. Chamar antes de mostrar "salvo". */
    enfileirar(comando: ComandoSync, estado?: {
        chave: string;
        valor: unknown;
        esperado?: string;
    }, contexto?: { base?: SnapshotConta; definicaoAplicada?: unknown }): Promise<ComandoSync | undefined> {
        return this.transacao(['fila', 'estado'], (tx, definir) => {
            const fila = tx.objectStore('fila'), estados = tx.objectStore('estado');
            const iniciar = () => {
                const contador = estados.get(`${comando.subject}:sequencia`);
                contador.onsuccess = this.proteger(tx, () => {
                    const sequencia = Number(contador.result ?? 0) + 1;
                    const entidade = ['PERFIL', 'APLICAR_TREINO', 'DESFAZER_TREINO'].includes(comando.tipo) ? 'perfil' : comando.tipo;
                    const ultimo = estados.get(`${comando.subject}:ultimo:${entidade}`);
                    ultimo.onsuccess = this.proteger(tx, () => {
                        const anterior = fila.get(ultimo.result ?? '');
                        anterior.onsuccess = this.proteger(tx, () => {
                            const verificar = estados.get(`${comando.subject}:${estado?.chave ?? ''}`);
                            verificar.onsuccess = this.proteger(tx, () => {
                                const terminal = estados.get(`${comando.subject}:sessaoEncerrada:${comando.tipo === 'RASCUNHO_SESSAO' ? comando.payload.estado.sessaoId : ''}`);
                                terminal.onsuccess = this.proteger(tx, () => {
                                    try {
                                        if (estado?.esperado && verificar.result?.localVersion !== estado.esperado) { tx.abort(); return; }
                                        if (comando.tipo === 'RASCUNHO_SESSAO' && (terminal.result || verificar.result?.encerrado
                                            || (estado?.esperado && (!verificar.result?.dirty || verificar.result?.sessaoId !== comando.payload.estado.sessaoId)))) {
                                            definir(undefined);
                                            return;
                                        }
                                        const selado = structuredClone(comando);
                                        if (anterior.result && !anterior.result.recibo && ['perfil', 'RASCUNHO_SESSAO'].includes(entidade)) {
                                            selado.dependsOn = anterior.result.comando.operationId;
                                            if (selado.tipo === 'RASCUNHO_SESSAO' && anterior.result.comando.tipo === 'RASCUNHO_SESSAO')
                                                selado.payload.base = anterior.result.comando.payload.estado;
                                        }
                                        fila.add({ comando: selado, criadoEm: Date.now(), sequencia } satisfies ItemOutbox);
                                        estados.put(sequencia, `${comando.subject}:sequencia`);
                                        estados.put(selado.operationId, `${comando.subject}:ultimo:${entidade}`);
                                        if (selado.tipo === 'SESSAO') this.marcarEncerrada(tx, comando.subject, selado.payload.sessao.id, false, selado.operationId);
                                        if (contexto?.base) estados.put(structuredClone(contexto.base), `${comando.subject}:base:${selado.operationId}`);
                                        if (contexto?.definicaoAplicada) estados.put({ operationId: selado.operationId, definicao: structuredClone(contexto.definicaoAplicada) }, `${comando.subject}:aplicacaoPendente`);
                                        if (selado.tipo === 'ADERENCIA') {
                                            const c = selado, bases = estados.get(`${comando.subject}:aderenciaBase`);
                                            bases.onsuccess = this.proteger(tx, () => estados.put({ ...bases.result, [c.payload.dia]: { logs: c.payload.logs, notes: c.payload.notes } }, `${comando.subject}:aderenciaBase`));
                                        }
                                        if (estado) {
                                            estados.put(structuredClone(estado.valor), `${comando.subject}:${estado.chave}`);
                                            if (estado.chave === 'rascunhoSessao') this.avancarRascunho(tx, comando.subject);
                                        }
                                        definir(selado);
                                    } catch {
                                        // Erro síncrono de add/put em callback IDB também rejeita a transação.
                                        try { tx.abort(); } catch { /* já abortada; onabort rejeita a Promise */ }
                                    }
                                });
                            });
                        });
                    });
                });
            };
            if (comando.tipo !== 'SESSAO') { iniciar(); return; }
            // Hidratação/retry reutilizam a intenção imutável, inclusive entre abas.
            const hash = canonicalInputHash(comando.payload);
            const pendentes = fila.index('subject').getAll(comando.subject);
            pendentes.onsuccess = this.proteger(tx, () => {
                const existente = (pendentes.result as ItemOutbox[]).find(i => !i.substituidoPor && i.comando.tipo === 'SESSAO' && canonicalInputHash(i.comando.payload) === hash);
                if (existente) { definir(existente.comando); return; }
                const confirmado = estados.get(`${comando.subject}:sessaoConfirmada:${comando.payload.sessao.id}`);
                confirmado.onsuccess = this.proteger(tx, () => {
                    if (confirmado.result?.hash === hash) { definir({ ...comando, operationId: confirmado.result.operationId }); return; }
                    iniciar();
                });
            });
        });
    }
    listar(subject: string): Promise<ItemOutbox[]> {
        return this.transacao(['fila'], (tx, definir) => {
            const r = tx.objectStore('fila').index('subject').getAll(subject);
            r.onsuccess = this.proteger(tx, () => definir((r.result as ItemOutbox[]).sort((a, b) => a.sequencia - b.sequencia)));
        });
    }
    /** Só recibo correspondente. Conflito/recusa ficam visíveis; ACK remove e registra atômico. */
    confirmar(subject: string, recibo: ReciboSync): Promise<void> {
        return this.transacao(['fila', 'estado'], (tx, definir) => {
            const fila = tx.objectStore('fila');
            const r = fila.get(recibo.operationId);
            r.onsuccess = this.proteger(tx, () => {
                const item = r.result as ItemOutbox | undefined;
                if (!item) {
                    const anterior = tx.objectStore('estado').get(`${subject}:recibo:${recibo.operationId}`);
                    anterior.onsuccess = this.proteger(tx, () => {
                        const a = anterior.result as ReciboSync | undefined;
                        if (a?.tipo === 'ACK' && recibo.tipo === 'ACK' && a.revision === recibo.revision && a.pesoKg === recibo.pesoKg && a.estado === recibo.estado)
                            definir(undefined);
                        else
                            tx.abort();
                    });
                    return;
                }
                if (item.comando.subject !== subject) {
                    tx.abort();
                    return;
                }
                if (recibo.tipo === 'ACK') {
                    if (item.comando.tipo === 'SESSAO') {
                        const estado = tx.objectStore('estado');
                        const chave = `${subject}:sessaoConfirmada:${item.comando.payload.sessao.id}`;
                        const anterior = estado.get(chave);
                        anterior.onsuccess = this.proteger(tx, () => {
                            if (!anterior.result || anterior.result.sequencia <= item.sequencia)
                                estado.put({ hash: canonicalInputHash(item.comando.payload), operationId: recibo.operationId, sequencia: item.sequencia }, chave);
                        });
                    }
                    fila.delete(recibo.operationId);
                    tx.objectStore('estado').delete(`${subject}:base:${recibo.operationId}`);
                    const anteriores = fila.index('subject').getAll(subject);
                    anteriores.onsuccess = this.proteger(tx, () => {
                        const encerrados = new Set([recibo.operationId]);
                        const itens = anteriores.result as ItemOutbox[];
                        for (let n = 0; n < itens.length; n++)
                            for (const i of itens) {
                                if (i.substituidoPor && encerrados.has(i.substituidoPor))
                                    encerrados.add(i.comando.operationId);
                            }
                        for (const id of encerrados) {
                            fila.delete(id);
                            tx.objectStore('estado').delete(`${subject}:base:${id}`);
                        }
                    });
                }
                else
                    fila.put({ ...item, recibo });
                tx.objectStore('estado').put(recibo, `${subject}:ultimoRecibo`);
                tx.objectStore('estado').put(recibo, `${subject}:recibo:${recibo.operationId}`);
                const estado = tx.objectStore('estado');
                if (recibo.tipo === 'ACK' && item.comando.tipo === 'SESSAO') {
                    this.marcarEncerrada(tx, subject, item.comando.payload.sessao.id, true);
                    definir(undefined); return;
                }
                const rascunho = estado.get(`${subject}:rascunhoSessao`);
                rascunho.onsuccess = this.proteger(tx, () => {
                    const atual = rascunho.result;
                    if (recibo.tipo === 'ACK' && item.comando.tipo === 'RASCUNHO_SESSAO' && atual?.sessaoId === item.comando.payload.estado.sessaoId) {
                        const baseEstado = item.comando.payload.estado;
                        const terminal = estado.get(`${subject}:sessaoEncerrada:${atual.sessaoId}`);
                        terminal.onsuccess = this.proteger(tx, () => {
                            if (terminal.result || atual.encerrado || (recibo.revision ?? 0) < atual.baseRevision) return;
                            estado.put({ ...atual, baseRevision: recibo.revision, baseEstado }, `${subject}:rascunhoSessao`);
                            this.avancarRascunho(tx, subject);
                        });
                    }
                });
                definir(undefined);
            });
        });
    }
    ler<T>(subject: string, chave: string): Promise<T | undefined> {
        return this.transacao(['estado'], (tx, definir) => {
            const r = tx.objectStore('estado').get(`${subject}:${chave}`);
            r.onsuccess = this.proteger(tx, () => definir(r.result as T | undefined));
        });
    }
    guardar(subject: string, chave: string, valor: unknown): Promise<void> {
        if (chave === 'rascunhoRemoto') return this.guardarRascunhoRemoto(subject, valor).then(() => undefined);
        if (chave === 'rascunhoSessao' && valor && typeof valor === 'object' && 'sessaoId' in valor)
            return this.guardarRascunhoSessao(subject, valor as RascunhoLocal).then(() => undefined);
        if (chave.startsWith('sessaoEncerrada:')) {
            if (valor !== true) return Promise.reject(new Error('terminalidade_nao_reversivel'));
            return this.encerrarSessao(subject, chave.slice('sessaoEncerrada:'.length)).then(() => undefined);
        }
        return this.transacao(['estado'], (tx, definir) => {
            tx.objectStore('estado').put(structuredClone(valor), `${subject}:${chave}`);
            definir(undefined);
        });
    }
    /** Leituras de abas diferentes podem terminar fora de ordem. Nunca rebaixa cache confirmado. */
    guardarSnapshot<T extends { revision: number }>(subject: string, snapshot: T): Promise<T> {
        return this.transacao(['estado'], (tx, definir) => {
            const estado = tx.objectStore('estado');
            const leitura = estado.get(`${subject}:snapshot`);
            leitura.onsuccess = this.proteger(tx, () => {
                const anterior = leitura.result as T | undefined;
                if (anterior && anterior.revision > snapshot.revision) { definir(anterior); return; }
                estado.put(structuredClone(snapshot), `${subject}:snapshot`);
                definir(snapshot);
            });
        });
    }
    /** Serializado com o encerramento: autosave atrasado não ressuscita sessão concluída. */
    guardarRascunhoSessao<T extends {
        sessaoId: string;
        encerrado?: boolean;
    }>(subject: string, valor: T, esperada?: number): Promise<boolean> {
        return this.transacao(['estado'], (tx, definir) => {
            const estado = tx.objectStore('estado');
            const geracao = estado.get(`${subject}:geracaoRascunho`);
            const encerrada = estado.get(`${subject}:sessaoEncerrada:${valor.sessaoId}`);
            encerrada.onsuccess = this.proteger(tx, () => {
                if (encerrada.result || (esperada !== undefined && esperada !== Number(geracao.result ?? 0))) {
                    definir(false);
                    return;
                }
                if (valor.encerrado) this.marcarEncerrada(tx, subject, valor.sessaoId);
                else { estado.put(structuredClone(valor), `${subject}:rascunhoSessao`); this.avancarRascunho(tx, subject); }
                definir(true);
            });
        });
    }
    /** Só substitui comando que teve conflito definitivo. Resultado incerto é reenviado pelo
     * MESMO ID; nunca removido ou reescrito para "resolver" timeout. */
    resolver(subject: string, operationId: string, novo?: ComandoSync, base?: SnapshotConta): Promise<boolean> {
        return this.transacao(['fila', 'estado'], (tx, definir) => {
            const fila = tx.objectStore('fila'), r = fila.get(operationId);
            r.onsuccess = this.proteger(tx, () => {
                const item = r.result as ItemOutbox | undefined;
                if (!item || item.comando.subject !== subject || item.substituidoPor || !item.recibo || (novo && (item.recibo.tipo !== 'CONFLITO' || novo.subject !== subject))) {
                    tx.abort();
                    return;
                }
                const substituir = () => {
                    if (novo)
                        fila.put({ ...item, substituidoPor: novo.operationId });
                    else {
                        fila.delete(operationId);
                        tx.objectStore('estado').delete(`${subject}:base:${operationId}`);
                    }
                    if (novo)
                        fila.add({ comando: structuredClone(novo), criadoEm: item.criadoEm, sequencia: item.sequencia } satisfies ItemOutbox);
                    if (novo && base) tx.objectStore('estado').put(structuredClone(base), `${subject}:base:${novo.operationId}`);
                    const marcador = tx.objectStore('estado').get(`${subject}:aplicacaoPendente`);
                    marcador.onsuccess = this.proteger(tx, () => {
                        if (novo && marcador.result?.operationId === operationId)
                            tx.objectStore('estado').put({ ...marcador.result, operationId: novo.operationId }, `${subject}:aplicacaoPendente`);
                    });
                    definir(true);
                };
                if (novo?.tipo === 'RASCUNHO_SESSAO') {
                    const terminal = tx.objectStore('estado').get(`${subject}:sessaoEncerrada:${novo.payload.estado.sessaoId}`);
                    terminal.onsuccess = this.proteger(tx, () => { if (terminal.result) definir(false); else substituir(); });
                } else substituir();
            });
        });
    }
}
