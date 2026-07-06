# Handoff — Increment B: persistência RLS + allowlist + LGPD + sessão

Data: 2026-07-06 · Branch: `claude/evokorpus-app-dev-9in0hs` · **Nada no cofre.**
Egress do Supabase segue bloqueado nesta sessão → validado aqui: gate completo + smoke local
(tudo que resolve sem rede). **O teste ao vivo (§6) é seu, na Vercel — checklist executável no fim.**

## 0. Higiene
- Leva anterior confirmada commitada (`cbb4d40`). **Migration `0007` atualizada no repo** como você
  aplicou no banco: revokes de `profile_email_mirror` incluem `public, anon, authenticated`;
  `beta_liberado` revoga `public, anon` e mantém o grant a `authenticated`.

## 1. Persistência com RLS (Ownership-1)
**Arquitetura:** write-through offline-first — o localStorage continua escrito primeiro e funciona
sozinho (modo mock intacto); logado, cada escrita também sobe (fire-and-forget) e a **hidratação
prefere o servidor** (2º device vê os mesmos dados). Server client SEMPRE (RLS via JWT do cookie);
`user_id` nasce de `getUser()` no servidor (regra 4.2.3) — nunca do body.

- `src/lib/persistencia/servidor.ts` — `contextoUsuario()`: 503 sem envs · 401 sem usuário.
- **Rotas** (todas 401 sem sessão — verificado no smoke):
  - `GET/PUT /api/dados/perfil` — perfil via mapeador `perfil-profile.ts`; PUT grava consentimentos
    (`aceite_18/termos/lgpd` + `aceite_em`) quando enviados e o **snapshot auditável em `plans`**
    (dieta+treino recomputados server-side pelo MESMO mapeamento do client — `lib/plano.ts`, extraído
    de `session.ts` p/ módulo puro compartilhado). E-mail nunca vem do body (trigger espelho 0006).
  - `GET/POST /api/dados/historico` — sessões de treino (`logs` tipo `treino`, payload =
    `SessaoHistorico` verbatim; calibrações viajam no payload). Feedback por sessão também vira linha
    em **`feedback`** (contexto `treino`).
  - `GET/PUT /api/dados/aderencia` — um registro por dia local (`logs` tipo `refeicao`).
  - `GET/POST /api/dados/peso` — `logs` tipo `peso`. (Antes o peso era SÓ memória — resetava no
    reload; agora persiste de verdade.)
- **Fiação:** boot do `/app` server-first (migra o perfil local pré-backend na 1ª carga);
  `aplicarNovoHistorico` → `enviarSessaoTreino(novaSessaoDe(novo))` (1 gancho cobre guiada/manual/
  calibração); aderência sincroniza no persist e hidrata servidor-sobre-local; peso idem;
  `onPerfilChange` (edições) também sobe. **Consentimentos**: o `gerar()` do onboarding agora envia
  `aceite18/termos/lgpd` junto do perfil — LGPD quer o registro, não só o checkbox.

## 2. Allowlist / flag beta (regra 4.2.1)
- `decidirAcessoBeta` pura (`lib/auth/acesso-beta.ts`, testada): allowlist OU `status ∈ {ativa,trial}`.
- `GET /api/acesso`: RPC `beta_liberado()` + `subscription.status` (read-only p/ o dono) → decisão.
- Boot do `/app`: `!liberado` → `/acesso-restrito?motivo=assinatura` (a página agora semeia a variante
  pelo `?motivo=`, verificado no Playwright). Onboarding desagua no `/app` → o gate cobre tudo.
- **Popular a allowlist (você, SQL Editor):** `insert into public.allowlist (email) values ('t@ex.com');`

## 3. LGPD (Ownership-4)
- **Export real** `GET /api/lgpd/exportar`: profile+plans+logs+feedback+subscription (RLS) → JSON;
  `baixarMeusDados` da conta usa a rota quando logado (fallback parcial no mock).
- **Exclusão real** `POST /api/lgpd/excluir`: `auth.admin.deleteUser(uid)` (id do PRÓPRIO JWT) +
  cascata FK. **Sem `SUPABASE_SERVICE_ROLE_KEY` → 503 honesto** (nunca finge exclusão) — botão da
  conta mostra a mensagem e mantém a conta. Com sucesso: `signOut` + limpa TODO o local
  (`limparDadosLocais`). Guard-rail estático atualizado: admin client permitido só em
  `api/webhooks` + `api/lgpd`.

