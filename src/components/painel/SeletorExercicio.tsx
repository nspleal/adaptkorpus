'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import type { Exercise, GrupoPrimario, PadraoMovimento } from '@/lib/data/types';
import { exercicioDisponivel } from '@/lib/engine/equipamento';
import { dificuldadesLiberadas } from '@/lib/engine/treino';
import { secundariosDe } from '@/lib/engine/secundarios';
import { ROTULO_GRUPO, ROTULO_PADRAO } from '@/lib/frequencia-grupos';
import type { EquipamentoCasa, EquipamentoDisp } from '@/lib/data/types';
import type { NivelExperiencia } from '@/lib/engine';

/**
 * 🔎 SELETOR DE EXERCÍCIOS — o componente compartilhado (DF③ do
 * handoff-editor-guiado-2026-08-13): **uma peça, duas portas** — o editor guiado e o modal
 * TROCAR ("ver biblioteca completa", abaixo das 3 sugestões).
 *
 * 🔒 O que ele mostra, e por quê:
 *  · **filtros de grupo e padrão**, com o **equipamento do usuário aplicado por default** —
 *    a pessoa vê o que ela pode fazer, e pode desligar o filtro conscientemente;
 *  · **banidos MARCADOS, nunca escondidos** — esconder faria a lista mentir sobre a
 *    biblioteca; marcados, com "trazer de volta" a um toque, a pessoa entende a própria
 *    decisão passada (mesma lógica de "Fora do meu plano" no Editar perfil);
 *  · **favoritos primeiro** (DF #12 — o mesmo trilho de sempre);
 *  · **grupo primário + secundários** em cada item: é o dado que o v4 normalizou, e é o que
 *    explica por que um exercício "conta" para mais de um grupo no placar do crítico.
 *
 * 🔴 O que ele NÃO faz: não decide séries, reps ou RIR (DF② — isso é do motor), e não
 * bloqueia nada. Escolher é do usuário.
 */

const GRUPOS: GrupoPrimario[] = [
  'peito', 'costas', 'ombros', 'quadriceps', 'posterior', 'gluteos',
  'core', 'biceps', 'triceps', 'panturrilha', 'lombar', 'antebraco',
];
const PADROES_FILTRO: PadraoMovimento[] = ['empurrar', 'puxar', 'agachar', 'dobradica_quadril', 'isolado', 'core'];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface ContextoSeletor {
  equipamento: EquipamentoDisp;
  equipamentosCasa?: readonly EquipamentoCasa[];
  nivelExperiencia: NivelExperiencia;
  favoritos: ReadonlySet<string>;
  banidos: ReadonlySet<string>;
}

