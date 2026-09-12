-- ============================================================================
-- App Adaptkorpus — profile: e-mail (espelho) + preferências do perfil (jsonb)
-- ----------------------------------------------------------------------------
-- Decisões de engenharia (DF 2026-07-05, ao mapear a persistência do bloco auth/beta):
--
--  1) `preferencias jsonb` — os ~9 campos do perfil que não têm coluna própria
--     (nivelExperiencia, equipamento, equipamentosCasa, treinoDias, diasDisponiveis,
--      tempoPorSessaoMin, naoCurto, favoritos, pratosCansados). Mesmo padrão de
--     `plans.payload` — evita uma migration a cada campo novo do perfil.
--  2) `email` — espelho e-mail→user_id que o webhook Kiwify (`resolverUserId`, hoje null)
--     e a allowlist do beta usam. O webhook lê via service_role (admin), que bypassa RLS;
--     por isso NÃO é preciso policy nova — as colunas herdam as policies row-level de
--     `profile` (owner em `auth.uid() = id`).
--
-- Aditivo e idempotente. Aplicar em ordem, depois de 0001–0004 (ver supabase/README.md).
-- ============================================================================

alter table public.profile
  add column if not exists email        text,
  add column if not exists preferencias jsonb not null default '{}'::jsonb;

-- Único por e-mail, case-insensitive, para o lookup do webhook/allowlist. Parcial (só
-- linhas com e-mail) para não colidir enquanto o e-mail ainda não foi gravado.
create unique index if not exists profile_email_unique
  on public.profile (lower(email))
  where email is not null;
