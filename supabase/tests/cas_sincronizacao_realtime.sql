-- C1.1-E — prova local da notificação privada: somente revisão, tópico do dono e sem EXECUTE externo.
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000002';
  v_aggregate_id text := '00000000-0000-0000-0000-000000000002:plano';
  v_revisao integer;
  v_topic text;
  v_event text;
  v_payload jsonb;
  v_private boolean;
  v_visiveis integer;
begin
  truncate public.realtime_test_outbox;

  update public.plano_cas
     set revision = revision + 1
   where aggregate_id = v_aggregate_id
   returning revision into v_revisao;

  assert v_revisao = 2, 'o fixture C1.1-C deve existir antes da prova de Realtime';

  select topic, event, payload, private
    into v_topic, v_event, v_payload, v_private
    from public.realtime_test_outbox;

  assert v_topic = 'user:' || v_user::text || ':plano', 'o tópico precisa pertencer ao usuário dono';
  assert v_event = 'plano_atualizado', 'o cliente só escuta o evento de revisão';
  assert v_payload = jsonb_build_object('revision', v_revisao), 'o broadcast não pode carregar perfil ou plano';
  assert v_private, 'o broadcast deve ser privado';

  assert exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'c1_usuario_recebe_revisao_do_proprio_plano'
      and cmd = 'SELECT'
  ), 'a assinatura privada precisa de policy de leitura';

  -- Não basta a policy existir: no harness, exercitamos seu predicado com o mesmo JWT.
  -- O papel authenticated enxerga a mensagem de autorização no tópico próprio, mas não no de
  -- outro usuário. A concessão SELECT necessária para este teste fica só no prelude local.
  truncate realtime.messages;
  insert into realtime.messages(extension, topic) values ('broadcast', 'fixture');
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('realtime.topic', 'user:' || v_user::text || ':plano', true);
  execute 'set local role authenticated';
  select count(*) into v_visiveis from realtime.messages;
  execute 'reset role';
  assert v_visiveis = 1, 'o dono deve autorizar somente seu tópico privado';

  perform set_config('realtime.topic', 'user:00000000-0000-0000-0000-000000000003:plano', true);
  execute 'set local role authenticated';
  select count(*) into v_visiveis from realtime.messages;
  execute 'reset role';
  assert v_visiveis = 0, 'o dono não pode autorizar o tópico de outro usuário';

  assert not has_function_privilege('authenticated', 'public.notificar_revisao_do_plano()', 'execute'),
    'o browser não pode emitir a notificação diretamente';

  raise notice 'C1.1-E Realtime: revisão privada e permissões mínimas passaram.';
end $$;
