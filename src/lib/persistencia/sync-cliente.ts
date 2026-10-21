'use client';
import { escopoLocal, chaveLocal } from '@/lib/escopo-local';
import { supabaseConfigurado, supabaseUrl } from '@/lib/supabase/env';
import { OutboxDB } from './outbox-db';
import { consultarIdentidadeSync, drenarOutbox } from './outbox-sync';
import { cabecalhosSync, novoComando, EVENTO_FATOS, EVENTO_FECHAR_SESSAO, type ComandoSync, type ReciboSync, type SnapshotConta } from './sync-contrato';
import { manterLocalNosConflitos, mesclarTresVias } from './mescla';
import { perfilResumoSchema } from '@/lib/validation/perfil-resumo';
import { entradaPlanoVisivelSchema } from '@/lib/validation/plano-entrada';
import { continuacaoDaConta } from './continuidade-conta';
import { extrairDefinicaoTreino } from './treino-versoes';

export const EVENTO_SYNC = 'evk:sync-v2';
let banco: Promise<OutboxDB> | undefined;
const emVoo = new Map<string, { ativo: () => boolean; promessa: Promise<void> }>();
export function bancoSync(): Promise<OutboxDB> {
  banco ??= OutboxDB.abrir(supabaseConfigurado() ? new URL(supabaseUrl()).hostname : 'mock').catch((e) => { banco = undefined; throw e; });
  return banco;
}
function notificar() { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_SYNC)); }
export async function lerSnapshotRemoto(subject: string): Promise<SnapshotConta | 'sem_perfil' | null> {
  const ativo = continuacaoDaConta(escopoLocal, subject);
  if (!ativo()) return null;
  try {
    const r = await fetch('/api/dados/perfil', { headers: cabecalhosSync(subject), cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!ativo()) return null;
    if (r.status === 404) return 'sem_perfil';
    if (!r.ok) return null;
    const j = await r.json() as SnapshotConta;
    if (!ativo() || !j.perfil || !Number.isSafeInteger(j.revision) || j.revision < 0) return null;
    const db = await bancoSync(); if (!ativo()) return null;
    const confirmado = await db.guardarSnapshot(subject, j);
    return ativo() ? confirmado : null;
  } catch { return null; }
}

/** Só um conflito definitivo pode ser rebased. Os mesmos campos exigem escolha da pessoa;
 * uma combinação aparentemente independente ainda passa nas mesmas bordas do produto. */
async function reconciliarPrimeiro(db: OutboxDB, subject: string, ativo: () => boolean): Promise<boolean> {
  const item = (await db.listar(subject)).find((i) => i.recibo?.tipo === 'CONFLITO' && !i.substituidoPor);
  if (!ativo()) return false;
  if (!item || item.recibo?.tipo !== 'CONFLITO') return false;
  if (!['revisao','base_dependencia_mudou','rascunho_alterado','campos_concorrentes'].includes(item.recibo.motivo)) return false;
  if (item.comando.tipo === 'RASCUNHO_SESSAO') {
    const { remoto } = await db.lerRascunhosSessao(subject);
    if (!ativo()) return false;
    const c = item.comando;
    if (!remoto || !c.payload.base || remoto.estado.sessaoId !== c.payload.estado.sessaoId) return false;
    const servidor = remoto.estado as unknown as Record<string, unknown>;
    const m = mesclarTresVias(c.payload.base, c.payload.estado, servidor);
    if (m.conflitos.length) return false;
    const novo = novoComando(subject, { tipo: 'RASCUNHO_SESSAO', payload: { ...c.payload, expectedRevision: remoto.revision, estado: m.valor, base: servidor } });
    return await db.resolver(subject, c.operationId, novo) && ativo();
  }
  if (!['PERFIL','APLICAR_TREINO'].includes(item.comando.tipo)) return false;
  const comando = item.comando as Extract<ComandoSync, { tipo: 'PERFIL' | 'APLICAR_TREINO' | 'DESFAZER_TREINO' }>;
  const base = comando.payload.base ?? await db.ler<SnapshotConta>(subject, `base:${comando.operationId}`);
  if (!ativo()) return false;
  const remoto = await lerSnapshotRemoto(subject);
  if (!ativo() || !base || !remoto || remoto === 'sem_perfil') return false;
  const perfil = mesclarTresVias(base.perfil, comando.payload.perfil, remoto.perfil);
  const entrada = mesclarTresVias(base.entradaPlano, comando.payload.entradaPlano, remoto.entradaPlano);
  if (perfil.conflitos.length || entrada.conflitos.length || !perfilResumoSchema.safeParse(perfil.valor).success || (entrada.valor && !entradaPlanoVisivelSchema.safeParse(entrada.valor).success)) return false;
  const novo = novoComando(subject, { tipo: comando.tipo, payload: { ...comando.payload, perfil: perfil.valor, expectedRevision: remoto.revision, entradaPlano: entrada.valor, base: remoto } });
  return await db.resolver(subject, comando.operationId, novo, remoto) && ativo();
}
export async function sincronizarConta(subject = escopoLocal()): Promise<void> {
  if (!subject || !supabaseConfigurado()) return;
  const ativo = continuacaoDaConta(escopoLocal, subject);
  if (!ativo()) return;
  const anterior = emVoo.get(subject); if (anterior?.ativo()) return anterior.promessa;
  const trabalho = async () => {
    const db = await bancoSync();
    if (!ativo()) return;
    const antes = JSON.stringify(await db.listar(subject));
    if (!ativo()) return;
    const { capturarRascunho } = await import('./rascunho-sessao');
    if (!ativo()) return;
    try { await capturarRascunho(db, subject); } catch { /* edição mais nova preservou dirty; próximo ciclo captura */ }
    for (let n = 0; n < 5 && ativo(); n++) {
      await drenarOutbox(db, subject, ativo);
      if (!ativo() || !await reconciliarPrimeiro(db, subject, ativo)) break;
    }
    const depois = JSON.stringify(await db.listar(subject));
    if (ativo() && antes !== depois) notificar();
  };
  const registro = { ativo, promessa: Promise.resolve() };
  registro.promessa = Promise.resolve().then(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request(`evk-sync:${subject}`, trabalho);
      else await trabalho();
    } finally { if (emVoo.get(subject) === registro) emVoo.delete(subject); }
  });
  emVoo.set(subject, registro); return registro.promessa;
}

