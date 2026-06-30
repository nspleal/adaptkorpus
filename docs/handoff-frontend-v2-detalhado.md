# Handoff detalhado — Porte do front-end (protótipo V2) · Evokorpus app

> **Documento de insumo para o cofre (obsidian).** Esta sessão (Claude Code na nuvem, repo do
> **app**) NÃO escreve no cofre — escritor único é a sessão local. Este arquivo reúne tudo que
> foi feito, com detalhe suficiente para você arquivar como página(s) de fonte/decisão.
>
> - **Repo:** `nspleal/evokorpus` · **Branch:** `claude/evokorpus-app-dev-9in0hs`
> - **Origem estética:** `V2_front_end_evoK.zip` → `design_handoff_evokorpus_completo/Evokorpus App.dc.html`
> - **Natureza:** UI 100% ligada ao **motor determinístico real** (`src/lib/engine`). **Sem backend** ainda.
> - **Stack:** Next.js 15 (App Router, TS), Tailwind + estilos inline, Vitest, zod, `output: standalone`.

---

## 0. Sumário executivo

Portei **fielmente** o protótipo estético V2 (`.dc.html`) para React/Next, reproduzindo
estética **e** movimento (keyframes + reveals + timers), e ligando cada tela ao motor real
(gate de saúde, dieta TACO, treino FITT, substituição, escala de porção). Foram **6 ondas**,
cada uma com `typecheck` + `lint` + **130 testes** + `build` verdes e verificação E2E
(Playwright) com **zero erros de console**.

Telas portadas: **Cadastro, Login, Redefinir, Confirmar, Onboarding (sem login), Sessão de
treino guiada, Conta e assinatura, Histórico, Lista de compras, Editar perfil + Recalcular,
e modais de detalhe (prato / exercício / sessão)**.

---

## 1. Regra de trabalho a TRAVAR no cofre

**Todos os protótipos estéticos de front-end vêm no estilo `.dc.html`** (HTML com estilos
inline + keyframes em `<style>`, marcação `sc-if`/`sc-for` de prototipagem). O porte deve:

1. **Reproduzir a estética e o movimento exatamente** — nunca redesenhar de memória nem
   "simplificar" animações. Ler o `.dc.html` 100%, copiar `style={{}}` inline e keyframes.
2. **Sobrescrever fórmulas, números e fontes do protótipo** quando divergirem do cofre — o
   protótipo não enxerga o cofre. O **motor/valores reais do cofre prevalecem**.
3. Comportamentos `sc-if`/`sc-for` viram **estado React** + listas; animações de "draw/reveal"
   viram classes + `IntersectionObserver`/`setInterval`.

> Histórico: na V1 eu inicialmente reconstruí a partir do README (tokens destilados) e
> **perdi movimento** — o humano corrigiu. A regra acima nasceu daí.

---

## 2. Princípios inegociáveis — onde cada um aparece

| Princípio | Como foi honrado no código |
|---|---|
| **Nada de IA em runtime** | Copy nunca diz "IA" → usa "regras adaptativas". Tudo deriva do motor puro. |
| **18+** | Gate de idade no cadastro (consentimento) e no onboarding (idade ≥ 18 valida); selo/disclaimer 18+ em cadastro, login, conta, perfil. |
| **Sem promessa de resultado** | "ponto de partida", "estimativa de referência", "É um guia, não uma meta exata". |
| **Fora do território clínico** | Gate de saúde roteia para profissional (Desfecho ROTEAR → tela GateB); modal "Senti dor" orienta pausar/procurar profissional. |
| **LGPD desde o início** | `/conta` tem "Baixar meus dados" e "Excluir conta"; consentimento LGPD no cadastro. (Persistência real é backend.) |
| **Determinismo auditável** | "Recalcular plano" roda o mesmo motor puro; mesmo input → mesma saída. |
| **Fidelidade visual** | SVG da logo = construção canônica (K com traços + 3 nós neon na trajetória); neon `#BDFF00` só no escuro. |

---

## 3. Tokens & movimento (do README do V2 — **confirmar no brand board**)

