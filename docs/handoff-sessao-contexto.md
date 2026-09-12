# Handoff de contexto — App Adaptkorpus (front-end V1 + motor)

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

> **Para a próxima sessão:** lendo **só este arquivo + o git desta branch**, você consegue
> continuar. Atualizado em 2026-06-30. Complementa `docs/handoff-cofre-2026-06-29.md`
> (estado do motor) e `docs/api.md` (contrato das rotas).

## 0. Como retomar / onde está cada coisa
- **Repo:** `nspleal/adaptkorpus` · **branch:** `claude/adaptkorpus-app-dev-9in0hs` (tudo commitado e pushado).
- **Cofre** (`nspleal/obsidian`, repo separado): **fonte de verdade** de produto/specs/marca.
  Esta sessão **lê** o cofre (clona/pull) mas **NUNCA escreve** nele (regra de escritor único —
  só a sessão local do humano escreve no cofre). Decisões novas voltam pelo humano.
- **Front-end de referência (V1):** o humano depositou o protótipo de design em
  `cofre/raw/design_handoff_adaptkorpus/` (`Adaptkorpus.dc.html` = landing, `Adaptkorpus App.dc.html`
  = área logada, `README.md`, `support.js`). São **HTML com estilos inline + keyframes** — o
  porte fiel saiu **desses arquivos**, não do README (lição aprendida — ver §7).

## 1. Regras inegociáveis (não quebrar)
1. **Nada de IA em runtime** — motor é fórmula + dado curado; a copy nunca diz "IA" (usa "regras adaptativas").
2. **18+** — validado na borda.
3. **Sem promessa de resultado** — linguagem de processo.
4. **Fora do território clínico** — flag de saúde → gate `ROTEAR` (não gera plano; orienta profissional).
5. **LGPD desde o início** — dado de saúde é sensível; RLS, minimização, consentimento, segredos fora do repo.
6. **Determinismo auditável** — mesma entrada → mesma saída (motor puro, sem rede/relógio).
7. **Fidelidade visual** — usar a construção canônica do SVG do cofre; neon Pulso `#BDFF00` só em
   fundo escuro; ícone do app = **K em Selo** (favicon `src/app/icon.svg` já correto). Logo principal = K Ascendente.
8. **Qualidade antes de commitar:** `npm run typecheck && npm run lint && npm test && npm run build`.

## 2. Stack
Next.js 15 (App Router, TS) · Tailwind · Vitest · zod · Supabase (Postgres+Auth+RLS, **ainda não ligado**) ·
Kiwify (webhook) · PWA · `output: standalone`. Tema escuro Floresta `#0D2818` / Bone `#EAE5DB`,
fonte Plus Jakarta Sans.

## 3. Estado atual — o que está PRONTO

### Motor determinístico (`src/lib/engine`) — testado, fiel ao cofre
- **Gate de saúde** (dieta + treino): precedência `ROTEAR > RESTRINGIR > PISAR > PERMITIR`;
  **simetria do alto peso (DF 2026-06-29):** IMC≥30+massa → RESTRINGIR→saúde; 25–30+massa → só aviso;
  emagrecer sempre PERMITIR no alto; sem ROTEAR no alto. Baixo peso 16–18,5 + emagrecimento → RESTRINGIR.
- **Dieta:** Mifflin-St Jeor → GET×PAL → fator objetivo (emagrec 0,825 / massa 1,125 / saúde 1,0);
  piso 1250F/1550M; proteína ponto/piso; gordura clamp 20–30%.
- **Montador com ESCALA DE PORÇÕES (Bloco B, travado v1):** `ESCALA_PORCAO = 0,5×–3,0×`, escala
  única do dia mira a kcal-alvo (fidelidade calórica). `CardapioItem` carrega `escala` + `macros`.
- **Treino (FITT):** reps/RIR/descanso por objetivo; volume/frequência por nível; trilhos de segurança;
  dupla progressão; deload; montador de rotina (core 2–3×, puxar≥empurrar).
- **Substituição F.2:** prato = **equivalência só-kcal** (escala o prato novo p/ igualar kcal do trocado);
  exercício = grupo→padrão, equip/nível duros, desempate tier T1.
- **Testes:** 130 testes / 10 arquivos / 100% verdes (inclui corpus de bordas 2700 casos + corpus
  cruzado do gate 6 bandas IMC × 3 objetivos).

