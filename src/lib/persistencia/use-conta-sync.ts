'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { EntradaPlanoVisivel } from '@/lib/plano-cas-comando';
import { resolverEscopoLocal, escopoLocal, definirEscopoLocal } from '@/lib/escopo-local';
import { createClient } from '@/lib/supabase/client';
import { supabaseConfigurado } from '@/lib/supabase/env';
import { lerSessaoCompleta, salvarSessao } from '@/lib/session';
import { canonicalInputHash } from '@/lib/engine/cas';
import { extrairDefinicaoTreino, restaurarDefinicaoTreino } from './treino-versoes';
import { bancoSync, enfileirarOperacao, lerSnapshotRemoto, sincronizarConta, EVENTO_SYNC } from './sync-cliente';
import { manterLocalNosConflitos, mesclarTresVias } from './mescla';
import type { ItemOutbox } from './outbox-db';
import type { MutacaoPerfil, SnapshotConta } from './sync-contrato';
import { consultarAcesso } from './sync';
import { atualizarFatosConta } from './fatos-conta';
import { registrarEvento } from '@/lib/metricas/registrar';
import { EVENTO_PLANO_ATUALIZADO, revisaoRemotaMaisNova } from './sincronizacao-plano';
import type { EstadoAutenticacaoSync } from './outbox-sync';
import { continuacaoDaConta, invalidarContinuacoesConta } from './continuidade-conta';