**Cores:** Floresta `#0D2818` · Carvão `#0F0F0E` · Folha `#16A34A` · Pulso/neon `#BDFF00`
· Bone `#EAE5DB` · Alerta `#E5484D` · Aviso/senha `#E5C04D`.
Regra: **neon só em fundo escuro**; no claro o acento é Folha `#16A34A`.

**Tipografia:** Plus Jakarta Sans (400/500/600/700/800). **Easing padrão:** `cubic-bezier(.22,.61,.36,1)`.

**Keyframes (em `src/app/globals.css`):**
`evkFloat` (logo flutua), `evkPulse` (nó pulsa), `evkRingGlow`, `evkDrift` (backdrop deriva),
`evkBlink`, `evkDraw` (trajetória se desenha via `stroke-dashoffset`), `evkRise` (nós sobem),
`evkStepIn` (passo do wizard), `evkScreenIn` (entrada de tela), `evkPop` (modal/cartão),
`evkSpin`. Classes utilitárias: `.rv`/`.rv-in` (reveal em scroll), `.hov-lift`, `.hov-btn`,
`.evk-navlink`, `.modal-opt`, `.evk-troca`, `.evk-perfil-link`, `.evk-voltar`, `#evk-nav.scrolled`.

---

## 4. Mapa de arquivos (o que foi criado/alterado)

### Rotas (`src/app/`)
- `cadastro/page.tsx` — **novo**. Cadastro 2 colunas.
- `login/page.tsx` — **novo**. Login.
- `redefinir/page.tsx` — **novo**. Redefinir senha (4 estados).
- `confirmar/page.tsx` — **novo**. Confirmação de e-mail (2 estados).
- `conta/page.tsx` — **substituído** (era placeholder). Conta e assinatura + 3 modais.
- `onboarding/page.tsx` — **alterado**. Removida a fase de login; `PerfilResumo` ganha `flagsSaude`.
- `page.tsx` (landing) — **alterado**. CTAs "Testar 7 dias grátis" → `/cadastro`.
- `globals.css` — **alterado**. Keyframes `evkDraw`/`evkRise` e classes adicionadas.

### Componentes (`src/components/`)
- `auth/ui.tsx` — **novo**. Primitivos de auth: `EASE`, `cardAuth`, `inputAuth`, `labelAuth`,
  `btnNeon`, `btnGhost`, `linkNeon`, `forcaSenha(pw)`, `Backdrop`, `LogoFloat`, `Marca`,
  `AuthHead`, `CheckBox`.
- `painel/Painel.tsx` — **muito alterado**. Shell logado: passou a manter perfil/dieta/treino
  em **estado**; novas abas/vistas, menu de conta, integração com sessão/edição/detalhes.
- `painel/SessaoTreino.tsx` — **novo**. Sessão guiada (intro/execução/resumo) + modal "Senti dor".
- `painel/ListaCompras.tsx` — **novo**. Lista de compras derivada do cardápio.
- `painel/EditarPerfil.tsx` — **novo**. Form de edição + modal "Recalcular plano?".
- `painel/DetalheModais.tsx` — **novo**. `DetalhePrato`, `DetalheExercicio`, `DetalheSessao`.

---

## 5. Telas — comportamento, estados e copy

### 5.1 Cadastro (`/cadastro`)
- Layout **2 colunas**: cartão de formulário + **sidebar de confiança** (badge "7 DIAS GRÁTIS",
  "R$ 29/mês após o teste", **timeline Hoje / Dia 5 / Dia 7**, lista de garantias).
- Campos: nome, e-mail, **senha com medidor** (`forcaSenha`), número do cartão, validade `MM/AA`,
  CVV, nome no cartão. **3 consentimentos**: 18+, Termos/Aviso, LGPD.
- Validação `valido`: todos os campos + e-mail regex + senha ≥ 8 + cartão ≥ 13 dígitos +
  validade `\d\d/\d\d` + CVV ≥ 3 + **3 consentimentos**.
- Submit → `sessionStorage.setItem('evk_email', email)` → `router.push('/confirmar')`.
- Medidor `forcaSenha`: Fraca `#E5484D` (25%) · Razoável `#E5C04D` (50%) · Boa `#16A34A` (75%)
  · Forte `#BDFF00` (100%).

