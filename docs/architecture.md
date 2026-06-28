# Arquitetura — App Evokorpus

## Visão

Frontend Next.js (PWA) + motor determinístico em TypeScript puro + Supabase (dados/auth) +
Kiwify (assinatura). A "inteligência" é **regra + dado**, nunca IA em runtime.

## O motor (`src/lib/engine`)

Pipeline determinístico (`gerarDieta`): **gate de saúde → dieta → montador**.

```
PerfilUsuario ─▶ avaliarGateSaude ─▶ comportamento
                                     │  ROTEAR  ─▶ nenhum plano (orienta profissional)
                                     └─ PERMITIR/PISAR/RESTRINGIR
                                        └▶ gerarPlanoDieta (kcal-alvo + macros + janela)
                                           └▶ montarCardapioDia (pratos do banco)
```

### Gate de saúde (`health-gate.ts`)
Espelha `gate-de-saude-evokorpus`. Precedência **ROTEAR > RESTRINGIR > PISAR > PERMITIR**.
Fail-safe: input implausível → ROTEAR. Aviso universal IMC < 18,5.

### Dieta (`diet.ts` + `constants.ts` + `formulas.ts`)
Espelha `parametros-motor-dieta-evokorpus` (spec A3, v10): Mifflin-St Jeor → GET (PAL) →
fator por objetivo (com piso) → macros na ordem **proteína → gordura (clamp 20–30%) →
carboidrato (resto)**. 4/4/9 só para a meta.

### Montador (`assembler.ts`) — Bloco B, **v0**
Garante: **alérgeno = filtro absoluto** (nunca relaxado), mira a janela, desempate por
**menor desvio calórico**, chave final **lexicográfica sobre os ids** (reprodutível).
Limitação do v0: 1 prato por refeição, sem escalar porções nem relaxar proteína até o piso
— documentado para evolução.

> **Determinismo é requisito legal**, não só de engenharia: o "resultado auditável"
> sustenta o enquadramento. Por isso o motor não usa relógio, rede nem aleatoriedade.

## Dados (`src/lib/data`)

Modelo **relacional**: `foods` → `recipes` → `recipe_items` (join). kcal/macros de um prato
= **soma dos ingredientes** (TACO × gramas), nunca por 4/4/9 (`nutrition.ts`). A base completa
(125 alimentos · 56 pratos · 163 exercícios, validada Δ≈0) vive em `foods.ts`/`recipes.ts`/
`exercises.ts` (gerados do xlsx do autor) e espelha o seed SQL (`0003`). Pratos têm `refeicoes`
como **lista** (um prato pode servir almoço E jantar).

## Banco (`supabase/`)

Tabelas: conteúdo curado (`foods/recipes/recipe_items/exercises`) + usuário
(`profile/plans/logs/feedback`) + `subscription`. **RLS em todas** (ver
`docs/security-lgpd.md`). `profile` carrega o questionário, o PAR-Q e os consentimentos.

## Fronteiras de confiança

- **Browser**: anon key + RLS. Nunca vê a service_role.
- **Servidor** (route handlers/middleware): cookies de sessão; webhook valida HMAC antes de
  confiar; admin (service_role) só em código server-only.

## O que falta (roadmap deste repo)

- ~~Importar a **base completa**~~ ✅ feito (125 alimentos · 56 pratos · 163 exercícios, Δ≈0).
- Motor de **treino** (FITT) + **substituição** — quando os números (A3) forem travados no cofre.
- **Auth** (Supabase) + gating de rotas + telas de plano/registro/conta reais.
- **Webhook** completo (resolução de user_id, idempotência, rate limit).
- **Revisão jurídica** (portão de lançamento) + textos legais + exportação de dados (LGPD).
- Hardening de CSP (nonce). Ver `docs/security-lgpd.md`.
