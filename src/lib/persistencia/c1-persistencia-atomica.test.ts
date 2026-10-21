/** C1.1-C — guards estáticos que complementam o teste SQL em Postgres real. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/0016_c1_persistencia_atomica.sql', 'utf8');
const migrationSincronizacao = readFileSync('supabase/migrations/0017_c1_sincronizacao_plano_realtime.sql', 'utf8');
const rota = readFileSync('src/app/api/dados/sync/route.ts', 'utf8');
const painel = readFileSync('src/components/painel/Painel.tsx', 'utf8');
const app = readFileSync('src/app/app/page.tsx', 'utf8');
const runnerCas = readFileSync('supabase/tests/run-cas-test.sh', 'utf8');

describe('C1.1-C — persistência atômica e server-only', () => {
  it('a função usa security definer com search_path fixo, mas o browser não tem EXECUTE', () => {
    expect(migration).toMatch(/security definer\s+set search_path = ''/);
    expect(migration).toMatch(/drop function if exists public\.commit_plano_cas\(text, uuid, integer, text, text, jsonb\)/);
    expect(migration).toMatch(/revoke all on function public\.commit_plano_cas[\s\S]*from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function public\.commit_plano_cas[\s\S]*to service_role/);
    expect(migration).not.toMatch(/grant execute on function public\.commit_plano_cas[\s\S]*to authenticated/);
  });

  it('remove DML direto que contornaria o CAS', () => {
    expect(migration).toMatch(/revoke insert, update, delete on table public\.plano_cas/);
    expect(migration).toMatch(/revoke insert, update on table public\.profile/);
    expect(migration).toMatch(/revoke insert, update, delete on table public\.plans/);
  });

  it("a rota autentica o usuário e só então chama o escritor server-only", () => {
    expect(rota).toContain('contextoUsuario(req, true)');
    expect(rota.indexOf('contextoUsuario(req, true)')).toBeLessThan(rota.indexOf('createAdminClient' + '().rpc'));
    expect(rota).toContain('SUPABASE_SERVICE_ROLE_KEY');expect(rota).toContain('executar_comando_sync_v2');
    expect(rota).toContain('p_user_id: ctx.user.id');
    expect(rota).not.toMatch(/\.from\('profile'\)\.upsert|\.from\('plans'\)\.insert/);
  });

  it('espelha e-mail somente da sessão autenticada, pois service_role não aciona auth.email()', () => {
    expect(rota).toMatch(/ctx\.user\.email/);
    expect(rota).not.toMatch(/body\??\.email/);
    expect(migration).toMatch(/p_email\s+text/);
    expect(migration).toMatch(/v_email text := nullif\(p_email, ''\)/);
    expect(migration).toMatch(/email = coalesce\(excluded\.email, profile\.email\)/);
  });

  it('reusa a mesma entrada para recomputar, preservar lateralidade e certificar mudanças dinâmicas', () => {
    expect(painel).toMatch(/escolhasExecucaoRef/);
    expect(painel).toMatch(/escolhasExecucao: \[\.\.\.escolhasExecucaoRef\.current\.entries\(\)\]/);
    expect(painel).toMatch(/opcoesDeEntradaPlano\(entradaDoPlano\(perfil, sobrescrever\)\)/);
    expect(painel).toMatch(/certificarEntradaDinamica\(perfil, \{ pesoEfetivoKg: pesoMotorKg \}\)/);
    expect(painel).not.toMatch(/recomputarPlano\([^;]+\{\s*semanaCiclo:/);
  });

  it('a migração aplica o CAS antes do perfil e dos dois snapshots, no mesmo corpo transacional', () => {
    const cas = migration.indexOf('insert into public.plano_cas');
    const perfil = migration.indexOf('insert into public.profile');
    const planos = migration.indexOf('insert into public.plans');
    expect(cas).toBeGreaterThan(-1);
    expect(perfil).toBeGreaterThan(cas);
    expect(planos).toBeGreaterThan(perfil);
    expect(migration).toMatch(/on conflict \(aggregate_id\) do nothing/);
    expect(migration).toMatch(/CONFLITO_REVISAO/);
  });

  it("nunca esconde conflito de certificado ou falha de rede do usuário", () => {
    const cliente=readFileSync('src/lib/persistencia/sync-cliente.ts','utf8');
    expect(app).toContain('<ConflitoSync');expect(app).toContain('conta.erro');expect(app).toContain('aguardando confirmação');
    expect(cliente).toContain("recibo?.tipo !== 'CONFLITO'");expect(cliente).toContain('await db.resolver');
  });
  it('notifica somente a revisão no tópico privado do próprio usuário', () => {
    expect(migrationSincronizacao).toMatch(/on realtime\.messages[\s\S]*for select[\s\S]*to authenticated/);
    expect(migrationSincronizacao).toMatch(/realtime\.topic\(\).*user:/);
    expect(migrationSincronizacao).toMatch(/realtime\.send\([\s\S]*jsonb_build_object\('revision', new\.revision\)/);
    expect(migrationSincronizacao).not.toMatch(/perfilLinha|canonical_input_hash|p_payload/);
    expect(migrationSincronizacao).toMatch(/revoke all on function public\.notificar_revisao_do_plano\(\) from public, anon, authenticated/);
    expect(runnerCas).toMatch(/0017_c1_sincronizacao_plano_realtime\.sql/);
    expect(runnerCas).toMatch(/cas_sincronizacao_realtime\.sql/);
  });

  it("atualização automática preserva edição e conflitos pedem escolha explícita", () => {
    const hook=readFileSync('src/lib/persistencia/use-conta-sync.ts','utf8');
    expect(hook).toContain("window.addEventListener('focus'");expect(hook).toContain('private:true');
    expect(hook).toContain('removeChannel(canal)');expect(hook).toContain('if (m.conflitos.length)');
    expect(app).toContain('Manter minha edição');expect(app).toContain('Usar treino da conta');
    expect(hook).toContain('!ocupadoRef.current');expect(hook).toContain('mesclarTresVias');
  });

  it("a rota rejeita a entrada duplicada antes de o construtor normalizar Map ou Set", () => {
    const borda=readFileSync('src/lib/persistencia/sync-servidor.ts','utf8');
    expect(rota.indexOf('comandoSyncSchema.safeParse(body)')).toBeLessThan(rota.indexOf('prepararPerfil(ctx.user.id'));
    expect(borda).toContain('entradaPlanoVisivelSchema.optional()');
    expect(rota).toContain("motivo: 'comando_invalido'");
  });

});
