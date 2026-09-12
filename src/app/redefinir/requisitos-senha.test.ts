import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 🔴 /redefinir — O MESMO DEFEITO MORAVA AQUI, PELO MESMO MOTIVO.
 *
 * `updateUser({ password })` passa pela MESMA política de senha do `signUp` — a que produziu
 * o 422 de 11/09/2026. O gate desta tela era `npw.length >= 8` e o medidor aparecia desde o
 * primeiro caractere: senha sem número era chamada de "Razoável", o botão liberava, e a
 * recusa voltava como *"Não foi possível salvar a senha. Peça um novo link."* — que manda a
 * pessoa refazer um fluxo inteiro por um problema que era da senha.
 *
 * ⚠️ Este guard existe porque **são duas telas que criam senha**, e a lição da casa
 * (`consentimento-a11y.test.ts`) é que consertar uma e esquecer a outra é o padrão do drift.
 */

const ARQ = join(process.cwd(), 'src', 'app', 'redefinir', 'page.tsx');
const fonte = readFileSync(ARQ, 'utf8');
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

describe('anti-vacuidade', () => {
  it('o guard lê a tela de verdade', () => {
    expect(codigo.length).toBeGreaterThan(3000);
    expect(codigo).toMatch(/auth\.updateUser\(\{ password: npw \}\)/);
  });
});

describe('🔑 a nova senha é medida contra a política do servidor', () => {
  it('o gate é `senhaCumprePolitica`, não o tamanho', () => {
    expect(codigo).toMatch(/import \{[^}]*senhaCumprePolitica[^}]*\} from '@\/lib\/auth\/politica-senha'/);
    expect(codigo).toMatch(/const podeSalvar = senhaNovaOk && match/);
    expect(/npw\.length >= 8/.test(codigo), 'o gate por tamanho voltou').toBe(false);
  });

  it('os requisitos aparecem junto ao campo, ligados por aria-describedby', () => {
    expect(codigo).toMatch(/<RequisitosSenha senha=\{npw\} id=\{ID_REQUISITOS\} \/>/);
    const inputNova = codigo.match(/<input[^>]*autoComplete="new-password"[^>]*>/)?.[0] ?? '';
    expect(inputNova).toMatch(/aria-describedby=\{ID_REQUISITOS\}/);
    expect(/Mínimo 8 caracteres/.test(codigo), 'o placeholder voltou a anunciar só o tamanho').toBe(false);
  });

  it('a força estimada só entra depois dos requisitos cumpridos', () => {
    expect(codigo).toMatch(/\{senhaNovaOk && \(/);
    expect(codigo).toMatch(/Força estimada/);
    expect(/\{npw\.length > 0 && \([\s\S]{0,200}f\.rotulo/.test(codigo), 'o medidor voltou a aparecer antes da política').toBe(false);
  });

  it('o botão indisponível diz o que falta', () => {
    expect(codigo).toMatch(/fraseDosFaltantes\(faltamNaSenha\)/);
    expect(codigo).toMatch(/aria-describedby=\{npw\.length > 0 && !podeSalvar \? 'redefinir-pendencia' : undefined\}/);
  });
});

describe('🔑 toda recusa é traduzida no contexto de SALVAR SENHA', () => {
  it('usa `traduzirErroAuth` com o contexto desta tela, nos dois caminhos', () => {
    expect(codigo).toMatch(/traduzirErroAuth\(error, npw, 'salvar-senha'\)/);
    expect(codigo, 'o catch precisa traduzir também').toMatch(/catch \(e\)[\s\S]*traduzirErroAuth\(e, npw, 'salvar-senha'\)/);
    expect(codigo, 'esta tela não pode usar o contexto do cadastro').not.toMatch(/'criar-conta'/);
  });

  /**
   * 🔴 ACHADO DA REVISÃO CODEX (2026-09-12). A primeira correção só traduzia `senha-fraca` e
   * jogava TODO o resto em *"Não foi possível salvar a senha. Peça um novo link."* — um 429,
   * um 503 ou uma senha igual à atual mandavam a pessoa refazer o fluxo inteiro por um
   * problema que link nenhum resolve. Pedir link novo virou caso, não padrão.
   */
  it('🔴 não existe mais o balde "peça um novo link" para tudo que não é senha fraca', () => {
    expect(/Peça um novo link/.test(codigo), 'o balde genérico voltou').toBe(false);
    expect(/motivo === 'senha-fraca'/.test(codigo), 'voltou a filtrar só a senha fraca').toBe(false);
    // A frase de link agora mora no tradutor, e só no motivo de sessão inválida.
    expect(codigo, 'a tela não pode redigitar copy de erro por fora do tradutor').not.toMatch(/setErro\('Não foi possível salvar/);
  });

  it('🔒 as quatro fases e a mensagem neutra do envio seguem intactas', () => {
    expect(codigo).toMatch(/type Fase = 'request' \| 'sent' \| 'reset' \| 'done'/);
    // Mensagem neutra: não revelar se o e-mail existe (enumeração de contas).
    expect(codigo).toMatch(/setFase\('sent'\);/);
    expect(codigo).toMatch(/resetPasswordForEmail\(email,/);
  });

  /** 🔒 Recusa não apaga o que foi digitado nem tira a pessoa do passo em que ela está. */
  it('🔒 a recusa preserva os campos e a fase', () => {
    const i = codigo.search(/async\s+function\s+salvarSenha\s*\(/);
    expect(i, 'salvarSenha sumiu ou mudou de nome').toBeGreaterThanOrEqual(0);
    const corpo = codigo.slice(i, codigo.indexOf('const f = forcaSenha', i));
    expect(corpo.length).toBeGreaterThan(300);
    // Só o ramo de FALHA: do `if (error)` até o `setFase('done')` do sucesso, que vem depois.
    const iErro = corpo.indexOf('if (error)');
    const iDone = corpo.indexOf("setFase('done')", iErro);
    expect(iErro, 'o ramo de falha sumiu').toBeGreaterThanOrEqual(0);
    expect(iDone, 'o ramo de sucesso sumiu — o recorte ficaria sem fim').toBeGreaterThan(iErro);
    const erroPath = corpo.slice(iErro, iDone);
    for (const limpeza of ["setNpw('')", "setNpw2('')", "setEmail('')"]) {
      expect(erroPath.includes(limpeza), `${limpeza} apaga o que a pessoa digitou`).toBe(false);
    }
    expect(/setFase\(/.test(erroPath), 'a recusa tirou a pessoa do passo de criar senha').toBe(false);
  });

  it('🔒 nada de log nem de exigência inventada de símbolo', () => {
    expect(/console\.(log|error|warn|info)/.test(codigo)).toBe(false);
    expect(/error\.message/.test(codigo)).toBe(false);
    expect(/s[íi]mbolo|caractere especial/i.test(fonte)).toBe(false);
  });
});
