# Handoff — Hardening pré-auth (sem dependência externa) + mapa do bloco auth/beta

Data: 2026-07-05 · Branch: `claude/evokorpus-app-dev-9in0hs` · **Nada escrito no cofre.**

O bloco final do app (auth/backend para o beta fechado, handoff do cofre `auth-beta-2026-07-05`) é
**externo por natureza** (Supabase Auth, banco/RLS, Resend) e os serviços **ainda não foram
provisionados**. Esta leva fez **só o que é 100% local**, atrás do guard `supabaseConfigurado()` → o app
segue idêntico em modo mock, e o portão de auth "liga sozinho" quando as envs entrarem.

## O que entrou (local, verificável)

### A) Guard de auth inerte-mas-pronto (Gating-1/3)
- **Novo `src/lib/auth/guard.ts`**: `getUsuario()` (import DINÂMICO do server client — só toca em rede se
  `supabaseConfigurado()`); `decidirAcessoApi(configurado, user)` **puro** (sem backend → passa; com
  backend e sem usuário → 401); `barreiraCompute(req, limitador)` (auth + rate-limit num só ponto).
- As **4 rotas de compute** (`/api/dieta`, `/api/treino`, `/api/substituir/{exercicio,prato}`) chamam
  `barreiraCompute` no topo do `POST`. **Zero mudança de comportamento hoje** (sem envs → passa); vira
  401 automático quando o Supabase existir. (Hoje essas rotas recebiam dado de saúde sem auth.)

### B) Rate-limit nas rotas de compute (Hardening-1)
- Reusa `criarRateLimit` (`src/lib/rate-limit.ts`, antes só no `/api/suporte`): 30 req/min por chave
  (usuário logado ou IP), instância em escopo de módulo por rota. Estouro → 429. Best-effort por
  instância (a versão global fica para o backend, como o próprio módulo documenta).

### C) Higiene de logs + guard-rail do service_role (Hardening-2 / Ownership-3)
- **Auditoria de `console.*` em `src/`: já limpo.** Nada loga `flagsSaude`/perfil, e-mail, corpo da
  requisição, token/JWT ou payload/assinatura do webhook. Os únicos logs são: `error.tsx` (boundary do
  Next, padrão), `/api/suporte` (já redige — "só o status, nunca conteúdo") e um log de teste. As 4 rotas
  de compute e o webhook Kiwify **não têm `console.*`**. Nenhuma correção necessária.
- **Novo teste estático `src/lib/auth/admin-guardrail.test.ts`**: falha se `createAdminClient`/import de
  `supabase/admin` aparecer fora de `api/webhooks/**` — trava um vazamento futuro de `service_role`.

## Verificação (sem Supabase)
- `typecheck` ✔ · `lint` ✔ · `test` **299 verdes** (+5) · `build` ✔. Os 294 anteriores seguem verdes
  (guard é no-op sem envs → zero regressão).
- Testes novos: `guard.test.ts` (matriz pura de acesso), `rate-limit-rota.test.ts` (31ª req → 429),
  `admin-guardrail.test.ts` (estático).
- **E2E** (build de produção, modo mock, zero erros de console): `/api/dieta` com perfil válido → **200**
  (guard inerte, motor rodou); rajada em `/api/treino` → **429 no 31º** pedido e **nenhum 401** (guard
  passa sem backend); `/` carrega sem erros de console (sem regressão de CSP/nonce).

## Bloqueado no provisionamento (próxima leva — mapa de fiação pronto)
Tudo abaixo precisa de **Supabase + Resend vivos** para funcionar E para verificar. Pontos exatos já
mapeados (para ser um porte rápido):
- **Auth real (Auth-1/2)**: `login/page.tsx:11` (`entrar` → `signInWithPassword`), `cadastro/page.tsx:29`
  (`submit` → `signUp`, manter gate 18+/LGPD, dropar campos de cartão), `confirmar/page.tsx:45`
  (`resend`) + **rota nova `/auth/callback`** (`exchangeCodeForSession`), `redefinir/page.tsx:43/90`
  (`resetPasswordForEmail`/`updateUser`). Reusar `src/lib/supabase/client.ts` e os primitivos de
  `src/components/auth/ui.tsx`.
- **Logout real (Auth-3)**: `app/page.tsx:47`, `conta/page.tsx:80`, via `Painel.tsx:418` → `signOut()`
  antes do `limparSessao()`.
- **Gating de rotas (Gating-2)**: `middleware.ts:82` já chama `getUser()` mas **descarta** — capturar e
  redirecionar `/app` e `/conta` sem-auth, **preservando o nonce/CSP** (o `setAll` reatribui `response` →
  qualquer redirect precisa recarregar `content-security-policy` + `x-nonce`, senão volta a tela branca).
- **Persistência (Ownership-1)**: nada persiste no servidor hoje (só `localStorage`); só o webhook usa o
  admin client. Usar o **server client** (RLS) para `profile`/`plans`/`logs`/`feedback`. ⚠️ **Mismatch de
  schema**: ~9 campos de `PerfilResumo` (`nivelExperiencia`, `equipamento`, `equipamentosCasa`,
  `treinoDias`, `diasDisponiveis`, `tempoPorSessaoMin`, `naoCurto`, `favoritos`, `pratosCansados`) **não
  têm coluna** em `profile` → decisão: colunas novas vs. um `jsonb` (padrão já usado em `plans.payload`).
- **LGPD (Ownership-4)** — 🔴 risco atual: `conta/page.tsx:238` "Excluir minha conta" só faz
  `limparSessao()` apesar da copy prometer exclusão permanente. Real = rota server com `createAdminClient`
  → `auth.admin.deleteUser` (cascata via FK `ON DELETE CASCADE`) + `signOut`. Export em `baixarMeusDados`
  (`conta/page.tsx:46`, hoje parcial).
- **Webhook (Entitlement-2)**: `resolverUserId` (`kiwify/route.ts:137`) retorna `null` → nunca grava
  assinatura; precisa do espelho e-mail→user_id (a tabela `profile` **não** tem coluna `email`).
- **Allowlist/flag beta**: **100% greenfield** — não existe tabela/flag/`app_metadata` de beta. Construir
  do zero (tabela de convite ou `app_metadata`, gate no signup, RLS/middleware).
- **Sessão (15-16)**: idle + absolute timeout; expiração/refresh do JWT.
- As migrations `0001–0004` (schema + RLS default-deny + `*_delete_own` + idempotência do webhook) **já
  existem** e só precisam ser aplicadas ao projeto Supabase.

## Pré-requisitos do AUTOR (🔵) para destravar o resto
- Criar o **projeto Supabase** + passar `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` por env (nunca no repo); aplicar migrations `0001–0004`.
- Criar conta **Resend** + `RESEND_API_KEY` + `SUPORTE_EMAIL_DESTINO` (destrava auth **e** o suporte);
  apontar o SMTP custom do Supabase Auth ao Resend.
- Definir a **lista de testers** (e-mails) e a duração do time-box.
