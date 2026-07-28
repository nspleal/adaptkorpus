# Proposta — remapeamento de `grupoPrimario` para 12 valores (Leva 2.1 · Bloco B)

> ✅ **RATIFICADO E APLICADO em 2026-07-28.** `e97 → costas` · `e129 → gluteos` · `pernas`
> dissolvido. **Uma re-ratificação durante a aplicação:** `e151` (Patinador) foi de `gluteos`
> para **`quadriceps`** — ver §7. O resto saiu exatamente como proposto.
> A DF de 2026-07-27 manda que `trapezio` e `adutores` sejam "absorvidos pelo vizinho", com a
> escolha **exercício a exercício voltando para ratificação**. Este documento é essa volta —
> e traz o diff completo dos 26 exercícios afetados, para o cofre arquivar e atualizar a
> tabela de distribuição.

---

## 1. Os dois casos que precisam da sua ratificação

### `trapezio` — 1 exercício

| id | nome | `grupoMuscular` (texto do catálogo) | padrão |
|---|---|---|---|
| `e97` | **Encolhimento (trapézio)** | Trapézio | `isolado` |

**Proposta: `costas`.** O trapézio é, anatomicamente, músculo do dorso — origem occipital/
processos espinhosos, inserção na escápula/clavícula. A DF pede "12 valores **anatômicos**", e
`costas` é a região anatômica correta. O encolhimento também costuma cair no dia de costas na
maioria das divisões.

**Alternativa defensável: `ombros`.** A ação é elevação escapular e, na prática de academia,
o encolhimento é programado junto com deltoides. Se o critério for "onde o usuário espera ver",
`ombros` ganha; se for "onde o músculo fica", `costas` ganha. **Escolhi o segundo** porque o
objetivo declarado do remap é limpar o vocabulário para que ele seja anatomia — mas a decisão
é sua, e trocar depois é uma linha.

### `adutores` — 1 exercício

| id | nome | `grupoMuscular` (texto do catálogo) | padrão |
|---|---|---|---|
| `e129` | **Cadeira adutora** | Adutores (parte interna da coxa) | `isolado` |

**Proposta: `gluteos`.** O grupo adutor é musculatura **do quadril**, e no conjunto dos 12 o
`gluteos` é o vizinho de quadril — não há linha de "coxa medial". A cadeira adutora treina
adução de quadril, ação de estabilização que o usuário associa ao complexo glúteo/quadril.

**Alternativa defensável: `posterior`.** O adutor magno é frequentemente chamado de "quarto
isquiotibial" (é extensor de quadril e compartilha inervação parcial). Se o cofre preferir a
leitura por **função de extensão**, `posterior` é a escolha. **Não escolhi essa** porque a
cadeira adutora isola o grupo inteiro em **adução**, não em extensão — o magno é só parte dele.

> Nos dois casos, o impacto é pequeno e localizado: são **2 exercícios em 163**, ambos de padrão
> `isolado`, e a régua da tela pertence ao **padrão**, não ao grupo. Trocar a escolha depois não
> quebra nada e não invalida histórico (a contagem é derivada, recalculada a cada render).

---

## 2. `pernas` se dissolve — os 3, com destino

A DF manda dissolver; nenhum dos três é ambíguo o bastante para travar a leva, mas registro o
raciocínio de cada um.

| id | nome | padrão | destino | por quê |
|---|---|---|---|---|
| `e143` | Avanço com salto | `agachar` | **`quadriceps`** | avanço é padrão de agachamento, quadríceps-dominante |
| `e163` | Agachamento com salto | `agachar` | **`quadriceps`** | idem — agachamento, com a mesma dominância |
| `e151` | Patinador (skater) | `cardio` | **`quadriceps`** ③ | proposto `gluteos` (glúteo médio, plano frontal) e **re-ratificado** na aplicação — ver §7 |

