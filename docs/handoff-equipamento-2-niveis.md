# Handoff — Modelo de equipamento "2 níveis" implementado (Casa+checklist / Academia)

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**; decisões/curadoria
> voltam por você. Branch: `claude/adaptkorpus-app-dev-9in0hs`, commit `6923fbc`.
> Fonte: DF 2026-07-04 (cofre log "modelo de equipamento: 2 níveis"). Determinismo, sem "IA",
> copy sem culpa — honrados.

## TL;DR
O modelo de 3 níveis (`nenhum`/`casa`/`academia`) virou **Casa (com checklist de 7) / Academia**,
ponta a ponta: dados (campo `equipamentoExigido` nos 53 `casa_com`), motor (`exercicioDisponivel`
como filtro DURO no montador, na substituição F.2 #1, nas escadas e nos favoritos), migração
não-destrutiva e UI (onboarding + Editar-perfil com checklist no idiom do seletor de dias).
**272 testes verdes** (+14 de invariantes), build limpo, **E2E 7/7 com zero erros de console**.
A **tabela dos 53** (§2) é CURADORIA de 1º passo e **volta para você aprovar** — 9 ambíguos marcados.

## 1. O que mudou (commit `6923fbc`)
- **Tipos:** `EquipamentoCasa` (7 valores; barbell fora — quase todo barbell é `academia`) ·
  `Exercise.equipamentoExigido?` (só casa_com) · `PerfilTreino/PerfilResumo/PedidoSubExercicio.equipamentosCasa?`.
- **Motor:** `engine/equipamento.ts` → `exercicioDisponivel(ex, equipamento, equipamentosCasa?)`:
  academia = tudo · casa = `casa_sem` sempre + `casa_com` quando `exigido ⊆ checklist` · local
  `academia` NUNCA em casa · `'nenhum'` legado ≡ casa+[] · chamada SEM checklist = casa antiga
  (retrocompat de todos os call sites/testes existentes) · casa_com sem curadoria = indisponível
  (fail-closed). Aplicado no montador, na substituição, no hint das escadas ("barra fixa exige
  `barra_fixa` MARCADA") e na elegibilidade de favoritos.
- **Migração (na leitura da sessão, não-destrutiva):** `nenhum` → casa+[] · `casa` → casa+
  os 7 (preserva o acesso ao casa-com; o checklist do Editar-perfil convida a revisar) ·
  `academia` → academia. A API aceita `equipamentosCasa` opcional ('nenhum' segue aceito como legado).
- **UI:** seletor de 2 opções + `ChecklistEquipamento` (7 toggles no idiom do SeletorDias + botão
  "Nenhum equipamento — só o peso do corpo", opção legítima, sem culpa) no onboarding (Step 6,
  revelado dentro do cartão "Em casa") e no Editar-perfil (bloco sob "Local e equipamento").
- **Testes:** `engine/equipamento.test.ts` (14) — ver §3.

## 2. Tabela `id → equipamentoExigido` dos 53 casa_com — **PARA APROVAÇÃO DO COFRE** ⚠️
1º passo derivado de nome + `equipamentoDetalhe` (regras documentadas no script
`scripts/derivar-equipamento-exigido.mjs`; re-rodável/idempotente). **9 ambíguos marcados.**
Regra-chave aplicada: "Halteres / Barra" → `halteres` (barbell fora do vocabulário — a versão
com halteres basta). Inclinados exigem `banco`.

| id | equipamentoExigido | ⚠️ ambíguo |
|---|---|---|
| e8 | roda_abdominal | — |
| e11 | halteres + banco | floor press (chão) é alternativa aceitável? |
| e12 | halteres + banco | — |
| e19 | halteres | — |
| e20 | elastico | — |
| e21 | barra_fixa | — |
| e22 | barra_fixa | — |
| e33 | halteres | OU kettlebell (goblet) — o filtro só expressa E |
| e41 | halteres | — |
| e42 | halteres | — |
| e44 | elastico | — |
| e45 | halteres | — |
| e52 | halteres | — |
| e54 | halteres | — |
| e55 | halteres + banco | crucifixo no chão limita amplitude — aceitável? |
| e56 | halteres + banco | — |
| e61 | halteres | — |
| e67 | halteres | — |
| e72 | halteres | — |
| e73 | halteres | — |
| e74 | halteres | — |
| e76 | halteres + banco | — |
| e80 | halteres | — |
| e81 | halteres | — |
| e82 | halteres | — |
| e84 | halteres | — |
| e87 | elastico | — |
| e88 | barra_fixa | — |
| e92 | corda_pular | — |
| e95 | halteres | — |
| e96 | elastico | — |
| e97 | halteres | — |
| e98 | halteres | — |
| e102 | halteres | — |
| e106 | halteres | — |
| e108 | kettlebell | — |
| e109 | halteres | OU kettlebell (farmer walk) |
| e111 | halteres | — |
| e112 | halteres | — |
| e118 | barra_fixa | — |
| e119 | elastico | — |
| e120 | elastico | — |
| e125 | halteres + banco | pullover no chão limita amplitude — aceitável? |
| e133 | halteres | — |
| e135 | halteres | — |
| e136 | halteres | — |
| e137 | halteres | — |
| e138 | halteres | — |
| e139 | halteres | FORA DO VOCABULÁRIO: rolo de punho é implemento próprio (candidato a 8º item ou reclassificação) |
| e140 | halteres | OU kettlebell (farmer hold) |
| e144 | halteres | — |
| e158 | halteres | ou anilha sobre os joelhos (improviso comum) |
| e162 | elastico | — |

## 3. Invariantes confirmadas (testes + E2E)
- ✅ **`casa+[]` BYTE-IDÊNTICO ao antigo `nenhum`**: mesma rotina (JSON igual), mesmas trocas.
- ✅ `casa+os 7` ≡ casa legada (a migração preserva o plano de quem tinha "casa").
- ✅ **Furo do e116**: varredura `casa+[]` = **exatamente os 3 vazios** do e116 (assert duro
  preservado) e **FECHA com `barra_fixa` marcada** (e22 chin-up vira troca; hint e116→e22 idem).
- ✅ Varredura `casa+7` e `academia` = **zero vazios**.
- ✅ E2E (produção, zero erros de console): sessão antiga `nenhum` carrega migrada (rotina só
  peso do corpo; checklist vazio no Editar) · sessão antiga `casa` mostra os 7 marcados ·
  `casa+[barra_fixa]` põe a barra no plano E deixa halteres fora · desmarcar tudo + salvar
  persiste `[]`.

## 4. Fora do vocabulário / observações p/ o autor (deliverable 4)
1. **e139 Rolo de punho** — implemento próprio; **não cabe nos 7**. 1º passo = `halteres`
   (usa um peso), mas é **candidato a 8º item** (`rolo_punho`) ou a reclassificação. Sua decisão.
2. **Casos OU (e33 goblet, e109 farmer walk, e140 farmer hold)** — "Halter OU Kettlebell": o
   filtro só expressa **E** (`⊆`). 1º passo = `halteres`. Se quiser OU de verdade, o modelo
   precisa de um campo alternativo (ex.: `equipamentoExigidoQualquerUm`) — decisão sua.
3. **Banco nos planos (e11 supino reto, e55 crucifixo, e125 pullover)** — exigi `banco`; floor
   press/chão são alternativas comuns. Se aprovar "chão vale", esses 3 caem para só `halteres`.
4. **Motivo de descompasso dos favoritos**: com o modelo novo, um favorito casa_com sem o
   equipamento marcado recebe o motivo travado "pede equipamento de academia" (conjunto fechado
   de 4) — agora levemente impreciso ("pede halteres" seria mais exato). Reforço o candidato a
   5º texto já sinalizado no handoff anterior.
5. **Copy de exibição**: rótulos do checklist = Halteres · Barra fixa · Elástico · Banco ·
   Kettlebell · Corda de pular · Roda abdominal (em `ROTULO_EQUIPAMENTO_CASA` — ajustável em 1 lugar).

## 5. Fora do escopo (conforme a DF)
Nada feito em pike/empurrar-vertical (flexão cobre ombro, aceito) e nada de conteúdo 164+ de
puxar (a barra fixa resolve p/ quem a tem; o piso `casa+[]` mantém 1 puxar por decisão — o
assert dos 3 vazios documenta).

---
*Gate: typecheck · lint · 272 testes · build · validação Node (163 reais) — todos verdes.
Nada escrito no cofre; a tabela do §2 aguarda sua aprovação (mesmo fluxo do grupoPrimario).*
