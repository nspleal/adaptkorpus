import type { GrupoPrimario } from '../data/types';
import { ORDEM_SEMANA, type Weekday } from '../semana';
import type { TemplateDia } from './alocador';
import { ehComplementar, ehDiaDePernas, ehDiaDisponivel } from './selecao-referencia';

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
function ordenarRecortes(templates:readonly TemplateDia[],agenda:readonly Weekday[],focos:readonly GrupoPrimario[],consecutivos=diasConsecutivos):readonly TemplateDia[]{
  const custo=(ts:readonly TemplateDia[])=>{
    let foco=0,total=0;
    for(let i=0;i<ts.length;i++)for(let j=i+1;j<ts.length;j++)if(consecutivos(agenda[i]!,agenda[j]!))
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

/** Decisões explícitas de 19/09: diversidade antes de frequência, um complementar
 * por dia misto, sem retirar principal. Full-body aceita qualquer complementar;
 * dia dedicado recebe core e antebraço. A enumeração compara no máximo 8³ trios,
 * antes de repetir um grupo: não declara inviável uma alternativa só por ordem gulosa.
 */
export function distribuirComplementares(
  dias: TemplateDia[], originais: readonly TemplateDia[], agenda: readonly Weekday[], minimoCore: number,
): void {
  for (const d of dias) d.grupos = d.grupos.filter(g => !ehComplementar(g));
  const ordem = ['panturrilha', 'core', 'antebraco'] as const;
  const dedicado = (i: number) => ehDiaDisponivel(originais[i]!.grupos);
  const pernas = (i: number) => ehDiaDePernas(dias[i]!.grupos);
  const superior = (i: number) => dias[i]!.grupos.some(g => ['peito', 'costas', 'ombros', 'biceps', 'triceps'].includes(g));
  const elegiveis = ordem.map(g => dias.flatMap((_, i) =>
    (g === 'panturrilha' ? pernas(i) : dedicado(i) || superior(i)) ? [i] : []));
  let melhor = [-1, -1, -1], notaMelhor: number[] = [-1];
  for (const p of [-1, ...elegiveis[0]!]) for (const c of [-1, ...elegiveis[1]!]) for (const a of [-1, ...elegiveis[2]!]) {
    const trio = [p, c, a];
    if (trio.some((d, k) => d >= 0 && !dedicado(d) && trio.slice(k + 1).includes(d))) continue;
    const nota = [trio.filter(i => i >= 0).length, Number(p >= 0), Number(c >= 0),
      trio.filter(i => i >= 0 && dedicado(i)).length, ...trio.map(i => i < 0 ? -99 : -i)];
    const primeiro = nota.findIndex((n, i) => n !== (notaMelhor[i] ?? -1));
    if (primeiro >= 0 && nota[primeiro]! > (notaMelhor[primeiro] ?? -1)) { melhor = trio; notaMelhor = nota; }
  }
  ordem.forEach((g, k) => { const i = melhor[k]!; if (i >= 0) dias[i]!.grupos = [...dias[i]!.grupos, g]; });
  // Só depois de oferecer os três grupos, repetir dentro da frequência já solicitada.
  for (const g of ordem) {
    const desejados = g === 'core' ? Math.min(3, Math.max(minimoCore, originais.filter(d => d.grupos.includes(g)).length))
      : Math.max(1, originais.filter(d => d.grupos.includes(g)).length);
    for (const i of elegiveis[ordem.indexOf(g)]!) {
      const atuais = dias.flatMap((d, k) => d.grupos.includes(g) ? [k] : []);
      if (atuais.length >= desejados) break;
      if (dias[i]!.grupos.includes(g) || (!dedicado(i) && dias[i]!.grupos.some(ehComplementar))) continue;
      if (atuais.some(k => diasConsecutivos(agenda[k]!, agenda[i]!))) continue;
      dias[i]!.grupos = [...dias[i]!.grupos, g];
    }
  }
}

/** Distribui os grupos dos templates existentes, não exercícios ou séries.
 * Enumeração finita (no máximo 128 conjuntos): conserva a quantidade de exposições
 * proposta quando cabe, prioriza o calendário e distribui a carga documental restante.
 * O alocador continua sendo a única autoridade de seleção/volume.
 */
export function distribuirGruposNoCalendario(
  templates: readonly TemplateDia[], agenda: readonly Weekday[], focos: readonly GrupoPrimario[] = [], minimoCore = 0, preservarRecortes = false, alternaSemanas = false,
): { dias: TemplateDia[]; limitado: boolean } {
  if (templates.length !== agenda.length) throw new Error('Agenda e templates devem ter o mesmo tamanho.');
  // Na alternância Upper/Lower, domingo e a próxima segunda têm tipos opostos.
  // A segunda DESTA semana fica seis dias antes de domingo, não um dia depois.
  const consecutivos = alternaSemanas
    ? (a:Weekday,b:Weekday)=>Math.abs(ORDEM_SEMANA.indexOf(a)-ORDEM_SEMANA.indexOf(b))===1
    : diasConsecutivos;
  if(preservarRecortes)templates=ordenarRecortes(templates,agenda,focos,consecutivos);
  const demandaOriginal = new Map([...new Set(templates.flatMap(t => t.grupos))].map(g => [g, templates.filter(t => t.grupos.includes(g)).length]));
  // Com dois/três dias adjacentes, full-body repetido não cabe. Reutilizamos os
  // recortes superior/inferior e push/pull/pernas antes de ajustar exposições.
  const adjacente = agenda.some((a, i) => agenda.slice(i + 1).some(b => consecutivos(a, b)));
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
  const principais = grupos.filter(g => !ehComplementar(g));
  const ordem = [...focos.filter(g => principais.includes(g)), ...principais.filter(g => !focos.includes(g))];
  for (const g of ordem) {
    if (!grupos.includes(g)) continue;
    let originais = templates.flatMap((t, i) => t.grupos.includes(g) ? [i] : []);
    // O tríceps acrescentado ao upper único mora onde o bíceps mora (não no dia de pernas).
    if (g === 'triceps' && originais.length === 0) originais = templates.flatMap((t, i) => t.grupos.includes('biceps') ? [i] : []);
    const desejados = Math.max(1, originais.length);
    const candidatos: number[][] = [];
    for (let mask = 1; mask < (1 << agenda.length); mask++) {
      const indices = agenda.flatMap((_, i) => mask & (1 << i) ? [i] : []);
      if (indices.length > desejados || indices.some(i => ehDiaDisponivel(templates[i]!.grupos))) continue;
      // Recortes são dos grupos principais; o complementar segue a política própria acima.
      if (preservarRecortes && originais.length > 0 && indices.some(i => !originais.includes(i))) continue;
      if (indices.some((a, i) => indices.slice(i + 1).some(b => consecutivos(agenda[a]!, agenda[b]!)))) continue;
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
  distribuirComplementares(dias, templates, agenda, minimoCore);
  // Preserva também a ordem interna dos templates compatíveis (desempate do alocador).
  for (let i = 0; i < dias.length; i++) dias[i]!.grupos = [...templates[i]!.grupos.filter(g => dias[i]!.grupos.includes(g)), ...dias[i]!.grupos.filter(g => !templates[i]!.grupos.includes(g))];
  // Nomes refletem o reagrupamento; nunca deixam rótulo Upper em um dia de pernas.
  const nomes: Record<GrupoPrimario, string> = { peito: 'Peito', costas: 'Costas', quadriceps: 'Quadríceps', posterior: 'Posteriores', gluteos: 'Glúteos', ombros: 'Ombros', biceps: 'Bíceps', triceps: 'Tríceps', panturrilha: 'Panturrilhas', core: 'Core', antebraco: 'Antebraços', lombar: 'Lombar' };
  for (let i = 0; i < dias.length; i++) {
    const d = dias[i]!;
    const original = templates[i]!;
    // O complementar do dia (core/panturrilha/antebraço) não muda o nome: o tema é dos principais.
    const mesmos = d.grupos.every(g => original.grupos.includes(g) || ehComplementar(g) || (g === 'triceps' && original.grupos.includes('biceps')))
      && original.grupos.every(g => d.grupos.includes(g) || ehComplementar(g));
    d.nome = agenda.length === 1 ? 'Full-body' : mesmos ? original.nome : d.grupos.length ? d.grupos.map(g => nomes[g]).join(' + ') : 'Recuperação';
  }
  // A redução de um complementar é política (um por dia), não limite de agenda.
  limitado ||= [...demandaOriginal].some(([g, n]) => !ehComplementar(g) && dias.filter(d => d.grupos.includes(g)).length < n);
  return { dias, limitado };
}
