# Política de volume da hipertrofia + cobertura muscular no editor

## Retificação final do autor — 17/09/2026

O autor autorizou corrigir este relatório e publicar o candidato de código
`9d3bb83e4c831581b840ebc1afdf287e98ea5235`, após a validação concluída.
Esta retificação prevalece sobre os rótulos de decisão aberta nas rodadas abaixo:

- **Topo da faixa: resolvido.** Não é obrigatório atingir 14/18 séries. Entregar dentro
  da faixa desejada é suficiente; não há mudança do alocador a decidir por esse motivo.
- **Desempate por secundários: comportamento mantido nesta publicação autorizada.**
  As diferenças medidas e os testes permanecem documentados; não há alteração adicional
  solicitada. Contagens de créditos/avisos não comprovam maior estímulo fisiológico.
- **Cinco células de emagrecimento: encerradas.** O resultado atual recusa integralmente
  os extras por orçamento semanal; a mensagem de recusa parcial foi corrigida nos 13
  casos em que ainda estava errada. Não é decisão pendente.

Nenhum código, teste, limite de volume ou pesquisa foi alterado por esta retificação.
O registro de publicação com SHA do merge, gate e deployment será mantido externamente,
para distinguir a autorização de publicar da confirmação efetiva em produção.

2026-09-17. **PUBLICADO** — esta série foi mergeada em `main` pelo PR #16 e hoje vive em
`1a0f392`. A tabela de procedência abaixo é o registro do que ERA o candidato durante o
trabalho; ela é história, não estado vigente.

> 🔒 O candidato VIGENTE é outro: `trabalho/cobertura-complementar`, descrito em
> [`selecao-complementar-2026-09-17.md`](./selecao-complementar-2026-09-17.md), que tem `1a0f392`
> como base.

## Procedência