export default function SeletorExercicio({
  exercises, ctx, onEscolher, onDesbanir, onFechar, titulo = 'Biblioteca de exercícios', grupoInicial = null,
}: {
  exercises: readonly Exercise[];
  ctx: ContextoSeletor;
  onEscolher: (ex: Exercise) => void;
  /** "Trazer de volta" um banido — mesma ação do Editar perfil, aqui a um toque. */
  onDesbanir?: (id: string) => void;
  onFechar: () => void;
  titulo?: string;
  grupoInicial?: GrupoPrimario | null;
}) {
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState<GrupoPrimario | null>(grupoInicial);
  const [padrao, setPadrao] = useState<PadraoMovimento | null>(null);
  /** Ligado por default: a pessoa vê primeiro o que ela consegue fazer hoje. */
  const [soMeuEquipamento, setSoMeuEquipamento] = useState(true);

  const lista = useMemo(() => {
    const liberadas = new Set(dificuldadesLiberadas(ctx.nivelExperiencia));
    const q = norm(busca.trim());
    return exercises
      .filter((e) => e.padraoMovimento !== 'cardio')
      .filter((e) => liberadas.has(e.nivel))
      .filter((e) => (soMeuEquipamento ? exercicioDisponivel(e, ctx.equipamento, ctx.equipamentosCasa) : true))
      .filter((e) => (grupo ? e.grupoPrimario === grupo : true))
      .filter((e) => (padrao ? e.padraoMovimento === padrao : true))
      .filter((e) => (q ? norm(`${e.nomePt} ${e.grupoMuscular}`).includes(q) : true))
      .slice()
      .sort((a, b) => {
        // Favoritos primeiro (DF #12), depois tier, depois id — determinístico.
        const fa = ctx.favoritos.has(a.id) ? 0 : 1;
        const fb = ctx.favoritos.has(b.id) ? 0 : 1;
        if (fa !== fb) return fa - fb;
        return (a.tier ?? 99) - (b.tier ?? 99) || (a.id < b.id ? -1 : 1);
      });
  }, [exercises, ctx, busca, grupo, padrao, soMeuEquipamento]);

  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(7,18,11,.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(168deg, rgba(16,42,26,.99), rgba(15,15,14,.99))', border: '1px solid rgba(234,229,219,.14)', borderRadius: '22px 22px 0 0', padding: 20, boxShadow: '0 -30px 90px -30px rgba(0,0,0,.8)' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{titulo}</div>
          <button onClick={onFechar} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.5)', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>

        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou músculo…"
          className="input-foco"
          aria-label="Buscar exercício"
          style={{ flexShrink: 0, width: '100%', boxSizing: 'border-box', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.16)', borderRadius: 12, padding: '12px 14px', color: '#EAE5DB', fontSize: '.95rem', outline: 'none', marginBottom: 10 }}
        />

        <div style={fileiraChips(4)}>
          <button type="button" onClick={() => setGrupo(null)} aria-pressed={grupo === null} style={chip(grupo === null)}>Todos</button>
          {GRUPOS.map((g) => (
            <button key={g} type="button" onClick={() => setGrupo(grupo === g ? null : g)} aria-pressed={grupo === g} style={chip(grupo === g)}>{ROTULO_GRUPO[g] ?? g}</button>
          ))}
        </div>
        <div style={fileiraChips(8)}>
          {PADROES_FILTRO.map((p) => (
            <button key={p} type="button" onClick={() => setPadrao(padrao === p ? null : p)} aria-pressed={padrao === p} style={chip(padrao === p)}>{ROTULO_PADRAO[p] ?? p}</button>
          ))}
          <button type="button" onClick={() => setSoMeuEquipamento((v) => !v)} aria-pressed={soMeuEquipamento} style={chip(soMeuEquipamento)}>
            {soMeuEquipamento ? 'Só meu equipamento' : 'Biblioteca inteira'}
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lista.length === 0 && (
            <p style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.5 }}>
              Nenhum exercício com esses filtros. Tente limpar a busca ou desligar &quot;Só meu equipamento&quot;.
            </p>
          )}
          {lista.map((ex) => {
            const banido = ctx.banidos.has(ex.id);
            const favorito = ctx.favoritos.has(ex.id);
            const sec = secundariosDe(ex).map((g) => ROTULO_GRUPO[g] ?? g);
            return (
              <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(234,229,219,.04)', border: `1px solid ${banido ? 'rgba(229,72,77,.34)' : 'rgba(234,229,219,.12)'}`, borderRadius: 14, padding: '12px 14px', opacity: banido ? 0.72 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '.98rem', fontWeight: 600 }}>{ex.nomePt}</span>
                    {favorito && <span style={{ fontSize: '.66rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#BDFF00', border: '1px solid rgba(189,255,0,.4)', borderRadius: 6, padding: '2px 6px' }}>Favorito</span>}
                    {banido && <span style={{ fontSize: '.66rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#E5484D', border: '1px solid rgba(229,72,77,.4)', borderRadius: 6, padding: '2px 6px' }}>Fora do meu plano</span>}
                  </div>
                  <div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.55)', marginTop: 3 }}>
                    {ROTULO_GRUPO[ex.grupoPrimario ?? ''] ?? ex.grupoMuscular}
                    {sec.length > 0 && <span style={{ color: 'rgba(234,229,219,.4)' }}> · também {sec.join(', ').toLowerCase()}</span>}
                    {ex.equipamentoDetalhe && <span style={{ color: 'rgba(234,229,219,.4)' }}> · {ex.equipamentoDetalhe}</span>}
                  </div>
                </div>
                {banido && onDesbanir ? (
                  <button onClick={() => onDesbanir(ex.id)} style={botao} aria-label={`Trazer ${ex.nomePt} de volta`}>Trazer de volta</button>
                ) : (
                  <button onClick={() => onEscolher(ex)} style={botao} aria-label={`Escolher ${ex.nomePt}`}>Escolher</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * 🔴 A FILEIRA DE CHIPS NÃO ENCOLHE (pedido-ui-biblioteca-e-voltar-2026-08-13, item 1).
 *
 * O defeito que o autor fotografou — "pílulas sem nenhum texto, desalinhadas e sobrepostas":
 * os rótulos SEMPRE foram renderizados e com a cor certa; o que falhava era o layout. Estas
 * fileiras são itens flex da coluna do modal (`maxHeight: 88vh`) e nasciam com o
 * `flex-shrink: 1` do default. A lista irmã tem `scrollHeight` de ~3200px, então quando a
 * coluna estourava o navegador tirava a altura de quem PODIA encolher: as fileiras caíam
 * para 14px e os chips para 16px (só o padding deles já são 14px) — texto cortado para fora
 * da pílula e uma fileira invadindo a outra. Medido no Chromium a 390×844:
 * antes fileira 14px / chip 16px · com `flexShrink: 0` fileira 39px / chip 31px.
 *
 * 🔒 Por isso o `flexShrink: 0` aqui (e no cabeçalho e na busca) anda junto do `minHeight: 0`
 * na lista: sem o `minHeight: 0` a lista se recusa a ceder (o mínimo automático de um item
 * flex é o conteúdo dele) e a conta volta a sobrar para os chips.
 */
const fileiraChips = (marginBottom: number): CSSProperties => ({
  flexShrink: 0, display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 8, marginBottom,
});

const chip = (ativo: boolean): CSSProperties => ({
  flexShrink: 0,
  background: ativo ? 'rgba(189,255,0,.14)' : 'none',
  border: `1px solid ${ativo ? 'rgba(189,255,0,.5)' : 'rgba(234,229,219,.18)'}`,
  color: ativo ? '#BDFF00' : 'rgba(234,229,219,.8)',
  fontWeight: 600, fontSize: '.82rem', padding: '7px 12px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
});

const botao: CSSProperties = {
  flexShrink: 0, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB',
  fontWeight: 600, fontSize: '.84rem', padding: '9px 13px', borderRadius: 11, cursor: 'pointer',
};