### 5.2 Login (`/login`)
- Trajetória neon que **se desenha** atrás do cartão (`evkDraw`).
- "Esqueci minha senha" → `/redefinir`; "Criar conta" → `/cadastro`; "Conhecer" → `/`.
- "Entrar" → `/onboarding` (mock; real é Auth-2). Selo 18+.

### 5.3 Redefinir (`/redefinir`) — 4 estados locais
`request` (e-mail) → `sent` (verifique o e-mail) → `reset` (nova senha + confirmação, com
medidor e "as senhas coincidem/não coincidem") → `done` (sucesso → "Entrar" → `/login`).

### 5.4 Confirmar (`/confirmar`) — 2 estados
`sent` (mostra o e-mail lido do `sessionStorage`, "Reenviar"/"Trocar e-mail") → `confirmed`
(pílula neon "Tudo certo" → "Continuar" → `/onboarding`).

### 5.5 Onboarding (`/onboarding`) — wizard 8 passos
- **Removida a fase de login** (vira `/login`). `fase` inicial = `wizard`.
- Passos: (0) consentimentos · (1) sexo/idade/altura/peso · (2) gate de saúde · (3) objetivo ·
  (4) atividade · (5) experiência · (6) local/dias/tempo · (7) padrão/alergias/não-curte.
- "Gerar meu plano" → fase `gerando` (barra animada ~1,7 s) → `resultado`:
  - Se gate `ROTEAR` → tela **GateB** (encaminhamento a profissional).
  - Senão → `<Painel>` (área logada).
- O `PerfilResumo` montado aqui agora inclui **`flagsSaude`** (necessário para recalcular depois).

### 5.6 Painel (área logada, dentro de `/onboarding` fase=resultado)
- Header com tabs: **Hoje · Treino · Dieta · Progresso · Histórico · Perfil** + menu de conta.
- Menu de conta: **Meu perfil**, **Editar perfil**, **Conta e assinatura** (`/conta`),
  **Lista de compras**, **Sair**.
- **Hoje**: cartão "Treino de hoje" (→ inicia sessão do dia 0) + "Dieta de hoje" (kcal + macros) +
  registrar peso.
- **Treino**: por dia → cartões de exercício (séries × reps, RIR, descanso), botão **"Iniciar
  treino"** por dia, **"Como fazer"** (abre detalhe), **"Trocar"** (modal de 3 opções + "mais
  variedade"), feedback "Como foi".
- **Dieta**: ponto de partida (kcal/macros), refeições com prato clicável (abre detalhe),
  **"Trocar"** e **"Editar porção"**, botão **"Lista de compras"**.
- **Progresso**: peso atual, variação, treinos avaliados, gráfico de peso, registrar peso.
- **Histórico**: sub-abas **Treinos** (sessões concluídas, clicáveis → detalhe) e **Peso** (gráfico).
- **Perfil**: dados + plano/preferências (com botão **"Editar"**), cartão de assinatura
  ("Gerenciar"/"Cancelar" → `/conta`), links legais, 18+.
- **Desfecho C** (gate RESTRINGIR/PISAR): banner de ajuste honesto exibido no Hoje.

### 5.7 Sessão de treino guiada (`SessaoTreino.tsx`)
- **intro** (lista de exercícios com alvo) → **execução** → **resumo**.
- Execução por exercício: barra de progresso, **demo faceless** animada, "Como fazer" (abre
  detalhe), pills (séries × reps / RIR / descanso), **tabela de séries** (reps + carga se for
  exercício com carga), **botão de check por série** que dispara o **timer de descanso ao vivo**
  (+15 s / pular), opt-in **"% do meu máximo"**, "Como foi", "Senti dor" (modal).
- Navegação anterior/próximo; último → resumo (séries, volume kg, exercícios) → "Concluir treino".
- **Decisão de produto (do cofre):** o **%1RM é só leitura estimada** da faixa de reps
  (Epley invertido: `%≈30/(30+reps)`), **com piso de 6 reps**; o app **nunca testa 1RM real**.
  A copy diz isso explicitamente.

