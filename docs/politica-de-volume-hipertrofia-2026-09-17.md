# Política de volume da hipertrofia + cobertura muscular no editor

2026-09-17. **Candidato, sem publicação.** Nenhum merge, nenhum deploy de produção, nenhuma
alteração do cofre. Nenhuma gravação em conta real.

## Procedência

| Campo | Valor |
|---|---|
| Base | `origin/main` = `8b41ec9389629258966b61c8dfd6e75849744170` (PR #15) |
| Branch | `trabalho/volume-hipertrofia-tabela` |
| Worktree | `adaptkorpus-volume-hipertrofia` (isolada; nenhuma outra worktree foi tocada) |
| Produção | intacta em `8b41ec9` (`dpl_8jmDTD7Nwc9F31R2GZzTrv5F3N2y`, target `production`) |

`origin/main` está **155 commits à frente** de `origin/claude/evokorpus-app-dev-9in0hs` (o `HEAD`
remoto herdado) e o contém por inteiro — por isso ela é a base.

## A decisão, em três números por nível

Séries **ponderadas** por grupo muscular: participação direta = 1, indireta = 0,5
(`PESO_SECUNDARIO`, a autoridade canônica que já existia). Aquecimento não é série de trabalho e
não entra na conta; e não se multiplica série por cabeça ou região anatômica — cobertura regional
e orçamento de volume são medidas distintas.

| Nível | Faixa semanal desejada | Teto semanal | Máximo automático SEM foco |
|---|---|---|---|
| Iniciante | 6–10 | 13 | 10 |
| Intermediário | 10–14 | 19 | 16 |
| Avançado | 12–18 | 21 | 18 |

**Teto por sessão: 12 séries ponderadas por grupo, para todos os níveis, com ou sem foco.**

- A margem de 3 vale **só** no teto semanal dos grupos **sem** foco.
- O grupo em foco pode chegar ao teto semanal cheio (13/19/21).
- Não existe margem no teto por sessão.
- Os dois limites valem **ao mesmo tempo**.
- Máximo permitido **não é meta**: a rampa mira a faixa desejada e nada empurra volume para cima
  só porque cabe.
- A exceção do foco é **do grupo**: um extra de peito não libera ombros nem tríceps a usarem os
  tetos cheios deles.

São **política do aplicativo** — não um MRV individual medido, não um limite biológico universal,
não um limiar automático de lesão.

### O que isso substitui

Até `8b41ec9`, `volumePorGrupoSemana.massa` era **ao mesmo tempo** o alvo da rampa e o teto duro
(iniciante 10–12 · intermediário 13–16 · avançado 16–20). Os dois papéis agora são números
diferentes, e a leitura mora num lugar só (`engine/trilhos.ts`).

## Onde cada coisa vive

| Peça | Arquivo |
|---|---|
| Os números (faixa desejada, teto cheio, margem, teto de sessão) | `engine/treino-constants.ts` |
| A derivação (`tetoSemanalCheio`, `maxSemanalSemFoco`, `tetoSemanalDoGrupo`, `tetoPonderadoNaSessao`) | `engine/trilhos.ts` |
| A poda ponderada, semanal e por sessão | `engine/teto-ponderado.ts` |
| Composição do dia dentro do teto de sessão | `engine/alocador.ts` (`tetoPonderadoDia`) |
| Fiação (rampa, foco, fases, desenho manual, publicação dos tetos) | `engine/treino-montador.ts` |
| O que a tela diz | `engine/critico.ts` · `painel/EditorTreino.tsx` · `painel/CoberturaMuscular.tsx` |

`saude` e `emagrecimento` **não herdam** esta tabela: nem os tetos, nem a margem de 3, nem o teto
de 12 por sessão. Onde já usavam o topo da faixa como teto, continuam usando. Core, antebraço,
panturrilha e lombar continuam com as políticas próprias que já tinham (piso de presença,
invariante de 2–3×/sem do core, cobertura só-indireta de lombar/antebraço) — nenhuma faixa nova
foi inventada para eles, e nenhuma dose menor foi elevada só porque agora existe teto de 12.

## Volume entregue — antes × depois

Medido com o mesmo script nas duas pontas (`origin/main` × candidato), academia, semana 5 do
mesociclo salvo indicação. Formato `direto/indireto/ponderado`.

| Perfil | Grupo | Antes | Depois |
|---|---|---|---|
| iniciante 3d/60min | costas | 12/0/**12** | 10/0/**10** |
| iniciante 3d/60min **+ foco costas** | costas | 12/0/**12** (foco sem efeito) | 12/0/**12** (margem usada) |
| intermediário 4d/60min | peito · costas · ombros | 16/0/**16** cada | 12/0/**12** cada |
| intermediário 4d/60min **+ foco peito** | peito | 16/0/**16** (foco sem efeito) | 16/0/**16** (margem usada) |
| intermediário 4d/60min **+ foco peito** | ombros (terceiro) | 16/0/**16** | 12/2/**14** |
| avançado 5d/75min | peito · ombros | 20/0/**20** | 12/0/**12** |
| avançado 5d/75min | costas | 16/4/**20** | 12/2/**14** |
| intermediário 4d/60min **deload (S6)** | peito | 8/0/**8** | 6/0/**6** |

Totais da semana (séries · slots):

| Perfil | Antes | Depois |
|---|---|---|
| iniciante 3d/60min | 54 · 18 | 52 · 18 |
| intermediário 4d/60min | 92 · 23 | 80 · 20 |
| avançado 5d/75min | 108 · 27 | 88 · 25 |
| intermediário 4d/60min (deload) | 46 · 23 | 40 · 20 |
| intermediário 6d/45min | 76 · 20 | 71 · 18 |
| intermediário 4d/90min sem limite | 96 · 24 | 84 · 21 |
| intermediário 1d e 2d/60min | 27 · 10 e 48 · 12 | **idênticos** (o limite ali é a estrutura, não a faixa) |

Por dia, a consequência visível é **menos um exercício** em vários dias: as fotografias de
`orcamento-caracterizacao` saíram de 7/6/6/5 para 6/5/5/4 nas células de massa. Nenhum dia passa
das 12 ponderadas por grupo (salvo a exceção medida abaixo) e nenhum grupo passa do seu teto
semanal em toda a grade varrida.

**O foco passou a fazer efeito.** Antes, nos três perfis acima, `com foco == sem foco` — o teto já
estava no limite e o bloco era recusado. Agora ele entra e para exatamente no teto cheio, sem tirar
série de ninguém.

## Varredura

`iniciante · intermediário · avançado` × `1–7 dias` × `20 · 45 · 75 min` × `limitado · sem_limite`
× `semanas 1, 3, 5, 6` × `com e sem foco`:

- **0 planos** com um grande acima do teto semanal do seu porte.
- **12 planos** com um grande acima do teto de sessão — todos em
  `avançado/massa/6d ou 7d/45min/limitado`, sempre `posterior 13 contra 12` no mesmo dia.
- A poda semanal age em **333** células e a poda por sessão em **108**: os dois consertos são
  exercitados de verdade, não são código morto.

### A exceção medida, declarada

Em `avançado/massa/6–7d/45min/limitado`, o dia de posteriores nasce com 3 slots diretos já no piso
por exercício do nível (3 séries cada = 9 diretas) e recebe mais 4 de crédito **indireto** de dois
exercícios de glúteos no mesmo dia → 13 contra 12. A poda não consegue corrigir: ela só tira série
dos slots **diretos do próprio grupo** e nunca abaixo do piso por exercício, e reduzir glúteos
seria cobrar de um terceiro por um teto que não é dele.

O excesso **não é silencioso**: o crítico o diz, com o número, em `acima_do_maximo_na_sessao`
(*"Posterior soma 13 séries em Posteriores + complementares — acima das 12 por grupo num mesmo
treino"*). A lista das células está fixada em `volume-hipertrofia-2026-09-17.test.ts` — uma célula
nova derruba o teste em vez de se esconder atrás de uma tolerância.

## O que a tela passou a dizer

Três estados por grupo no placar, em vez de dois:

| Estado | Quando | Severidade |
|---|---|---|
| `na_banda` 🟢 | dentro da faixa até o máximo automático | — |
| `acima_do_automatico` 🟡 | acima do máximo automático, **dentro** do teto cheio | recomendação |
| `acima_mrv` 🔴 | acima do teto cheio | risco |

E um aviso novo por sessão (`acima_do_maximo_na_sessao`, risco).

O caso do relato de 15/09 — desenho manual com 17 séries de peito num intermediário — deixou de
dizer *"está acima do volume máximo do seu nível (17 contra 16)"*. Passa a dizer:

> Peito está com 17 séries nesta semana: acima das 16 que o app usa quando monta sozinho, e ainda
> dentro do teto de 19. Se a escolha foi sua, ela vale — só acompanhe como você recupera.

E **não** afirma que o teto foi ultrapassado — é a exigência literal da decisão. Nada trava o
salvamento; nenhum bloqueio novo foi introduzido.

### Séries digitadas continuam intactas

A poda (semanal e por sessão) alcança **apenas** o que o app dosou (`seriesDefinidasPeloUsuario`
continua sendo o filtro). Verificado no motor e na tela: 6/6/6 digitados em peito sobrevivem
6/6/6, e o excesso que fica é dito pelo crítico — nunca corrigido em silêncio.

## Fases

- **Deload (S6):** o teto da fase é a banda que `aplicarDeload` já produz (−45 %, constante
  existente). `tetoSemanalDoGrupo` toma o **menor** entre o do nível e o da fase. A margem de 3 já
  foi aplicada uma vez ao derivar o máximo sem foco e **não** é subtraída de novo da dose reduzida
  — travado por teste (`semFoco === reduzido` e `!== reduzido - 3`).
- **Retomada:** a fase não declara teto menor (ela reduz o **alvo**), e não aplica o bloco do foco
  — `gruposEmFoco` sai vazio nela, mesmo com foco no perfil. Os guarda-corpos próprios da retomada
  (frequência por grupo, IRV, alvo do grupo) continuam mandando por cima.
- Nenhuma fase aplica deload duas vezes: a redução continua acontecendo num ponto só.

## Poucos dias, tempo e as três medidas

O motor distingue, e a tela também:

1. **faixa semanal desejada** — `faixaVolumeSemana`, o que a rampa mira;
2. **meta adaptada** — o menor entre o desejado e o que o layout comporta (`slots × séries por
   exercício`, com o teto de 12 por sessão);
3. **volume entregue** — o que sai no plano.

Quando (2) fica abaixo de (1), o motor **diz**: *"Semana 5: alvo de 14 séries para peito não cabe
em 3 exercício(s) — planejadas 12."* Quando um grupo obrigatório fica abaixo do piso, o guard de
cobertura continua falando. As divisões aprovadas seguem intactas (1 dia full body, 2 dias
superiores/inferiores, 3+ pela regra existente), e nenhum dia concentra acima de 12 por grupo para
alcançar a faixa semanal.

## Um defeito corrigido em passagem: plano × editor

Medido neste candidato: a rampa repartia as séries do grupo em round-robin na **posição** do slot,
e o ramo automático reordena os slots depois (`reordenarPeloFoco`). O editor persiste a ordem
final; ao reabrir, a mesma rampa rodava sobre outra permutação e o **mesmo total** do grupo caía
em slots diferentes (`qui/e54=1 e41=2` no plano contra `e54=2 e41=1` no editor).

A repartição passou a ordenar por **identidade** (dia, id do exercício). O dia continua sendo o
primeiro critério; dentro dele, dois planos com os mesmos exercícios repartem igual, na ordem que
a tela quiser mostrar. Nada muda **quanto** o grupo recebe.

## Cobertura muscular no editor — a investigação

**O componente existia e estava em produção.** O SHA servido em produção
(`dpl_8jmDTD7Nwc9F31R2GZzTrv5F3N2y`) é `8b41ec9`, que contém `a6853ec — feat(treino):
gerar/atualizar o treino com prévia, e cobertura muscular no editor`. A causa do relato não é
código ausente.

Três defeitos concretos, todos corrigidos:

1. **Sumia com o dia vazio.** `CoberturaMuscular` devolvia `null` quando o dia não tinha
   exercício — que é exatamente como a pessoa abre o editor pela primeira vez. Ausência é
   indistinguível de quebrado. Agora o dia vazio DIZ o que vai aparecer.
2. **Ficava depois do botão verde.** Ela era renderizada **abaixo** do `+ Adicionar exercícios`,
   um botão de largura cheia que fecha visualmente o cartão do dia — no celular, o que vem depois
   dele lê-se como rodapé. Subiu para **antes** do botão, colada na lista que descreve.
3. **Fechada por padrão, com sumário de baixo contraste.** Virou um **cartão com moldura**, título
   em destaque e dois chips (`N regiões`, `N sem exercício`), e **abre sozinha quando há região sem
   exercício identificado** — quando não há, continua fechada, porque aí é confirmação, não tarefa.

O comportamento exigido foi verificado na interface (build de produção, `next start`, fixture local
sem backend — nenhuma conta real tocada):

| Exigência | Verificado |
|---|---|
| Recalcula ao **remover** | Terça: `14 regiões · 2 sem exercício` → `10 regiões · 1 sem exercício` ao remover o exercício de core |
| Recalcula ao **adicionar** | `10 regiões · 1 sem exercício` → `11 regiões` (sem chip) ao aceitar uma sugestão |
| Partes contempladas · sem exercício · sugestões | Listadas por grupo, com o nome da ficha (nunca o id) |
| Participação identificada × inferência | Blocos separados: *"Contempladas"* × *"Participação auxiliar (por inferência anatômica) — não fecha cobertura"* |
| Condição não declarada | Rótulo fechado *"Depende da execução; não confirmado"* + *"Adicionar não confirma esta região"* |
| Lacuna de catálogo ≠ ausência de ativação | *"Nenhum exercício do catálogo aborda esta região diretamente"* / *"nenhum está liberado pelo seu equipamento e nível atuais"*; nunca *"não é ativada"* |
| Um exercício contempla várias partes | *"Um exercício pode contemplar várias — não é preciso um exercício por região"* |
| Não adiciona sozinha, não bloqueia salvar | Só por toque; nenhum `useEffect` no componente; o salvar nunca desabilita por cobertura |
| Sugestões dizem a consequência | *"+5 min 40 s no dia · +4 séries neste dia · +4 séries na semana de Posterior"*, e agora também os limites |

As sugestões passaram a informar o efeito nos **limites aprovados**, pelo mesmo crítico:
*"passaria do teto de volume da semana deste grupo"*, *"ficaria acima do que o app monta sozinho
na semana, ainda dentro do teto"*, *"passaria do máximo deste grupo num treino só"*.

## Testes

`npm run typecheck && npm run lint && npm test && npm run build` — todos verdes.

- **227 arquivos de teste, 3 739 testes** (23 pulados, os mesmos de antes). Os dois projetos do
  Vitest (`atual` e `historico-seletor-etapa1`) rodam inteiros.
- Arquivo novo: `engine/volume-hipertrofia-2026-09-17.test.ts` — a tabela número a número, os
  cinco exemplos obrigatórios da decisão, a varredura de 1–7 dias com e sem foco nos dois tetos, o
  crédito indireto, as fases sem redução dupla, a exceção declarada e a prova de que a rampa não
  mira o teto.
- **36 contratos foram REESCRITOS**, cada um com a substituição explicada no próprio teste (o que
  a redação anterior dizia, por que ela não vale mais, e o que passa a valer). Nenhum foi
  desabilitado, nenhuma propriedade não afetada pela decisão foi afrouxada.
- **14 fotografias** de `orcamento-caracterizacao` atualizadas — são caracterização, e o delta
  (um slot a menos por dia nas células de massa) é a consequência esperada da faixa menor.
- Células reancoradas quando deixaram de discriminar: o próprio aviso de anti-vacuidade dos testes
  mandava fazer isso, e cada reancoragem diz qual célula saiu e por quê.
- `veredito-motor` (o tripwire de avisos) foi de 40 para **42** pontos de emissão: as duas famílias
  novas da poda por sessão, cada uma com perfil que a produz.

## Limites reais

- **Nenhuma publicação.** Sem merge, sem deploy de produção.
- **Nenhuma conta real tocada.** O QA de interface rodou sobre build de produção local com
  `.env.local` **sem Supabase** (modo local do próprio app) e fixture em `localStorage`. Nenhum
  `profile`, `plans` ou `plano_cas` foi lido ou escrito.
- **O servidor de desenvolvimento não renderiza** sob a CSP vigente (`script-src` sem
  `unsafe-eval`; o bundle de dev usa `eval`). A CSP **não foi relaxada** — o QA usou o build
  otimizado, como nas levas anteriores.
- **A exceção de sessão descrita acima fica em pé.** Ela é dita pelo crítico, mas o plano
  automático ainda a produz em 12 das células varridas. Fechá-la exigiria ou deixar a poda furar o
  piso por exercício do nível, ou cobrar série de um terceiro — as duas coisas que a arquitetura
  vigente proíbe por decisão anterior. Fica como decisão material para o autor (ver abaixo).
- **O topo da faixa desejada não é alcançado** por nenhum perfil da grade: o alocador dá slot por
  déficit e conta o crédito indireto no planejamento, então ele para antes. O motor DIZ a diferença
  (*"alvo de 14 … planejadas 12"*). É comportamento correto sob a decisão ("máximo permitido não é
  meta"), mas vale registrar que a faixa superior hoje é teórica para estes layouts.
- **Telemetria** continua sem eventos novos (mesmo motivo da leva anterior: exige migration).

## Decisões materiais ainda necessárias

1. **O resíduo de sessão por crédito indireto.** Quando o piso por exercício do nível já ocupa o
   teto do dia e o excesso vem do indireto de outro grupo, hoje o excesso fica e o crítico diz.
   As alternativas são (a) deixar a poda de sessão descer abaixo do piso por exercício, (b)
   permitir que o grupo que gera o indireto ceda série, ou (c) manter como está.
   *Impacto medido:* 12 de ~7 500 células varridas; sempre `posterior 13 contra 12` em
   avançado 6–7 dias de 45 min.
2. **A faixa superior inalcançável.** Se a intenção for que o topo (10/14/18) seja atingível, o
   alocador precisa deixar de contar o crédito indireto **planejado** ao decidir parar de dar
   slots. *Impacto medido:* hoje os grandes fecham em 12 num intermediário 4d/60min, contra um topo
   desejado de 14.

## Fragmento para o cofre

`fragmento-cofre-politica-volume-hipertrofia-2026-09-17.md`, ao lado desta worktree. Ele é
**externo**: a promoção ao cofre é feita depois, pela conta adequada. Nada foi escrito no cofre por
aqui, e o cofre antigo não foi consultado nesta tarefa.
