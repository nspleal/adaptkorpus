import { describe, expect, it } from 'vitest';
import { execucaoEFeedbackDeclarados, registrarDesempenho } from './carga-estados';

describe('escolha, tentativa, execução e feedback são fatos distintos', () => {
  it('20 fácil → recomendação 22 → escolha 26: armazenar/ACK não valida 26', () => {
    const escolha = registrarDesempenho('tentativa-26', [{ reps: '', kg: '26', done: false }], null, false, 22);
    expect(escolha.recomendadaKg).toBe(22);
    expect(escolha.series[0]).toMatchObject({ escolhidaKg: 26, estado: 'escolhida' });
    expect(execucaoEFeedbackDeclarados(escolha, null)).toBe(false);
    expect(execucaoEFeedbackDeclarados(structuredClone(escolha), 'facil')).toBe(false);
  });

  it('tentativa falha ou parcial não vira execução completa por ter carga e feedback', () => {
    const falha = registrarDesempenho('f', [{ reps: '0', kg: '26', done: false, falhou: true }], 'dificil');
    const parcial = registrarDesempenho('p', [
      { reps: '8', kg: '26', done: true }, { reps: '', kg: '26', done: false },
    ], 'facil');
    expect(falha.resultado).toBe('falhou');
    expect(parcial.resultado).toBe('incompleta');
    expect(execucaoEFeedbackDeclarados(falha, 'dificil')).toBe(false);
    expect(execucaoEFeedbackDeclarados(parcial, 'facil')).toBe(false);
  });

  it('só o par explícito da mesma tentativa é elegível; o motor decide o resultado', () => {
    const feito = registrarDesempenho('nova', [{ reps: '8', kg: '26', done: true }], 'na_medida');
    expect(execucaoEFeedbackDeclarados(feito, 'na_medida')).toBe(true);
    expect(execucaoEFeedbackDeclarados({ ...feito, feedbackTentativaId: 'anterior-20' }, 'facil')).toBe(false);
    expect(execucaoEFeedbackDeclarados(feito, null)).toBe(false);
    expect(execucaoEFeedbackDeclarados(undefined, 'facil')).toBe(false);
  });

  it('dor precede conclusão e não altera valores/unidade nem executa regra de máximo', () => {
    const dor = registrarDesempenho('d', [{ reps: '8', kg: '26', done: true }], 'facil', true, 22);
    expect(dor.resultado).toBe('dor');
    expect(dor.series[0]?.escolhidaKg).toBe(26);
    expect(dor.convencao).toBe('nao_informada');
    expect(execucaoEFeedbackDeclarados(dor, 'facil')).toBe(false);
  });
});
