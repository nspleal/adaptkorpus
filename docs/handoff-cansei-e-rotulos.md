# Handoff — "Cansei deste prato" (descanso de 21 dias) + export de rótulos

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/evokorpus-app-dev-9in0hs`. Commit: `91a9078`.
> Implementa as decisões `## [2026-07-01] decision | App — "Cansei deste prato" (3 semanas) +
> rótulos amigáveis` (cofre: `parametros-motor-substituicao-evokorpus` §Variedade +
> `fontes/banco-alimentos-evokorpus`).

## Decisão 1 — "Cansei deste prato" (nível do PRATO, 21 dias, retorno automático)
- **Gesto** no detalhe do prato (aba Dieta → abrir prato → **"Cansei deste prato"**): o prato
  **sai da rotação por 21 dias** e **volta sozinho**. Copy no botão: *"Descansa da rotação por
  21 dias e volta sozinho."*
- **Prato ≠ ingrediente (trava do cofre).** "Cansei" opera no **prato** (`excluirPratoIds`),
  **não** alimenta o "não curto" (nível do **alimento**, `excluirAlimentoIds`). São sinais
  **separados** — corrigi a copy do Editar-perfil que prometia (indevidamente) a fusão.
- **Motor:** `montarCardapioDia` (assembler) agora aceita `excluirPratoIds` como **preferência
  relaxável** — mesmo tratamento em dois passos do "não curto": evita o prato quando há
  alternativa; se filtrar esvaziar / colidir a distinção café≠almoço≠jantar, **relaxa por
  completo** (o cardápio **precisa fechar**; alérgeno continua absoluto). A **troca** de prato
  já respeitava `excluirPratoIds` — agora também exclui os pratos em descanso.
- **Determinismo preservado.** O prazo de 21 dias e o retorno automático vivem **fora do motor**
  (`src/lib/rotacao-pratos.ts`, puro, recebe o relógio por parâmetro) — o motor recebe só a
  **lista já resolvida**. Mesmo input → mesma saída.
- **UI de gestão:** painel **"Pratos em descanso"** no rodapé da aba Dieta, com contador
  (*"volta em N dias"*) e **"Trazer de volta"** (o retorno manual opcional que a decisão previa).
- **Persistência:** `PerfilResumo.pratosCansados: {id, ate}[]` no `localStorage` (transitório;
  migra para o backend junto com o resto). A leitura da sessão **poda** as entradas expiradas
  (o storage se autolimpa → retorno automático).

## Decisão 2 — rótulos amigáveis = conteúdo do cofre (export para curadoria)
- A decisão travou: **`rotulo_amigavel` é conteúdo do cofre** (voz de marca); a semente são os
  apelidos-rascunho do código. **Exportei os 63** (paleta real dos pratos) para você curar e
  estender aos 125: arquivo **`rotulos-amigaveis-paleta.csv`** (enviado para download).
  Colunas: `id` · `fonte_taco` · `nome_clinico_taco` · `rotulo_amigavel_rascunho` · `grupo`.
- No código, o mapa `APELIDO` (em `src/lib/data/paleta-alimentos.ts`) é o rascunho; quando você
  devolver o vocabulário oficial, troco por ele (a **chave `id`** que vai ao motor não muda).

## Qualidade
`typecheck` · `lint` · **150 testes** (+10: `rotacao-pratos.test.ts` cobre a janela de 21 dias e
o retorno automático; `cansei.test.ts` cobre a exclusão nível-prato relaxável, a não-quebra do
cardápio, o determinismo e a distinção prato≠alimento) · `build` — verdes. E2E (Playwright):
marcar "Cansei" troca o prato do dia, o painel "Pratos em descanso" aparece com *"volta em 21
dias"*, e "Trazer de volta" restaura — **zero erros de console**.

## Arquivos
**Novos:** `src/lib/rotacao-pratos.ts` (+ teste), `src/lib/engine/cansei.test.ts`.
**Alterados:** `src/lib/engine/assembler.ts` (`excluirPratoIds` relaxável),
`src/lib/session.ts` (resolve os ativos + retrocompat/poda), `src/components/painel/Painel.tsx`
(gesto + painel de descanso), `src/components/painel/DetalheModais.tsx` (botão "Cansei"),
`src/components/perfil/DiasEPreferencias.tsx` (copy corrigida), `src/app/onboarding/page.tsx`
(default `pratosCansados: []`).

## Pendências que voltam por você (cofre)
- [ ] **Vocabulário oficial dos rótulos** — curar o CSV enviado e devolver (estender aos 125).
- [ ] **Copy do botão/estado "Cansei"** — usei *"Descansa da rotação por 21 dias e volta
      sozinho."*; se o cofre tiver voz preferida, troco.