### Dados (`src/lib/data`) — embutidos
125 alimentos (TACO) · 56 pratos · 163 exercícios.

### API rudimentar (`src/app/api`) — sem auth ainda (Fase 1)
`POST /api/dieta`, `/api/treino`, `/api/substituir/{prato,exercicio}` ·
`GET /api/catalogo/{alimentos,exercicios,pratos}` · `POST /api/webhooks/kiwify` (HMAC + idempotência;
`resolverUserId` é stub→null). Contrato em `docs/api.md`.

### Front-end — **porte FIEL da V1** (todas as telas do protótipo)
- **`/` Landing** (`src/app/page.tsx`): porte fiel do `Adaptkorpus.dc.html` — backdrop que deriva,
  trajetórias neon que se **desenham** (data-draw + IntersectionObserver), reveals em scroll,
  mockups flutuando (evkFloat), anel pulsando, nav com blur + scroll-spy, FAQ acordeão. Desktop-first.
- **`/onboarding`** (`src/app/onboarding/page.tsx`): **login (UI mock)** → **wizard 8 passos** (stepper
  com pontos ascendentes + barra com glow, evkStepIn, estilos exatos) → **"gerando"** (trajetória que
  desenha + pontos subindo + %) → **gate A/B/C** → delega ao **Painel**. Ligado ao **motor real**.
- **Painel** (`src/components/painel/Painel.tsx`): área logada fiel — header sticky com abas em pílula
  neon + menu de conta; **Hoje** (cartões em gradiente + barras de macros + registrar peso) · **Treino**
  (cartões com nº/padrão/chips séries-RIR-descanso/"Como fazer"/feedback "Como foi?") · **Dieta**
  (header gradiente + Trocar/Editar porção) · **Progresso** (stats + gráfico com área) · **Perfil**
  (dados/assinatura/legais/disclaimer).
- **Modal de troca fiel:** caixa com **3 opções (linha + seta)** + **4ª ação "não curti nenhuma —
  gerar mais variedade"** (paginação por exclusão). Vale para prato/exercício; porção (½…2×) usa a mesma caixa.
- **Design system:** tokens no `tailwind.config.ts`; animações/classes no `globals.css`
  (evkFloat/evkPulse/evkRingGlow/evkDrift/evkBlink/evkStepIn/evkScreenIn/evkPop/evkDraw/evkRise; `.rv`/`.rv-in`
  reveal; `.hov-lift`/`.hov-btn`/`.modal-opt`/`.evk-troca`/`.evk-navlink`).

## 4. Commits desta rodada (branch `claude/adaptkorpus-app-dev-9in0hs`)
- `c376434` painel + login fiéis (cartões/abas/menu + tela de login)
- `f238e63` onboarding fiel (wizard + gerando + gate B, estilos/movimento exatos)
- `94cc577` modal de troca fiel (3 + "gerar mais variedade")
- `34b76c1` landing fiel (movimento/estética exatos)
- `b5b7456` painel completo (5 abas + modais)
- `269f4da` área logada desktop-first (plano em 2 colunas)
- `a058fe8` landing desktop-first (1ª versão, a partir dos tokens)
- `5709b93` onboarding wizard 8 passos + design system
- `9e62fc5` gate: simetria do alto peso (DF 2026-06-29)
- `273da81` docs: handoff código→cofre
- `82b17b1` motor: escala de porções + equivalência calórica (Bloco B)
- `dc3207d` onboarding liga treino + substituição
- `c57ad70` API rudimentar sobre o motor
- (anteriores) motor de treino, substituição F.2, correção da tela em branco (CSP nonce), etc.

## 5. Como rodar / testar
```bash
npm install
npm run dev            # ou: PORT=3000 npm run start  (após npm run build)
npm run typecheck && npm run lint && npm test && npm run build
```
Telas: `/` (landing) · `/onboarding` (login mock → "Entrar" → wizard → painel).
Verificação visual nesta sessão foi via Playwright global (`/opt/node22/lib/node_modules/playwright`),
viewport desktop. **Caveat:** no headless a fonte Plus Jakarta não carrega → texto aparece "colado"
nos screenshots; no navegador real fica espaçado.

## 6. Decisões/gotchas importantes
- **Tela em branco (resolvida):** CSP com `script-src 'self'` bloqueava scripts inline do Next →
  **nonce por requisição no `middleware.ts`** + `export const dynamic = 'force-dynamic'` no layout.
