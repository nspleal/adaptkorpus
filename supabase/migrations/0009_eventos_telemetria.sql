-- ════════════════════════════════════════════════════════════════════════════
-- 0009 — TELEMETRIA DE PRODUTO: tabela `eventos` (Leva C2)
-- Cofre: conceitos/metricas-de-produto-adaptkorpus (DF 2026-07-31).
--
-- 🔴 POR QUE TABELA PRÓPRIA, e não `logs` com prefixo:
--   `logs` é o ARMAZENAMENTO PRIMÁRIO do app — `check (tipo in ('treino','refeicao','peso'))`,
--   escrito por api/dados/{peso,aderencia,historico}. São os pesos, as refeições marcadas e
--   as sessões de treino da pessoa. Telemetria ali dentro traria três defeitos:
--     · retenção viraria `delete … where tipo like 'evt_%'` — um `where` esquecido apaga
--       o histórico da pessoa;
--     · o CHECK teria de ir de 3 para 10 tipos, ENFRAQUECENDO a trava que protege o dado
--       primário;
--     · o export faz `select('*')` em `logs` → telemetria sairia misturada com histórico.
--   Regra ① do projeto: quando dá para tornar o erro IMPOSSÍVEL por construção, não se
--   guarda contra ele. `logs` fica intocado, fechado em 3.
--
-- 🔒 RETENÇÃO (declarada na /privacidade):
--   `eventos` → 12 meses, depois APAGAR (não anonimizar).
--   `logs`    → enquanto a conta existir; some na exclusão da conta.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.eventos (
  id          uuid primary key default gen_random_uuid(),
  -- `on delete cascade`: a exclusão de conta (auth.admin.deleteUser) leva a telemetria
  -- junto, sem código nenhum precisar lembrar. Teste obrigatório no repo.
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- 🔒 Lista FECHADA nos 7 da spec: um tipo inventado é rejeitado pelo BANCO, não só pelo
  -- código. A denylist do app cobre o payload; este CHECK cobre o nome.
  tipo        text not null check (tipo in (
                'app_aberto',
                'plano_gerado',
                'sessao_iniciada',
                'sessao_concluida',
                'exercicio_substituido',
                'refeicao_marcada',
                'cardio_registrado'
              )),
  payload     jsonb not null default '{}'::jsonb
);

-- Consulta típica das métricas: por pessoa, por tipo, na ordem do tempo.
create index if not exists idx_eventos_user_tipo on public.eventos (user_id, tipo, created_at desc);
-- Varredura da retenção (12 meses) — não filtra por usuário.
create index if not exists idx_eventos_created on public.eventos (created_at);

-- RLS idêntica à de `logs`: a pessoa só enxerga e escreve o que é dela.
-- ⚠️ SEM update e SEM delete: telemetria é append-only. Quem apaga é a cascata da exclusão
-- de conta e a rotina de retenção (service_role), nunca o cliente.
alter table public.eventos enable row level security;
create policy "eventos_select_own"
  on public.eventos for select to authenticated using ((select auth.uid()) = user_id);
create policy "eventos_insert_own"
  on public.eventos for insert to authenticated with check ((select auth.uid()) = user_id);
