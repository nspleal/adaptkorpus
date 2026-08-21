-- Stub MÍNIMO do que o Supabase provê nativamente (schema auth, role authenticated),
-- para poder aplicar a migração 0015 num Postgres bare-metal de teste. NÃO faz parte do
-- schema de produção — só existe para o runner `run-cas-test.sh`.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001') on conflict do nothing;
