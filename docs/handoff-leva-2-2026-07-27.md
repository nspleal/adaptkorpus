# Ficha de handoff — LEVA 2 (2026-07-27)

> Para a sessão LOCAL arquivar no cofre. **Nada foi escrito no cofre por esta sessão**
> (escritor único). Branch `claude/evokorpus-app-dev-9in0hs`, 4 commits, **não promovido**.

| Commit | Bloco |
|---|---|
| `b1166e6` | 3 — Rampa de retomada |
| `de03323` | 4 — "Fiquei doente" |
| `6ea1b1c` | 1 — Cardio |
| `79867f3` | 2 — Frequência por grupo |

Gate final: `typecheck` · `lint` · **526 testes** (429 → 526) · `build` (20/20 páginas).
Smoke Playwright das 4 peças (33 telas do design cobertas; ver §5).

---

## 1. Verificação de pacotes (§2 do handoff)

`Evokorpus Cardio.dc.html` aparece em **3 lugares**:

| Pasta | Telas |
|---|---|
| raiz do zip (arquivo solto) | — |
| `design_handoff_dieta_e_cardio` | 10 |
| **`design_handoff_evokorpus_dieta_cardio_retomada`** | **14** ← CANÔNICA |

Totais conferidos: **cardio 14 + dieta 10 + retomada 7 + "fiquei doente" 5 + frequência 6 = 42** ✅

⚠️ **Não existe pasta `design_handoff_frequencia`** em nenhum dos zips. As 6 telas de
frequência existem só como arquivo solto na raiz
(`Evokorpus Frequ#U00eancia por Grupo.dc.html`). Usei esse arquivo; se houver uma pasta com
`README.md`/`CLAUDE_CODE.md` da peça, ela não chegou.

---

## 2. O que entrou, por bloco

### Bloco 3 — Rampa de retomada (`b1166e6`)
- `engine/treino-retomada.ts` (novo): faixas (≤14 nada · 15–56 curta 0,50/0,70 · >56 longa
  0,50/0,70/0,80/0,90), fatores **não compostos**, `max(1, floor())`, teto por **IRV ≤ 30**
  com carga e **3 séries** sem carga, frequência máx. por **grupo** (3/4), descanso mínimo
  (120 s/90 s), **RIR-alvo 3** (piso da escada — nunca o RIR da semana em que parou).
- Montador: ramo de alocação próprio da rampa (as séries podem ficar **abaixo do piso da
  banda** — o estado que o motor não tinha). **B5 suspensa 2 semanas** via a isenção de
  favoritos, alimentada por `exerciciosRecentes`.
- `treino-historico`: separa `sessoesTreino` (Chama, **inclui** cardio) de
  `sessoesResistidas` (relógio do mesociclo + rampa, **exclui** cardio) — armadilha 2.
- UI: cartão com copy **por faixa** (a frase do volume plasmático só na curta), chip
  "Retomada · semana N de M" no lugar do contador do ciclo, rampa **supersede** o alívio
  reativo, sessão mostra a faixa real de séries e o RIR-alvo da semana.

### Bloco 4 — "Fiquei doente" (`de03323`)
- Estado = `{ reconhecidoEm }` no jsonb `preferencias`, **zero migração SQL**, motive-free.
- `pausa-reconhecida.ts`: precedência dura (rampa → só o chip · reconhecido → só o aviso ·
  senão → nada) e a regra de limpeza no 1º treino registrado.
- `FiqueiDoente.tsx`: entrada no pé da aba Treino (vocabulário do "Trocar"), folha
  `role="dialog"` com foco inicial em "Entendi", ciclo de Tab fechado, Esc = "Voltar",
  foco de volta na entrada, `aria-expanded`; aviso `aria-live="polite"`.
- Teste estático que **falha se `src/lib/engine` mencionar `reconhecidoEm`**.

### Bloco 1 — Cardio (`6ea1b1c`)
- `engine/cardio.ts`: tabela MET central (caminhada 2,3/4,3/5,8 · corrida 7,5/8,5/9,3 ·
  bike 3,8/5,5/7,4 · corda —/9,0/11,0 · lutas 5,3/7,5/10,3 · outro = caminhada), **classe
  derivada do MET**, kcal **líquida** arredondada à dezena com piso "menos de 10 kcal",
  meta por objetivo e meta escalada pela rampa.
- `cardio-semana.ts`: semana de **segunda** a domingo, leitura do histórico, acumulado.
- `Cardio.tsx`: registro (chips `radiogroup` + talk test + stepper), confirmação com o
  exemplo da própria pessoa, lista da semana, **"Movimento registrado"** para a leve,
  expansível do descompasso com o aparelho (fechado por padrão).
- Registro grava `tipo: 'cardio'` → fora do relógio do mesociclo, dentro da Chama.

### Bloco 2 — Frequência por grupo (`79867f3`)
- `frequencia-grupos.ts` + `FrequenciaGrupos.tsx` na aba **Progresso**, somente leitura,
  escala fixa 0–4×, ordem anatômica fixa, grupos em zero no DOM, seletor Semana/4 semanas.
- As **4 correções obrigatórias**, cada uma com o teste nomeado no critério de aceite.

---

## 3. Decisões que a spec não cobria

1. **Onde mora a seção de cardio.** O design a desenha como "a aba Treino", mas na nav real
   (6 abas) ela não é uma aba. Coloquei como **seção no pé da aba Treino**, abaixo do plano
   e **acima** da entrada "Fiquei doente" (que a spec exige no pé). Nenhuma navegação nova.
2. **O chip de retomada continua na aba Hoje**, onde vive o contador do mesociclo que ele
   substitui ("este contador substitui o do seu ciclo"). O design o desenha na aba Treino;
   segui a regra funcional, não o enquadramento do quadro. A frequência ficou na aba
   **Progresso**, como o design pede explicitamente.
