import { describe, expect, it } from 'vitest';
import { aplicarDoseReferenciada, contextoDaDose, referenciaValida, type ReferenciaDose } from './referencia-dose';
import { rotinaCustomHidratacaoSchema, rotinaCustomSchema } from '../validation/perfil-resumo';

const contexto = contextoDaDose({ semana: 1, fator: .5, volumeReferencia: 10 })!;
const ref = (series: number[], escolhas = series): ReferenciaDose => ({ versao: 1, contexto,
  series: Object.fromEntries(series.map((v, i) => [`e${i}`, v])),
  escolhas: Object.fromEntries(escolhas.map((v, i) => [`e${i}`, v])),
});
const aplicar = (r: ReferenciaDose | undefined, escolhas: (number | undefined)[], cotas = [3, 2], alvo = 5) =>
  aplicarDoseReferenciada(escolhas.map((escolha, i) => ({ id: `e${i}`, referencia: r, escolha })), cotas, cotas.map(() => 4), alvo, contexto);

describe('Referência real de dose · edições e fronteiras', () => {
  it('redução fora→dentro do teto não concede escolha recusada de outro slot', () => {
    expect(aplicar(undefined, [3, 3])).toEqual([3, 2]);
    expect(aplicar(undefined, [2, 3])).toEqual([2, 2]);
    const r = ref([3, 2], [3, 3]);
    expect(aplicar(r, [2, 3])).toEqual([2, 2]);
  });
  it('pedido recusado não derruba o dono real de uma cota permutada', () => {
    const r = ref([2, 3]);
    expect(aplicar(r, [3, 3])).toEqual([2, 3]);
    expect(aplicar(r, [4, 3])).toEqual([2, 3]);
  });
  it('aumento usa folga real; uma redução na mesma fotografia não destrava o outro', () => {
    const r = ref([2, 2]);
    expect(aplicar(r, [3, 2])).toEqual([3, 2]);
    expect(aplicar(ref([3, 2]), [2, 3])).toEqual([2, 2]);
    // Próxima edição explícita, após capturar o plano reduzido: agora a folga pode ser pedida.
    expect(aplicar(ref([2, 2]), [2, 3])).toEqual([2, 3]);
  });
  it('contexto novo, versão desconhecida e fotografia inválida não burlam cotas', () => {
    const r = ref([2, 3]);
    for (const invalida of [{ ...r, versao: 2 }, { ...r, contexto: 'outro' }, { ...r, series: { e0: 99, e1: 99 } }, { ...r, series: { e0: Number.NaN } }]) {
      expect(aplicar(invalida as ReferenciaDose, [99, 99])).toEqual([3, 2]);
    }
    expect(referenciaValida(null, contexto)).toBe(false);
  });
  it('todas as doses pequenas: editar um slot preserva os demais e respeita teto/IRV', () => {
    let casos = 0;
    for (let x = 1; x <= 4; x++) for (let y = 1; y <= 4; y++) for (let alvo = x + y; alvo <= 9; alvo++) {
      const r = ref([x, y]);
      for (let k = 0; k < 2; k++) for (let pedido = 1; pedido <= 7; pedido++) {
        const escolhas = [x, y]; escolhas[k] = pedido;
        const res = aplicar(r, escolhas, [4, 4], alvo);
        expect(res[1 - k]).toBe([x, y][1 - k]);
        expect(res.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(alvo);
        expect(res.every(v => v >= 1 && v <= 4)).toBe(true);
        casos++;
      }
    }
    expect(casos).toBeGreaterThan(1000);
  });
  it('schema de escrita/hidratação conserva referência válida e remove só a inválida', () => {
    const dia = { nome: 'Dia', diaId: 'seg', exercicioIds: ['e0', 'e1'], seriesPorExercicio: { e0: 3, e1: 3 }, referenciaDose: ref([3, 2], [3, 3]) };
    for (const schema of [rotinaCustomSchema, rotinaCustomHidratacaoSchema]) {
      expect(schema.parse({ origem: 'usuario', dias: [dia] }).dias[0]?.referenciaDose).toEqual(dia.referenciaDose);
      const invalid = schema.parse({ origem: 'usuario', dias: [{ ...dia, referenciaDose: { versao: 99 } }] });
      expect(invalid.dias[0]?.referenciaDose).toBeUndefined();
      expect(invalid.dias[0]?.seriesPorExercicio).toEqual(dia.seriesPorExercicio);
    }
  });
});
