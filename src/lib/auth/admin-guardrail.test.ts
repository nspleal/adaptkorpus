import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard-rail de segurança (Ownership-3): o client `service_role` (bypassa RLS) só pode ser
 * usado no servidor, em webhooks/jobs — NUNCA num componente ou rota de usuário. Este teste
 * estático falha se `createAdminClient`/`supabase/admin` for importado fora de `api/webhooks`,
 * evitando um vazamento de service_role no futuro. Sem dependência externa.
 */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(nome)) out.push(p);
  }
  return out;
}

describe('guard-rail: createAdminClient (service_role) só em webhooks', () => {
  it('nenhum arquivo fora de api/webhooks referencia o admin client', () => {
    // Casa uso REAL (import do módulo admin ou chamada da função) — não menções em comentário.
    const USO_ADMIN = /from\s+['"][^'"]*supabase\/admin['"]|createAdminClient\s*\(/;
    const arquivos = walk(join(process.cwd(), 'src'));
    const refs = arquivos.filter((f) => USO_ADMIN.test(readFileSync(f, 'utf8')));
    const permitido = (f: string) =>
      f.includes(`${join('api', 'webhooks')}`) ||          // webhooks (uso legítimo)
      f.endsWith(join('lib', 'supabase', 'admin.ts')) ||   // a própria definição
      f.endsWith('admin-guardrail.test.ts');               // este teste
    const violacoes = refs.filter((f) => !permitido(f)).map((f) => f.replace(process.cwd(), ''));
    expect(violacoes, `service_role referenciado fora de webhooks: ${violacoes.join(', ')}`).toEqual([]);
  });
});
