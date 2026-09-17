'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import type { Exercise } from '@/lib/data/types';
import type { CondicaoExecucao } from '@/lib/data/alvos-anatomicos-tipos';
import { coberturaDoDia, type CoberturaDoGrupo, type EstadoDaParte, type ParteDoGrupo } from '@/lib/engine/cobertura-editor';
import { ROTULO_GRUPO } from '@/lib/frequencia-grupos';
import { AVISO_NAO_RESOLVE, ROTULO_CONDICIONAL, fraseDaCondicao } from '@/lib/condicao-execucao-copy';
import { formatarDuracaoMinutos } from '@/lib/formatar-duracao';

/**
 * 🦴 COBERTURA MUSCULAR ENQUANTO SE MONTA — por dia e por grupo, ao vivo.
 *
 * Diz três coisas, e só essas três: quais partes dos grupos DAQUELE DIA os exercícios
 * escolhidos abordam, quais ficaram sem exercício identificado, e o que o catálogo elegível
 * ainda oferece para elas.
 *
 * 🔒 O que a tela nunca deixa de dizer:
 *  · **"Sem exercício identificado para esta região"** — nunca "esta região não é ativada".
 *    A diferença é entre o que o dado sustenta e uma afirmação que ele não sustenta;
 *  · **participação auxiliar em bloco próprio**: participa, por inferência anatômica, e não
 *    fecha cobertura direta;
 *  · **condição de execução não declarada fica PENDENTE**, com a condição que a resolveria —
 *    nem coberta, nem negada;
 *  · **lacuna do catálogo é lacuna do catálogo** — nenhuma cobertura é inventada para ela;
 *  · **cobertura ≠ dose**: presença anatômica não prova dose suficiente, ênfase predominante
 *    nem garantia de resultado (a ressalva do próprio pacote fecha o bloco).
 *
 * 🔴 O que ela NÃO faz: não adiciona, troca nem remove nada sozinha (as sugestões só entram
 * por um toque da pessoa), não bloqueia o salvamento, não pontua exercício, não ordena por
 * "quanto pega" e não repete o que o crítico ou os avisos do motor já dizem — ela fala de
 * PARTES abordadas, não de volume, tempo ou fase.
 *
 * Fica fechada por padrão: resumo legível, detalhe sob demanda.
 */

const rotulo: CSSProperties = {
  fontSize: '.68rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
  color: 'rgba(234,229,219,.55)',
};
const nota: CSSProperties = { fontSize: '.79rem', lineHeight: 1.55, color: 'rgba(234,229,219,.62)' };
const item: CSSProperties = { fontSize: '.85rem', lineHeight: 1.5, color: 'rgba(234,229,219,.85)' };
/**
 * 🔵 O bloco virou CARTÃO (2026-09-17): antes era uma linha de texto solta abaixo do botão
 * verde de adicionar, e no celular o botão funcionava como fim do cartão do dia — o que vinha
 * depois lia-se como rodapé. Agora ele tem moldura própria e mora ANTES do botão, junto do
 * conteúdo que descreve.
 */
const caixa: CSSProperties = {
  background: 'rgba(189,255,0,.04)', border: '1px solid rgba(189,255,0,.22)',
  borderRadius: 12, padding: '10px 12px',
};
const cabecalho: CSSProperties = {
  fontSize: '.85rem', fontWeight: 700, color: '#EAE5DB', letterSpacing: '-.01em',
};

const MARCA: Record<EstadoDaParte, { marca: string; cor: string }> = {
  identificada: { marca: '●', cor: '#BDFF00' },
  participacao_auxiliar: { marca: '◐', cor: 'rgba(234,229,219,.75)' },
  condicional_pendente: { marca: '?', cor: '#EAB308' },
  sem_exercicio_identificado: { marca: '○', cor: 'rgba(234,229,219,.5)' },
  sem_candidato_elegivel: { marca: '○', cor: 'rgba(234,229,219,.5)' },
  sem_candidato_no_catalogo: { marca: '○', cor: 'rgba(234,229,219,.5)' },
};

