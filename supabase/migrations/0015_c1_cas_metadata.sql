-- ════════════════════════════════════════════════════════════════════════════
-- 0015 — C1 · CAS (compare-and-swap) do agregado de plano · METADADOS + RPC ATÔMICA
-- Decisão do autor "CAS PERSISTENTE" (2026-08-21): migração ADITIVA restrita aos
-- metadados necessários ao C1 (aggregate_id, revision, formula_version,
-- canonical_input_hash). NÃO altera a semântica de `public.plans` nem migra planos antigos.
--
-- 🔴 POR QUE TABELA PRÓPRIA (`plano_cas`), e não colunas em `public.plans`:
--   `plans` é o armazenamento existente dos planos (dieta/treino) — mexer no seu conteúdo/
--   estrutura tocaria a migração de planos antigos (B1.14), o que a decisão do autor
--   EXPLICITAMENTE não autoriza. Uma tabela aditiva isola o CAS do C1: planos legados
--   simplesmente NÃO têm linha aqui (campos não-inicializados) e o primeiro uso do C1
--   recompõe e grava o agregado. Nada é transformado silenciosamente.
--
-- 🔒 ATOMICIDADE: a troca é a RPC `commit_plano_cas` — um UPDATE condicional
--   `... WHERE aggregate_id = :id AND revision = :expected`. Zero linhas ⇒ conflito
--   DISCRIMINADO (CONFLITO_REVISAO), NUNCA sucesso. Baseline/terminal/resultados/
--   contratos/distribuição/blocos entram no MESMO `payload` jsonb desta operação.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.plano_cas (
  -- Identidade estável do agregado, ex.: `${user_id}:plano-treino`.
  aggregate_id          text primary key,
  -- Dono do agregado (para RLS por auth.uid()); o aggregate_id começa por este id.
  user_id               uuid not null references auth.users(id) on delete cascade,
  -- Revisão monotônica. Começa em 0 (inexistente); cada commit confirmado faz +1.
  revision              integer not null default 0 check (revision >= 0),
  -- Versão da fórmula que PRODUZIU o agregado (nunca se persiste motor obsoleto).
  formula_version       text not null,
  -- Hash canônico determinístico do INPUT que gerou o agregado.
  canonical_input_hash  text not null,
  -- Agregado do C1 (baseline, terminal, resultados, contratos, distribuição, blocos).
  payload               jsonb not null,
  updated_at            timestamptz not null default now()
);

-- ---------- RLS: dono só acessa o próprio agregado (LGPD, default-deny) --------------------
alter table public.plano_cas enable row level security;

create policy "plano_cas_select_own"
  on public.plano_cas for select to authenticated using (auth.uid() = user_id);
create policy "plano_cas_insert_own"
  on public.plano_cas for insert to authenticated with check (auth.uid() = user_id);
create policy "plano_cas_update_own"
  on public.plano_cas for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "plano_cas_delete_own"
  on public.plano_cas for delete to authenticated using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- RPC ATÔMICA — a garantia final da corrida (compare-and-swap real)
-- ----------------------------------------------------------------------------
-- Retorna um jsonb DISCRIMINADO:
--   { tipo: 'COMMIT_CONFIRMADO', source_revision, committed_revision, formula_version,
--     canonical_input_hash }
--   { tipo: 'CONFLITO_REVISAO', expected_revision, actual_revision }
-- `security invoker`: a RLS do chamador vale (o dono só commita o próprio agregado).
-- `SELECT ... FOR UPDATE` serializa concorrentes na MESMA linha; o `WHERE revision =
-- expected` no UPDATE é a trava final: zero linhas ⇒ conflito, nunca sucesso.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.commit_plano_cas(
  p_aggregate_id         text,
  p_user_id              uuid,
  p_expected_revision    integer,
  p_formula_version      text,
  p_canonical_input_hash text,
  p_payload              jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_current_rev integer;
  v_new_rev     integer;
begin
  if p_expected_revision is null or p_expected_revision < 0 then
    return jsonb_build_object('tipo', 'CONFLITO_REVISAO',
      'expected_revision', p_expected_revision, 'actual_revision', null);
  end if;

  -- trava a linha do agregado (se existir) para serializar concorrentes.
  select revision into v_current_rev
    from public.plano_cas where aggregate_id = p_aggregate_id for update;

  if not found then
    -- primeiro commit: só aceita expected_revision = 0.
    if p_expected_revision <> 0 then
      return jsonb_build_object('tipo', 'CONFLITO_REVISAO',
        'expected_revision', p_expected_revision, 'actual_revision', 0);
    end if;
    insert into public.plano_cas(aggregate_id, user_id, revision, formula_version, canonical_input_hash, payload)
      values (p_aggregate_id, p_user_id, 1, p_formula_version, p_canonical_input_hash, p_payload);
    return jsonb_build_object('tipo', 'COMMIT_CONFIRMADO',
      'source_revision', 0, 'committed_revision', 1,
      'formula_version', p_formula_version, 'canonical_input_hash', p_canonical_input_hash);
  end if;

  -- revisão obsoleta ⇒ conflito, nada é persistido.
  if v_current_rev <> p_expected_revision then
    return jsonb_build_object('tipo', 'CONFLITO_REVISAO',
      'expected_revision', p_expected_revision, 'actual_revision', v_current_rev);
  end if;

  v_new_rev := p_expected_revision + 1;
  -- 🔒 a troca ATÔMICA: só confirma se a revisão AINDA é a esperada.
  update public.plano_cas
     set revision = v_new_rev, formula_version = p_formula_version,
         canonical_input_hash = p_canonical_input_hash, payload = p_payload, updated_at = now()
   where aggregate_id = p_aggregate_id and revision = p_expected_revision;

  if not found then
    -- zero linhas ⇒ conflito (NUNCA sucesso), mesmo que o SELECT tenha lido igual.
    return jsonb_build_object('tipo', 'CONFLITO_REVISAO',
      'expected_revision', p_expected_revision,
      'actual_revision', (select revision from public.plano_cas where aggregate_id = p_aggregate_id));
  end if;

  return jsonb_build_object('tipo', 'COMMIT_CONFIRMADO',
    'source_revision', p_expected_revision, 'committed_revision', v_new_rev,
    'formula_version', p_formula_version, 'canonical_input_hash', p_canonical_input_hash);
end;
$$;

-- Nota de legado (B1.14, fora do C1): agregados legados NÃO têm linha em `plano_cas`.
-- O primeiro uso do C1 recomputa e grava (expected_revision = 0 ⇒ COMMIT_CONFIRMADO rev 1).
-- Nenhum plano antigo é transformado por esta migração.
