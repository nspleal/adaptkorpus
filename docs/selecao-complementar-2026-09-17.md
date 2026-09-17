# Seleção complementar na montagem automática — 2026-09-17

> **Candidato, não publicado.** Branch `trabalho/cobertura-complementar`, sobre `origin/main`
> vivo em `1a0f392` (confirmado por `git ls-remote`, não deduzido pelo nome). Produção segue
> em `1a0f392`. Nada foi mergeado, publicado ou promovido ao cofre por aqui.

## Procedência

| Campo | Valor |
|---|---|
| Base | `origin/main` = `1a0f3929f438b679cdb9c69b93493fea3357a0ab` (merge do PR #16), confirmada ao vivo por `git ls-remote` |
| Branch | `trabalho/cobertura-complementar` |
| Worktree | `adaptkorpus-cobertura-complementar` (isolada; nenhuma outra worktree foi tocada) |
| **Candidato** | o `HEAD` de `trabalho/cobertura-complementar` — **nunca uma tag, nunca `main`** |
| Linhagem | `3405cc6` (correção do passe + regressões) → **esta volta** (diagnóstico coerente + documentação) |
| Prévia (isolada) | alias da branch na Vercel, sempre apontando para o último deployment `target: null` (**preview**, nunca produção) |
| **Publicado (produção)** | `1a0f392` — **intacto**: esta volta não o tocou |

> 🔒 **Candidato ≠ publicado.** Tudo o que este documento descreve vive na branch e na prévia
> isolada. A produção continua servindo `1a0f392`, que é também a **base** deste trabalho —
> nenhum merge foi feito, e a promoção é decisão do autor.
>
> ⚠️ A tabela nomeia a linhagem, não o SHA final: um commit não pode registrar o próprio hash.
> O SHA vigente é o `HEAD` da branch, e o gate verde dele é a evidência que acompanha a entrega.

## O relato

O painel identificava regiões sem exercício e o gerador continuava entregando combinações
redundantes que as deixavam descobertas:

- **Core** — dead bug ou bird dog, com **quadrado lombar** sem exercício identificado;
- **Posteriores** — stiff, stiff com halteres e stiff unilateral no mesmo dia, com a
  **cabeça curta do bíceps femoral** sem exercício identificado; o painel sugeria flexoras;
- **Costas** — várias remadas e barra fixa, com **trapézio superior** sem exercício
  identificado e o **inferior** só com participação auxiliar.

Os três **reproduzem por fixture**, sem tocar em conta nenhuma: 659 regiões sem exercício
identificado em 144 perfis (3 níveis × 4 agendas × 3 durações × 2 limites × 2 equipamentos),
540 dias. Nenhum deles vem de desenho manual salvo — todos saem da geração automática, pela
mesma autoridade que a tela do editor usa (`coberturaDoDia`).

## A causa técnica, provada

O passe de cobertura **já existia** (`cobertura-anatomica.ts`, desde `4576201`). O que ele não
fazia era deixar a alternativa complementar passar: três travas dentro dele reprovavam por um
número que a regra que elas diziam proteger **não pede**.

### ① O custo como classe de intercâmbio

`assinaturaDeCusto` exigia descanso idêntico em toda a grade de parâmetros, mesma unidade de
execução e mesma lateralidade. Só que a alternativa complementar é, quase sempre, de outra
classe mecânica — e por isso descansa outro tanto:

| lacuna | quem a fecha | classe | descanso |
|---|---|---|---|
| cabeça curta do bíceps femoral | mesa flexora (`e64`) | isolado | 120/60 s |
| ao lado de | stiff (`e80`) | dobradiça | 180/90 s |
| trapézio superior | encolhimento (`e97`) | isolado | 120/60 s |
| ao lado de | remada (`e46`) | puxar | 180/120 s |
| glúteo médio e mínimo | abdução (`e127`) | isolado | 120/60 s |
| ao lado de | elevação de quadril (`e57`) | dobradiça | 180/90 s |

**585 das 659** regiões morriam aí, antes de qualquer conta de cobertura — **inclusive quando a
troca saía mais barata**, que é o caso das três linhas acima.

**Conserto:** quando a assinatura difere, o passe pergunta à autoridade de duração do montador
(`avaliarDuracaoSessao`, a mesma de `custoDia`) se o dia ficaria mais caro, **nos três níveis de
degradação**. Comparar os três — e não "ainda cabe no orçamento" — garante por construção que
nada do que vem depois se mexe: `degradarAteCaber` não pode subir de degrau,
`reduzirDiaPorTempo` não pode passar a cortar séries, e a certificação não muda de lado.

### ② O balanço de padrões

`padroesPreservados` exigia que `puxar − empurrar` **nunca caísse**. A invariante de saúde do
ombro, porém, é `puxar ≥ empurrar`: uma semana com 8 puxar e 4 empurrar continua em dia com 7.
Era essa trava que impedia o encolhimento (isolado) de entrar ao lado de quatro remadas.

**Conserto:** verifica-se a invariante, não o número. Quem já estava fora dela (um dia só de
peito) continua protegido: aí só se exige que a troca não piore o que encontrou.

### ③ O crédito lido sobre uma troca isolada

A decisão de 2026-09-15 — *nenhum grupo perde crédito ponderado, nem indireto* — estava
implementada sobre **uma** troca. Mas ela fala do resultado, e um **par** de trocas no mesmo
grupo devolve o que a primeira tirou.

**Conserto:** o crédito passa a ser lido como **delta somado** do conjunto. As duas travas
continuam idênticas — todo delta ≥ 0, e nenhum grande em > 0 —, só que agora sobre o par.
A regra **não** foi flexibilizada: a semana termina com o mesmo crédito ponderado, grupo por
grupo, e `credito-nao-regride.test.ts` continua verde sem uma linha alterada.

Duas condições do par, ambas medidas:

- **mesmo grupo e mesmo dia.** Compensar entre grupos seria cobrar de terceiro — e, medido,
  fazia o BASELINE depender de haver ou não foco (uma troca em ombros liberava uma troca em
  peito pela conta global de padrões), que é a regressão que D-01/D-02 existem para impedir;
- **a compensação não mexe no tempo do slot dela.** Sem isso, ela entrava com um
  `UNILATERAL_DOIS_LADOS` no lugar de um unilateral, o dia apertava e o corte por tempo comia
  justamente a série que devolveria o crédito — bíceps caindo de 8 para 7,5 em **12 de 36**
  perfis. O par tem de ser neutro no resultado, não só na intenção.

## A ordem de atuação, completa

| | o que é | quando |
|---|---|---|
| ① | escolher a combinação complementar no slot já alocado | sempre |
| ② | par compensado no mesmo grupo | quando ① custaria crédito indireto |
| ③ | **acrescentar** um exercício | quando ① e ② não resolvem **e** há margem |
| ④ | **dizer** a região pendente e o motivo | quando ③ não cabe |

As três margens do ③ são perguntadas às autoridades que já existem, nunca recalculadas:

- **estrutura** — `orcamentoSlotsDoDia`, o mesmo orçamento do alocador, mais os tetos de slots
  por grupo que `alocarSemana` recebeu (`tetoSlotsSemana`, `CORE_MAX`);
- **tempo** — o dia tem de continuar cabendo **no mesmo degrau de descanso**; se o exercício a
  mais empurrasse o dia para o degrau seguinte, o descanso de todos os outros slots cairia;
- **volume** — crédito ponderado (direto 1,0 + indireto 0,5) contra `tetoSemanalGrupo` e
  `tetoPonderadoNaSessao`, os mesmos tetos que a poda usa.

E duas exclusões declaradas: a adição **não entra em grupo do foco** (lá quem manda é o bloco
adicional) e **nunca entra em `core`** — com um slot de core a mais, o boost de
`aplicarFocoCore` se reparte entre mais exercícios e o total semanal encolhe (21 dos 216
cenários de `trilhos.test.ts`, `intermediario/saude/4d` saindo de 72 para 71 séries). Mexer
nisso exige rever a matemática do foco de core, que é decisão de produto à parte.

## Antes e depois, por caso relatado

### Costas — iniciante, 3 dias, 60 min, academia · dia "Costas + Bíceps"

| | antes (`1a0f392`) | depois |
|---|---|---|
| exercícios | `e46` ×2, `e47` ×2, `e48` ×1, `e49` ×1, `e72` ×3, `e74` ×3 | `e162` ×2, `e47` ×2, **`e97` ×1**, `e49` ×1, `e72` ×3, `e74` ×3 |
| regiões contempladas | 6 | **7** |
| pendentes | Trapézio — superior | **nenhuma** |
| duração | 1 980 s (33 min de 60) | **1 860 s (31 min)** |
| crédito ponderado da semana | bíceps 8 · costas 6 · … | **idêntico nos 12 grupos** |

O par: `e46` (remada baixa, credita bíceps) → `e162` (remada com elástico, credita bíceps) e
`e48` (remada no Smith, sem secundário) → `e97` (encolhimento, sem secundário). O trapézio
superior abre, o bíceps termina exatamente onde estava, e o dia fica **mais curto**.

### Posteriores — avançado, 5 dias, 45 min, academia · dia "Pernas"

| | antes | depois |
|---|---|---|
| exercícios | `e16` ×4, `e26` ×4, `e17` ×4, `e147` ×4 | `e16` ×4, `e26` ×4, `e17` ×4, `e147` ×4, **`e64` ×4** |
| regiões contempladas | 11 | **12** |
| pendentes | Quadrado lombar · **Bíceps femoral — cabeça curta** | Quadrado lombar |
| duração | 2 300 s (38 min de 45) | 2 700 s (45 min de 45) |
| posterior, ponderado na semana | 4 | 8 |

Aqui a mesa flexora entra por **adição**, com margem de estrutura (4 slots num orçamento de 5),
de tempo (cabe no mesmo degrau) e de volume.

### Core — intermediário, 3 dias, 60 min, academia · dia "Pernas"

| | antes | depois |
|---|---|---|
| exercícios | 6, orçamento 6 | **idênticos** |
| pendentes | Quadrado lombar · Bíceps femoral — cabeça curta | **as mesmas duas, agora DITAS** |
| duração | 3 340 s (56 min de 60) | idêntica |

**Este caso não é fechado, e é o mais frequente** (quadrado lombar: 300 das 659 lacunas). A
troca não resolve — o bird dog aborda 5 dos 6 alvos de core e a prancha lateral aborda 3, então
trocar apenas **move** a lacuna para o eretor e o transverso. E a adição está excluída de core
pela razão medida acima. O que muda é que o plano passa a dizer:

> **Sem exercício identificado para Bíceps femoral — cabeça curta, Quadrado lombar** — este dia
> já está com o número de exercícios que o seu tempo comporta, e nenhuma troca resolveria sem
> abrir outra lacuna ou tirar volume de outro grupo.
>
> Isto é informação sobre o mapa de exercícios, não um problema no seu treino: não dá para
> afirmar que a região não trabalha, só que não há exercício com ação direta identificada para
> ela neste dia.

## A lacuna passa a ser dita — no plano e na prévia

`rotina.coberturaAnatomica` publica, por dia, as regiões pendentes com o motivo concreto.
Oito motivos, nenhum vago:

| motivo | o que ele afirma |
|---|---|
| `sem_candidato_no_catalogo` | lacuna do CATÁLOGO — nenhum exercício aborda a região diretamente |
| `sem_candidato_elegivel` | há no catálogo, nenhum cabe no equipamento/nível do perfil |
| `condicao_de_execucao_nao_declarada` | seria direto sob uma execução que o app não declara |
| `sem_espaco_na_estrutura` | o dia já está no orçamento de exercícios do tempo escolhido |
| `sem_espaco_no_tempo` | um exercício a mais passaria do tempo da sessão |
| `sem_espaco_no_volume` | um exercício a mais passaria do volume máximo da semana |
| `trocar_custaria_outra_regiao` | trocar abriria outra lacuna ou tiraria volume de outro grupo |
| `slots_do_dia_esgotados` | (sem as margens injetadas) havia candidato e os slots acabaram |

**Uma autoridade só de frase** (`lib/cobertura-pendente-copy.ts`), lida pelo plano e pela
prévia, e os grupos do dia saem de `gruposDoDia` — a mesma função da cobertura do editor. É o
que garante que as três telas nunca contem histórias diferentes do mesmo dia.

Nada disso vira `aviso`: é diagnóstico. Não bloqueia salvar, não muda o veredito, não entra no
tripwire de famílias de aviso, e **nunca** diz que a região não é ativada.

## O que não mudou

- nenhum grupo perde crédito ponderado, direto ou indireto (`credito-nao-regride.test.ts`, sem
  uma linha alterada);
- `puxar ≥ empurrar`, cobertura temporal obrigatória, frequência de core (2–3×/semana),
  recuperação e dias consecutivos;
- tempo escolhido, descansos mínimos, degradação e a escada de redução por tempo;
- equipamento, elegibilidade, banidos e favoritos — a adição **nunca** promove ninguém a
  favorito;
- foco: baseline primeiro, extras depois, sem cobrar de terceiros; o passe não toca nos grupos
  do foco;
- deload e retomada: o passe continua trocando, mas **não acrescenta** em nenhum dos dois;
- treino manual: intocado. O passe roda sobre a alocação automática, e o desenho da pessoa
  segue pelo outro caminho de `montarSaida`;
- determinismo: mesma entrada e mesma `variacaoTreino` → mesma saída, travado por teste.

## Medição na grade (36 perfis · 3 níveis × 4 agendas × 3 durações, tempo limitado)

| | `1a0f392` | candidato |
|---|---|---|
| alvos abordados | 1 199 | **1 212** |
| pares com tarefa repetida no mesmo grupo/dia | 187 | **163** |
| regiões sem exercício identificado | 187 | **174** |
| slots | 718 | 719 |
| crédito ponderado semanal, por grupo | — | **idêntico em 11 dos 12**; posterior +4 (a adição) |

Nenhum dia passou do orçamento de slots nem do tempo escolhido em nenhum dos 36 perfis.

## Limites reais

- **O quadrado lombar continua descoberto na maioria dos casos** (300 das 659 lacunas
  medidas), pela exclusão de core da adição. Fechá-lo exige rever a matemática do foco de core.
- **A cabeça curta do bíceps femoral continua descoberta no intermediário.** A flexora é mais
  barata e o custo já não a reprova, mas ela não credita glúteos como o stiff credita, e no
  grupo posterior não existe segunda dobradiça que devolva esse crédito. Sem par válido, a
  regra de volume manda o plano ficar como está — e a lacuna é dita. A única alternativa de
  mesmo custo **e** mesmo secundário é `e123`, classificada `avancado`: para o intermediário
  ela não é elegível. Isso é uma observação sobre a **classificação de nível do catálogo**, não
  um erro do mapa anatômico, e fica registrada aqui sem ser alterada.
- **Compensação só dentro do grupo.** Entre grupos ela fazia o baseline depender do foco. O
  custo é que lacunas cuja compensação só existiria em outro grupo continuam abertas.
- **Sem QA autenticado.** A verificação visual (desktop 800×605 e telefone 375×812) usou uma
  rota de laboratório descartável com fixture, **removida antes do commit**: não há rota de
  laboratório no candidato, nenhuma conta foi tocada e nada foi gravado em perfil real.
- **Condicional anatômico continua sem declarante** — o app não declara execução, então esses
  alvos seguem PENDENTES por falta de dado, e o motivo diz isso.
- **5 avisos de lint** (variáveis não usadas, preexistentes), 0 erros.

## Fragmento para o cofre

`fragmento-cofre-selecao-complementar-2026-09-17.md`, ao lado desta worktree. É **externo**: a
promoção ao cofre é feita depois, pela conta adequada. Nada foi escrito no cofre por aqui.