/** O efeito que ADICIONAR um exercício teria — calculado pelo motor, nunca estimado aqui. */
export interface EfeitoDaSugestao {
  /** Δ do tempo do dia, em segundos. `null` quando o motor se absteve de calcular. */
  deltaSegundos: number | null;
  /** Δ das séries que o motor planeja para ESTE dia. `null` quando ele não anotou séries. */
  deltaSeriesNoDia: number | null;
  /**
   * Δ das séries semanais PONDERADAS do grupo, pelo placar do crítico.
   *
   * 🔴 `null` quando o placar não acompanha o grupo — ele cobre os grupos GRANDES, e core,
   * braços, panturrilha, lombar e antebraço ficam de fora. Dizer "sem mudança no volume
   * semanal de Core" nesse caso seria afirmar algo que a conta não sustenta (defeito medido
   * no QA desta leva). Onde não há conta, a tela cala.
   */
  deltaSeriesDoGrupo: number | null;
  /** O grupo cujo volume muda — o mesmo rótulo do placar. */
  grupo: string;
  /** O dia passa a exceder o tempo por sessão, segundo o próprio motor. */
  excedeOTempo: boolean;
  /**
   * 🔵 Onde o volume SEMANAL do grupo passa a cair, pelo placar do crítico (2026-09-17).
   * `automatico` = acima do que o app monta sozinho e ainda dentro do teto; `teto` = acima do
   * teto cheio. `null` quando o placar não acompanha o grupo — onde não há conta, a tela cala.
   */
  passaDoSemanal: 'nao' | 'automatico' | 'teto' | null;
  /** O grupo passa do teto de séries ponderadas NESTE dia, pelo mesmo crítico. */
  passaDoTetoDaSessao: boolean;
}

