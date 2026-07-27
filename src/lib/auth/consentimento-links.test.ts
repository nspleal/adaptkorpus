import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard-rail ESTÁTICO do consentimento informado (cultura do repo, como o `rls-migrations`
 * e o `admin-guardrail`): as telas onde o usuário ACEITA precisam LINKAR o texto que ele
 * está aceitando. Consentimento sem acesso ao texto é consentimento NÃO-informado
 * (LGPD/CDC) — cofre `operacao-legal-suporte-reembolso` + `plano-pos-feedback-beta-2026-07-26`
 * §Leva 1, achado nº 1 da 1ª rodada do beta ("não achei como ler os termos ao criar a conta").
 *
 * Este teste existe porque o furo JÁ ACONTECEU UMA VEZ: `docs/relatorio-pontas-soltas-frontend.md`
 * registra os mesmos links mortos, e a correção da época religou rodapé/`/conta`/Perfil e
 * esqueceu justamente as duas telas de ACEITE. Sem jsdom no vitest (`environment: 'node'`),
 * a checagem é sobre o fonte — que é exatamente o que trava o drift.
 */

const RAIZ = process.cwd();
/** As duas telas de aceite: /cadastro (signUp) e /onboarding (onde o aceite é PERSISTIDO). */
const TELAS_DE_ACEITE = [
  join('src', 'app', 'cadastro', 'page.tsx'),
  join('src', 'app', 'onboarding', 'page.tsx'),
] as const;
const DOCUMENTOS = ['/termos', '/privacidade', '/aviso'] as const;

const ler = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

describe('consentimento informado — as telas de aceite linkam os 3 documentos', () => {
  for (const tela of TELAS_DE_ACEITE) {
    it(`${tela} linka Termos, Privacidade e Aviso`, () => {
      const src = ler(tela);
      for (const doc of DOCUMENTOS) {
        expect(src, `${tela} não linka ${doc}`).toContain(`href="${doc}"`);
      }
    });

    it(`${tela} usa LinkLegal (nova aba + não marca o checkbox)`, () => {
      const src = ler(tela);
      // O componente único carrega as 2 travas; usar <Link> cru aqui reintroduz os bugs
      // (perder o formulário ao navegar / marcar o aceite ao clicar para ler).
      expect(src).toContain('LinkLegal');
      for (const doc of DOCUMENTOS) {
        expect(src, `${doc} deveria estar dentro de um LinkLegal`).toMatch(
          new RegExp(`<LinkLegal href="${doc}">`),
        );
      }
    });
  }

  it('LinkLegal mantém as duas travas: target _blank + rel + stopPropagation', () => {
    const ui = ler(join('src', 'components', 'auth', 'ui.tsx'));
    const bloco = ui.slice(ui.indexOf('export function LinkLegal'));
    expect(bloco).toContain('target="_blank"');
    expect(bloco).toContain('rel="noopener noreferrer"');
    // Sem isto, ABRIR o documento para ler marcaria o consentimento (a linha inteira é o
    // alvo do toggle nas duas telas) — é a trava mais fácil de perder num refactor.
    expect(bloco).toContain('stopPropagation');
  });

  it('as 3 páginas linkadas existem e são públicas (o middleware não as protege)', () => {
    for (const doc of DOCUMENTOS) {
      expect(existsSync(join(RAIZ, 'src', 'app', doc.slice(1), 'page.tsx')), `${doc} não existe`).toBe(true);
    }
    const mw = ler(join('src', 'middleware.ts'));
    const protegida = mw.slice(mw.indexOf('const protegida'), mw.indexOf('const protegida') + 240);
    for (const doc of DOCUMENTOS) {
      expect(protegida, `${doc} não pode estar atrás de login`).not.toContain(doc);
    }
  });

  it('o selo de rascunho segue ligado por padrão nas páginas legais (decisão do cofre)', () => {
    const layout = ler(join('src', 'components', 'legal', 'LegalLayout.tsx'));
    expect(layout).toContain('draftMode = true');
    expect(layout).toContain('Rascunho — conteúdo em validação jurídica');
    for (const doc of DOCUMENTOS) {
      const pagina = ler(join('src', 'app', doc.slice(1), 'page.tsx'));
      expect(pagina, `${doc} não pode desligar o selo enquanto a redação jurídica não volta`)
        .not.toContain('draftMode={false}');
    }
  });
});
