# Handoff — Leva 3 (auth/beta): fundação de auth + gating + migration 0006

Data: 2026-07-05 · Branch: `claude/evokorpus-app-dev-9in0hs` · **Nada no cofre.**

## 0. ⚠️ Bloqueio de rede (impacta a verificação ao vivo)
O **egress desta sessão bloqueia o host do Supabase** (`CONNECT tunnel failed, response 403`; o
`noProxy` só libera registries + Anthropic). O README do proxy manda **reportar, não contornar**. Então
**não consegui testar contra o Supabase vivo** (login real, isolamento A×B, §6 que exige sessão). O que
depende de sessão real → **você roda** de um lugar que alcance o Supabase (sua máquina / preview da
Vercel), com o checklist §6 abaixo.

**Item #1 (chaves novas `sb_publishable`/`sb_secret`):** **compatível por engenharia** — o SDK trata a
chave como string opaca; `getUser()` valida no servidor Auth (ok com HS256 revogado). O env já está com
a `sb_publishable` (len 46). Não pude confirmar via rede (bloqueio na borda), mas **confirmei no runtime**
que `getUser()` anônimo resolve local sem erro (ver §2). Mantidas as versões do `@supabase/{ssr,supabase-js}`.

## 1. Migrations — APLIQUE VOCÊ (sem senha do banco, não uso CLI)
Cole **`supabase/APLICAR_TUDO_0001-0006.sql`** (arquivo único, anexo) no **SQL Editor** do Supabase — ou
os arquivos `supabase/migrations/0001…0006` em ordem. Depois rode o **Security Advisor** e zere os
apontamentos. O `0006` (novo, leva 3) implementa as regras de ouro §4.2 da blindagem:
- **Espelho de e-mail (4.2.2):** trigger `trg_profile_email_mirror` força `profile.email = auth.email()`
  → fecha o sequestro de assinatura por e-mail forjado (o UPDATE do usuário não aponta o e-mail da vítima).
- **Allowlist do beta (4.2.1):** tabela `public.allowlist` **sem policy** p/ `authenticated` (só
  service_role popula) + função `beta_liberado()` `security definer` (o app checa sem ler a tabela).
  **Popular:** `insert into public.allowlist (email) values ('tester@ex.com');` para cada convidado.

## 2. O que entrou (fundação de auth — Increment A parcial) + verificado no runtime
Tudo atrás de `supabaseConfigurado()` (modo mock intacto sem env). **As envs ESTÃO setadas nesta sessão**,
então o app roda em "modo configurado" — e o smoke de runtime provou (sem 500, `getUser` anônimo local):

| Cenário (subconjunto do §6, sem sessão) | Resultado |
|---|---|
| `/` e `/login` | 200 (públicas) |
| `/app` sem sessão | **307 → /login** (gating do middleware) |
| `POST /api/dieta` sem sessão | **401** (guard `barreiraCompute`) |
| `/auth/callback?next=https://evil.com` | **307 → /login**, NÃO vai p/ evil.com (anti open-redirect) |

- **Login real** (`login/page.tsx`): `signInWithPassword` (browser client), com estado/erro; mock preservado.
- **Logout real** (`src/lib/auth/sair.ts`): `signOut()` (revoga refresh token) + limpa local — em
  `app/page.tsx` e `conta/page.tsx`.
- **`/auth/callback`** (`src/app/auth/callback/route.ts`): `exchangeCodeForSession` + `next` validado
  (`src/lib/auth/redirect-seguro.ts`, testado — anti open-redirect §2.C).
- **Middleware/gating** (`src/middleware.ts`): captura `getUser()`, redireciona `/app` e `/conta` sem-auth,
  **preservando nonce/CSP + cookies** no redirect (gotcha da tela branca respeitado).
- **Guard de compute** já estava pronto (`barreiraCompute`); agora **ativo** (envs presentes) → 401.
- Gate local: `typecheck` ✔ · `lint` ✔ · `test` **306 verdes** · `build` ✔. (o teste do rate-limit
  passou a forçar modo-mock via `vi.stubEnv`, pois com as envs setadas o guard 401 vem antes do limiter.)

## 3. Checklist §6 — VOCÊ roda contra o Supabase vivo (critério de aceite da leva)
Depois de aplicar as migrations + popular a allowlist, de um ambiente que alcança o Supabase:
- [ ] **Anon direto na REST** (só publishable, sem login): CRUD em cada tabela → negado/0 linhas.
- [ ] **A×B** (2 contas reais): A tenta ler/editar/excluir perfil/planos/logs/feedback de B → negado.
- [ ] **Auto-upgrade**: A tenta gravar `subscription`/allowlist → negado.
- [ ] **E-mail forjado**: `update profile set email=<B>` → o trigger sobrescreve p/ o e-mail de A.
- [ ] **`beta_liberado()`**: retorna true só p/ e-mail na allowlist.
- [ ] **Login real** (email+senha) + **logout** revoga refresh + `/app` sem sessão → /login (já provado
      anônimo aqui) + **compute → 401** (idem) + **31ª req → 429** (rate-limit).
- [ ] **Security Advisor** sem apontamentos.

## 4. O que FALTA (continuação da leva 3) — precisa das migrations aplicadas p/ testar
- **Cadastro/confirmar/redefinir**: NÃO wirei o `cadastro` — ele tem um **formulário de pagamento/cartão
  + "R$ 29/mês"** que **contradiz o beta grátis**. ⚠️ **Decisão de produto sua:** remover o pagamento no
  cadastro do beta (grátis, sem Kiwify) ou ter um cadastro de beta separado? Assim que decidir, o
  `signUp`/`resend`/`reset` são um porte rápido (mesmo padrão do login, `emailRedirectTo=/auth/callback`).
- **Persistência RLS** (Ownership): mover `profile`/`plans`/`logs`/`feedback` de localStorage p/ o **server
  client** usando o mapeador `perfil-profile.ts` (`user_id` sempre de `getUser()`). — precisa das tabelas.
- **Allowlist/flag beta no app**: após login, chamar `beta_liberado()`; se false → `/acesso-restrito`.
- **LGPD**: export real + exclusão real (`auth.admin.deleteUser`) — a exclusão precisa da **service_role**
  → rota fica pronta e **Vercel-pending** (não testável aqui).
- **Sessão**: idle + absolute timeout (componente client) + conferir flags de cookie.
- **Decisão menor:** gatear `/onboarding` também (exigir login antes de onboardar no beta)?

## 5. 🔵 Depende de você (dashboard/Vercel — blindagem §3)
- **Vercel envs:** `SUPABASE_SERVICE_ROLE_KEY` (=sb_secret), `RESEND_API_KEY`, `SUPORTE_EMAIL_DESTINO`
  (destrava hard-delete LGPD, `resolverUserId`, e-mails de auth via SMTP Resend).
- **Dashboard:** SMTP → Resend; **signups OFF** no lançamento do beta (agora ON p/ testar); MFA nas 5
  contas; SSL enforcement ON; `noindex`; export semanal (Free tier pausa após ~7 dias).
- Aplicar migrations 0001–0006 + Security Advisor zerado.

*Fonte: cofre `handoff-auth-beta-2026-07-05` + `blindagem-seguranca-app-2026-07-05` (§4/§6/§7), lidos via
GitHub API (read-only).*
