import { avaliarDuracaoResistida } from './duracao-plano';
import type { DiaTreino, NivelExperiencia, SlotExercicio } from './treino-types';

const COMPLEMENTARES = new Set(['core', 'panturrilha', 'antebraco']);

/** Decisão de Nicolas, 2026-09-20: etapas iniciais exclusivas de full body/upper/lower.
 * O chamador resolve a divisão real; quantidade de dias não determina a política.
 * Reduz apenas o descanso necessário até 60 s; se não bastar, remove complementares
 * um por vez, do fim da ordem. Não altera séries, catálogo, ordem ou objetos recebidos.
 * A divisão híbrida usa esta etapa apenas nas sessões Upper/Lower (decisão 20/09).
 */
export function adequarInicioFullUpperLower(
  dia: DiaTreino, nivel: NivelExperiencia, limiteSeg: number | undefined,
) {
  const slots = dia.slots.map(s => ({ ...s }));
  const removidos: SlotExercicio[] = [];
  const descansos: { exercicioId: string; de: number; para: number }[] = [];
  const medir = () => avaliarDuracaoResistida(slots, nivel, limiteSeg);
  const excede = () => {
    const r = medir();
    return limiteSeg !== undefined && r.estadoCalculo === 'CALCULADO'
      && (r.duracaoMaximaEstimadaSegundos ?? Infinity) > limiteSeg;
  };
  for (let i = slots.length - 1; i >= 0 && excede(); i--) {
    const s = slots[i]!;
    const de = s.descansoSeg!;
    if (de <= 60) continue;
    const antes = medir().duracaoMaximaEstimadaSegundos!;
    s.descansoSeg = 60;
    const noPiso = medir().duracaoMaximaEstimadaSegundos!;
    if (noPiso === antes) {
      // Uma série, por exemplo, pode não ter descanso entre séries: não cortar sem ganho.
      s.descansoSeg = de;
      continue;
    }
    if (noPiso <= limiteSeg!) {
      // Maior descanso inteiro que cabe, medido pela fórmula sobre a ordem final.
      let menor = 60, maior = Math.floor(de);
      while (menor < maior) {
        const meio = Math.ceil((menor + maior) / 2);
        s.descansoSeg = meio;
        if (medir().duracaoMaximaEstimadaSegundos! <= limiteSeg!) menor = meio;
        else maior = meio - 1;
      }
      s.descansoSeg = menor;
    }
    descansos.push({ exercicioId: s.exercicio.id, de, para: s.descansoSeg });
  }
  while (excede()) {
    const i = slots.findLastIndex(s => COMPLEMENTARES.has(s.exercicio.grupoPrimario ?? ''));
    if (i < 0) break;
    removidos.push(...slots.splice(i, 1));
  }
  return { dia: { ...dia, slots }, removidos, descansos, duracao: medir() };
}
