'use client';
import { useEffect, useState } from 'react';
import type { ItemOutbox } from '@/lib/persistencia/outbox-db';
import { bancoSync, escolherConflito, lerSnapshotRemoto } from '@/lib/persistencia/sync-cliente';
import { carregarAderenciaServidor, carregarHistoricoServidor } from '@/lib/persistencia/sync';
import { continuacaoDaConta } from '@/lib/persistencia/continuidade-conta';
import { useGravacaoLocal } from '@/lib/persistencia/use-gravacao-local';
import { escopoLocal } from '@/lib/escopo-local';
import { mesclarTresVias } from '@/lib/persistencia/mescla';
import { ROTULOS_CAMPOS_PERFIL } from '@/lib/validation/perfil-resumo';
import { EXERCISES_SEED } from '@/lib/data/seed';

const nomes = new Map(EXERCISES_SEED.map((e) => [e.id,e.nomePt]));
function legivel(v: unknown): string {
  if (v == null) return 'Não informado';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'string') return nomes.get(v) ?? v;
  if (Array.isArray(v)) return v.map(legivel).join(', ');
  if (typeof v === 'object') return Object.entries(v).map(([k,x]) => `${nomes.get(k) ?? ROTULOS_CAMPOS_PERFIL[k] ?? k}: ${legivel(x)}`).join('; ');
  return String(v);
}
function resumo(item: ItemOutbox): string {
  const c = item.comando;
  switch (c.tipo) {
    case 'SESSAO': return `${c.payload.sessao.dataISO}: ${c.payload.sessao.exercicios.map((e) => `${e.nome}: ${e.sets.map((s) => `${s.reps} × ${s.kg || '0'} kg`).join(', ')}; esforço ${e.fb ?? 'não informado'}`).join('; ')}`;
    case 'PESO': return `${c.payload.pesoKg} kg em ${c.payload.dataISO}`;
    case 'ADERENCIA': return `${c.payload.dia}: ${legivel(c.payload.logs)}. ${legivel(c.payload.notes)}`;
    case 'RASCUNHO_SESSAO': return 'Séries, valores e observações do treino em andamento neste aparelho.';
    case 'DESFAZER_TREINO': return 'Pedido de voltar à versão anterior capturada ao tocar em Desfazer.';
    default: return 'Edição de perfil ou treino neste aparelho.';
  }
}
export default function ConflitoSync({ item, aoResolver }: { item: ItemOutbox; aoResolver: () => Promise<void> }) {
  const [servidor, setServidor] = useState<string | null>(null), [campos, setCampos] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState(false);
  const gravacao = useGravacaoLocal();
  useEffect(() => {
    let vivo = true;
    const subject = escopoLocal(); if (!subject) return;
    const ativo = continuacaoDaConta(escopoLocal, subject, () => vivo);
    void (async () => {
      const c = item.comando;
      let texto = 'Versão atual da conta.';
      if (c.tipo === 'PERFIL' || c.tipo === 'APLICAR_TREINO') {
        const r = await lerSnapshotRemoto(subject); if (!ativo() || !r || r === 'sem_perfil') return;
        const base = c.payload.base ?? await (await bancoSync()).ler<import('@/lib/persistencia/sync-contrato').SnapshotConta>(subject, `base:${c.operationId}`);
        if (!ativo()) return;
        if (base) {
          const conflitos = mesclarTresVias(base.perfil, c.payload.perfil, r.perfil).conflitos;
          if (ativo()) setCampos(conflitos.map((p) => ROTULOS_CAMPOS_PERFIL[p.split('/')[1]!] ?? 'Estrutura do treino'));
          const chaves = [...new Set(conflitos.map((p) => p.split('/')[1]!))];
          texto = chaves.map((k) => `${ROTULOS_CAMPOS_PERFIL[k] ?? 'Treino'}: ${legivel((r.perfil as unknown as Record<string,unknown>)[k])}`).join('; ') || texto;
        }
      } else if (c.tipo === 'SESSAO') {
        const hist = await carregarHistoricoServidor(); if (!ativo() || !hist) return;
        const atual = hist.find((s) => s.id === c.payload.sessao.id);
        texto = atual ? resumo({ ...item, comando: { ...c, payload: { sessao: atual } } }) : 'A sessão ainda não está na conta.';
      } else if (c.tipo === 'ADERENCIA') {
        const dias = await carregarAderenciaServidor(); if (!ativo() || !dias) return;
        texto = legivel(dias[c.payload.dia] ?? 'Sem registro neste dia.');
      } else if (c.tipo === 'RASCUNHO_SESSAO') texto = 'Há outra edição da sessão em andamento. Escolher mantém a edição selecionada e as alterações independentes compatíveis.';
      if (ativo()) setServidor(texto);
    })().catch(() => { if (ativo()) setErro(true); });
    return () => { vivo = false; };
  }, [item]);
  async function escolher(escolha: 'local' | 'servidor') {
    const subject = escopoLocal(); if (!subject || ocupado) return;
    const ativo = gravacao.capturarContinuacao(); if (!ativo()) return;
    setOcupado(true); setErro(false);
    try { await escolherConflito(subject,item.comando.operationId,escolha); if (ativo()) await aoResolver(); }
    catch { if (ativo()) setErro(true); } finally { if (ativo()) setOcupado(false); }
  }
  const recusado = item.recibo?.tipo === 'RECUSADO';
  return <div role="alert" style={{ marginTop: 12 }}>
    <p>{recusado ? 'A conta recusou esta alteração.' : 'As mesmas informações receberam edições diferentes.'}{campos.length ? ` Campos: ${[...new Set(campos)].join(', ')}.` : ''}</p>
    <p><strong>Neste aparelho:</strong> {resumo(item)}</p>
    {servidor ? <p><strong>Na conta:</strong> {servidor}</p> : <p>Conecte-se para conferir os dados da conta antes de escolher.</p>}
    {item.comando.tipo === 'DESFAZER_TREINO' ? <p>A versão anterior mudou. Este pedido não será redirecionado; depois de conferir a conta, você pode fazer um novo pedido.</p> : null}
    {!recusado && item.comando.tipo !== 'DESFAZER_TREINO' ? <button disabled={!servidor || ocupado} onClick={() => void escolher('local')}>Manter minha alteração</button> : null}{' '}
    <button disabled={!servidor || ocupado} onClick={() => void escolher('servidor')}>{recusado ? 'Reconhecer recusa' : 'Manter dados da conta'}</button>
    {erro ? <p>Não foi possível confirmar a escolha. As duas versões continuam preservadas.</p> : null}
  </div>;
}
