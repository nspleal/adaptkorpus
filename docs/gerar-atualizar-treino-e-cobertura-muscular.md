# Gerar/atualizar o treino e cobertura muscular no editor

2026-09-16. **Candidato local, sem publicação.** Nenhum push, merge, deploy nem alteração do
cofre. Nenhuma gravação em conta real.

## Procedência

| Campo | Valor |
|---|---|
| Base | `origin/main` = `2d951b4b64c05f1448a76995ea2b55898f5c1f99` (16/09, PR #14) |
| Branch | `trabalho/gerar-atualizar-treino-cobertura` |
| Worktree | `adaptkorpus-treino-cobertura` (isolada; nenhuma outra worktree foi tocada) |

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

## 3. Verificação

- **Suíte completa**, `CI=true npx vitest run` (sem filtrar projeto): **226 arquivos, 3670
  aprovados, 24 históricos pulados, zero falhas**. Base medida antes das mudanças:
  222 / 3565 / 24 / zero.
- **Typecheck** e **build**: RC 0. **Lint**: os mesmos 5 warnings preexistentes da base.
- **104 testes novos** em 4 arquivos: `engine/cobertura-editor.test.ts` (27),
  `engine/variacao-montagem.test.ts` (21), `proposta-treino.test.ts` (28),
  `treino-acoes-e-cobertura-tela.test.ts` (28) — mais 2 guards reescritos em
  `editor-guiado.test.ts` (16, um a mais que os 15 da base).
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
- **Sem backend exercitado.** O QA rodou sem Supabase: a persistência remota, o CAS e o conflito
  de revisão não foram exercitados nesta leva (o caminho de falha de rede, sim — o banner
  apareceu e o estado local foi preservado). O campo novo `variacaoTreino` viaja no `prefs`
  jsonb do `profile`, sem migration.
- **Deload e retomada** foram verificados pela suíte (cenários de semana 6 e rampa), **não** na
  interface ao vivo.
- **O condicional anatômico não tem declarante.** O app ainda não declara execução
  (`movimento`, `acaoPunho`, `retroversaoPelvica`), então na prática esses alvos ficam sempre
  PENDENTES. O parâmetro existe e é testado; falta a superfície que o preencha.
- **QA por injeção de perfil** em `localStorage` para o estado "exercício banido": o caminho de
  banimento pela interface é preexistente e não foi reexercitado.
- Prévia local em `http://127.0.0.1:3142/app`, servidor de produção (`next start`) sobre o build
  otimizado — o servidor de desenvolvimento continua esbarrando na CSP vigente, que não foi
  relaxada.

## Fragmento para o cofre

`fragmento-cofre-gerar-atualizar-treino-cobertura-2026-09-16.md`, ao lado desta worktree. Ele é
**externo**: a promoção ao cofre é feita depois, pela conta adequada. Nada foi escrito no cofre
por aqui.
