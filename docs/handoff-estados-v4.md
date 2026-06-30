# Handoff — Estados de sistema, vazios e carregamento (V4)

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/evokorpus-app-dev-9in0hs`. Commit: `b7b6091`.
> Origem estética: `V4_front_end_evoK.zip` → `design_handoff_estados_sistema/Evokorpus Estados.dc.html`
> (17 estados — Parte A sistema, Parte B vazios, Parte C carregamento). A "casca de revisão"
> do protótipo (catálogo de chips) foi descartada, como manda o handoff.

## O que entrou

Biblioteca reutilizável fiel em **`src/components/estados/`**:
- `ui.tsx` — `EmptyCard` (card tracejado + medalhão + título + apoio + ação + motivo do logo),
  `EstadoSistema` (tela cheia), `Medalhao` (variantes neon/erro/folha), `Shimmer` +
  `SkeletonHoje`/`SkeletonLista`/`SkeletonGrafico`, `AssinaturaMotivo`.
- `BotaoLoading.tsx` — CTA com estado de carregamento (spinner + `disabled` + `cursor:progress`).
- `OfflineGuard.tsx` — detector de conexão.
- Keyframe `evkShimmer` em `globals.css` (+ respeito a `prefers-reduced-motion`).

### Parte A — Estados de sistema
| Estado | Onde vive | Status |
|---|---|---|
| A1 404 | `src/app/not-found.tsx` | **ligado** — trajetória quebrada (X em Alerta + ponto Pulso piscando) |
| A2 erro | `src/app/error.tsx` | **ligado** — medalhão vermelho; nunca expõe stack/dado |
| A3 offline | `OfflineGuard` no `layout.tsx` | **ligado** — `navigator.onLine` + eventos → overlay tela cheia |
| A4 acesso restrito | `src/app/acesso-restrito/page.tsx` | **ligado (rota)** — segmentado sessão/assinatura; vira a tela do guard quando o auth existir |

### Parte B — Estados vazios
| Estado | Onde | Status |
|---|---|---|
| B1 sem plano | aba Hoje pré-onboarding | componente pronto (no app atual o painel só existe pós-onboarding) |
| B2 dia de descanso | aba Treino | componente pronto (depende de detecção de rest-day na rotina) |
| B3 histórico treinos | painel → Histórico → Treinos | **ligado** — empty-card fiel |
| B4 histórico dieta | Histórico → Dieta | componente pronto (não há registro de refeições ainda) |
| B5 sem peso | Progresso/gráfico | componente pronto (o painel semeia o peso inicial, então não há 0-estado) |
| B6 lista de compras vazia | painel → Dieta → Lista | **ligado** — empty-card quando não há cardápio |
| B7 sem troca segura | modal Trocar | componente pronto (condição: busca de troca retorna vazio) |
| B8 encaminhamento | gate (onboarding) | **ligado** — GateB com 2ª ação "Ver conteúdos gerais" → /aviso |

### Parte C — Carregamento
| Estado | Status |
|---|---|
| C1 "Montando seu plano…" | **ligado** (onboarding) |
| C2 Hoje skeleton · C3 Lista skeleton · C4 Gráfico skeleton | **componentes prontos** (`SkeletonHoje/Lista/Grafico`) — sem loading real sem backend |
| C5 botão em ação | **componente pronto** (`BotaoLoading`) — usar em qualquer CTA na fase de backend |

> **Ligado** = renderiza numa condição/rota real hoje. **Componente pronto** = fiel e exportado,
> aguardando a condição (backend ou feature) para ser plugado — a fase de backend conecta cada um
> ao sinal real (`isLoading`, `isRestDay`, `weighIns.length===0`, troca-sem-opção, etc.).

## Travas de copy/produto mantidas (V4 §262)
Toda tela vazia tem **ação de saída clara**; **tom sem culpa** (o erro é do sistema); **erro nunca
expõe** stack/dado sensível; **sem "IA"** → "regras adaptativas"; **sem promessa**; **18+**; neon
`#BDFF00` só no escuro; vermelho `#E5484D` só funcional; skeletons **espelham a forma do conteúdo**
(nunca spinner genérico); respeita `prefers-reduced-motion`.

## Qualidade
`typecheck` · `lint` · **130 testes** · `build` — verdes. E2E (Playwright), **zero erros de console**:
404, offline overlay, acesso restrito (toggle sessão/assinatura), skeletons + botões-loading, e o
vazio do Histórico (B3) no painel real.

## Pendências que voltam por você (cofre)
- [ ] Confirmar se os **estados "componente pronto"** (B1/B2/B4/B5/B7, C2–C5) devem ser plugados já
      na fase de backend (mapa de sinais no §State Management do V4) ou se algum é dispensável.
- [ ] **B5 sem peso**: hoje o painel semeia o peso do onboarding como 1º registro — decidir se o peso
      inicial conta como "registro" (não mostra B5) ou se deve começar vazio (mostra B5).
- [ ] **A4 / offline**: textos e ações finais quando o auth/assinatura real existir (login, /conta, suporte).

## Arquivos
**Novos:** `src/components/estados/{ui,BotaoLoading,OfflineGuard}.tsx`, `src/app/acesso-restrito/page.tsx`.
**Alterados:** `src/app/{not-found,error,layout}.tsx`, `src/app/globals.css` (evkShimmer),
`src/app/onboarding/page.tsx` (B8), `src/components/painel/{Painel,ListaCompras}.tsx` (B3/B6).
