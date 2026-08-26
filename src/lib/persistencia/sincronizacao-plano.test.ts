import { describe, expect, it } from 'vitest';
import { EVENTO_PLANO_ATUALIZADO, reconciliarConfirmacaoLocal, revisaoRemotaMaisNova } from './sincronizacao-plano';

describe('sincronização do plano entre dispositivos', () => {
  it('tem evento estável e reconhece somente uma revisão estritamente mais nova', () => {
    expect(EVENTO_PLANO_ATUALIZADO).toBe('plano_atualizado');
    expect(revisaoRemotaMaisNova(4, { revision: 5 })).toBe(5);
    expect(revisaoRemotaMaisNova(4, { revision: 4 })).toBeNull();
    expect(revisaoRemotaMaisNova(4, { revision: 3 })).toBeNull();
  });

  it('ignora payload de broadcast malformado em vez de bloquear o usuário por ruído', () => {
    expect(revisaoRemotaMaisNova(4, null)).toBeNull();
    expect(revisaoRemotaMaisNova(4, { revision: 4.5 })).toBeNull();
    expect(revisaoRemotaMaisNova(4, { revision: '5' })).toBeNull();
    expect(revisaoRemotaMaisNova(4, {})).toBeNull();
  });
});


describe('reconciliação entre confirmação local e Realtime', () => {
  it('não bloqueia o próximo save quando o broadcast é o eco da própria revisão confirmada', () => {
    expect(reconciliarConfirmacaoLocal(6, 6)).toEqual({
      bloqueado: false,
      revisaoRemotaPendente: null,
    });
  });

  it('mantém o bloqueio quando outro dispositivo confirmou uma revisão ainda mais nova na corrida', () => {
    expect(reconciliarConfirmacaoLocal(6, 7)).toEqual({
      bloqueado: true,
      revisaoRemotaPendente: 7,
    });
  });
});
