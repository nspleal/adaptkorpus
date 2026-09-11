-- Prova em Postgres REAL da regra "um registro de peso por usuário/dia" (migration 0019).
-- O que se prova aqui e NÃO dá para provar no cliente: a arbitragem entre duas gravações
-- (duas abas, dois dispositivos, duas requisições) é do ÍNDICE ÚNICO, não de uma checagem.
do $$
declare
  u_a constant uuid := '00000000-0000-0000-0000-000000000001';
  u_b constant uuid := '00000000-0000-0000-0000-0000000000b2';
  d   constant date := date '2026-09-11';
  r   record;
  n   int;
  violou boolean := false;
begin
  insert into auth.users(id) values (u_b) on conflict do nothing;

  -- ── usuário A ────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', u_a::text, true);

  select * into r from public.registrar_peso_dia(d, 80);
  if not r.inserido or r.peso_kg <> 80 then
    raise exception 'primeiro registro do dia deveria ser aceito (inserido=%, peso=%)', r.inserido, r.peso_kg;
  end if;

  -- segunda tentativa, peso DIFERENTE: recusa sem substituir
  select * into r from public.registrar_peso_dia(d, 74);
  if r.inserido then raise exception 'a segunda tentativa do dia NAO podia inserir'; end if;
  if r.peso_kg <> 80 then raise exception 'o primeiro registro foi substituido (peso=%)', r.peso_kg; end if;

  -- reenvio IDÊNTICO (retry): idempotente
  select * into r from public.registrar_peso_dia(d, 80);
  if r.inserido then raise exception 'retry idempotente NAO podia inserir'; end if;
  if r.peso_kg <> 80 then raise exception 'retry alterou o registro (peso=%)', r.peso_kg; end if;

  select count(*) into n from public.logs where user_id = u_a and tipo = 'peso' and data = d;
  if n <> 1 then raise exception 'esperava 1 linha no dia, achei %', n; end if;

  -- dia seguinte: aceita
  select * into r from public.registrar_peso_dia(d + 1, 79.4);
  if not r.inserido then raise exception 'o dia seguinte deveria aceitar'; end if;

  -- ── usuário B: independente ──────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', u_b::text, true);
  select * into r from public.registrar_peso_dia(d, 95);
  if not r.inserido or r.peso_kg <> 95 then
    raise exception 'outro usuario no mesmo dia deveria ser aceito';
  end if;
  select count(*) into n from public.logs where tipo = 'peso' and data = d;
  if n <> 2 then raise exception 'esperava 1 linha por usuario no dia (total 2), achei %', n; end if;

  -- ── a trava REAL: insert direto duplicado é barrado pelo índice ──────────────
  begin
    insert into public.logs (user_id, tipo, data, payload)
    values (u_b, 'peso', d, jsonb_build_object('pesoKg', 60));
  exception when unique_violation then
    violou := true;
  end;
  if not violou then
    raise exception 'o indice unico NAO barrou a duplicata — a trava nao existe';
  end if;

  -- ── o que a regra NAO toca: outros tipos seguem com varias linhas por dia ────
  insert into public.logs (user_id, tipo, data, payload) values (u_b, 'treino', d, '{}'::jsonb);
  insert into public.logs (user_id, tipo, data, payload) values (u_b, 'treino', d, '{}'::jsonb);
  select count(*) into n from public.logs where user_id = u_b and tipo = 'treino' and data = d;
  if n <> 2 then raise exception 'treino deveria continuar aceitando varias sessoes no dia'; end if;

  raise notice 'peso um-por-dia: recusa, idempotencia, dia seguinte, usuarios e indice unico passaram.';
end;
$$;
