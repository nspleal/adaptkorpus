# Ficha de handoff — LEVA 2 (2026-07-27)

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

> Para a sessão LOCAL arquivar no cofre. **Nada foi escrito no cofre por esta sessão**
> (escritor único). Branch `claude/adaptkorpus-app-dev-9in0hs`, 4 commits, **não promovido**.

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

`Adaptkorpus Cardio.dc.html` aparece em **3 lugares**:

| Pasta | Telas |
|---|---|
| raiz do zip (arquivo solto) | — |
| `design_handoff_dieta_e_cardio` | 10 |
| **`design_handoff_adaptkorpus_dieta_cardio_retomada`** | **14** ← CANÔNICA |

Totais conferidos: **cardio 14 + dieta 10 + retomada 7 + "fiquei doente" 5 + frequência 6 = 42** ✅

⚠️ **Não existe pasta `design_handoff_frequencia`** em nenhum dos zips. As 6 telas de
frequência existem só como arquivo solto na raiz
(`Adaptkorpus Frequ#U00eancia por Grupo.dc.html`). Usei esse arquivo; se houver uma pasta com
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
   `parametros-motor-treino-adaptkorpus` diz "caminhada 3,0/4,3/5,8"; a spec TRAVADA e o
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

---

# Adendo (2026-07-28) — 3 pedidos de fechamento

## A. O pacote de frequência estava no cofre (`4f99032`)

`raw/design-handoff-frequencia-por-grupo-2026-07-27.md` traz o `CLAUDE_CODE.md` da pasta
`design_handoff_frequencia` na íntegra. **Regra guardada:** todo pacote de design tem cópia
dos seus documentos no `raw/` do cofre; pacote quebrado ou incompleto se recupera de lá,
sem pedir reenvio.

O que faltava e entrou: linha de grupo como `<button>` real com nome acessível completo ·
tela de detalhe do grupo · padrões como `<ul>/<li>` em grid `minmax(0,1fr)` com os 2 pips ·
`role="tabpanel"` + navegação por ← → com foco · semana parcial · estado vazio completo ·
cartão "Como ler" · nota da Chama · `evkFill` com `prefers-reduced-motion`.

**Onde o pacote e o cofre discordaram, o cofre mandou** (cada ponto anotado no cabeçalho de
`FrequenciaGrupos.tsx`):

| §  do pacote | O que ele pedia | O que ficou |
|---|---|---|
| 7.3 | grupo **secundário** também conta | só `grupoPrimario` — não existe campo secundário no catálogo |
| 7.4 | 4 semanas = 4 fechadas **+ a corrente** | correção 3: **sem** a corrente (28 dias, 4 baldes) |
| 6.3 / 10.2 | marcador **sempre** em 50% | correção 1: com < 2 dias de força **não há marcador** |
| 6.3 | rótulo "2× de referência" | correção 4: **"2× — referência dos padrões"** |
| 7.6 | ler a contagem de padrões **do motor** | o motor não expõe essa contagem; é agregada do mesmo histórico, com a mesma régua |

## B. O caminho ROTEAR — o que o código faz hoje (não corrigido, como pedido)

**Não é um loop de redirecionamento. É um beco sem saída na porta.** Verificado no código e
no navegador.

1. **Onboarding, ao declarar condição** (`src/app/onboarding/page.tsx:161`): gate ROTEAR →
   `setFase('resultado')` → tela `GateB` ("Vamos com cuidado aqui"). **`salvarSessao` nunca é
   chamado** — não nasce sessão, não sobe perfil. As duas saídas são *"Revisar respostas"*
   (volta ao wizard no passo 0) e *"Ver conteúdos gerais"* (`/aviso`). **A pessoa nunca entra
   no app.**
2. **`/app` com sessão que ROTEIA** (`src/app/app/page.tsx:37`): `limparSessao()` +
   `router.replace('/onboarding')`. Confirmado no navegador: `evk_sessao` vira `null` e a tela
   final é o wizard, **estável** — recarregar `/app` leva ao wizard de novo, sem piscar.
3. **Como se chega ao caso 2 hoje:** praticamente não se chega. `EditarPerfil` **preserva
   `flagsSaude`** (`EditarPerfil.tsx:108`) e não reabre as condições; `registrarPeso` **não
   altera** `perfil.pesoKg`; e `Painel.recalcular` (`Painel.tsx:310`) já trata a edição que cai
   em ROTEAR mostrando o encaminhamento **sem persistir** e **sem derrubar o plano atual**. O
   ramo do `/app` é defesa contra dado corrompido — mas, se disparar, **apaga a sessão local**
   (o perfil no servidor sobrevive) e a pessoa cai no wizard do zero.

