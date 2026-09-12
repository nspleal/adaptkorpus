-- ============================================================================
-- App Adaptkorpus — Blindagem RLS + allowlist do beta (leva 3, DF/blindagem 2026-07-05)
-- ----------------------------------------------------------------------------
-- Implementa as regras de ouro §4.2 da blindagem-seguranca-app-2026-07-05:
--   (4.2.2) profile.email é ESPELHO server-side de auth.users.email — o UPDATE do usuário
--           não pode apontar o e-mail da vítima (fecha o sequestro de assinatura por e-mail
--           forjado). Trigger força new.email = auth.email() quando há usuário autenticado.
--   (4.2.1) entitlement/flag-beta fora da superfície gravável pelo usuário — a allowlist é
--           uma tabela SEM policy p/ authenticated (só service_role popula); o app checa
--           via a função `beta_liberado()` (security definer), sem ler a tabela.
-- Índices de dono já existem no 0001 (plans/logs/feedback por (user_id, …)) — nada a somar.
-- Aditivo e idempotente. Aplicar após 0001–0005.
-- ============================================================================

-- ---- (4.2.2) Espelho de e-mail server-side --------------------------------
create or replace function public.profile_email_mirror()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Só sobrescreve quando há usuário autenticado (writes do app). Writes server-side
  -- (service_role, auth.uid() nulo) mantêm o e-mail que setarem.
  if auth.uid() is not null then
    new.email := auth.email();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profile_email_mirror on public.profile;
create trigger trg_profile_email_mirror
  before insert or update on public.profile
  for each row execute function public.profile_email_mirror();

-- ---- índice de dono (RLS §4.1) --------------------------------------------
create index if not exists idx_feedback_user_id on public.feedback (user_id);

-- ---- (4.2.1) Allowlist do beta (só-convite) -------------------------------
create table if not exists public.allowlist (
  email      text primary key,
  criado_em  timestamptz not null default now()
);
alter table public.allowlist enable row level security;
-- Nenhuma policy p/ authenticated/anon: o usuário NÃO lê nem escreve a allowlist.
-- Só o service_role (dashboard/SQL do autor) popula. O app consulta pela função abaixo.

-- Gate do beta: o usuário autenticado pergunta "estou liberado?" sem ler a tabela.
create or replace function public.beta_liberado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowlist a
    where lower(a.email) = lower(coalesce(auth.email(), ''))
  );
$$;

revoke all on function public.beta_liberado() from public;
grant execute on function public.beta_liberado() to authenticated;
