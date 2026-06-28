-- ============================================================================
-- App Evokorpus — Row Level Security (RLS)
-- ----------------------------------------------------------------------------
-- SEGURANÇA EM PRIMEIRA CLASSE. Toda tabela tem RLS HABILITADA.
-- Sem política que case → acesso NEGADO por padrão (default-deny).
--
-- Regra de ouro:
--   - Conteúdo curado (foods/recipes/recipe_items/exercises): usuário autenticado
--     só LÊ. Nenhuma política de escrita → só o service_role (servidor) semeia/edita.
--   - Dado do usuário (profile/plans/logs/feedback): isolado por auth.uid().
--   - subscription: usuário só LÊ a própria; escrita só pelo webhook (service_role).
--
-- A anon key é pública por design — é ESTA camada que protege os dados.
-- ============================================================================

-- ---------- Conteúdo curado: leitura para autenticados, escrita só admin -------
alter table public.foods         enable row level security;
alter table public.recipes       enable row level security;
alter table public.recipe_items  enable row level security;
alter table public.exercises     enable row level security;

create policy "foods_read_authenticated"
  on public.foods for select to authenticated using (true);
create policy "recipes_read_authenticated"
  on public.recipes for select to authenticated using (true);
create policy "recipe_items_read_authenticated"
  on public.recipe_items for select to authenticated using (true);
create policy "exercises_read_authenticated"
  on public.exercises for select to authenticated using (true);
-- (Sem políticas de INSERT/UPDATE/DELETE: escrita só via service_role, que bypassa RLS.)

-- ---------- profile: dono lê/escreve/apaga só o próprio (LGPD) ----------------
alter table public.profile enable row level security;

create policy "profile_select_own"
  on public.profile for select to authenticated using (auth.uid() = id);
create policy "profile_insert_own"
  on public.profile for insert to authenticated with check (auth.uid() = id);
create policy "profile_update_own"
  on public.profile for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "profile_delete_own"  -- direito de eliminação (LGPD)
  on public.profile for delete to authenticated using (auth.uid() = id);

-- ---------- plans / logs / feedback: dono só acessa os próprios ---------------
alter table public.plans enable row level security;
create policy "plans_select_own"
  on public.plans for select to authenticated using (auth.uid() = user_id);
create policy "plans_insert_own"
  on public.plans for insert to authenticated with check (auth.uid() = user_id);
create policy "plans_update_own"
  on public.plans for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "plans_delete_own"
  on public.plans for delete to authenticated using (auth.uid() = user_id);

alter table public.logs enable row level security;
create policy "logs_select_own"
  on public.logs for select to authenticated using (auth.uid() = user_id);
create policy "logs_insert_own"
  on public.logs for insert to authenticated with check (auth.uid() = user_id);
create policy "logs_update_own"
  on public.logs for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "logs_delete_own"
  on public.logs for delete to authenticated using (auth.uid() = user_id);

alter table public.feedback enable row level security;
create policy "feedback_select_own"
  on public.feedback for select to authenticated using (auth.uid() = user_id);
create policy "feedback_insert_own"
  on public.feedback for insert to authenticated with check (auth.uid() = user_id);
create policy "feedback_delete_own"
  on public.feedback for delete to authenticated using (auth.uid() = user_id);

-- ---------- subscription: dono só LÊ; escrita só pelo webhook (service_role) --
alter table public.subscription enable row level security;
create policy "subscription_select_own"
  on public.subscription for select to authenticated using (auth.uid() = user_id);
-- (Sem INSERT/UPDATE/DELETE para usuários: o status vem do Kiwify via service_role.)
