export type RegistroDia = {
  logs: Record<string, 'seguiu' | 'fora' | 'comi' | null>;
  notes: Record<string, string>;
  pendenteSync?: boolean;
};
export type HistoricoAderencia = Record<string, RegistroDia>;
export type EstadoSyncAderencia = 'local' | 'salvando' | 'pendente' | 'salvo' | 'falha-local';

/** O servidor vence só onde não há edição local ainda não confirmada. */
export function mesclarAderencia(local: HistoricoAderencia, servidor: HistoricoAderencia): HistoricoAderencia {
  const resultado = { ...local, ...servidor };
  for (const [dia, valor] of Object.entries(local)) {
    if (valor?.pendenteSync) resultado[dia] = valor;
  }
  return resultado;
}

/** Uma escrita em voo por instância; confirmação antiga não limpa edição mais nova.
 * Não repete automaticamente uma falha. Próxima edição, recarga ou ação explícita tenta
 * novamente o estado atual. O escopo é conferido antes de qualquer leitura ou escrita.
 */
export function criarPersistenciaAderencia(deps: {
  ativo: () => boolean;
  online: boolean;
  ler: () => HistoricoAderencia;
  gravar: (historico: HistoricoAderencia) => void;
  enviar: (dia: string, valor: RegistroDia) => Promise<boolean>;
  mostrar: (estado: EstadoSyncAderencia) => void;
}) {
  let executando = false;
  let falhaLocal = false;
  const memoria: HistoricoAderencia = {};
  const editados = new Set<string>();
  const ler = () => ({ ...deps.ler(), ...memoria });
  function guardar(h: HistoricoAderencia) {
    try { deps.gravar(h); falhaLocal = false; return true; }
    catch { falhaLocal = true; deps.mostrar('falha-local'); return false; }
  }
  async function sincronizar() {
    if (!deps.ativo() || executando || !deps.online) return;
    executando = true;
    try {
      while (deps.ativo()) {
        const proximo = Object.entries(ler()).find(([, d]) => d?.pendenteSync);
        if (!proximo) { deps.mostrar(falhaLocal ? 'falha-local' : 'salvo'); break; }
        const [dia, valor] = proximo;
        deps.mostrar('salvando');
        let ok = false;
        try { ok = await deps.enviar(dia, valor); } catch { /* falha preserva pendência */ }
        if (!deps.ativo()) break;
        if (!ok) { deps.mostrar(falhaLocal ? 'falha-local' : 'pendente'); break; }
        const atual = ler();
        if (JSON.stringify(atual[dia]) === JSON.stringify(valor)) {
          const confirmado = { ...valor, pendenteSync: false };
          memoria[dia] = confirmado;
          if (guardar({ ...atual, [dia]: confirmado })) delete memoria[dia];
        }
      }
    } finally { executando = false; }
  }
  return {
    editar(dia: string, alterar: (anterior: RegistroDia) => RegistroDia): RegistroDia | undefined {
      if (!deps.ativo()) return;
      const all = ler();
      editados.add(dia);
      const novo = { ...alterar(all[dia] ?? { logs: {}, notes: {} }), pendenteSync: deps.online };
      memoria[dia] = novo;
      if (guardar({ ...all, [dia]: novo })) delete memoria[dia];
      if (!deps.online) deps.mostrar(falhaLocal ? 'falha-local' : 'local');
      void sincronizar();
      return novo;
    },
    receber(servidor: HistoricoAderencia, hoje: string) {
      if (!deps.ativo()) return;
      const local = ler();
      // Compatibilidade: somente dias legados ausentes no servidor são migrados.
      const limite = Date.parse(`${hoje}T00:00:00Z`) - 30 * 86400000;
      for (const [dia, valor] of Object.entries(local)) {
        if (!servidor[dia] && valor && Date.parse(`${dia}T00:00:00Z`) >= limite) {
          local[dia] = { ...valor, pendenteSync: deps.online };
        }
      }
      const mesclado = mesclarAderencia(local, servidor);
      // Um GET iniciado antes da edição pode chegar depois da confirmação do PUT.
      for (const dia of editados) if (local[dia]) mesclado[dia] = local[dia];
      guardar(mesclado);
      void sincronizar();
      return mesclado;
    },
    sincronizar,
  };
}
