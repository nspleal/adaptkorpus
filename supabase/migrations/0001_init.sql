-- ============================================================================
-- App Adaptkorpus — Schema inicial (Postgres / Supabase)
-- ----------------------------------------------------------------------------
-- Estrutura relacional dos dados curados + dados do usuário.
-- A SEGURANÇA (RLS) está no arquivo 0002_rls.sql — TODA tabela tem RLS.
--
-- Princípios (cofre): dado de saúde é sensível (LGPD); minimização; RLS desde já.
-- Fonte: outputs/prontidao-do-app-adaptkorpus §B, fontes/banco-alimentos-adaptkorpus.
-- ============================================================================

-- gen_random_uuid()
create extension if not exists "pgcrypto";

-- Helper: mantém updated_at automaticamente.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- TABELAS DE CONTEÚDO CURADO (referência) — leitura p/ usuários; escrita só admin.
-- ----------------------------------------------------------------------------

-- Alimentos (paleta TACO) — valores por 100 g.
create table if not exists public.foods (
  id                 text primary key,
  nome               text not null,
  fonte_taco         integer,
  grupo              text not null check (grupo in (
                       'proteina_animal','leguminosa_proteina_vegetal','verdura_legume',
                       'fruta','grao_cereal_tuberculo','gordura','laticinio')),
  kcal_por_100g      numeric(8,2) not null check (kcal_por_100g >= 0),
  proteina_por_100g  numeric(8,2) not null default 0 check (proteina_por_100g >= 0),
  carboidrato_por_100g numeric(8,2) not null default 0 check (carboidrato_por_100g >= 0),
  gordura_por_100g   numeric(8,2) not null default 0 check (gordura_por_100g >= 0),
  fibra_por_100g     numeric(8,2),
  medida_caseira     text,
  gramas_da_medida   numeric(8,2),
  alergenos          text[] not null default '{}'
);

-- Pratos (combinações de alimentos). Um prato pode servir mais de uma refeição
-- (ex.: {almoco,jantar}) — por isso refeicoes é um array.
create table if not exists public.recipes (
  id                text primary key,
  nome              text not null,
  refeicoes         text[] not null default '{}',
  tipo              text not null check (tipo in ('vegano','vegetariano','onivoro')),
  contem_alergenos  text[] not null default '{}'
);

-- Junção prato ↔ alimento (relacional — sem ela os pratos não somam kcal/macros).
create table if not exists public.recipe_items (
  id           bigint generated always as identity primary key,
  recipe_id    text not null references public.recipes(id) on delete cascade,
  alimento_id  text not null references public.foods(id) on delete restrict,
  gramas       numeric(8,2) not null check (gramas > 0),
  unique (recipe_id, alimento_id)
);

-- Biblioteca de exercícios.
create table if not exists public.exercises (
  id                text primary key,
  nome_pt           text not null,
  nome_en           text,
  grupo_muscular    text not null,
  padrao_movimento  text not null check (padrao_movimento in (
                      'empurrar','puxar','agachar','dobradica_quadril','core','cardio','isolado')),
  nivel             text not null check (nivel in ('iniciante','intermediario','avancado')),
  tipo              text not null check (tipo in ('forca_hipertrofia','cardio','pliometrico','mobilidade')),
  equipamento       text not null check (equipamento in ('nenhum','casa','academia')),
  equipamento_detalhe text,
  local             text not null check (local in ('casa_sem','casa_com','academia')),
  tier              integer check (tier between 1 and 4),
  como_fazer        text not null
);

-- ----------------------------------------------------------------------------
-- TABELAS DO USUÁRIO (dado pessoal/sensível) — isoladas por RLS (auth.uid()).
-- ----------------------------------------------------------------------------

-- Perfil + questionário + gate de saúde (PAR-Q) + consentimentos (LGPD).
create table if not exists public.profile (
  id                    uuid primary key references auth.users(id) on delete cascade,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  sexo                  text check (sexo in ('masculino','feminino')),
  peso_kg               numeric(6,2) check (peso_kg between 30 and 300),
  altura_cm             numeric(6,2) check (altura_cm between 100 and 250),
  idade                 integer check (idade between 18 and 100),
  nivel_atividade       text check (nivel_atividade in (
                          'sedentario','leve','moderado','intenso','muito_intenso')),
  objetivo              text check (objetivo in ('emagrecimento','massa','saude')),

  -- Gate de saúde (PAR-Q enxuto, autodeclaração sim/não — NÃO é ficha médica).
  gestacao_amamentacao  boolean not null default false,
  renal                 boolean not null default false,
  cardiaca              boolean not null default false,
  lesao                 boolean not null default false,
  diabetes              boolean not null default false,

  -- Preferências de montagem (não entram no cálculo calórico).
  preferencia_alimentar text check (preferencia_alimentar in ('vegano','vegetariano')),
  alergenos             text[] not null default '{}',

  -- Consentimentos (base legal LGPD + 18+). Gravar é obrigatório p/ gerar plano.
  aceite_18             boolean not null default false,
  aceite_termos         boolean not null default false,
  aceite_lgpd           boolean not null default false,
  aceite_em             timestamptz
);

create trigger trg_profile_updated_at
  before update on public.profile
  for each row execute function public.set_updated_at();

-- Planos gerados (snapshot auditável: gate + alvo + macros + cardápio).
create table if not exists public.plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  tipo        text not null check (tipo in ('dieta','treino')),
  payload     jsonb not null,
  ativo       boolean not null default true
);
create index if not exists idx_plans_user on public.plans (user_id, created_at desc);

-- Registros (treino feito, refeição, peso).
create table if not exists public.logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  data        date not null default current_date,
  tipo        text not null check (tipo in ('treino','refeicao','peso')),
  payload     jsonb not null
);
create index if not exists idx_logs_user on public.logs (user_id, data desc);

-- Feedback leve (dificuldade do treino; "gosto de X" / "cansei de Y").
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  contexto    text not null,
  payload     jsonb not null
);
create index if not exists idx_feedback_user on public.feedback (user_id, created_at desc);

-- Assinatura (fonte de verdade = webhook Kiwify via service role; usuário só LÊ).
create table if not exists public.subscription (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  status                  text not null default 'inativa' check (status in (
                            'trial','ativa','inadimplente','cancelada','reembolsada','inativa')),
  kiwify_subscription_id  text,
  valido_ate              timestamptz,
  atualizado_em           timestamptz not null default now()
);
