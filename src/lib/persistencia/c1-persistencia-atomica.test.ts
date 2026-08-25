/** C1.1-C — guards estáticos que complementam o teste SQL em Postgres real. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/0016_c1_persistencia_atomica.sql', 'utf8');
const rota = readFileSync('src/app/api/dados/perfil/route.ts', 'utf8');
const painel = readFileSync('src/components/painel/Painel.tsx', 'utf8');
const app = readFileSync('src/app/app/page.tsx', 'utf8');

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

  it('a rota autentica o usuário e só então chama o escritor server-only', () => {
    expect(rota).toMatch(/contextoUsuario\(\)/);
    expect(rota).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(rota).toMatch(/createAdminClient\(\)/);
    expect(rota).not.toMatch(/\.from\('profile'\)\.upsert/);
    expect(rota).not.toMatch(/\.from\('plans'\)\.insert/);
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

  it('nunca esconde conflito de certificado ou falha de rede do usuário', () => {
    expect(app).toMatch(/resultado\.tipo === 'CONFLITO_VERSAO_OU_HASH'/);
    expect(app).toMatch(/setPendenciaPersistencia\(\{ tipo: 'FALHA'/);
    expect(app).toMatch(/Tentar salvar novamente/);
    expect(app).toMatch(/Recarregue a versão salva antes de continuar/);
  });
});
