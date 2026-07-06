-- ============================================================================
-- App Evokorpus — Gate do CONTEÚDO CURADO atrás da allowlist do beta
-- ----------------------------------------------------------------------------
-- ⚠️ JÁ APLICADO AO VIVO (2026-07-06) e verificado — esta migration é a
-- RECONCILIAÇÃO do repo com o banco (mesmo padrão da 0007).
--
-- Origem: red-team autorizado (2026-07-06) — as 4 tabelas de acervo (foods,
-- exercises, recipes, recipe_items) eram legíveis por QUALQUER usuário logado,
-- inclusive fora da allowlist do beta (policy `using (true)` da 0002). O
-- conserto troca o USING por `beta_liberado()`: o acervo passa a acompanhar o
-- gate do beta. `(select ...)` força avaliação 1×/statement (padrão de
-- performance RLS da blindagem §4.1).
--
-- Verificado ao vivo (extensão do checklist §6):
--   [x] usuário allowlistado LÊ o acervo e gera plano normal;
--   [x] usuário fora da allowlist recebe 0 linhas nas 4 tabelas.
-- Tabelas de USUÁRIO (profile/plans/logs/feedback/subscription) intocadas.
--
-- Nota de lançamento (⏭️): um assinante pago NÃO-allowlistado herdará este
-- gate — revisitar as policies do acervo na virada paga (junto do gate
-- server-side das rotas de compute, item P2 separado).
-- ============================================================================

alter policy "foods_read_authenticated"        on public.foods        using ((select public.beta_liberado()));
alter policy "recipes_read_authenticated"       on public.recipes      using ((select public.beta_liberado()));
alter policy "recipe_items_read_authenticated"  on public.recipe_items using ((select public.beta_liberado()));
alter policy "exercises_read_authenticated"     on public.exercises    using ((select public.beta_liberado()));