| Campo | Valor |
|---|---|
| Base | `origin/main` = `8b41ec9389629258966b61c8dfd6e75849744170` (PR #15) |
| Branch | `trabalho/volume-hipertrofia-tabela` |
| Worktree | `adaptkorpus-volume-hipertrofia` (isolada; nenhuma outra worktree foi tocada) |
| **Candidato** | o `HEAD` de `trabalho/volume-hipertrofia-tabela` — **nunca uma tag, nunca `main`** |
| Linhagem do candidato | `6feab97` (procedência) → `d93028b` (1ª volta) → `e1933bd` (2ª volta, código) → `cec4c62` (2ª volta, docs) → `49dab05` (3ª volta) → **esta volta** |
| Prévia (isolada) | `evokorpus-git-trabalho-volume-hipertro-63c1e5-nspleals-projects.vercel.app` — o **alias da branch**, que sempre aponta para o último deployment `target: null` (**preview**, nunca produção) |
| **Publicado (produção)** | `8b41ec9` — `dpl_8jmDTD7Nwc9F31R2GZzTrv5F3N2y`, target `production`. **Intacto**: nenhuma volta desta série o tocou. |

> 🔒 **Candidato ≠ publicado.** Tudo o que este documento descreve vive na branch e na prévia
> isolada. A produção continua servindo `8b41ec9`, que é também a **base** de todo o trabalho —
> nenhum merge foi feito, e a promoção é decisão do autor, por outra conta e em outro momento.
>
> ⚠️ A tabela nomeia a linhagem, não o SHA final: um commit não pode registrar o próprio hash.
> O SHA vigente é o `HEAD` da branch, e o gate verde dele é a evidência que acompanha a entrega.

A prévia responde `302` para quem não está logado: ela está sob a **proteção de deployment**
da Vercel (SSO da conta). Abrir com a conta do autor logada serve normalmente; o SHA que o
deployment reporta (`githubCommitSha`) é sempre conferido contra o `HEAD` da branch — duas
pontas, o mesmo commit — e essa conferência é refeita a cada volta.

`origin/main` está **155 commits à frente** de `origin/claude/evokorpus-app-dev-9in0hs` (o `HEAD`
remoto herdado) e o contém por inteiro — por isso ela é a base.

---

# Terceira volta (2026-09-17) — validação dirigida de `cec4c62`

`cec4c62` foi declarado "só documentação". **Confirmado:** `git diff e1933bd cec4c62` toca dois
arquivos, ambos em `docs/` (284 inserções, 24 remoções). Nenhum byte de `src/`.

Esta volta fecha as lacunas que a entrega anterior deixou nomeadas, e encontrou **dois defeitos
reais** — um de copy e um de tempo no gate remoto.

## ⓐ O esforço DITO virou o esforço FEITO — defeito corrigido

`PropostaTreino.tsx` trazia uma **fórmula fixa** no rodapé da ressalva:

> "Procuramos outro exercício, outro dia e menos séries, e nada disso coube nas suas outras
> escolhas."

Ela afirmava **três tentativas, sempre**. No desenho da pessoa o app não mexe em exercício, dia
nem série — nenhuma das três acontece —, e a frase inventava um esforço que não houve. É
exatamente o que a decisão proíbe: a mensagem tem de refletir o que foi efetivamente tentado.

O motor já fazia certo (`frasesDaExcecao` lia `alternativas`, o registro nominal). O conserto
extraiu essa lógica para **`esforcoDaExcecao`**, agora a autoridade única lida pelos dois — motor
e tela. Não há segunda redação.

Aproveitou-se para tirar a última pretensão de exaustividade: a frase passou a ser **"Entre as
alternativas que o app examina, tentamos …"**. A busca é um conjunto **delimitado e enumerado por
regra** (os slots do dia que alimentam o grupo e, para cada um, os exercícios de mesmo grupo,
mesmo padrão e mesma assinatura de custo), não uma varredura do espaço de planos — e o texto
agora diz isso.

Guards novos em `treino-acoes-e-cobertura-tela.test.ts`: a tela usa `esforcoDaExcecao`, a fórmula
fixa não pode voltar, nem tela nem motor podem chamar a busca de exaustiva, e
`esforcoDaExcecao` distingue "nada foi tentado" de "tentamos e não coube". **Anti-vacuidade
verificada**: reintroduzindo a frase antiga, o guard cai com "a fórmula fixa do esforço voltou".

## ⓑ A ressalva, exercida VISUALMENTE — com fixture sintética declarada

A entrega anterior tinha só guard estático de tela. Faltava ver.

**Primeiro, medir se o caso real existe.** Varredura de **8 064 combinações automáticas**
(3 níveis × 1–7 dias × 6 durações × 2 limites × 2 equipamentos × 4 focos × 4 semanas) com o teto
**real de 12**: **zero exceções**. O caminho automático **não alcança** a exceção com o catálogo
real — confirmando o que a segunda volta já dizia. Baixando o teto para 8: ainda zero. Para 6:
**84 células** produzem exceção genuína.

Logo a fixture **é sintética, e isso é declarado**: `TETO_PONDERADO_SESSAO` rebaixado para 6
durante o laboratório. **Só isso.** O componente, o `proporTreino`, o motor e o catálogo são os de
produção; nada foi mockado.

Percurso pela interface real (build otimizado, não o servidor de dev — ver Limites):

| conferência | resultado |
|---|---|
| ressalva existe | `<section role="status" aria-label="Ressalva de volume">` |
| **antes** do botão | `compareDocumentPosition` = precede; y 674 contra 951 |
| grupo | **Glúteos** |
| dia | **Full-body** (segunda-feira) |
| volume ponderado | **7** |
| referência | "acima das **6** que o app usa como limite de um treino só" |
| causa | "**4** vêm do trabalho indireto de **posterior, quadríceps** no mesmo dia" |
| esforço | as três alternativas, porque as três foram tentadas (19 examinadas) |
| veredito | "Este treino **não está dentro de todos os limites** do app." |
| não é alerta clínico | sem "perigo", "lesão", "arriscado" |
| **Cancelar** | proposta fecha; nada gravado |
| **Confirmar** → plano/editor | a frase permanece, completa, com o mesmo esforço |
| celular (375 px) | legível, sem transbordo horizontal, acima dos dois botões |
| desktop | legível, acima dos dois botões |

A **distinção pedida foi respeitada**: este é o caminho **automático** (`tipo: 'gerar'`, sem
desenho salvo), não o excesso já existente no desenho manual — que continua coberto por teste
próprio em `volume-hipertrofia-2026-09-17.test.ts`.

A rota de laboratório e o teto rebaixado **foram removidos**; o candidato final não os contém.

## ⓒ O gate remoto de `cec4c62` CAIU — e o motivo não era asserção

Fato que a entrega anterior não podia ter reportado (a execução ainda estava em curso):

| SHA | gate remoto | onde |
|---|---|---|
| `e1933bd` | ✅ success | [run 35193824135](https://github.com/nspleal/adaptkorpus/actions/runs/35193824135) |
| `cec4c62` | ❌ **failure** | [run 35195011713](https://github.com/nspleal/adaptkorpus/actions/runs/35195011713) |

Typecheck e lint passaram; caiu em **testes**, e por **tempo**, não por propriedade:

```
FAIL  atual  src/lib/foco-teto-mrv.test.ts > 🔒 varredura — nenhum plano AUTOMÁTICO nasce acima
      do teto > com e sem foco, na grade onde o teto morde
Error: Test timed out in 240000ms.      (o caso levou 244 096 ms)
Tests  1 failed | 3753 passed | 23 skipped (3777)
```

Margem de **4 segundos** sobre 240 — por isso `e1933bd`, com código idêntico, passou. O teste e o
seu limite de 240 s já existiam na base `8b41ec9`; o que cresceu foi o custo da varredura.

**O conserto não afrouxou nada** — nenhum limite foi elevado, nenhuma asserção mudou. Duas
economias, ambas puras:

1. **216 montagens jogadas fora.** O laço montava o plano *sem* foco e o descartava na linha
   seguinte (`if (!foco) continue`), porque esta varredura mede o **delta** do foco. O `continue`
   subiu para antes da montagem. O plano sem foco de que a comparação precisa (`semFoco`)
   continua sendo montado.
2. **A conta ponderada da semana, memoizada por rotina** (`WeakMap`). Ela é pura e a rotina é
   imutável, mas era invocada dentro de um laço por grupo — recomputando a semana inteira uma vez
   por grupo.

Medido no mesmo worktree, com o teto real de 12: **121,75 s → 84,06 s (−31 %)**, os mesmos 15
testes passando.

## ⓓ A rampa fora da hipertrofia — medida, não presumida

A correção da rampa mora num trecho **que não é da hipertrofia**: o laço que reparte o volume por
grupo roda para todo plano com `semanaCiclo`, qualquer que seja o objetivo. A matriz da segunda
volta, porém, era **toda de `objetivo: 'massa'`**. Emagrecimento e saúde passavam pelo mesmo
desempate sem cobertura. Essa era a lacuna.

**A/B com 1 728 células** (3 objetivos × 3 níveis × 4 agendas × 3 durações × 2 limites × 4 semanas
× com/sem foco), comparando a ordem por **posição** (a de antes do conserto) com a ordem por
**identidade + secundários grandes** (a vigente):

| objetivo | células | distribuição por slot mudou | crédito ponderado por grupo mudou | total de séries mudou | avisos | "abaixo do mínimo" | dias acima do tempo |
|---|---|---|---|---|---|---|---|
| emagrecimento | 576 | 42 | 42 | **5** | 0 a mais / 4 a menos | 0 a mais / **4 a menos** | **0 a mais** |
| saúde | 576 | 12 | 12 | 0 | 0 a mais / 6 a menos | 0 a mais / **6 a menos** | **0 a mais** |
| massa | 576 | 8 | 8 | 0 | 0 a mais / 4 a menos | 0 a mais / **4 a menos** | **0 a mais** |

**A mudança não é neutra fora da hipertrofia** — 42 células de emagrecimento e 12 de saúde
trocaram qual slot carrega a sobra, e com ela o crédito indireto que essa série espalha. O saldo
é positivo e unilateral: **14 células perderam um aviso de grupo abaixo do mínimo, nenhuma
ganhou**, e **nenhuma** passou a ter dia acima do tempo.

### A diferença remanescente, nomeada

**5 células** — todas `emagrecimento / avançado / 6 dias / S3 / foco=peito`, nas cinco combinações
de tempo — entregam **2 séries a menos** (112 → 110; 108 → 106). Rastreada até a causa, sem
suposição:

| | ordem antiga | ordem vigente |
|---|---|---|
| `blocoFoco.adicionais` | `[{sex, e1, 2 séries}]` | `[]` |
| peito (ponderado) | 16 | 14 |
| ombros (ponderado) | 16 | 16 |
| teto publicado | `semFoco 16 · cheio 16 · sessao null` | idem |
| aviso emitido | "O bloco do foco **não entrou**: somar Peito aqui levaria Ombros acima do máximo desta semana…" | **a mesma frase** |

As duas ordens emitem **o mesmo aviso**. Sob a ordem antiga esse aviso **contradizia** o próprio
plano: dizia que o bloco não entrou e `adicionais` trazia 2 séries. Sob a ordem vigente os dois
concordam. As 2 séries "perdidas" são extras que o plano **já declarava recusados**.

Nenhum teto é violado em nenhuma das duas (peito ≤ 16, ombros ≤ 16), e o baseline é preservado
nas duas. Registra-se como **diferença remanescente**, não como neutralidade: o volume de foco
entregue nessas 5 células caiu de 2 para 0. Decidir qual das duas leituras é a certa — o aviso ou
os extras — é mexer no bloco do foco, e está fora do escopo desta tarefa.

### O que passou a ser testado

`rampa-identidade-2026-09-17.test.ts` ganhou **15 casos** (25 → 40), todos fora da hipertrofia:

- ① cinco voltas abrir/salvar/reabrir sem mover um slot — 2 objetivos × 4 fases (rampa S3,
  deload S6, retomada, saída da retomada);
- ② o teto publicado é o do **próprio objetivo** (`cheio = semFoco = topo da faixa`,
  `sessao = null`), com anti-vacuidade contra `massa` no mesmo nível (13/19/21, margem 3, 12 por
  sessão);
- ③ a marca do teto por sessão **não vaza** para objetivo que não tem esse teto;
- ④ o foco não tira série de terceiro;
- ⑤ baixar UMA série não levanta nenhuma outra;
- ⑥ **a retomada supersede o mesociclo**: S6 com retomada é idêntico, slot a slot, a S1 com
  retomada — sem corte duplo —, com anti-vacuidade de que a S6 **sozinha** corta mesmo;
- ⑦ nenhum dia passa do limite de tempo declarado;
- ⑧ ocorrência repetida em dias distintos não colide na chave `dia/id`.

> ⚠️ O caso ⑦ nasceu **vazio**: comparava contra `'ACIMA_DO_LIMITE'`, valor que `EstadoLimite`
> não possui — a comparação nunca casava e o teste era verde por construção. Quem pegou foi o
> **typecheck** (`TS2367`). Corrigido para `'ACIMA_DO_LIMITE_OPERACIONAL'` e reforçado com
> anti-vacuidade que exige dias efetivamente **comparados** ao limite.

## ⓔ Os 23 testes pulados, reconciliados nominalmente

`test-support/selecao-etapa1-classificacao.json` declara **exatamente 23** nomes históricos, em 8
arquivos — e a suíte reporta **23 skipped**. Um a um:

| arquivo | nomes |
|---|---|
| `engine/alocador.test.ts` | 2 |
| `c1-caminho-publico.test.ts` | 4 |
| `engine/dia-nao-atendido.test.ts` | 2 |
| `engine/foco-equilibrio-puxar-empurrar.test.ts` | 1 |
| `engine/grade-cobertura.test.ts` | 2 |
| `engine/orcamento-caracterizacao.test.ts` | 3 |
| `engine/regressao-cinco-casos.test.ts` | 8 |
| `engine/treino-montador.test.ts` | 1 |
| **total** | **23** |

O 24º saiu em `d93028b`: `deload-volume-entregue.test.ts` teve o teste reescrito e renomeado, a
exclusão passou a apontar para um nome inexistente e virou **filtro morto** — o arquivo listava 24
e só 23 eram de fato filtrados. Hoje esse teste **roda e passa nos dois projetos**, e o arquivo
segue listado para continuar rodando também no projeto histórico. O `nota` no JSON registra isso.

O guard contra filtro sem correspondência (`selecao-etapa1-classificacao.test.ts`) continua de pé
e foi conferido: todo nome histórico casa com um teste existente, todo arquivo classificado
existe, e o total é 23.

**Todos os projetos do Vitest rodaram** — `atual`, um `atual:<arquivo>` por arquivo classificado
e `historico-seletor-etapa1`. Nada foi filtrado por `--project`.

## ⓕ Cobertura muscular — preservada por construção

O QA autenticado da segunda volta foi feito em `e1933bd`. A superfície da cobertura muscular
(`CoberturaMuscular.tsx`, `cobertura-anatomica.ts`, `cobertura-editor.ts`, `cobertura-teto.ts`,
`EditorTreino.tsx`, `condicao-execucao-copy.ts`, `alvos-anatomicos-dados.ts`) está **byte a byte
idêntica** a `e1933bd` neste candidato — `git diff` vazio. O comportamento QA'do é conservado por
construção, não por nova inspeção, e a suíte de cobertura segue verde.

## ⓖ A recusa parcial do bloco do foco — investigada até o fim, e corrigida

A 3ª volta deixou uma pendência ambígua ("o bloco do foco contra o seu próprio aviso"). Ela foi
fechada: **havia defeito atual**, e ele era de **comunicação**, não de dose.

### O mecanismo

O ramo de recusa (`treino-montador.ts`) roda quando **algum** extra é recusado — `extrasRecusados`
sai do plano e de `bloco.adicionais`. As duas frases desse ramo, porém, afirmavam recusa **total**:

> "O bloco do foco não entrou: somar X aqui levaria Y acima do máximo…"

Quando só **parte** é recusada, o resto continua no plano. `treino-types` já declarava a distinção
que não chegava à copy — `solicitados` é a INTENÇÃO (quantos extras a montagem pediu),
`adicionais` é a ENTREGA (o que sobreviveu) —, e a pessoa lia "não entrou" olhando para um
exercício de foco que está lá, com séries.

### A medição, antes de corrigir

Varredura de **5 184 combinações** sobre `49dab05` (3 objetivos × 3 níveis × 4 agendas × 3
durações × 2 limites × 4 semanas × 6 focos):

| | |
|---|---|
| células medidas | 5 184 |
| células que emitem a frase | 153 |
| **células em que `adicionais` não estava vazio** | **13** |

As 13, nominalmente:

| célula | entregue apesar do "não entrou" |
|---|---|
| `massa / avançado / 6d / 45min / limitado / S1·S3·S5 / foco=glúteos` | `qui · e60 · 2 séries` (3 células) |
| `emagrecimento / avançado / 6d / S1 / foco=peito` (45 s/l · 60 lim · 60 s/l · 75 lim · 75 s/l) | `sex · e1 · 2 séries` (5 células) |
| `emagrecimento / avançado / 6d / S1 / foco=glúteos` (mesmas 5 combinações) | `qui · e59 · 1 série` (5 células) |

### A correção

Só a frase. **Dose, alocador e regras do foco não foram tocados** — o que entra continua sendo
exatamente o que entrava, e o número dito passa a vir da entrega real (`bloco.adicionais`), nunca
da intenção. Os dois ramos ganharam a forma parcial:

> "O bloco do foco entrou só em parte — **2 exercícios, com 4 séries**. Somar mais Glúteos levaria
> Ombros acima do máximo desta semana do seu nível (…), porque esses exercícios também trabalham
> esse grupo de forma indireta."

O número de pontos de emissão de aviso **não mudou** (dois `avisos.push`, agora condicionais), e o
tripwire de `veredito-motor` segue no mesmo número.

### As regressões

`foco-entrega-parcial-2026-09-17.test.ts`, com os três estados exigidos e anti-vacuidade em cada
um — o caso degenerado é recusado explicitamente antes da asserção:

1. **entrega parcial** (o caso reproduzido, `massa/avançado/6d/45min/limitado/S1/foco=glúteos`):
   a frase não pode dizer "não entrou", tem de dizer "entrou só em parte", e os números ditos têm
   de bater com `blocoFoco.adicionais`;
2. **nenhuma entrega**: a frase de recusa total continua idêntica, e não pode falar em parcial;
3. **entrega completa**: nada é dito sobre recusa nem sobre parcialidade;
4. **a invariante, varrida**: nenhuma célula pode dizer "o bloco do foco não entrou" enquanto
   entrega exercício de foco.

**Anti-vacuidade verificada**: revertendo o motor ao estado de `49dab05`, os casos ① e ④ caem — e
④ reproduz **exatamente 13** células, o mesmo número da varredura de 5 184.

### O que isso resolve nas cinco células de emagrecimento

As 5 células `emagrecimento / avançado / 6d / S3 / foco=peito` da seção ⓓ entregam 2 séries a
menos sob a ordenação vigente. Agora dá para ser categórico sobre elas:

- **Não há defeito nessas 5 células no candidato.** Sob a ordenação vigente elas caem em recusa
  **total** (`adicionais = []`), e a frase de recusa total é correta: o baseline já leva ombros ao
  máximo da semana (16), então qualquer extra de peito — que credita ombros de forma indireta —
  passaria do teto. Recusar é o que as decisões vigentes mandam ("não cobrar de terceiros",
  "respeitar o MRV inclusive nos extras do foco").
- **O que havia de errado era a ordenação ANTIGA**, não a vigente: lá o baseline deixava ombros em
  15, os 2 extras cabiam exatamente em 16 e **entravam** — e era aí que a frase mentia, dizendo
  que o bloco não entrara. Esse é o mesmo defeito que as 13 células acima expõem, e que esta volta
  corrigiu.
- Portanto as 2 séries a menos são **consequência correta** da nova distribuição do baseline, não
  perda por bug. A pendência deixa de ser ambígua: **não é defeito aberto**; é diferença de
  comportamento explicada, com a comunicação agora correta nos dois lados.

## Limites reais desta volta

- **A exceção automática continua sintética.** Com o teto real de 12 ela não ocorre em nenhuma das
  8 064 combinações medidas. A validação visual usou teto 6. O que foi exercido de verdade é o
  **caminho de produção** e o **render**; o número 12 na tela não foi visto num caso real, porque
  não existe caso real.
- **O servidor de desenvolvimento não renderiza** sob a CSP vigente (`script-src` sem
  `unsafe-eval`; o bundle de dev usa `eval` e o React não hidrata — os cliques não chegam aos
  handlers). A CSP **não foi relaxada**: o QA usou `next build` + `next start`.
- **Não houve novo QA autenticado.** Ele não era necessário: a superfície da cobertura é idêntica
  à do SHA já validado. As telas exercidas aqui rodaram em ambiente local descartável, sem conta,
  sem Supabase e sem gravação de nenhuma espécie.
- **As 5 células de emagrecimento** acima seguem como diferença aberta (ⓓ).
- **O topo da faixa desejada continua inalcançável** para vários layouts, em silêncio e
  corretamente sob a decisão vigente. Segue como decisão material.

## Decisões materiais

1. 🔺 **RESOLVIDA (2ª volta)** — o resíduo de sessão por crédito indireto.
2. **A faixa superior inalcançável** — *segue aberta*, inalterada por esta volta.
3. **O desempate por secundários** — *segue aberta*, e esta volta **quantificou-a também fora da
   hipertrofia**: 42 células de emagrecimento e 12 de saúde mudam de distribuição, com 14 avisos de
   grupo abaixo do mínimo a menos e nenhum a mais.
4. ~~O bloco do foco contra o seu próprio aviso.~~ **RESOLVIDA nesta volta, e não era decisão:
   era defeito de copy.** Medido em 13 de 5 184 células, corrigido só na frase (dose, alocador e
   regras do foco intactos) e travado por quatro regressões com anti-vacuidade. Ver ⓖ. Nas 5
   células de emagrecimento da seção ⓓ **não há defeito**: elas caem em recusa total, onde a
   frase sempre esteve certa, e as 2 séries a menos são consequência correta do baseline novo.

---

# Segunda volta (2026-09-17) — `e1933bd`

A decisão do autor **substituiu a obrigação absoluta de 12 por sessão**: 12 continua sendo o
limite normal de montagem, e o excesso passa a ser aceito **depois** de esgotadas as
alternativas válidas — e, quando sobra, é dito com grupo, dia, número e causa, antes da
confirmação e depois dela. Esta volta implementa isso, e mais três correções que a validação
pedida encontrou.

## ① Tentar antes de aceitar

A alternativa que faltava não era cortar série de ninguém: era **trocar o exercício** que
deposita crédito indireto no grupo estourado por um equivalente que não deposita — mesmo grupo,
mesmo padrão de movimento e **mesma assinatura de custo** (`mesmoCustoDeSlot`, a régua que a
cobertura anatômica já usa para trocar sem mexer no relógio do dia). A troca roda **antes** das
podas, porque ela não custa série a ninguém e a poda custa.

O caso que era o resíduo, resolvido:

| | `avançado · 6 dias · 45 min · limitado`, dia de posteriores |
|---|---|
| antes (`6feab97`) | `posterior 13 > 12` — 9 diretas já no piso + 4 indiretas de dois exercícios de glúteos |
| depois (`e1933bd`) | `posterior 11` — `e57` *Ponte de glúteo* (`"Glúteos, posterior de coxa"`) vira `e153` (`"Glúteos"`) |
| custo | **zero séries**: glúteos mantém as 8 do dia, o tempo do dia não muda, e nenhum terceiro paga |

**Varredura de 10 080 combinações** (4 inventários × 3 níveis × 1–7 dias × 5 tempos × 2 limites
× 4 semanas × 3 focos, incluindo `casa` e `nenhum`):

| | `6feab97` | `e1933bd` |
|---|---|---|
| planos acima do teto de **sessão** | 12 células declaradas | **0** |
| planos acima do teto **semanal** | 0 | **0** |
| poda por sessão age | 108 células | 10 (`avançado/6–7 d/45 min/limitado`) |
| poda semanal age (academia/massa) | 602 | **0** |
| troca aplicada | — | 207 células |

A busca é **finita e declarada**: cada candidato examinado sai nomeado, com o motivo da recusa
(`candidato_ja_esta_no_plano`, `candidato_credita_o_mesmo_grupo`,
`candidato_com_outro_custo_de_tempo`, `candidato_estoura_outro_limite`,
`candidato_derruba_grupo_abaixo_do_minimo`…). A **mudança de dia** é examinada e recusada por
razão concreta: mover um slot para um dia que não treina o grupo mudaria frequência e intervalo
de 48 h, que são decisões de outra autoridade e não se alteram para acomodar um teto.

O que sobra é publicado em `rotina.excecoesDeSessao` — grupo, dia, nome do dia, ponderado, teto,
direto, indireto e a **origem** de cada crédito indireto — e dito por **um ponto de emissão só**
(`dizerExcecaoDeSessao`), chamado pelos dois produtores de plano. **Nenhum limite semanal é
afrouxado.**

No **desenho da pessoa** não se troca exercício nem dia (são escolha dela) e a frase diz
exatamente isso, em vez de afirmar um esforço que não houve. Exemplo medido — cinco exercícios
de peito × 4 séries escolhidas por ela, num intermediário:

> Neste plano, peito fica com 20 séries em Peito — acima das 12 que o app usa como limite de um
> treino só, somando diretas e indiretas. Os exercícios, os dias e as séries deste treino são sua
> escolha, e o app não mexe neles por conta própria. O plano vai assim, e por isso não dá para
> dizer que ele está dentro de todos os limites.

Nada é bloqueado: os cinco exercícios e as 4 séries de cada um continuam no plano entregue.

## ② A faixa desejada não é meta obrigatória no topo

Removida a frase `Semana N: alvo de X séries para G não cabe em M exercício(s) — planejadas P`.

Medida na varredura das 756 células: ela saía **1 355 vezes, e em 1 300 delas o grupo terminava
dentro da faixa desejada** (um intermediário com 12 numa faixa de 10–14; um iniciante com 6 numa
de 6–10). Era insuficiência anunciada por não se ter chegado ao topo — o que a decisão proíbe. E
ela comparava **moedas diferentes**: `alvo` é ponderado e `tetoGrupo` é capacidade DIRETA, então
*"12 contra 16"* saía quando o entregue eram 15 ponderadas — a diferença real era 1, não 4.

O déficit de verdade continua com voz e com o **critério pertinente**: o guard de cobertura mede
o volume PONDERADO entregue contra o MEV, separa causa de catálogo de causa de orçamento e
publica o fato. Uma voz por fato.

**Achado desta limpeza:** o contrato *"a redução planejada do deload é explicada"*
(`editor-avisos-e-paridade`) vinha passando **por acidente** — o que ele encontrava na semana 6
era aquela frase, que não fala de deload nenhum. Retirada a frase errada, a semana 6 ficou sem
explicação nenhuma no editor e o contrato caiu, corretamente. A semana de alívio ganhou a
explicação que lhe faltava.

## ③ A ressalva ANTES da confirmação

`PropostaTreino.tsx` não renderizava aviso nenhum do motor — a lista fica na aba do plano e no
editor. A pessoa confirmaria sem saber. A ressalva entra **antes do botão de aplicar**, lendo
`rotina.excecoesDeSessao` (sem recalcular nada), dizendo o número, o dia e de onde vem o
excedente, sem afirmar perigo ou lesão, e fechando com *"este treino não está dentro de todos os
limites do app"*.

A frase positiva do editor (*"Sua semana está dentro das faixas do seu nível"*) já é condicionada
a `avisos.length === 0`, e o crítico emite `acima_do_maximo_na_sessao` como **risco** — logo as
duas afirmações não podem coexistir.

## ④ A repartição por identidade, validada — e corrigida

A ordenação por identidade (`dia`, depois `id`) foi validada além do caso que a motivou, com uma
**A/B de 22 680 combinações** comparando-a com a ordem por POSIÇÃO:

| | |
|---|---|
| planos diferentes | 3 646 de 22 680 (16 %) |
| … só redistribuição de dose (mesmos exercícios, mesmo total) | 3 260 — o conserto pretendido |
| … com composição ou total diferente | 386 · **385 deles com foco**, nenhum em `massa` |
| delta de séries | −1 em 360 células, +1 em 26 |
| estado de duração mudou | **0** — nenhuma célula passou a exceder o tempo |

**O que a A/B revelou, e esta volta corrige:** ordenar só por `id` é estável, mas arbitrário
quanto ao que o slot ENTREGA. A sobra do round-robin passava a cair num exercício sem secundário
grande, e o crédito indireto de um terceiro caía 0,5 junto — **255 células ganhavam um aviso de
grupo abaixo do mínimo**, contra 2 que perdiam. Não era neutro, e o teto respeitado não provava
que fosse.

Com o **desempate por número de secundários GRANDES** antes do `id`:

| comparação | planos diferentes | aviso novo | aviso que sumiu |
|---|---|---|---|
| identidade × posição | 3 646 | 255 | 2 |
| **desempate × identidade** | 2 255 | **0** | **319** |
| desempate × posição | 3 070 | 40 | 106 |

Melhor que as duas, e continua **independente da ordem de exibição** — a chave só olha para o
exercício. Ele não muda quanto o grupo recebe: é desempate dentro do mesmo grupo, entre slots do
mesmo dia; o que muda é qual exercício carrega a série sobrando, e com ela o crédito indireto que
essa série espalha.

Novo `rampa-identidade-2026-09-17.test.ts`, 25 casos: a chave `dia/id` posta à prova (o
automático **repete** exercício entre dias — core 2–3×/semana — e **nunca** dentro do mesmo dia),
paridade por slot em 8 fases (rampa, foco, deload, retomada, saída da retomada, tempo curto),
cinco voltas consecutivas sem deriva, embaralhamento do desenho em 3 sementes, redução de uma
escolha sem levantar terceiro, troca/remoção/reordenação, e os fallbacks de desenho vazio e id
inelegível.

⚠️ Registro metodológico: as duas primeiras redações deste teste falharam comparando o plano
AUTOMÁTICO com um `rotinaCustom` montado à mão. Os dois produtores têm pipelines legitimamente
diferentes (o automático acrescenta o bloco do foco; o manual nunca passa por reduce-to-fit; e o
deload lê a `referenciaDose` que o editor carrega e que uma construção manual não tem). A
comparação passou a ser **desenho × desenho**, pelo caminho real do editor
(`doPlano` → `paraRotinaCustom`).

## ⑤ Cobertura muscular na PRÉVIA AUTENTICADA

O item 3 do relato foi concluído onde ele foi relatado: no app servido, com sessão real aberta
pelo autor. Tudo em leitura e em rascunho; encerrado com **Cancelar** e **Manter o meu**.

**O SHA realmente servido**, verificado no bundle que o navegador baixou (e não só no
`githubCommitSha` do deployment): `excecoesDeSessao` **presente** (só existe a partir de
`e1933bd`) e `não cabe em` **ausente** (removido em `e1933bd`).

| O que | O que apareceu |
|---|---|
| descoberta | cartão *Cobertura muscular* com moldura, chips (`14 regiões`, `2 sem exercício`, `ver detalhes`), **antes** do botão de adicionar, **aberto** quando há região sem exercício |
| dia **vazio** | o cartão continua lá: *"Assim que você escolher exercícios a este dia, mostramos aqui quais regiões dos grupos escolhidos eles contemplam…"* (era o `return null` da 1ª volta) |
| **adicionar** | *Prancha lateral* → `14 regiões · 2 sem exercício` vira `15 regiões · 1 sem exercício`, CORE de 4/5 para **5/5**, e *Quadrado lombar* passa a ter exercício |
| **remover** | volta a `14 regiões · 2 sem exercício`, com as sugestões de novo |
| participação **identificada** | ● *Reto abdominal — parede anterior — Bird dog (perdigueiro)* |
| **inferência** | *Participação auxiliar (por inferência anatômica) — não fecha cobertura* · ◐ *Trapézio — inferior — Puxada unilateral na polia, Barra fixa supinada* |
| **condição não declarada** | *Depende da execução; não confirmado* · ? *Eretores da coluna — região lombar — Hiperextensão lombar: quando o movimento é de estender a coluna (o tronco sobe pelas costas)* · *"Adicionar não confirma esta região: o app não registra como você executa o movimento."* |
| **lacuna de catálogo** | ○ *Multífido lombar — Sem exercício identificado para esta região* · *"Nenhum exercício do catálogo aborda esta região diretamente. Não há o que sugerir aqui."* — e não *"não é ativada"* |
| **sugestões elegíveis** | *Prancha lateral · Prancha lateral com rotação · Flexão lateral (oblíquo)*, com **O que muda** → `+5 min no dia · +3 séries neste dia` |
| nada automático, nada bloqueado | nenhum exercício entrou sozinho; *"não impede salvar o seu treino"*; **Salvar meu treino** segue ativo |
| **celular** (375 × 812) | cartão legível, chips em duas linhas, sem rolagem horizontal |

A ressalva do teto por sessão **não** apareceu na proposta deste perfil — e não devia: o plano
automático dele não tem exceção nenhuma, o que é o resultado esperado da varredura de 10 080
combinações. O caminho de renderização é coberto pelo guard de tela
(`treino-acoes-e-cobertura-tela.test.ts`), que exige o bloco e que ele venha **antes** do botão
de aplicar.

**② verificado ao vivo:** peito 10 e quadríceps 10 numa faixa de 10–14 aparecem com chip
**verde**, e **nenhuma** frase de insuficiência sai por não se ter chegado a 14. Os avisos que
ficam são os do critério certo — *"Glúteos está abaixo da faixa mínima desta semana (7.5 de 10
séries)"* e *"o volume de posterior ficou abaixo do mínimo desta semana"*.

## ⑥ Os 24 → 23 testes pulados, reconciliados nominalmente

O teste que mudou é, por nome:

> `src/lib/engine/deload-volume-entregue.test.ts` ::
> `D13 · os casos nomeados pela auditoria` >
> `o caso que D2 mediu continua onde estava, na moeda decidida (96 → 93 na S5; a S6 fica em 48)`

Ele foi **reescrito e renomeado** em `d93028b` para
`… (S5 86 · S6 ~45% menos, mesma estrutura)`, passando a medir os **dois** seletores
(`[86, 48]` no histórico, `[80, 40]` no atual). A classificação
(`test-support/selecao-etapa1-classificacao.json`) casa pelo **nome completo**, então a exclusão
passou a apontar para um nome que não existe mais: virou **filtro morto**, o teste começou a
rodar nos dois projetos e o rodapé caiu de 24 para 23 sem decisão de ninguém.

**Execução provada** (`vitest run` do arquivo, sem filtro de projeto):

```
✓ |historico-seletor-etapa1| … > o caso que D2 mediu continua onde estava, na moeda decidida (S5 86 · S6 ~45% menos, mesma estrutura)
✓ |atual:src/lib/engine/deload-volume-entregue.test.ts| … > (idem)
```

Corrigido tirando o nome da classificação — que é o que a reescrita tornou verdadeiro —, com a
nota do porquê no próprio JSON. E como um comentário não falha em CI (o repositório **já tinha**
um aviso escrito sobre isto em `regressao-cinco-casos.test.ts`, e o defeito aconteceu mesmo
assim), entra `src/lib/selecao-etapa1-classificacao.test.ts`: todo nome histórico declarado tem
de casar com um teste que existe, inclusive os gerados por `it.each` com marcadores. Verificado
que ele **derruba a build** ao reintroduzir o nome antigo.

### As 14 fotografias e os 36 contratos de `d93028b`, revistos

- **Fotografias:** 14, todas em `orcamento-caracterizacao` (12 no seletor atual, 2 no histórico),
  todas de **contagem de slots por dia** em `massa`. Nenhuma em `saude`/`emagrecimento` — o que
  confirma, pelo próprio artefato, que a política não vazou para os outros objetivos. Nesta 2ª
  volta **nenhuma fotografia mudou**: a troca substitui o exercício, nunca remove o slot.
- **Contratos:** sem `.skip`, sem `.todo`, sem `expect` comentado. Saíram 95 `expect` e entraram
  234; as igualdades exatas (`toBe`/`toEqual`) subiram de 51 para 140, contra 32 → 63 de
  desigualdades — os contratos ficaram mais apertados, não mais frouxos. Os 26 `if (` novos são
  guards de helper (teto nulo, filtro de grupo), contadores de anti-vacuidade, ou ramos com
  asserção nos DOIS lados (`if entregou ⇒ segunda sessão; else ⇒ a recusa é explicada`), cada um
  com o seu caso de anti-vacuidade ao lado.

---

# Primeira volta (2026-09-17) — `d93028b`

O que segue é o registro do candidato anterior. **A tabela e os tetos continuam valendo
inteiros**; o que a segunda volta substituiu está marcado como 🔺 **SUPERADO** no próprio
ponto, com o remetimento à seção correspondente acima.

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

> 🔺 **SUPERADO pela segunda volta.** Com a troca de exercício rodando antes das podas, a
> varredura (agora de 10 080 combinações, incluindo `casa` e `nenhum`) dá **0 planos acima do
> teto de sessão**. A poda por sessão caiu para 10 células e a semanal, em academia/massa, para
> zero. Ver **① Tentar antes de aceitar**.

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

> 🔺 **SUPERADO pela segunda volta.** A leitura de que "reduzir glúteos seria cobrar de um
> terceiro" continua certa — o que faltava era não precisar reduzir ninguém: `e57` *Ponte de
> glúteo* (`"Glúteos, posterior de coxa"`) virou `e153` (`"Glúteos"`), mesmo grupo, mesmo padrão e
> mesmo custo de tempo. A lista de células ficou **vazia**, e continua no teste para que uma
> célula nova entre como falha.

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

> 🔺 **NÚMEROS DA SEGUNDA VOLTA:** **229 arquivos / 3 754 testes** (23 pulados, agora
> reconciliados nominalmente — ver ⑤), tripwire em **44**, e dois arquivos novos:
> `rampa-identidade-2026-09-17.test.ts` (25 casos) e
> `selecao-etapa1-classificacao.test.ts` (4 casos). Nenhuma fotografia mudou nesta volta.

## Limites reais

- **Nenhuma publicação.** Sem merge, sem deploy de produção.
- **Nenhuma gravação em conta nenhuma.** Na primeira volta o QA rodou sobre build de produção
  local, sem Supabase. Na **segunda** ele rodou na **prévia autenticada**, na sessão que o autor
  abriu: tudo em LEITURA e em rascunho do editor, encerrado com **Cancelar** e com **Manter o
  meu**. O contador da aba do plano continuou em `21 exercícios · 76 séries na semana` antes e
  depois — nada foi salvo, nem no perfil principal nem em qualquer outro.
- **O servidor de desenvolvimento não renderiza** sob a CSP vigente (`script-src` sem
  `unsafe-eval`; o bundle de dev usa `eval`). A CSP **não foi relaxada** — o QA usou o build
  otimizado, como nas levas anteriores.
- 🔺 **A exceção de sessão do plano automático foi FECHADA** (era o 1º limite desta lista): 0 de
  10 080 combinações. O mecanismo da exceção continua existindo e é alcançável pelo **desenho da
  pessoa**, onde os exercícios e os dias são escolha dela — e lá ele é exercido por teste.
- 🔺 **O topo da faixa desejada continua não sendo alcançado**, e agora **em silêncio**: a frase
  que anunciava a diferença era insuficiência por não chegar ao topo, e foi removida (②). Um
  intermediário fecha os grandes em 10–12 numa faixa de 10–14, **dentro dela**, com chip verde e
  sem aviso — verificado na prévia autenticada. Se a intenção for que o topo seja atingível, isso
  é mudança no alocador, e segue como decisão material.
- **Telemetria** continua sem eventos novos (mesmo motivo da leva anterior: exige migration).

## Decisões materiais ainda necessárias

1. 🔺 **RESOLVIDA na segunda volta** — o resíduo de sessão por crédito indireto. Nenhuma das três
   alternativas listadas era necessária: a quarta, a troca de exercício equivalente, fecha o caso
   sem custo. 0 de 10 080 combinações.
2. **A faixa superior inalcançável** — *segue aberta.* O alocador dá slot por déficit e conta o
   crédito indireto **planejado**, então para antes do topo. *Impacto medido:* num intermediário
   de 4 dias/60 min os grandes fecham em 12 contra um topo desejado de 14; na prévia autenticada,
   peito e quadríceps fecharam em 10 numa faixa de 10–14. Hoje isso é **silencioso e correto** sob
   a decisão ("máximo permitido não é meta"), e a faixa superior é teórica para estes layouts.
   Mudar isso é mexer no alocador, não na tabela.
3. **O desempate por secundários na repartição** — *nova, trazida por esta volta.* Quando a sobra
   do round-robin não divide igual, ela passa a cair no exercício com **mais secundários grandes**
   do mesmo grupo e do mesmo dia. Isso entrega mais estímulo pelo mesmo número de séries (319
   avisos de grupo abaixo do mínimo a menos, 0 a mais), e é o que a ordem por posição fazia por
   acidente antes do conserto. Se o autor preferir que a sobra caia pelo `id` (ordem neutra), o
   custo medido é voltar a 255 células com um grupo abaixo do mínimo.

## Fragmento para o cofre

`fragmento-cofre-politica-volume-hipertrofia-2026-09-17.md`, ao lado desta worktree. Ele é
**externo**: a promoção ao cofre é feita depois, pela conta adequada. Nada foi escrito no cofre por
aqui, e o cofre antigo não foi consultado nesta tarefa.
