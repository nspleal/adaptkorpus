-- ════════════════════════════════════════════════════════════════════════════
-- F2 — REVOGAÇÃO NOMINAL DE `anon` NAS RPCs DE ESCRITA.
--
-- 🔴 O que 0018/0019 não fecharam. As duas migrations fazem
--   `revoke all on function … from public;  grant execute … to authenticated;`
-- e isso é insuficiente NESTE projeto: o Supabase define DEFAULT PRIVILEGES que
-- concedem EXECUTE a `anon` **nominalmente** na criação da função. `REVOKE … FROM
-- PUBLIC` remove só a concessão ao pseudo-papel PUBLIC — a linha `anon=X/postgres`
-- do ACL sobrevive. Medido no banco em 2026-09-11:
--   registrar_peso_dia      → acl sem `anon=X`  (revogação nominal já aplicada à mão)
--   registrar_aderencia_dia → acl COM `anon=X`  (mesma causa, ainda aberta)
-- Ou seja: o banco de produção e o SQL versionado divergiam, e um deploy limpo a
-- partir deste repositório reintroduziria o grant nas duas funções.
--
-- 🔒 IDEMPOTENTE E PRESERVA O QUE JÁ FOI APLICADO. `REVOKE` de privilégio ausente é
-- no-op, e o `GRANT` a `authenticated` é reafirmado — então rodar esta migration
-- depois da correção manual de `registrar_peso_dia` não desfaz nem duplica nada.
--
-- 🔴 O QUE ESTA MIGRATION NÃO É: não é a trava de segurança. A trava é dentro da
-- função (`auth.uid() is null` → exceção `42501`) e a RLS de `public.logs`. Um
-- `anon` com EXECUTE recebe exceção, não escreve — isto é defesa em profundidade e
-- reprodutibilidade do repositório, não fechamento de escrita aberta. Registrar a
-- severidade real importa mais que inflá-la.
--
-- ⚠️ NÃO altera produção por si: é SQL versionado, aplicado sob autorização própria.
-- ════════════════════════════════════════════════════════════════════════════

-- Peso (0019). `from public` fica junto para a migration ser completa por si.
revoke all on function public.registrar_peso_dia(date, numeric) from public;
revoke all on function public.registrar_peso_dia(date, numeric) from anon;
grant execute on function public.registrar_peso_dia(date, numeric) to authenticated;

-- Aderência (0018) — MESMA causa, encontrada na conferência deste fechamento.
revoke all on function public.registrar_aderencia_dia(date, jsonb) from public;
revoke all on function public.registrar_aderencia_dia(date, jsonb) from anon;
grant execute on function public.registrar_aderencia_dia(date, jsonb) to authenticated;

-- 🔒 A guarda que torna a migration verificável: se qualquer uma das duas ainda
-- puder ser executada por `anon`, ou se `authenticated` tiver perdido EXECUTE, a
-- migration FALHA em vez de passar em silêncio.
do $$
begin
  -- Peso
  if has_function_privilege('anon', 'public.registrar_peso_dia(date, numeric)', 'EXECUTE') then
    raise exception 'anon_ainda_executa: registrar_peso_dia' using errcode = '42501';
  end if;
  if not has_function_privilege('authenticated', 'public.registrar_peso_dia(date, numeric)', 'EXECUTE') then
    raise exception 'authenticated_perdeu_execute: registrar_peso_dia' using errcode = '42501';
  end if;
  -- Aderência
  if has_function_privilege('anon', 'public.registrar_aderencia_dia(date, jsonb)', 'EXECUTE') then
    raise exception 'anon_ainda_executa: registrar_aderencia_dia' using errcode = '42501';
  end if;
  if not has_function_privilege('authenticated', 'public.registrar_aderencia_dia(date, jsonb)', 'EXECUTE') then
    raise exception 'authenticated_perdeu_execute: registrar_aderencia_dia' using errcode = '42501';
  end if;
end;
$$;
