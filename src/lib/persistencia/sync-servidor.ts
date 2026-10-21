import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { perfilResumoSchema, consentimentosSchema } from '@/lib/validation/perfil-resumo';
import { entradaPlanoVisivelSchema } from '@/lib/validation/plano-entrada';
import { aderenciaDiaSchema, sessaoHistoricoSchema } from '@/lib/validation/api';
import { comandoCommitDePlano, type AgregadoPlano } from '@/lib/plano-cas-comando';
import { linhaComConsentimentos, perfilParaLinha } from './perfil-profile';
import { canonicalInputHash } from '@/lib/engine/cas';
import { extrairDefinicaoTreino, restaurarDefinicaoTreino, promoverDefinicaoTreino, desfazerDefinicaoTreino, type VersoesTreino } from './treino-versoes';
import { STORAGE_GENERATION, type ComandoSync, type MutacaoPerfil } from './sync-contrato';
import type { PerfilResumo } from '@/components/painel/Painel';
import { noDominioDoPeso } from '@/lib/peso-dominio';
import { fatoExercicioValido, temTentativaDeclarada } from './carga-schema';
import { mesclarTresVias } from './mescla';
const perfil = z.object({ perfil: perfilResumoSchema, expectedRevision: z.number().int().nonnegative(), entradaPlano: entradaPlanoVisivelSchema.optional(), consentimentos: consentimentosSchema.optional(), alvoId: z.string().max(100).optional(), base: z.object({ perfil: perfilResumoSchema, revision: z.number().int().nonnegative(), entradaPlano: entradaPlanoVisivelSchema.optional() }).optional() }).strict();
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === v && v >= '2020-01-01' && v <= new Date(Date.now() + 86400000).toISOString().slice(0, 10);
});
const sessaoV2 = sessaoHistoricoSchema.extend({ id: z.string().min(1).max(64), dataISO: dia }).superRefine((s, ctx) => {
    if (!s.tipo && !s.exercicios.some(temTentativaDeclarada)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['exercicios'], message: 'sessao_sem_tentativa_declarada' });
    if (!s.tipo)
        s.exercicios.forEach((e, i) => { if (!fatoExercicioValido(e, s.feedback))
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['exercicios', i], message: 'declaracao_de_execucao_invalida' }); });
});
export const comandoSyncSchema = z.object({
    schemaVersion: z.literal(2), operationId: z.string().uuid(), dependsOn: z.string().uuid().optional(), subject: z.string().uuid(), generation: z.literal(STORAGE_GENERATION),
}).and(z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('PERFIL'), payload: perfil }),
    z.object({ tipo: z.literal('APLICAR_TREINO'), payload: perfil }),
    z.object({ tipo: z.literal('DESFAZER_TREINO'), payload: perfil.extend({ alvoId: z.string().min(1).max(100) }) }),
    z.object({ tipo: z.literal('SESSAO'), payload: z.object({ sessao: sessaoV2, substituirBase: sessaoHistoricoSchema.optional() }) }),
    z.object({ tipo: z.literal('PESO'), payload: z.object({ pesoKg: z.number().refine(noDominioDoPeso), dataISO: dia }) }),
    z.object({ tipo: z.literal('ADERENCIA'), payload: aderenciaDiaSchema.extend({ dia, base: aderenciaDiaSchema.omit({ dia: true }) }) }),
    z.object({ tipo: z.literal('RASCUNHO_SESSAO'), payload: z.object({ id: z.string().min(1).max(100), expectedRevision: z.number().int().nonnegative(), estado: z.record(z.unknown()), base: z.record(z.unknown()).optional() }) }),
]));
export interface PayloadConta extends AgregadoPlano {
    armazenamento: {
        schemaVersion: 2;
        generation: typeof STORAGE_GENERATION;
        versoesTreino: VersoesTreino;
    };
}
export interface LinhaConta {
    revision: number;
    payload: AgregadoPlano | PayloadConta;
}
export function versoesDaConta(atual: LinhaConta): VersoesTreino {
    return 'armazenamento' in atual.payload ? atual.payload.armazenamento.versoesTreino
        : { atual: { id: `legado:${atual.revision}`, definicao: extrairDefinicaoTreino(atual.payload.entrada.perfil) } };
}
/** O servidor reconstrói com o montador existente. O cliente não envia planos executáveis.
 * Desfazer lê os fatos ATUAIS do servidor; alvo capturado não muda com um retry. */
