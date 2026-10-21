'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import Painel, { type PerfilResumo } from '@/components/painel/Painel';
import { recomputarPlano } from '@/lib/session';
import { sairDaConta } from '@/lib/auth/sair';
import { emModoDiario } from '@/lib/modo-diario';
import VigiaSessao from '@/components/auth/VigiaSessao';
import ConviteInstalar from '@/components/pwa/ConviteInstalar';
import { resolverPesoDoPlanoLocal } from '@/lib/peso-plano';
import { hojeISO, lerPesos } from '@/lib/treino-historico';
import { normalizarEntradaPlanoVisivel, opcoesDeEntradaPlano } from '@/lib/plano-cas-comando';
import { ROTULOS_CAMPOS_PERFIL } from '@/lib/validation/perfil-resumo';
import { useContaSync } from '@/lib/persistencia/use-conta-sync';
import ConflitoSync from '@/components/painel/ConflitoSync';
import RetomarSessao from '@/components/painel/RetomarSessao';
import { canonicalInputHash } from '@/lib/engine/cas';
import { FORMULA_DURACAO_VERSION } from '@/lib/engine/duracao-sessao';
import { STORAGE_GENERATION } from '@/lib/persistencia/sync-contrato';
import { extrairDefinicaoTreino } from '@/lib/persistencia/treino-versoes';

const EASE = 'cubic-bezier(.22,.61,.36,1)';
export default function AppPage() {
  const router = useRouter(), conta = useContaSync();
  const { visivel: estado } = conta;
  const conflitos = conta.fila.filter((i) => i.recibo && !i.substituidoPor);
  const aplicando = conta.fila.some((i) => ['APLICAR_TREINO','DESFAZER_TREINO'].includes(i.comando.tipo));
  const plano = useMemo(() => {
    if (!estado || estado.perfil.camposInvalidos?.length) return null;
    const pesoEfetivoKg = resolverPesoDoPlanoLocal({ perfil: estado.perfil, pesos: lerPesos(), hojeISO: hojeISO() });
    const entrada = estado.entradaPlano ?? normalizarEntradaPlanoVisivel(estado.perfil, { pesoEfetivoKg });
    return { entrada, ...recomputarPlano(estado.perfil, opcoesDeEntradaPlano(entrada)) };
  }, [estado]);
  if (!estado) return conta.erro ? <main role="alert" style={{ padding: 24 }}><p>{conta.erro}</p><button onClick={() => void conta.atualizar()}>Tentar novamente</button></main> : <Splash />;
  if (estado.perfil.camposInvalidos?.length) return <PerfilPrecisaDeCorrecao perfil={estado.perfil} onCorrigir={() => router.push('/onboarding?corrigir=1')} />;
  if (!plano) return <Splash />;
  const { entrada, dieta, treino } = plano;
  return <div className="ak-app-interactions">
    <VigiaSessao /><ConviteInstalar />
    <section aria-label="Salvamento e edição do treino" style={{ margin: '12px auto', maxWidth: 760, padding: 16, borderRadius: 12, background: '#173c28', color: '#EAE5DB' }}>
      <p role="status" aria-live="polite" style={{ margin: '0 0 8px' }}>
        {conta.fila.length ? `${conta.fila.length} alteração(ões) guardada(s) neste dispositivo, aguardando confirmação.` : 'Dados confirmados da conta carregados.'}
      </p>
      {conta.erro ? <p role="alert">{conta.erro}</p> : null}
      {conta.aviso ? <p role="status">{conta.aviso}</p> : null}
      {conta.estadoAutenticacao === 'REAUTENTICAR' ? <p role="alert">Sua sessão precisa de uma nova entrada. Suas pendências continuam neste dispositivo. <a href="/login">Entrar na mesma conta</a></p> : null}
      {conta.estadoAutenticacao === 'INDISPONIVEL' ? <p role="status">A conexão com a conta está indisponível. Você pode continuar; as pendências serão enviadas quando houver acesso.</p> : null}
      {conta.estadoAutenticacao === 'ATUALIZAR' ? <p role="alert">Esta versão precisa ser atualizada antes de sincronizar. Suas pendências foram preservadas.</p> : null}
      {conta.estadoAutenticacao === 'CONTA_MUDOU' ? <p role="alert">A conta conectada mudou. Entre novamente na mesma conta para sincronizar estas pendências.</p> : null}
      <RetomarSessao ocupado={conta.ocupado} modoDiario={emModoDiario(dieta.gate.comportamento)} />
      {conta.rascunho ? <>
        <p>Você está vendo uma prévia do treino editado. Aplicar substitui o treino atual e guarda somente a versão anterior.</p>
        <button disabled={aplicando || !!conta.conflitoRascunho.length} onClick={() => void conta.aplicar()}>Aplicar treino</button>{' '}
        <button disabled={aplicando} onClick={() => void conta.descartarRascunho()}>Descartar prévia</button>
      </> : conta.oficial?.versoesTreino?.anterior ? <button disabled={aplicando} onClick={() => void conta.desfazer()}>Desfazer última aplicação</button> : null}
      {conta.conflitoRascunho.length ? <div role="alert">
        <p>As mesmas informações foram editadas em outro dispositivo. Escolha qual edição manter na prévia.</p>
        <button onClick={() => void conta.manterRascunho()}>Manter minha edição</button>{' '}
        <button onClick={() => void conta.descartarRascunho()}>Usar treino da conta</button>
      </div> : null}
      {conflitos.map((item) => <ConflitoSync key={item.comando.operationId} item={item} aoResolver={conta.atualizar} />)}
      <button onClick={() => void conta.atualizar()} style={{ marginTop: 8 }}>Conferir sincronização</button>
    </section>
    <Painel key={conta.epoch} perfil={estado.perfil} dieta={dieta} treino={treino}
      desfechoC={dieta.gate.comportamento === 'RESTRINGIR' || dieta.gate.comportamento === 'PISAR'}
      modoDiario={emModoDiario(dieta.gate.comportamento)} entradaPlanoInicial={entrada}
      onOcupadoChange={conta.aoOcupado}
      origemPlano={{ schemaVersion: 1, tipo: conta.rascunho ? 'rascunho' : conta.oficial?.versoesTreino ? 'oficial' : 'legado', referencia: conta.rascunho ? canonicalInputHash(extrairDefinicaoTreino(conta.rascunho.perfil)) : conta.oficial?.versoesTreino?.atual.id, generation: STORAGE_GENERATION, formulaDuracaoVersion: FORMULA_DURACAO_VERSION }}
      onPerfilChange={(perfil, opcoes) => { void conta.editar(perfil, opcoes); }}
      onSair={() => { void sairDaConta().then((saiu) => { if (saiu) router.replace('/'); }); }} />
  </div>;
}

