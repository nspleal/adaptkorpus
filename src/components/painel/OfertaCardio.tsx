'use client';
/**
 * 🔒 C1 — O MENOR SELETOR FUNCIONAL de dias oferecidos para cardio (autor 2026-08-21, rodada 2).
 *
 * É o CONTROLE de entrada real do usuário no caminho:
 *   OfertaCardio (clique) → `lib/cardio-oferta` (estado transitório) → recompute do Painel →
 *   `recomputarPlano({ diasOferecidosCardio })` → motor → distribuição → `canonical_input_hash`.
 *
 * Sem redesign: uma linha de chips numerados (Dia 1..N do horizonte da semana), no estilo inline
 * do Painel. Um dia oferecido COM musculação continua válido (cardio próprio após o treino,
 * adaptado à sobra — decisão fechada do autor); parcela REDISTRIBUÍDA nunca cai em dia de treino.
 */
import { getDiasOferecidosCardio, toggleDiaOferecidoCardio } from '@/lib/cardio-oferta';
import { useState } from 'react';

export default function OfertaCardio({ totalDias, onChange }: {
  /** Nº de dias do horizonte da semana (= diasDisponiveis do perfil). */
  totalDias: number;
  /** Disparado após alternar um dia — o Painel recomputa o plano com a nova oferta. */
  onChange: () => void;
}) {
  const [, força] = useState(0); // re-render local após alternar (o estado mora no módulo)
  if (totalDias < 1) return null;
  const oferta = getDiasOferecidosCardio();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '10px 0 18px' }}>
      <span style={{ fontSize: '.8rem', color: 'rgba(234,229,219,.55)' }}>Dias para cardio:</span>
      {Array.from({ length: totalDias }, (_, i) => {
        const ativo = oferta.includes(i);
        return (
          <button
            key={i}
            aria-pressed={ativo}
            aria-label={`Oferecer dia ${i + 1} para cardio`}
            onClick={() => { toggleDiaOferecidoCardio(i); força((n) => n + 1); onChange(); }}
            style={{
              padding: '4px 10px', borderRadius: 999, fontSize: '.78rem', cursor: 'pointer',
              border: ativo ? '1px solid rgba(189,255,0,.55)' : '1px solid rgba(234,229,219,.2)',
              background: ativo ? 'rgba(189,255,0,.12)' : 'transparent',
              color: ativo ? '#BDFF00' : 'rgba(234,229,219,.65)',
            }}
          >
            Dia {i + 1}
          </button>
        );
      })}
    </div>
  );
}
