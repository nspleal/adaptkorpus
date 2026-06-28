# Segurança & LGPD — postura do App Evokorpus

Dado de saúde é **dado pessoal sensível** (LGPD, art. 11). A segurança é tratada como
requisito de primeira classe, **por desenho** — não como camada posterior.

## 1. Isolamento de dados (RLS) — a defesa principal

- **Toda tabela tem Row Level Security habilitada** (`supabase/migrations/0002_rls.sql`).
  Sem política que case → **acesso negado por padrão** (default-deny).
- **Dado do usuário** (`profile`, `plans`, `logs`, `feedback`): isolado por
  `auth.uid() = user_id`. Um usuário **nunca** lê/escreve dado de outro.
- **Conteúdo curado** (`foods`, `recipes`, `recipe_items`, `exercises`): só leitura para
  autenticados; escrita apenas via `service_role` (servidor) — não há política de escrita
  para usuários.
- **`subscription`**: o usuário só **lê** a própria; o status é gravado **só** pelo webhook
  da Kiwify (service_role). O usuário não consegue se auto-conceder assinatura.
- A **anon key** é pública por design; quem protege os dados é o **RLS**, não o sigilo da key.

## 2. Segredos

- `service_role` (acesso total, bypassa RLS) é **server-only** (`src/lib/supabase/admin.ts`
  com `import 'server-only'` → erro de build se vazar para o cliente). Nunca logada, nunca
  prefixada com `NEXT_PUBLIC_`.
- Segredos vivem em `.env.local` (git-ignored) e no painel da Vercel — **nunca no repo**.
- `.gitignore` cobre `.env*` e `*.pem`.

## 3. Webhook Kiwify (entrada externa não confiável)

`src/app/api/webhooks/kiwify/route.ts`:
1. Valida a **assinatura HMAC** do corpo **cru** antes de confiar em qualquer dado.
2. Comparação em **tempo constante** (`timingSafeEqual`) — anti-timing-attack.
3. Só depois usa o cliente admin para atualizar a assinatura. Sem `user_id` resolvido,
   **não grava** (fail-safe).
> ⚠️ Confirmar o nome do header/param e o algoritmo (SHA-1 × SHA-256) na doc atual da
> Kiwify e ajustar `ALGO`.

## 4. Cabeçalhos de segurança (todas as rotas)

Em `next.config.mjs`: **Content-Security-Policy**, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (câmera/mic/geo
desligados), **HSTS**. `X-Powered-By` removido.

## 5. Validação na borda

Toda entrada passa por **zod** (`src/lib/validation/profile.ts`) antes de tocar o motor ou
o banco. Faixas de plausibilidade (peso/altura/idade) e **18+** são barradas aqui — e o
motor tem um **backstop fail-safe** (input implausível → ROTEAR).

## 6. LGPD by design

- **Minimização:** o gate de saúde coleta **PAR-Q sim/não**, não anamnese. Idade em vez de
  data de nascimento. Nada além do necessário para rotear.
- **Consentimento:** `aceite_18`, `aceite_termos`, `aceite_lgpd` gravados em `profile` (base
  legal + 18+) — obrigatórios para gerar/persistir plano.
- **Direitos do titular:** políticas `*_delete_own` permitem **excluir** o próprio dado;
  exclusão da conta faz **cascade** em tudo do usuário. Exportação de dados: ver pendências.

## Hardening já aplicado (auditoria adversarial 2026-06-28)

- [x] **Webhook idempotente** — tabela `webhook_events` (RLS, service_role) deduplica
      reentregas/replay (`0004_webhook_idempotency.sql`).
- [x] **HMAC sobre bytes** — comparação em tempo constante decodificando o hex; algoritmo
      **configurável por env** (`KIWIFY_WEBHOOK_ALGO`, default `sha256`); só header.
- [x] **Validação de e-mail** no webhook antes de usar; `.finite()` na validação zod (borda).

## Pendências de hardening (dependem da Auth / lançamento)

> A maioria abaixo só faz sentido depois que a **Supabase Auth** existir (hoje as telas
> privadas são placeholders e não há login). Estão rastreadas para entrar com a Auth.

- [ ] **Gating de rotas privadas** no middleware (login + assinatura ativa em `/plano`, `/conta`).
- [ ] **Resolução de `user_id`** no webhook (espelho de e-mail com RLS) + **rate limiting**.
- [ ] **Direito de portabilidade (LGPD art. 20)** — exportação dos dados na tela de conta.
- [ ] **Direito ao esquecimento (LGPD art. 17/18)** — exclusão de conta com cascade já existe;
      falta UI + (opcional) soft-delete/janela de auditoria.
- [ ] **E-mail no `profile`** (ou tabela espelho) — necessário para ligar o webhook ao usuário.
- [ ] **Auditoria de consentimento** — versão da política + timestamp/origem do aceite.
- [ ] **CSP por nonce** (remover `style-src 'unsafe-inline'`; nonce por requisição via middleware).
- [ ] **Criptografia em repouso** de campos de saúde (avaliar pgcrypto/coluna vs. RLS-only).
- [ ] **Retenção & logs de acesso** a dado sensível (política de prazos + observabilidade).
- [ ] **Revisão jurídica** (portão de lançamento) — termo, disclaimer, privacidade, reembolso,
      base legal do tratamento.
