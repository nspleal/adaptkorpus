/**
 * 🔵 A REGIÃO PENDENTE, DITA NO PLANO E NA PROPOSTA (item 6 do pedido de 2026-09-17).
 *
 * 🔴 O defeito que isto fecha: o motor já sabia quais regiões dos grupos do dia ficaram sem
 * exercício com ação direta identificada, e por quê — e NADA disso chegava à tela do plano
 * nem à prévia. Só o editor mostrava cobertura, e só depois de a pessoa abrir "Montar meu
 * treino". Quem gerava o treino automático via a lacuna no painel sem nunca saber se o app
 * tinha tentado alguma coisa.
 *
 * 🔒 Não decide nada e não recalcula nada: lê `rotina.coberturaAnatomica`, publicada pelo
 * motor, e usa a copy de `lib/cobertura-pendente-copy` — a mesma autoridade de frase para as
 * duas telas. Não bloqueia salvar, não é alerta e não afirma que a região não é ativada.
 */
import type { DiagnosticoAnatomicoDia } from '@/lib/engine/cobertura-anatomica';
import { MOTIVO_REDUNDANCIA, MOTIVO_SEM_COBERTURA, RESSALVA_PENDENTE, pendentesParaTela } from '@/lib/cobertura-pendente-copy';
import { ROTULO_GRUPO } from '@/lib/frequencia-grupos';

const nota: React.CSSProperties = { fontSize: '.82rem', lineHeight: 1.5, color: 'rgba(234,229,219,.72)' };

export default function CoberturaPendente({ dia, compacto = false }: {
  /** O diagnóstico DAQUELE dia, ou `undefined` quando o dia está completo. */
  dia: DiagnosticoAnatomicoDia | undefined;
  /** Na proposta o espaço é curto: só a primeira linha de cada motivo. */
  compacto?: boolean;
}) {
  if (!dia) return null;
  const pendentes = pendentesParaTela(dia);
  const repetidas = dia.redundanciasMecanicas;
  if (pendentes.length === 0 && repetidas.length === 0) return null;

  /** Uma linha por MOTIVO, com as partes agrupadas: a pessoa lê a causa, não uma lista de ids. */
  const porMotivo = new Map<string, string[]>();
  for (const p of pendentes) {
    const lista = porMotivo.get(p.motivo) ?? [];
    // 🔒 O nome HUMANO da ficha do pacote, nunca o id interno.
    if (!lista.includes(p.nome)) lista.push(p.nome);
    porMotivo.set(p.motivo, lista);
  }

  return (
    <div
      role="note"
      aria-label={`Cobertura muscular de ${dia.dia}`}
      style={{ ...nota, marginTop: 6, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(234,229,219,.16)', background: 'rgba(234,229,219,.04)' }}
    >
      {[...porMotivo.entries()].map(([motivo, partes]) => (
        <p key={motivo} style={{ margin: '0 0 4px' }}>
          <strong style={{ fontWeight: 600 }}>
            {'Sem exercício identificado para '}
            {partes.join(', ')}
          </strong>
          {' — '}
          {MOTIVO_SEM_COBERTURA[motivo as keyof typeof MOTIVO_SEM_COBERTURA]}.
        </p>
      ))}
      {!compacto && repetidas.map((r) => (
        <p key={r.grupo} style={{ margin: '0 0 4px' }}>
          Em {ROTULO_GRUPO[r.grupo] ?? r.grupo}, {r.ids.length} exercícios fazem a mesma tarefa
          {' — '}{MOTIVO_REDUNDANCIA[r.motivo]}.
        </p>
      ))}
      <p style={{ margin: 0, color: 'rgba(234,229,219,.55)' }}>{RESSALVA_PENDENTE}</p>
    </div>
  );
}
