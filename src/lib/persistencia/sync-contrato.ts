import type { PerfilResumo } from '@/components/painel/Painel';
import type { SessaoHistorico } from '@/lib/treino-historico';
import type { EntradaPlanoVisivel } from '@/lib/plano-cas-comando';
import type { Consentimentos } from './perfil-profile';
import type { VersoesTreino } from './treino-versoes';
/** Fronteira de armazenamento. Não contém regras nem versões internas do motor. */
export const STORAGE_GENERATION = 'beta-2026-10-19-v2';
export const SYNC_PROTOCOL = '2';
export const EVENTO_FATOS = 'evk:fatos-atualizados';
export const EVENTO_FECHAR_SESSAO = 'evk:fechar-sessao-escolhida';
export interface MutacaoPerfil {
    perfil: PerfilResumo;
    expectedRevision: number;
    entradaPlano?: EntradaPlanoVisivel;
    consentimentos?: Consentimentos;
    alvoId?: string;
    base?: SnapshotConta;
}
export interface RascunhoSessao {
    id: string;
    expectedRevision: number;
    /** Estado da interface, nunca uma sessão realizada ou entrada da progressão. */
    estado: Record<string, unknown>;
    base?: Record<string, unknown>;
}
type Operacao = {
    tipo: 'PERFIL' | 'APLICAR_TREINO' | 'DESFAZER_TREINO';
    payload: MutacaoPerfil;
} | {
    tipo: 'SESSAO';
    payload: {
        sessao: SessaoHistorico;
        substituirBase?: SessaoHistorico;
    };
} | {
    tipo: 'PESO';
    payload: {
        pesoKg: number;
        dataISO: string;
    };
} | {
    tipo: 'ADERENCIA';
    payload: {
        dia: string;
        logs: Record<string, unknown>;
        notes: Record<string, string>;
        base: {
            logs: Record<string, unknown>;
            notes: Record<string, string>;
        };
    };
} | {
    tipo: 'RASCUNHO_SESSAO';
    payload: RascunhoSessao;
};
export type ComandoSync = Operacao & {
    schemaVersion: 2;
    operationId: string;
    dependsOn?: string;
    subject: string;
    generation: typeof STORAGE_GENERATION;
};
export interface SnapshotConta {
    perfil: PerfilResumo;
    revision: number;
    entradaPlano?: EntradaPlanoVisivel;
    versoesTreino?: VersoesTreino;
}
export type ReciboSync = {
    tipo: 'ACK';
    operationId: string;
    revision?: number;
    estado?: string;
    pesoKg?: number;
    semMudanca?: boolean;
} | {
    tipo: 'CONFLITO';
    operationId: string;
    motivo: string;
    revision?: number;
} | {
    tipo: 'RECUSADO';
    operationId: string;
    motivo: string;
    pesoKg?: number;
};
export function cabecalhosSync(subject: string): Record<string, string> {
    return { 'content-type': 'application/json', 'x-evk-protocol': SYNC_PROTOCOL, 'x-evk-subject': subject, 'x-evk-generation': STORAGE_GENERATION };
}
export function novoComando(subject: string, operacao: Operacao): ComandoSync {
    return { ...structuredClone(operacao), schemaVersion: 2, operationId: crypto.randomUUID(), subject, generation: STORAGE_GENERATION };
}
/** Só comandos da mesma entidade se bloqueiam. Treino realizado não depende da aplicação
 * do plano cujo rascunho o originou. */
export function entidadeComando(c: ComandoSync): string {
    switch (c.tipo) {
        case 'PERFIL':
        case 'APLICAR_TREINO':
        case 'DESFAZER_TREINO': return 'perfil';
        case 'PESO': return `peso:${c.payload.dataISO}`;
        case 'ADERENCIA': return `aderencia:${c.payload.dia}`;
        case 'SESSAO': return `sessao:${c.payload.sessao.id}`;
        case 'RASCUNHO_SESSAO': return 'rascunho';
    }
}
