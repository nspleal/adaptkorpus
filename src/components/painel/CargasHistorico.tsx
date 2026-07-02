'use client';

import { useMemo, useState } from 'react';
import type { SessaoHistorico } from '@/lib/treino-historico';
import GraficoLinha from './GraficoLinha';

/**
 * Progressão de carga por exercício (porte fiel do V6.2 §Peça6). Reusa a técnica do gráfico
 * de peso (GraficoLinha) alimentada por outra série: para o exercício escolhido, a MAIOR carga
 * de cada dia ao longo das sessões registradas. Dados reais do histórico (evk_treinos).
 *
 * 🔒 Trava: o resumo é sempre passado/presente ("você estava… hoje…") — NUNCA promessa futura.
 */

const cardSoft = { background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: '20px 22px' } as const;

export default function CargasHistorico({ historico }: { historico: SessaoHistorico[] }) {
  // Exercícios COM carga presentes no histórico (únicos por id; nome como rótulo/fallback).
  const exercicios = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of historico) for (const e of s.exercicios) {
      const key = e.id || e.nome;
      if (e.loaded && key && !map.has(key)) map.set(key, e.nome);
    }
    return [...map].map(([id, nome]) => ({ id, nome }));
  }, [historico]);

  const [sel, setSel] = useState<string>('');
  const [aberto, setAberto] = useState(false);
  const selKey = sel || exercicios[0]?.id || '';
  const selNome = exercicios.find((e) => e.id === selKey)?.nome ?? '';

  // Série: maior carga do dia, por dia, em ordem cronológica.
  const serie = useMemo(() => {
    const porDia = new Map<string, number>();
    for (const s of historico) {
      const e = s.exercicios.find((x) => (x.id || x.nome) === selKey && x.loaded);
      if (!e) continue;
      const maxKg = Math.max(0, ...e.sets.map((st) => Number(st.kg) || 0));
      if (maxKg > 0) porDia.set(s.dataISO, Math.max(porDia.get(s.dataISO) ?? 0, maxKg));
    }
    return [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, kg]) => kg);
  }, [historico, selKey]);

  if (exercicios.length === 0) {
    return <div style={{ ...cardSoft, padding: 24 }}><p style={{ margin: 0, fontSize: '.92rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.6 }}>Ainda não há cargas registradas. Conclua uma sessão de treino anotando o peso de cada série para ver sua progressão aqui.</p></div>;
  }

  const primeiro = serie[0], ultimo = serie[serie.length - 1];
  const delta = ultimo != null && primeiro != null ? ultimo - primeiro : 0;

  return (
    <div style={{ ...cardSoft, padding: 24 }}>
      {/* Seletor de exercício — botão + menu flutuante (padrão do menu de conta) */}
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <button onClick={() => setAberto((v) => !v)} className="evk-troca" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.16)', color: '#EAE5DB', fontWeight: 600, fontSize: '.95rem', padding: '10px 15px', borderRadius: 12, cursor: 'pointer' }}>
          {selNome}
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ transition: 'transform .2s ease', transform: aberto ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {aberto && (
          <>
            <div onClick={() => setAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 6, minWidth: 240, maxHeight: 280, overflowY: 'auto', background: 'linear-gradient(168deg, rgba(16,42,26,.99), rgba(15,15,14,.99))', border: '1px solid rgba(234,229,219,.14)', borderRadius: 14, padding: 6, boxShadow: '0 30px 70px -25px rgba(0,0,0,.8)' }}>
              {exercicios.map((e) => (
                <button key={e.id} onClick={() => { setSel(e.id); setAberto(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: e.id === selKey ? 'rgba(189,255,0,.1)' : 'none', border: 'none', color: e.id === selKey ? '#BDFF00' : 'rgba(234,229,219,.82)', fontWeight: e.id === selKey ? 700 : 500, fontSize: '.92rem', padding: '10px 12px', borderRadius: 9, cursor: 'pointer' }}>{e.nome}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {serie.length >= 2 ? (
        <>
          <GraficoLinha serie={serie} gradId="evkChartCarga" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <p style={{ margin: 0, fontSize: '.95rem', color: 'rgba(234,229,219,.75)' }}>Você estava em <strong style={{ color: '#EAE5DB', fontWeight: 700 }}>{primeiro} kg</strong>, hoje <strong style={{ color: '#EAE5DB', fontWeight: 700 }}>{ultimo} kg</strong>.</p>
            {delta !== 0 && <span style={{ fontSize: '.82rem', fontWeight: 700, color: '#BDFF00', background: 'rgba(189,255,0,.1)', borderRadius: 8, padding: '4px 10px' }}>{delta > 0 ? '+' : '−'}{Math.abs(delta)} kg</span>}
          </div>
          <p style={{ margin: '12px 0 0', fontSize: '.82rem', color: 'rgba(234,229,219,.45)', lineHeight: 1.5 }}>Evolução da carga ao longo das sessões registradas — não é uma promessa, é o que você já fez.</p>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: '.92rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.6 }}>Registre mais sessões deste exercício para ver a curva de progressão.</p>
      )}
    </div>
  );
}
