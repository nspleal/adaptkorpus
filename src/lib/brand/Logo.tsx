/**
 * Símbolo "K Ascendente" e "K em Selo" — Evokorpus.
 *
 * 🔒 ESTE ARQUIVO NÃO É CÓDIGO MORTO — é a FONTE CANÔNICA da marca (ratificado na auditoria
 * de 2026-08-14). Nenhum componente o importa hoje: os ícones do app são PNG/SVG já gerados
 * em `public/icons`. Ele fica porque a política do cofre é "nunca redesenhar de memória"
 * (CLAUDE.md → Fidelidade visual): quando um ícone, favicon ou peça precisar ser regerado,
 * a geometria sai DAQUI, não de uma descrição em prosa. Um varredor de código morto vai
 * apontá-lo de novo — a resposta é esta linha, não o `rm`.
 *
 * ⚠️ FIDELIDADE VISUAL (prioridade travada no cofre). A geometria abaixo é a
 * CONSTRUÇÃO CANÔNICA extraída de conceitos/identidade-de-marca-evokorpus
 * ("Construção canônica do símbolo (SVG)"). Não redesenhar de memória.
 *
 * Regra de cor (a que mais erra):
 *   - Fundo ESCURO: K = Bone #EAE5DB · trajetória + pontos = Pulso #BDFF00 (neon)
 *   - Fundo CLARO : K = Floresta #0D2818 · trajetória + pontos = Folha #16A34A
 *   O neon #BDFF00 NUNCA entra em fundo claro.
 */
import type { CSSProperties } from 'react';

const COR = {
  floresta: '#0D2818',
  folha: '#16A34A',
  pulso: '#BDFF00',
  bone: '#EAE5DB',
} as const;

type VarianteK = 'escuro' | 'claro' | 'mono';

interface KAscendenteProps {
  /** 'escuro' (padrão) p/ fundos escuros; 'claro' p/ fundos claros; 'mono' sem cor. */
  variante?: VarianteK;
  size?: number;
  /** Cor única para a variante 'mono' (default: Bone). */
  corMono?: string;
  title?: string;
  style?: CSSProperties;
  className?: string;
}

/** Símbolo principal: K sólido + trajetória "evo" (curva + 3 pontos crescentes). */
export function KAscendente({
  variante = 'escuro',
  size = 64,
  corMono = COR.bone,
  title = 'Adaptkorpus',
  style,
  className,
}: KAscendenteProps) {
  const corK = variante === 'escuro' ? COR.bone : variante === 'claro' ? COR.floresta : corMono;
  const corEvo = variante === 'escuro' ? COR.pulso : COR.folha;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      className={className}
    >
      {/* Haste vertical + perna inferior (sempre sólidas). */}
      <line x1="28" y1="16" x2="28" y2="84" stroke={corK} strokeWidth="13" strokeLinecap="round" />
      <line x1="29" y1="50" x2="68" y2="84" stroke={corK} strokeWidth="13" strokeLinecap="round" />

      {variante === 'mono' ? (
        // Monocromática: braço superior RETO e sólido (sem neon, sem pontos).
        <line x1="29" y1="50" x2="68" y2="16" stroke={corMono} strokeWidth="13" strokeLinecap="round" />
      ) : (
        <>
          {/* Trajetória "evo" no lugar do braço superior (curva + 3 pontos crescentes). */}
          <path d="M33 50 Q50 38 70 18" stroke={corEvo} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <circle cx="35" cy="50" r="4.5" fill={corEvo} />
          <circle cx="52" cy="35" r="5" fill={corEvo} />
          <circle cx="70" cy="18" r="6" fill={corEvo} />
        </>
      )}
    </svg>
  );
}

interface KSeloProps {
  size?: number;
  title?: string;
  style?: CSSProperties;
  className?: string;
}

/** "K em Selo" — variante cunhada; é o ÍCONE DO APP (quadrado arredondado Bone). */
export function KSelo({ size = 64, title = 'Adaptkorpus', style, className }: KSeloProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      className={className}
    >
      <rect x="14" y="14" width="72" height="72" rx="16" fill={COR.bone} />
      {/* K em Floresta (stroke-width 10). */}
      <line x1="28" y1="16" x2="28" y2="84" stroke={COR.floresta} strokeWidth="10" strokeLinecap="round" />
      <line x1="29" y1="50" x2="68" y2="84" stroke={COR.floresta} strokeWidth="10" strokeLinecap="round" />
      {/* Trajetória + pontos em Folha. */}
      <path d="M42 50 Q55 40 67 27" stroke={COR.folha} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <circle cx="43" cy="50" r="3.5" fill={COR.folha} />
      <circle cx="56" cy="40" r="4" fill={COR.folha} />
      <circle cx="67" cy="27" r="4.5" fill={COR.folha} />
    </svg>
  );
}

interface WordmarkProps {
  /** 'escuro' (padrão): evo Bone + korpus Pulso. 'claro': evo Floresta + korpus Folha. */
  variante?: 'escuro' | 'claro';
  className?: string;
}

/** Wordmark "evokorpus" — sempre minúsculo; "korpus" no acento. */
export function Wordmark({ variante = 'escuro', className }: WordmarkProps) {
  const corEvo = variante === 'escuro' ? COR.bone : COR.floresta;
  const corKorpus = variante === 'escuro' ? COR.pulso : COR.folha;
  return (
    <span className={className} style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
      <span style={{ color: corEvo }}>adapt</span>
      <span style={{ color: corKorpus, marginLeft: '0.02em' }}>korpus</span>
    </span>
  );
}
