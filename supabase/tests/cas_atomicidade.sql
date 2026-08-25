-- ════════════════════════════════════════════════════════════════════════════
-- C1 · CAS — teste de ATOMICIDADE contra Postgres REAL (decisão do autor "CAS PERSISTENTE").
-- Exercita a RPC `commit_plano_cas` da migração 0015 no motor de fato (Postgres 16, o mesmo do
-- Supabase). Roda via `supabase/tests/run-cas-test.sh`. Usa `assert` do plpgsql: qualquer falha
-- aborta com erro (exit != 0). Cobre: primeiro commit (legado→rev 1), 7→8, CONFLITO_REVISAO,
-- zero-linhas-nunca-vira-sucesso, retry recompute 8→9, tudo-ou-nada (payload+revisão juntos).
-- ════════════════════════════════════════════════════════════════════════════

-- Ordem aplicada pelo runner: schema mínimo → 0015_c1_cas_metadata.sql → este arquivo → 0016.
do $$
declare
  r jsonb;
  v_user uuid := '00000000-0000-0000-0000-000000000001';
  v_agg text := '00000000-0000-0000-0000-000000000001:plano';
  v_rev integer;
  v_payload jsonb;
begin
  -- ── 1. LEGADO → primeiro commit: sem linha (rev 0), expected 0 ⇒ COMMIT_CONFIRMADO rev 1 ──
  r := public.commit_plano_cas(v_agg, v_user, 0, 'tempo-v1', '00000000abcdef01', '{"n":1}'::jsonb);
  assert r->>'tipo' = 'COMMIT_CONFIRMADO', format('1: esperava COMMIT_CONFIRMADO, veio %s', r);
  assert (r->>'committed_revision')::int = 1, format('1: esperava rev 1, veio %s', r);

  -- primeiro commit com expected != 0 (linha inexistente) ⇒ CONFLITO_REVISAO
  r := public.commit_plano_cas(v_agg || ':outro', v_user, 5, 'tempo-v1', '00000000abcdef02', '{}'::jsonb);
  assert r->>'tipo' = 'CONFLITO_REVISAO', format('1b: esperava CONFLITO_REVISAO, veio %s', r);

  -- ── 2. Revisão 7 → 8 ────────────────────────────────────────────────────────────────────
  update public.plano_cas set revision = 7 where aggregate_id = v_agg; -- simula estado atual = 7
  r := public.commit_plano_cas(v_agg, v_user, 7, 'tempo-v1', '00000000abcdef07', '{"n":7}'::jsonb);
  assert r->>'tipo' = 'COMMIT_CONFIRMADO', format('2: esperava COMMIT_CONFIRMADO, veio %s', r);
  assert (r->>'committed_revision')::int = 8, format('2: esperava rev 8, veio %s', r);
  select revision, payload into v_rev, v_payload from public.plano_cas where aggregate_id = v_agg;
  assert v_rev = 8, '2: revisão persistida deveria ser 8';
  assert v_payload = '{"n":7}'::jsonb, '2: tudo-ou-nada — payload e revisão persistem JUNTOS';

  -- ── 3. CONFLITO_REVISAO: estado atual virou 8; commit com expected 7 ⇒ conflito, nada muda ─
  select payload into v_payload from public.plano_cas where aggregate_id = v_agg; -- snapshot antes
  r := public.commit_plano_cas(v_agg, v_user, 7, 'tempo-v1', '00000000deadbeef', '{"n":999}'::jsonb);
  assert r->>'tipo' = 'CONFLITO_REVISAO', format('3: esperava CONFLITO_REVISAO, veio %s', r);
  assert (r->>'expected_revision')::int = 7 and (r->>'actual_revision')::int = 8, format('3: discriminação errada %s', r);
  -- zero-linhas-NUNCA-vira-sucesso: nada foi persistido.
  select revision, payload into v_rev, v_payload from public.plano_cas where aggregate_id = v_agg;
  assert v_rev = 8, '3: revisão NÃO pode ter mudado';
  assert v_payload = '{"n":7}'::jsonb, '3: payload NÃO pode ter mudado (conflito não persiste parcial)';

  -- ── 4. Retry: recarrega snapshot (rev 8) e recomputa ⇒ COMMIT_CONFIRMADO rev 9 ────────────
  select revision into v_rev from public.plano_cas where aggregate_id = v_agg;
  r := public.commit_plano_cas(v_agg, v_user, v_rev, 'tempo-v1', '00000000abcdef09', '{"n":9}'::jsonb);
  assert r->>'tipo' = 'COMMIT_CONFIRMADO', format('4: esperava COMMIT_CONFIRMADO, veio %s', r);
  assert (r->>'committed_revision')::int = 9, format('4: esperava rev 9, veio %s', r);

  raise notice 'CAS atomicidade: TODOS os cenários passaram (rev final = 9).';
end $$;
