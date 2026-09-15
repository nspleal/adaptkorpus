# Integração da classificação anatômica prática (mapa dos 168 ids)

Origem: pacote externo `mapa-consumo-motor-168-20260915`
(`MAPA-MOTOR.json`, schema `adaptkorpus.alvos-operacionais.v1`,
SHA-256 `1db098c3b1a5f9aa8e2635f88d9a4daae09d0fb8429e26b79111134375971360`).
Base do app: `origin/main` = `64c2e7b064265118b3c82cab8d3a4e4a78810f0f`.

**O que este mapa responde:** quais alvos anatômicos cada exercício aborda **pela sua ação**.
**O que ele não responde:** se a dose é suficiente, qual músculo predomina, e se algum
exercício é preferível a outro. É anatomia aplicada à execução — não preferência regional
universal, não garantia de estímulo.

## 1. O que entrou

| Camada | Arquivo | Papel |
|---|---|---|
| Contrato | `src/lib/data/alvos-anatomicos-tipos.ts` | Tipos e vocabulário. Escrito à mão. |
| Dados (motor) | `src/lib/data/alvos-anatomicos-dados.ts` | **GERADO.** 168 ids, 44 alvos, papéis, condicionais e **descritores**. 43 KB. É o único arquivo desta integração no bundle do cliente. |
| Dados (tela) | `src/lib/data/alvos-anatomicos-fontes.ts` | **GERADO.** 17 fichas de fonte, 59 regras com justificativa, ênfases contextuais, 6 limites de discriminação. 72 KB, **fora do bundle** — só a rota o lê. |
| Leitura | `src/lib/data/alvos-anatomicos.ts` | Porta única. Porte fiel de `consulta.py`: mesmas recusas, mesmas saídas. |
| Uso no motor | `src/lib/engine/cobertura-anatomica.ts` | Assinatura de custo, traços mecânicos, passe de cobertura + complementaridade e diagnóstico. |
| Gerador | `scripts/gerar-alvos-anatomicos.mjs` | Lê o pacote e escreve os dois módulos. `--check` prova idempotência. |
| API | `src/app/api/catalogo/alvos-anatomicos/route.ts` | Lista (proveniência + 44 alvos + limites) e detalhe por id. |
| UI | `src/components/painel/AlvosAnatomicos.tsx` | Bloco "O que este exercício aborda", no detalhe e no seletor. |
| Guards | `alvos-anatomicos.test.ts` · `cobertura-anatomica.test.ts` · `alvos-anatomicos-render.test.ts` | **185 testes novos** (40 + 127 + 18). |
| Verificação | `scripts/dump-planos.ts` · `scripts/analisar-complementaridade.test.ts` | Instrumentos que produzem a evidência de 3 vias e o mapa PERMITE/BLOQUEIA. |

Um ponto de contato no motor: `treino-montador.ts` chama o passe **uma vez**, depois de a
alocação final estar escolhida. **`alocador.ts` está byte a byte igual a `origin/main`** — o
passe saiu de dentro dele (ver §5). Nenhuma outra linha do motor mudou.

## 2. Relação com a integração muscular anterior

