# Handoff — Porte do front-end (protótipo V2) · Adaptkorpus app

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

> **Para o cofre.** Resumo do que foi implementado no repo do app a partir do protótipo
> estético **V2** (`V2_front_end_evoK.zip` → `design_handoff_adaptkorpus_completo/Adaptkorpus App.dc.html`).
> Branch: `claude/adaptkorpus-app-dev-9in0hs`. Tudo é **UI ligada ao motor determinístico real**
> (sem backend ainda). Escritor único do cofre = sessão local; isto aqui é insumo para você arquivar.

## Regra de trabalho confirmada (travar no cofre)

- **Todo protótipo estético de front-end** que o humano passar vem no estilo **`.dc.html`**
  (HTML com estilos inline + keyframes `<style>`). O porte deve **reproduzir fielmente** a
  estética e o movimento; pode-se **sobrescrever fórmulas/fontes** do protótipo (ele não
  enxerga o cofre) — o motor/valores reais do cofre prevalecem.

## Princípios mantidos (verificados em todas as telas)

- Copy **nunca** diz "IA" (usa "regras adaptativas").
- **18+** na borda (gate de idade no cadastro/onboarding) e disclaimer presente.
- **Sem promessa de resultado** (linguagem de processo: "ponto de partida", "estimativa de referência").
- **Fail-safe clínico**: gate de saúde roteia p/ profissional; modal "Senti dor" orienta parar.
- **Determinismo auditável**: mesmo input → mesma saída (recalcular usa o motor puro).
- **Fidelidade visual**: neon Pulso `#BDFF00` só no escuro; SVG da logo = construção canônica.

## Tokens usados (do README do V2 — conferir com brand board)

- Floresta `#0D2818` · Carvão `#0F0F0E` · Folha `#16A34A` · Pulso (neon) `#BDFF00`
  · Bone `#EAE5DB` · Alerta `#E5484D` · Aviso/senha `#E5C04D`.
- Fonte Plus Jakarta Sans (400–800). Easing padrão `cubic-bezier(.22,.61,.36,1)`.
- Keyframes: `evkFloat, evkPulse, evkRingGlow, evkDrift, evkBlink, evkDraw, evkRise,
  evkStepIn, evkScreenIn, evkPop, evkSpin`.

---

## O que entrou (6 commits)

### 1. Fluxo de conta (rotas próprias)
- `/cadastro` — 2 colunas (formulário + sidebar de confiança com timeline 7 dias),
  campos de cartão, **3 consentimentos** (18+, Termos/Aviso, LGPD), **medidor de força de senha**.
  Submete → grava e-mail em `sessionStorage` → `/confirmar`.
- `/login` — trajetória neon de fundo; links p/ `/redefinir`, `/cadastro`, `/`.
- `/redefinir` — 4 estados: solicitar → enviado → nova senha (com medidor + confirmação) → sucesso.
- `/confirmar` — 2 estados: verifique a caixa (lê o e-mail do cadastro) → confirmado → `/onboarding`.
- **Onboarding** perdeu a fase de login (vira rota própria); **CTAs da landing → `/cadastro`**.
- Primitivos compartilhados em `src/components/auth/ui.tsx`.

### 2. Sessão de treino guiada
- `src/components/painel/SessaoTreino.tsx`: **intro → execução → resumo**.
- Execução: tabela de séries (reps + carga), **timer de descanso ao vivo**, opt-in de **%1RM**,
  "como foi" (feedback), modal **"Senti dor"**, demo *faceless* animada.
- **%1RM é só leitura estimada** da faixa de reps (Epley invertido), **respeita o piso de 6 reps**;
  **nunca testa 1RM real**. (Ancorar em `parametros-motor-treino-adaptkorpus`.)
- Lançada por "Começar treino" (Hoje) e "Iniciar treino" (por dia, na aba Treino).

### 3. Conta e assinatura (`/conta`)
- Hero de status (**teste / ativa / cancelada**), forma de pagamento, histórico de cobrança,
  dados da conta, privacidade/LGPD (baixar/excluir), links legais, disclaimer 18+.
- Modais: **cancelar assinatura** (motivo opcional), **atualizar cartão**, **excluir conta** (perigo).
- Transparência travada: aviso por e-mail **antes** da 1ª cobrança.

### 4. Histórico + Lista de compras
- **Lista de compras**: gerada do **cardápio real** — soma ingredientes (TACO × gramas × escala)
  por **3/7/14 dias**, agrupada por grupo alimentar, com check de comprados. Determinística.
- Aba **Histórico** (Treinos + Peso).
- Menu da conta: "Conta e assinatura" → `/conta`, "Editar perfil", "Lista de compras".

### 5. Editar perfil + Recalcular plano
- `src/components/painel/EditarPerfil.tsx`: formulário fiel (mesmos campos do onboarding).
- Ao salvar → modal **"Recalcular seu plano?"** → confirma → **roda o motor real**
  (gate + dieta + treino) com o novo perfil e atualiza cardápio/rotina/prescrição.
- **Decisão técnica**: o `PerfilResumo` agora carrega `flagsSaude` (necessário p/ recalcular);
  o Painel passou a manter **perfil/dieta/treino em estado**.

### 6. Modais de detalhe
- **Prato**: kcal + macros, **alérgenos derivados**, ingredientes com gramas (TACO × escala);
  citação da base **TACO (NEPA/UNICAMP)**.
- **Exercício**: padrão/nível/tipo/equipamento/músculos + "como fazer".
- **Sessão** (no Histórico): séries registradas (reps × carga) por exercício.
- Onde o protótipo previa conteúdo **ainda não modelado** (modo de preparo, erros comuns,
  animação de demo), mostramos **fallback honesto "em breve"** — nunca inventamos dado.

---

## Rotas finais

`/` (landing) · `/cadastro` · `/login` · `/redefinir` · `/confirmar` · `/onboarding`
(+ painel logado embutido) · `/conta` · `/plano` · APIs (`/api/dieta`, `/api/treino`,
`/api/substituir/*`, `/api/catalogo/*`, `/api/webhooks/kiwify`).

## Qualidade (rodado a cada onda)

`npm run typecheck` ✅ · `npm run lint` ✅ · `npm test` → **130/130** ✅ · `npm run build` ✅.
Verificação E2E (Playwright) dos fluxos: onboarding→painel, sessão→histórico→detalhe,
cadastro→confirmar→onboarding, editar→recalcular. **Zero erros de console** em todos.

## Fora do escopo (de propósito)

- O *launcher* "Telas" do protótipo é ferramenta de navegação de demo — não é produto.
- **Backend não implementado**: Auth/RLS (Supabase) e assinatura (Kiwify) continuam mock de UI.
  São as **20 tarefas de segurança** já levantadas (Auth, Gating, Ownership, RBAC, Sessão,
  Entitlement, Hardening) — próximo grande bloco.

## Pendências que voltam pelo humano (decidir e arquivar no cofre)

- [ ] Confirmar **tokens de cor/typografia** do V2 contra o brand board oficial.
- [ ] **Modo de preparo dos pratos** e **erros comuns dos exercícios**: entram na base curada? (hoje "em breve").
- [ ] **Animações de demonstração** (faceless) dos exercícios: produção/sourcing.
- [ ] Datas/valores de assinatura em `/conta` são **mock** — virão do provedor (Kiwify).
- [ ] Preço travado exibido: **R$ 29/mês, 7 dias grátis** — confirmar no cofre.
