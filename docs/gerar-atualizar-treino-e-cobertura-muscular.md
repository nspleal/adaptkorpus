# Gerar/atualizar o treino e cobertura muscular no editor

2026-09-16. **Candidato local, sem publicação.** Nenhum push, merge, deploy nem alteração do
cofre. Nenhuma gravação em conta real.

## Procedência

| Campo | Valor |
|---|---|
| Base | `origin/main` = `2d951b4b64c05f1448a76995ea2b55898f5c1f99` (16/09, PR #14) |
| Branch | `trabalho/gerar-atualizar-treino-cobertura` |
| SHA do candidato | `ec0a7fc0bec713fc5efc8477c4144b13fb741ae5` (deployment `dpl_6wJv9onDohv6Dn3uT3oHPV3KUgig`) |
| Worktree | `adaptkorpus-treino-cobertura` (isolada; nenhuma outra worktree foi tocada) |
| Prévia remota | `evokorpus-git-trabalho-gerar-atualizar-f23c54-nspleals-projects.vercel.app` — deployment `dpl_4Fbe1v8oRKVYA9q32azC5hPnhGPM`, target `null` (**preview**, não produção) |
| Produção | intacta em `2d951b4` (`adaptkorpus.com`). Nenhum merge, nenhum deploy de produção. |

**Identidade do que é servido, conferida nas duas pontas:** `git ls-remote` da branch devolve
`3384d7b7…`, igual ao `HEAD` local; o deployment que responde pelo alias da branch reporta
`githubCommitSha = 3384d7b7…`. São artefatos distintos apontando para o mesmo commit.

`origin/main` está 150 commits à frente de `origin/claude/evokorpus-app-dev-9in0hs` (o `HEAD`
remoto herdado) e contém tudo o que havia na branch anterior desta sessão — por isso ela é a base.

## Estado por entrega

| Entrega | Estado | Onde |
|---|---|---|
| "Gerar novo treino" com prévia e confirmação | ✅ candidato | `lib/proposta-treino.ts` · `painel/PropostaTreino.tsx` |
| "Atualizar treino" preservando o compatível | ✅ candidato | `lib/proposta-treino.ts` (`atualizarDesenho`) |
| Variedade só entre alternativas válidas | ✅ candidato | `engine/alocador.ts` (`variacao`) · `perfil.variacaoTreino` |
| Cobertura muscular por dia e por grupo no editor | ✅ candidato | `engine/cobertura-editor.ts` · `painel/CoberturaMuscular.tsx` |
| Sugestões com consequência pelo cálculo existente | ✅ candidato | `EditorTreino · efeitoDeAdicionar` |
| Recusa de proposta desatualizada | ✅ candidato | `proposta-treino.ts` (`assinaturaDasEntradas`) · `Painel · aplicarProposta` |
| Condicional: "Depende da execução; não confirmado" | ✅ candidato | `lib/condicao-execucao-copy.ts` |
| Telemetria das duas ações | ⏳ **não feito, de propósito** | ver *Limites* |
| Publicação | ⏳ não feita | — |

## 1. As duas ações do treino

Ficam no cabeçalho da aba Treino, ao lado de "Montar meu treino", com uma linha visível
explicando a diferença. A porta "Gerar novo treino" também existe dentro do editor.

**Gerar novo treino.** Monta uma proposta AUTOMÁTICA nova com as preferências vigentes. Ela é
montada com `rotinaCustom` **fora da entrada**: com o desenho na entrada o montador o respeita
(DF② do editor) e o botão não geraria nada. O desenho salvo **não é apagado para montar** — ele
só sai do perfil se a pessoa confirmar.

**Atualizar treino.** Adapta o que existe. Preserva os exercícios ainda elegíveis, a ordem, o
nome e o dia, e as séries escolhidas; remove o que saiu do pool; realoca dia fora da agenda para
um dia de treino livre; preenche dia vazio ou dia de agenda descoberto com o dia correspondente
da montagem automática, quando ela tem um. `origem` continua `'usuario'`: **atualizar um desenho
manual nunca o converte em automático**.

Em ambos: a proposta é calculada, mostrada e só então aplicada. Cancelar não grava nada — nem
local, nem no servidor. A gravação usa o caminho normal do perfil (`notificarPerfil` → fila com
CAS, revisão e bloqueio por conflito), então falha de rede preserva o local e avisa. Clique
repetido é ignorado enquanto há cálculo em curso, proposta na tela ou aplicação em voo
(verificado: 3 cliques ⇒ 1 modal; 3 cliques em "Usar este treino" ⇒ 1 gravação).

A prévia lista o que entra, o que sai e o que continua, mostra o plano REAL que o perfil
proposto gera (mesmo motor do salvamento) e afirma o que é preservado: histórico, treinos
registrados, progresso das cargas e fase do ciclo. A troca de origem (desenho manual →
plano do app) é dita com todas as letras.

### Variedade sem afrouxar nada

`perfil.variacaoTreino` é um índice inteiro que desloca o **início do cursor de rotação por
grupo** dentro do pool que já passou por equipamento, nível, banidos/preteridos e todas as
invariantes. "Gerar novo treino" testa até 8 variações e devolve a primeira cuja semana difere
da atual; esgotadas as tentativas, o resultado é `sem_alternativa` e a tela **diz** que o
catálogo não oferece uma semana diferente, em vez de fingir novidade.

Ela é **entrada**, não sorteio: mesmo perfil + mesma variação ⇒ mesma semana, byte a byte. É
por isso que ela é persistida — sem guardá-la, a proposta aceita não sobreviveria ao próximo
recompute. O plano continua AUTOMÁTICO e segue adaptando (semana do ciclo, deload, retomada,
preferências).

**O que a variação preserva** (provado em 7 cenários × 8 variações): número de dias, pool,
ausência de exercício repetido no dia, `puxar ≥ empurrar`, nenhum grupo NOVO acima do MRV
ponderado, nenhum dia passando a estourar o limite de tempo, dose por slot dentro da faixa
prescrita, e nenhuma perda de certificação de duração.

**O que ela pode mudar, medido e registrado** (`variacao-montagem.test.ts`): o número de slots
de um dia e o grupo de um slot. Exercícios diferentes carregam crédito indireto (0,5) e descanso
diferentes, então o mesmo alocador por déficit e o mesmo corte por tempo chegam a outra
distribuição. Nenhum teto cede; a diferença aparece na prévia, item a item, antes de substituir.

## 2. Cobertura muscular no editor

Um bloco `<details>` por dia, fechado por padrão, alimentado pelas MESMAS funções da pesquisa
anatômica já integrada (`alvosDoExercicio`, `candidatosParaAlvo`, `ALVOS_ANATOMICOS`,
`alvosDesejadosDoDia`, `RESSALVA_COBERTURA`). Nenhuma classificação nova.

O escopo são os grupos **daquele dia** — os grupos primários dos exercícios escolhidos. Um dia
de peito não lista panturrilha como faltante.

Quatro graus de evidência, que não se colapsam:

| Estado | O que a tela diz |
|---|---|
| `identificada` | contemplada, com os exercícios do dia que a abordam |
| `participacao_auxiliar` | "Participação auxiliar (por inferência anatômica) — não fecha cobertura" |
| `condicional_pendente` | "Depende de como o exercício é executado — a execução não foi declarada", com a condição |
| `sem_exercicio_identificado` | "Sem exercício identificado para esta região" + sugestões elegíveis |
| `sem_candidato_elegivel` | existe no catálogo, nada liberado pelo equipamento/nível atuais |
| `sem_candidato_no_catalogo` | "Nenhum exercício do catálogo aborda esta região diretamente" |

Nunca "esta região não é ativada". Um exercício pode contemplar várias partes — a conta é por
PARTE, não por exercício. Id fora do pacote anatômico é declarado como ausência de informação,
nunca de trabalho muscular.

As sugestões saem do **pool do motor** (`poolElegivel`, extraído do próprio `montarRotina`, que
passou a consumi-lo — uma autoridade só). Sugestão cuja cobertura depende de execução vem
marcada com a condição. "O que muda" calcula, sob demanda e uma vez por sugestão aberta, o
efeito pelo cálculo existente: Δ tempo do dia pela certificação do motor, Δ séries do dia, e Δ
séries semanais ponderadas do grupo pelo placar do crítico. Onde o motor se abstém, a tela se
abstém junto.

Nada é adicionado sozinho: "Adicionar" é um toque da pessoa e passa pela mesma
`adicionarSemDuplicar` do seletor. A cobertura não trava o salvamento, não pontua exercício, não
ordena por "quanto pega" e fala de REGIÕES — não de volume, tempo ou fase, que são do crítico e
dos avisos do motor.

## 3. A rodada de VALIDAÇÃO (16/09, sobre `a6853ec` → `3384d7b`)

### Decisão do autor aplicada: condição de execução

Nesta entrega **não** existe superfície para declarar execução. Onde a cobertura depende de uma
condição não informada, a tela diz **"Depende da execução; não confirmado"**, com a condição em
português — o gesto, não só o termo do pacote — e com o aviso *"Adicionar não confirma esta
região: o app não registra como você executa o movimento"*. O alvo condicional **não** entra na
contagem de identificadas (conferido na tela: `LOMBAR · 0/2 identificadas` com a hiperextensão
no dia). A frase da condição saiu de duas cópias para uma fonte só
(`lib/condicao-execucao-copy`), lida pelo detalhe do exercício e pela cobertura do editor.

### Quatro defeitos encontrados na validação e corrigidos

Os dois primeiros apareceram na leitura do código e nos testes; os dois últimos foram
**reproduzidos na prévia autenticada, com backend real**.

1. **Proposta velha gravava por cima do que mudou depois.** A proposta guardava o perfil
   INTEIRO e o gravava na confirmação. Entre montar e aplicar, o perfil pode andar — banimento
   feito noutra aba, âncora de mesociclo que o próprio app move, peso resolvido que chega de
   uma resposta assíncrona. Aplicar devolvia tudo ao estado antigo, em silêncio.
   **Correção:** a proposta carimba a assinatura das ENTRADAS que a geraram (o mesmo
   `canonicalInputHash` do CAS, com `rotinaCustom`/`variacaoTreino` de fora — são a saída, não a
   entrada). Assinatura diferente ⇒ nada é gravado, a tela explica e oferece "Montar de novo".
   E aplicar virou **rebase** sobre `perfilRef.current`: a proposta contribui só com os dois
   campos que decide.
2. **Condicional lido como resolvível pela adição.** A copy anterior descrevia a condição sem
   dizer que escolher o mesmo exercício não fecha a pendência. Corrigido acima.
3. **"Montar de novo" fechava o modal e não montava nada.** O guard do cálculo lia o ESTADO;
   o remonte limpa a proposta e recalcula no mesmo tique, e a função agendada carrega a closure
   do render ANTIGO, onde `proposta` ainda existe. O pedido morria no guard, **sem erro e sem
   explicação**. O cálculo ganhou porta própria (`calcularProposta`) fechada por ref.
4. **Duplo clique em "Usar este treino" gravava duas vezes.** Medido com a rede interceptada:
   1 clique ⇒ 1 PUT; 2 cliques no mesmo tique ⇒ **2 PUT**. O segundo lia a closure anterior e o
   `finally` já havia liberado o ref. Com a rede viva, o segundo sairia com a revisão velha ⇒
   409 do CAS ⇒ a tela mostraria "atualizado em outro dispositivo": um **conflito falso**, criado
   pelo próprio duplo clique. A proposta passou a viver num ref limpo SINCRONAMENTE no início de
   aplicar.

### Verificação automática

- **Suíte completa**, `CI=true npx vitest run` (sem filtrar projeto, projetos históricos
  incluídos): **226 arquivos, 3682 aprovados, 24 históricos pulados, zero falhas**. Base medida
  antes das mudanças: 222 / 3565 / 24 / zero.
- **Typecheck** e **build**: RC 0. **Lint**: os mesmos 5 warnings preexistentes da base.
- **116 testes novos** em 4 arquivos: `engine/cobertura-editor.test.ts` (27),
  `engine/variacao-montagem.test.ts` (21), `proposta-treino.test.ts` (34),
  `treino-acoes-e-cobertura-tela.test.ts` (34) — mais guards reescritos em
  `editor-guiado.test.ts` (16, um a mais que os 15 da base).

### QA de interface — deload e retomada (dados descartáveis, build otimizado local)

| Fase | Plano na tela | Proposta | Depois de aplicar | Fase / histórico |
|---|---|---|---|---|
| **Deload** (semana 6 por `deloadAte`) | 46 séries | **46** | 46 | `deloadAte` e `mesocicloInicio` intactos; avisos continuam "Semana 6: …" |
| **Retomada** (pausa de 30 dias, 6 sessões) | 56 séries | **56** | 56 | `evk_treinos` byte a byte idêntico; "Retomada: volume reduzido" permanece |

Nenhuma redução aplicada duas vezes (a proposta nasce na mesma fase, não sobre o volume cheio
nem sobre o já reduzido), nenhuma fase reiniciada, e o total do editor bate com o do plano e com
o da proposta. No deload o crítico não acusa "abaixo do mínimo": quem fala é o aviso do motor,
que sabe a causa — sem as duas vozes contraditórias sobre o mesmo placar.

### QA com BACKEND REAL, na prévia, em conta descartável

Conta criada pelo autor na prévia (a mesma base do Supabase de produção — por isso a conta
descartável). Perfil: academia · intermediário · massa · 5 dias · 75 min · sem limite.
`user_id` da conta de teste: `27a276fd-c85a-422e-b645-8775abad2133` (para descarte).

| # | Cenário | Resultado |
|---|---|---|
| 1 | **Cancelar** a proposta | revisão **2 → 2**; plano idêntico item a item. Nada gravado. |
| 2 | **Gerar** de plano automático, confirmar | revisão **2 → 3**, `variacaoTreino: 1`, `origem: automatico`, `mesocicloInicio` intacto |
| 3 | **Recarregar** a página e comparar | dia, exercício, **ordem** e séries **idênticos** à proposta aceita, nos 4 dias |
| 4 | Salvar **desenho manual** (tirando um exercício) | revisão **3 → 4**, `origem: usuario` |
| 5 | **Conflito entre abas** | A abre proposta (rev. 4) · B salva (rev. **5**) · A confirma ⇒ **servidor continua em 5 com a versão de B**; A mostra *"Seu plano foi atualizado em outro dispositivo"* e oferece "Atualizar plano", que carrega a versão de B |
| 6 | **Banir** exercício pela interface | revisão **5 → 6**, `banidos: [e56]`; o desenho salvo ainda o continha |
| 7 | **Atualizar** (origem manual) | proposta diz *"O que muda é o seu treino salvo: Crucifixo inclinado sai dele de vez"*; aplicada ⇒ revisão **6 → 7**, id fora do desenho, **`origem` continua `usuario`** |
| 8 | **Gerar** de desenho manual | proposta é o plano do app, declara a troca de origem, e o banido não aparece; aplicada ⇒ `origem: automatico` |
| 9 | **Proposta desatualizada** | entrada da geração alterada com o modal aberto ⇒ aplicar **não grava**; modal permanece com *"Suas preferências mudaram depois que esta proposta foi montada"* e só "Manter o meu" / "Montar de novo" |
| 10 | **Falha de rede** no PUT | nada é gravado (revisão inalterada), banner *"Não foi possível confirmar o salvamento agora"*, **nenhum anúncio de sucesso** |
| 11 | **Nova tentativa** com a rede de volta | revisão **9 → 10**, banner sai, estado local preservado durante a falha |
| 12 | **Clique duplo/triplo** em aplicar (já com a correção, em `ec0a7fc`) | **3 cliques no mesmo tique ⇒ 1 PUT** (`expectedRevision` 10), revisão 10 → 11, **sem conflito falso** |
| 13 | **"Montar de novo"** na recusa (já com a correção) | monta proposta nova, o aviso sai e o botão de aplicar volta; durante a recusa, **zero PUT** |

Os cenários 1–11 rodaram em `3384d7b`; 12 e 13 rodaram em `ec0a7fc`, depois das correções que
eles próprios motivaram. Os cenários 1–11 não dependem do que mudou em `ec0a7fc` (guards de
clique), e a suíte completa foi reexecutada em `ec0a7fc`.

A interface **não anuncia sucesso** em momento nenhum: ela aplica local-first e, se a gravação
falha, o banner existente diz que não foi confirmada. Nenhum caminho de gravação novo foi
criado — tudo passa pela fila com CAS que já existia, e foi ela que recusou o conflito.

### QA de interface — cobertura muscular

Adicionar, remover e trocar recalculam na hora. Num único grupo aparecem os quatro graus, e eles
não se colapsam — medido em OMBROS depois de trocar a elevação lateral pela puxada para o rosto:
deltoide posterior **identificado**, deltoide anterior em **participação auxiliar (inferência)**,
deltoide lateral **sem exercício identificado** com sugestões elegíveis. Multífido lombar
aparece como **lacuna do catálogo**, sem sugestão inventada.
- **QA no build otimizado**, perfil fictício em `localStorage`, sem Supabase configurado:
  gerar a partir de plano automático e de desenho manual; cancelar sem tocar perfil/treino;
  confirmar, recarregar e reabrir com exatamente a proposta aceita (`variacaoTreino` persistido);
  atualizar após banimento; cobertura reagindo a adição e remoção, com múltiplas partes por
  exercício, lacuna de catálogo e sugestões; cliques repetidos.
- **375 px**: sem overflow horizontal em nenhuma das duas superfícies; alvos de toque ≥ 44 px.

### Três defeitos encontrados no QA e corrigidos

1. **"Sem mudança no volume semanal de Core"** — o placar do crítico cobre só os grupos
   grandes; a primeira versão devolvia `0 − 0 = 0` para core/braços e a tela lia como
   "sem mudança". Agora é `null` e a frase não existe onde não há conta.
2. **"Nada a atualizar" com algo a atualizar** — o montador já descarta da GERAÇÃO o id que
   deixou de ser elegível, então banir um exercício do desenho não muda o plano exibido, mas ele
   continua gravado no perfil. A comparação passou a olhar também o DESENHO salvo, e a tela
   nomeia o que sai dele.
3. **Explicação só em `title`** — invisível no celular e sobrescrevia o nome acessível do botão.
   Virou texto visível.

## Limites reais

- **Sem telemetria nova.** O vocabulário de eventos é fechado e cada tipo novo exige a migration
  que o `check` do banco espera (`metricas/eventos.ts`); sem ela a gravação seria rejeitada em
  silêncio. Medir as duas ações fica para a leva que trouxer a migration junto.
- **Backend real exercitado** na prévia, em conta descartável (tabela acima). O campo novo
  `variacaoTreino` viaja no `prefs` jsonb do `profile` — **sem migration**, confirmado no schema.
- **Deload e retomada** foram verificados na **interface**, com dados descartáveis locais; na
  prévia autenticada não foram reproduzidos (exigiriam plantar histórico na conta de teste).
- **O condicional anatômico não tem declarante.** O app ainda não declara execução
  (`movimento`, `acaoPunho`, `retroversaoPelvica`), então na prática esses alvos ficam sempre
  PENDENTES. O parâmetro existe e é testado; falta a superfície que o preencha.
- **Conflito entre abas na MESMA aba** (a proposta ficar velha por mudança vinda de outro
  aparelho) não é alcançável sem remontar o Painel: o app trata a atualização remota bloqueando
  a gravação e oferecendo recarregar, que é a proteção mais forte e **foi** reproduzida. A
  recusa por proposta desatualizada foi reproduzida com uma entrada da própria aba.
- **Limpeza da conta de teste** fica com o autor: `user_id`
  `27a276fd-c85a-422e-b645-8775abad2133`, com linhas em `profile`, `plans` e `plano_cas`.
- Prévia local em `http://127.0.0.1:3142/app`, servidor de produção (`next start`) sobre o build
  otimizado — o servidor de desenvolvimento continua esbarrando na CSP vigente, que não foi
  relaxada.

## Fragmento para o cofre

`fragmento-cofre-gerar-atualizar-treino-cobertura-2026-09-16.md`, ao lado desta worktree. Ele é
**externo**: a promoção ao cofre é feita depois, pela conta adequada. Nada foi escrito no cofre
por aqui.
