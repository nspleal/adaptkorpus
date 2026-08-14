/**
 * 🔐 TODO CAMPO DE AUTH DECLARA `autoComplete` (auditoria 2026-08-14, achado A5).
 *
 * Sem o atributo, gerenciadores de senha não reconhecem os campos: a pessoa digita a senha
 * à mão, e senha digitada à mão é senha mais curta e mais reusada. É higiene de segurança
 * que se paga em UX, não o contrário.
 *
 * 🔒 Regra GLOBAL (nunca campo a campo): todo `<input>` das três telas de auth declara o
 * atributo — um formulário novo nasce coberto ou derruba o teste. Os valores certos também
 * são verificados: `current-password` no login (preenche a existente) contra `new-password`
 * no cadastro e na redefinição (oferece gerar uma forte). Trocar os dois faz o gerenciador
 * sugerir a senha errada, e é um erro que passa despercebido a olho nu.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const TELAS = ['src/app/login/page.tsx', 'src/app/cadastro/page.tsx', 'src/app/redefinir/page.tsx'];

describe('🔐 autoComplete nos formulários de auth', () => {
  it('nenhum input de auth fica sem autoComplete', () => {
    const semAtributo: string[] = [];
    for (const t of TELAS) {
      const s = readFileSync(t, 'utf8');
      for (const tag of s.match(/<input\b[^>]*>/g) ?? []) {
        if (!/autoComplete=/.test(tag)) semAtributo.push(`${t}: ${tag.slice(0, 90)}`);
      }
    }
    expect(semAtributo, `input de auth sem autoComplete:\n${semAtributo.join('\n')}`).toEqual([]);
  });

  it('o login pede a senha EXISTENTE; cadastro e redefinição pedem uma NOVA', () => {
    const login = readFileSync('src/app/login/page.tsx', 'utf8');
    expect(login).toMatch(/autoComplete="current-password"/);
    expect(login, 'login não pode pedir new-password').not.toMatch(/autoComplete="new-password"/);
    for (const t of ['src/app/cadastro/page.tsx', 'src/app/redefinir/page.tsx']) {
      const s = readFileSync(t, 'utf8');
      expect(s, `${t} deveria pedir new-password`).toMatch(/autoComplete="new-password"/);
      expect(s, `${t} não pode pedir current-password`).not.toMatch(/autoComplete="current-password"/);
    }
  });
});
