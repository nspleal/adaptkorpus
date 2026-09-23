import type { RotinaSemanal } from './engine/treino-types';

/** Diferenças observadas, sem estimativa de duração ou inferência sobre validade. */
export function compararRecalculoTreino(antes: RotinaSemanal | null | undefined, depois: RotinaSemanal | null | undefined): string[] {
  if (!antes && !depois) return [];
  if (!antes || !depois) return [depois ? 'Um plano passou a estar disponível.' : 'O plano deixou de estar disponível.'];
  const diferencas: string[] = [];
  depois.dias.forEach((dia, i) => {
    const antigo = antes.dias.find(d => d.diaId === dia.diaId);
    if (!antigo) { diferencas.push(`${dia.nome}: sessão acrescentada.`); return; }
    if (dia.slots.map(s => s.exercicio.id).join('/') !== antigo.slots.map(s => s.exercicio.id).join('/')) {
      diferencas.push(`${dia.nome}: exercícios ou ordem alterados.`);
    }
    for (const s of dia.slots) {
      const a = antigo.slots.find(x => x.exercicio.id === s.exercicio.id);
      if (!a) continue;
      if (a.series !== s.series) diferencas.push(`${dia.nome}, ${s.exercicio.nomePt}: ${a.series ?? 'não avaliado'} → ${s.series ?? 'não avaliado'} séries.`);
      if (a.descansoSeg !== s.descansoSeg) diferencas.push(`${dia.nome}, ${s.exercicio.nomePt}: descanso ${a.descansoSeg ?? 'não avaliado'} → ${s.descansoSeg ?? 'não avaliado'} s.`);
    }
    const indiceAntigo = antes.dias.indexOf(antigo);
    const a = antes.duracaoResistidaDias?.[indiceAntigo]?.duracaoMaximaEstimadaSegundos;
    const b = depois.duracaoResistidaDias?.[i]?.duracaoMaximaEstimadaSegundos;
    if (a !== b) diferencas.push(`${dia.nome}: duração máxima estimada ${a == null ? 'não avaliada' : `${a} s`} → ${b == null ? 'não avaliada' : `${b} s`}.`);
  });
  antes.dias.filter(a => !depois.dias.some(d => d.diaId === a.diaId)).forEach(a => diferencas.push(`${a.nome}: sessão removida.`));
  return diferencas;
}
