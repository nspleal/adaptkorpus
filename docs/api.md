# API do backend — Evokorpus (rudimentar, Fase 0/1)

Superfícies HTTP **finas** sobre o motor determinístico (`src/lib/engine`). Cada rota:
**valida a entrada com zod (defesa na borda) → chama uma função pura do motor com a base
curada do seed → devolve JSON**. Sem IA, sem rede, sem relógio no caminho — mesma entrada,
mesma saída (sustenta o enquadramento legal; ver `CLAUDE.md`).

> **Estado:** rudimentar e **sem autenticação ainda** (Auth + RLS + persistência chegam na
> Fase 1 — ver `docs/roadmap.md`). O front-end (feito no Claude Design) consome estes
> endpoints. Não exponha estas rotas em produção antes do gate de Auth.

Todas as rotas POST esperam `Content-Type: application/json`. Erro de validação → **400**
com `{ "error": "entrada inválida", "detalhes": [...issues do zod] }`.

Base local: `http://localhost:3000` (ou a porta que você subir com `PORT=…`).

---

## Convenções

- **Gate de saúde** decide tudo antes do plano. `comportamento`:
  - `PERMITIR` / `RESTRINGIR` / `PISAR` → plano é gerado (com avisos quando aplicável).
  - `ROTEAR` → **nenhum plano/treino é gerado** (`plano`/`prescricao` = `null`); o app orienta
    procurar profissional. Postura fail-safe (princípio inegociável #4).
- **18+** é validado na borda (`idade >= 18`) — abaixo disso → 400.
- Macros usam as chaves: `kcal`, `proteinaG`, `carboidratoG`, `gorduraG`.

---

## POST `/api/dieta`

Pipeline de dieta: gate → alvo calórico → macros → cardápio do dia.

**Body** (`perfilSchema`):

```json
{
  "sexo": "masculino",
  "pesoKg": 80,
  "alturaCm": 178,
  "idade": 30,
  "nivelAtividade": "moderado",
  "objetivo": "emagrecimento",
  "flagsSaude": {
    "gestacaoAmamentacao": false, "renal": false,
    "cardiaca": false, "lesao": false, "diabetes": false
  },
  "preferenciaAlimentar": null,
  "alergenos": []
}
```

| Campo | Valores |
|---|---|
| `sexo` | `masculino` \| `feminino` |
| `nivelAtividade` | `sedentario` \| `leve` \| `moderado` \| `intenso` \| `muito_intenso` |
| `objetivo` | `emagrecimento` \| `massa` \| `saude` |
| `preferenciaAlimentar` | `vegano` \| `vegetariano` \| `null` (opcional) |
| `alergenos` | array de strings (ex.: `["ovo","leite"]`); default `[]` |
| `pesoKg` 30–300 · `alturaCm` 100–250 · `idade` 18–100 |

**Resposta 200** (`{ gate, plano, cardapio }`):

```jsonc
{
  "gate": {
    "comportamento": "PERMITIR",
    "motivos": [], "avisos": [],
    "derivados": { "imc": 25.24, "tmb": 1767.5, "get": 2739.6, "pisoSeguro": 1550 },
    "objetivoEfetivo": "emagrecimento"
  },
  "plano": {
    "kcalAlvo": 2260.19,
    "macros": { "proteinaG": 144, "gorduraG": 64, "carboidratoG": 277, "proteinaPisoG": ... },
    "janela": { "minKcal": ..., "maxKcal": ... }
  },
  "cardapio": { "status": "ok", "itens": [ { "refeicao": "...", "prato": {...} } ], ... }
}
```

Quando o gate é `ROTEAR` (ex.: condição cardíaca declarada): `plano` e `cardapio` vêm `null`.

---

## POST `/api/treino`

Pipeline de treino: gate herdado → prescrição FITT → rotina semanal.

**Body** (`perfilTreinoSchema`):

```json
{
  "pesoKg": 80, "alturaCm": 178, "idade": 30,
  "flagsSaude": {
    "gestacaoAmamentacao": false, "renal": false,
    "cardiaca": false, "lesao": false, "diabetes": false
  },
  "objetivo": "massa",
  "nivelExperiencia": "iniciante",
  "equipamento": "casa",
  "diasDisponiveis": 3,
  "tempoPorSessaoMin": 45
}
```

| Campo | Valores |
|---|---|
| `objetivo` | `emagrecimento` \| `massa` \| `saude` |
| `nivelExperiencia` | `iniciante` \| `intermediario` \| `avancado` |
| `equipamento` | `nenhum` \| `casa` \| `academia` |
| `diasDisponiveis` 1–7 · `tempoPorSessaoMin` 10–180 |

**Resposta 200** (`{ gate, prescricao, rotina }`):

```jsonc
{
  "gate": { "comportamento": "PERMITIR", "objetivoEfetivo": "massa", ... },
  "prescricao": {
    "objetivoEfetivo": "massa", "nivel": "iniciante",
    "repsComposto": { "min": 6, "max": 12 }, "repsIsolado": { "min": 8, "max": 15 },
    "rir": { "min": 2, "max": 3 }, "seriesPorExercicio": { "min": 1, "max": 3 }, ...
  },
  "rotina": { "dias": [ ... ] }
}
```

Gate `ROTEAR` → `prescricao` e `rotina` vêm `null`.

---

## POST `/api/substituir/prato`

Troca **um prato** no **mesmo slot**, mantendo o dia equilibrado. O plano (janela de kcal e
piso de proteína do dia) é **recomputado a partir do `perfil`** — você só informa o estado
atual do dia.

**Body** (`subPratoSchema`):

```json
{
  "perfil": { /* mesmo formato do POST /api/dieta */ },
  "totaisDiaAtual": { "kcal": 2260, "proteinaG": 150, "carboidratoG": 277, "gorduraG": 64 },
  "pratoAtualId": "p1",
  "slot": "almoco",
  "restricoes": { "alergenos": [], "preferencia": null },
  "gosto": { "excluirPratoIds": [], "excluirAlimentoIds": [] }
}
```

- `slot`: `cafe` \| `almoco` \| `jantar` \| `lanche`.
- `totaisDiaAtual` = macros do **dia inteiro já incluindo** o `pratoAtual` (a troca recoloca o
  novo prato e checa se o **dia inteiro** continua dentro da janela de kcal e acima do piso de
  proteína). Por isso, totais muito longe do alvo → nada satisfaz → `sinalizado` (esperado).
- `restricoes`/`gosto` são opcionais. **Alérgeno e identidade (vegano/veg) nunca relaxam**;
  só o gosto cede, por último.

**Resposta 200** (`ResultadoSubPrato`):

```jsonc
// achou troca:
{ "status": "ok", "prato": { "id": "p35", ... }, "totaisDiaNovo": {...}, "gostoRelaxado": false }
// fail-safe (nenhuma troca mantém o dia equilibrado sem afrouxar segurança/identidade/dieta):
{ "status": "sinalizado", "prato": null, "totaisDiaNovo": null, "gostoRelaxado": false, "nota": "..." }
```

**404** se `pratoAtualId` não existe. **409** se o gate do perfil é `ROTEAR` (não há plano para
substituir).

---

## POST `/api/substituir/exercicio`

Troca **um exercício** preservando grupo muscular → padrão de movimento, respeitando
equipamento e dificuldade liberada pelo nível.

> Dor/lesão **não** entra aqui — isso é pausa + aviso no fluxo de treino, não substituição.

**Body** (`subExercicioSchema`):

```json
{
  "exercicioAtualId": "e1",
  "equipamento": "casa",
  "nivelExperiencia": "iniciante",
  "historicoRecenteIds": [],
  "gostoExcluirIds": []
}
```

- `historicoRecenteIds` (variedade) e `gostoExcluirIds` (gosto) são opcionais e **relaxáveis**.

**Resposta 200** (`ResultadoSubExercicio`):

```jsonc
{ "status": "ok", "exercicio": { "id": "e40", "nomePt": "Mergulho no banco (tríceps)", ... }, "gostoRelaxado": false }
// ou: { "status": "sinalizado", "exercicio": null, ... } se não há substituto elegível
```

**404** se `exercicioAtualId` não existe.

---

## GET `/api/catalogo/alimentos`

Os **125** alimentos curados (base TACO). `{ "total": 125, "alimentos": [ ... ] }`.

## GET `/api/catalogo/exercicios`

Os **163** exercícios da biblioteca. `{ "total": 163, "exercicios": [ ... ] }`.

## GET `/api/catalogo/pratos`

Os **56** pratos, cada um com `macros` computadas (soma TACO × gramas dos ingredientes).
`{ "total": 56, "pratos": [ { ...recipe, "macros": {...} } ] }`.

---

## Notas para o front-end (Claude Design)

- Trate **sempre** o caso `ROTEAR` / `sinalizado`: não há plano — mostre a orientação, não um
  cardápio vazio. É requisito legal, não detalhe de UX.
- O `gate.avisos` carrega mensagens de borda (ex.: piso calórico de segurança aplicado) — vale
  exibir.
- Os endpoints são **puros**: mesma entrada → mesma saída. Pode cachear no cliente por perfil.
- **Sem auth ainda.** Quando a Fase 1 entrar, estas rotas passarão a exigir sessão (cookie
  Supabase) e a base curada virá do banco com RLS — o contrato de entrada/saída acima não muda.