export async function enfileirarOperacao(operacao: Parameters<typeof novoComando>[1], opcoes?: { aguardarConfirmacao?: boolean; expectedSubject?: string; ativo?: () => boolean }): Promise<{ comando?: ComandoSync; recibo?: ReciboSync }> {
  const subject = escopoLocal();
  const ativo = continuacaoDaConta(escopoLocal, subject, opcoes?.ativo);
  if (!subject || !ativo() || !supabaseConfigurado() || (opcoes?.expectedSubject && opcoes.expectedSubject !== subject)) return {};
  const db = await bancoSync();
  if (!ativo()) return {};
  let comando = novoComando(subject, operacao);
  if (comando.tipo === 'SESSAO') {
    const { capturarRascunho } = await import('./rascunho-sessao');
    if (!ativo()) return {};
    await capturarRascunho(db, subject);
    if (!ativo()) return {};
  }
  const base = await db.ler<SnapshotConta>(subject, 'snapshot');
  if (!ativo()) return {};
  const selado = await db.enfileirar(comando,
    ['PERFIL','APLICAR_TREINO','DESFAZER_TREINO'].includes(comando.tipo)
      ? { chave: 'intentPerfil', valor: comando.payload }
      : undefined, { base: comando.tipo !== 'SESSAO' ? base : undefined,
        definicaoAplicada: comando.tipo === 'APLICAR_TREINO' ? extrairDefinicaoTreino(comando.payload.perfil) : undefined });
  if (!selado || !ativo()) return {};
  comando = selado;
  notificar();
  if (opcoes?.aguardarConfirmacao === false) {
    void sincronizarConta(subject).catch(() => undefined);
    return { comando };
  }
  try { await sincronizarConta(subject); } catch { /* comando durable permanece pendente */ }
  if (!ativo()) return {};
  const recibo = await db.ler<ReciboSync>(subject, `recibo:${comando.operationId}`);
  return ativo() ? { comando, recibo } : {};
}

/** Destrutivo só para o conflito escolhido, já recusado pelo servidor; nunca para envio
 * incerto. A opção local usa um NOVO comando sobre a revisão atual, sem reusar o ID. */
