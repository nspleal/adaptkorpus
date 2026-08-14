# Handoff — Onda de polimento: Segundos · Hora · Prato · Banner de privacidade

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/evokorpus-app-dev-9in0hs`. Commit: `8ebe8b7`. Fontes: cofre
> (`ranking §Unidade de registro` + `parametros-motor-treino §Isométricos DF 2026-07-03`) e o
> pacote `design_handoff_banner_privacidade`. Portei fiel; travas honradas.

## 1. "Segundos" nos 5 isométricos ✅ (completo — registro + detalhe + guiado)
- **Fonte tabelada e testada:** `src/lib/engine/isometricos.ts` (+`isometricos.test.ts`, 6 testes)
  — `repUnitDe(id)`, `HOLD_SEGUNDOS` (faixas por nível **verbatim** do cofre: Prancha 20–40/40–70/
  70–120 · Prancha lateral 15–30/30–50/50–90 · Agachamento na parede 20–45/45–75/75–120 · Pendura
  10–25/25–50/50–90 · Pegada estática 15–30/30–60/**60–90+**), `faixaSegundos(id, nivel)`, `PISO_HOLD_SEG=10`.
  Não toca a `Exercise` gerada nem o xlsx (a curadoria dos 5 ids mora aqui, citando o cofre).
- **Sessão guiada** (`SessaoTreino`): holds mostram **"N–N s" pela faixa do NÍVEL do usuário** (ex.:
  iniciante → Prancha "1 × 20–40 s"), rótulo **"Isométrico · tempo"**, cabeçalho/placeholder **"Segundos"**,
  **sem RIR** (cofre: "RIR não se aplica a holds") e **sem carga/volume** (time-only — evita "segundos × kg").
- **Registro manual** (`RegistrarTreino`): cabeçalho **"Segundos"** e sem coluna de carga p/ holds.
- **Detalhe da sessão** (`DetalheModais`): unidade **"s"** nas séries dos holds.
- 🔁 **Volta por você (deferido, com base no cofre):** (a) **farmer hold #140** é time-only agora — o
  **peso opcional** ("carga natural") fica p/ o **"Bloco B"** do cofre; (b) a **progressão dinâmica** dos
  holds (+5–10 s / na medida, −5–10 s ou modificação / 2× difícil, piso 10 s) é feature de **motor** e não
  entrou — hoje o guiado mostra a **faixa estática do nível**, que é o que a UI já fazia p/ reps.

## 2. Hora no detalhe da sessão ✅
- `DetalheSessao` exibe a **hora** coletada no registro manual (ao lado do rótulo/data). Sessões guiadas
  não têm hora — some sozinho.

## 3. Prato sem "modo de preparo" ✅
- Removido o bloco "Modo de preparo em breve" do `DetalhePrato` (descartado — não é app de culinária).
  Mantido o placeholder "Imagem do prato · em breve" (não foi pedido).

## 4. Banner de privacidade ✅ (aviso, não consentimento)
- **`src/components/AvisoPrivacidade.tsx`** — porte fiel de `banner-reference.html`: faixa Carvão + Bone,
  ícone escudo-check, **copy verbatim** ("Usamos apenas uma medição anônima de uso (sem cookies de
  rastreio)… **Nenhum dado de saúde é usado para publicidade.**"), link "Saiba mais" → `/privacidade`,
  **ação única "Entendi"** (pill Pulso). Persiste em `localStorage evk_privacy_ack_v1`; entrada slide-up /
  saída slide-down + remoção do DOM; responsivo (≤640px empilhado), `prefers-reduced-motion`,
  `role="region"` `aria-live="polite"`, não-modal, não bloqueia scroll. **Sem vermelho.**
- Montado no `layout.tsx` (após `{children}`); **oculto dentro do painel `/app`** (é aviso do site
  institucional/landing). Não é gate — o analytics cookieless roda independente. CSS em `globals.css`
  (`.evk-cookie*` + `@keyframes evkCookieIn`). Fecha a **Onda 1** de credibilidade/LGPD.

## Qualidade
`typecheck` · `lint` · **172 testes** (+6 isométricos) · `build` — verdes. E2E (Playwright, **zero erros
de console**): guiado com Prancha **"1 × 20–40 s"** (iniciante) sem RIR/carga; registro manual "Segundos"
sem carga; detalhe "45 s" **+ hora**; prato **sem** "Modo de preparo"; banner na landing (texto + frase de
saúde + "Saiba mais" `/privacidade` + "Entendi" persiste e some no reload + **ausente em `/app`** + sem
vermelho).

## Arquivos
**Novos:** `src/lib/engine/isometricos.ts` (+`isometricos.test.ts`), `src/components/AvisoPrivacidade.tsx`.
**Alterados:** `SessaoTreino.tsx`, `RegistrarTreino.tsx`, `DetalheModais.tsx` (segundos + hora + remove
modo-de-preparo), `app/layout.tsx` + `globals.css` (banner), `changelog/page.tsx`.
