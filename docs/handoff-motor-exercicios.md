# Handoff — integrar o Motor de Exercícios no app (escadas + validação vs dados reais)

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre** — escritor único é
> a sessão local. Decisões novas voltam por você. Branch: `claude/evokorpus-app-dev-9in0hs`.
> Fonte das travas: cofre `fontes/ranking-exercicios-evokorpus` §Escadas (DF 2026-07-03) +
> `conceitos/parametros-motor-substituicao-evokorpus` (F.2 §2). Determinismo, sem "IA", sem
> promessa — honrados. Nada escrito no cofre.

## TL;DR
Das **3 mecânicas** do motor standalone, o app **já tinha 2** implementadas nos dados/tipos reais:
- **SUBSTITUIÇÃO** (F.2 §2) → `src/lib/engine/substituicao.ts` (`substituirExercicio` / `listarSubstituicoesExercicio`).
- **SELEÇÃO p/ montador** → `src/lib/engine/treino-montador.ts` (`montarRotina`) — **supera** o `selecionarParaSlot` v0
  (monta a semana inteira: split, puxar ≥ empurrar, core 2–3×), não só um slot.

Faltava **1 mecânica travada**: as **ESCADAS de dificuldade** (progressão vertical / hint "sobe de variação") —
exatamente a lacuna que eu havia sinalizado como *advisory/deferida* no handoff do Bloco B. **Foi essa que integrei.**

---

## 1. O que entrou (integração em TS)

### `src/lib/engine/escadas.ts` (novo, mecânica TRAVADA)
Porte fiel do `ESCADAS_DIFICULDADE` do motor para os **IDs reais** do app, com as funções
`sugerirProximaVariacao` / `sugerirVariacaoAnterior` / `posicaoNaEscada` / `localizarNaEscada`.
Puro, determinístico, sem I/O. **Respeita equipamento** (degrau que exige implemento indisponível → sem hint,
não pula degrau) reusando o `locaisPermitidos` do montador. Exportado no `engine/index.ts`.

### Decisão do `id` (passo 1 do handoff) — **RESOLVIDA**
- O app usa **string `"eN"`**, e **N é exatamente o `#` do ranking A1** = o id numérico que o motor assumia.
  Mapeamento **lossless**: `"e"+N`. Portei as escadas já em `"eN"` — some o risco de `a.id - b.id → NaN`.
- **Desempate de id: o app decidiu LEXICOGRÁFICO** (`a.id < b.id`), o motor standalone usava **numérico**.
  As escadas são listas de adjacência (não ordenam por id), então a diferença **não as afeta**. Fica só como
  divergência registrada para o §6.6 (ver abaixo).

### Ligação na UI (realiza a integração — fecha a lacuna do Bloco B)
- `src/lib/treino-progressao.ts`: `progressoDosExercicios` agora aceita `exercises`+`equipamento` (opcionais,
  retrocompatível) e popula `ProgressoExercicio.proximaVariacao = { id, nome } | null` via `sugerirProximaVariacao`.
- `SessaoTreino.tsx`: na sessão guiada, exercício de **peso corporal** numa escada mostra um hint discreto —
  *"Quando ficar fácil, o próximo degrau é **Flexão diamante**"*. É **sugestão** (o usuário escolhe), como manda o cofre.
- `Painel.tsx`: passa `EXERCISES_SEED` + `perfil.equipamento` ao adaptador.

### `scripts/validacao-motor-real.mts` (novo, harness contra dados REAIS)
Espelha o `validacao-motor.ts` do autor, mas aponta para `exercises.ts` (163) e para a substituição **real** do app.

---

## 2. Divergências encontradas (motor standalone × `exercises.ts`/código reais)

### 🔴 A grande: `grupoMuscular` texto-livre × `grupo` primário normalizado
O motor preserva estímulo por um **grupo muscular PRIMÁRIO normalizado** (`cand.grupo === atual.grupo`) e trata
"não preserva grupo NEM padrão" como **filtro DURO** (candidato **fica fora**). O app **não tem** esse campo:
`grupoMuscular` é **texto-livre composto** (`"Peito, tríceps, ombros"`, `"Quadríceps, glúteos"`). Consequência —
o `substituicao.ts` do app usa preservação **só como desempate no sort, nunca como filtro duro**. Efeitos medidos
na varredura (§3):
- **Nunca sinaliza ponto magro.** Trocar **e116 Remada invertida** (puxar, casa-sem, único do tipo) devolve
  **e1 Flexão (empurrar!)** + **e16/e17 afundos (agachar!)** — candidatos que **não preservam grupo nem padrão**.
  O motor devolveria **VAZIO** e a UI sinalizaria honestamente. Varredura: **app = 0 combinações vazias vs motor = 3**.
