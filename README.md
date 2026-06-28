# Evokorpus — App

Treino e dieta que evoluem com você, todo dia. App adaptativo (PWA) com **motor de
regras determinístico** — **nada é gerado por IA em runtime**: tudo vem de fórmulas +
dados curados. Ferramenta educacional, dirigida pelo usuário, **18+**.

> A fonte de verdade de produto/decisões é o cofre (repositório `obsidian`). Este repo é
> onde o app é construído. Ver `CLAUDE.md` para as regras de trabalho deste repositório.

## Stack

- **Next.js 15** (App Router, TypeScript) + **PWA** → hospedagem **Vercel**
- **Supabase** (Postgres + Auth + Storage) — **RLS em toda tabela** (dado de saúde é sensível)
- **Kiwify** (assinatura recorrente → webhook → Supabase)
- **Tailwind CSS** com o design system de marca · **Vitest** (testes do motor)

## Início rápido (local)

```bash
npm install
cp .env.example .env.local   # preencha as chaves do Supabase (opcional p/ rodar a demo)
npm run dev                  # http://localhost:3000
```

A tela **/onboarding** roda o motor de ponta a ponta **no navegador** (gate de saúde →
alvo calórico → macros → cardápio de exemplo), sem precisar de backend. Persistência
(conta + histórico) exige configurar o Supabase — ver `docs/access.md`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm start` | build e execução de produção |
| `npm run typecheck` | checagem de tipos (tsc) |
| `npm run lint` | ESLint (next lint) |
| `npm test` | testes do motor (Vitest) |

## Estrutura

```
src/
├── app/                      # rotas (landing, onboarding, plano, conta) + api/webhooks
├── lib/
│   ├── engine/               # MOTOR determinístico (gate de saúde + dieta + montador) + testes
│   ├── data/                 # tipos do banco curado + cálculo nutricional + seed de demo
│   ├── brand/                # design system (SVG canônico do "K", wordmark)
│   ├── validation/           # zod (defesa na borda; 18+)
│   └── supabase/             # clients (browser/server/admin) + env
supabase/
├── migrations/               # 0001 schema · 0002 RLS · 0003 seed de referência
└── README.md                 # como aplicar e importar a base completa
docs/
├── security-lgpd.md          # postura de segurança e LGPD (prioridade do projeto)
├── access.md                 # como acessar, rodar e publicar
└── architecture.md           # motor, fluxo de dados, decisões
```

## Estado atual

Fundação (bloco D do roteiro) + **motor de dieta** (spec A3 travada) + **gate de saúde**
+ schema com RLS + onboarding funcional. **Pendente:** importar a base completa (163
exercícios / 125 alimentos / 56 pratos), motor de **treino**, Auth, e a **revisão
jurídica** (portão de lançamento). Detalhes em `docs/architecture.md`.