**Para os 6 testadores:** quem declarou condição no onboarding **nunca chegou ao painel** — não
ficou preso lá dentro. O sintoma que essa pessoa relataria é *"não consegui gerar meu plano"*,
não *"o app me expulsa"*. Quem já está usando o app não corre risco de ser expulso pelas ações
normais (editar perfil, registrar peso, registrar treino).

⚠️ **A decisão de produto que falta** (não tomada, não implementada): *o que o app entrega a
quem declara condição de saúde*. Hoje a resposta é "nada, e nem entra". A spec de cardio já
pressupõe o contrário — *"usuário roteado registra, mas não recebe meta"* — e a Leva 2 deixou
esse estado **pronto e inalcançável**: `metaCardioSemanal(objetivo, true) === null` e a seção de
cardio já renderiza sem prescrição (`Painel.tsx`, ramo `prescricao ? … : <CardioSemana/>`).
Quando a decisão sair, o que falta é só deixar a conta existir.

## C. Os 18 `grupoPrimario` do catálogo — lista verdadeira

De `src/lib/data/exercises.ts` (163 exercícios), valores **exatos** como estão no código, com
quantos exercícios cada um tem:

| # | valor no código | exercícios | rótulo na tela | região |
|---|---|---|---|---|
| 1 | `quadriceps` | 21 | Quadríceps | Inferior |
| 2 | `peito` | 18 | Peito | Superior |
| 3 | `ombros` | 17 | Ombros | Superior |
| 4 | `costas` | 15 | Costas | Superior |
| 5 | `posterior` | 12 | Posterior | Inferior |
| 6 | `biceps` | 11 | Bíceps | Superior |
| 7 | `core` | 10 | Core | Tronco |
| 8 | `gluteos` | 10 | Glúteos | Inferior |
| 9 | `triceps` | 10 | Tríceps | Superior |
| 10 | `abdomen` | 9 | Abdômen | Tronco |
| 11 | `corpo-inteiro` | 7 | Corpo inteiro | Outros |
| 12 | `antebraco` | 6 | Antebraço | Superior |
| 13 | `cardio` | 5 | Cardio | Outros |
| 14 | `panturrilha` | 5 | Panturrilhas | Inferior |
| 15 | `pernas` | 3 | Pernas | Inferior |
| 16 | `lombar` | 2 | Lombar | Tronco |
| 17 | `trapezio` | 1 | Trapézio | Superior |
| 18 | `adutores` | 1 | Adutores | Inferior |

Soma = 163 ✅ · 18 valores distintos ✅

**Divergência com a tabela do cofre.** O cofre lista `obliquos · abdutores · pescoco ·
serratil`; **nenhum dos quatro existe no catálogo**. Em troca, o catálogo tem quatro que o
cofre não registra: `core · corpo-inteiro · cardio · pernas`. Os outros 14 batem.

**Sobre a qualidade do vocabulário — a pergunta que o cofre fez:**

- **Não são grupos musculares:** `cardio` (5) e `corpo-inteiro` (7) — são *tipos de exercício*
  ocupando um campo de anatomia. Ficam na região "Outros" na tela.
- **Grosso demais:** `pernas` (3) — coexiste com `quadriceps`, `posterior`, `gluteos`,
  `panturrilha` e `adutores`, que são o mesmo território mais fino. É um balde de sobra.
- **Fino demais para o tamanho do catálogo:** `trapezio` (1) e `adutores` (1) — uma linha na
  tela para **um** exercício cada. Vão exibir 0× na maioria das semanas, por construção.
- **`core` × `abdomen`** (10 e 9) é uma divisão real, mas a fronteira entre os dois não está
  documentada em lugar nenhum — dois nomes para uma região que o usuário lê como uma só.

**A tela renderiza os 18**, todos, sempre, com "0×" para quem não apareceu (é critério de
aceite §10.5). Ou seja: **4 das 18 linhas são estruturalmente questionáveis** (2 não-musculares
+ `pernas` redundante + a dupla `core`/`abdomen`), e **2 outras** (`trapezio`, `adutores`) vão
viver perto de zero por só terem 1 exercício cada. Somando com os acessórios que o próprio
cofre já aceitou ver apagados, a lista é mais longa do que informativa — mas o conserto é no
**catálogo**, num lugar só, e não na tela. Fica registrado para o autor decidir.
