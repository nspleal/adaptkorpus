# Adaptkorpus — App

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

## Início rápido — Windows, SEM instalar nada (pacote portátil)

Igual ao PIRAXIS: um pacote com o **Node embutido**, construído na nuvem.

1. Vá na aba **Releases** do repositório → **"App Adaptkorpus — pacote portátil (Windows)"**.
2. Baixe **`adaptkorpus-portatil-windows.zip`**, **extraia** e dê **duplo-clique** em
   **`INICIAR APP ADAPTKORPUS.bat`**. O app abre sozinho em `http://localhost:3000`.

(O pacote é gerado automaticamente a cada atualização do código — ver
`.github/workflows/portable-windows.yml`.)

## Início rápido — a partir do código (precisa do Node)

> Precisa do **Node.js 20+** instalado (https://nodejs.org).

- **Windows:** dê **duplo-clique** em **`[DEV] iniciar (precisa Node instalado).bat`**
- **Mac / Linux:** dê duplo-clique em **`[DEV] iniciar (Mac e Linux, precisa Node).command`**
  (no Mac, na 1ª vez: botão direito → Abrir)

O lançador instala as dependências na 1ª vez (alguns minutos), sobe o app e **abre o
navegador sozinho** em `http://localhost:3000`. Para parar, feche a janela.

Na tela **Começar → /onboarding** o motor roda de ponta a ponta **no navegador** (gate de
saúde → alvo calórico → macros → cardápio de exemplo), **sem precisar de backend**.

## Início rápido — pela linha de comando

```bash
npm install
npm run dev                  # http://localhost:3000
```

Persistência (conta + histórico) exige configurar o Supabase — ver `docs/access.md`.

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
│   ├── data/                 # base curada (foods/recipes/exercises) + cálculo nutricional
│   ├── brand/                # design system (SVG canônico do "K", wordmark)
│   ├── validation/           # zod (defesa na borda; 18+)
│   └── supabase/             # clients (browser/server/admin) + env
supabase/
├── migrations/               # 0001 schema · 0002 RLS · 0003 base completa · 0004 idempotência
└── README.md                 # como aplicar as migrations
docs/
├── security-lgpd.md          # postura de segurança e LGPD (prioridade do projeto)
├── access.md                 # como acessar, rodar e publicar
└── architecture.md           # motor, fluxo de dados, decisões
```

## Estado atual

Fundação (bloco D) + **motor de dieta** (spec A3 travada) + **gate de saúde** + schema com
RLS + **base completa importada** (125 alimentos · 56 pratos · 163 exercícios, validada Δ≈0)
+ onboarding funcional. **Pendente:** motor de **treino** (FITT — números a travar no cofre),
Auth + gating, e a **revisão jurídica** (portão de lançamento). Detalhes em
`docs/architecture.md`.