⚠️ `e151` tem **padrão `cardio`** mas **grupo `pernas`** — pela regra, quem vira `null` é quem
está nos **grupos** `cardio`/`corpo-inteiro`, não quem tem padrão cardio. Então ele ganha grupo
fino **e** continua contando na linha do padrão `cardio`. Padrão e grupo são eixos diferentes;
está correto que apareça nos dois.

---

## 3. Diff completo — 26 exercícios mudam de valor

`grupoPrimario` vira **nullable**. 12 exercícios recebem `null` (5 de `cardio` + 7 de
`corpo-inteiro`) e passam a contar **só pelo padrão de movimento**.

### 3.1 Viram `null` (não são grupos musculares — são **tipo**, que já existe como campo)

| id | nome | antes | depois | padrão |
|---|---|---|---|---|
| `e23` | Polichinelo | `corpo-inteiro` | **`null`** | `cardio` |
| `e24` | Corrida na esteira | `cardio` | **`null`** | `cardio` |
| `e25` | Polichinelo agachado | `corpo-inteiro` | **`null`** | `cardio` |
| `e29` | Bicicleta ergométrica | `cardio` | **`null`** | `cardio` |
| `e30` | Burpee | `corpo-inteiro` | **`null`** | `cardio` |
| `e31` | Elíptico | `cardio` | **`null`** | `cardio` |
| `e92` | Pular corda | `corpo-inteiro` | **`null`** | `cardio` |
| `e93` | Remo (máquina) | `cardio` | **`null`** | `cardio` |
| `e109` | Caminhada do fazendeiro | `corpo-inteiro` | **`null`** | `cardio` |
| `e110` | Corda naval (battle rope) | `corpo-inteiro` | **`null`** | `cardio` |
| `e144` | Thruster (agachamento + desenvolvimento) | `corpo-inteiro` | **`null`** | `cardio` |
| `e150` | Corrida no lugar (joelho alto) | `cardio` | **`null`** | `cardio` |

*(Os 12 têm padrão `cardio` — a linha do padrão os cobre inteiros. Nenhum fica invisível.)*

### 3.2 `core` absorve `abdomen` (9 exercícios)

| id | nome | antes | depois | padrão |
|---|---|---|---|---|
| `e4` | Abdominal (crunch) | `abdomen` | **`core`** | `core` |
| `e5` | Abdominal na polia | `abdomen` | **`core`** | `core` |
| `e6` | Abdominal na máquina | `abdomen` | **`core`** | `core` |
| `e85` | Elevação de pernas | `abdomen` | **`core`** | `core` |
| `e88` | Elevação de pernas suspenso | `abdomen` | **`core`** | `core` |
| `e89` | Elevação de joelhos no apoio | `abdomen` | **`core`** | `core` |
| `e115` | Abdominal infra (canivete) | `abdomen` | **`core`** | `core` |
| `e149` | Abdominal bicicleta | `abdomen` | **`core`** | `core` |
| `e159` | Abdominal remador | `abdomen` | **`core`** | `core` |

### 3.3 Absorções e dissolução (5 exercícios — os que precisam da sua ratificação em ①②)

| id | nome | antes | depois | padrão |
|---|---|---|---|---|
| `e97` | Encolhimento (trapézio) | `trapezio` | **`costas`** ① | `isolado` |
| `e129` | Cadeira adutora | `adutores` | **`gluteos`** ② | `isolado` |
| `e143` | Avanço com salto | `pernas` | **`quadriceps`** | `agachar` |
| `e163` | Agachamento com salto | `pernas` | **`quadriceps`** | `agachar` |
| `e151` | Patinador (skater) | `pernas` | **`quadriceps`** ③ | `cardio` |

---

## 4. Distribuição resultante — para a tabela da spec

**163 exercícios · 151 com grupo · 12 com `null` · 12 valores distintos (nenhum fora da lista).**

