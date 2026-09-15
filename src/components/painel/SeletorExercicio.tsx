'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Exercise, GrupoPrimario, PadraoMovimento } from '@/lib/data/types';
import { exercicioDisponivel } from '@/lib/engine/equipamento';
import { dificuldadesLiberadas } from '@/lib/engine/treino';
import { secundariosDe } from '@/lib/engine/secundarios';
import { ROTULO_GRUPO, ROTULO_PADRAO } from '@/lib/frequencia-grupos';
import { casaComBusca } from '@/lib/busca-exercicio';
import { identidadeCanonica } from '@/lib/exercicio-identidade';
import AlvosAnatomicos from './AlvosAnatomicos';
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

export interface ContextoSeletor {
  equipamento: EquipamentoDisp;
  equipamentosCasa?: readonly EquipamentoCasa[];
  nivelExperiencia: NivelExperiencia;
  favoritos: ReadonlySet<string>;
  banidos: ReadonlySet<string>;
}

export default function SeletorExercicio({
  exercises, ctx, onEscolher, onEscolherVarios, onDesbanir, onFechar, titulo = 'Biblioteca de exercícios', grupoInicial = null,
  jaAdicionados,
}: {
  exercises: readonly Exercise[];
  ctx: ContextoSeletor;
  onEscolher: (ex: Exercise) => void;
  onEscolherVarios?: (exercicios: Exercise[]) => void;
  /** "Trazer de volta" um banido — mesma ação do Editar perfil, aqui a um toque. */
  onDesbanir?: (id: string) => void;
  onFechar: () => void;
  titulo?: string;
  grupoInicial?: GrupoPrimario | null;
  /**
   * 🔒 D19 — identidades canônicas JÁ presentes no dia em edição. O item continua VISÍVEL
   * (esconder faria a lista mentir sobre a biblioteca, mesma razão dos banidos), mas vem
   * marcado "Já neste treino" e não é selecionável.
   *
   * Estado DIFERENTE de "Selecionado", que é escolha desta abertura e se desfaz num toque.
   * Isto aqui é a APARÊNCIA da trava; a trava que decide é `adicionarSemDuplicar`, no call
   * site — mesmo que esta marcação falhe, a inclusão duplicada não passa.
   */
  jaAdicionados?: ReadonlySet<string>;
}) {
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Exercise[]>([]);
  const dialogo = useRef<HTMLDivElement>(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    dialogo.current?.querySelector<HTMLInputElement>('input')?.focus();
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); fechar.current(); }
      if (e.key !== 'Tab') return;
      const controles = Array.from(dialogo.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, summary, [tabindex="0"]') ?? []).filter((el) => el.getClientRects().length > 0);
      const primeiro = controles[0]; const ultimo = controles[controles.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo?.focus(); }
      if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro?.focus(); }
    };
    document.addEventListener('keydown', teclado);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflowAnterior; document.removeEventListener('keydown', teclado); anterior?.focus(); };
  }, []);
  const [grupo, setGrupo] = useState<GrupoPrimario | null>(grupoInicial);
  const [padrao, setPadrao] = useState<PadraoMovimento | null>(null);
  /** Ligado por default: a pessoa vê primeiro o que ela consegue fazer hoje. */
  const [soMeuEquipamento, setSoMeuEquipamento] = useState(true);

  const lista = useMemo(() => {
    const liberadas = new Set(dificuldadesLiberadas(ctx.nivelExperiencia));
    return exercises
      .filter((e) => e.padraoMovimento !== 'cardio')
      .filter((e) => liberadas.has(e.nivel))
      .filter((e) => (soMeuEquipamento ? exercicioDisponivel(e, ctx.equipamento, ctx.equipamentosCasa) : true))
      .filter((e) => (grupo ? e.grupoPrimario === grupo : true))
      .filter((e) => (padrao ? e.padraoMovimento === padrao : true))
      // 🔎 Busca na FONTE ÚNICA (`busca-exercicio`): nome em português, nome em inglês e a
      // lista de músculos. Ler só parte dos campos escondia por omissão, não por regra.
      .filter((e) => casaComBusca(e, busca))
      .slice()
      .sort((a, b) => {
        // Favoritos primeiro (DF #12), depois tier, depois id — determinístico.
        const fa = ctx.favoritos.has(a.id) ? 0 : 1;
        const fb = ctx.favoritos.has(b.id) ? 0 : 1;
        if (fa !== fb) return fa - fb;
        return (a.tier ?? 99) - (b.tier ?? 99) || (a.id < b.id ? -1 : 1);
      });
  }, [exercises, ctx, busca, grupo, padrao, soMeuEquipamento]);

  /**
   * 🔒 TRÊS NÚMEROS, NÃO UM (auditoria de visibilidade do catálogo, 2026-09-12). A tela
   * dizia só "N exercícios encontrados", e um N pequeno ficava indistinguível de catálogo
   * pequeno. São três coisas diferentes, e a pessoa precisa das três:
   *  · `exercises.length` — o catálogo inteiro que esta tela recebeu (168 hoje);
   *  · `teto`             — o que ESTE fluxo pode mostrar (fora o cardio, dentro do nível):
   *                         é o limite que nenhum chip desliga;
   *  · `lista.length`     — o que os filtros escolhidos deixaram.
   */
  const teto = useMemo(() => {
    const liberadas = new Set(dificuldadesLiberadas(ctx.nivelExperiencia));
    return exercises.filter((e) => e.padraoMovimento !== 'cardio' && liberadas.has(e.nivel)).length;
  }, [exercises, ctx.nivelExperiencia]);

  /** Os filtros LIGADOS, nomeados — "nada combina" tem de dizer o que estava combinando. */
  const filtrosAtivos = [
    grupo ? `grupo ${(ROTULO_GRUPO[grupo] ?? grupo).toLowerCase()}` : null,
    padrao ? `movimento ${(ROTULO_PADRAO[padrao] ?? padrao).toLowerCase()}` : null,
    busca.trim() ? `busca “${busca.trim()}”` : null,
    soMeuEquipamento ? 'só o seu equipamento' : null,
  ].filter((f): f is string => f != null);

  /**
   * 🔎 O filtro de grupo é por músculo PRINCIPAL — decisão antiga e correta (o secundário
   * vale 0,5 no placar, não é o alvo do exercício). O que faltava era DIZER quantos ficaram
   * de fora por isso, em vez de deixar a pessoa concluir que não existem.
   */
  const tambemSecundario = useMemo(() => {
    if (grupo == null) return 0;
    const liberadas = new Set(dificuldadesLiberadas(ctx.nivelExperiencia));
    return exercises.filter((e) => e.padraoMovimento !== 'cardio'
      && liberadas.has(e.nivel)
      && (soMeuEquipamento ? exercicioDisponivel(e, ctx.equipamento, ctx.equipamentosCasa) : true)
      && (padrao ? e.padraoMovimento === padrao : true)
      && casaComBusca(e, busca)
      && e.grupoPrimario !== grupo
      && secundariosDe(e).includes(grupo)).length;
  }, [exercises, ctx, grupo, padrao, busca, soMeuEquipamento]);

  const rotuloNivel = ctx.nivelExperiencia === 'iniciante' ? 'iniciante' : ctx.nivelExperiencia === 'intermediario' ? 'intermediário' : 'avançado';

  return typeof document === 'undefined' ? null : createPortal(
    <div ref={dialogo} className="ak-library-overlay" role="dialog" aria-modal="true" aria-label={titulo} onClick={onFechar}>
      <div className="ak-library-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{titulo}</div>
          <button onClick={onFechar} aria-label="Fechar" style={{ background: 'none', border: '1px solid rgba(234,229,219,.2)', borderRadius: 12, color: '#EAE5DB', width: 44, height: 44, fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>

        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome em português ou inglês, ou por músculo…"
          className="input-foco"
          aria-label="Buscar exercício"
          style={{ flexShrink: 0, width: '100%', boxSizing: 'border-box', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.16)', borderRadius: 12, padding: '12px 14px', color: '#EAE5DB', fontSize: '.95rem', outline: 'none', marginBottom: 10 }}
        />

        <div className="ak-library-filters" aria-label="Filtrar por músculo principal" style={fileiraChips(4)}>
          {/* 🔒 "Todos os grupos", nunca "Todos": este chip limpa o filtro de GRUPO — ele não
              devolve o catálogo inteiro (o cardio e o que está acima do nível continuam fora),
              e "Todos" sozinho prometia o que a lista não entrega. Mesmo par do vizinho
              "Todos os equipamentos", que também nomeia o filtro que desliga. */}
          <button type="button" onClick={() => setGrupo(null)} aria-pressed={grupo === null} style={chip(grupo === null)}>Todos os grupos</button>
          {GRUPOS.map((g) => (
            <button key={g} type="button" onClick={() => setGrupo(grupo === g ? null : g)} aria-pressed={grupo === g} style={chip(grupo === g)}>{ROTULO_GRUPO[g] ?? g}</button>
          ))}
        </div>
        <div className="ak-library-filters" aria-label="Filtrar por movimento e equipamento" style={fileiraChips(8)}>
          {PADROES_FILTRO.map((p) => (
            <button key={p} type="button" onClick={() => setPadrao(padrao === p ? null : p)} aria-pressed={padrao === p} style={chip(padrao === p)}>{ROTULO_PADRAO[p] ?? p}</button>
          ))}
          <button type="button" onClick={() => setSoMeuEquipamento((v) => !v)} aria-pressed={soMeuEquipamento} style={chip(soMeuEquipamento)}>
            {soMeuEquipamento ? 'Só meu equipamento' : 'Todos os equipamentos'}
          </button>
        </div>

        <div className="ak-library-context">
          {/* Sem filtro escolhido, "154 de 154" é ruído: aí o número é um só. Com filtro, os
              dois números aparecem — e o plural acompanha o TOTAL ("1 de 154 exercícios"). */}
          <p role="status"><strong>{lista.length === teto ? `${teto} ${teto === 1 ? 'exercício' : 'exercícios'}` : `${lista.length} de ${teto} ${teto === 1 ? 'exercício' : 'exercícios'}`}</strong> · nível {rotuloNivel}{soMeuEquipamento ? ' · seu equipamento' : ' · todos os equipamentos'}</p>
          <p>O seu nível abre {teto} dos {exercises.length} do catálogo; o resto é cardio ou está acima do seu nível. Filtros ativos: {filtrosAtivos.length > 0 ? filtrosAtivos.join(' · ') : 'nenhum'}.</p>
          <p>Os filtros se combinam e os grupos consideram o músculo principal.{grupo != null && tambemSecundario > 0 ? ` Outros ${tambemSecundario} trabalham ${(ROTULO_GRUPO[grupo] ?? grupo).toLowerCase()} como músculo secundário e aparecem em “Todos os grupos”.` : ''}</p>
        </div>
        <div style={{ flex: 1, minHeight: 0 }} className="ak-library-results">
          {lista.length === 0 && (
            <div className="ak-library-empty">
              <p>Nenhum exercício combina com {filtrosAtivos.length > 0 ? <>estes filtros ao mesmo tempo: {filtrosAtivos.join(' · ')}</> : 'estes filtros'}. Isso não significa que o grupo esteja vazio na biblioteca — o seu nível abre {teto} dos {exercises.length} do catálogo.</p>
              <button type="button" style={botao} onClick={() => { setBusca(''); setGrupo(null); setPadrao(null); }}>Limpar busca e filtros</button>
              {soMeuEquipamento && <button type="button" style={botao} onClick={() => setSoMeuEquipamento(false)}>Ver outros equipamentos</button>}
            </div>
          )}
          {lista.map((ex) => {
            const banido = ctx.banidos.has(ex.id);
            const favorito = ctx.favoritos.has(ex.id);
            const noTreino = jaAdicionados?.has(identidadeCanonica(ex)) ?? false;
            const sec = secundariosDe(ex).map((g) => ROTULO_GRUPO[g] ?? g);
            return (
              <article key={ex.id} className="ak-library-exercise" data-selected={selecionados.some((item) => item.id === ex.id)} data-no-treino={noTreino || undefined} aria-label={ex.nomePt} style={{ borderColor: banido ? 'rgba(229,72,77,.5)' : undefined, opacity: noTreino ? 0.62 : undefined }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '.98rem', fontWeight: 600 }}>{ex.nomePt}</span>
                    {noTreino && <span style={{ fontSize: '.66rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.75)', border: '1px solid rgba(234,229,219,.35)', borderRadius: 6, padding: '2px 6px' }}>Já neste treino</span>}
                    {favorito && <span style={{ fontSize: '.66rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#BDFF00', border: '1px solid rgba(189,255,0,.4)', borderRadius: 6, padding: '2px 6px' }}>Favorito</span>}
                    {banido && <span style={{ fontSize: '.66rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#E5484D', border: '1px solid rgba(229,72,77,.4)', borderRadius: 6, padding: '2px 6px' }}>Fora do meu plano</span>}
                  </div>
                  <div style={{ fontSize: '.86rem', color: 'rgba(234,229,219,.8)', marginTop: 8, lineHeight: 1.6 }}>
                    {ROTULO_GRUPO[ex.grupoPrimario ?? ''] ?? ex.grupoMuscular}
                    {sec.length > 0 && <span> · também {sec.join(', ').toLowerCase()}</span>}
                    {ex.equipamentoDetalhe && <span style={{ display: 'block' }}>{ex.equipamentoDetalhe}</span>}
                  </div>
                </div>
                <details className="ak-library-instructions">
                  <summary aria-label={`Como fazer ${ex.nomePt}`}>Como fazer</summary>
                  <p>{ex.comoFazer || 'Este exercício ainda não possui instruções cadastradas.'}</p>
                </details>
                {/* 🦴 Alvos anatômicos — irmão de "Como fazer", carregado só quando aberto.
                    Fica AO LADO da instrução, não no lugar dela. */}
                <AlvosAnatomicos id={ex.id} nomePt={ex.nomePt} />
                {banido && onDesbanir ? (
                  <button onClick={() => onDesbanir(ex.id)} style={botao} aria-label={`Trazer ${ex.nomePt} de volta`}>Trazer de volta</button>
                ) : noTreino ? (
                  <button
                    type="button"
                    disabled
                    style={{ ...botao, background: 'rgba(234,229,219,.06)', color: 'rgba(234,229,219,.6)', minHeight: 44, cursor: 'not-allowed' }}
                    aria-label={`${ex.nomePt} já está neste treino`}
                  >Já neste treino</button>
                ) : (
                  <button
                    onClick={() => onEscolherVarios
                      ? setSelecionados((atuais) => atuais.some((item) => item.id === ex.id)
                        ? atuais.filter((item) => item.id !== ex.id) : [...atuais, ex])
                      : onEscolher(ex)}
                    style={{ ...botao, background: selecionados.some((item) => item.id === ex.id) ? '#BDFF00' : 'rgba(234,229,219,.1)', color: selecionados.some((item) => item.id === ex.id) ? '#0D2818' : '#EAE5DB', minHeight: 44 }}
                    aria-pressed={onEscolherVarios ? selecionados.some((item) => item.id === ex.id) : undefined}
                    aria-label={`${onEscolherVarios ? 'Selecionar' : 'Escolher'} ${ex.nomePt}`}
                  >{selecionados.some((item) => item.id === ex.id) ? 'Selecionado' : onEscolherVarios ? 'Selecionar' : 'Escolher'}</button>
                )}
              </article>
            );
          })}
        </div>
        {onEscolherVarios && (
          <div style={{ flexShrink: 0, paddingTop: 16, borderTop: '1px solid rgba(234,229,219,.2)' }}>
            <p role="status" style={{ margin: '0 0 10px', color: '#EAE5DB', fontSize: '.85rem' }}>{selecionados.length} selecionados · organize a ordem depois de adicionar.</p>
            <button type="button" disabled={selecionados.length === 0} onClick={() => onEscolherVarios(selecionados)} style={{ ...botao, width: '100%', minHeight: 48, background: '#BDFF00', color: '#0D2818', opacity: selecionados.length ? 1 : .4 }}>Adicionar selecionados ({selecionados.length})</button>
          </div>
        )}
      </div>
    </div>, document.body
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
