-- Um registro de PESO por usuário/dia. Espelha a política já adotada para `refeicao`
-- (0018_aderencia_uma_linha_por_dia.sql), com UMA diferença deliberada:
--
--   · aderência  → `on conflict DO UPDATE` (o dia é um estado; a última leitura vale);
--   · peso       → `on conflict DO NOTHING` (o dia é um EVENTO; o PRIMEIRO registro vale).
--
-- Decisão do autor: "permitir somente UM registro por dia; a segunda tentativa é recusada,
-- sem substituir o primeiro registro". Recusar exige não-sobrescrever — daí o DO NOTHING.
--
-- Duplicatas legadas exigem revisão separada: esta migration NÃO escolhe nem apaga dados.
-- Se existirem, ela falha de propósito (mesmo contrato da 0018).
do $$
begin
  if exists (
    select 1 from public.logs where tipo = 'peso'
    group by user_id, data having count(*) > 1
  ) then
    raise exception 'peso_duplicado_requer_revisao' using errcode = '23505';
  end if;
end;
$$;

create unique index if not exists logs_peso_por_dia_unico
  on public.logs (user_id, tipo, data)
  where tipo = 'peso';

-- O índice é a trava real: protege contra duas abas, dois dispositivos e requisições
-- concorrentes, que nenhuma checagem de cliente alcança.
--
-- A função devolve o estado do dia DEPOIS da tentativa, para o chamador distinguir:
--   inserido = true            → primeiro registro do dia (aceito);
--   false e peso_kg = enviado  → reenvio idêntico (retry) → idempotente, não é erro;
--   false e peso_kg ≠ enviado  → segunda tentativa do dia → RECUSADA.
--
-- SECURITY INVOKER mantém RLS do chamador; a identidade vem do JWT, nunca do corpo.
-- 🔒 `p_dia` é o DIA CIVIL LOCAL da pessoa, calculado no cliente (`diaLocalISO`). O
-- `current_date` do banco é UTC e só entra como reserva para registro legado sem data.
create or replace function public.registrar_peso_dia(p_dia date, p_peso numeric)
returns table (inserido boolean, peso_kg numeric, dia date)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_dia date;
  v_inseridas int;
begin
  if v_user_id is null then
    raise exception 'autenticacao_obrigatoria' using errcode = '42501';
  end if;
  v_dia := coalesce(p_dia, current_date);

  insert into public.logs (user_id, tipo, data, payload)
  values (v_user_id, 'peso', v_dia, jsonb_build_object('pesoKg', p_peso))
  on conflict (user_id, tipo, data) where tipo = 'peso'
  do nothing;
  get diagnostics v_inseridas = row_count;

  return query
    select (v_inseridas = 1),
           (l.payload ->> 'pesoKg')::numeric,
           l.data
      from public.logs l
     where l.user_id = v_user_id and l.tipo = 'peso' and l.data = v_dia
     limit 1;
end;
$$;

revoke all on function public.registrar_peso_dia(date, numeric) from public;
grant execute on function public.registrar_peso_dia(date, numeric) to authenticated;
