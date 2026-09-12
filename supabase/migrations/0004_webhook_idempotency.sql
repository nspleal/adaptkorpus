-- ============================================================================
-- App Adaptkorpus — Idempotência de webhooks (anti-replay/reentrega)
-- ----------------------------------------------------------------------------
-- Registra os eventos já processados. O webhook insere o event_id; se já existe
-- (unique_violation), o evento é ignorado — evita processar a mesma cobrança 2x.
--
-- Acesso: NENHUMA política → só o service_role (servidor) escreve/lê. RLS habilitada
-- (default-deny) para garantir que nenhum usuário toque nesta tabela.
-- ============================================================================

create table if not exists public.webhook_events (
  event_id     text primary key,
  origem       text not null default 'kiwify',
  recebido_em  timestamptz not null default now()
);

alter table public.webhook_events enable row level security;
-- Sem políticas: usuários não têm acesso; o webhook usa service_role (bypassa RLS).