A `trabalho/integracao-classificacao-muscular` (`8cb647f`) **não está em produção**: ela parte
de `67f5368` (PR #10) e a `main` já andou além dela (PR #11, `64c2e7b`). Por isso ela não foi
importada — trazê-la junto seria empurrar um checkout antigo por cima da produção, que não é o
que esta tarefa pede.

O que foi **reaproveitado dela** é o desenho, que continua certo e que a faz encaixar sem
conflito quando ela chegar:

| Dela | Aqui |
|---|---|
| `musculatura-tipos` / `-dados` / `musculatura.ts` | `alvos-anatomicos-tipos` / `-dados` / `-fontes` / `alvos-anatomicos.ts` |
| Dado gerado **fora** de `exercises.ts` (que se sobrescreve na regeneração do xlsx) | idem |
| Rota própria + `<details>` que carrega sob demanda | `/api/catalogo/alvos-anatomicos` + mesmo padrão |
| Fonte **por afirmação**, com limite ao lado | Fonte por **regra**, com ação, natureza e justificativa |
| "Campo vazio é ausência de AFIRMAÇÃO, nunca de fenômeno" | "Condicional pendente não cobre e não nega" |
| Guard "o módulo não exporta peso/quota/score" | O mesmo guard, ampliado (§7) |

As duas respondem perguntas diferentes e **convivem**: aquela diz o que a pesquisa sustenta
sobre um exercício; esta diz quais alvos a ação dele aborda. Nenhuma sobrescreve a outra, e os
nomes não colidem.

## 3. Conferência do pacote contra a base

- **18/18 arquivos** do pacote batem com `HASHES.json`.
- **23/23 testes** de `testar.py` passam no pacote, como entregue.
- `ENTRADAS.json` referencia `…/adaptkorpus-integra-musculatura/src/lib/data/exercises.ts`
  com SHA-256 `22a936a1…`. O `exercises.ts` de `origin/main` tem **exatamente esse hash**: o
  catálogo não andou entre o pacote e a base.
- Os **168 ids** de `CATALOGO-168.json` são os 168 de `exercises.ts`, e os 12 campos
  (`nomePt`, `nomeEn`, `grupoMuscular`, `grupoPrimario`, `padraoMovimento`, `nivel`, `tipo`,
  `equipamento`, `equipamentoDetalhe`, `local`, `tier`, `comoFazer`) coincidem em **todos** —
  zero divergências. `grupoCatalogo` do mapa == `grupoPrimario` do app em 168/168.

## 4. Como a cobertura e a complementaridade entram na seleção

Os alvos desejados de um dia são os alvos dos grupos que **o template do dia já previa**.
Nada é acrescentado: os três grupos do pacote que não são grupo do catálogo — `adutores`,
`flexores_quadril`, `perna_anterior` — nunca viram obrigação, e sinergista não vira grupo novo.

O passe roda **no montador**, depois de a alocação FINAL estar escolhida: a passada neutra, a
decisão da cascata do foco, a transferência de slot e a eventual realocação coverage-first já
aconteceram e já foram lidas. Dentro de cada slot ele troca o exercício por outro do **mesmo
grupo** e da **mesma assinatura de custo**.

### Os dois critérios de troca

| Critério | Quando conta |
|---|---|
| **Alvo novo** | o candidato aborda um alvo direto do dia que **nenhum outro slot** aborda |
| **Complementaridade mecânica** | o grupo tem 2+ slots no dia, o exercício atual **não acrescenta traço nenhum** ao que os outros slots do grupo já trazem, e o candidato traz um traço que falta |

Cobertura vence complementaridade; entre iguais, a ordem do pool (tier↑, id) decide, e empate
total mantém o exercício de antes. Sem nenhum dos dois, **não há troca**.

### O vocabulário da complementaridade — e o que é ganho fictício

Um **traço mecânico** vem só do contrato:

- `acao:<regra>` — a ação classificada (59 regras, cada uma com `acao`, `natureza:
  inferencia_anatomica`, `justificativa` e fontes). É ela que separa empurrar horizontal de
  inclinado e de declinado, adução horizontal de inclinada e de descendente, remada de puxada
  vertical e de encolhimento, dobradiça de flexão de joelho, desenvolvimento de elevação;
- `<chave>:<valor>` de cada **descritor declarado** — inclinação, pegada, ombro, quadril,
  joelho, trajetória, apoio. São 42 dos 168 ids; os outros 126 não declaram nenhum.

Não vira traço, e isso é o que impede ganho fictício:

- **descritor que o catálogo não define** — nada é preenchido. Ausência de declaração não é
  uma inclinação diferente: os traços de `e15` (supino na máquina) são um SUBCONJUNTO dos de
  `e9` (supino reto, que declara `inclinacao: horizontal`), então `e15` não acrescenta nada a
  um grupo que já tenha `e9`;
- **valor que é uma disjunção do próprio pacote** — `supinada_ou_execucao_a_confirmar`,
  `sentado_ou_deitado_nao_fixado`, `estendido_ou_pouco_flexionado`. O pacote está dizendo que
  a execução não está determinada; usá-los como distinção seria afirmar o que ele recusa;
- **nome, marca, implemento e sinônimo** — supino com barra, com halteres e na máquina têm a
  mesma ação; elevação lateral, na polia e deitado também. Ganho zero, de propósito;
- **magnitude** — `positiva_angulo_nao_fixado` declara a ORIENTAÇÃO; o ângulo continua não
  fixado e nunca é usado.

🔴 Nada disso é peso. "Traço novo" é presença/ausência de uma característica declarada, e o
contrato de peitoral continua com DUAS cabeças: variedade de orientação não é prova de que um
exercício isola uma faixa.

### A assinatura de custo — a trava, agora pelas autoridades reais

O candidato anterior usava PROXIES (`padraoMovimento`, `tipo`, `temCarga`, isometria,
lateralidade, secundários). Medido: de 162 pares redundantes, a classe antiga permitia
alternativa em **9** e bloqueava **153** — e em **0** deles faltava alternativa no catálogo.
Boa parte dos eixos era inerte para o custo: `puxar`, `empurrar`, `agachar` e
`dobradica_quadril` são todos COMPOSTO e descansam igual.

No lugar, `assinaturaDeCusto(e)` chama **`descansoDoExercicio`** sobre toda a grade de
parâmetros que o montador pode produzir (RIR × modo força × rampa de retomada × degradação) e
junta a unidade de execução (isometria com o hold dos três níveis, lateralidade). Dois
exercícios com a mesma assinatura ocupam exatamente o mesmo tempo em qualquer semana e
qualquer perfil. O custo do candidato é computado do próprio candidato — nunca reaproveitado.

### As guardas que sobraram, e por que cada uma existe

| Guarda | Autoridade | Por quê |
|---|---|---|
| assinatura de custo idêntica | `descansoDoExercicio`, `repUnitDe`, `faixaSegundos`, `execucao` | duração, certificação, degradação e deload não se movem |
| balanço `puxar − empurrar` não piora; padrão coberto não some | contagem da semana | saúde do ombro e cobertura temporal obrigatória |
| nenhum **grupo grande** ganha crédito ponderado | `secundariosDe`, `PESO_SECUNDARIO` | `cobertura-teto.ts` e `placarDaSemana` leem exatamente `GRUPOS_GRANDES`; sem isto o passe fazia elástico "fechar ombro" no iniciante |
| nenhum grande cai abaixo do MEV; nenhum grupo zera | `mev(nível, objetivo)`, passado pelo montador | lombar e antebraço só existem por crédito indireto |
| grupos do FOCO não são tocados | `prioritarios`, com o mesmo filtro do bloco adicional | ver §5 |
| mesmo grupo, mesmo estado de favorito, id livre no dia | alocador | DF #12 e não repetir exercício no dia |

## 5. Antes × depois, medido em 3 vias

`origin/main` (**b** = `64c2e7b`) × candidato (**c** = `4576201`) × corrigido (**x**), mesmos
23 perfis, mesmas entradas. Tabela completa em
[docs/evidencia-alvos-anatomicos-antes-depois.txt](evidencia-alvos-anatomicos-antes-depois.txt).

| Métrica (soma dos 23 cenários) | base | candidato | corrigido |
|---|---|---|---|
| slots | 461 | 461 | **461** |
| séries | 1628 | 1628 | **1628** |
| duração máxima somada | 247 430 s | 247 430 s | **247 430 s** |
| descanso mínimo por cenário | — | igual à base | **igual à base** |
| alvos anatômicos abordados (de 921) | 701 | 746 | **761** |
| **pares redundantes** | 171 | 162 | **112** |
| traços mecânicos distintos | 421 | 427 | **475** |

**Regressões do corrigido contra a base: nenhuma.** Slots, séries, duração mínima e máxima por
dia, descanso mínimo e `estadoLimite` são idênticos em todos os 23 cenários.

### A limitação do candidato, reproduzida

Um "par redundante" é: dois slots **do mesmo grupo**, no **mesmo dia**, com os **mesmos alvos
diretos** e a **mesma tarefa mecânica**. O candidato `4576201` só aceitava troca com ganho de
ALVO; como dois stiffs, três remadas ou quatro desenvolvimentos recebem os mesmos alvos, ele
concluía que o trabalho estava feito e deixava 162 pares. Por grupo, no candidato:

| grupo | tarefa repetida | pares |
|---|---|---|
| quadríceps | `agachar_avancar` | 49 |
| ombros | `desenvolvimento` | 44 |
| costas | `remada` | 43 |
| posterior | `dobradica` | 12 |
| costas | `puxada_vertical` | 5 |
| ombros · panturrilha · peito · tríceps · bíceps | — | 9 |

E a análise de onde a classe antiga travava: **PERMITE = 9 · BLOQUEIA = 153 · sem alternativa
no catálogo = 0**.

### As trocas do corrigido, por tipo

| Exemplo real | Ganho |
|---|---|
| `e15` Supino na máquina → `e13` Supino declinado | orientação (horizontal → negativa) |
| `e55` Crucifixo → `e56` Crucifixo inclinado | orientação (adução horizontal → inclinada) |
| `e130` Voador → `e131` Crossover | trajetória (alto para baixo) |
| `e75` Rosca na polia → `e72` Rosca martelo | pegada neutra + braquiorradial (`bf`) |
| `e3` Agachamento livre → `e142` Agachamento sissy | ação (agachar/avançar → extensão de joelho) |
| `e36` Panturrilha em pé → `e158` Panturrilha sentado | joelho flexionado |
| `e41` Desenvolvimento → `e119` Face pull | **alvo** `dp` deltoide posterior |
| `e42` Desenvolvimento → `e95` Remada alta | **alvo** `ts` trapézio superior |
| `e52` Elevação lateral → `e107` Crucifixo invertido na máquina | **alvo** `dp` |
| `e53` Elevação lateral na polia → `e99` Elevação frontal na polia | **alvo** `da` |
| `e4` Abdominal → `e147` Bird dog | **alvos** `er`, `oe`, `oi`, `ta` |

### Duas versões medidas e descartadas no caminho

1. **Passe dentro de `alocarSemana`** (era assim no candidato). A 1ª passada já saía trocada e
   `coberturaTemporalCompleta` — que lê `padraoMovimento` — via outra semana, disparando uma
   realocação que não teria acontecido. Em foco/ombros 4d/60 o dia "Peito + Tríceps" terminava
   com dois desenvolvimentos (180 s) no lugar de duas elevações laterais (90 s) e a duração ia
   de 12 880 s para 12 500 s. O passe saiu para o montador, e `alocador.ts` voltou a ser
   idêntico à base.
2. **Passe tocando os grupos do FOCO.** O bloco adicional (`bloco-foco-adicional.ts`) roda
   depois e escolhe os extras entre os ids do grupo **ainda livres na semana**. Trocar `e41`/
   `e42` por `e119`/`e95` no dia de ombros deixava `e41`/`e42` livres, e o bloco os punha no
   dia de peito no lugar de `e52`/`e53` — dois compostos de 180 s onde havia dois isolados de
   90 s. O dia apertava e o **descanso dos outros seis slots caía de 90 s para 60 s**. Os
   grupos do foco passaram a ser preservados, com o mesmo filtro que o bloco recebe (`core`
   fora, nada na retomada).

## 6. Diagnóstico do que não foi identificado

`diagnosticarDia` devolve, por alvo descoberto, um destes motivos — e **nenhum é veredito**:

| Motivo | Significa |
|---|---|
| `sem_candidato_no_catalogo` | nenhum exercício do catálogo aborda este alvo diretamente, em condição nenhuma |
| `sem_candidato_elegivel` | há candidato no catálogo, mas nenhum passou por equipamento/nível |
| `condicao_de_execucao_nao_declarada` | só candidato condicional, e a execução não foi declarada (vem com a condição que resolveria) |
| `slots_do_dia_esgotados` | havia candidato elegível e os slots do dia acabaram antes |

Casos reais medidos: `mu` (multífido) e `it` (tibial anterior) são
`sem_candidato_no_catalogo` — o pacote já os registra em `limitesDeDiscriminacao`, e **nenhum
exercício foi criado para esconder a ausência**. Em casa sem equipamento, `gd`/`gn` (glúteo
médio/mínimo) e `ts` (trapézio superior) saem como `sem_candidato_elegivel`.

E, quando a **complementaridade** não coube, o mesmo diagnóstico registra por quê — com os
mesmos critérios do passe, na mesma ordem:

| Motivo da redundância | Significa |
|---|---|
| `sem_alternativa_no_catalogo_elegivel` | não há exercício do grupo com outra tarefa declarada entre os elegíveis |
| `alternativa_custaria_outro_tempo` | existe alternativa, mas a assinatura de custo dela é outra |
| `alternativa_mudaria_credito` | existe alternativa de mesmo custo, mas ela mexeria no crédito ponderado |

O diagnóstico **não** entra em `rotina.avisos`, não bloqueia o editor e não diz que o treino é
ruim. É consultado sob demanda.

### O que continua limitado, e por quê

| Caso | Motivo |
|---|---|
| **quadríceps composto** (agachamento, afundo, passada, leg press, hack…) | os 20 ids caem na MESMA regra `agachar_avancar` e nenhum declara descritor. O mapa não distingue as tarefas, e inventar a distinção seria preencher o que o catálogo não define |
| **costas: remada × puxada no mesmo dia** | `remada` credita `biceps` e `puxada_vertical` não; a troca mexeria no crédito. Fica registrada como `alternativa_mudaria_credito` |
| **posteriores: dobradiça × mesa flexora** | a mesa flexora é ISOLADO (60–120 s) e o stiff é COMPOSTO de alta exigência (180 s). Custa outro tempo, então não troca. Onde existe alternativa de mesmo custo — `e123` glute-ham raise, que é `flexao_joelho` com padrão `dobradica_quadril` — a troca acontece e ganha a cabeça curta (`fc`) |
| **grupos sob FOCO** | preservados; a composição deles é do bloco adicional (§5) |
| **`mu` (multífido) e `it` (tibial anterior)** | sem candidato direto no catálogo, em condição nenhuma |
| **e104, e139, e85/e88/e89** | o catálogo do app não declara execução; ficam pendentes e nunca são presumidos |

## 7. O que a integração não faz — e o que garante que continue assim

| Não faz | Garantido por |
|---|---|
| Aumentar duração, volume, séries ou reduzir descanso | assinatura de custo + `cobertura-anatomica.test.ts` ④ (duração idêntica desfazendo as trocas, nos 22 perfis) |
| Trocar sem ganho identificável | ④ (toda troca relatada tem `alvosGanhos` ou `tracosGanhos` não vazio) e ③ (nada muda quando só há implementos da mesma tarefa) |
| Ganho fictício por nome, marca ou implemento | ① (traços de `e11`/`e15` são subconjunto dos de `e9`) |
| Preencher ângulo, trajetória ou posição não declarados | ① (nenhum traço casa `_ou_` ou `_a_confirmar`; 126 ids têm só a ação) |
| Criar peso de ativação ou hipertrofia | ⑥ (nenhum export casa `peso\|quota\|score\|ativação\|hipertrofia\|prescr\|substitu\|frequência`) |
| Transformar sinergista em grupo obrigatório | alvos do dia saem só dos grupos do template; ⑥ |
| Mexer no crédito parcial de 0,5 | ④ (nenhum grande ganha crédito; nenhum grupo zera) |
| Tocar no treino manual | `rotinaCustom` não passa pelo alocador; ⑤ cobra os ids exatos, inclusive na retomada e no deload |
| Mexer no foco adicional | grupos do foco preservados com o mesmo filtro do bloco; `trilhos.test.ts` continua exigindo estrutura idêntica no foco de core |
| Bloquear o editor ou declarar treino perigoso | diagnóstico separado dos avisos; ⑦ |
| Presumir execução | e104, e139, e85/e88/e89 pendentes; ⑥ e `alvos-anatomicos.test.ts` ⑨ ⑩ ⑪ |
| Promover rótulo antigo, sítio de eletrodo ou "largura/espessura" a região | ② (nenhum traço casa `largura\|espessura`) + `limitesDeDiscriminacao` |
| Trazer as 1.706 relações de origem para o seletor | `alvos-anatomicos.test.ts` ㉑ |

## 8. Distinções que os testes travam

Rosca não isola cabeça longa nem curta (nem martelo, nem 21) · tríceps tem três cabeças
participantes e um exercício fecha as três · supino **não** cobre deltoide posterior como alvo
direto · stiff/bom dia **não** recebem a cabeça curta do bíceps femoral (flexão de joelho
recebe) · sóleo participa **em pé** · `e129` é adução da coxa apesar do grupo histórico
`gluteos` do catálogo · `e167` (Y-T-W) **não** é puxada de latíssimo · peitoral tem **duas**
cabeças, sem terceira quota inferior · inclinação e trajetória são **descritores** · a
comparação de Cabral 2022 traz protocolo (barra, 0° vs 45°, 50–70 % 1RM) e o limite de que
não prova hipertrofia, com `usarComoPesoAutomatico: false` · cardio é informativo.

## 9. Regenerar

```bash
node scripts/gerar-alvos-anatomicos.mjs --pacote "<raiz do pacote>"
node scripts/gerar-alvos-anatomicos.mjs --pacote "<raiz do pacote>" --check   # falha se divergir
npm run typecheck && npm run lint && npm test && npm run build
```

O caminho padrão do pacote é proveniência, não dependência de runtime: nada no app o abre.
Se o catálogo mudar, o teste ① derruba a suíte antes de a divergência virar silêncio — e a
resposta é analisar os ids alterados, nunca descartar a pesquisa.

## 10. Decisões materiais tomadas aqui

1. **Base = `origin/main` (`64c2e7b`)**, não a branch da integração muscular. Ela está atrás
   da produção; usá-la seria importar um checkout antigo por cima (§2).
2. **Passe no montador, não dentro do alocador** — medido: dentro dele, a saída do passe
   voltava a alimentar `coberturaTemporalCompleta` e mudava o plano (§5). `alocador.ts` é
   byte a byte igual à base.
3. **Dois critérios de troca, e só eles**: alvo novo ou traço mecânico ausente no grupo
   naquele dia. Sem ganho identificável, não há troca (§4).
4. **Custo pelas autoridades reais, não por proxy.** `descansoDoExercicio` sobre a grade
   inteira de parâmetros substituiu `padraoMovimento`/`temCarga`, que bloqueavam 153 de 162
   casos sem proteger nada — e o custo do candidato é computado do próprio candidato.
5. **Crédito: trava só nos GRUPOS GRANDES.** São os únicos que `cobertura-teto.ts` e
   `placarDaSemana` leem. Travar todos bloquearia complementaridade legítima sem proteger
   nada; não travar nenhum fazia elástico "fechar ombro" no iniciante.
6. **Grupos sob foco não são tocados.** O bloco adicional escolhe entre os ids livres, e
   liberar ids mudava o que ele pegava — piorando o descanso do dia (§5).
7. **`evidenciaOrigemIds` e `preferenciaRegionalComprovada` não foram portados.** As 1.706
   relações são contexto científico e ficam no pacote; um campo vazio de preferência viajaria
   como lugar a preencher com peso.
8. **Descritores AGORA são critério de escolha** — autorizado pelo autor nesta rodada, como
   critério QUALITATIVO de complementaridade. Continuam sendo descritores: distinguem tarefa,
   não medem eficiência, não viraram peso, e a magnitude nunca é usada. Por isso eles saíram
   do módulo da tela e passaram a viver no módulo do motor: fonte única, lida pelos dois.
