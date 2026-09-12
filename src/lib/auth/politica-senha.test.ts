import { describe, expect, it } from 'vitest';
import {
  MINIMO_SENHA,
  fraseDosFaltantes,
  frasePoliticaCompleta,
  listarEmPortugues,
  requisitosDaSenha,
  requisitosFaltantes,
  senhaCumprePolitica,
} from './politica-senha';
import { forcaSenha } from '@/components/auth/ui';

/**
 * 🔴 A POLÍTICA LOCAL ESPELHA O SERVIDOR — E O ESPELHO É O TESTE.
 *
 * O defeito de 11/09/2026 (beta): `POST /signup` → 422 com
 *   "Password should be at least 8 characters. Password should contain at least one character
 *    of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789."
 * enquanto a tela liberava o envio com `senha.length >= 8` e rotulava a senha "Razoável".
 *
 * Os valores abaixo são os do SERVIDOR, lidos da resposta dele. Se a política mudar lá, é
 * aqui que a divergência tem de aparecer — não num 422 na cara do usuário.
 */

describe('política de senha — os quatro requisitos do servidor', () => {
  it('o mínimo é 8 (o que o servidor respondeu, não o que o placeholder dizia)', () => {
    expect(MINIMO_SENHA).toBe(8);
    expect(senhaCumprePolitica('Abcdefg1')).toBe(true); // 8 exatos
    expect(senhaCumprePolitica('Abcdef1')).toBe(false); // 7
    expect(requisitosFaltantes('Abcdef1')).toEqual(['tamanho']);
  });

  it.each([
    ['ABCDEFG1', 'minuscula'],
    ['abcdefg1', 'maiuscula'],
    ['Abcdefgh', 'numero'],
  ])('%s → falta %s, e é o único que falta', (senha, faltante) => {
    expect(requisitosFaltantes(senha)).toEqual([faltante]);
    expect(senhaCumprePolitica(senha)).toBe(false);
  });

  it('uma senha que cumpre tudo passa', () => {
    expect(senhaCumprePolitica('Adaptkorpus2026')).toBe(true);
    expect(requisitosFaltantes('Adaptkorpus2026')).toEqual([]);
  });

  /**
   * ⚠️ NÃO EXISTE EXIGÊNCIA DE SÍMBOLO. O log do servidor lista três conjuntos — a-z, A-Z,
   * 0-9 — e nada mais. Inventar um quarto empurraria a pessoa a trocar uma senha válida por
   * outra, achando que a primeira foi recusada.
   */
  it('símbolo não é requisito: uma senha sem símbolo nenhum passa', () => {
    expect(senhaCumprePolitica('Abcdefg1')).toBe(true);
    expect(requisitosDaSenha('Abcdefg1').map((r) => r.id)).toEqual(['tamanho', 'minuscula', 'maiuscula', 'numero']);
    expect(frasePoliticaCompleta()).not.toMatch(/s[íi]mbolo|especial/i);
  });

  /**
   * 🔒 As classes são ASCII ESTRITAS porque o servidor usa `ContainsAny` sobre os três
   * alfabetos literais. "Á" não conta como maiúscula lá — e não pode contar aqui, senão a
   * tela volta a aprovar exatamente o que o servidor recusa.
   */
  it('acento não conta como letra ASCII (o servidor casa contra o alfabeto literal)', () => {
    expect(requisitosFaltantes('ÁÉÍÓÚÃÕÇ1')).toContain('minuscula');
    expect(requisitosFaltantes('ÁÉÍÓÚÃÕÇ1')).toContain('maiuscula');
    expect(senhaCumprePolitica('áéíóúãõç1')).toBe(false);
  });

  it('o tamanho conta por unidade UTF-16 — mais conservador que os bytes do servidor', () => {
    // 8 unidades UTF-16 aqui = 11 bytes UTF-8 no servidor: o que passa aqui passa lá.
    expect('Açãodef1'.length).toBe(8);
    expect(Buffer.byteLength('Açãodef1', 'utf8')).toBeGreaterThan(8);
    expect(senhaCumprePolitica('Açãodef1')).toBe(true);
  });
});

describe('frases em português', () => {
  it('enumera sem vírgula antes do "e"', () => {
    expect(listarEmPortugues(['a'])).toBe('a');
    expect(listarEmPortugues(['a', 'b'])).toBe('a e b');
    expect(listarEmPortugues(['a', 'b', 'c'])).toBe('a, b e c');
    expect(listarEmPortugues([])).toBe('');
  });

  it('nomeia o que falta, na ordem da tela', () => {
    expect(fraseDosFaltantes(requisitosFaltantes('Abcdefgh'))).toBe('um número');
    expect(fraseDosFaltantes(requisitosFaltantes('abc'))).toBe('8 caracteres, uma letra maiúscula e um número');
  });
});

/**
 * 🔴 A REPRODUÇÃO DO DEFEITO, CONGELADA.
 *
 * "Senhaboa": 8 caracteres, minúscula e maiúscula, SEM número. O medidor a chamava de
 * "Razoável" — palavra que sugere aceitação — e o gate antigo (`length >= 8`) deixava enviar.
 * O servidor devolvia 422. As duas asserções abaixo são o antes e o depois no mesmo lugar.
 */
describe('🔴 regressão: a estimativa de força não é critério de aceitação', () => {
  const SENHA_DO_DEFEITO = 'Senhaboa';

  it('o medidor continua dizendo "Razoável" — ele é estimativa, e isso não mudou', () => {
    expect(forcaSenha(SENHA_DO_DEFEITO).rotulo).toBe('Razoável');
  });

  it('…mas a política diz que ela NÃO serve, e diz o que falta', () => {
    expect(senhaCumprePolitica(SENHA_DO_DEFEITO)).toBe(false);
    expect(requisitosFaltantes(SENHA_DO_DEFEITO)).toEqual(['numero']);
    expect(fraseDosFaltantes(requisitosFaltantes(SENHA_DO_DEFEITO))).toBe('um número');
  });

  it('o gate antigo (tamanho >= 8) teria aprovado — é essa a distância que o teste guarda', () => {
    expect(SENHA_DO_DEFEITO.length >= MINIMO_SENHA).toBe(true);
    expect(senhaCumprePolitica(SENHA_DO_DEFEITO)).toBe(false);
  });
});