### 5.8 Conta e assinatura (`/conta`)
- Hero de status: **trial / active / cancelled** (cores: neon / Folha / Aviso).
  - trial: "teste termina em {data}" + faixa "avisamos **antes** da 1ª cobrança".
  - active: "próxima cobrança em {data}".
  - cancelled: "acesso até {data}, sem nova cobrança" + "Reativar".
- Forma de pagamento (cartão mascarado) + histórico (vazio no trial).
- Dados da conta (Alterar nome/e-mail; **Alterar senha → `/redefinir`**).
- Privacidade/LGPD: **Baixar meus dados** + **Excluir conta** (modal de perigo).
- **Modais**: Cancelar assinatura (motivo opcional → vira `cancelled`), Atualizar cartão,
  Excluir conta. Disclaimer 18+.
- **Datas/valores são mock de UI** — virão do provedor (Kiwify).

### 5.9 Lista de compras (`ListaCompras.tsx`)
- **Gerada do cardápio real**: para cada item, soma `ingrediente.gramas × item.escala × dias`,
  agrega por `alimentoId`, agrupa por **grupo alimentar** (Proteínas, Leguminosas, Laticínios,
  Grãos/cereais/tubérculos, Verduras/legumes, Frutas, Gorduras).
- Período **3 / 7 / 14 dias**; quantidades formatadas (g → kg ≥ 1000); check de comprados.
- Determinística; nota de que trocas/porções editadas entram na conta.

### 5.10 Editar perfil + Recalcular (`EditarPerfil.tsx`)
- Form fiel com os mesmos campos do onboarding (sexo, idade/altura/peso, objetivo, atividade,
  experiência, local, dias/tempo, padrão, alergias, "não curte").
- Validação local: idade 18–100, altura 100–250, peso 30–300.
- "Salvar" → modal **"Recalcular seu plano?"** → "Confirmar e recalcular" → Painel chama
  `recalcular(novoPerfil)`.
- A triagem de saúde (`flagsSaude`) é **preservada** do perfil atual (o form não reabre saúde).

### 5.11 Modais de detalhe (`DetalheModais.tsx`)
- **Prato**: kcal + macros (P/C/G), **alérgenos derivados** (`prato.contemAlergenos`),
  **ingredientes com gramas** (`item.gramas × escala`, nome via `FOODS_BY_ID`), atalhos
  "Trocar prato"/"Editar porção", citação **TACO (NEPA/UNICAMP)**. Modo de preparo: **"em breve"**.
- **Exercício**: padrão, nível, tipo, equipamento (`equipamentoDetalhe`), grupo muscular,
  "como fazer" (`comoFazer`), atalho "Trocar exercício".
- **Sessão**: volume, séries, "como foi"; por exercício, as **séries registradas** (reps × carga).

---

## 6. Integração com o motor (o que vem do cofre, não inventado)

- **Gate de saúde** (`avaliarGate*`): ROTEAR/RESTRINGIR/PISAR/PERMITIR → controla GateB e banner C.
- **Dieta** (`gerarDieta`): cardápio com pratos da base, kcal = soma TACO dos ingredientes.
- **Treino** (`gerarTreino`): `PrescricaoFITT` (reps composto/isolado, RIR, descanso, séries,
  volume/grupo, piso de reps) + `RotinaSemanal` (dias × slots).
- **Substituição** (`substituirPrato`/`substituirExercicio`): troca por equivalência calórica
  / por padrão de movimento, respeitando alergias e padrão alimentar **à risca**.
- **Escala de porção** (`ESCALA_PORCAO` 0.5×–3.0×) e a montagem do dia ao `kcalAlvo`.
- **Recalcular**: o Painel reconstrói `PerfilUsuario`/`PerfilTreino` do `PerfilResumo` (agora com
  `flagsSaude`) e roda `gerarDieta`/`gerarTreino` — exatamente como o onboarding.

> **Sobrescritas sobre o protótipo:** o `.dc.html` trazia números/placeholders próprios
> (kcal fixas, reps fixas, etc.). Foram **descartados** — tudo passa pelo motor real.

