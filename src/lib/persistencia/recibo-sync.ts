import type { ComandoSync, ReciboSync } from './sync-contrato';
import { pesoKgDaResposta } from '@/lib/peso-dominio';

/** Resposta incompleta não comprova commit. Não converte ausência/string em zero. */
export function validarReciboSync(comando: ComandoSync, raw: unknown): ReciboSync | null {
  if (!raw || typeof raw !== 'object') return null;
  const recibo = raw as Record<string, unknown>;
  if (recibo.operationId !== comando.operationId) return null;

  const revision = Number.isSafeInteger(recibo.revision) && Number(recibo.revision) >= 0
    ? recibo.revision as number : undefined;
  const pesoKg = pesoKgDaResposta(recibo.pesoKg);
  const camposOpcionais = {
    ...(revision !== undefined ? { revision } : {}),
    ...(pesoKg !== null ? { pesoKg } : {}),
  };
  if (recibo.tipo === 'ACK') {
    const exigeRevisao = ['PERFIL', 'APLICAR_TREINO', 'DESFAZER_TREINO', 'RASCUNHO_SESSAO'].includes(comando.tipo);
    if (exigeRevisao && revision === undefined) return null;
    if (comando.tipo === 'PESO' && (!['REGISTRADO', 'IDEMPOTENTE'].includes(String(recibo.estado)) || pesoKg === null)) return null;
    return {
      tipo: 'ACK', operationId: comando.operationId, ...camposOpcionais,
      ...(typeof recibo.estado === 'string' ? { estado: recibo.estado } : {}),
      ...(recibo.semMudanca === true ? { semMudanca: true } : {}),
    };
  }
  if ((recibo.tipo === 'CONFLITO' || recibo.tipo === 'RECUSADO') && typeof recibo.motivo === 'string') {
    return { tipo: recibo.tipo, operationId: comando.operationId, motivo: recibo.motivo, ...camposOpcionais };
  }
  return null;
}
