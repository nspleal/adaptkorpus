'use client';

import { useCallback, useRef, useState } from 'react';
import type { AlvoAnatomico, EnfaseContextual, FonteAnatomica, PapelDoAlvo } from '@/lib/data/alvos-anatomicos-tipos';

/**
 * 🦴 O QUE ESTE EXERCÍCIO ABORDA — a superfície onde o mapa anatômico dos 168 ids aparece
 * para a pessoa. Irmão de "Como fazer" e do bloco de musculatura pesquisada: um diz COMO
 * executar, este diz QUAIS ALVOS a ação aborda — e o que ela não prova.
 *
 * 🔒 O que a tela nunca deixa de dizer, e por quê:
 *  · **"por inferência anatômica"** vem junto de toda lista de alvo direto. Inferência e
 *    medição são coisas diferentes, e a frase é a única coisa que separa as duas aos olhos de
 *    quem lê. Não há variante do componente sem ela;
 *  · **participação auxiliar em bloco próprio**, com todas as letras: participa, e não fecha
 *    cobertura direta;
 *  · **condição de execução não declarada fica PENDENTE**, com a condição que a resolveria.
 *    Nem coberta, nem negada;
 *  · **cardio é informativo** e nunca vira série de hipertrofia;
 *  · **descritor não é peso**, e a ênfase contextual carrega o protocolo, o comparador e o
 *    limite — inclusive o "não prova hipertrofia".
 *
 * 🔴 O que ela NÃO faz: não mostra número de ativação, não ordena exercícios por "quanto
 * pega", não sugere troca, não diz que um treino está incompleto e não influencia o plano.
 *
 * Carrega sob demanda (`/api/catalogo/alvos-anatomicos?id=`).
 */

interface AlvoResposta {
  alvo: string;
  papel: PapelDoAlvo;
  base: 'inferencia_anatomica';
  porCondicao: boolean;
  ficha: AlvoAnatomico;
}

interface Resposta {
  id: string;
  classificado: boolean;
  motivo?: string;
  nome?: string;
  uso?: 'consulta_anatomica' | 'somente_informativo_cardio' | 'condicional';
  descricaoAcao?: string;
  alvos?: AlvoResposta[];
  condicionaisNaoResolvidas?: { quando: Record<string, string | boolean>; papel: PapelDoAlvo; fichas: AlvoAnatomico[] }[];
  regra?: { id: string; acao: string; natureza: string; justificativa: string; fichas: FonteAnatomica[] };
  descritores?: Record<string, string>;
  enfasesContextuais?: (EnfaseContextual & { ficha: FonteAnatomica })[];
  limitacao?: string;
  definicaoDeAlvoDireto?: string;
  ressalva?: string;
}

const rotulo: React.CSSProperties = {
  fontSize: '.68rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
  color: 'rgba(234,229,219,.55)',
};
const nota: React.CSSProperties = { fontSize: '.8rem', lineHeight: 1.6, color: 'rgba(234,229,219,.66)' };
const lista: React.CSSProperties = { fontSize: '.86rem', lineHeight: 1.6, color: 'rgba(234,229,219,.82)' };

/** Rótulo humano da condição, sem inventar vocabulário: o termo do pacote, por extenso. */
const TEXTO_CONDICAO: Record<string, Record<string, string>> = {
  movimento: {
    extensao_coluna: 'quando o movimento é extensão da coluna',
    dobradica_quadril: 'quando o movimento é dobradiça de quadril',
  },
  acaoPunho: {
    flexao: 'quando o punho flexiona',
    extensao: 'quando o punho estende',
    ambas: 'quando o punho faz os dois sentidos',
  },
  retroversaoPelvica: { true: 'quando há retroversão pélvica', false: 'quando não há retroversão pélvica' },
};

function frase(quando: Record<string, string | boolean>): string {
  return Object.entries(quando)
    .map(([k, v]) => TEXTO_CONDICAO[k]?.[String(v)] ?? `${k}: ${String(v)}`)
    .join(' e ');
}

export default function AlvosAnatomicos({ id, nomePt }: { id: string; nomePt: string }) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState('');
  const pedido = useRef(false);

  const carregar = useCallback(() => {
    if (pedido.current) return;
    pedido.current = true;
    fetch(`/api/catalogo/alvos-anatomicos?id=${encodeURIComponent(id)}`)
      .then(async (r) => setDados(await r.json() as Resposta))
      .catch(() => setErro('Não foi possível carregar agora. Isso não diz nada sobre o exercício.'));
  }, [id]);

  return (
    // `onToggle` e não `onClick`: pega abertura por teclado também, e `carregar` é idempotente.
    <details className="ak-library-instructions" onToggle={(e) => { if (e.currentTarget.open) carregar(); }}>
      <summary aria-label={`Alvos anatômicos de ${nomePt}`}>O que este exercício aborda</summary>
      {erro && <p style={nota}>{erro}</p>}
      {!erro && !dados && <p style={nota}>Carregando…</p>}
      {dados && !dados.classificado && <p style={nota}>{dados.motivo}</p>}
      {dados?.classificado && <Conteudo d={dados} />}
    </details>
  );
}

