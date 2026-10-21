-- CANDIDATA LOCAL. NÃO APLICADA AO SUPABASE REAL.
-- Revisar ACLs e ensaiar migração/rollback antes de qualquer autorização de aplicação.
-- Não exclui usuários nem históricos. Não importa localStorage legado.
begin;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
create table app_private.sync_recibos (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  command_hash text not null check (command_hash ~ '^[0-9a-f]{64}$'),
  resultado jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
create table app_private.sync_rascunho (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null check (revision > 0),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
revoke all on all tables in schema app_private from public, anon, authenticated;
-- Aborta diante de duplicata prévia: inspeção/deduplicação de dados reais requer revisão
-- e autorização própria. Nunca escolher silenciosamente qual sessão apagar.
create unique index logs_treino_identidade_unica on public.logs(user_id, (payload->>'id'))
  where tipo = 'treino' and payload->>'id' is not null;
create index logs_paginacao_por_conta on public.logs(user_id,tipo,created_at,id);
create index plano_cas_por_conta on public.plano_cas(user_id);

create or replace function public.commit_plano_cas(
  p_aggregate_id         text,
  p_user_id              uuid,
  p_email                 text,
  p_expected_revision    integer,
  p_formula_version      text,
  p_canonical_input_hash text,
  p_payload              jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := p_user_id;
  v_atual integer;
  v_nova integer;
  v_linha jsonb;
  v_email text := nullif(p_email, '');
begin
  -- A RPC só é executável por `service_role`; a rota já autenticou o usuário e injeta o id.
  -- Mesmo assim, a identidade do agregado é derivada, nunca aceita como texto arbitrário.
  if v_user_id is null then
    raise exception 'usuário do agregado ausente' using errcode = '22023';
  end if;
  if p_aggregate_id is distinct from (v_user_id::text || ':plano') then
    raise exception 'aggregate_id não pertence ao usuário autenticado' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'revisão esperada inválida' using errcode = '22023';
  end if;
  if p_formula_version is null or p_formula_version !~ '^tempo-v[0-9]+$' then
    raise exception 'versão de fórmula inválida' using errcode = '22023';
  end if;
  if p_canonical_input_hash is null or p_canonical_input_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash canônico SHA-256 inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(p_payload->'perfilLinha') <> 'object'
     or jsonb_typeof(p_payload->'entrada') <> 'object'
     or p_payload->'dieta' is null or p_payload->'treino' is null then
    raise exception 'agregado C1 inválido' using errcode = '22023';
  end if;
  v_linha := p_payload->'perfilLinha';

  -- INSERT ... ON CONFLICT elimina a corrida da linha ainda inexistente: quem perde recebe
  -- conflito discriminado, jamais erro de chave única nem confirmação simulada.
  if p_expected_revision = 0 then
    insert into public.plano_cas(aggregate_id, user_id, revision, formula_version, canonical_input_hash, payload)
      values (p_aggregate_id, v_user_id, 1, p_formula_version, p_canonical_input_hash, p_payload)
      on conflict (aggregate_id) do nothing
      returning revision into v_nova;
    if not found then
      select revision into v_atual from public.plano_cas where aggregate_id = p_aggregate_id;
      return jsonb_build_object('tipo', 'CONFLITO_REVISAO', 'expected_revision', 0, 'actual_revision', coalesce(v_atual, 0));
    end if;
  else
    update public.plano_cas
       set revision = p_expected_revision + 1,
           formula_version = p_formula_version,
           canonical_input_hash = p_canonical_input_hash,
           payload = p_payload,
           updated_at = now()
     where aggregate_id = p_aggregate_id
       and user_id = v_user_id
       and revision = p_expected_revision
     returning revision into v_nova;
    if not found then
      select revision into v_atual from public.plano_cas where aggregate_id = p_aggregate_id;
      return jsonb_build_object('tipo', 'CONFLITO_REVISAO', 'expected_revision', p_expected_revision, 'actual_revision', coalesce(v_atual, 0));
    end if;
  end if;

  -- Perfil e snapshots são pós-CAS, porém na mesma transação: erro de shape/CHECK/insert
  -- desfaz inclusive o incremento de revisão, sem estado parcial.
  insert into public.profile(
    id, email, sexo, peso_kg, altura_cm, idade, nivel_atividade, objetivo,
    gestacao_amamentacao, renal, cardiaca, lesao, diabetes,
    preferencia_alimentar, alergenos, preferencias,
    aceite_18, aceite_termos, aceite_lgpd, aceite_em
  ) values (
    v_user_id,
    v_email,
    v_linha->>'sexo', (v_linha->>'peso_kg')::numeric, (v_linha->>'altura_cm')::numeric,
    (v_linha->>'idade')::integer, v_linha->>'nivel_atividade', v_linha->>'objetivo',
    coalesce((v_linha->>'gestacao_amamentacao')::boolean, false),
    coalesce((v_linha->>'renal')::boolean, false),
    coalesce((v_linha->>'cardiaca')::boolean, false),
    coalesce((v_linha->>'lesao')::boolean, false),
    coalesce((v_linha->>'diabetes')::boolean, false),
    v_linha->>'preferencia_alimentar',
    array(select jsonb_array_elements_text(coalesce(v_linha->'alergenos', '[]'::jsonb))),
    coalesce(v_linha->'preferencias', '{}'::jsonb),
    coalesce((v_linha->>'aceite_18')::boolean, false),
    coalesce((v_linha->>'aceite_termos')::boolean, false),
    coalesce((v_linha->>'aceite_lgpd')::boolean, false),
    nullif(v_linha->>'aceite_em', '')::timestamptz
  ) on conflict (id) do update set
    email = coalesce(excluded.email, profile.email),
    sexo = excluded.sexo, peso_kg = excluded.peso_kg, altura_cm = excluded.altura_cm,
    idade = excluded.idade, nivel_atividade = excluded.nivel_atividade, objetivo = excluded.objetivo,
    gestacao_amamentacao = excluded.gestacao_amamentacao, renal = excluded.renal,
    cardiaca = excluded.cardiaca, lesao = excluded.lesao, diabetes = excluded.diabetes,
    preferencia_alimentar = excluded.preferencia_alimentar, alergenos = excluded.alergenos,
    preferencias = excluded.preferencias,
    aceite_18 = coalesce((v_linha->>'aceite_18')::boolean, profile.aceite_18),
    aceite_termos = coalesce((v_linha->>'aceite_termos')::boolean, profile.aceite_termos),
    aceite_lgpd = coalesce((v_linha->>'aceite_lgpd')::boolean, profile.aceite_lgpd),
    aceite_em = coalesce(nullif(v_linha->>'aceite_em', '')::timestamptz, profile.aceite_em);

  -- v2: agregado atual único; definições atual/anterior no envelope. Sem snapshots por autosave.

  return jsonb_build_object(
    'tipo', 'COMMIT_CONFIRMADO',
    'source_revision', p_expected_revision,
    'committed_revision', v_nova,
    'formula_version', p_formula_version,
    'canonical_input_hash', p_canonical_input_hash
  );
end;
$$;


-- Mescla mapas rasos de refeições dentro da mesma transação e lock de conta.
create function app_private.mesclar_mapa(b jsonb, l jsonb, s jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare k text; r jsonb := coalesce(s, '{}'::jsonb);
begin
  for k in select jsonb_object_keys(coalesce(b,'{}') || coalesce(l,'{}')) loop
    if (l->k) is not distinct from (b->k) then continue; end if;
    if (s->k) is distinct from (b->k) and (s->k) is distinct from (l->k) then return null; end if;
    if l ? k then r := jsonb_set(r, array[k], l->k); else r := r - k; end if;
  end loop;
  return r;
end $$;
revoke all on function app_private.mesclar_mapa(jsonb,jsonb,jsonb) from public, anon, authenticated;

create function public.executar_comando_sync_v2(
  p_user_id uuid, p_email text, p_operation_id uuid, p_hash text, p_tipo text,
  p_payload jsonb, p_preparado jsonb, p_erro text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_rec app_private.sync_recibos%rowtype; v_result jsonb; v_atual public.plano_cas%rowtype;
  v_existe boolean; v_payload jsonb; v_logs jsonb; v_notes jsonb; v_kg numeric; v_revision integer;
  v_expected integer; v_dia date; v_sessao jsonb; v_antiga jsonb; v_dependencia jsonb;
begin
  if p_user_id is null or p_operation_id is null or p_hash !~ '^[0-9a-f]{64}$'
     or not exists(select 1 from auth.users where id = p_user_id) then
    raise exception 'identidade/comando invalido' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('evk-sync:' || p_user_id::text, 0));
  select * into v_rec from app_private.sync_recibos where user_id=p_user_id and operation_id=p_operation_id;
  if found then
    if v_rec.command_hash <> p_hash then
      return jsonb_build_object('tipo','RECUSADO','operationId',p_operation_id,'motivo','operation_id_reutilizado');
    end if;
    return v_rec.resultado;
  end if;
  if p_payload ? 'dependsOn' then
    select resultado into v_dependencia from app_private.sync_recibos where user_id=p_user_id and operation_id=(p_payload->>'dependsOn')::uuid;
    if not found then raise exception 'dependencia_nao_confirmada'; end if;
    if v_dependencia->>'tipo' <> 'ACK' then
      v_result := jsonb_build_object('tipo','CONFLITO','operationId',p_operation_id,'motivo','base_dependencia_mudou');
      insert into app_private.sync_recibos(user_id,operation_id,command_hash,resultado) values(p_user_id,p_operation_id,p_hash,v_result);
      return v_result;
    end if;
  end if;
  if p_tipo in ('PERFIL','APLICAR_TREINO','DESFAZER_TREINO') then
    select * into v_atual from public.plano_cas where user_id=p_user_id and aggregate_id=p_user_id::text || ':plano';
    v_existe := found;
    -- O agregado foi preparado sobre esta revisão; ACK de dependência não a substitui.
    v_expected := coalesce((p_preparado->>'sourceRevision')::integer,(p_payload->>'expectedRevision')::integer);
    if coalesce(v_atual.revision,0) <> v_expected then
      v_result := jsonb_build_object('tipo','CONFLITO','motivo','revisao','revision',coalesce(v_atual.revision,0));
    elsif p_erro is not null or p_preparado is null then
      v_result := jsonb_build_object('tipo','CONFLITO','motivo',coalesce(p_erro,'validacao_conjunta'));
    elsif v_existe and v_atual.payload = p_preparado->'agregado' then
      v_result := jsonb_build_object('tipo','ACK','revision',v_atual.revision,'semMudanca',true);
    else
      v_result := public.commit_plano_cas(p_user_id::text || ':plano', p_user_id, p_email,
        v_expected, p_preparado->>'formulaVersion', p_preparado->>'canonicalInputHash', p_preparado->'agregado');
      if v_result->>'tipo' = 'COMMIT_CONFIRMADO' then
        v_result := jsonb_build_object('tipo','ACK','revision',(v_result->>'committed_revision')::integer);
      elsif v_result->>'tipo' = 'CONFLITO_REVISAO' then
        v_result := jsonb_build_object('tipo','CONFLITO','motivo','revisao','revision',v_result->'actual_revision');
      else raise exception 'commit sem confirmacao'; end if;
    end if;
  elsif p_tipo = 'SESSAO' then
    v_sessao := p_payload->'sessao';
    if coalesce(v_sessao->>'id','') = '' then raise exception 'sessao sem identidade'; end if;
    select payload into v_antiga from public.logs where user_id=p_user_id and tipo='treino' and payload->>'id'=v_sessao->>'id';
    if found and v_antiga is distinct from v_sessao and v_antiga is distinct from p_payload->'substituirBase' then
      v_result := jsonb_build_object('tipo','CONFLITO','motivo','sessao_alterada');
    else
      if v_antiga is distinct from v_sessao then
        if v_antiga is null then
          insert into public.logs(user_id,tipo,data,payload) values(p_user_id,'treino',(v_sessao->>'dataISO')::date,v_sessao);
        else
          -- Somente resolução explícita com base exata. Sessão alterada entre escolha e
          -- commit volta a conflitar; não há substituição cega de fatos realizados.
          update public.logs set data=(v_sessao->>'dataISO')::date,payload=v_sessao
            where user_id=p_user_id and tipo='treino' and payload->>'id'=v_sessao->>'id';
          delete from public.feedback where user_id=p_user_id and payload->>'sessaoId'=v_sessao->>'id';
        end if;
        if jsonb_typeof(v_sessao->'feedback')='object' and v_sessao->'feedback' <> '{}'::jsonb then
          insert into public.feedback(user_id,contexto,payload) values(p_user_id,'treino',
            jsonb_build_object('sessaoId',v_sessao->>'id','n',v_sessao->'n','dataISO',v_sessao->'dataISO','feedback',v_sessao->'feedback'));
        end if;
      end if;
      delete from app_private.sync_rascunho where user_id=p_user_id and payload->>'sessaoId'=v_sessao->>'id';
      v_result := jsonb_build_object('tipo','ACK','revision',0);
    end if;
  elsif p_tipo = 'PESO' then
    v_dia := (p_payload->>'dataISO')::date; v_kg := (p_payload->>'pesoKg')::numeric;
    insert into public.logs(user_id,tipo,data,payload) values(p_user_id,'peso',v_dia,jsonb_build_object('pesoKg',v_kg))
      on conflict (user_id,tipo,data) where tipo='peso' do nothing;
    v_existe := found;
    select (payload->>'pesoKg')::numeric into v_kg from public.logs where user_id=p_user_id and tipo='peso' and data=v_dia;
    if v_kg = (p_payload->>'pesoKg')::numeric then
      v_result := jsonb_build_object('tipo','ACK','estado',case when v_existe then 'REGISTRADO' else 'IDEMPOTENTE' end,'pesoKg',v_kg);
    else v_result := jsonb_build_object('tipo','RECUSADO','motivo','peso_ja_registrado_hoje','pesoKg',v_kg); end if;
  elsif p_tipo = 'ADERENCIA' then
    v_dia := (p_payload->>'dia')::date;
    select payload into v_antiga from public.logs where user_id=p_user_id and tipo='refeicao' and data=v_dia for update;
    v_antiga := coalesce(v_antiga, '{"logs":{},"notes":{}}'::jsonb);
    v_logs := app_private.mesclar_mapa(p_payload->'base'->'logs',p_payload->'logs',v_antiga->'logs');
    v_notes := app_private.mesclar_mapa(p_payload->'base'->'notes',p_payload->'notes',v_antiga->'notes');
    if v_logs is null or v_notes is null then v_result := jsonb_build_object('tipo','CONFLITO','motivo','refeicao_alterada');
    else
      v_payload := jsonb_build_object('logs',v_logs,'notes',v_notes);
      insert into public.logs(user_id,tipo,data,payload) values(p_user_id,'refeicao',v_dia,v_payload)
        on conflict(user_id,tipo,data) where tipo='refeicao' do update set payload=excluded.payload;
      v_result := jsonb_build_object('tipo','ACK');
    end if;
  elsif p_tipo = 'RASCUNHO_SESSAO' then
    select revision,payload into v_revision,v_antiga from app_private.sync_rascunho where user_id=p_user_id;
    v_expected := coalesce((p_preparado->>'sourceRevision')::integer,(p_payload->>'expectedRevision')::integer);
    if exists(select 1 from public.logs where user_id=p_user_id and tipo='treino'
        and payload->>'id'=coalesce(p_preparado->'estado',p_payload->'estado')->>'sessaoId') then
      v_result := jsonb_build_object('tipo','RECUSADO','motivo','sessao_encerrada');
    elsif coalesce(v_revision,0) <> v_expected then
      v_result := jsonb_build_object('tipo','CONFLITO','motivo','rascunho_alterado','revision',coalesce(v_revision,0));
    elsif p_erro is not null then
      v_result := jsonb_build_object('tipo','CONFLITO','motivo',p_erro,'revision',coalesce(v_revision,0));
    elsif v_antiga = coalesce(p_preparado->'estado',p_payload->'estado') then
      v_result := jsonb_build_object('tipo','ACK','revision',v_revision,'semMudanca',true);
    else
      insert into app_private.sync_rascunho(user_id,revision,payload) values(p_user_id,v_expected+1,coalesce(p_preparado->'estado',p_payload->'estado'))
        on conflict(user_id) do update set revision=excluded.revision,payload=excluded.payload,updated_at=now();
      v_result := jsonb_build_object('tipo','ACK','revision',v_expected+1);
    end if;
  else raise exception 'tipo de comando invalido'; end if;
  v_result := v_result || jsonb_build_object('operationId',p_operation_id);
  insert into app_private.sync_recibos(user_id,operation_id,command_hash,resultado) values(p_user_id,p_operation_id,p_hash,v_result);
  return v_result;
end $$;
revoke all on function public.executar_comando_sync_v2(uuid,text,uuid,text,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.executar_comando_sync_v2(uuid,text,uuid,text,text,jsonb,jsonb,text) to service_role;

create function public.ler_rascunho_sync_v2(p_user_id uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('revision',revision,'estado',payload) from app_private.sync_rascunho where user_id=p_user_id
$$;
revoke all on function public.ler_rascunho_sync_v2(uuid) from public, anon, authenticated;
grant execute on function public.ler_rascunho_sync_v2(uuid) to service_role;

-- Portabilidade também inclui os metadados/recibos vinculados à pessoa, em páginas.
create function public.exportar_recibos_sync_v2(p_user_id uuid, p_after uuid, p_limite timestamptz) returns jsonb
language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(t order by t.operation_id), '[]'::jsonb)
  from (
    select operation_id, command_hash, resultado, created_at
    from app_private.sync_recibos
    where user_id = p_user_id and created_at <= p_limite
      and (p_after is null or operation_id > p_after)
    order by operation_id limit 500
  ) t
$$;
revoke all on function public.exportar_recibos_sync_v2(uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.exportar_recibos_sync_v2(uuid,uuid,timestamptz) to service_role;
-- Uma revisão por conta, atualizada NA MESMA transação de qualquer seção exportada.
-- Permite repetir uma leitura paginada concorrente sem guardar cópias da exportação.
create table app_private.sync_export_revision (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0
);
alter table app_private.sync_export_revision enable row level security;
revoke all on app_private.sync_export_revision from public, anon, authenticated;

create function app_private.marcar_exportacao_alterada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare anterior uuid; posterior uuid; dono uuid;
begin
  if tg_op <> 'INSERT' then
    anterior := (case when tg_table_name='profile' then to_jsonb(old)->>'id' else to_jsonb(old)->>'user_id' end)::uuid;
  end if;
  if tg_op <> 'DELETE' then
    posterior := (case when tg_table_name='profile' then to_jsonb(new)->>'id' else to_jsonb(new)->>'user_id' end)::uuid;
  end if;
  for dono in select distinct x from unnest(array[anterior,posterior]) x where x is not null loop
    -- Cascata de exclusão da identidade não recria metadados nem impede sua remoção.
    if exists(select 1 from auth.users where id=dono) then
      insert into app_private.sync_export_revision(user_id,revision) values(dono,1)
        on conflict(user_id) do update set revision=app_private.sync_export_revision.revision+1;
    end if;
  end loop;
  return null;
end $$;
revoke all on function app_private.marcar_exportacao_alterada() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['profile','plans','logs','feedback','subscription','eventos','plano_cas'] loop
    execute format('create trigger sync_export_revision after insert or update or delete on public.%I for each row execute function app_private.marcar_exportacao_alterada()',t);
  end loop;
  foreach t in array array['sync_rascunho','sync_recibos'] loop
    execute format('create trigger sync_export_revision after insert or update or delete on app_private.%I for each row execute function app_private.marcar_exportacao_alterada()',t);
  end loop;
end $$;
create function public.ler_revisao_exportacao_sync_v2(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('subject',u.id,'revision',coalesce(r.revision,0)::text)
  from auth.users u left join app_private.sync_export_revision r on r.user_id=u.id
  where u.id=p_user_id
$$;
revoke all on function public.ler_revisao_exportacao_sync_v2(uuid) from public, anon, authenticated;
grant execute on function public.ler_revisao_exportacao_sync_v2(uuid) to service_role;
commit;
