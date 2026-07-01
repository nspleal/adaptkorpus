# Handoff — Dias de treino + Preferências estruturadas + "Sua semana" (V5)

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/evokorpus-app-dev-9in0hs`. Commits: `3e49474` (feature) + `60d2f99` (correções de revisão).
> Origem estética: `V5_frond_end_evoK.zip` → `design_handoff_dias_e_preferencias/Evokorpus Dias e Preferências.dc.html`
> (Componente A — dias · Componente B — não curto · faixa "Sua semana" · modal recalcular). A "casca
> de revisão" do protótipo (segmented Onboarding/Perfil/Painel + Reiniciar) foi descartada, como manda o handoff.

## O que entrou — os dois campos que não conversavam com o motor viraram entrada estruturada

### Componente A — Dias de treino (Seg–Dom)
- Antes: onboarding perguntava só o **número** de dias (1–6). Agora: **seletor Seg–Dom** (cada dia =
  treino/descanso) com contagem derivada ("X dias de treino · Y de descanso") e validação leve
  (0 dias bloqueia; 7 dias avisa sem travar). Reusado no **onboarding** e no **Editar perfil**.
- Nova faixa **"Sua semana"** no topo da aba **Hoje**: mapeia as **sessões reais do motor**
  (`rotina.dias[].nome`, ex.: "Full-body A/B/C") sobre os dias escolhidos, e resolve **"hoje"**.
  Clicar num dia abre o detalhe: treino (→ "Ir para a sessão") · **descanso de hoje = estado B2**
  ("Hoje é dia de descanso", nunca falha) · descanso de outro dia (estado calmo).
- **Dias excedentes = Recuperação.** Se a pessoa escolhe **mais dias do que o teto de sessões de
  força do nível** (iniciante 3 · intermediário 4 · avançado 6), o motor já prescreve os dias a mais
  como **cardio/recuperação** (`diasCardioRecuperacao`). As N sessões de força vão nos primeiros N
  dias; os excedentes viram **"Recuperação"** (marcador Folha + detalhe "Recuperação ativa") — fiel
  ao motor, **sem repetir sessão de força**. (O protótipo assumia 1 sessão por dia; nosso motor capa,
  então este é o comportamento correto — a **copy/conteúdo do dia de cardio** volta como decisão do cofre.)
- **"hoje" vem do relógio na UI, não no motor** (o motor segue determinístico e sem relógio) —
  `src/lib/semana.ts` (`montarSemana`, `weekdayHojeIdx`, `proximoTreinoIdx`) é puro.

### Componente B — "Alimentos que não curto"
- Antes: **texto livre** que o motor **ignorava**. Agora: **busca com autocomplete** sobre a
  **paleta curada real** (os **63 alimentos que aparecem nos pratos**, com **IDs reais** da base) —
  chips estruturados, nunca texto. Bloco **separado** e visualmente distinto do de **ALERGIAS**
  (segurança, absoluto). Reusado no onboarding e no Editar perfil.
- Nomes: a base TACO tem nomes clínicos ("Carne, bovina, acém, moído, cozido") → mapeei **rótulos
  amigáveis** por ID em `src/lib/data/paleta-alimentos.ts` (exibição), mantendo o **ID real** como
  chave que vai ao motor. Grupos amigáveis derivados do `GrupoAlimentar` da base.

### Motor — "não curto" agora é preferência relaxável de verdade
- `montarCardapioDia` (assembler) aceita `excluirAlimentoIds`: por refeição, **prefere** pratos sem os
  alimentos indesejados; se isso **esvaziar** os candidatos daquela refeição, **relaxa** (usa a lista
  cheia). É **gosto** — nunca segurança; **alérgeno continua absoluto** e o cardápio **precisa fechar**.
- A **substituição** de prato também passa `excluirAlimentoIds` (as trocas respeitam o "não curto").
- **+5 testes** (`naocurto.test.ts`): evita quando há alternativa · exclusão realista ainda fecha ·
  colisão entre slots relaxa por completo (2º passo) · determinístico · sem exclusão → idêntico ao base.

## Fluxo de edição (Editar perfil) — honesto
- **Mudou os dias de treino** → modal **"Recalcular seu plano?"** ("reorganiza sua semana — as sessões
  são redistribuídas"). **Só mudou alimentos/outros** → salva direto (preferências valem na hora).
- Preferências (dias + não curto + alergias) **persistem** na sessão e voltam preenchidas.

## Contrato de dados
`PerfilResumo` ganhou `treinoDias: Weekday[]` (fonte de verdade da agenda; `diasDisponiveis` = length) e
`naoCurto: string[]` (IDs da paleta). `session.recomputarPlano` usa a **contagem** de dias no motor de
treino e passa `naoCurto` como `excluirAlimentoIds` na dieta. **Retrocompat:** sessões antigas (sem esses
campos) recebem defaults (`diasPadrao(diasDisponiveis)` e `[]`).

## Travas de copy/produto mantidas (handoff §10)
Usuário no comando (tudo editável) · **"não curto" = preferência relaxável, distinta de alergia =
segurança absoluta** (blocos e modelos separados) · **descanso faz parte do plano** (nunca falha) ·
sem "IA" ("regras adaptativas") · sem promessa · 18+ · neon só no escuro · vermelho só segurança ·
**saída sempre estruturada** (weekdays / IDs), nunca texto livre.

## Qualidade
`typecheck` · `lint` · **140 testes** (+5) · `build` — verdes. E2E (Playwright), **zero erros de console**:
seletor de dias (Seg–Dom + contagem), autocomplete de alimentos (busca sem acento, chips), "Sua semana"
com as sessões reais do motor + "hoje", detalhe de treino/descanso, Editar perfil com tudo persistido,
persistência de sessão (14 checagens) e o fail-safe clínico (edição em zona ROTEAR → encaminhamento).

## Pendências que voltam por você (cofre)
- [ ] **Atalho "Cansei deste prato" → naoCurto:** a copy do Editar perfil já promete ("pratos marcados
      como 'Cansei deste prato' também entram aqui automaticamente"). Falta o gesto **no card do prato**
      (aba Dieta) que adiciona o(s) alimento(s) do prato à lista `naoCurto`. Decisão: mapeia o prato
      inteiro ou os ingredientes principais? — voltar como decisão de produto.
- [ ] **Rótulos amigáveis da paleta:** os 63 apelidos são meus (derivados da TACO). Se o cofre tiver um
      vocabulário oficial de nomes de alimentos, troco por ele.
- [ ] **Backend:** `treinoDias` + `naoCurto` hoje vivem no `localStorage` (sessão transitória). Na fase
      Supabase migram para o perfil no servidor (RLS/minimização), junto com o resto.

## Arquivos
**Novos:** `src/lib/semana.ts`, `src/lib/data/paleta-alimentos.ts`,
`src/components/perfil/DiasEPreferencias.tsx`, `src/components/painel/SuaSemana.tsx`,
`src/lib/engine/naocurto.test.ts`.
**Alterados:** `src/lib/engine/assembler.ts` (excluirAlimentoIds relaxável),
`src/lib/session.ts` (treinoDias/naoCurto + retrocompat), `src/app/onboarding/page.tsx`,
`src/components/painel/{Painel,EditarPerfil}.tsx`, `src/app/globals.css` (hovers).
