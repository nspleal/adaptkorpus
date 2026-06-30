'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Painel, { type PerfilResumo } from '@/components/painel/Painel';
import type { ResultadoMotor, ResultadoTreino } from '@/lib/engine';
import { lerSessao, limparSessao, recomputarPlano, salvarSessao } from '@/lib/session';

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
    const perfil = lerSessao();
    if (!perfil) { router.replace('/onboarding'); return; }
    const { dieta, treino } = recomputarPlano(perfil);
    // Defesa: se o perfil salvo não gera plano (gate ROTEAR) — não deveria acontecer, só
    // salvamos sessão em desfecho com plano — recomeça o onboarding em vez de quebrar.
    if (dieta.gate.comportamento === 'ROTEAR' || !dieta.plano || !treino.rotina) {
      limparSessao(); router.replace('/onboarding'); return;
    }
    setEstado({ perfil, dieta, treino });
    setPronto(true);
  }, [router]);

  if (!pronto || !estado) return <Splash />;

  return (
    <Painel
      perfil={estado.perfil}
      dieta={estado.dieta}
      treino={estado.treino}
      desfechoC={estado.dieta.gate.comportamento === 'RESTRINGIR' || estado.dieta.gate.comportamento === 'PISAR'}
      onPerfilChange={salvarSessao}
      onSair={() => { limparSessao(); router.replace('/'); }}
    />
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
