import type { Exercise } from './types';

/** Curadoria D20: nomes de apresentação separados da planilha gerada.
 * IDs, prescrição, instruções e registros históricos não são alterados.
 */
const NOMES: Readonly<Record<string, Pick<Exercise, 'nomePt' | 'nomeEn'>>> = {
  e49: { nomePt: 'Puxada alta na polia (lat pulldown)', nomeEn: 'Lat Pulldown' },
  e126: { nomePt: 'Pullover na polia (pulldown de braços estendidos)', nomeEn: 'Cable Pullover (Straight-Arm Pulldown)' },
};

export function aplicarNomeCurado<T extends Pick<Exercise, 'id' | 'nomePt' | 'nomeEn'>>(exercicio: T): T {
  const nome = NOMES[exercicio.id];
  return nome ? { ...exercicio, ...nome } : exercicio;
}
