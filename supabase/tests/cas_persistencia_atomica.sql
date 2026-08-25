-- C1.1-C — prova em Postgres real: perfil + CAS + snapshots têm um destino transacional.
do $$
declare
  r jsonb;
  -- Identidade própria: este arquivo roda depois de `cas_atomicidade.sql` no mesmo banco.
  v_user uuid := '00000000-0000-0000-0000-000000000002';
  v_agg text := '00000000-0000-0000-0000-000000000002:plano';
  v_linha jsonb := '{
    "sexo":"masculino","peso_kg":80,"altura_cm":180,"idade":30,
    "nivel_atividade":"moderado","objetivo":"massa",
    "gestacao_amamentacao":false,"renal":false,"cardiaca":false,"lesao":false,"diabetes":false,
    "preferencia_alimentar":null,"alergenos":[],
    "preferencias":{"nivelExperiencia":"avancado","equipamento":"academia","treinoDias":["seg"],"diasDisponiveis":1,"tempoPorSessaoMin":60,"naoCurto":[],"favoritos":[],"pratosCansados":[]}
  }'::jsonb;
  v_payload jsonb;
  v_revisao integer;
  v_peso numeric;
  v_email text;
  v_planos integer;
begin
  -- O teste possui seu próprio usuário: não depende da ordem nem do fixture de outro arquivo.
  insert into auth.users(id) values (v_user) on conflict (id) do nothing;
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.email', 'teste@example.com', true);
  v_payload := jsonb_build_object(
    'perfilLinha', v_linha,
    'entrada', jsonb_build_object('perfil', jsonb_build_object('pesoKg', 80), 'opcoes', jsonb_build_object('pesoEfetivoKg', 79, 'diasOferecidosCardio', jsonb_build_array('qua'), 'semanaCiclo', jsonb_build_object('semana', 2, 'feedbackGrupos', jsonb_build_array()), 'escolhasExecucao', jsonb_build_array())),
    'dieta', jsonb_build_object('tipo', 'dieta-teste'),
    'treino', jsonb_build_object('tipo', 'treino-teste')
  );

  r := public.commit_plano_cas(v_agg, v_user, 'teste@example.com', 0, 'tempo-v4', '1111111111111111', v_payload);
  assert r->>'tipo' = 'COMMIT_CONFIRMADO', format('primeiro commit: %s', r);
  assert (r->>'committed_revision')::integer = 1, format('revisão inicial: %s', r);
  select revision into v_revisao from public.plano_cas where aggregate_id = v_agg;
  select peso_kg into v_peso from public.profile where id = v_user;
  select email into v_email from public.profile where id = v_user;
  select count(*) into v_planos from public.plans where user_id = v_user and ativo;
  assert v_revisao = 1 and v_peso = 80 and v_email = 'teste@example.com' and v_planos = 2,
    'perfil (inclusive e-mail), CAS e os dois snapshots devem entrar juntos';

  -- Conflito não escreve nem perfil, nem plano, nem payload/revisão.
  v_payload := jsonb_set(v_payload, '{perfilLinha,peso_kg}', '91'::jsonb);
  r := public.commit_plano_cas(v_agg, v_user, 'teste@example.com', 0, 'tempo-v4', '2222222222222222', v_payload);
  assert r->>'tipo' = 'CONFLITO_REVISAO', format('conflito esperado: %s', r);
  select revision into v_revisao from public.plano_cas where aggregate_id = v_agg;
  select peso_kg into v_peso from public.profile where id = v_user;
  select count(*) into v_planos from public.plans where user_id = v_user;
  assert v_revisao = 1 and v_peso = 80 and v_planos = 2, 'conflito não pode deixar escrita parcial';

  -- Uma falha depois do CAS (CHECK de peso) reverte também o CAS e os snapshots.
  begin
    v_payload := jsonb_set(v_payload, '{perfilLinha,peso_kg}', '1'::jsonb);
    perform public.commit_plano_cas(v_agg, v_user, 'teste@example.com', 1, 'tempo-v4', '3333333333333333', v_payload);
    raise exception 'esperava CHECK de peso';
  exception when check_violation then null;
  end;
  select revision into v_revisao from public.plano_cas where aggregate_id = v_agg;
  select peso_kg into v_peso from public.profile where id = v_user;
  select count(*) into v_planos from public.plans where user_id = v_user;
  assert v_revisao = 1 and v_peso = 80 and v_planos = 2, 'falha atômica não pode vazar CAS/perfil/plano';

  -- DML e RPC diretos do browser foram removidos; só o serviço do servidor é escritor.
  begin
    execute 'set local role authenticated';
    insert into public.plano_cas(aggregate_id, user_id, revision, formula_version, canonical_input_hash, payload)
      values ('direto', v_user, 1, 'tempo-v4', '4444444444444444', '{}'::jsonb);
    raise exception 'DML direto deveria ser negado';
  exception when insufficient_privilege then null;
  end;
  reset role;

  begin
    execute 'set local role authenticated';
    perform public.commit_plano_cas(v_agg, v_user, 'teste@example.com', 1, 'tempo-v4', '4444444444444444', v_payload);
    raise exception 'RPC direta deveria ser negada';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise notice 'C1.1-C CAS: perfil + snapshots + conflito + rollback passaram.';
end $$;
