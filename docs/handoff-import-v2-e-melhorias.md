# Handoff — Import V2 (167+96) + melhorias adotadas no app

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/adaptkorpus-app-dev-9in0hs`. Commits: `395b534` (dados V2) ·
> `b159d14` (suporte real) · `789aedd` (offline + analytics).
> Fontes: `paleta-alimentos-adaptkorpus-V2-limpa.xlsx` + `pratos-adaptkorpus-V2.xlsx`
> (enviadas pelo autor) + decisões de `verificacao-adaptkorpus-2026-07-01` §5.

## 1. Banco V2 IMPORTADO — 167 alimentos · 96 pratos · 363 ingredientes

- **Pipeline reproduzível novo:** `scripts/gerar-seed.mjs` (xlsx → TS). **Valida TUDO antes
  de escrever** (hard-fail): contagens 167/96/363 · tipos **35/29/32** · ids únicos (gaps do
  dedupe preservados) · refs · `rotulo_amigavel` 100% e único · **Δ=0** (kcal do prato = Σ
  das linhas arredondadas — a convenção da planilha; macros = Σ exata) · tipo recomputado
  (regra **grupo+nome com exceção do ovo**, a mesma do handoff-pratos §4) · Atwater com piso
  de 25 kcal (pega troca de coluna; hortaliças de baixa kcal são dado TACO legítimo).
- **Fidelidade comprovada:** re-rodar o script → diff vazio (determinístico); os 56 pratos v1
  saíram **byte-idênticos**; os 125 alimentos v1 fizeram round-trip **sem nenhum drift** de
  macro. As planilhas NÃO são commitadas (artefato do autor); só o TS gerado.
- **Rótulos oficiais no produto:** `Food.rotuloAmigavel` agora existe no seed (vocabulário do
  cofre). O usuário vê o rótulo em **3 lugares** (como manda a DF): autocomplete do "não
  curto" (paleta **63→93** alimentos), **detalhe do prato** e **lista de compras** — o nome
  clínico TACO virou só proveniência interna. O mapa `APELIDO` hardcoded morreu.
- **Efeitos no cardápio (E2E, zero erros de console):** vegano ganhou os pratos novos de
  maior proteína (shake 16,3 g · pão de soja) — gargalo fechado; café/lanche onívoro 1→8
  (o cardápio onívoro de teste já abriu com "Sanduíche de presunto e queijo").
- **⚡ Performance do motor:** com a V2 a busca combinatória foi a ~2,3M combinações (~1 s por
  cardápio). Otimizei o loop (aritmética escalar, zero alocação) com saída **BIT-IDÊNTICA**
  comprovada em 48 cenários: **995 → 209 ms (4,8×)**. Determinismo intacto.

## 2. Melhorias adotadas — implementadas agora (sem layout novo)

- **Envio real do formulário de suporte** (§Confiança 12): `POST /api/suporte` com validação
  na borda, honeypot anti-bot, rate limit 5/10min, e-mail via Resend em **texto puro**
  (`reply_to` do usuário). **Env-gated:** sem `RESEND_API_KEY`+`SUPORTE_EMAIL_DESTINO` o
  formulário mantém o aviso honesto de demonstração — nunca fingimos envio. **Nunca logamos
  nome/e-mail/mensagem** (LGPD). → Falta só você criar a conta Resend e pôr as envs na Vercel.
- **Analytics privado** (§Confiança 10): Vercel Web Analytics — **cookieless**, hash anônimo,
  sem dado de saúde. Só ativa em produção NA Vercel (o build portátil não emite beacon).
  (Nota p/ /privacidade: citar o provedor de medição — vai junto no design da página.)
- **Offline-first do plano do dia** (§Produto 2): service worker próprio (~90 linhas,
  auditável, zero deps) — um `/app` já visitado **renderiza offline** (shell do cache +
  plano recomputado do localStorage). OfflineGuard evoluiu: no `/app` offline mostra
  **banner não-bloqueante** ("seu plano salvo continua disponível"); nas demais rotas mantém
  o overlay honesto.

## 3. Qualidade

`typecheck` · `lint` · **158 testes** (+3 rate-limit, data.test re-ancorado com âncoras V2)
· `build` — verdes. E2E Playwright (**zero erros de console**): detalhe/compras com rótulos
(0 nomes clínicos na tela), autocomplete acha "Presunto" (novo V2), cardápio vegano com os
pratos novos, **reload do /app offline renderiza o plano + banner**, suporte sem env = demo
honesto, `sw.js` servido fora do middleware, CSP com `worker-src`.

## 4. Pendências que voltam por você (cofre)

- [ ] **Leite `a32` re-sourcing** — a planilha V2 já traz carb da USDA (60 kcal · 4,7 C);
      confirmar se isso FECHA a pendência 🔴 ou se ainda vai trocar a linha da TACO.
- [ ] **Grão-de-bico cozido** — segue fora dos pratos (só cru na TACO), como decidido.
- [ ] **Copy do banner offline** — usei *"Você está sem conexão — seu plano salvo continua
      disponível."*; ajusto se o cofre preferir outra voz.
- [ ] **Envs do suporte** (Resend) e **deploy na Vercel** p/ o analytics ativar.

## 5. Arquivos

**Novos:** `scripts/gerar-seed.mjs`, `src/lib/rate-limit.ts` (+ teste),
`src/app/api/suporte/route.ts`, `public/sw.js`, `src/components/pwa/RegistroSW.tsx`.
**Regenerados:** `src/lib/data/{foods,recipes}.ts` (167/96, com `rotuloAmigavel`).
**Alterados:** `types.ts` (campo novo), `paleta-alimentos.ts` (lê do seed),
`DetalheModais/ListaCompras` (rótulos), `assembler.ts` (busca otimizada bit-idêntica),
`ContactForm.tsx` (envio real), `layout.tsx` (Analytics+RegistroSW), `middleware.ts`
(worker-src + exclusão sw.js), `OfflineGuard.tsx` (banner /app), `.env.example`,
`data.test.ts` (âncoras V2).

---
*A lista do que precisa de DESIGN (7 itens p/ o Claude Design) vai em documento separado —
nada foi criado sem arte, conforme combinado.*