- **`ESCALA_PORCAO` 0,5×–3,0×** e **troca = equivalência só-kcal** são **spec oficial v1** (cofre, DF 2026-06-29).
- **Gate simetria do alto peso** é DF 2026-06-29 (já implementado + testado).
- **Porte fiel veio do HTML real** (estilos inline), não do README. Quem refinar visual deve abrir os
  `.dc.html` do cofre, não o README.
- **Nunca** usar `pkill -f next` (mata a sessão); matar servidor de teste com `fuser -k PORT/tcp`.
- **service_role** é `server-only` (`src/lib/supabase/admin.ts`), nunca `NEXT_PUBLIC_`.

---

## 7. Análise de segurança Auth/Authz (feita nesta sessão — backend NÃO implementado)
Estado: **pré-autenticação**. RLS bem desenhado mas **dormente**; webhook é o único endpoint endurecido.
- **Rotas não exigem auth** — middleware faz `getUser()` mas **descarta** o resultado (não protege nada).
- **Sem papéis** (admin/moderador). **Sem logout real** (o "Sair" só reseta estado React). **Sem timeout de inatividade**.
- **APIs de compute** (`/api/dieta` etc.) recebem **dados de saúde** sem auth nem rate limit.
- **Ownership** correto **no banco** (RLS `auth.uid()` em profile/plans/logs/feedback), mas **nenhum código usa**.
- **Positivo:** webhook (HMAC tempo-constante + idempotência + service_role pós-validação); `getUser()` (valida JWT).

**Plano de refatoração (20 tarefas criadas na sessão — registrar no cofre se quiser persistir):**
- **Auth:** (1) Supabase Auth real · (2) ligar login/cadastro · (3) logout real (`signOut`).
- **Gating:** (4) helper `requireUser()` · (5) middleware redireciona não-auth · (6) proteger APIs de compute · (7) catálogo authenticated.
- **Ownership:** (8) persistir via server client (RLS, nunca admin) · (9) testes de isolamento entre usuários · (10) guard-rail do admin client · (11) export/exclusão LGPD.
- **RBAC:** (12) decidir papéis (`app_metadata.role`) · (13) `requireRole` + RLS por papel · (14) isolar `/api/admin/*`.
- **Sessão:** (15) idle + absolute timeout · (16) verificar expiração/refresh do JWT.
- **Entitlement/Hardening:** (17) gate de assinatura ativa · (18) completar `resolverUserId` do webhook · (19) rate limit · (20) revisar logs (não logar saúde/tokens).
Caminho crítico: #1 → #4 → gating das rotas/APIs.

---

## 8. O que falta para "experiência completa" de website (front-end, antes do backend)
Hoje só existem 4 rotas: `/`, `/onboarding`, `/plano` (placeholder), `/conta` (placeholder). Faltam:

**Onda 1 — buracos visíveis (credibilidade):**
- Páginas **legais reais** (Privacidade 🔴, Termos 🔴, Aviso/Disclaimer 🔴, Contato) — hoje todos `href="#"`.
- **404** + **error** + **loading** customizados (não existem).
- **Banner de consentimento de cookies** (LGPD).
- Telas de **Cadastro (sign-up)** 🔴, **Esqueci a senha**, **confirmação de e-mail** (só existe login).

**Onda 2 — completar o produto:**
- **Sessão de treino guiada** 🔴 ("Começar treino" só troca de aba) — executar exercício → registrar séries/reps/carga → **timer de descanso** → próximo → resumo. É o recurso que mais falta.
- **Conta/Assinatura** (`/conta` placeholder; "Gerenciar/Cancelar" sem ação) + **Editar perfil** (botão sem ação).
- **Detalhe de exercício/prato** (imagem/vídeo/receita), **histórico**, **lista de compras**, usar o **"não curto"**.

**Onda 3 — polimento:** SEO/og por página, sitemap/robots, página do **Ebook** (R$ 27, linkada), skeletons, acessibilidade, **checkout** real (CTAs `data-checkout="kiwify"` → Kiwify).

> Recomendação: Onda 1 (legais + 404 + cookies + cadastro/senha) primeiro; depois a **sessão de treino guiada**.

---
*Próxima sessão: comece lendo este arquivo + `git log` da branch. Tudo é front-end mock até a Fase 1
(Auth/persistência). Não escrever no cofre.*
