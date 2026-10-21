import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIMITE_PAYLOAD_BYTES, aderenciaDiaSchema, payloadCabe, sessaoHistoricoSchema } from './validation/api';

/**
 * HARDENING DE API — auditoria de segurança de 2026-07-29 (itens 3, 4 e 5).
 * Guards estáticos no padrão da casa (`rls-migrations.test.ts`): comentário removido antes
 * da checagem, senão a documentação da trava derrubaria o teste.
 */
const FONTE = (p: string): string =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('item 3 — teto de payload jsonb', () => {
  it('`payloadCabe` mede BYTES do serializado, não caracteres', () => {
    expect(payloadCabe({ a: 1 })).toBe(true);
    // 'á' são 2 bytes em UTF-8: uma string de N/2+1 acentos estoura um teto de N bytes.
    expect(payloadCabe('á'.repeat(LIMITE_PAYLOAD_BYTES), LIMITE_PAYLOAD_BYTES)).toBe(false);
    expect(payloadCabe({ notas: 'x'.repeat(LIMITE_PAYLOAD_BYTES) })).toBe(false);
  });

  it('estrutura circular não passa (e não explode)', () => {
    const circ: Record<string, unknown> = {};
    circ.eu = circ;
    expect(payloadCabe(circ)).toBe(false);
  });

  it('o schema da aderência é RASO — status fechado, nota com teto', () => {
    expect(aderenciaDiaSchema.safeParse({ dia: '2026-07-29', logs: { cafe: 'comi' }, notes: {} }).success).toBe(true);
    // status fora do enum
    expect(aderenciaDiaSchema.safeParse({ dia: '2026-07-29', logs: { cafe: 'inventado' }, notes: {} }).success).toBe(false);
    // data fora do formato
    expect(aderenciaDiaSchema.safeParse({ dia: '29/07/2026', logs: {}, notes: {} }).success).toBe(false);
    // nota gigante
    expect(aderenciaDiaSchema.safeParse({ dia: '2026-07-29', logs: {}, notes: { cafe: 'x'.repeat(2001) } }).success).toBe(false);
  });

  it('o schema da sessão limita o que dá para inflar', () => {
    const ok = { dataISO: '2026-07-29', n: 1, exercicios: [] };
    expect(sessaoHistoricoSchema.safeParse(ok).success).toBe(true);
    expect(sessaoHistoricoSchema.safeParse({ ...ok, exercicios: new Array(61).fill({}) }).success).toBe(false);
    expect(sessaoHistoricoSchema.safeParse({ ...ok, dataISO: 'ontem' }).success).toBe(false);
  });

  it("writer v2 aplica schema/teto e as quatro escritas legadas só recusam", () => {
    const src=FONTE('src/app/api/dados/sync/route.ts');
    expect(src).toContain('comandoSyncSchema.safeParse(body)');expect(src).toContain('payloadCabe(');expect(src).toContain('status: 413');
    for(const p of ['perfil','peso','aderencia','historico']){
      const antiga=FONTE('src/app/api/dados/'+p+'/route.ts');
      const writer=antiga.slice(antiga.indexOf('export async function '+(p==='perfil'||p==='aderencia'?'PUT':'POST')));
      expect(writer).toContain('status: 426');expect(writer).not.toMatch(/\.rpc\(|\.(insert|upsert|update|delete)\(/);
    }
  });

  it("writer v2, exportação e exclusão têm limitador por usuário", () => {
    for(const p of ['src/app/api/dados/sync/route.ts','src/app/api/lgpd/exportar/route.ts','src/app/api/lgpd/excluir/route.ts']){
      const src=FONTE(p);expect(src,p).toContain('criarRateLimit(');expect(src,p).toContain('barreiraDados(ctx.user.id, limitador)');
    }
  });

  it('a chave do limitador é o USUÁRIO, nunca o IP (todo mundo aqui está logado)', () => {
    const guard = FONTE('src/lib/auth/guard.ts');
    const i = guard.indexOf('export function barreiraDados');
    expect(i).toBeGreaterThan(-1);
    expect(guard.slice(i)).not.toMatch(/x-forwarded-for/);
  });
});

describe('item 4 — exclusão de conta exige a senha', () => {
  const src = FONTE('src/app/api/lgpd/excluir/route.ts');

  it('revalida a senha ANTES de chamar o admin', () => {
    const iSenha = src.indexOf('signInWithPassword');
    const iDelete = src.indexOf('deleteUser');
    expect(iSenha).toBeGreaterThan(-1);
    expect(iDelete).toBeGreaterThan(iSenha);
  });

  it('sem senha → 400; senha errada → 401', () => {
    expect(src).toMatch(/senha_obrigatoria[\s\S]{0,60}status: 400/);
    expect(src).toMatch(/senha_invalida[\s\S]{0,60}status: 401/);
  });

  it('o e-mail vem do JWT, nunca do corpo', () => {
    expect(src).toMatch(/ctx\.user\.email/);
    // A regressão perigosa: aceitar e-mail do body permitiria mirar outra conta.
    expect(src).not.toMatch(/body\?\.email|body\.email/);
  });

  it('a revalidação NÃO persiste sessão (não mexe no cookie de quem está logado)', () => {
    expect(src).toMatch(/persistSession: false/);
  });

  it('a UI manda a senha e desabilita o botão sem ela', () => {
    const ui = FONTE('src/app/conta/page.tsx');
    expect(ui).toMatch(/JSON\.stringify\(\{ senha: senhaExclusao \}\)/);
    expect(ui).toMatch(/senhaExclusao\.length === 0/);
  });
});

describe('item 5 — a marca de idempotência vem DEPOIS do processamento', () => {
  const src = FONTE('src/app/api/webhooks/kiwify/route.ts');

  it('a checagem é uma LEITURA; a gravação vive numa função à parte', () => {
    expect(src).toMatch(/\.select\('event_id'\)[\s\S]{0,80}maybeSingle\(\)/);
    expect(src).toMatch(/function marcarProcessado/);
  });

  it('o caminho PENDENTE não marca — é o bug que isto conserta', () => {
    // Gravar a marca antes de resolver o usuário fazia o retry seguinte cair em
    // "duplicado" sem nunca aplicar. O `pendente` tem de sair SEM marcar.
    const i = src.indexOf("pendente: 'user_id não resolvido'");
    expect(i).toBeGreaterThan(-1);
    const bloco = src.slice(src.lastIndexOf('if (!userId)', i), i);
    expect(bloco).not.toMatch(/marcarProcessado/);
  });

  it('a falha de escrita também não marca', () => {
    const i = src.indexOf("error: 'falha ao atualizar'");
    const bloco = src.slice(src.lastIndexOf('if (error)', i), i);
    expect(bloco).not.toMatch(/marcarProcessado/);
  });

  it('sucesso e ignorado-de-propósito marcam (senão a dedup morre)', () => {
    expect(src).toMatch(/await marcarProcessado\(\);[\s\S]{0,80}ignorado: true/);
    expect(src).toMatch(/await marcarProcessado\(\);[\s\S]{0,60}NextResponse\.json\(\{ ok: true \}\)/);
  });

  it('a assinatura HMAC continua sendo validada antes de qualquer parse', () => {
    const iAssin = src.indexOf('assinaturaValida(rawBody');
    const iParse = src.indexOf('JSON.parse(rawBody)');
    expect(iAssin).toBeGreaterThan(-1);
    expect(iParse).toBeGreaterThan(iAssin);
    expect(src).toMatch(/timingSafeEqual/);
  });
});

describe('item 6 — menores', () => {
  it('o `.gitignore` é catch-all e ainda deixa o exemplo passar', () => {
    const gi = readFileSync('.gitignore', 'utf8');
    expect(gi).toMatch(/^\.env\*$/m);
    expect(gi).toMatch(/^!\.env\.example$/m);
  });

  it('o nome no assunto do e-mail perde CR/LF', () => {
    const src = FONTE('src/app/api/suporte/route.ts');
    expect(src).toMatch(/nome\.replace\(\/\[\\r\\n\]\/g, ' '\)/);
  });
});

/**
 * 🔒 item 2 — `Secure` no cookie de sessão (auditoria 2026-07-06, aplicado em `dc008d7`).
 *
 * 🔴 Por que este guard existe: a flag foi implementada e **passou em branco em três
 * relatórios seguidos** — ninguém conseguia confirmar sem abrir o arquivo. Código correto
 * que ninguém consegue verificar é pendência que não fecha; o guard é o que torna a
 * resposta consultável.
 *
 * ⚠️ É `secure: <produção>`, NÃO `secure: true` — e de propósito. Em `http://localhost` o
 * browser recusa cookie `Secure`, a sessão não persiste e o login entra em laço. Em
 * produção a Vercel serve só HTTPS e o HSTS do `next.config` força, então o condicional
 * não abre janela nenhuma: é a diferença entre "não acontece" e "não pode acontecer".
 */
describe('item 2 — `Secure` no cookie de sessão', () => {
  const ALVOS = ['src/lib/supabase/server.ts', 'src/middleware.ts'] as const;

  it.each(ALVOS)('%s declara `cookieOptions` com `secure` condicionado à produção', (arq) => {
    const src = FONTE(arq);
    expect(src, `${arq} sem cookieOptions`).toMatch(/cookieOptions:\s*\{/);
    // `secure: producao` (server.ts) ou `secure: process.env.NODE_ENV === 'production'`.
    expect(src).toMatch(/secure:\s*(producao|process\.env\.NODE_ENV === 'production')/);
  });

  it.each(ALVOS)('%s NÃO deixa o cookie sem `secure` nem fixa `false`', (arq) => {
    const src = FONTE(arq);
    expect(/secure:\s*false/.test(src), `${arq} fixa secure:false`).toBe(false);
  });

  it('`producao` do server client lê NODE_ENV (não é constante solta)', () => {
    const src = FONTE('src/lib/supabase/server.ts');
    expect(src).toMatch(/const producao = process\.env\.NODE_ENV === 'production'/);
    expect(/const producao = (true|false)/.test(src), 'produção virou literal').toBe(false);
  });

  it('`sameSite` e `path` acompanham nos dois (o cookie de auth é um só)', () => {
    for (const arq of ALVOS) {
      const src = FONTE(arq);
      expect(src, `${arq}`).toMatch(/sameSite:\s*'lax'/);
      expect(src, `${arq}`).toMatch(/path:\s*'\/'/);
    }
  });
});
