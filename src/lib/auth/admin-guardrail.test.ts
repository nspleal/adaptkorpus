import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard-rail de segurança (Ownership-3): o client `service_role` (bypassa RLS) só pode ser
 * usado no servidor, em webhooks/jobs ou em uma rota que tenha autenticado a identidade ANTES
 * do bypass. Este teste estático falha se `createAdminClient`/`supabase/admin` escapar dessas rotas,
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

describe('guard-rail: createAdminClient (service_role) só em rotas confiáveis', () => {
  it('nenhum arquivo fora das rotas explicitamente auditadas referencia o admin client', () => {
    // Casa uso REAL (import do módulo admin ou chamada da função) — não menções em comentário.
    const USO_ADMIN = /from\s+['"][^'"]*supabase\/admin['"]|createAdminClient\s*\(/;
    const arquivos = walk(join(process.cwd(), 'src'));
    const refs = arquivos.filter((f) => USO_ADMIN.test(readFileSync(f, 'utf8')));
    const permitido = (f: string) =>
      f.includes(`${join('api', 'webhooks')}`) ||          // webhooks (uso legítimo)
      f.includes(`${join('api', 'lgpd')}`) ||              // exclusão LGPD (deleteUser — auditado)
      f.includes(join('api', 'dados', 'perfil', 'route.ts')) || // C1.1-C: CAS server-only após contextoUsuario
      f.endsWith(join('lib', 'supabase', 'admin.ts')) ||   // a própria definição
      f.endsWith('admin-guardrail.test.ts');               // este teste
    const violacoes = refs.filter((f) => !permitido(f)).map((f) => f.replace(process.cwd(), ''));
    expect(violacoes, `service_role referenciado fora de webhooks: ${violacoes.join(', ')}`).toEqual([]);
  });
});