- **Desempate por igualdade de string incidental.** Ajuda num caso e atrapalha noutro:
  - **C2** (troca e9 Supino, academia): app dá **e11 Supino halteres** 1º (compartilha a string exata) — resultado
    *bom*, que o motor só alcançava com as FAMÍLIAS.
  - **C1** (troca e1 Flexão, casa-sem): app dá **e40 Mergulho no banco (tríceps)** 1º, à frente das flexões
    inclinada/parede — porque estas têm string diferente (`"Peito, tríceps"` ≠ `"Peito, tríceps, ombros"`).

  → **Recomendação (decisão de dados, volta pra você):** adicionar um **grupo PRIMÁRIO normalizado** aos 163
  exercícios (ex.: `grupoPrimario: 'peito' | 'costas' | 'quadriceps' | …`). Isso (a) deixa o `substituicao.ts`
  cumprir a trava F.2 §2 (filtro duro de preservação + `sinalizado` honesto no #116) **sem quebrar o refino skater**,
  e (b) **resolve de vez o §6.6** (grupo normalizado) e destrava as FAMÍLIAS. **Não mexi nisso** de propósito: sem o
  campo, ligar o filtro duro quebraria o skater (skater e e143 não compartilham a string livre). É curadoria sua → cofre.

### 🟡 Menores
- **Prosa "35" × grafo "38".** O doc de análise diz "as escadas cobrem 35 exercícios"; o grafo travado tem **38 ids
  distintos** (recontagem fiel — teste ancora 38). Nit de prosa pro cofre.
- **Vocabulário** (`casa-sem`↔`casa_sem`, `forca`↔`forca_hipertrofia`, `dobradica`↔`dobradica_quadril`): **não precisou
  de adaptador** — escrevi `escadas.ts` nativamente nos tipos do app.
- **`selecionarParaSlot` v0** é superado pelo `montarRotina` do app (monta a semana inteira). Mantido como PROPOSTA, não ligado.
- **FAMILIAS_PROPOSTA**: **fora do engine** (proposta dormente). Validei a cobertura (todos os 107 ids existem) no script — não no código.

---

## 3. Saída da validação no Node (contra dados reais) — resumo

`npx tsx scripts/validacao-motor-real.mts` → **✅ todas as checagens passaram**. Destaques:
```
ESCADAS: 38 ids existem · nenhum em 2 escadas · 5 degraus com implemento (e22/e21/e88/e8/e102)
HINTS  : e1→e113 · e16→e78 · e145=topo→∅ · e9(carga)→∅ · regressão e83→e86 · e1=degrau 3/6
         e116 casa-sem→∅ (barra) · e116 casa→e22   (equipamento respeitado)
SUBST. REAL (app): C1 e1→[e40, e156, e157] · C2 e9→[e11, e1, e10, e12, e13] · C3 skater→[e143, e163]
         C4 e116→[e1, e16, e17]  ⚠️ motor sinalizaria VAZIO (divergência-chave acima)
DETERMINISMO: 100× idêntico · ROBUSTEZ 163×3×3: 0 vazios (vs motor 3 — efeito do grupo texto-livre)
FAMÍLIAS: 20 famílias, 107 ids, todos existem
```
Testes unitários novos: `escadas.test.ts` (14, ancorados na spec C6) + 3 casos no `treino-progressao.test.ts`.
**Suite: 204 verdes · typecheck · lint · build** — todos ok. **E2E Playwright, zero erros de console**: na guiada,
e1 Flexão mostra *"próximo degrau é Flexão diamante"*; e116 (casa-sem) **não** mostra hint (chin-up exige barra) — a
regra de equipamento roda de ponta a ponta.

---

## 4. Micro-decisões que voltam a você (mapa do §6 do doc de análise)

| §6 | Tema | Status agora |
|---|---|---|
| 6.1 | **Famílias de equivalência** | ⚠️ **Sua decisão.** Recomendo **sim** — mas veja: o `grupoMuscular` texto-livre já faz isso *parcial e inconsistentemente* (ajuda C2, atrapalha C1). O jeito limpo é o **grupo primário normalizado** (§ acima), que liga famílias E filtro duro de preservação juntos. |
| 6.2 | Ranking do montador | ✅ **Já resolvido no app** (`montarRotina`, mais completo que o `selecionarParaSlot` v0). |
| 6.3 | **Locais cumulativos** (nenhum⊂casa⊂academia) | ✅ **Confirmado** — o `locaisPermitidos` do app é idêntico ao `locaisDisponiveis` do motor. **Formalizar no cofre.** |
| 6.4 | "Sobretudo" do iniciante | ✅ **Já estrito no app** (`DIFICULDADE_LIBERADA.iniciante = ['iniciante']`), igual ao motor v0. Manter estrito (conservador/legal) ou abrir exceções? — segue sua decisão. |
| 6.5 | Conteúdo (+puxar casa-sem 🔴, degraus fáceis de pike 🟡) | ⚠️ **Sua pesquisa** (adição à A1). O #116 é o furo real que o app hoje mascara devolvendo empurrar/agachar. |
| 6.6 | `id` lexicográfico × numérico | ✅ **App decidiu LEXICOGRÁFICO.** Escadas não dependem disso. Alinhar a prosa do motor. |
| — | **NOVO: grupo primário normalizado** | ⚠️ **Recomendo priorizar** — destrava F.2 §2 fiel + `sinalizado` honesto no #116 + famílias, sem quebrar o skater. |

## 5. Arquivos
**Novos:** `src/lib/engine/escadas.ts` (+`escadas.test.ts`) · `scripts/validacao-motor-real.mts`.
**Alterados:** `src/lib/engine/index.ts` (export) · `src/lib/treino-progressao.ts` (+`proximaVariacao`, +`.test.ts`) ·
`src/components/painel/SessaoTreino.tsx` (hint de escada) · `src/components/painel/Painel.tsx` (passa lib+equipamento).
**Não toquei** (de propósito): `substituicao.ts` (a correção do filtro duro depende do grupo normalizado — decisão sua).