3. **Limpeza do "fiquei doente" no mesmo dia.** As sessões só carregam data (sem hora), então
   o guard derivado usa `>` estrito (treino em dia POSTERIOR ao aviso). O caso "avisei e
   treinei hoje" é resolvido pela limpeza **imperativa** no ato do registro. O contrário
   (`>=`) faria o aviso nunca aparecer para quem treinou de manhã e avisou à tarde.
4. **Régua do cardio em saúde/emagrecimento.** A correção 2 manda usar "o alvo do objetivo",
   que nesses dois casos é em **minutos** — não cabe numa régua de "×/semana". A linha do
   cardio fica **sem marcador** e uma frase manda a referência para a tela de cardio. Só
   massa (e a rampa) têm marca, em **1**.
5. **`diasForca`** = dias da rotina montada (`rotinaDias.length`), com fallback em
   `treinoDias.length`. A spec fala em "dias de força agendados" sem dizer qual campo.
6. **Sessão de cardio na frequência**: conta no grupo **e** no padrão `cardio` (ela não tem
   exercícios do catálogo). Sem isso a linha de cardio ficaria eternamente em 0×.
7. **Total acumulado de cardio inclui a atividade leve** — é tempo de movimento, não
   progresso contra a meta. O número "que só cresce" não pode punir quem caminhou devagar.

---

## 4. Pontos em que o cofre pareceu errado (para o autor decidir)

1. 🔴 **O estado `cardio-sem-meta` é inalcançável no app de hoje.** A spec diz "usuário em
   ROTEAR registra, mas não recebe meta" — mas `src/app/app/page.tsx:37` **limpa a sessão e
   manda para o `/onboarding`** quando o gate de dieta é ROTEAR. Quem declara condição
   clínica nunca chega ao painel. Implementei o estado (meta `null` + a seção de cardio
   passou a renderizar **mesmo sem prescrição**, senão a aba Treino ficaria vazia para essa
   pessoa), mas ele só ficará visível quando o produto decidir **como** o usuário roteado
   entra no app. Coberto por unidade, não por smoke.
2. 🟠 **Os 18 valores de `grupoPrimario` do cofre divergem do catálogo real.** O cofre lista
   `obliquos · abdutores · pescoco · serratil`; o catálogo (`data/exercises.ts`) usa
   `core · pernas · corpo-inteiro · cardio`. São 18 dos dois lados. O próprio cofre diz que
   **o catálogo manda**, e foi o que fiz — a tabela do cofre precisa ser corrigida.
3. 🟠 **MET da caminhada leve: 2,3 ou 3,0?** A linha da pesquisa em
   `parametros-motor-treino-evokorpus` diz "caminhada 3,0/4,3/5,8"; a spec TRAVADA e o
   handoff dizem **2,3**, e a regra "atividade leve (só a caminhada de passeio, 2,3) não
   avança a meta" só faz sentido com 2,3 (com 3,0 a caminhada leve passaria a contar 1×).
   Usei **2,3**. A linha da pesquisa precisa ser reconciliada.
4. 🟡 **Cardio pode ser contado duas vezes.** O catálogo tem **13 exercícios `tipo: cardio`**
   e **14 com `padraoMovimento: cardio`** — o montador pode colocá-los na rotina. Quem faz
   a esteira dentro da sessão guiada **e** registra a mesma esteira em "Registrar cardio"
   soma duas vezes (dois minutos de meta, duas kcal). Nem a spec nem o design tratam isso.
   Não inventei regra; fica como decisão de produto.
5. 🟡 **A folha do "fiquei doente" não usa `inert` no conteúdo de trás.** O ciclo de Tab é
   fechado por armadilha manual (verificado no smoke), o que cumpre o critério de aceite;
   `inert` exigiria uma ref ao shell inteiro do painel. Registrado, não feito.

---

## 5. Verificação

- **Gate:** `npm run typecheck && npm run lint && npm test && npm run build` — verde.
  526 testes (nenhum teste existente removido).
- **Smoke Playwright** (dev em modo mock, Chromium de `/opt/pw-browsers`):
  - retomada: chip, ausência do contador do ciclo, rampa supersede o alívio, copy "PESO",
    copy por faixa, zero contagem de dias;
  - "fiquei doente": as 5 telas — foco inicial dentro do `[role="dialog"]`, ciclo de Tab
    fechado, Esc devolve o foco sem gravar, `aria-expanded`, **zero** `input/textarea/select`
    na folha, `#E5484D` ausente das **cores computadas**, telas 1 e 4 idênticas byte a byte,
    aviso fora do DOM com a rampa ativa;
  - cardio: semana vazia, registro (6 modalidades, talk test, stepper), pular corda com **2
    baldes**, confirmação com "+40 min" e o exemplo da própria pessoa, meta batida, piso
    "menos de 10 kcal", massa em sessões, retomada (150 → 75), movimento registrado,
    descompasso fechado por padrão abrindo no lugar;
  - frequência: 18 grupos no DOM com zeros, ordem anatômica, 1× por sessão, **as 4
    correções** (1 dia → sem marcador; cardio marcado em 1; 4 semanas sem a corrente;
    rótulo do padrão), vocabulário proibido ausente, somente leitura.
- **A kcal não volta para a dieta:** alvo do dia **2276 kcal** antes e **2276 kcal** depois
  de registrar 60 min de corrida vigorosa (≈700 kcal estimadas).

## 6. Fora de escopo, como combinado

Todas as demais pastas de design (dieta, banner, chama, escada, estados, favoritos,
institucional, calibração, recursos do painel, reembolso/FAQ/changelog, registrar refeição,
registro e contador) seguem **intocadas**. Nada foi promovido para `main`.
