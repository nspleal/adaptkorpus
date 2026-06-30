'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { EstadoSistema, Medalhao, AssinaturaMotivo, estiloBotaoPrimario, estiloBotaoSecundario } from '@/components/estados/ui';

/**
 * Error boundary global (V4 A2). Tema de marca. NUNCA renderiza stack/erro técnico/dado
 * sensível — só a mensagem amigável; o erro real é logado fora da UI (console → telemetria).
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div style={{ minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
      <EstadoSistema
        ilustracao={
          <div style={{ marginBottom: 24 }}>
            <Medalhao variante="erro" size={84}>
              <svg width={36} height={36} viewBox="0 0 24 24" fill="none"><path d="M12 4l8.5 15H3.5L12 4z" stroke="#E5484D" strokeWidth={1.8} strokeLinejoin="round" /><path d="M12 10v4" stroke="#E5484D" strokeWidth={2} strokeLinecap="round" /><circle cx={12} cy={16.6} r={1.05} fill="#E5484D" /></svg>
            </Medalhao>
          </div>
        }
        titulo="Algo saiu do lugar por aqui."
        apoio="Tente de novo em instantes. Se continuar, fale com a gente."
        acoes={<>
          <button onClick={reset} className="hov-btn" style={{ ...estiloBotaoPrimario, fontSize: '.98rem', padding: '13px 24px', borderRadius: 12 }}>Tentar de novo</button>
          <Link href="/" className="evk-voltar" style={{ ...estiloBotaoSecundario, textDecoration: 'none' }}>Ir para o início</Link>
        </>}
        assinatura={<AssinaturaMotivo />}
      />
    </div>
  );
}
