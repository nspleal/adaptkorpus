'use client';
import { useEffect, useState } from 'react';
import { ROTULO_MODALIDADE, type ModalidadeCardio } from '@/lib/engine/cardio';
import { ORDEM_SEMANA, DIA_LABEL, type Weekday } from '@/lib/semana';

import { lerCardioPlanejado, salvarCardioPlanejado, type DiaCardioPlanejado as Dia } from '@/lib/cardio-planejado';
const campo = { padding: 12, borderRadius: 10, background: '#0D2818', color: '#EAE5DB', border: '1px solid #ffffff40' };
const botao = { ...campo, background: '#BDFF00', color: '#0D2818', border: '1px solid #BDFF00', fontWeight: 700 };
export default function PlanejarCardio({ onRegistrar }: { onRegistrar: (dia: Dia) => void }) {
  const [dias, setDias] = useState<Dia[]>([]);
  const [aberto, setAberto] = useState(false);
  const [dia, setDia] = useState<Weekday>('seg');
  const [modalidade, setModalidade] = useState<ModalidadeCardio>('caminhada');
  const [minutos, setMinutos] = useState('20');
  const [erro, setErro] = useState('');
  useEffect(() => { try { setDias(lerCardioPlanejado()); } catch { setErro('Não foi possível ler a montagem salva neste navegador.'); } }, []);
  function salvar(novos: Dia[]) { try { salvarCardioPlanejado(novos); setDias(novos); setErro(''); return true; } catch { setErro('Não foi possível salvar neste navegador.'); return false; } }
  return <section style={{ padding: 20, border: '1px solid #ffffff25', borderRadius: 16, margin: '20px 0' }}>
    <h3>Meu cardio semanal</h3><p>Escolha atividade, duração e dia. Planejar não registra uma sessão realizada.</p>
    <button type="button" style={botao} aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar montagem' : 'Montar meu cardio'}</button>
    {aberto && <form onSubmit={e => { e.preventDefault(); const n = Number(minutos); if (!Number.isSafeInteger(n) || n <= 0) { setErro('Informe a duração em minutos inteiros, maior que zero.'); return; } if (salvar([...dias.filter(d => d.diaId !== dia), { diaId: dia, modalidade, minutos: n }])) setAberto(false); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
      <label>Dia<select style={campo} value={dia} onChange={e => setDia(e.target.value as Weekday)}>{ORDEM_SEMANA.map(d => <option key={d} value={d}>{DIA_LABEL[d].full}</option>)}</select></label>
      <label>Atividade<select style={campo} value={modalidade} onChange={e => setModalidade(e.target.value as ModalidadeCardio)}>{Object.entries(ROTULO_MODALIDADE).map(([v,n]) => <option key={v} value={v}>{n}</option>)}</select></label>
      <label>Minutos<input style={{ ...campo, width: 100 }} type="number" min="1" step="1" required value={minutos} onChange={e => setMinutos(e.target.value)} /></label>
      <button style={botao} type="submit">Salvar dia</button>
    </form>}
    {erro && <p role="alert">{erro}</p>}
    {!dias.length && <p>Nenhum dia montado. Comece escolhendo uma atividade.</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(210px,100%),1fr))', gap: 12, marginTop: 16 }}>{[...dias].sort((a,b) => ORDEM_SEMANA.indexOf(a.diaId)-ORDEM_SEMANA.indexOf(b.diaId)).map(d => <article key={d.diaId} style={{ ...campo, padding: 16 }}>
      <strong>{DIA_LABEL[d.diaId].full}</strong><p>{ROTULO_MODALIDADE[d.modalidade]} · {d.minutos} min</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button style={botao} onClick={() => { setDia(d.diaId); setModalidade(d.modalidade); setMinutos(String(d.minutos)); setAberto(true); }}>Editar</button><button style={botao} onClick={() => salvar(dias.filter(x => x.diaId !== d.diaId))}>Remover</button><button style={botao} onClick={() => onRegistrar(d)}>Registrar realizado</button></div>
    </article>)}</div>
    <p style={{ fontSize: '.8rem', opacity: .7 }}>Montagem salva apenas neste navegador, separada por conta. Não sincroniza com outros aparelhos. A meta automática abaixo permanece como referência.</p>
  </section>;
}
