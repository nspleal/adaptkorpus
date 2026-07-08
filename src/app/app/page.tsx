'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Painel, { type PerfilResumo } from '@/components/painel/Painel';
import type { ResultadoMotor, ResultadoTreino } from '@/lib/engine';
import { lerSessao, limparSessao, recomputarPlano, salvarSessao } from '@/lib/session';
import { sairDaConta } from '@/lib/auth/sair';
import { carregarPerfilServidor, consultarAcesso, salvarPerfilServidor } from '@/lib/persistencia/sync';
import { supabaseConfigurado } from '@/lib/supabase/env';
import VigiaSessao from '@/components/auth/VigiaSessao';

/**
 * Área logada estável (`/app`). Reidrata o painel a partir do perfil salvo na sessão
 * local — o motor é determinístico, então recomputamos dieta+treino e mostramos o mesmo
 * plano. Reload e "voltar" caem aqui (não no onboarding nem na landing). Sem sessão →
 * manda para o onboarding (cadastro de perfil só na primeira vez).
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

type Estado = { perfil: PerfilResumo; dieta: ResultadoMotor; treino: ResultadoTreino };

export default function AppPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let vivo = true;
    // Monta o painel a partir de um perfil resolvido (local ou do servidor).
    function montar(perfil: PerfilResumo) {
      if (!vivo) return;
      const { dieta, treino } = recomputarPlano(perfil);
      // Defesa: se o perfil salvo não gera plano (gate ROTEAR) — não deveria acontecer, só
      // salvamos sessão em desfecho com plano — recomeça o onboarding em vez de quebrar.
      if (dieta.gate.comportamento === 'ROTEAR' || !dieta.plano || !treino.rotina) {
        limparSessao(); router.replace('/onboarding'); return;
      }
      setEstado({ perfil, dieta, treino });
      setPronto(true);
    }

    if (!supabaseConfigurado()) {
      // Modo mock: caminho local de sempre.
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
      const acesso = await consultarAcesso();
      if (!vivo) return;
      if (acesso && !acesso.liberado) { router.replace('/acesso-restrito?motivo=assinatura'); return; }
      const doServidor = await carregarPerfilServidor();
      if (!vivo) return;
      if (doServidor && doServidor !== 'sem_perfil') {
        salvarSessao(doServidor); // cache local (2º device ganha os dados na hora)
        montar(doServidor);
        return;
      }
      const local = lerSessao();
      if (local) {
        // Só a conta comprovadamente SEM perfil migra o local p/ o servidor.
        if (doServidor === 'sem_perfil') void salvarPerfilServidor(local);
        montar(local);
        return;
      }
      router.replace('/onboarding');
    })();
    return () => { vivo = false; };
  }, [router]);

  if (!pronto || !estado) return <Splash />;

  return (
    <>
      <VigiaSessao />
      <Painel
        perfil={estado.perfil}
        dieta={estado.dieta}
        treino={estado.treino}
        desfechoC={estado.dieta.gate.comportamento === 'RESTRINGIR' || estado.dieta.gate.comportamento === 'PISAR'}
        onPerfilChange={(p) => { salvarSessao(p); void salvarPerfilServidor(p); }}
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
