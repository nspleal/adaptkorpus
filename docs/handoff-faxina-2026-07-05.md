# Handoff — Rodada de faxina (4 itens ratificados)

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

Data: 2026-07-05 · Branch: `claude/evokorpus-app-dev-9in0hs` · Sem dependência externa. **Nada no cofre.**

Os 4 itens vieram travados (DF 2026-07-04/05). Verificação: **#1 e #4 já estavam implementados e
testados nesta branch** — só confirmei; o trabalho de código foi **#2 (nome do ebook)** e **#3
(migração de VERSAO)**.

## #1 — Modelo de equipamento V8.5 — JÁ FEITO (commit `066dcf8`), verificado
Já presente e batendo com a spec: `Exercise.equipamentoExigidoQualquerUm` (any-of); e33/e109/e140 →
`[halteres, kettlebell]`; **e11 `[halteres]`** (sem banco); **e139 `[halteres]`** (sem 8º item);
e55/e125 `[halteres, banco]`; motivo dinâmico de descompasso em `favoritos-elegibilidade.ts`
("pede academia" / "pede {falta}"). **Confirmação de invariantes** (via `equipamento.test.ts`, verde):
`casa+[]` byte-idêntico ao antigo `nenhum`; varredura casa+[] com **EXATAMENTE os 3 vazios do e116**;
casa+7 e academia sem vazios. **O any-of e o e11-sem-banco NÃO alteraram nenhuma varredura de
disponibilidade** — só ampliam (kettlebell passa a ver goblet/farmer; e11 não é `casa_sem`, então o
piso `casa+[]` é intacto). Sem edição nesta leva.

## #4 — Curva de Cargas por sessão — JÁ FEITO (commit `b58d3b5`), verificado
`src/lib/cargas-serie.ts`: `serieCargaPorExercicio` = **1 ponto por sessão** (ordem cronológica),
`exerciciosComCarga` (só exercícios com kg). `cargas-serie.test.ts` ancora "3 sessões no mesmo dia →
3 pontos". Ratificado; sem edição.

## #2 — Nome canônico do ebook = "A Curva" (NOVO)
- `src/app/ebook/page.tsx`: `<h1>` e título da capa → **"A Curva"**; "O básico do fitness honesto"
  virou **subtítulo** (na capa e sob o h1); **removido** o `<AValidar>título e conteúdo final</AValidar>`
  e o import de `AValidar`; `metadata.title` → **"A Curva · Evokorpus"**. Eyebrow "Ebook" da capa fica
  (rótulo de categoria).
- `src/app/page.tsx` (landing): a faixa do ebook agora nomeia **"A Curva"**.
- `faq/page.tsx` já usava "A Curva" — inalterado.
- Rótulos de nav "Ebook" (`InstitucionalShell`, footer) permanecem genéricos (são rótulo de seção).
- **Nota:** o "[A validar: CNPJ / razão social]" que aparece no rodapé do ebook é do
  `InstitucionalShell` (placeholder legal compartilhado por TODAS as páginas institucionais) —
  intencional, fica até a validação jurídica. Não tem relação com o título do ebook.

## #3 — Migração de VERSAO: NUNCA descartar o perfil (NOVO)
`src/lib/session.ts`: `lerSessao` descartava (→ null) em qualquer `obj.v !== VERSAO`, o que num bump
apagaria todo perfil e jogaria no onboarding, anulando o `normalizarPerfil` (já aditivo/idempotente).
- Nova função PURA **`migrarSessao(raw, versaoAtual = VERSAO)`**: migra `v <= versaoAtual` via
  `normalizarPerfil` e marca `migrou`; descarta só o irrecuperável (JSON quebrado, sem `perfil`,
  `v` ausente/futuro). `lerSessao` a consome e, se `migrou`, **re-carimba** (`salvarSessao`) — o perfil
  nunca se perde. **`VERSAO` mantido em 1** (zero impacto nos usuários atuais); a mecânica já cobre o
  próximo bump. Alinha `evk_sessao` ao padrão "normaliza, não descarta" dos outros stores.
- Seam p/ o futuro: se um campo mudar de tipo/renomear, um pré-transform por versão entra ANTES do
  `normalizarPerfil` (hoje desnecessário — tudo é aditivo).
- Testes `src/lib/session.test.ts`: versão antiga (`v=1`, atual=2) migra (`migrou:true`, equipamento
  `casa`, checklist `[]`, favoritos `[]`); `v=99`/sem-perfil/`v` ausente/JSON quebrado → null; e o
  round-trip de `lerSessao` (stub de localStorage) re-carimbando para a VERSAO atual.

## Verificação
- `typecheck` ✔ · `lint` ✔ · `test` **294 verdes** (+4 do `session.test.ts`) · `build` ✔.
- **E2E Playwright** (build de produção, zero erros de console):
  - `/ebook`: `<h1>` = **"A Curva"**, subtítulo presente, e o marcador do TÍTULO
    ("[A validar: título e conteúdo final]") **removido** — o único `[A validar]` restante é o CNPJ do
    rodapé legal. (Screenshot anexo.)
  - **Migração de versão:** semeado `evk_sessao = {v:0, perfil legacy(equipamento:'nenhum')}` →
    navegar a `/app` → **fica em `/app`** (NÃO cai no `/onboarding`), `localStorage` re-carimbado para
    `v:1`, equipamento migrado para `casa`. Prova a política "perfil antigo não é descartado".

## Confirmações pedidas
1. **any-of / e11-sem-banco não alteraram varreduras** — `casa+[]`, `casa+7` e `academia` seguem
   idênticos (invariantes de `equipamento.test.ts` verdes; e11 é `casa_com`, não toca o piso).
2. **Migração de versão** — perfil de versão antiga carrega migrado e **não cai no onboarding**
   (unit + E2E acima).
