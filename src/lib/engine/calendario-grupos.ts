import type { GrupoPrimario } from '../data/types';
import { ORDEM_SEMANA, type Weekday } from '../semana';
import type { TemplateDia } from './alocador';

/** Política de produto de 13/09/2026: adjacência direta inclui a virada da semana.
 * Não estima sobreposição indireta nem cria piso fisiológico novo.
 */
export function diasConsecutivos(a: Weekday, b: Weekday): boolean {
  const distancia = Math.abs(ORDEM_SEMANA.indexOf(a) - ORDEM_SEMANA.indexOf(b));
  return distancia === 1 || distancia === 6;
}

/** Reordena sessões inteiras antes de reduzir exposições. Contagens estruturais,
 * não pesos fisiológicos: primeiro conflitos do foco, depois os demais conflitos.
 * No máximo 6! ordens, com parada ao achar agenda sem conflito direto.
 */
function ordenarRecortes(templates:readonly TemplateDia[],agenda:readonly Weekday[],focos:readonly GrupoPrimario[]):readonly TemplateDia[]{
  const custo=(ts:readonly TemplateDia[])=>{
    let foco=0,total=0;
    for(let i=0;i<ts.length;i++)for(let j=i+1;j<ts.length;j++)if(diasConsecutivos(agenda[i]!,agenda[j]!))
      for(const g of ts[i]!.grupos)if(ts[j]!.grupos.includes(g)){total++;if(focos.includes(g))foco++;}
    return [foco,total] as const;
  };
  let melhor=templates,valor=custo(templates);
  const visitar=(ordem:TemplateDia[],restantes:readonly TemplateDia[])=>{
    if(valor[1]===0)return;
    if(!restantes.length){const c=custo(ordem);if(c[0]<valor[0]||(c[0]===valor[0]&&c[1]<valor[1])){melhor=ordem;valor=c;}return;}
    for(let i=0;i<restantes.length;i++)visitar([...ordem,restantes[i]!],restantes.filter((_,j)=>j!==i));
  };
  visitar([],templates);return melhor;
}

/** Distribui os grupos dos templates existentes, não exercícios ou séries.
 * Enumeração finita (no máximo 128 conjuntos): conserva a quantidade de exposições
 * proposta quando cabe, prioriza o calendário e distribui a carga documental restante.
 * O alocador continua sendo a única autoridade de seleção/volume.
 */
export function distribuirGruposNoCalendario(
  templates: readonly TemplateDia[], agenda: readonly Weekday[], focos: readonly GrupoPrimario[] = [], minimoCore = 0, preservarRecortes = false,
): { dias: TemplateDia[]; limitado: boolean } {
  if (templates.length !== agenda.length) throw new Error('Agenda e templates devem ter o mesmo tamanho.');
  if(preservarRecortes)templates=ordenarRecortes(templates,agenda,focos);
  const demandaOriginal = new Map([...new Set(templates.flatMap(t => t.grupos))].map(g => [g, templates.filter(t => t.grupos.includes(g)).length]));
  // Com dois/três dias adjacentes, full-body repetido não cabe. Reutilizamos os
  // recortes superior/inferior e push/pull/pernas antes de ajustar exposições.
  const adjacente = agenda.some((a, i) => agenda.slice(i + 1).some(b => diasConsecutivos(a, b)));
  const temFull = templates.some(t => t.grupos.includes('peito') && t.grupos.includes('quadriceps'));
  if (!preservarRecortes && adjacente && temFull && agenda.length === 2) templates = [
    { nome: 'Superiores', grupos: ['peito', 'costas', 'ombros', 'biceps', 'triceps'] },
    { nome: 'Inferiores', grupos: ['quadriceps', 'posterior', 'gluteos', 'panturrilha', 'core'] },
  ];
  if (!preservarRecortes && adjacente && temFull && agenda.length === 3) templates = [
    { nome: 'Peito + Ombros + Tríceps', grupos: ['peito', 'ombros', 'triceps', 'core'] },
    { nome: 'Costas + Bíceps', grupos: ['costas', 'biceps'] },
    { nome: 'Pernas', grupos: ['quadriceps', 'posterior', 'gluteos', 'panturrilha', 'core'] },
  ];
  const grupos = [...new Set(templates.flatMap(t => t.grupos))];
  // O upper único também precisa oferecer o tríceps, sem impor volume novo.
  if (grupos.includes('biceps') && !grupos.includes('triceps')) grupos.push('triceps');
  const carga = agenda.map(() => 0);
  const dias: TemplateDia[] = agenda.map(() => ({ nome: '', grupos: [] }));
  let limitado = false;
  const ordem = [...focos, ...grupos.filter(g => !focos.includes(g))];
  for (const g of ordem) {
    if (!grupos.includes(g)) continue;
    const originais = templates.flatMap((t, i) => t.grupos.includes(g) ? [i] : []);
    const desejados = Math.max(1, originais.length, g === 'core' ? minimoCore : 0);
    const candidatos: number[][] = [];
    for (let mask = 1; mask < (1 << agenda.length); mask++) {
      const indices = agenda.flatMap((_, i) => mask & (1 << i) ? [i] : []);
      if (indices.length > desejados) continue;
      if (preservarRecortes && originais.length > 0 && indices.some(i => !originais.includes(i))) continue;
      if (indices.some((a, i) => indices.slice(i + 1).some(b => diasConsecutivos(agenda[a]!, agenda[b]!)))) continue;
      candidatos.push(indices);
    }
    candidatos.sort((a, b) => b.length - a.length
      || b.filter(i => originais.includes(i)).length - a.filter(i => originais.includes(i)).length
      || a.reduce((n, i) => n + carga[i]!, 0) - b.reduce((n, i) => n + carga[i]!, 0)
      || a.join(',').localeCompare(b.join(',')));
    const escolhidos = candidatos[0] ?? [];
    if (escolhidos.length < desejados) limitado = true;
    for (const i of escolhidos) {
      dias[i]!.grupos = [...dias[i]!.grupos, g];
      carga[i]!++;
    }
  }
  // Preserva também a ordem interna dos templates compatíveis (desempate do alocador).
  for (let i = 0; i < dias.length; i++) dias[i]!.grupos = [...templates[i]!.grupos.filter(g => dias[i]!.grupos.includes(g)), ...dias[i]!.grupos.filter(g => !templates[i]!.grupos.includes(g))];
  // Nomes refletem o reagrupamento; nunca deixam rótulo Upper em um dia de pernas.
  const nomes: Record<GrupoPrimario, string> = { peito: 'Peito', costas: 'Costas', quadriceps: 'Quadríceps', posterior: 'Posteriores', gluteos: 'Glúteos', ombros: 'Ombros', biceps: 'Bíceps', triceps: 'Tríceps', panturrilha: 'Panturrilhas', core: 'Core', antebraco: 'Antebraços', lombar: 'Lombar' };
  for (let i = 0; i < dias.length; i++) {
    const d = dias[i]!;
    const original = templates[i]!;
    const mesmos = d.grupos.every(g => original.grupos.includes(g) || g === 'core' || (g === 'triceps' && original.grupos.includes('biceps'))) && original.grupos.every(g => d.grupos.includes(g));
    d.nome = agenda.length === 1 ? 'Full-body' : mesmos ? original.nome : d.grupos.length ? d.grupos.map(g => nomes[g]).join(' + ') : 'Recuperação';
  }
  limitado ||= [...demandaOriginal].some(([g, n]) => dias.filter(d => d.grupos.includes(g)).length < n);
  return { dias, limitado };
}
