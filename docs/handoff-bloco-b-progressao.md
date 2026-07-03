# Handoff — Bloco B: progressão viva (dupla progressão por feedback) + deload

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/evokorpus-app-dev-9in0hs`. Commit: `48f1942`. Fonte: cofre
> `parametros-motor-treino-evokorpus` §"Passo 2 — Progressão por feedback" + §"Isométricos" + §"Deload".
> Determinismo, sem "IA", sem promessa — honrados. Nada escrito no cofre.

## O contexto
O motor de progressão (`progredirExercicio`, `precisaDeload`, `aplicarDeload`) **já existia puro e
testado** em `src/lib/engine/treino.ts`, mas **nada no app o chamava** — o feedback por exercício era
coletado e nunca virava progressão. Este trabalho **ativou** a autorregulação, estendeu-a a **segundos**
(isométricos) e ligou o **deload**. Decisões do autor: **incluir o deload** · **guiada + manual** avançam.

## O que entrou

### 1. Motor — ramo de SEGUNDOS + estado derivado
- `progredirExercicio` agora é parametrizado por unidade: nos 5 isométricos progride em **±5 s**
  (`INCREMENTO_SEG`/`DECREMENTO_SEG` em `isometricos.ts`), com a faixa vinda de `faixaSegundos()`. As
  **reps ficam idênticas** (regressão dos 13 testes originais verde). Espelha o cofre §Isométricos:
  *na medida* +5 s até o teto · *fácil* +1 série → sobe modificação → reset ao piso · *difícil 2×* −5 s
  (piso 10 s) ou desce modificação.
- `estadoInicial` + `estadoAposHistorico`: **dobra pura** de `progredirExercicio` sobre o histórico
  (mesmo histórico → mesmo alvo). No modo **carga**, semeia a base pela **carga logada** da sessão antes
  de progredir (sugere +2,5%); nunca sugere 0 kg (base ausente → sem sugestão).

### 2. Adaptador client `src/lib/treino-progressao.ts` (derivado — sem `localStorage` novo)
- `progressoDosExercicios(historico, prescricao, byId)`: alvo atual por exercício, de `evk_treinos`
  (**guiada + manual**, ordem cronológica real; customs com id `''` caem fora).
- `precisaDeloadDoHistorico`: **reativo** (≥3 "difícil" em ~2 semanas, qualquer nível) + **agendado**
  (a cada 6 semanas — intermediário/avançado; iniciante é só reativo).

### 3. UI — a meta que evolui + semana de alívio
- **Sessão guiada** (`SessaoTreino`): cada exercício mostra a **meta progredida** — peso corporal/holds
  como **alvo único** (ex.: "1 × 9 reps", "3 × 25 s") com a **faixa como contexto** ("faixa 8–15");
  carga mostra a faixa + **sugestão "tente ~X kg"**; um **hint de evolução** ("Sua meta evoluiu…").
  As **séries são por exercício**.
- **Deload**: quando ativo, corta ~metade das séries (mantém os movimentos), **banner "Semana de alívio"**
  na aba **Hoje** (pill no cartão) e no **guiado** — tom acolhedor, sem vermelho.
- Changelog: +1 item ("Seu treino evolui com você").

## Qualidade
`typecheck` · `lint` · **187 testes** (+15: segundos, `estadoAposHistorico`, adaptador, deload) · `build`
— verdes. Reps continuam idênticas (regressão). **E2E Playwright, zero erros de console**: 1 sessão "na
medida" → o guiado seguinte mostra os 4 exercícios de peso corporal em **"1 × 9 reps"** (piso 8 → +1),
enquanto o de carga fica na faixa (progride por peso); fadiga (3 "difícil") → **banner de alívio** na
Hoje e no guiado.

## Decisões minhas / deferidos (voltam por você)
1. **Passo de segundos = 5 s** (cofre "+5–10 s / −5–10 s" — escolhi o passo único determinístico dentro da
   faixa; se preferir 10, é 1 constante).
2. **Modificação de dificuldade (`variacaoNivel`) segue advisory**: o motor conta o degrau e a UI mostra
   um hint, mas a **troca real de exercício por degrau** (peso corporal) e a **escada de variação com
   carga** não existem estruturadas na biblioteca (1 hold/movimento, sem grafo de dificuldade). Continua
   p/ o cofre modelar — como já sinalizado no handoff anterior.
3. **Farmer hold (#140)** segue time-only (peso opcional = "Bloco B" de dieta/carga do cofre; não ativei
   carga natural nele).
4. **Deload sem re-montar a rotina**: corto ~metade das séries e sugiro −10% de carga (honra "corta ~metade
   das séries, mantém movimentos"), sem regenerar o dia — menor risco. Se quiser re-montagem real com
   volume reduzido, é uma iteração à parte.
5. **Sugestão de carga** aparece no chip/linha-guia (não pré-preenche o input de kg — a pessoa decide).

## Arquivos
**Novos:** `src/lib/treino-progressao.ts` (+`.test.ts`).
**Alterados:** `src/lib/engine/treino.ts` (ramo segundos + `estadoInicial`/`estadoAposHistorico`),
`isometricos.ts` (passos ±5 s), `engine/index.ts` (exports), `treino.test.ts` (+8 casos),
`SessaoTreino.tsx` (meta viva + banner), `Painel.tsx` (computa/injeta progresso + deload),
`changelog/page.tsx`.
