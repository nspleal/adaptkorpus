import type { RotinaSemanal } from '@/lib/engine/treino-types';
import { vereditoDoPlano, type TomVeredito } from '@/lib/veredito-motor';

/**
 * 🔴 D1 (diagnóstico 2026-09-10, §6.2) — O DONO DA SAÍDA DO MOTOR NA TELA.
 *
 * O montador construía nove famílias de aviso honesto e o discriminante `resultadoGeracao`,
 * e a varredura de `src` devolvia **zero consumidores** dos dois. A pessoa não era informada
 * de que o volume de um grupo ficou abaixo do mínimo, de que o equipamento declarado limitou
 * o dia, de que a retomada cortou a frequência, nem de que o plano é `INCOMPATIVEL`.
 *
 * 🔒 Este componente não decide nada: o texto do veredito vem de `lib/veredito-motor` (puro,
 * testado em Node) e os avisos são renderizados **verbatim**, na ordem em que o motor os
 * emitiu. Filtrar ou reescrever aqui recriaria o segundo sistema de avisos que D1 existe para
 * acabar — o `critico.ts` já é o outro, e ele fala do DESENHO, não da geração.
 *
 * 🔴 D16 (auditoria 2026-09-11) — a lista pode chegar por `avisos`, já unificada por
 * `lib/avisos-unificados` (PURO, testado em Node). A regra continua fora daqui: este
 * componente segue renderizando verbatim o que recebe, sem decidir o que cabe na tela.
 */

const COR: Record<TomVeredito, { borda: string; texto: string; marca: string; papel: 'status' | 'alert' }> = {
  ok: { borda: 'rgba(22,163,74,.45)', texto: 'rgba(234,229,219,.9)', marca: '🟢', papel: 'status' },
  atencao: { borda: 'rgba(234,179,8,.45)', texto: 'rgba(234,229,219,.9)', marca: '🟡', papel: 'status' },
  bloqueio: { borda: 'rgba(229,72,77,.5)', texto: '#E5484D', marca: '🔴', papel: 'alert' },
};

export default function AvisosMotor({ rotina, tempoPorSessaoMin, avisos: avisosRecebidos }: {
  rotina: RotinaSemanal | null | undefined;
  tempoPorSessaoMin: number;
  /** D16: lista já unificada. Ausente = a do motor, como sempre foi. */
  avisos?: string[];
}) {
  const veredito = vereditoDoPlano(rotina, tempoPorSessaoMin);
  const avisos = avisosRecebidos ?? rotina?.avisos ?? [];
  /**
   * ⚠️ A conta do cardio NÃO é montada aqui: o motor é a única autoridade sobre ela — uma
   * linha própria nesta tela imprimia os MESMOS números duas vezes (medido no navegador em
   * 2026-09-10) e seria exatamente o segundo sistema de avisos que D1 existe para acabar.
   * Desde 2026-09-23 o cardio é entregue inteiro nos dias oferecidos: não há falta a avisar.
   */
  if (!veredito && avisos.length === 0) return null;
  const cor = COR[veredito?.tom ?? 'atencao'];
  return (
    <section
      aria-label="O que o app calculou para este plano"
      style={{ background: 'rgba(13,40,24,.4)', border: `1px solid ${cor.borda}`, borderRadius: 16, padding: 15, marginBottom: 16 }}
    >
      {veredito && (
        <>
          <p role={cor.papel} style={{ margin: '0 0 6px', fontSize: '.9rem', lineHeight: 1.5, fontWeight: 600, color: cor.texto }}>
            <span aria-hidden style={{ marginRight: 6 }}>{cor.marca}</span>{veredito.titulo}
          </p>
          {veredito.detalhe && (
            <p style={{ margin: '0 0 10px', fontSize: '.84rem', lineHeight: 1.5, color: 'rgba(234,229,219,.7)' }}>{veredito.detalhe}</p>
          )}
        </>
      )}
      {avisos.map((texto, i) => (
        <p key={`aviso-${i}`} role="status" style={{ margin: '0 0 8px', fontSize: '.86rem', lineHeight: 1.5, color: 'rgba(234,229,219,.8)' }}>
          <span aria-hidden style={{ marginRight: 6 }}>🟡</span>{texto}
        </p>
      ))}
    </section>
  );
}
