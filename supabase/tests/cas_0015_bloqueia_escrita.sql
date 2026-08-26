-- C1.1 · a migration 0015 não pode abrir um escritor transitório no browser.
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000001';
begin
  perform set_config('request.jwt.claim.sub', v_user::text, true);

  begin
    execute 'set local role authenticated';
    insert into public.plano_cas(aggregate_id, user_id, revision, formula_version, canonical_input_hash, payload)
      values (v_user::text || ':plano', v_user, 1, 'tempo-v1', '0000000000000001', '{}'::jsonb);
    raise exception 'DML direto deveria ser negado já na 0015';
  exception when insufficient_privilege then
    execute 'reset role';
  end;

  begin
    execute 'set local role authenticated';
    perform public.commit_plano_cas(
      v_user::text || ':plano',
      v_user,
      0,
      'tempo-v1',
      '0000000000000001',
      '{}'::jsonb
    );
    raise exception 'RPC histórica deveria ser negada já na 0015';
  exception when insufficient_privilege then
    execute 'reset role';
  end;

  raise notice 'C1.1: 0015 não expõe escritor transitório ao browser.';
end $$;
