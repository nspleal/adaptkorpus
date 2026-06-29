# Roadmap & Handoff — App Evokorpus

> Estado em **2026-06-28**. Branch de desenvolvimento: `claude/evokorpus-app-dev-9in0hs`.
> Documento de handoff para o autor atualizar o **cofre** (fonte de verdade) e seguir a pesquisa.
> A fonte de verdade de produto/decisões continua sendo o cofre; este doc é o espelho técnico.

---

## A. O que foi feito (sessão 2026-06-28)

**Fundação & app**
- Scaffold **Next.js 15** (App Router, TypeScript) + **PWA**; design system fiel à marca
  (paleta, Plus Jakarta Sans, SVG canônico — **K Ascendente** no logo, **K em Selo** no ícone do app).
- Telas: landing, **onboarding** (gate 18+ + consentimentos LGPD + questionário + PAR-Q →
  plano + cardápio), placeholders de conta/plano. O onboarding roda o motor **no navegador**.

**Motor determinístico** (`src/lib/engine`) — fiel à spec travada do cofre, **43 testes**
- **Gate de saúde** (precedência `ROTEAR>RESTRINGIR>PISAR>PERMITIR`, fail-safe).
- **Dieta A3** (Mifflin-St Jeor → GET/PAL → piso 1250/1550 → macros prot→gordura(clamp 20–30%)→carbo).
- **Montador de cardápio v0** (alérgeno absoluto, menor desvio calórico, desempate determinístico).

**Dados curados** (`src/lib/data` + `supabase/`) — dos `.xlsx` do autor, **validados Δ≈0**
- **125 alimentos** (TACO 4ª ed.) · **56 pratos** · **216 ingredientes** · **163 exercícios**.

**Backend (desenhado)** — `supabase/migrations/` 0001–0004
- Schema relacional + **RLS em toda tabela** (default-deny); `profile` com PAR-Q + consentimentos;
  `webhook_events` (idempotência). **Ainda não provisionado/conectado** (sem env/Auth).

**Segurança / LGPD**
- RLS, **CSP com nonce por requisição** (verificada em navegador real), webhook Kiwify com
  **HMAC + idempotência**, validação **zod** na borda (18+), segredo `service_role` server-only.

**Qualidade / verificação**
- **Error-hunt** (metodologia do cofre): round 1 determinístico (corpus de 2.700 bordas, zero
  violações) + round 2 cold-pass (poucos ajustes reais; falsos-positivos rejeitados com prova).
- 2 auditorias adversariais de segurança (workflows).

**Distribuição / testabilidade**
- Lançadores `.bat`/`.command` + **pacote portátil com Node embutido** (GitHub Actions → Release):
  baixar `.zip`, extrair, duplo-clique — **zero instalação** (estratégia do PIRAXIS).

---

## B. Estágio atual (Definition of Ready do cofre)

| Peça | Estado |
|---|---|
| A1 — exercícios | ✅ importado (163) |
| A2 — alimentos | ✅ importado (125 + 56 pratos, Δ≈0) |
| A3 — dieta | ✅ implementado + testado |
| **A3 — treino (FITT)** | ✅ **implementado + testado** (gate herdado, FITT, progressão, montador; corpus) |
| **A3 — substituição (F.2)** | ⏳ spec travada no cofre; **implementar** (próximo) |
| Gate de saúde | ✅ implementado + testado |
| B — schema + questionário/gates | ✅ desenhado; **montador v0** (faltam passos do Bloco B) |
| C — pacote legal | ⏳ textos em rascunho + **revisão jurídica** (portão) |
| D — infra | repo ✅ · Vercel ⏳ · **Supabase a provisionar** ⏳ · Kiwify ⏳ |
| Webhook Kiwify → Supabase | ⏳ esqueleto pronto; falta payload real + resolução de user_id |

**Resumo:** o app **roda e demonstra o motor de dieta de ponta a ponta** (local/portátil). Falta
**backend vivo (Auth + persistência)**, **motor de treino**, e o **portão jurídico** antes de lançar.

---

## C. Itens novos para arquivar no cofre (decisões/divergências)

> Regra do cofre: decisões novas voltam pelo autor para serem arquivadas lá. Lista do que mudou:

1. **Repo criado:** `nspleal/evokorpus` (privado); branch dev `claude/evokorpus-app-dev-9in0hs`.
2. **Motor implementado = spec executável:** o "falta implementar" da dieta/gate pode virar
   "implementado (motor + 43 testes)". Os números batem 1:1 com a spec.