function Conteudo({ d }: { d: Resposta }) {
  const alvos = d.alvos ?? [];
  const diretos = alvos.filter((a) => a.papel === 'direto');
  const auxiliares = alvos.filter((a) => a.papel === 'auxiliar');
  const cardio = alvos.filter((a) => a.papel === 'informativo_cardio');
  const pendentes = d.condicionaisNaoResolvidas ?? [];

  return (
    <>
      {d.descricaoAcao && <p style={{ ...lista, margin: '8px 0' }}>{d.descricaoAcao}.</p>}

      {/* 🔒 A trava de leitura vem ANTES da lista. É ela que impede ler "alvo direto" como
          "o músculo que mais cresce": a definição é do próprio pacote, verbatim. */}
      <p style={{ ...nota, borderLeft: '2px solid rgba(189,255,0,.35)', paddingLeft: 10, margin: '10px 0' }}>
        {d.definicaoDeAlvoDireto}
      </p>

      {diretos.length > 0 && (
        <div style={{ margin: '10px 0' }}>
          <div style={rotulo}>Aborda diretamente · por inferência anatômica</div>
          <div style={lista}>{diretos.map((a) => a.ficha.nome).join(' · ')}</div>
        </div>
      )}

      {auxiliares.length > 0 && (
        <div style={{ margin: '10px 0' }}>
          <div style={rotulo}>Participa como auxiliar</div>
          <div style={lista}>{auxiliares.map((a) => a.ficha.nome).join(' · ')}</div>
          <p style={{ ...nota, marginTop: 4 }}>
            Participação auxiliar não conta como alvo abordado. Ela continua valendo o crédito
            parcial de volume que o plano já dava ao grupo, e nada além disso.
          </p>
        </div>
      )}

      {cardio.length > 0 && (
        <div style={{ margin: '10px 0' }}>
          <div style={rotulo}>Participação em cardio · informativa</div>
          <div style={lista}>{cardio.map((a) => a.ficha.nome).join(' · ')}</div>
          <p style={{ ...nota, marginTop: 4 }}>
            Exercício de cardio: a participação é informativa e não é série de hipertrofia.
          </p>
        </div>
      )}

      {pendentes.length > 0 && (
        <div style={{ margin: '10px 0' }}>
          <div style={rotulo}>Depende de como você executa</div>
          {pendentes.map((c, i) => (
            <p key={i} style={{ ...lista, margin: '4px 0' }}>
              {c.fichas.map((f) => f.nome).join(' · ')}
              <span style={nota}>{' — '}{frase(c.quando)} ({c.papel === 'direto' ? 'como alvo direto' : 'como auxiliar'}).</span>
            </p>
          ))}
          <p style={{ ...nota, marginTop: 4 }}>
            Sem essa informação, o alvo fica em aberto: não é dado como abordado nem como ausente.
          </p>
        </div>
      )}

      <details className="ak-library-instructions" style={{ marginTop: 6 }}>
        <summary>Ressalvas e fontes</summary>

        <p style={{ ...nota, margin: '10px 0' }}>{d.ressalva}</p>

        {d.regra && (
          <section style={{ margin: '14px 0' }}>
            <div style={rotulo}>Como foi classificado</div>
            <div style={nota}>{d.regra.acao} — {d.regra.justificativa}</div>
            <ul style={{ ...nota, margin: '6px 0 0', paddingLeft: 18 }}>
              {d.regra.fichas.map((f, i) => (
                <li key={i}>
                  <a href={f.url} target="_blank" rel="noreferrer" style={{ color: 'rgba(234,229,219,.8)' }}>{f.titulo}</a>
                  {f.local && ` · ${f.local}`}
                  {f.fatoAnatomico && <div>{f.fatoAnatomico}</div>}
                  {f.natureza && <div>{f.natureza}</div>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {d.descritores && Object.keys(d.descritores).length > 0 && (
          <section style={{ margin: '14px 0' }}>
            <div style={rotulo}>Descritores mecânicos</div>
            <div style={nota}>{Object.entries(d.descritores).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>
            {/* 🔴 Inclinação e trajetória explicam diferença de execução. Não são medida de
                eficiência e o motor não os lê. */}
            <p style={{ ...nota, marginTop: 4 }}>
              Descrevem a mecânica do movimento. Não são medida de eficiência nem de crescimento.
            </p>
          </section>
        )}

        {(d.enfasesContextuais ?? []).length > 0 && (
          <section style={{ margin: '14px 0' }}>
            <div style={rotulo}>Comparação contextual</div>
            {d.enfasesContextuais!.map((e, i) => (
              <div key={i} style={{ margin: '8px 0', paddingLeft: 10, borderLeft: '1px solid rgba(234,229,219,.14)' }}>
                <p style={{ ...lista, margin: 0 }}>{e.resultado}</p>
                <p style={{ ...nota, margin: '4px 0 0' }}>
                  Protocolo: {Object.entries(e.protocolo).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join('–') : String(v)}`).join(' · ')}
                </p>
                <p style={{ ...nota, margin: '4px 0 0' }}>Limites: {e.limite}</p>
                <p style={{ ...nota, margin: '4px 0 0' }}>
                  <a href={e.ficha.url} target="_blank" rel="noreferrer" style={{ color: 'rgba(234,229,219,.8)' }}>{e.ficha.titulo}</a>
                  {e.ficha.doi && <> · DOI {e.ficha.doi}</>}
                </p>
              </div>
            ))}
          </section>
        )}

        {d.limitacao && (
          <section style={{ margin: '14px 0' }}>
            <div style={rotulo}>Limite declarado</div>
            <div style={nota}>{d.limitacao}</div>
          </section>
        )}
      </details>
    </>
  );
}
