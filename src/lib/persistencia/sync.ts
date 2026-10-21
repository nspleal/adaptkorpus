'use client';

import { supabaseConfigurado } from '@/lib/supabase/env';
import { escopoLocal } from '@/lib/escopo-local';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { RegistroPeso, SessaoHistorico } from '@/lib/treino-historico';
import { hojeISO } from '@/lib/treino-historico';
import type { Consentimentos } from './perfil-profile';
import type { EntradaPlanoVisivel } from '@/lib/plano-cas-comando';
import { cabecalhosSync, type SnapshotConta } from './sync-contrato';
import { bancoSync, enfileirarOperacao, lerSnapshotRemoto } from './sync-cliente';
import { pesoKgDaResposta } from '@/lib/peso-dominio';
import { sincronizarConta } from './sync-cliente';
import { continuacaoDaConta } from './continuidade-conta';

async function getJson<T>(url: string): Promise<T | null> {
  const subject = escopoLocal();
  const ativo = continuacaoDaConta(escopoLocal, subject);
  if (!subject || !supabaseConfigurado()) return null;
  try {
    const init = { headers: cabecalhosSync(subject), cache: 'no-store' as const, signal: AbortSignal.timeout(10_000) };
    let r = await fetch(url, init);
    // Corrida de refresh pode produzir 401 transitório; nunca equivale a conta excluída.
    if (r.status === 401 && ativo()) {
      await new Promise((r) => setTimeout(r, 600));
      if (!ativo()) return null;
      r = await fetch(url, init);
    }
    if (!r.ok || !ativo()) return null;
    const corpo = await r.json() as T;
    return ativo() ? corpo : null;
  } catch { return null; }
}
export type PerfilServidor = SnapshotConta;
export type ResultadoSalvarPerfil =
  | { tipo: 'CONFIRMADO'; revision: number; entradaPlano: EntradaPlanoVisivel }
  | { tipo: 'CONFLITO_REVISAO'; revisaoAtual: number }
  | { tipo: 'CONFLITO_VERSAO_OU_HASH' }
  | { tipo: 'PENDENTE' }
  | { tipo: 'FALHA' };
export async function carregarPerfilServidor(): Promise<PerfilServidor | 'sem_perfil' | null> {
  const subject = escopoLocal();
  if (!subject || !supabaseConfigurado()) return null;
  return lerSnapshotRemoto(subject);
}
export async function salvarPerfilServidor(perfil: PerfilResumo, expectedRevision: number, entradaPlano?: EntradaPlanoVisivel, consentimentos?: Consentimentos, opcoes?: { aguardarConfirmacao: boolean }): Promise<ResultadoSalvarPerfil> {
  const subject = escopoLocal();
  const ativo = continuacaoDaConta(escopoLocal, subject);
  if (!subject) return { tipo: 'FALHA' };
  try {
    const { comando, recibo } = await enfileirarOperacao({ tipo: 'PERFIL', payload: { perfil, expectedRevision, entradaPlano, consentimentos } }, { expectedSubject: subject, ativo, aguardarConfirmacao: opcoes?.aguardarConfirmacao });
    if (!ativo()) return { tipo: 'FALHA' };
    if (!comando) return { tipo: 'FALHA' };
    if (recibo?.tipo === 'CONFLITO') return { tipo: 'CONFLITO_REVISAO', revisaoAtual: recibo.revision ?? expectedRevision };
    if (recibo?.tipo !== 'ACK') return { tipo: 'PENDENTE' };
    const atual = await carregarPerfilServidor();
    if (!ativo()) return { tipo: 'FALHA' };
    if (!atual || atual === 'sem_perfil' || !atual.entradaPlano) return { tipo: 'PENDENTE' };
    return { tipo: 'CONFIRMADO', revision: atual.revision, entradaPlano: atual.entradaPlano };
  } catch { return { tipo: 'FALHA' }; }
}

