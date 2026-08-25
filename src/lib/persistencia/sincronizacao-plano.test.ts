import { describe, expect, it } from 'vitest';
import { EVENTO_PLANO_ATUALIZADO, revisaoRemotaMaisNova } from './sincronizacao-plano';

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
