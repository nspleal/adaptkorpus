-- Uma linha de aderência por usuário/dia; treino continua permitindo várias sessões.
-- Duplicatas legadas exigem revisão separada: esta migration não escolhe nem apaga dados.
do $$
begin
  if exists (
    select 1 from public.logs where tipo = 'refeicao'
    group by user_id, data having count(*) > 1
  ) then
    raise exception 'aderencia_duplicada_requer_revisao' using errcode = '23505';
  end if;
end;
$$;

create unique index if not exists logs_refeicao_por_dia_unico
  on public.logs (user_id, tipo, data)
  where tipo = 'refeicao';

-- PostgREST on_conflict só informa colunas. O índice parcial exige o predicado no SQL.
-- SECURITY INVOKER mantém as permissões/RLS do chamador; identidade vem do JWT.
create or replace function public.registrar_aderencia_dia(p_dia date, p_payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'autenticacao_obrigatoria' using errcode = '42501';
  end if;
  insert into public.logs (user_id, tipo, data, payload)
  values (v_user_id, 'refeicao', p_dia, p_payload)
  on conflict (user_id, tipo, data) where tipo = 'refeicao'
  do update set payload = excluded.payload;
end;
$$;

revoke all on function public.registrar_aderencia_dia(date, jsonb) from public;
grant execute on function public.registrar_aderencia_dia(date, jsonb) to authenticated;