export async function carregarHistoricoServidor(): Promise<SessaoHistorico[] | null> {
  const paginas = await todasPaginas<{ sessoes: SessaoHistorico[] }>('/api/dados/historico');
  return paginas?.flatMap((p) => p.sessoes) ?? null;
}
export async function enviarSessaoTreino(sessao: SessaoHistorico | null): Promise<boolean> {
  const ativo = continuacaoDaConta(escopoLocal);
  if (!sessao?.id) return false; // legado sem autoria/identidade não é reimportado
  const { recibo } = await enfileirarOperacao({ tipo: 'SESSAO', payload: { sessao } });
  return ativo() && recibo?.tipo === 'ACK';
}
export type DiaAderencia = { logs: Record<string, unknown>; notes: Record<string, string> };
export async function carregarAderenciaServidor(): Promise<Record<string, DiaAderencia> | null> {
  const subject = escopoLocal();
  const ativo = continuacaoDaConta(escopoLocal, subject);
  if (!subject) return null;
  const paginas = await todasPaginas<{ dias: Record<string, DiaAderencia> }>('/api/dados/aderencia');
  if (!ativo()) return null;
  const r = paginas ? { dias: Object.assign({}, ...paginas.map((p) => p.dias)) as Record<string, DiaAderencia> } : null;
  if (r && subject) {
    const db = await bancoSync();
    if (!ativo()) return null;
    const anteriores = await db.ler<Record<string, DiaAderencia>>(subject, 'aderenciaBase') ?? {};
    if (!ativo()) return null;
    const pendentes = new Set((await db.listar(subject)).flatMap((i) => i.comando.tipo === 'ADERENCIA' && !i.substituidoPor ? [i.comando.payload.dia] : []));
    if (!ativo()) return null;
    const bases = { ...anteriores };
    for (const [dia, valor] of Object.entries(r.dias)) if (!pendentes.has(dia)) bases[dia] = valor;
    await db.guardar(subject, 'aderenciaBase', bases);
  }
  return ativo() ? r?.dias ?? null : null;
}
export async function salvarAderenciaDia(dia: string, logs: Record<string, unknown>, notes: Record<string, string>): Promise<boolean> {
  const subject = escopoLocal(); if (!subject || !supabaseConfigurado()) return false;
  const ativo = continuacaoDaConta(escopoLocal, subject);
  const db = await bancoSync();
  if (!ativo()) return false;
  const bases = await db.ler<Record<string, DiaAderencia>>(subject, 'aderenciaBase') ?? {};
  if (!ativo()) return false;
  const fila = await db.listar(subject); if (!ativo()) return false;
  const ultima = [...fila].reverse().find(i => i.comando.tipo === 'ADERENCIA' && i.comando.payload.dia === dia && !i.substituidoPor);
  const base = ultima?.comando.tipo === 'ADERENCIA' ? { logs: ultima.comando.payload.logs, notes: ultima.comando.payload.notes } : bases[dia] ?? { logs: {}, notes: {} };
  const { recibo } = await enfileirarOperacao({ tipo: 'ADERENCIA', payload: { dia, logs, notes, base } }, { expectedSubject: subject, ativo });
  return ativo() && recibo?.tipo === 'ACK';
}
export async function carregarPesosServidor(): Promise<RegistroPeso[] | null> {
  const paginas = await todasPaginas<{ pesos: RegistroPeso[] }>('/api/dados/peso');
  return paginas?.flatMap((p) => p.pesos) ?? null;
}
export type ResultadoPesoServidor =
  | { tipo: 'REGISTRADO' }
  | { tipo: 'IDEMPOTENTE'; pesoKg: number }
  | { tipo: 'RECUSADO_DIA'; pesoKg: number | null }
  | { tipo: 'PENDENTE' }
  | { tipo: 'AGUARDANDO_DIA'; pesoKg: number }
  | { tipo: 'FALHA' };
export async function registrarPesoServidor(pesoKg: number, dataISO?: string | null): Promise<ResultadoPesoServidor> {
  try {
    const subject = escopoLocal(); if (!subject || !supabaseConfigurado()) return { tipo: 'FALHA' };
    const ativo = continuacaoDaConta(escopoLocal, subject);
    const db = await bancoSync(), dia = dataISO ?? hojeISO();
    if (!ativo()) return { tipo: 'FALHA' };
    const pendente = (await db.listar(subject)).find((i) => i.comando.tipo === 'PESO' && i.comando.payload.dataISO === dia && !i.recibo);
    if (!ativo()) return { tipo: 'FALHA' };
    if (pendente?.comando.tipo === 'PESO' && pendente.comando.payload.pesoKg !== pesoKg) return { tipo: 'AGUARDANDO_DIA', pesoKg: pendente.comando.payload.pesoKg };
    let resultado;
    if (pendente) {
      await sincronizarConta(subject).catch(() => undefined); if (!ativo()) return { tipo: 'FALHA' };
      resultado = { comando: pendente.comando, recibo: await db.ler<import('./sync-contrato').ReciboSync>(subject, `recibo:${pendente.comando.operationId}`) };
    } else resultado = await enfileirarOperacao({ tipo: 'PESO', payload: { pesoKg, dataISO: dia } }, { expectedSubject: subject, ativo });
    if (!ativo()) return { tipo: 'FALHA' };
    const { comando, recibo } = resultado;
    if (recibo?.tipo === 'ACK') return recibo.estado === 'IDEMPOTENTE' ? { tipo: 'IDEMPOTENTE', pesoKg: pesoKgDaResposta(recibo.pesoKg) ?? pesoKg } : { tipo: 'REGISTRADO' };
    if (recibo?.tipo === 'RECUSADO' && recibo.motivo === 'peso_ja_registrado_hoje') return { tipo: 'RECUSADO_DIA', pesoKg: pesoKgDaResposta(recibo.pesoKg) };
    return { tipo: comando ? 'PENDENTE' : 'FALHA' };
  } catch { return { tipo: 'FALHA' }; }
}
export async function consultarAcesso(): Promise<{ liberado: boolean; via: string | null } | null> {
  return getJson('/api/acesso');
}

async function todasPaginas<T>(url: string): Promise<T[] | null> {
  const subject = escopoLocal(), paginas: T[] = [], vistos = new Set<string>();
  const ativo = continuacaoDaConta(escopoLocal, subject);
  let cursor: string | null = null;
  do {
    const p: (T & { nextCursor?: string | null }) | null = await getJson<T & { nextCursor?: string | null }>(url + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''));
    if (!p || !ativo()) return null; // página falha nunca se apresenta como histórico completo
    paginas.push(p); cursor = p.nextCursor ?? null;
    if (cursor && vistos.has(cursor)) return null;
    if (cursor) vistos.add(cursor);
  } while (cursor);
  return paginas;
}