interface RascunhoTreino { base: SnapshotConta; perfil: PerfilResumo; entradaPlano?: EntradaPlanoVisivel }
interface ContextoConta { subject: string | null; valido: () => boolean }
const igual = (a: unknown, b: unknown) => canonicalInputHash(a ?? null) === canonicalInputHash(b ?? null);
export function useContaSync() {
  const router = useRouter();
  const [visivel, setVisivel] = useState<SnapshotConta | null>(null);
  const [oficial, setOficial] = useState<SnapshotConta | null>(null);
  const [rascunho, setRascunho] = useState<RascunhoTreino | null>(null);
  const [fila, setFila] = useState<ItemOutbox[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [estadoAutenticacao, setEstadoAutenticacao] = useState<EstadoAutenticacaoSync | null>(null);
  const [conflitoRascunho, setConflitoRascunho] = useState<string[]>([]);
  const [epoch, setEpoch] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const donoRef = useRef<string | null>(null);
  const geracaoRef = useRef(0), authSubjectRef = useRef<string | null | undefined>(undefined);
  const oficialRef = useRef<SnapshotConta | null>(null), rascunhoRef = useRef<RascunhoTreino | null>(null);
  const uiRef = useRef<SnapshotConta | null>(null);
  const ocupadoRef = useRef(false), atualizandoRef = useRef(false), vivoRef = useRef(true);
  const atualizarPendenteRef = useRef(false);
  const capturarContexto = useCallback((): ContextoConta => {
    const subject = escopoLocal(), geracao = geracaoRef.current;
    return { subject, valido: continuacaoDaConta(escopoLocal, subject, () => vivoRef.current && geracaoRef.current === geracao
      && (!supabaseConfigurado() || donoRef.current === subject)) };
  }, []);
  const donoDaTela = escopoLocal(), geracaoDaTela = geracaoRef.current;
  const aoOcupado = useCallback((v: boolean) => {
    if (!vivoRef.current || geracaoRef.current !== geracaoDaTela || escopoLocal() !== donoDaTela
      || (supabaseConfigurado() && donoRef.current !== donoDaTela)) return;
    ocupadoRef.current = v; setOcupado(v);
  }, [donoDaTela, geracaoDaTela]);
  const guardarRascunho = useCallback(async (ctx: ContextoConta, r: RascunhoTreino | null): Promise<boolean> => {
    const db = await bancoSync();
    if (!ctx.subject || !ctx.valido()) return false;
    await db.guardar(ctx.subject, 'rascunhoTreino', r);
    if (!ctx.valido()) return false;
    rascunhoRef.current = r; setRascunho(r);
    return true;
  }, []);

  const atualizar = useCallback(async (): Promise<void> => {
    const ctx = capturarContexto(), { subject, valido } = ctx;
    if (!subject || !supabaseConfigurado() || !valido()) return;
    if (atualizandoRef.current) { atualizarPendenteRef.current = true; return; }
    atualizandoRef.current = true;
    try {
      const db = await bancoSync();
      if (!valido()) return;
      try { await sincronizarConta(subject); } catch { /* offline é pendência, não exclusão */ }
      if (!valido()) return;
      await atualizarFatosConta(db, subject);
      if (!valido()) return;
      const estadoAuth = await db.ler<EstadoAutenticacaoSync>(subject, 'estadoSync') ?? null;
      if (!valido()) return;
      const avisoRecusa = await db.ler<string>(subject, 'avisoRecusa') ?? null;
      if (!valido()) return;
      const pendentes = await db.listar(subject);
      if (!valido()) return;
      const remoto = await lerSnapshotRemoto(subject);
      if (!valido()) return;
      setEstadoAutenticacao(estadoAuth); setAviso(avisoRecusa);
      setFila(pendentes);
      if (!remoto || remoto === 'sem_perfil') return;
      const anterior = oficialRef.current;
      oficialRef.current = remoto; setOficial(remoto);
      // Confirmação de um Aplicar limpa somente a edição que ELE enviou. Edição posterior fica.
      const aplicacao = await db.ler<{ operationId: string; definicao: unknown }>(subject, 'aplicacaoPendente');
      if (!valido()) return;
      if (aplicacao) {
        const recibo = await db.ler<{ tipo: string }>(subject, `recibo:${aplicacao.operationId}`);
        if (!valido()) return;
        if (recibo?.tipo === 'ACK' && rascunhoRef.current && igual(extrairDefinicaoTreino(rascunhoRef.current.perfil), aplicacao.definicao)) {
          await guardarRascunho(ctx, null);
          if (!valido()) return;
          await db.guardar(subject, 'aplicacaoPendente', null);
          if (!valido()) return;
        }
      }
      let mostra = remoto;
      const r = rascunhoRef.current;
      if (r) {
        const m = mesclarTresVias(extrairDefinicaoTreino(r.base.perfil), extrairDefinicaoTreino(r.perfil), extrairDefinicaoTreino(remoto.perfil));
        if (m.conflitos.length) { setConflitoRascunho(m.conflitos); return; }
        const novo = { ...r, base: remoto, perfil: restaurarDefinicaoTreino(remoto.perfil,m.valor), entradaPlano: remoto.entradaPlano };
        await guardarRascunho(ctx, novo); mostra = { ...remoto, perfil: novo.perfil, entradaPlano: novo.entradaPlano ?? remoto.entradaPlano };
      }
      if (!valido()) return;
      // Formulário/sessão em curso mantém sua cópia; próxima volta aplica o estado confirmado.
      if (!ocupadoRef.current && !pendentes.some((i) => ['PERFIL','APLICAR_TREINO','DESFAZER_TREINO'].includes(i.comando.tipo))) {
        const mudou = !igual(uiRef.current?.perfil, mostra.perfil) || !igual(uiRef.current?.entradaPlano, mostra.entradaPlano);
        uiRef.current = mostra;
        salvarSessao(mostra.perfil, mostra.entradaPlano);
        if (mudou) setEpoch((n) => n + 1);
        setVisivel(mostra);
      }
      if (anterior && remoto.revision > anterior.revision) setErro(null);
    } catch { if (valido()) setErro('Não foi possível acessar o armazenamento. Mantenha esta tela aberta e tente novamente.'); }
    finally {
      atualizandoRef.current = false;
      if (atualizarPendenteRef.current && valido()) { atualizarPendenteRef.current = false; queueMicrotask(() => { if (valido()) void atualizar(); }); }
    }
  }, [guardarRascunho, capturarContexto]);

  useEffect(() => {
    vivoRef.current = true;
    let cancelado = false;
    const geracao = geracaoRef.current;
    const vivo = () => !cancelado && vivoRef.current && geracaoRef.current === geracao;
    void (async () => {
      if (!supabaseConfigurado()) {
        const local = lerSessaoCompleta();
        if (!local) { router.replace('/onboarding'); return; }
        const s = { ...local, revision: 0 }; oficialRef.current = s; uiRef.current = s; setOficial(s); setVisivel(s); return;
      }
      const subject = await resolverEscopoLocal();
      if (!vivo() || (authSubjectRef.current !== undefined && authSubjectRef.current !== subject)) return;
      donoRef.current = subject;
      if (!subject) { router.replace('/login'); return; }
      const ctx = capturarContexto();
      const valido = () => vivo() && ctx.valido();
      const db = await bancoSync();
      if (!valido()) return;
      const acesso = await consultarAcesso();
      if (!valido()) return;
      if (acesso && !acesso.liberado) { router.replace('/acesso-restrito?motivo=assinatura'); return; }
      let remoto = await lerSnapshotRemoto(subject);
      if (!valido()) return;
      const pendentes = await db.listar(subject);
      if (!valido()) return;
      const cached = await db.ler<SnapshotConta>(subject, 'snapshot');
      if (!valido()) return;
      const intent = await db.ler<MutacaoPerfil>(subject, 'intentPerfil');
      if (!valido()) return;
      if (remoto === 'sem_perfil' && !pendentes.length) { router.replace('/onboarding'); return; }
      if (!remoto || remoto === 'sem_perfil') remoto = cached ?? (intent && pendentes.length ? { perfil: intent.perfil, revision: intent.expectedRevision, entradaPlano: intent.entradaPlano } : null);
      if (!remoto) { setErro('Conecte-se uma vez para validar a conta e carregar seus dados neste dispositivo.'); return; }
      const r = await db.ler<RascunhoTreino | null>(subject, 'rascunhoTreino') ?? null;
      if (!valido()) return;
      oficialRef.current = remoto; setOficial(remoto); rascunhoRef.current = r; setRascunho(r); setFila(pendentes);
      const pendentePerfil = [...pendentes].reverse().find((i) => !i.substituidoPor && ['PERFIL','APLICAR_TREINO'].includes(i.comando.tipo));
      const intencao = pendentePerfil?.comando.payload as MutacaoPerfil | undefined;
      let mostra = intencao ? { ...remoto, perfil: intencao.perfil, entradaPlano: intencao.entradaPlano ?? remoto.entradaPlano } : remoto;
      if (r) mostra = { ...mostra, perfil: restaurarDefinicaoTreino(mostra.perfil,extrairDefinicaoTreino(r.perfil)) };
      uiRef.current = mostra; setVisivel(mostra);
      registrarEvento('app_aberto', { rota: '/app' });
      await atualizar();
    })().catch(() => { if (vivo()) setErro('O armazenamento local não está disponível. Nenhuma confirmação de salvamento foi feita.'); });
    return () => { cancelado = true; vivoRef.current = false; geracaoRef.current += 1; };
  }, [router, atualizar, capturarContexto]);

  useEffect(() => {
    if (!supabaseConfigurado()) return;
    const aoVoltar = () => { if (document.visibilityState !== 'hidden') void atualizar(); };
    window.addEventListener('online', aoVoltar); window.addEventListener('focus', aoVoltar);
    window.addEventListener(EVENTO_SYNC, aoVoltar); document.addEventListener('visibilitychange', aoVoltar);
    const timer = setInterval(aoVoltar, 30_000);
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      void createClient().realtime.setAuth(session?.access_token).catch(() => undefined);
      authSubjectRef.current = session?.user.id ?? null;
      const anterior = escopoLocal();
      const dono = donoRef.current ?? anterior;
      if (dono && session?.user.id !== dono) {
        // Logout pode ter pausado o escopo antes de chegar o evento de outra conta.
        if (!anterior && session?.user.id) invalidarContinuacoesConta();
        geracaoRef.current += 1; donoRef.current = null;
        atualizarPendenteRef.current = false;
        oficialRef.current = null; uiRef.current = null; rascunhoRef.current = null;
        definirEscopoLocal(null); setVisivel(null); setOficial(null); setRascunho(null);
        setFila([]); setAviso(null); setErro(null); setConflitoRascunho([]); setEstadoAutenticacao(null);
        router.replace('/login');
      } else if (!anterior && donoRef.current === null && session?.user.id) {
        // INITIAL_SESSION também invalida um getSession antigo iniciado sem escopo.
        // Escolhe somente a gaveta; o envio continua exigindo identidade validada pelo servidor.
        definirEscopoLocal(session.user.id);
      }
    });
    return () => { clearInterval(timer); subscription.unsubscribe(); window.removeEventListener('online', aoVoltar); window.removeEventListener('focus', aoVoltar); window.removeEventListener(EVENTO_SYNC, aoVoltar); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [atualizar, router]);

  const montado = !!visivel;
  useEffect(() => {
    const subject = escopoLocal(); if (!montado || !subject || !supabaseConfigurado()) return;
    const cliente = createClient(); let cancelado = false;
    const ctx = capturarContexto();
    const valido = () => !cancelado && ctx.valido();
    let canal: ReturnType<typeof cliente.channel> | undefined;
    void (async () => {
      const { data: { session } } = await cliente.auth.getSession();
      if (!session || !valido() || session.user.id !== subject) return;
      await cliente.realtime.setAuth(session.access_token);
      if (!valido()) return;
      canal = cliente.channel(`user:${subject}:plano`,{ config:{ private:true } })
        .on('broadcast',{event:EVENTO_PLANO_ATUALIZADO},({payload}) => {
          if (valido() && revisaoRemotaMaisNova(oficialRef.current?.revision ?? 0,payload) !== null) void atualizar();
        }).subscribe();
      if (cancelado && canal) void cliente.removeChannel(canal);
    })().catch(() => undefined);
    return () => { cancelado = true; if (canal) void cliente.removeChannel(canal); };
  }, [montado,atualizar,capturarContexto]);

  async function editar(perfil: PerfilResumo, entrada: EntradaPlanoVisivel) {
    const ctx = capturarContexto(); if (!ctx.valido()) return;
    const base = oficialRef.current; if (!base) return;
    const baseUI = uiRef.current ?? base;
    uiRef.current = { ...base, perfil, entradaPlano: entrada };
    const subject = ctx.subject;
    const mudouEstrutura = !igual(extrairDefinicaoTreino(base.perfil), extrairDefinicaoTreino(perfil));
    if (!subject || !supabaseConfigurado()) { salvarSessao(perfil, entrada); setVisivel({ ...base, perfil, entradaPlano: entrada }); return; }
    try {
      const r = mudouEstrutura ? { base: rascunhoRef.current?.base ?? base, perfil, entradaPlano: entrada } : null;
      if (!await guardarRascunho(ctx, r)) return;
      // Somente os campos operacionais são autosave; a definição em edição não sobe aqui.
      const operacional = restaurarDefinicaoTreino(perfil, extrairDefinicaoTreino(base.perfil));
      const entradaOperacional = mudouEstrutura ? base.entradaPlano : entrada;
      if (!igual(operacional, base.perfil) || !igual(entradaOperacional, base.entradaPlano)) {
        const perfilBase = restaurarDefinicaoTreino(baseUI.perfil, extrairDefinicaoTreino(base.perfil));
        const { comando } = await enfileirarOperacao({ tipo: 'PERFIL', payload: { perfil: operacional, expectedRevision: base.revision, entradaPlano: entradaOperacional, base: { perfil: perfilBase, revision: base.revision, entradaPlano: mudouEstrutura ? base.entradaPlano : baseUI.entradaPlano } } }, { expectedSubject: subject, ativo: ctx.valido });
        if (!ctx.valido()) return;
        if (!comando) throw new Error('edicao_nao_guardada');
      }
      if (!ctx.valido()) return;
      await atualizar();
    } catch { if (ctx.valido()) setErro('Esta edição ainda não foi gravada no dispositivo. Mantenha a tela aberta e tente novamente.'); }
  }
  async function aplicar() {
    const ctx = capturarContexto(); if (!ctx.valido()) return;
    const subject = ctx.subject, r = rascunhoRef.current, base = oficialRef.current;
    if (!subject || !r || !base || conflitoRascunho.length) return;
    try {
      const perfil = restaurarDefinicaoTreino(base.perfil,extrairDefinicaoTreino(r.perfil));
      const perfilBase = restaurarDefinicaoTreino(base.perfil,extrairDefinicaoTreino(r.base.perfil));
      const { comando } = await enfileirarOperacao({ tipo: 'APLICAR_TREINO', payload: { perfil, expectedRevision: base.revision, entradaPlano: base.entradaPlano, base: { ...base, perfil: perfilBase } } }, { expectedSubject: subject, ativo: ctx.valido });
      if (!ctx.valido()) return;
      if (!comando) throw new Error('aplicacao_nao_guardada');
      await atualizar();
    } catch { if (ctx.valido()) setErro('Não foi possível guardar a aplicação. Sua prévia continua aqui.'); }
  }
  async function desfazer() {
    const ctx = capturarContexto(); if (!ctx.subject || !ctx.valido()) return;
    const base = oficialRef.current, alvoId = base?.versoesTreino?.anterior?.id;
    if (!base || !alvoId) return;
    try {
      const { comando } = await enfileirarOperacao({ tipo: 'DESFAZER_TREINO', payload: { perfil: base.perfil, expectedRevision: base.revision, alvoId } }, { expectedSubject: ctx.subject, ativo: ctx.valido });
      if (!ctx.valido()) return;
      if (!comando) throw new Error('desfazer_nao_guardado');
      await atualizar();
    } catch { if (ctx.valido()) setErro('Não foi possível guardar o pedido de desfazer. Tente novamente.'); }
  }
  async function descartarRascunho() {
    const ctx = capturarContexto(); if (!ctx.subject || !ctx.valido()) return;
    try {
      if (!await guardarRascunho(ctx, null)) return;
      setConflitoRascunho([]);
      if (oficialRef.current) { uiRef.current = oficialRef.current; setVisivel(oficialRef.current); setEpoch((n) => n + 1); }
    } catch { if (ctx.valido()) setErro('Não foi possível descartar a prévia. Ela continua guardada neste dispositivo.'); }
  }
  async function manterRascunho() {
    const ctx = capturarContexto(); if (!ctx.valido()) return;
    const subject = ctx.subject, r = rascunhoRef.current, atual = oficialRef.current;
    if (!subject || !r || !atual) return;
    const definicao = manterLocalNosConflitos(extrairDefinicaoTreino(r.base.perfil),extrairDefinicaoTreino(r.perfil),extrairDefinicaoTreino(atual.perfil));
    const perfil = restaurarDefinicaoTreino(atual.perfil,definicao);
    try {
      if (!await guardarRascunho(ctx, { ...r, base: atual, perfil, entradaPlano: atual.entradaPlano })) return;
      uiRef.current = { ...atual, perfil };
      setConflitoRascunho([]); setVisivel(uiRef.current); setEpoch((n) => n + 1);
    } catch { if (ctx.valido()) setErro('Não foi possível guardar sua escolha. A edição local continua preservada.'); }
  }
  return { visivel, oficial, rascunho, fila, erro, aviso, estadoAutenticacao, ocupado, conflitoRascunho, epoch,
    aoOcupado, atualizar, editar, aplicar, desfazer, descartarRascunho, manterRascunho };
}
