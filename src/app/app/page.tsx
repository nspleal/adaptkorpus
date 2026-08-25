'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Painel, { type PerfilResumo } from '@/components/painel/Painel';
import type { ResultadoMotor, ResultadoTreino } from '@/lib/engine';
import { lerSessao, limparSessao, recomputarPlano, salvarSessao } from '@/lib/session';
import { sairDaConta } from '@/lib/auth/sair';
import { carregarPerfilServidor, consultarAcesso, salvarPerfilServidor } from '@/lib/persistencia/sync';
import { supabaseConfigurado } from '@/lib/supabase/env';
import { emModoDiario } from '@/lib/modo-diario';
import { resolverEscopoLocal } from '@/lib/escopo-local';
import VigiaSessao from '@/components/auth/VigiaSessao';
import ConviteInstalar from '@/components/pwa/ConviteInstalar';
import { registrarEvento } from '@/lib/metricas/registrar';
import { resolverPesoDoPlanoLocal } from '@/lib/peso-plano';
import { hojeISO, lerPesos } from '@/lib/treino-historico';
import { opcoesDeEntradaPlano, type EntradaPlanoVisivel } from '@/lib/plano-cas-comando';

/**
 * Área logada estável (`/app`). Reidrata o painel a partir do perfil salvo na sessão
 * local — o motor é determinístico, então recomputamos dieta+treino e mostramos o mesmo
 * plano. Reload e "voltar" caem aqui (não no onboarding nem na landing). Sem sessão →
 * manda para o onboarding (cadastro de perfil só na primeira vez).
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

type Estado = {
  perfil: PerfilResumo;
  dieta: ResultadoMotor;
  treino: ResultadoTreino;
  revision: number;
  entradaPlano?: EntradaPlanoVisivel;
};
type PendenciaPersistencia =
  | { tipo: 'REVISAO'; perfil: PerfilResumo; entrada: EntradaPlanoVisivel; revisaoAtual: number }
  | { tipo: 'VERSAO_OU_HASH'; perfil: PerfilResumo; entrada: EntradaPlanoVisivel }
  | { tipo: 'FALHA'; perfil: PerfilResumo; entrada: EntradaPlanoVisivel };

export default function AppPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [pronto, setPronto] = useState(false);
  const [pendenciaPersistencia, setPendenciaPersistencia] = useState<PendenciaPersistencia | null>(null);
  const [painelEpoch, setPainelEpoch] = useState(0);
  const revisaoRef = useRef(0);
  const bloqueadoPorConflitoRef = useRef(false);
  const filaDeGravacaoRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let vivo = true;
    // Monta o painel a partir de um perfil resolvido (local ou do servidor).
    function montar(perfil: PerfilResumo, revision = 0, entradaPlano?: EntradaPlanoVisivel) {
      if (!vivo) return;
      // 🔒 Leva D: o plano é gerado com o peso RESOLVIDO (média de 7 dias + histereses), não
      // com o `perfil.pesoKg` cru. É seguro ler o storage aqui — no caminho com backend
      // `montar` só roda depois de `resolverEscopoLocal()`, então a gaveta já é a certa.
      const pesoEfetivoKg = resolverPesoDoPlanoLocal({ perfil, pesos: lerPesos(), hojeISO: hojeISO() });
      const opcoes = entradaPlano ? opcoesDeEntradaPlano(entradaPlano) : { pesoEfetivoKg };
      const { dieta, treino } = recomputarPlano(perfil, opcoes);
      // 🔒 Cofre, DF 2026-07-27: gate ROTEAR NÃO é mais um beco sem saída. O painel monta em
      // MODO DIÁRIO (registra, não recebe prescrição). Antes daqui o ROTEAR caía no
      // `limparSessao()` abaixo e era chutado de volta ao onboarding — o defeito vivo.
      if (!emModoDiario(dieta.gate.comportamento) && (!dieta.plano || !treino.rotina)) {
        limparSessao(); router.replace('/onboarding'); return;
      }
      revisaoRef.current = revision;
      bloqueadoPorConflitoRef.current = false;
      setEstado({ perfil, dieta, treino, revision, ...(entradaPlano ? { entradaPlano } : {}) });
      setPronto(true);
      // 🔒 `app_aberto` sai QUANDO o app abre de verdade (painel montado), não no import do
      // módulo: retorno no dia 2 e na semana 1 se medem por abertura real.
      registrarEvento('app_aberto', { rota: '/app' });
    }

    if (!supabaseConfigurado()) {
      // Modo mock: caminho local de sempre (escopo `null` — chaves sem sufixo).
      const perfil = lerSessao();
      if (!perfil) { router.replace('/onboarding'); return; }
      montar(perfil);
      return () => { vivo = false; };
    }

    // Backend vivo: (1) gate do beta (allowlist OU assinatura — regra 4.2.1);
    // (2) perfil server-first (o servidor vence; localStorage vira cache p/ reload rápido);
    // (3) 'sem_perfil' no servidor mas com local → migra (write-through);
    // (4) FALHA de chamada (401/rede) → monta do local SEM subir (fix 2026-07-08: subir
    //     aqui regredia o perfil do servidor com um cache velho de outro device).
    void (async () => {
      // 🔒 PRIMEIRA coisa: de quem é a gaveta local. Antes disto, NADA de localStorage —
      // sem escopo, `lerSessao`/`lerHistorico` leriam as chaves sem sufixo, que podem ser
      // de outra conta que usou este navegador. Ver `escopo-local.ts`.
      await resolverEscopoLocal();
      const acesso = await consultarAcesso();
      if (!vivo) return;
      if (acesso && !acesso.liberado) { router.replace('/acesso-restrito?motivo=assinatura'); return; }
      const doServidor = await carregarPerfilServidor();
      if (!vivo) return;
      if (doServidor && doServidor !== 'sem_perfil') {
        salvarSessao(doServidor.perfil); // cache local (2º device ganha os dados na hora)
        montar(doServidor.perfil, doServidor.revision, doServidor.entradaPlano);
        return;
      }
      const local = lerSessao();
      if (local) {
        // Só a conta comprovadamente SEM perfil migra o local p/ o servidor.
        if (doServidor === 'sem_perfil') void salvarPerfilServidor(local, 0);
        montar(local);
        return;
      }
      router.replace('/onboarding');
    })();
    return () => { vivo = false; };
  }, [router]);

  /**
   * Uma fila impede dois PUTs locais com a mesma revisão. Ao perder a corrida para outro
   * dispositivo, ela PARA: somente um clique explícito pode recarregar ou recomputar e tentar.
   */
  function persistirMudanca(perfil: PerfilResumo, entrada: EntradaPlanoVisivel) {
    salvarSessao(perfil); // local-first continua funcionando offline.
    filaDeGravacaoRef.current = filaDeGravacaoRef.current.catch(() => undefined).then(async () => {
      if (bloqueadoPorConflitoRef.current) {
        setPendenciaPersistencia((atual) => atual ? { ...atual, perfil, entrada } : atual);
        return;
      }
      const resultado = await salvarPerfilServidor(perfil, revisaoRef.current, entrada);
      if (resultado.tipo === 'CONFIRMADO') {
        revisaoRef.current = resultado.revision;
        setEstado((atual) => atual ? { ...atual, perfil, revision: resultado.revision, entradaPlano: resultado.entradaPlano } : atual);
        setPendenciaPersistencia(null);
        return;
      }
      if (resultado.tipo === 'CONFLITO_REVISAO') {
        bloqueadoPorConflitoRef.current = true;
        setPendenciaPersistencia({ tipo: 'REVISAO', perfil, entrada, revisaoAtual: resultado.revisaoAtual });
        return;
      }
      if (resultado.tipo === 'CONFLITO_VERSAO_OU_HASH') {
        bloqueadoPorConflitoRef.current = true;
        setPendenciaPersistencia({ tipo: 'VERSAO_OU_HASH', perfil, entrada });
        return;
      }
      // Falha de rede mantém localStorage; não simula confirmação nem descarta a mudança.
      setPendenciaPersistencia({ tipo: 'FALHA', perfil, entrada });
    });
  }

  async function recarregarVersaoSalva() {
    const servidor = await carregarPerfilServidor();
    if (!servidor || servidor === 'sem_perfil') return;
    salvarSessao(servidor.perfil);
    revisaoRef.current = servidor.revision;
    bloqueadoPorConflitoRef.current = false;
    // Snapshot legado sem C1 ainda pode ser recarregado: aplica o mesmo peso resolvido do
    // mount, nunca volta silenciosamente ao peso cru só neste caminho de conflito.
    const pesoEfetivoKg = resolverPesoDoPlanoLocal({ perfil: servidor.perfil, pesos: lerPesos(), hojeISO: hojeISO() });
    const opcoes = servidor.entradaPlano ? opcoesDeEntradaPlano(servidor.entradaPlano) : { pesoEfetivoKg };
    const { dieta, treino } = recomputarPlano(servidor.perfil, opcoes);
    setEstado({ perfil: servidor.perfil, dieta, treino, revision: servidor.revision, ...(servidor.entradaPlano ? { entradaPlano: servidor.entradaPlano } : {}) });
    // O Painel guarda estados locais para edição; recarregar é uma escolha explícita de trocar
    // esses estados pelo servidor, portanto ele recebe uma nova instância só neste caminho.
    setPainelEpoch((atual) => atual + 1);
    setPendenciaPersistencia(null);
  }

  async function usarMinhasAlteracoes() {
    if (!pendenciaPersistencia || pendenciaPersistencia.tipo !== 'REVISAO') return;
    const resultado = await salvarPerfilServidor(pendenciaPersistencia.perfil, pendenciaPersistencia.revisaoAtual, pendenciaPersistencia.entrada);
    if (resultado.tipo === 'CONFIRMADO') {
      revisaoRef.current = resultado.revision;
      bloqueadoPorConflitoRef.current = false;
      setEstado((atual) => atual ? { ...atual, perfil: pendenciaPersistencia.perfil, revision: resultado.revision, entradaPlano: resultado.entradaPlano } : atual);
      setPendenciaPersistencia(null);
      return;
    }
    if (resultado.tipo === 'CONFLITO_REVISAO') setPendenciaPersistencia((atual) => atual?.tipo === 'REVISAO' ? { ...atual, revisaoAtual: resultado.revisaoAtual } : atual);
    if (resultado.tipo === 'CONFLITO_VERSAO_OU_HASH') setPendenciaPersistencia((atual) => atual ? { tipo: 'VERSAO_OU_HASH', perfil: atual.perfil, entrada: atual.entrada } : atual);
    if (resultado.tipo === 'FALHA') setPendenciaPersistencia((atual) => atual ? { tipo: 'FALHA', perfil: atual.perfil, entrada: atual.entrada } : atual);
  }

  async function tentarSalvarNovamente() {
    if (!pendenciaPersistencia || pendenciaPersistencia.tipo !== 'FALHA') return;
    const resultado = await salvarPerfilServidor(pendenciaPersistencia.perfil, revisaoRef.current, pendenciaPersistencia.entrada);
    if (resultado.tipo === 'CONFIRMADO') {
      revisaoRef.current = resultado.revision;
      setEstado((atual) => atual ? { ...atual, perfil: pendenciaPersistencia.perfil, revision: resultado.revision, entradaPlano: resultado.entradaPlano } : atual);
      setPendenciaPersistencia(null);
      return;
    }
    if (resultado.tipo === 'CONFLITO_REVISAO') {
      bloqueadoPorConflitoRef.current = true;
      setPendenciaPersistencia({ tipo: 'REVISAO', perfil: pendenciaPersistencia.perfil, entrada: pendenciaPersistencia.entrada, revisaoAtual: resultado.revisaoAtual });
      return;
    }
    if (resultado.tipo === 'CONFLITO_VERSAO_OU_HASH') {
      bloqueadoPorConflitoRef.current = true;
      setPendenciaPersistencia({ tipo: 'VERSAO_OU_HASH', perfil: pendenciaPersistencia.perfil, entrada: pendenciaPersistencia.entrada });
    }
  }

  if (!pronto || !estado) return <Splash />;

  return (
    <>
      <VigiaSessao />
      {/* 🔒 O convite vive AQUI, na área logada — nunca na landing (beta por allowlist). */}
      <ConviteInstalar />
      {pendenciaPersistencia && (
        <section role="alert" style={{ margin: '16px auto 0', maxWidth: 760, padding: 16, borderRadius: 12, background: '#39200a', color: '#fff3d6' }}>
          <strong>{pendenciaPersistencia.tipo === 'REVISAO' ? 'Este plano foi alterado em outro acesso.' : pendenciaPersistencia.tipo === 'VERSAO_OU_HASH' ? 'Este plano usa uma versão que precisa ser recarregada.' : 'Não foi possível confirmar o salvamento agora.'}</strong>
          <p style={{ margin: '8px 0 12px' }}>
            {pendenciaPersistencia.tipo === 'REVISAO'
              ? 'Nada foi sobrescrito automaticamente. Escolha qual versão usar.'
              : pendenciaPersistencia.tipo === 'VERSAO_OU_HASH'
                ? 'Nada foi sobrescrito. Recarregue a versão salva antes de continuar.'
                : 'Sua alteração continua neste dispositivo; tente novamente quando a conexão voltar.'}
          </p>
          <button type="button" onClick={() => void recarregarVersaoSalva()}>Recarregar versão salva</button>
          {pendenciaPersistencia.tipo === 'REVISAO' && <button type="button" onClick={() => void usarMinhasAlteracoes()} style={{ marginLeft: 10 }}>Usar minhas alterações</button>}
          {pendenciaPersistencia.tipo === 'FALHA' && <button type="button" onClick={() => void tentarSalvarNovamente()} style={{ marginLeft: 10 }}>Tentar salvar novamente</button>}
        </section>
      )}
      <Painel
        key={painelEpoch}
        perfil={estado.perfil}
        dieta={estado.dieta}
        treino={estado.treino}
        desfechoC={estado.dieta.gate.comportamento === 'RESTRINGIR' || estado.dieta.gate.comportamento === 'PISAR'}
        modoDiario={emModoDiario(estado.dieta.gate.comportamento)}
        entradaPlanoInicial={estado.entradaPlano}
        onPerfilChange={persistirMudanca}
        onSair={() => { void sairDaConta().finally(() => router.replace('/')); }}
      />
    </>
  );
}

/** Tela de transição enquanto reidrata (recompute é síncrono — some em ~1 quadro). */
function Splash() {
  return (
    <div style={{ minHeight: '100vh', background: '#0D2818', color: '#EAE5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: `evkScreenIn .4s ${EASE}` }}>
      <svg width={30} height={30} viewBox="0 0 24 24" fill="none" aria-label="Carregando" style={{ animation: 'evkSpin 1s linear infinite' }}>
        <circle cx={12} cy={12} r={9} stroke="rgba(234,229,219,.18)" strokeWidth={2.4} />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="#BDFF00" strokeWidth={2.4} strokeLinecap="round" />
      </svg>
    </div>
  );
}
