-- C1.1-C — o único escritor de perfil + agregado de plano.
-- A rota autenticada monta o agregado no servidor; esta RPC o grava por CAS e, na MESMA
-- transação, atualiza o perfil e os snapshots legados. Conflito não escreve nada.

-- O cliente nunca deve conseguir contornar o compare-and-swap por DML direto.
drop policy if exists "plano_cas_insert_own" on public.plano_cas;
drop policy if exists "plano_cas_update_own" on public.plano_cas;
drop policy if exists "plano_cas_delete_own" on public.plano_cas;
revoke insert, update, delete on table public.plano_cas from public, anon, authenticated;
revoke insert, update on table public.profile from public, anon, authenticated;
revoke insert, update, delete on table public.plans from public, anon, authenticated;

-- 0015 criou a RPC de seis argumentos. Esta evolução acrescenta o e-mail da sessão como
-- argumento separado para não duplicar PII dentro do payload do plano. Em Postgres,
-- `create or replace` com aridade nova criaria SOBRECARGA e deixaria a RPC antiga exposta;
-- por isso ela é removida explicitamente antes de criar o único escritor vigente.
drop function if exists public.commit_plano_cas(text, uuid, integer, text, text, jsonb);

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

  update public.plans set ativo = false where user_id = v_user_id and ativo = true;
  insert into public.plans(user_id, tipo, payload) values
    (v_user_id, 'dieta', p_payload->'dieta'),
    (v_user_id, 'treino', p_payload->'treino');

  return jsonb_build_object(
    'tipo', 'COMMIT_CONFIRMADO',
    'source_revision', p_expected_revision,
    'committed_revision', v_nova,
    'formula_version', p_formula_version,
    'canonical_input_hash', p_canonical_input_hash
  );
end;
$$;

-- Security definer só é aceitável com busca fixa e execute mínimo explícito. O browser não
-- recebe EXECUTE: ele passa pela rota que valida sessão, perfil e entrada antes de usar service_role.
revoke all on function public.commit_plano_cas(text, uuid, text, integer, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.commit_plano_cas(text, uuid, text, integer, text, text, jsonb) to service_role;
