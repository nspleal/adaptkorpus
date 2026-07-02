# Handoff — Porte de conteúdo/decisão do cofre → código (V6.3)

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/evokorpus-app-dev-9in0hs`. Commit: `ee85762`.
> Portei os 5 itens que já estavam prontos no cofre. Fiel aos estilos/tokens; travas honradas.

## O que foi portado

### 1. Erros comuns dos 163 exercícios ✅
- **Fonte:** `conceitos/erros-comuns-exercicios-evokorpus` (tabela `# | Exercício | Erros comuns`, 163 linhas).
- **Dado gerado (reprodutível):** `scripts/gerar-erros-comuns.mjs` lê a markdown do cofre + `exercises.ts`
  e **valida** que cada nome bate com `EXERCISES[e#].nomePt` (hard-fail em divergência → pega
  reordenação/dessincronia); emite `src/lib/data/erros-comuns.ts` (`e1..e163` → lista de "erro → correção",
  489 itens). Re-rodar → diff vazio. A markdown **não** entra no repo (é do cofre); só o TS gerado.
- **UI:** nova seção **"Erros comuns"** no **detalhe do exercício** (após "Como fazer") e na **sessão
  guiada** (`<details>` ao lado de "Como fazer"). Marcador **NEUTRO** (bolinha Bone + erro em tom
  esmaecido → correção em Bone) — **sem o ❌ vermelho**: no app o vermelho é reservado a erro/segurança;
  um erro de execução é educacional. Trava do cofre honrada: dica geral, nunca "previne lesão"/"corrige
  postura".

### 2. FAQ completo (30 Q&A) ✅
- **Fonte:** `conceitos/faq-evokorpus` — as 5 categorias (Assinatura/preço/cancelamento · Treino · Dieta ·
  Conta e dados · Saúde/legal/18+), **verbatim**. A V6 tinha 11; agora são as 30.
- Removi os `[A validar]` da FAQ onde o cofre já fixa o fato (R$ 29/mês + R$ 27 ebook · 7 dias · reembolso
  7 dias/2 dias úteis · 167 alimentos/96 pratos · 35 veganos/29 vegetarianos · suporte e-mail+WhatsApp
  24–48h · Pix/boleto/cartão). A busca (`FaqBusca`) já filtra as 30.
- **Obs.:** os `[A validar: CNPJ / razão social / data]` que aparecem no **rodapé institucional** são de
  outro componente (dados da pessoa jurídica), **não** da FAQ — seguem pendentes por você.

### 3. Copy "curtir" → "gostar" ✅
- 4 frases de troca/variedade unificadas: landing ("Não gostou de um exercício ou alimento?") e os modais
  de troca ("Não gostou? Gere mais." / "Não gostei de nenhuma — gerar mais variedade").

### 4. "Dia de treino registrado" = qualquer treino ✅ — **UI nova, precisa do seu olhar de design**
- **Decisão do cofre** (`registro-de-aderencia-evokorpus` §Marcos, 2026-07-02): conta **qualquer treino
  registrado**, não só a sessão guiada concluída.
- **Implementação:** `registrarTreinoManual()` grava o dia como treinado (sem séries/volume/feedback,
  `manual:true`) em `evk_treinos`; os **marcos** já contam **dias distintos** → passam a contar o registro
  manual automaticamente.
- **Affordance (nova, sem handoff de design):** no cartão "Treino de hoje" (aba Hoje), link secundário
  **"Treinei por fora? Registrar treino de hoje"**. **Guarda anti-duplicidade:** se já treinou hoje
  (guiado ou manual), o link vira o estado **"Treino de hoje registrado"** — não infla e é honesto.
- **Histórico:** entradas manuais aparecem como **"Treino registrado"** (linha simples, sem "N séries · N
  kg", que seria 0/0; não clicável — nada a detalhar).
- 🎨 **Volta por você:** esta micro-UI (link + estado registrado + linha no histórico) foi feita mínima e
  on-brand, **sem** protótipo do Claude Design. Se quiser arte/variação, me manda que eu porto fiel.

### 5. Changelog real ✅
- Troquei os 5 exemplos ilustrativos pelos **releases de verdade** (compilados do histórico de commits),
  agrupados por mês (Julho/Junho 2026), tags **Novo** (Pulso) / **Melhoria** (Bone) — **sem vermelho**.
  Removi a pílula "Exemplos ilustrativos de formato". Alimentar a cada release.
- *(Marcos > 30 dias seguem EM ABERTO no cofre → não mexi; cap 30/30 mantido.)*

## Qualidade
`typecheck` · `lint` · **165 testes** · `build` — verdes. E2E (Playwright, **zero erros de console**):
detalhe do exercício com "Erros comuns" **sem vermelho** (ex.: Barra fixa supinada); /faq com as 30 Q&A +
busca; landing/app dizem "Não gostou?" (sem "curtiu"); aba Hoje → "Registrar treino de hoje" → estado
"registrado" + entra no histórico + **persiste no reload**; /changelog com releases reais, sem "ilustrativo".

## Arquivos
**Novos:** `scripts/gerar-erros-comuns.mjs`, `src/lib/data/erros-comuns.ts`,
`src/components/painel/ErrosComuns.tsx`.
**Alterados:** `DetalheModais.tsx`, `SessaoTreino.tsx` (erros comuns); `faq/page.tsx` (30 Q&A);
`app/page.tsx` + `Painel.tsx` (curtir→gostar); `Painel.tsx` + `treino-historico.ts` (registro manual);
`changelog/page.tsx` (releases reais).

## Pendências que voltam por você
- [ ] **Registro manual de treino** — quer arte/variação de design para a affordance nova? (item 4).
- [ ] **Marcos > 30 dias** — segue em aberto no cofre (níveis 60/90 ou 30 vira teto).
- [ ] **`[A validar]` do rodapé institucional** — CNPJ/razão social/data da pessoa jurídica (jurídico).
