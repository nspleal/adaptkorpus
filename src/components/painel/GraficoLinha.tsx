'use client';

/**
 * Gráfico de linha + área (porte fiel do "Peso ao longo do tempo" do painel). Genérico:
 * recebe uma série `number[]` e desenha a curva com o preenchimento em degradê Pulso.
 * Reusado pelo peso corporal e pela progressão de carga por exercício (mesma linguagem
 * visual — handoff V6.2 §6). `gradId` deve ser único por instância na mesma página.
 */
export default function GraficoLinha({ serie, gradId = 'evkChartFill', cor = '#BDFF00' }: { serie: number[]; gradId?: string; cor?: string }) {
  const W = 640, H = 200, pad = 14;
  const min = Math.min(...serie), max = Math.max(...serie), span = max - min || 1;
  const pts = serie.map((p, i) => {
    const x = serie.length === 1 ? W / 2 : pad + (i / (serie.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((p - min) / span) * (H - 2 * pad);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1]![0].toFixed(1)} ${H} L${pts[0]![0].toFixed(1)} ${H} Z` : '';
  const fill = `rgba(189,255,0,`; // degradê fixo Pulso (mesma do peso); cor só afeta linha/pontos
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
      <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={`${fill}.28)`} /><stop offset="100%" stopColor={`${fill}0)`} /></linearGradient></defs>
      {pts.length > 1 && <path d={area} fill={`url(#${gradId})`} />}
      {pts.length > 1 && <path d={line} fill="none" stroke={cor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill={cor} />)}
    </svg>
  );
}
