import { describe, expect, it } from 'vitest';
import { avisoPausaVisivel, pausaReconhecida, type SessaoMinima } from './pausa-reconhecida';

/**
 * "Fiquei doente" — o reconhecimento de pausa (Leva 2 · Bloco 4, DF 2026-07-27).
 * Ancorado no handoff `design_handoff_fiquei_doente` §7 (estado e comportamento) e na
 * precedência dura do cofre (`parametros-motor-treino-evokorpus` §"Fiquei doente").
 */

const treino = (dataISO: string): SessaoMinima => ({ dataISO });
const cardio = (dataISO: string): SessaoMinima => ({ dataISO, tipo: 'cardio' });
const calibracao = (dataISO: string): SessaoMinima => ({ dataISO, tipo: 'calibracao' });
const fadiga = (dataISO: string): SessaoMinima => ({ dataISO, tipo: 'sinal_fadiga' });

const ACK = '2026-07-27T14:30:00.000Z';

describe('pausaReconhecida — o carimbo vale até o primeiro treino registrado', () => {
  it('sem carimbo, não há reconhecimento', () => {
    expect(pausaReconhecida(null, [])).toBe(false);
    expect(pausaReconhecida(undefined, [])).toBe(false);
    expect(pausaReconhecida('', [])).toBe(false);
  });

  it('carimbado e sem treino depois → vale', () => {
    expect(pausaReconhecida(ACK, [])).toBe(true);
    expect(pausaReconhecida(ACK, [treino('2026-07-20')])).toBe(true);
  });

  it('treino registrado DEPOIS do carimbo → limpa (sem mensagem nenhuma)', () => {
    expect(pausaReconhecida(ACK, [treino('2026-07-28')])).toBe(false);
  });

  it('treino em data ANTERIOR ao carimbo não limpa — só o que vem depois conta', () => {
    expect(pausaReconhecida(ACK, [treino('2026-07-26'), treino('2026-06-01')])).toBe(true);
  });

  it('cardio conta como treino: quem pedalou voltou a treinar', () => {
    expect(pausaReconhecida(ACK, [cardio('2026-07-28')])).toBe(false);
  });

  it('calibração e sinal de fadiga NÃO são treino — não limpam o aviso', () => {
    expect(pausaReconhecida(ACK, [calibracao('2026-07-29'), fadiga('2026-07-30')])).toBe(true);
  });

  it('carimbo malformado é ignorado (nunca derruba a aba)', () => {
    expect(pausaReconhecida('ontem', [])).toBe(false);
  });

  it('reconhecer de novo é idempotente: o carimbo mais novo simplesmente substitui', () => {
    const antigo = '2026-07-01T10:00:00.000Z';
    // com treino em 10/07, o carimbo antigo já não vale; o novo (27/07) volta a valer.
    const sessoes = [treino('2026-07-10')];
    expect(pausaReconhecida(antigo, sessoes)).toBe(false);
    expect(pausaReconhecida(ACK, sessoes)).toBe(true);
  });
});

describe('precedência de mensagem (regra dura) — nunca duas empilhadas', () => {
  it('rampa ativa → SÓ o chip de retomada (o aviso é suprimido)', () => {
    expect(avisoPausaVisivel({ reconhecidoEm: ACK, rampaAtiva: true, sessoes: [] })).toBe(false);
  });

  it('reconhecido e sem rampa → SÓ o aviso', () => {
    expect(avisoPausaVisivel({ reconhecidoEm: ACK, rampaAtiva: false, sessoes: [] })).toBe(true);
  });

  it('sem reconhecimento e sem rampa → NADA (ausência não fala)', () => {
    expect(avisoPausaVisivel({ reconhecidoEm: null, rampaAtiva: false, sessoes: [] })).toBe(false);
  });

  it('volta curta silenciosa: treinou de novo → o aviso some sozinho, sem saudação', () => {
    expect(avisoPausaVisivel({ reconhecidoEm: ACK, rampaAtiva: false, sessoes: [treino('2026-08-02')] })).toBe(false);
  });
});