export async function escolherConflito(subject: string, operationId: string, escolha: 'local' | 'servidor'): Promise<void> {
  const ativo = continuacaoDaConta(escopoLocal, subject);
  if (!ativo()) return;
  const db = await bancoSync(); if (!ativo()) return;
  const item = (await db.listar(subject)).find(i => i.comando.operationId === operationId);
  if (!ativo() || !item || !item.recibo || item.substituidoPor || (item.recibo.tipo !== 'CONFLITO' && escolha !== 'servidor')) return;
  if (escolha === 'servidor') {
    let fecharSessao: { id: string; geracao: number } | undefined;
    if (item.comando.tipo === 'RASCUNHO_SESSAO') {
      const antes = await db.lerRascunhosSessao(subject); if (!ativo()) return;
      const id = String(item.comando.payload.estado.sessaoId);
      // Resolver pendência antiga não pode substituir outro treino já aberto neste dispositivo.
      if (!antes.local || antes.local.sessaoId === id || antes.local.encerrado) {
        const identidade = await consultarIdentidadeSync(subject); if (!ativo()) return;
        if (!identidade) throw new Error('conferencia_indisponivel');
        const geracao = await db.guardarRascunhoRemoto(subject, identidade.rascunho ?? null, antes.geracao);
        if (!ativo()) return;
        if (geracao === undefined) throw new Error('rascunho_mudou_confira_novamente');
        const atual = await db.lerRascunhosSessao(subject); if (!ativo()) return;
        if (atual.geracao !== geracao) throw new Error('rascunho_mudou_confira_novamente');
        const remoto = atual.remoto;
        const aceitou = remoto
          ? await db.guardarRascunhoSessao(subject, { ...remoto.estado, localVersion: crypto.randomUUID(), dirty: false, baseRevision: remoto.revision, baseEstado: remoto.estado }, geracao)
          : await db.encerrarSessao(subject, id, geracao);
        if (!ativo()) return;
        if (!aceitou) throw new Error('rascunho_mudou_confira_novamente');
        const aplicado = await db.lerRascunhosSessao(subject); if (!ativo()) return;
        if (antes.local?.sessaoId === id) fecharSessao = { id: aplicado.local?.sessaoId ?? id, geracao: aplicado.geracao };
      }
    }
    if (item.comando.tipo === 'ADERENCIA') {
      const { carregarAderenciaServidor } = await import('./sync'); if (!ativo()) return;
      const dias = await carregarAderenciaServidor(); if (!ativo()) return;
      if (!dias) throw new Error('conferencia_indisponivel');
      const atual = JSON.parse(localStorage.getItem(chaveLocal('evk_aderencia')) ?? '{}') as Record<string, unknown>;
      atual[item.comando.payload.dia] = { ...dias[item.comando.payload.dia] ?? { logs: {}, notes: {} }, pendenteSync: false };
      localStorage.setItem(chaveLocal('evk_aderencia'), JSON.stringify(atual));
      window.dispatchEvent(new Event(EVENTO_FATOS));
    }
    await db.resolver(subject, operationId); if (!ativo()) return;
    if (fecharSessao) {
      const atual = await db.lerRascunhosSessao(subject); if (!ativo()) return;
      if (atual.geracao === fecharSessao.geracao && (!atual.local || atual.local.sessaoId === fecharSessao.id))
        window.dispatchEvent(new Event(EVENTO_FECHAR_SESSAO));
    }
    notificar(); return;
  }
  let novo: ComandoSync | undefined, baseNova: SnapshotConta | undefined;
  if (item.comando.tipo === 'SESSAO') {
    const { carregarHistoricoServidor } = await import('./sync'); if (!ativo()) return;
    const historico = await carregarHistoricoServidor(); if (!ativo() || !historico) return;
    const substituirBase = historico.find(s => s.id === (item.comando.payload as { sessao: { id?: string } }).sessao.id);
    novo = novoComando(subject, { tipo: 'SESSAO', payload: { sessao: item.comando.payload.sessao, substituirBase } });
  } else if (item.comando.tipo === 'ADERENCIA') {
    const { carregarAderenciaServidor } = await import('./sync'); if (!ativo()) return;
    const dias = await carregarAderenciaServidor(); if (!ativo() || !dias) return;
    const remoto = dias[item.comando.payload.dia] ?? { logs: {}, notes: {} };
    const local = { logs: item.comando.payload.logs, notes: item.comando.payload.notes };
    const resolvido = manterLocalNosConflitos(item.comando.payload.base, local, remoto);
    novo = novoComando(subject, { tipo: 'ADERENCIA', payload: { dia: item.comando.payload.dia, ...resolvido, base: remoto } });
  } else if (item.comando.tipo === 'RASCUNHO_SESSAO') {
    const { local, remoto } = await db.lerRascunhosSessao(subject); if (!ativo()) return;
    const c = item.comando;
    if (local && !local.encerrado && local.sessaoId !== c.payload.estado.sessaoId) throw new Error('outro_treino_em_andamento');
    const servidor = remoto?.estado as unknown as Record<string, unknown> | undefined;
    const estado = servidor && c.payload.base && servidor.sessaoId === c.payload.estado.sessaoId ? manterLocalNosConflitos(c.payload.base, c.payload.estado, servidor) : c.payload.estado;
    novo = novoComando(subject, { tipo: 'RASCUNHO_SESSAO', payload: { ...c.payload, estado, expectedRevision: remoto?.revision ?? 0, base: servidor } });
  } else {
    const remoto = await lerSnapshotRemoto(subject); if (!ativo() || !remoto || remoto === 'sem_perfil') return;
    if (item.comando.tipo === 'PERFIL' || item.comando.tipo === 'APLICAR_TREINO') {
      const base = item.comando.payload.base ?? await db.ler<SnapshotConta>(subject, 'base:' + operationId);
      if (!ativo() || !base) return;
      const perfil = manterLocalNosConflitos(base.perfil, item.comando.payload.perfil, remoto.perfil);
      const entradaPlano = manterLocalNosConflitos(base.entradaPlano, item.comando.payload.entradaPlano, remoto.entradaPlano);
      novo = novoComando(subject, { tipo: item.comando.tipo, payload: { ...item.comando.payload, perfil, entradaPlano, expectedRevision: remoto.revision, base: remoto } });
      baseNova = remoto;
    }
  }
  if (!ativo()) return;
  if (novo && !await db.resolver(subject, operationId, novo, baseNova)) throw new Error('sessao_ja_encerrada');
  if (!ativo()) return;
  // Desfazer conserva o alvo; resultado incerto conserva o ID original.
  await sincronizarConta(subject);
  if (ativo()) notificar();
}