function PerfilPrecisaDeCorrecao({ perfil, onCorrigir }: { perfil: PerfilResumo; onCorrigir: () => void }) {
  const campos = (perfil.camposInvalidos ?? []).map((c) => ROTULOS_CAMPOS_PERFIL[c] ?? c);
  return (
    <div style={{ minHeight: '100vh', background: '#0D2818', color: '#EAE5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <section role="alert" style={{ maxWidth: 560, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,179,8,.45)', borderRadius: 16, padding: 24 }}>
        <h1 style={{ margin: '0 0 12px', fontSize: '1.3rem', fontWeight: 700 }}>Precisamos conferir alguns dados do seu perfil</h1>
        <p style={{ margin: '0 0 12px', fontSize: '.95rem', lineHeight: 1.6, color: 'rgba(234,229,219,.8)' }}>
          Não conseguimos ler {campos.length === 1 ? 'este campo' : 'estes campos'}: <strong>{campos.join(', ')}</strong>.
          Preferimos não montar um plano com informação incompleta a inventar um valor no lugar do seu.
        </p>
        <p style={{ margin: '0 0 20px', fontSize: '.9rem', lineHeight: 1.6, color: 'rgba(234,229,219,.65)' }}>
          <strong>Nada foi apagado.</strong> O resto do seu perfil — inclusive o treino que você montou — continua salvo
          e volta assim que estes campos forem confirmados.
        </p>
        <button
          type="button"
          onClick={onCorrigir}
          className="hov-btn"
          style={{ cursor: 'pointer', background: '#BDFF00', color: '#0D2818', border: 'none', borderRadius: 12, padding: '13px 24px', fontWeight: 700, fontSize: '.98rem' }}
        >
          Conferir meus dados
        </button>
      </section>
    </div>
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
