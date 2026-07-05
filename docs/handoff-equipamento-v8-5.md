# Handoff — App V8.5: refinos do modelo de equipamento (any-of + motivo dinâmico + tabela)

Data: 2026-07-05 · Branch: `claude/evokorpus-app-dev-9in0hs` · Base: modelo 2 níveis (handoff anterior
`docs/handoff-equipamento-2-niveis.md`). Implementa as 3 DFs travadas em 2026-07-04. **Nada foi
escrito no cofre** (regra de escritor único) — este arquivo é o insumo para o autor arquivar lá.

---

## 1. O que mudou

### Refino 1 — campo any-of (`equipamentoExigidoQualquerUm`)

- **`src/lib/data/types.ts`** — novo campo opcional em `Exercise`:
  `equipamentoExigidoQualquerUm?: EquipamentoCasa[]` (satisfeito quando ALGUM item está marcado;
  complementa o `equipamentoExigido`, que segue sendo E/⊆).
- **`src/lib/engine/equipamento.ts`** — `exercicioDisponivel` agora avalia `eOk && ouOk`:
  - `eOk` = sem `equipamentoExigido` OU todos os exigidos marcados (⊆, como antes);
  - `ouOk` = sem lista any-of (ou vazia) OU algum item dela marcado;
  - **fail-closed preservado**: `casa_com` sem NENHUM dos dois campos → indisponível.
- **`src/lib/data/exercises.ts`** — 3 exercícios migrados de `equipamentoExigido: [halteres]` para
  `equipamentoExigidoQualquerUm: [halteres, kettlebell]`:
  - **e33** Goblet squat · **e109** Farmer walk · **e140** Farmer hold.
  Efeito prático: quem tem SÓ kettlebell agora vê goblet/farmer (antes exigia halteres).

### Refino 2 — motivo de descompasso DINÂMICO (favoritos)

- **`src/lib/favoritos-elegibilidade.ts`** — o 4º motivo fixo `'pede equipamento de academia'` foi
  substituído pelo motivo dinâmico (DF V8.5, fecha a pendência do "5º texto"):
  - exercício `local: 'academia'` indisponível → **"pede academia"**;
  - `casa_com` com equipamento faltando → **"pede {o que falta}"**, com os rótulos do
    `ROTULO_EQUIPAMENTO_CASA` em minúsculas: exigidos (E) faltantes unidos por `" + "` e a lista
    any-of insatisfeita como cláusula `"x ou y"`. Exemplos reais:
    - e22 sem barra → **"pede barra fixa"**
    - e12 com checklist vazio → **"pede halteres + banco"** · só com halteres → **"pede banco"**
    - e33 sem halteres e sem kettlebell → **"pede halteres ou kettlebell"**
  - Tipo: `MotivoDescompasso` mantém os 3 fixos (nível · dias · pausa por dor) + o template
    `` `pede ${string}` ``. Fallback teórico `'pede equipamento de casa'` para `casa_com` sem
    curadoria (inalcançável com os 53 curados — só defesa).
  - Continua puro, determinístico, sem vermelho (descompasso ≠ erro).
  - A UI (EditarPerfil → Meus favoritos) exibe o `motivo` verbatim — nenhuma mudança de componente
    foi necessária.

### Refino 3 — ajustes de tabela

- **e11** Supino reto com halteres → `equipamentoExigido: ["halteres"]` (banco removido — floor
  press equivale, DF V8.5). *Não altera o piso `casa+[]`*: e11 é `casa_com`, continua fora do piso.
- **e139** Rolo de punho → permanece `["halteres"]` (DF: **não** criar 8º item de vocabulário).
- **e55** Crucifixo e **e125** Pullover → permanecem `["halteres", "banco"]` (no chão limitam
  amplitude — DF V8.5).
- **`scripts/derivar-equipamento-exigido.mjs`** — TABELA sincronizada (fonte de verdade dos 53):
  entradas agora aceitam `eq` (E) e/ou `ou` (any-of); injetor reescreve os dois campos de forma
  **idempotente** (rodado 2× → zero diff; saída byte-idêntica ao `exercises.ts` commitado). As 4
  ambiguidades resolvidas pelas DFs saíram da coluna "ambíguo" e viraram comentários citando a DF.

---

## 2. Invariantes — confirmação de que NADA quebrou

| Invariante | Status |
|---|---|
| `casa + []` byte-idêntico ao antigo `nenhum` (rotina e trocas) | ✅ teste passa |
| `casa + os 7` ≡ casa legada (migração preserva acesso ao casa-com) | ✅ teste passa |
| Varredura `casa+[]`: **exatamente os 3 vazios do e116** (assert duro) | ✅ teste + `validacao-motor-real.mts` |
| e116 fecha com `barra_fixa` marcada (e22 vira troca) | ✅ teste passa |
| Varredura `casa+7` e `academia`: zero vazios | ✅ teste passa |
| Robustez 163 × 3 níveis × 3 equipamentos: só o furo conhecido | ✅ script: "EXATAMENTE 3 vazios" |
| e11 sem banco NÃO muda o piso `casa+[]` (é casa_com) | ✅ coberto pelas varreduras acima |
| Determinismo (mesma entrada 100× → mesma saída) | ✅ script passa |

**O any-of não quebrou nenhuma varredura**: ele só AMPLIA disponibilidade (kettlebell-only passa a
ver goblet/farmer) e nunca restringe — os pisos `[]` e "todos os 7" são idênticos ao V8.

## 3. Testes

- `npm run typecheck` → 0 erros · `npm run lint` → limpo · `npm run build` → ok.
- `npm test` → **25 arquivos, 274 testes, todos verdes** (+2 vs. V8: any-of e motivo dinâmico).
- Novos/alterados:
  - `equipamento.test.ts`: curadoria dos 53 agora aceita E **ou** any-of (não-vazio no vocabulário;
    casa_sem/academia sem os campos); âncoras any-of (e33/e109/e140 com só kettlebell → ✔, só
    halteres → ✔, nenhum dos dois → ✘) e da tabela (e11 `[halteres]`, e139 `[halteres]`,
    e55/e125 `[halteres, banco]`).
  - `favoritos-elegibilidade.test.ts`: "pede academia" (e9 sem equipamento); motivos dinâmicos
    de casa-com (e22 → "pede barra fixa"; e12 → "pede halteres + banco" / "pede banco";
    e33 → "pede halteres ou kettlebell" e elegível com qualquer um dos dois).
- `npx tsx scripts/validacao-motor-real.mts` → todas as checagens (skater, e116 vazio honesto,
  determinismo 100×, robustez 1.467 combinações, famílias).

## 4. Para o cofre (arquivar via autor)

1. **DF implementadas verbatim** — any-of (`equipamentoExigidoQualquerUm`), motivo dinâmico
   ("pede academia" / "pede {falta}"), e11 sem banco, e139 sem 8º item, e55/e125 com banco.
2. **Copy nova em produção** (para registro de voz): os textos dinâmicos "pede academia",
   "pede barra fixa", "pede halteres + banco", "pede halteres ou kettlebell" — gerados por
   fórmula a partir do `ROTULO_EQUIPAMENTO_CASA` (determinístico, sem IA).
3. **Nenhuma decisão nova foi tomada por aqui** — as 4 ambiguidades do handoff anterior foram
   todas resolvidas pelas DFs do autor; a TABELA do script está sincronizada e sem pendências.