---

## 7. Decisões técnicas tomadas (para registrar)

1. **`PerfilResumo` ganhou `flagsSaude: FlagsSaude`** — sem isso o "Recalcular" não conseguiria
   rodar o gate. O onboarding passou a preencher esse campo. (Impacto: assinatura do tipo
   exportado por `@/components/painel/Painel`.)
2. **Painel virou stateful** para perfil/dieta/treino (antes só props) — necessário para edição
   em runtime. `cardItens`/`cardTotais`/`rotinaDias` derivam desse estado.
3. **`ResumoSessao` ganhou `exercicios[]`** (nome, loaded, fb, sets concluídos) — para o modal
   "Detalhe da sessão" no Histórico.
4. **Sessões concluídas viram log** (`SessaoLog` = `ResumoSessao & { n }`) que alimenta
   Histórico e a contagem de "treinos avaliados" no Progresso.
5. **`<details>` "Como fazer" do Treino** virou **botão** que abre o modal de detalhe (mais fiel).
6. **E-mail entre cadastro e confirmar** trafega por `sessionStorage['evk_email']` (mock de UI;
   o real virá do fluxo de Auth).

---

## 8. Verificação

- `npm run typecheck` ✅ · `npm run lint` ✅ · `npm test` → **130/130** ✅ · `npm run build` ✅.
- **E2E (Playwright)**, todos com **zero erros de console / page errors**:
  - onboarding (8 passos) → painel → abas (Histórico, Dieta→Lista de compras, Treino→sessão);
  - cadastro (validação + consentimentos) → confirmar (e-mail persistido) → onboarding; login→redefinir;
  - editar perfil (objetivo+peso) → recalcular → painel reflete mudança;
  - detalhe de prato/exercício com dados reais;
  - treino concluído → Histórico → detalhe da sessão com séries.
- Ressalva de screenshot headless: a fonte Plus Jakarta não carrega no Chromium headless, então
  o texto aparece "colado" **só nas imagens** — no app real renderiza normal.

---

## 9. Fora do escopo (de propósito)

- **Launcher "Telas"** do protótipo — ferramenta de navegação de demo, não é produto.
- **Backend**: Supabase Auth/RLS e Kiwify continuam **mock de UI**. Próximo grande bloco =
  as **20 tarefas de segurança** já levantadas (Auth 1–3, Gating 1–4, Ownership 1–4, RBAC 1–3,
  Sessão 1–2, Entitlement 1–2, Hardening 1–2).

---

## 10. Pendências que voltam pelo humano (decidir → arquivar no cofre)

- [ ] Confirmar **tokens de cor e tipografia** do V2 contra o brand board oficial.
- [ ] **Modo de preparo dos pratos** entra na base curada? (hoje fallback "em breve").
- [ ] **Erros comuns dos exercícios** entram na biblioteca? (hoje omitido — sem dado).
- [ ] **Animações de demonstração (faceless)** dos exercícios: produção/sourcing.
- [ ] **Datas/valores de assinatura** em `/conta`: hoje mock; confirmar origem (Kiwify) e textos.
- [ ] Confirmar preço travado exibido: **R$ 29/mês, 7 dias grátis** (e a timeline Dia 5 / Dia 7).
- [ ] Política de **"alimentos que não curte"**: hoje é só UI; quando vira preferência relaxável
  persistida e aplicada nas trocas?

---

## 11. Commits (branch `claude/evokorpus-app-dev-9in0hs`)

1. `feat(web): fluxo de auth do protótipo V2 (cadastro, login, redefinir, confirmar)`
2. `feat(painel): sessão de treino guiada do protótipo V2 (intro/execução/resumo)`
3. `feat(web): tela Conta e assinatura do protótipo V2 + modais`
4. `feat(painel): Histórico, Lista de compras e atalhos de conta (protótipo V2)`
5. `feat(painel): Editar perfil + Recalcular plano (protótipo V2)`
6. `feat(painel): modais de detalhe de prato e exercício (protótipo V2)`
   + `feat(painel): modal Detalhe da sessão no Histórico (protótipo V2)`