3. **Montador v0 + lacunas do Bloco B** mapeadas: falta (a) relaxar **proteína até o piso** +
   usar **toda a largura da janela** antes de sinalizar; (b) relaxar **preferência** (veg/vegano)
   como último recurso — nunca o alérgeno; (c) ordem de busca/chave final completas.
4. **Divergência de dados a reconciliar no cofre:**
   - **Alérgeno "carne":** aparece na paleta real, mas a página `banco-alimentos` lista alérgenos
     **sem** "carne". Adicionei `carne` ao vocabulário do app. → conferir/!registrar no cofre.
   - **Pratos servem múltiplas refeições** (`Almoço/Jantar`, `Café/Lanche`…): o app usa
     `refeicoes[]` (lista). O cofre tratava refeição como única. → registrar.
5. **`contemAlergenos` derivado** da união dos ingredientes (mais seguro que a coluna declarada).
6. **Segurança implementada:** RLS, CSP por nonce, webhook HMAC + idempotência, server-only.
7. **Pacote portátil (Node embutido) + CI** = nova capacidade de distribuição (análoga ao PIRAXIS).
8. **error-hunt aplicada ao motor** (cold-pass) — há um **corpus de regressão** no repo.
9. **TACO:** atribuição p/ uso comercial segue **pendente no jurídico** (sem mudança).
10. **Ops:** cadastro na **Vercel** está bloqueado pelo anti-abuso (tentar via GitHub login).

---

## D. Fluxo de desenvolvimento futuro (faseado)

### Fase 1 — Backend vivo & Auth *(destrava persistência + metade da LGPD)*
- Provisionar **projeto Supabase** + aplicar migrations + `.env.local`/Vercel.
- **Supabase Auth** (cadastro/login/recuperação; 18+ na conta) + **gating** de `/plano` e `/conta`.
- Persistir `profile`/`plans`/`logs`/`feedback`; **exportar** e **excluir** dados (direitos LGPD).
- **Webhook Kiwify** real: resolver `user_id` (espelho de e-mail c/ RLS), confirmar payload/assinatura.

### Fase 2 — Motores de conteúdo *(Bloco A — fechando)*
- ✅ **Motor de treino (FITT)** implementado (gate herdado, prescrição, progressão, montador) + testes/corpus.
- ⏳ **Motor de substituição (F.2)** — spec travada no cofre; implementar o seletor (alimento + exercício:
  filtros duros → preferência → desempate determinístico → fallback; identidade vegana absoluta; piso de
  proteína da troca; mais-familiar para exercício) + testes.
- ⏳ Completar o **montador de dieta (Bloco B)**: relaxar proteína→piso, largura total da janela, relaxar
  preferência por último, ordem de busca/chave final + testes.

### Fase 3 — Superfícies do produto & loop de feedback
- Tela de **plano do dia** (treino + dieta), **registro** (treino/refeição/peso), **feedback** leve
  e **recálculo** automático. UX de **substituição**. Instrumentar a métrica-rainha (**churn**).

### Fase 4 — Compliance & lançamento
- **Revisão jurídica** (portão) + textos legais (termo, disclaimer, privacidade, reembolso) + TACO.
- **Marca INPI** (classes 41/42), domínios, handles sociais.
- **Deploy de produção** (Vercel) + domínio + PWA polido (ícones PNG, offline).

### Backlog transversal (hardening)
- Endurecer `style-src` da CSP, **rate limiting** no webhook, política de **retenção** + logs de
  acesso, **versionamento de consentimento**, ordenação de eventos do webhook por timestamp.

---

## E. Pesquisas que o autor precisa trazer (para destravar)

- [ ] **Números de treino (FITT)**: progressão semanal (overload + auto-regulação) → cofre.
- [ ] **Limiares de substituição** (kcal/macros/grupo; alergia = filtro absoluto) → cofre.
- [ ] **Payload real do webhook Kiwify**: nome do header de assinatura, **algoritmo** (SHA-1/256),
      campo de **event id** e de **timestamp**.
- [ ] **Agendar revisão jurídica** (portão de lançamento) + confirmar **licença TACO** (atribuição).
- [ ] **Marca:** classes INPI, domínios (`evokorpus.com/.com.br/.app`), handles sociais.

---
*Espelha o cofre (fonte de verdade). Detalhes técnicos: `docs/architecture.md`, `docs/security-lgpd.md`,
`docs/access.md`. Estado do código: branch `claude/evokorpus-app-dev-9in0hs`.*