| valor | antes | depois |
|---|---|---|
| `peito` | 18 | 18 |
| `costas` | 15 | **16** |
| `ombros` | 17 | 17 |
| `biceps` | 11 | 11 |
| `triceps` | 10 | 10 |
| `antebraco` | 6 | 6 |
| `core` | 10 | **19** |
| `lombar` | 2 | 2 |
| `gluteos` | 10 | **11** |
| `quadriceps` | 21 | **24** |
| `posterior` | 12 | 12 |
| `panturrilha` | 5 | 5 |
| ~~`abdomen`~~ | 9 | — (→ `core`) |
| ~~`cardio`~~ | 5 | — (→ `null`) |
| ~~`corpo-inteiro`~~ | 7 | — (→ `null`) |
| ~~`pernas`~~ | 3 | — (dissolvido) |
| ~~`trapezio`~~ | 1 | — (→ `costas`) |
| ~~`adutores`~~ | 1 | — (→ `gluteos`) |

**O menor grupo passa de 1 para 2 exercícios** (`lombar`), e some a situação de linha que
existe para um exercício só. Nenhum valor fica vazio.

---

## 5. O que muda no app, junto (para a Leva 2.1)

1. **A tela de frequência passa de 18 para 12 linhas.** A região **"Outros"** deixa de existir
   (era só `corpo-inteiro` e `cardio`); as três regiões viram Superior (6) · Tronco (2) ·
   Inferior (4).
2. **A sessão de cardio (`tipo: 'cardio'`) passa a contar só no padrão.** Hoje ela conta em
   `porGrupo.cardio` **e** em `porPadrao.cardio`; com `cardio` fora da anatomia, some a linha de
   grupo e fica a do padrão — que é exatamente o que a DF pede.
3. **`grupoPrimario` nullable** exige tocar: o tipo em `data/types.ts`, `contarFrequencia` e
   `detalheDoGrupo` (ignorar `null`), a validação do seed e os testes que hoje afirmam
   "todo grupo do catálogo aparece na tela".
4. **Nada de migração de dado do usuário:** a contagem é derivada do histórico a cada render, e
   o histórico guarda **ids de exercício**, não grupos. Remapear o catálogo re-lê o passado
   inteiro com o vocabulário novo, sem tocar em nada gravado.

---

## 6. Ratificação

- [x] **`e97` Encolhimento → `costas`** — *"o campo é anatomia, não colocação de split"*
- [x] **`e129` Cadeira adutora → `gluteos`** — *"a máquina isola em adução, não em extensão"*
- [x] `pernas` dissolvido nos 3

## 7. ⚠️ A re-ratificação do `e151` (Patinador), durante a aplicação

Aplicado o diff, a varredura da substituição saltou de **3 vazios para 9**. A invariante é
travada e testada contra o motor standalone: *"EXATAMENTE 3 (o furo conhecido do e116)"*.

**Causa.** O `e151` é o **único pliométrico com padrão `cardio`** — os outros dois
(`e143` Avanço com salto, `e163` Agachamento com salto) têm padrão `agachar`. O filtro duro
da substituição exige preservar **grupo OU padrão**. Enquanto os três dividiam `pernas`, o
skater era preservado **pelo grupo**. Mandando-o para `gluteos` e os outros dois para
`quadriceps`, ele ficou sem grupo **nem** padrão em comum com ninguém do mesmo tipo →
`rank 3` → fora do filtro. Resultado: **6 vazios novos** (intermediário e avançado × os 3
equipamentos). No iniciante continuava funcionando, porque ali o nível degrada para o mesmo
padrão (`cardio`), que existe.

**Decisão (sua, consultada):** `e151` → **`quadriceps`**. Salto unilateral lateral — o
quadríceps faz propulsão e aterrissagem junto com o glúteo médio; e os três pliométricos
voltam a se preservar entre si. Varredura de volta em **3 vazios**.

**Efeito na distribuição:** `quadriceps` 23 → **24** · `gluteos` 12 → **11**. O resto da
tabela do §4 fica igual.

*(As duas alternativas recusadas, para o registro: aceitar os 6 furos exigiria afrouxar um
assert de paridade que existe justamente para não perder trocas; e relaxar o filtro duro
— por exemplo, preservar por TIPO quando não há grupo nem padrão — mexe num trilho travado
e pediria DF própria.)*
