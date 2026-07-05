-- ============================================================================
-- App Evokorpus — Hardening do Security Advisor (leva 3, 2026-07-05)
-- ----------------------------------------------------------------------------
-- Idempotente. Zera os avisos de "function search_path mutable" e de execute
-- indevido em funções. O aviso "authenticated pode executar beta_liberado" é
-- ACEITO (o app precisa chamar; a função só checa o e-mail do próprio caller).
-- ============================================================================

-- search_path fixo no trigger de updated_at (usa só now(), de pg_catalog → seguro).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profile_email_mirror é FUNÇÃO DE TRIGGER: ninguém a chama diretamente. Tira o
-- execute de todos (o trigger continua disparando independentemente de grants).
revoke all on function public.profile_email_mirror() from public;

-- beta_liberado: executável só por authenticated (revoke public/anon; reafirma o grant).
revoke all on function public.beta_liberado() from public;
grant execute on function public.beta_liberado() to authenticated;