export function prepararPerfil(subject: string, comando: ComandoSync, atual: LinhaConta | null) {
    const entrada = comando.payload as MutacaoPerfil;
    let perfil = entrada.perfil as PerfilResumo;
    let opcoes = entrada.entradaPlano;
    if (atual && entrada.base && comando.tipo !== 'DESFAZER_TREINO') {
        const m = mesclarTresVias(entrada.base.perfil, perfil, atual.payload.entrada.perfil);
        const o = mesclarTresVias(entrada.base.entradaPlano, opcoes, atual.payload.entrada.opcoes);
        if (m.conflitos.length || o.conflitos.length)
            return { erro: 'campos_concorrentes' } as const;
        if (!perfilResumoSchema.safeParse(m.valor).success || (o.valor && !entradaPlanoVisivelSchema.safeParse(o.valor).success))
            return { erro: 'validacao_conjunta' } as const;
        perfil = m.valor;
        opcoes = o.valor;
    }
    let versoes: VersoesTreino = atual ? versoesDaConta(atual)
        : { atual: { id: comando.operationId, definicao: extrairDefinicaoTreino(perfil) } };
    if (atual && comando.tipo === 'PERFIL' && canonicalInputHash(extrairDefinicaoTreino(perfil)) !== canonicalInputHash(versoes.atual.definicao)) {
        return { erro: 'aplicar_treino_necessario' } as const;
    }
    if (atual && comando.tipo === 'APLICAR_TREINO') {
        const r = promoverDefinicaoTreino(versoes, { id: comando.operationId, definicao: extrairDefinicaoTreino(perfil) });
        if (r.tipo !== 'CONFLITO_ALVO')
            versoes = r.versoes;
    }
    if (comando.tipo === 'DESFAZER_TREINO') {
        if (!atual || !entrada.alvoId)
            return { erro: 'alvo_desfazer_indisponivel' } as const;
        const r = desfazerDefinicaoTreino(versoes, entrada.alvoId, comando.operationId);
        if (r.tipo === 'CONFLITO_ALVO')
            return { erro: 'alvo_desfazer_mudou' } as const;
        versoes = r.versoes;
        perfil = restaurarDefinicaoTreino(atual.payload.entrada.perfil, versoes.atual.definicao);
    }
    const linha = entrada.consentimentos ? linhaComConsentimentos(perfilParaLinha(perfil), entrada.consentimentos, new Date().toISOString()) : perfilParaLinha(perfil);
    if (!entrada.consentimentos && atual) {
        for (const campo of ['aceite_18', 'aceite_termos', 'aceite_lgpd', 'aceite_em'] as const) {
            const valor = atual.payload.perfilLinha[campo];
            if (valor !== undefined)
                Object.assign(linha, { [campo]: valor });
        }
    }
    const plano = comandoCommitDePlano(subject, perfil, entrada.expectedRevision, comando.tipo === 'DESFAZER_TREINO' && atual ? atual.payload.entrada.opcoes : opcoes, linha);
    const payload: PayloadConta = { ...plano.aggregate, armazenamento: { schemaVersion: 2, generation: STORAGE_GENERATION, versoesTreino: versoes } };
    return { plano, payload } as const;
}
/** A representação normalizada contém somente JSON validado. Hash do comando, não do ACK. */
export function hashComando(comando: ComandoSync): string {
    return createHash('sha256').update(JSON.stringify(comando)).digest('hex');
}