export default function CoberturaMuscular({
  nomeDoDia, escolhidos, elegiveis, condicoesPorId, onAdicionar, efeitoDe,
}: {
  nomeDoDia: string;
  escolhidos: readonly Exercise[];
  /** Pool elegível do motor (`poolElegivel`) — o que a pessoa realmente pode usar. */
  elegiveis: readonly Exercise[];
  condicoesPorId?: Readonly<Record<string, CondicaoExecucao>>;
  /** Adiciona ao dia. 🔒 Só por toque da pessoa — nada entra sozinho no desenho manual. */
  onAdicionar: (ex: Exercise) => void;
  /** Consequência de adicionar, pelo cálculo existente. Ausente ⇒ a tela não afirma efeito. */
  efeitoDe?: (ex: Exercise) => EfeitoDaSugestao | null;
}) {
  const cobertura = useMemo(
    () => coberturaDoDia({
      nome: nomeDoDia,
      escolhidos,
      elegiveis,
      ...(condicoesPorId ? { condicoesPorId } : {}),
    }),
    [nomeDoDia, escolhidos, elegiveis, condicoesPorId],
  );
  const porId = useMemo(() => new Map(elegiveis.map((e) => [e.id, e])), [elegiveis]);
  const nomeNoDia = useMemo(() => new Map(escolhidos.map((e) => [e.id, e.nomePt])), [escolhidos]);

  /**
   * 🔴 O BLOCO NÃO SOME MAIS (correção 2026-09-17, do relato "a cobertura não apareceu").
   *
   * Antes ele devolvia `null` com o dia vazio — e é justamente com o dia vazio que a pessoa
   * abre o editor pela primeira vez. Ausência é indistinguível de quebrado: quem não viu
   * nada não tem como saber se a funcionalidade existe. Agora o dia vazio DIZ que a leitura
   * aparece assim que houver exercício.
   *
   * O outro caminho de ausência é real e continua: um dia só de cardio não tem grupo
   * muscular, e inventar regiões para ele seria afirmar o que o dado não sustenta.
   */
  const vazio = escolhidos.length === 0;
  const semGrupos = !vazio && cobertura.grupos.length === 0;
  if (vazio || semGrupos) {
    return (
      <div style={{ ...caixa, marginTop: 10 }}>
        <div style={cabecalho}>Cobertura muscular</div>
        <p style={{ ...nota, margin: '4px 0 0' }}>
          {vazio
            ? 'Assim que você adicionar exercícios a este dia, mostramos aqui quais regiões dos grupos escolhidos eles contemplam e quais ficam sem exercício identificado.'
            : 'Os itens deste dia não têm grupo muscular na base (cardio, por exemplo), então não há regiões a listar.'}
        </p>
      </div>
    );
  }

  return (
    /**
     * 🔵 ABERTO quando há o que fazer (2026-09-17). Fechado por padrão, a leitura só
     * aparecia para quem já sabia que ela existia — e o relato é exatamente de quem não
     * sabia. Com região sem exercício identificado, o bloco abre; sem pendência nenhuma ele
     * fica fechado, porque aí é confirmação, não tarefa.
     */
    <details open={cobertura.semExercicio > 0} style={{ ...caixa, marginTop: 10 }}>
      <summary style={{ cursor: 'pointer', padding: '2px 0', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={cabecalho}>Cobertura muscular</span>
        <span style={{ fontSize: '.76rem', fontWeight: 700, color: '#BDFF00', border: '1px solid rgba(189,255,0,.35)', borderRadius: 999, padding: '2px 8px' }}>
          {cobertura.identificadas} {cobertura.identificadas === 1 ? 'região' : 'regiões'}
        </span>
        {cobertura.semExercicio > 0 && (
          <span style={{ fontSize: '.76rem', fontWeight: 700, color: 'rgba(234,229,219,.75)', border: '1px solid rgba(234,229,219,.25)', borderRadius: 999, padding: '2px 8px' }}>
            {cobertura.semExercicio} sem exercício
          </span>
        )}
        <span aria-hidden style={{ marginLeft: 'auto', fontSize: '.78rem', color: 'rgba(234,229,219,.55)' }}>ver detalhes</span>
      </summary>

      <p style={{ ...nota, margin: '2px 0 12px' }}>
        Regiões dos grupos deste dia. Um exercício pode contemplar várias — não é preciso um
        exercício por região.
      </p>

      {cobertura.grupos.map((g) => (
        <Grupo
          key={g.grupo}
          grupo={g}
          nomeNoDia={nomeNoDia}
          porId={porId}
          onAdicionar={onAdicionar}
          {...(efeitoDe ? { efeitoDe } : {})}
        />
      ))}

      {cobertura.semClassificacao.length > 0 && (
        <p style={{ ...nota, marginTop: 10 }}>
          {cobertura.semClassificacao.length === 1 ? 'Um exercício deste dia não tem' : `${cobertura.semClassificacao.length} exercícios deste dia não têm`}
          {' '}classificação anatômica na base. Isso é ausência de informação, não de trabalho muscular.
        </p>
      )}

      <p style={{ ...nota, marginTop: 12, borderLeft: '2px solid rgba(189,255,0,.3)', paddingLeft: 10 }}>
        {cobertura.ressalva} Cobertura não diz dose suficiente nem qual região predomina, e não
        impede salvar o seu treino.
      </p>
    </details>
  );
}

function Grupo({ grupo, nomeNoDia, porId, onAdicionar, efeitoDe }: {
  grupo: CoberturaDoGrupo;
  nomeNoDia: ReadonlyMap<string, string>;
  porId: ReadonlyMap<string, Exercise>;
  onAdicionar: (ex: Exercise) => void;
  efeitoDe?: (ex: Exercise) => EfeitoDaSugestao | null;
}) {
  const identificadas = grupo.partes.filter((p) => p.estado === 'identificada');
  const auxiliares = grupo.partes.filter((p) => p.estado === 'participacao_auxiliar');
  const pendentes = grupo.partes.filter((p) => p.estado === 'condicional_pendente');
  const semExercicio = grupo.partes.filter((p) => p.estado !== 'identificada'
    && p.estado !== 'participacao_auxiliar' && p.estado !== 'condicional_pendente');

  return (
    <section
      aria-label={`Cobertura de ${ROTULO_GRUPO[grupo.grupo] ?? grupo.grupo}`}
      style={{ background: 'rgba(234,229,219,.035)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 12, padding: '10px 12px', marginBottom: 8 }}
    >
      <div style={{ ...rotulo, marginBottom: 6 }}>
        {ROTULO_GRUPO[grupo.grupo] ?? grupo.grupo}
        <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: 'rgba(234,229,219,.5)' }}>
          {' '}· {grupo.identificadas}/{grupo.partes.length} identificadas
        </span>
      </div>

      {identificadas.length > 0 && (
        <Bloco
          estado="identificada"
          titulo="Contempladas pelos exercícios deste dia"
          partes={identificadas}
          detalhe={(p) => p.porExercicios.map((id) => nomeNoDia.get(id) ?? id).join(', ')}
        />
      )}

      {auxiliares.length > 0 && (
        <Bloco
          estado="participacao_auxiliar"
          titulo="Participação auxiliar (por inferência anatômica) — não fecha cobertura"
          partes={auxiliares}
          detalhe={(p) => p.auxiliaresNoDia.map((id) => nomeNoDia.get(id) ?? id).join(', ')}
        />
      )}

      {/**
        * 🔴 DECISÃO DO AUTOR (2026-09-16): o app NÃO vai ter superfície para declarar execução
        * nesta entrega. Então o estado condicional é dito com o rótulo fechado — "depende da
        * execução; NÃO CONFIRMADO" — com a condição em português, e com o aviso de que
        * escolher o mesmo exercício de novo não resolve. Sem o aviso, a leitura natural é
        * "é só adicionar", e o app estaria induzindo a uma conclusão que o dado não sustenta.
        */}
      {pendentes.length > 0 && (
        <Bloco
          estado="condicional_pendente"
          titulo={ROTULO_CONDICIONAL}
          nota={AVISO_NAO_RESOLVE}
          partes={pendentes}
          detalhe={(p) => p.condicoesPendentes
            .map((c) => `${nomeNoDia.get(c.exercicioId) ?? c.exercicioId}: ${fraseDaCondicao(c.quando)}`)
            .join(' · ')}
        />
      )}

      {semExercicio.map((p) => (
        <SemExercicio
          key={p.alvo}
          parte={p}
          porId={porId}
          onAdicionar={onAdicionar}
          {...(efeitoDe ? { efeitoDe } : {})}
        />
      ))}
    </section>
  );
}

function Bloco({ estado, titulo, nota: aviso, partes, detalhe }: {
  estado: EstadoDaParte;
  titulo: string;
  /** Linha extra abaixo do título — hoje só o "adicionar não confirma". */
  nota?: string;
  partes: readonly ParteDoGrupo[];
  detalhe: (p: ParteDoGrupo) => string;
}) {
  const { marca, cor } = MARCA[estado];
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ ...nota, margin: '0 0 4px' }}>{titulo}</p>
      {aviso && <p style={{ ...nota, margin: '0 0 4px', color: 'rgba(234,229,219,.55)' }}>{aviso}</p>}
      {partes.map((p) => (
        <p key={p.alvo} style={{ ...item, margin: '0 0 2px' }}>
          <span aria-hidden style={{ color: cor, marginRight: 6 }}>{marca}</span>
          {p.nome}
          {detalhe(p) && <span style={{ color: 'rgba(234,229,219,.5)' }}> — {detalhe(p)}</span>}
        </p>
      ))}
    </div>
  );
}

