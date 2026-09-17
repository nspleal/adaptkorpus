import type { Exercise, GrupoPrimario } from '../data/types';
import type { DiaTreino, SlotExercicio } from './treino-types';
import { creditoPonderadoDaSemana } from './alocador';
import { diretosDoExercicio } from './cobertura-anatomica';

/** Autor 17/09: compensação dentro do grupo, avaliada na dose efetiva.
 * Busca limitada a uma troca por dia e redistribuição nos posteriores existentes,
 * seguida de uma adição. Não declara busca exaustiva de todas as semanas possíveis.
 * Não altera séries, exercícios ou descansos de outros grupos.
 */
export function completarPosteriorDosado(args: {
  dias: DiaTreino[];
  pool: readonly Exercise[];
  min: number;
  max: number;
  slotsMax: number;
  tetoSemana: (g: GrupoPrimario) => number;
  tetoDia: number;
  materializar: (e: Exercise, series: number, dia: number) => SlotExercicio;
  cabeNoTempo: (slots: SlotExercicio[], dia: number) => boolean;
}): { dia: number; antes: SlotExercicio[]; depois: SlotExercicio[] }[] {
  const mudancas: { dia: number; antes: SlotExercicio[]; depois: SlotExercicio[] }[] = [];
  const alvos = (slots: readonly SlotExercicio[]) => new Set(slots.flatMap(s => [...diretosDoExercicio(s.exercicio.id)]));
  for (let d = 0; d < args.dias.length; d++) {
    const dia = args.dias[d]!;
    const indices = dia.slots.flatMap((s, i) => s.exercicio.grupoPrimario === 'posterior' ? [i] : []);
    if (!indices.length || alvos(dia.slots).has('fc')) continue;
    const antes = creditoPonderadoDaSemana(args.dias.flatMap(x => x.slots));
    const cobertos = alvos(dia.slots);
    const candidatos = args.pool.filter(e => e.grupoPrimario === 'posterior'
      && diretosDoExercicio(e.id).has('fc') && !dia.slots.some(s => s.exercicio.id === e.id));
    const aceita = (slots: SlotExercicio[]) => {
      if (slots.length > args.slotsMax || !args.cabeNoTempo(slots, d)) return false;
      const novos = alvos(slots);
      if ([...cobertos].some(a => !novos.has(a))) return false;
      // O padrão dobradiça não pode desaparecer ao fechar flexão do joelho.
      if (dia.slots.some(s => s.padrao === 'dobradica_quadril')
        && !slots.some(s => s.padrao === 'dobradica_quadril')) return false;
      const semana = creditoPonderadoDaSemana(args.dias.flatMap((x, i) => i === d ? slots : x.slots));
      for (const [g, n] of antes) if ((semana.get(g) ?? 0) < n) return false;
      for (const [g, n] of semana) if (n > args.tetoSemana(g)) return false;
      for (const n of creditoPonderadoDaSemana(slots).values()) if (n > args.tetoDia) return false;
      return true;
    };
    let escolhido: SlotExercicio[] | undefined;
    // A quantidade adicional de séries é minimizada; a ordem do pool desempata.
    let custo = Infinity;
    const considerar = (slots: SlotExercicio[]) => {
      const series = slots.reduce((n, s) => n + (s.series ?? 0), 0);
      if (series < custo && aceita(slots)) { escolhido = slots; custo = series; }
    };
    for (const e of candidatos) {
      for (const sai of indices) {
        if (dia.slots[sai]!.incluidoPorPreferencia) continue;
        const slots = dia.slots.map(s => ({ ...s }));
        const visitar = (k: number) => {
          if (k === indices.length) { considerar(slots.map(s => ({ ...s }))); return; }
          const i = indices[k]!;
          const original = dia.slots[i]!;
          // Compensação pode somar ao mesmo grupo; nunca tira dose dos slots mantidos.
          const piso = i === sai ? args.min : (original.series ?? args.min);
          for (let n = piso; n <= args.max; n++) {
            slots[i] = i === sai ? args.materializar(e, n, d) : { ...original, series: n };
            visitar(k + 1);
          }
        };
        visitar(0);
      }
    }
    if (!escolhido && dia.slots.length < args.slotsMax) {
      for (const e of candidatos) {
        considerar([...dia.slots, args.materializar(e, args.min, d)]);
      }
    }
    if (escolhido) {
      mudancas.push({ dia: d, antes: dia.slots, depois: escolhido });
      dia.slots = escolhido;
    }
  }
  return mudancas;
}
