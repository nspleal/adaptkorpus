import { type ReactNode, type CSSProperties } from 'react';

/**
 * Primitivos das páginas institucionais (porte fiel do V3 "Evokorpus Institucional.dc.html").
 * Server-safe (sem hooks) — usados pelas páginas (server components). A interatividade
 * (scroll-spy, FAQ, formulário) vive em componentes client separados.
 *
 * Copy é RASCUNHO: o selo e os marcadores [A validar:] devem permanecer visíveis até a
 * redação jurídica final voltar pelo humano (regra do handoff V3 §3).
 */

/** Disclaimer canônico (rodapé de todas as páginas + cartão da página Aviso). */
export const DISCLAIMER =
  'O Adaptkorpus é uma ferramenta de uso geral e caráter educacional, dirigida pelo usuário. ' +
  'Não constitui prescrição, consulta ou acompanhamento nutricional ou de educação física, ' +
  'nem substitui a orientação de profissionais habilitados. Consulte um médico antes de iniciar ' +
  'qualquer programa de exercício ou mudança alimentar. Conteúdo para maiores de 18 anos.';

/** Marcador de pendência — realce discreto, nunca escondido (handoff V3 §5.0). */
export function AValidar({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: 'inline-block', background: 'rgba(234,229,219,.06)', border: '1px dashed rgba(234,229,219,.42)', borderRadius: 7, padding: '0 9px', color: 'rgba(234,229,219,.92)', fontWeight: 600, fontSize: '.9em' }}>
      [A validar: {children}]
    </span>
  );
}

export function Forte({ children }: { children: ReactNode }) {
  return <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>{children}</strong>;
}

const h2Style: CSSProperties = { margin: '0 0 14px', fontSize: 'clamp(1.32rem,2.6vw,1.7rem)', fontWeight: 700, letterSpacing: '-.02em' };
const pStyle: CSSProperties = { margin: 0, fontSize: '1.02em', lineHeight: 1.78, color: 'rgba(234,229,219,.72)' };

/** Seção de documento legal (âncora de TOC + h2). */
export function SecaoLegal({ id, titulo, children, ultima }: { id: string; titulo: string; children: ReactNode; ultima?: boolean }) {
  return (
    <section id={id} data-toc-target style={{ margin: ultima ? '0 0 8px' : '0 0 46px', scrollMarginTop: 128 }}>
      <h2 style={h2Style}>{titulo}</h2>
      {children}
    </section>
  );
}

export function Paragrafo({ children, mb = false }: { children: ReactNode; mb?: boolean }) {
  return <p style={{ ...pStyle, marginBottom: mb ? 15 : 0 }}>{children}</p>;
}

export function Lista({ children, mb = false }: { children: ReactNode; mb?: boolean }) {
  return <ul style={{ ...pStyle, margin: mb ? '0 0 15px' : 0, paddingLeft: 20 }}>{children}</ul>;
}

export function ItemLista({ children, ultimo }: { children: ReactNode; ultimo?: boolean }) {
  return <li style={{ marginBottom: ultimo ? 0 : 9 }}>{children}</li>;
}