function SemExercicio({ parte, porId, onAdicionar, efeitoDe }: {
  parte: ParteDoGrupo;
  porId: ReadonlyMap<string, Exercise>;
  onAdicionar: (ex: Exercise) => void;
  efeitoDe?: (ex: Exercise) => EfeitoDaSugestao | null;
}) {
  const { marca, cor } = MARCA[parte.estado];
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ ...item, margin: '0 0 2px' }}>
        <span aria-hidden style={{ color: cor, marginRight: 6 }}>{marca}</span>
        {parte.nome}
        <span style={{ color: 'rgba(234,229,219,.55)' }}> — Sem exercício identificado para esta região</span>
      </p>
      {parte.estado === 'sem_candidato_no_catalogo' && (
        <p style={{ ...nota, margin: '0 0 0 18px' }}>
          Nenhum exercício do catálogo aborda esta região diretamente. Não há o que sugerir aqui.
        </p>
      )}
      {parte.estado === 'sem_candidato_elegivel' && (
        <p style={{ ...nota, margin: '0 0 0 18px' }}>
          Existe exercício para ela no catálogo, mas nenhum está liberado pelo seu equipamento
          e nível atuais.
        </p>
      )}
      {parte.sugestoes.length > 0 && (
        <div style={{ margin: '4px 0 0 18px' }}>
          <p style={{ ...nota, margin: '0 0 4px' }}>Poderiam contemplá-la:</p>
          {parte.sugestoes.map((s) => {
            const ex = porId.get(s.id);
            if (!ex) return null;
            return (
              <Sugestao
                key={s.id}
                ex={ex}
                dependeDeExecucao={s.dependeDeExecucao}
                condicoes={s.condicoes.map(fraseDaCondicao)}
                onAdicionar={onAdicionar}
                {...(efeitoDe ? { efeitoDe } : {})}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sugestao({ ex, dependeDeExecucao, condicoes, onAdicionar, efeitoDe }: {
  ex: Exercise;
  dependeDeExecucao: boolean;
  condicoes: readonly string[];
  onAdicionar: (ex: Exercise) => void;
  efeitoDe?: (ex: Exercise) => EfeitoDaSugestao | null;
}) {
  /**
   * 🔒 O efeito é calculado SÓ quando a pessoa pede — uma passada do motor por sugestão
   * aberta, e não uma por sugestão listada. Ele vem do mesmo cálculo do plano (tempo do dia e
   * placar de volume); quando o motor se abstém, a tela se abstém junto.
   */
  const [efeito, setEfeito] = useState<EfeitoDaSugestao | null | undefined>(undefined);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <div style={{ ...item }}>{ex.nomePt}</div>
        {dependeDeExecucao && (
          <div style={nota}>
            <strong style={{ fontWeight: 600 }}>{ROTULO_CONDICIONAL}.</strong> Ele só contempla
            esta região {condicoes.join(' ou ')}. {AVISO_NAO_RESOLVE}
          </div>
        )}
        {efeito !== undefined && <EfeitoLinha efeito={efeito} />}
      </div>
      {efeitoDe && efeito === undefined && (
        <button
          type="button"
          onClick={() => setEfeito(efeitoDe(ex))}
          style={{ background: 'none', border: '1px solid rgba(234,229,219,.25)', color: 'rgba(234,229,219,.85)', borderRadius: 10, padding: '8px 10px', fontSize: '.78rem', cursor: 'pointer', minHeight: 44 }}
        >
          O que muda
        </button>
      )}
      <button
        type="button"
        onClick={() => onAdicionar(ex)}
        style={{ background: 'rgba(189,255,0,.12)', border: '1px solid rgba(189,255,0,.4)', color: '#BDFF00', borderRadius: 10, padding: '8px 12px', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', minHeight: 44 }}
        aria-label={`Adicionar ${ex.nomePt} a este dia`}
      >
        Adicionar
      </button>
    </div>
  );
}

const sinal = (n: number) => (n > 0 ? '+' : '−');
const modulo = (n: number) => Math.abs(Math.round(n * 10) / 10);

function EfeitoLinha({ efeito }: { efeito: EfeitoDaSugestao | null }) {
  if (!efeito) {
    return <div style={nota}>Não foi possível calcular o efeito agora.</div>;
  }
  /**
   * 🔒 Cada parte só aparece quando a conta EXISTE. Abstenção do motor vira ausência de frase,
   * não um zero — "sem mudança" é uma afirmação, e só cabe quando foi de fato medida.
   */
  const partes = [
    efeito.deltaSegundos == null
      ? 'o app não conseguiu calcular o tempo deste dia'
      : efeito.deltaSegundos === 0
        ? 'não muda o tempo previsto do dia'
        : `${sinal(efeito.deltaSegundos)}${formatarDuracaoMinutos(Math.abs(efeito.deltaSegundos) / 60)} no dia`,
    efeito.deltaSeriesNoDia == null || efeito.deltaSeriesNoDia === 0
      ? null
      : `${sinal(efeito.deltaSeriesNoDia)}${modulo(efeito.deltaSeriesNoDia)} séries neste dia`,
    efeito.deltaSeriesDoGrupo == null
      ? null
      : efeito.deltaSeriesDoGrupo === 0
        ? `sem mudança no volume semanal de ${efeito.grupo}`
        : `${sinal(efeito.deltaSeriesDoGrupo)}${modulo(efeito.deltaSeriesDoGrupo)} séries na semana de ${efeito.grupo}`,
    efeito.excedeOTempo ? 'passaria do seu tempo por sessão' : null,
    /**
     * 🔵 A CONSEQUÊNCIA NOS LIMITES (2026-09-17) — e cada frase diz o limite CERTO.
     * "acima do que o app monta sozinho" não é "acima do teto", e trocar as duas afirmaria
     * um estouro que não houve. `null` ⇒ o placar não acompanha o grupo ⇒ a tela cala.
     */
    efeito.passaDoSemanal === 'teto'
      ? 'passaria do teto de volume da semana deste grupo'
      : efeito.passaDoSemanal === 'automatico'
        ? 'ficaria acima do que o app monta sozinho na semana, ainda dentro do teto'
        : null,
    efeito.passaDoTetoDaSessao ? 'passaria do máximo deste grupo num treino só' : null,
  ].filter(Boolean);
  return <div style={nota}>{partes.join(' · ')}</div>;
}
