# Handoff — Correção: a curva de Cargas nunca aparecia

Data: 2026-07-05 · Branch: `claude/evokorpus-app-dev-9in0hs` · **Nada escrito no cofre.**

## O sintoma

Na aba **Histórico → Cargas**, o exercício aparecia no seletor (ex.: "Supino com halteres"),
mas o cartão ficava preso em **"Registre mais sessões deste exercício para ver a curva de
progressão"** — mesmo depois de registrar várias sessões.

## A causa (bug real, reproduzido)

A série do gráfico era montada agrupando por **DIA** (`Map` keyed por `dataISO`, guardando a
maior carga do dia). Como o gráfico precisa de **≥ 2 pontos** para desenhar a linha, quem
treinava — ou testava — o **mesmo exercício mais de uma vez no mesmo dia** via as sessões
**colapsarem num único ponto**, e a curva nunca aparecia. Exatamente o caso do print: 3
sessões, todas em "4 de julho".

Reprodução determinística (antes → depois), com a lógica isolada:

| Cenário | Antes (por dia) | Depois (por sessão) |
|---|---|---|
| 3 sessões no **mesmo dia** (20/22/24 kg) | 1 ponto → texto vazio | **3 pontos → curva** |
| 3 dias distintos | 3 pontos → curva | 3 pontos → curva (igual) |
| 1 sessão só | 1 ponto → texto vazio | 1 ponto → texto vazio (correto) |
| logado **sem kg** | some no seletor | some no seletor |

Havia ainda uma **contradição interna**: a própria copy do cartão sempre disse *"Evolução da
carga ao longo das **sessões** registradas"* — o código é que agrupava por dia. Agora batem.

## A correção

1. **Nova lógica pura + testada** — `src/lib/cargas-serie.ts`:
   - `serieCargaPorExercicio(historico, id)` → **um ponto por SESSÃO** (a maior carga da
     sessão), em ordem cronológica (`dataISO` e, no mesmo dia, ordem de registro `n`).
     Determinística.
   - `exerciciosComCarga(historico)` → o seletor agora só lista exercícios da biblioteca com
     **ao menos uma série com kg registrado** (antes listava qualquer `loaded`, mesmo sem
     carga — o usuário selecionava e via série vazia).
2. **`src/components/painel/CargasHistorico.tsx`** passou a consumir as duas funções (removida
   a lógica inline de agrupamento por dia). Sem mudança visual — o `GraficoLinha`, o resumo
   "Você estava em X, hoje Y" e o badge de delta seguem iguais.
3. **`src/lib/cargas-serie.test.ts`** — 6 testes ancorando os cenários acima (o principal é a
   regressão do "3 sessões no mesmo dia → 3 pontos"). O vitest só coleta `.ts`, por isso a
   lógica foi extraída do `.tsx` para um módulo testável — no mesmo espírito de "motor puro".

## Verificação

- `npm run typecheck` → 0 erros · `npm run lint` → limpo · `npm run build` → ok.
- `npm test` → **26 arquivos, 280 testes** verdes (+6 do `cargas-serie`).
- **E2E Playwright** contra o build de produção: perfil semeado + 3 sessões de "Supino com
  halteres" **no mesmo dia** (20/22/24 kg) → a aba Cargas renderiza a **curva** com resumo
  "Você estava em 20 kg, hoje 24 kg · +4 kg", **sem** o texto de vazio, **zero erros de
  console**. (Screenshot enviado no chat.)

## Nota para o cofre (decisão a ratificar — não escrevi lá)

A semântica passou de **"maior carga por dia"** para **"uma medição por sessão registrada"**.
Isso alinha o gráfico à copy existente e ao modelo mental do usuário (cada treino é um ponto).
É uma mudança de comportamento pequena e, a meu ver, uma correção — mas como toca a definição
do que a curva significa, fica registrada aqui para você ratificar/arquivar no cofre. Se
preferir manter o agrupamento por dia, dá para reverter só a `serieCargaPorExercicio` sem
tocar no resto.
