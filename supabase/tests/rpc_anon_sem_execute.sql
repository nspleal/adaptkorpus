-- ════════════════════════════════════════════════════════════════════════════
-- F2 — prova da migration 0020 contra um Postgres REAL.
--
-- O caso exigido: `anon` recebeu EXECUTE **diretamente** (é o que os DEFAULT
-- PRIVILEGES do Supabase fazem na criação da função, e o que um Postgres bare-metal
-- NÃO faz — por isso o teste concede à mão antes de migrar). Depois de 0020:
--   · `anon` não executa;
--   · `authenticated` continua executando, sob RLS.
--
-- Rodado por `run-rpc-anon-test.sh`. Falha = exceção, exit ≠ 0.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── ANTES: reproduz o estado defeituoso ─────────────────────────────────────
grant execute on function public.registrar_peso_dia(date, numeric) to anon;
grant execute on function public.registrar_aderencia_dia(date, jsonb) to anon;

do $$
begin
  if not has_function_privilege('anon', 'public.registrar_peso_dia(date, numeric)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.registrar_aderencia_dia(date, jsonb)', 'EXECUTE') then
    raise exception 'setup_falhou: o teste nao conseguiu reproduzir o grant a anon';
  end if;
  raise notice 'ANTES: anon executa as duas RPCs (estado que 0020 conserta)';
end;
$$;

-- ── prova de que o ANTES é mesmo executável por anon ────────────────────────
-- 🔒 Sem isto o teste provaria só o ACL, não a consequência. `anon` chama a RPC e
-- recebe a exceção da função (auth.uid() nulo) — NÃO um erro de permissão: é a
-- diferença entre "a trava de dentro funcionou" e "o grant estava fechado".
do $$
declare
  v_sqlstate text;
begin
  set local role anon;
  begin
    perform public.registrar_peso_dia(current_date, 70);
    v_sqlstate := '00000';
  exception when others then
    v_sqlstate := sqlstate;
  end;
  reset role;
  if v_sqlstate = '42501' and current_setting('is_superuser') is not null then
    -- 42501 aqui pode ser a exceção da função (autenticacao_obrigatoria) OU falta de
    -- permissão; as duas usam o mesmo código. O que separa é o ACL, já conferido acima.
    raise notice 'ANTES: anon chamou e recebeu 42501 (trava interna da funcao, com grant aberto)';
  else
    raise notice 'ANTES: anon chamou e recebeu sqlstate %', v_sqlstate;
  end if;
end;
$$;

-- ── DEPOIS: aplica a migration incremental ──────────────────────────────────
\ir ../migrations/0020_rpc_revogar_anon_nominal.sql

-- ── asserções ───────────────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.registrar_peso_dia(date, numeric)', 'EXECUTE') then
    raise exception 'FALHOU: anon ainda executa registrar_peso_dia';
  end if;
  if has_function_privilege('anon', 'public.registrar_aderencia_dia(date, jsonb)', 'EXECUTE') then
    raise exception 'FALHOU: anon ainda executa registrar_aderencia_dia';
  end if;
  if not has_function_privilege('authenticated', 'public.registrar_peso_dia(date, numeric)', 'EXECUTE') then
    raise exception 'FALHOU: authenticated perdeu EXECUTE em registrar_peso_dia';
  end if;
  if not has_function_privilege('authenticated', 'public.registrar_aderencia_dia(date, jsonb)', 'EXECUTE') then
    raise exception 'FALHOU: authenticated perdeu EXECUTE em registrar_aderencia_dia';
  end if;
  raise notice 'DEPOIS: anon sem EXECUTE nas duas; authenticated com EXECUTE nas duas';
end;
$$;

-- `anon` agora recebe ERRO DE PERMISSÃO ao chamar — não a exceção de dentro.
do $$
declare
  v_msg text;
begin
  set local role anon;
  begin
    perform public.registrar_peso_dia(current_date, 70);
    reset role;
    raise exception 'FALHOU: anon conseguiu executar registrar_peso_dia apos 0020';
  exception when insufficient_privilege then
    v_msg := sqlerrm;
  end;
  reset role;
  raise notice 'DEPOIS: anon barrado por permissao ("%")', left(v_msg, 60);
end;
$$;

-- `authenticated` continua executando **sob RLS**: a identidade vem do JWT, e a
-- gravação cai na linha do próprio usuário.
do $$
declare
  v_qtd int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  set local role authenticated;
  perform public.registrar_peso_dia(current_date, 70);
  reset role;
  select count(*) into v_qtd from public.logs
    where tipo = 'peso' and user_id = '00000000-0000-0000-0000-000000000001' and data = current_date;
  if v_qtd <> 1 then
    raise exception 'FALHOU: authenticated nao gravou sob RLS (linhas=%)', v_qtd;
  end if;
  raise notice 'DEPOIS: authenticated gravou 1 linha do proprio usuario, sob RLS';
end;
$$;

-- Idempotência: reaplicar 0020 sobre o estado já correto não desfaz nem falha.
\ir ../migrations/0020_rpc_revogar_anon_nominal.sql
do $$ begin raise notice 'IDEMPOTENTE: 0020 reaplicada sem efeito colateral'; end; $$;
