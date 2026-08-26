-- Stub MÍNIMO do que o Supabase provê nativamente (schema auth, role authenticated),
-- para poder aplicar a migração 0015 num Postgres bare-metal de teste. NÃO faz parte do
-- schema de produção — só existe para o runner `run-cas-test.sh`.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.email() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.email', true), '')
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $;
grant usage on schema auth to authenticated;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001') on conflict do nothing;


-- Stub mínimo de Realtime para testar a migration C1.1-E em Postgres puro. Produção usa o
-- schema gerenciado pelo Supabase; este stub só registra a emissão em uma caixa local.
create schema if not exists realtime;
grant usage on schema realtime to authenticated;
create table if not exists realtime.messages (
  extension text,
  topic text
);
alter table realtime.messages enable row level security;
-- O harness concede SELECT apenas para exercitar a policy com o papel authenticated. Produção
-- usa o fluxo interno do Realtime para esta autorização; esta concessão não é uma migration.
grant select on realtime.messages to authenticated;

-- Em produção, Realtime entrega o tópico ao motor de policy; no harness ele só precisa
-- existir para a policy ser compilada. Nenhuma migration de produção define esta função.
create or replace function realtime.topic()
returns text
language sql
stable
as $c1_realtime_topic$
  select current_setting('realtime.topic', true)
$c1_realtime_topic$;

create table if not exists public.realtime_test_outbox (
  topic text not null,
  event text not null,
  payload jsonb not null,
  private boolean not null
);

create or replace function realtime.send(jsonb, text, text, boolean)
returns void
language plpgsql
as $$
begin
  insert into public.realtime_test_outbox(topic, event, payload, private)
  values ($3, $2, $1, $4);
end;
$$;
