'use client';
/**
 * 🔒 C1 — O MENOR SELETOR FUNCIONAL de dias oferecidos para cardio (autor 2026-08-21, rodada 2).
 *
 * É o CONTROLE de entrada real do usuário no caminho:
 *   OfertaCardio (clique) → estado local do Painel → recompute do Painel →
 *   `recomputarPlano({ diasOferecidosCardio })` → motor → distribuição → `canonical_input_hash`.
 *
 * Sem redesign: uma linha de chips Seg..Dom, no estilo inline do Painel. Um dia oferecido COM
 * musculação continua válido (cardio próprio após o treino, adaptado à sobra); parcela
 * REDISTRIBUÍDA nunca cai em dia de treino.
 */
import { alternarDiaOferecidoCardio } from '@/lib/cardio-oferta';
import { DIA_LABEL, ORDEM_SEMANA, type Weekday } from '@/lib/semana';

export default function OfertaCardio({ value, onChange }: {
  /** Estado local da montagem atual do Painel; não persiste nem compartilha entre contas. */
  value: readonly Weekday[];
  /** Recebe a próxima oferta já normalizada e dispara o recompute no dono do estado. */
  onChange: (proxima: Weekday[]) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '10px 0 18px' }}>
      <span style={{ fontSize: '.8rem', color: 'rgba(234,229,219,.55)' }}>Dias para cardio:</span>
      {ORDEM_SEMANA.map((dia) => {
        const ativo = value.includes(dia);
        return (
          <button
            key={dia}
            aria-pressed={ativo}
            aria-label={`Oferecer ${DIA_LABEL[dia].full} para cardio`}
            onClick={() => onChange(alternarDiaOferecidoCardio(value, dia))}
            style={{
              padding: '4px 10px', borderRadius: 999, fontSize: '.78rem', cursor: 'pointer',
              border: ativo ? '1px solid rgba(189,255,0,.55)' : '1px solid rgba(234,229,219,.2)',
              background: ativo ? 'rgba(189,255,0,.12)' : 'transparent',
              color: ativo ? '#BDFF00' : 'rgba(234,229,219,.65)',
            }}
          >
            {DIA_LABEL[dia].abbr}
          </button>
        );
      })}
    </div>
  );
}