## 4. Sessão (tarefas 15–16)
- `expirouSessao` pura (testada): **idle 30 min · absoluta 12 h** — valores de implementação,
  NÃO travados no cofre (ajustáveis; decisão sua se quiser outros).
- `VigiaSessao` montado no `/app` (só com backend): expira → `signOut()` →
  `/acesso-restrito?motivo=sessao`.
- Cookies: padrão `@supabase/ssr`. **Conferir na Vercel** (DevTools → Application → Cookies):
  `Secure` ✓ em HTTPS e `SameSite=Lax` nos cookies `sb-*`.

## 5. Verificação feita AQUI
- `typecheck` ✔ · `lint` ✔ · **317 testes** ✔ (+11: acesso-beta, sessao-expiracao, novaSessaoDe,
  linhaComConsentimentos, guardrail estendido) · `build` ✔.
- Smoke runtime: **8 rotas novas → 401 sem sessão**; `?motivo=` semeia a variante certa
  (assinatura/sessão); zero erros de console/500.
- Não testável daqui (rede): fluxos com sessão real, RLS ao vivo, 503→ok da exclusão. → §6 abaixo.

## 6. CHECKLIST §6 — você roda na Vercel (aceite da leva)
Pré: deploy desta branch; envs na Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, Resend); allowlist populada com seu e-mail de teste.

1. **Anon direto na REST** (substitua URL/KEY; deve devolver `[]` ou erro — nunca linhas):
   ```bash
   for t in profile plans logs feedback subscription allowlist; do
     echo "== $t"; curl -s "https://SEU.supabase.co/rest/v1/$t?select=*" \
       -H "apikey: SB_PUBLISHABLE" -H "Authorization: Bearer SB_PUBLISHABLE"; echo; done
   ```
2. **Smoke E2E** (browser): cadastro (sem cartão) → e-mail de confirmação → link → onboarding →
   painel; **F5 e 2º device/aba anônima**: login → mesmos dados (perfil, histórico, aderência, peso).
3. **A×B**: 2 contas; em A, pelo DevTools:
   `fetch('/api/dados/perfil').then(r=>r.json())` → só o de A. Na REST direta com o token de A,
   `profile?select=*` → 1 linha (a sua). Nunca dados de B.
4. **Auto-upgrade negado** (com o token de A na REST):
   `POST /rest/v1/subscription {status:'ativa'}` → erro RLS · `POST /rest/v1/allowlist` → erro.
5. **E-mail forjado**: `PATCH /rest/v1/profile?id=eq.<uid> {"email":"vitima@x.com"}` → depois
   `GET profile` → o e-mail continua o SEU (trigger sobrescreveu).
6. **beta_liberado**: conta NA allowlist entra no app; conta fora → `/acesso-restrito` (assinatura).
7. **Logout/expiração**: sair → `/app` redireciona a `/login`; `fetch('/api/dados/perfil')` → 401.
8. **Compute**: sem login `POST /api/dieta` → 401; logado, 31 requests no minuto → 429 na 31ª.
9. **Exclusão LGPD**: conta de teste → Conta → Excluir definitivamente → some do Auth (dashboard) e
   `select count(*)` das 5 tabelas com o uid → 0. (Preview SEM service_role: deve dar a mensagem de
   indisponível — nunca fingir.)
10. **Cookies** `sb-*`: `Secure` + `SameSite=Lax` (§4).

## 7. Vercel-pending / notas
- **Exclusão LGPD** só funciona com `SUPABASE_SERVICE_ROLE_KEY` no env da Vercel (server-only).
- **E-mails de auth** (confirmação/reset) — apontar SMTP do Supabase ao Resend (dashboard).
- Duplicatas teóricas no histórico se um POST for repetido (sem unique em logs) — aceito no beta.
- Sessões criadas OFFLINE logado não sobem retroativamente (write-through só no momento do registro;
  aceito no beta — documentado).
- Valores de timeout (30 min/12 h) são ajustáveis — se quiser travar outros, volta por DF.
