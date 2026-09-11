import type { Exercise } from '@/lib/data/types';
import { GRUPOS_ORDEM, ROTULO_GRUPO } from '@/lib/frequencia-grupos';
import { secundariosDe } from '@/lib/engine/secundarios';

export function contarSeriesPorGrupo(slots: readonly { exercicio: Exercise; series: number }[]) {
  return GRUPOS_ORDEM.map((grupo) => ({ grupo,
    diretas: slots.reduce((n, s) => n + (s.exercicio.grupoPrimario === grupo ? s.series : 0), 0),
    indiretas: slots.reduce((n, s) => n + (secundariosDe(s.exercicio).includes(grupo) ? s.series : 0), 0),
  }));
}

export default function ResumoSeries({ slots }: { slots: readonly { exercicio: Exercise; series: number }[] }) {
  return <details style={{ border: '1px solid rgba(234,229,219,.2)', borderRadius: 16, padding: 16, marginBottom: 18 }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700, minHeight: 32 }}>Séries por músculo · {slots.reduce((n, slot) => n + slot.series, 0)} séries totais</summary>
    <p style={{ color: 'rgba(234,229,219,.75)', fontSize: '.84rem', lineHeight: 1.6 }}>Séries planejadas. Diretas: músculo principal. Indiretas: participação secundária. Uma série pode envolver mais de um músculo; não some as linhas como total do treino.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 8 }}>
      {contarSeriesPorGrupo(slots).map((g) => <div key={g.grupo} style={{ padding: 10, background: 'rgba(234,229,219,.05)', borderRadius: 10 }}>
        <strong style={{ fontSize: '.88rem' }}>{g.grupo === 'core' ? 'Abdômen / core' : ROTULO_GRUPO[g.grupo]}</strong>
        <div style={{ fontSize: '.8rem', marginTop: 4, color: 'rgba(234,229,219,.8)' }}>{g.diretas} diretas · {g.indiretas} indiretas</div>
      </div>)}
    </div>
  </details>;
}
