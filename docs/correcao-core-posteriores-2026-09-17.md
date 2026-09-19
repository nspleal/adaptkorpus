# Correção de core e busca dosada de posteriores — candidato local

Base de produção: `1a0f3929f438b679cdb9c69b93493fea3357a0ab`.
Candidato anterior: `1390ae25be7810dd7539b5b64f6b4f9a8b0d2ed0`.
Candidato desta correção: HEAD da branch `trabalho/cobertura-complementar`.
Nenhum merge ou publicação em produção faz parte desta tarefa.

## Core: causa e correção

O automático ainda passava core pela compensação 1:1 antiga. A folga nominal por
exercício não representava a capacidade distribuível por sessão: o compensador
podia ceder mais do que a repartição absorvia. Reabrir somente a adição de core
reproduziu três falhas em 216 cenários do seletor atual, e três no histórico.
Os 21/216 citados no registro anterior não foram reproduzidos nesta identidade;
não se atribui a esta execução uma contagem que ela não mediu.

A decisão do autor agora é aplicada diretamente: baseline primeiro, até duas séries
adicionais de core depois. O adicional consulta dose real, teto por exercício,
crédito ponderado semanal/diário e duração canônica, sem mudar descanso, ordem,
frequência ou retirar séries de terceiros. O boost é único na semana, não por slot.
A cobertura pode adicionar core dentro dos orçamentos; deixou de ser exclusão geral.
O cálculo legado do desenho manual foi preservado. A interface automática deixou
de solicitar um compensador e informa a entrega efetiva, inclusive quando é zero.

## Posteriores: alcance e restrições

O passe anterior só trocava identidades usando dose uniforme de planejamento. O novo
passe trabalha sobre a dose materializada, após poda do baseline e antes do foco.
Examina uma troca por dia, compensação nos posteriores mantidos e, na ausência de
troca válida, uma adição. Minimiza as séries adicionais. Não é busca exaustiva de
redistribuições entre dias, grupos ou todas as estruturas semanais.

Fixture verificável: `e80×2 + e81×2` pode virar `e64×2 + e81×4`, conservando crédito
de glúteos e todos os alvos anteriores. Com `e80×4 + e81×4`, a troca não cabe nessa
compensação: a dobradiça restante já está no teto de quatro séries. Uma terceira
entrada só é aceita com orçamento real, tempo e volume; teste separado cobre isso.
Essas fixtures provam o passe, não representam ganhos observados em perfis usuais.

Em 1.320 perfis reais da grade ampliada, o passe dosado não acrescentou ganho novo.
O caso intermediário 4d/60 permanece: seis slots no teto de seis, duas dobradiças
com quatro séries cada. `e64/e65/e66/e86/e87` são alternativas de flexão elegíveis,
mas trocar uma dobradiça perde crédito de glúteos; a outra já não pode receber
séries. Adicionar requer sétimo slot. Em 75/90 min o dia tem sete de sete slots.
`e83` e `e123` não são liberados para intermediários. Não se reclassificou catálogo,
nem se cobrou compensação de outro grupo. Ver alternativas por ID nas evidências.
A limitação de buscar somente dentro do dia/grupo é declarada; não é prova de
impossibilidade em toda organização semanal concebível.

## Comparação com o candidato anterior

Grade de 300 perfis: 62 dias ganharam quadrado lombar; nenhuma perda de alvo ou
crédito semanal, nenhum novo excesso temporal e nenhum excesso do teto de slots.
A grade completa preserva antes/depois por dia, ID, séries, duração e grupo.

| Caso | Antes | Depois |
|---|---|---|
| Intermediário 4d/60 S2, core semanal | 8 diretas / 0 indiretas / 8 ponderadas | 11 / 0 / 11 |
| Dia Ombros + complementares desse caso | e41×4, e42×4, e43×3, e148×4; 2.760 s | e41×4, e42×4, e43×3, e148×3, e102×4; 3.220 s |
| Alvo quadrado lombar nesse dia | sem direto identificado | e102 identificado |
| Posteriores do mesmo perfil | e80×4 + e81×4; 8 ponderadas | inalterado; cabeça curta pendente |
| Glúteos semanais do mesmo perfil | 0 diretas / 8 indiretas creditadas / 8 ponderadas | inalterado |
| Avançado 5d/45 S1, dia Pernas | e64 já presente; 2.700 s | preservado |
| Complementares desse avançado | e158×4, e37×4, e147×4; 1.300 s | soma e102×4; 1.860 s |

Indiretas creditadas já incluem o peso 0,5; não são contagem de séries realizadas.
Presença no mapa não prova hipertrofia, dose suficiente ou predominância.

## Verificação

- 216 cenários: baseline preservado por ID/série/descanso com core em foco; dose
  adicional exata de 0–2. A regressão falha no candidato anterior por cessão de série.
- Testes puros de compensação, adição e recusa dos posteriores; elegibilidade vem do pool.
- Confirmação/reabertura slot a slot, retomada e deload, determinismo, variação,
  stale proposals e plano manual cobertos pela suíte completa.
- Suíte completa: 3.800 passando, zero falhas. Os 23 filtrados do seletor atual têm
  classificação nominal e passam no projeto histórico; nenhum skip foi acrescentado.
- Typecheck, lint, build e diff-check verdes; cinco warnings de lint preexistentes.
- Onze fotografias de contagem atualizadas: cada mudança é +1 slot de cobertura.
  O teste de dose normal passa a 35 slots/114 séries, exigindo e102×4 e preservação
  exata ao reabrir. Não se removeu asserção funcional para acomodar as contagens.
- QA desktop/mobile em fixture local descartável: editor real, custo de sugestão,
  confirmar/reabrir com e sem foco, sem deriva; 390 px sem overflow horizontal.
  Sem login ou escrita em perfil real. A rota temporária foi removida.

Evidências externas: `../evidencias-cobertura-complementar-correcao-20260917/`.
Gate remoto e deployment final são registrados no relatório externo pelo SHA exato;
a aprovação local acima não se apresenta como resultado de execução remota.

## Conferência de 19/09 — orçamento de tempo dos testes

A suíte completa local (233 arquivos, paralelismo padrão) reprovou seis testes por
`Test timed out in 5000ms`, não por asserção: a varredura de 216 cenários do foco de core
(4,8 s no gate, 6,1 s aqui) e os quatro casos "desenho que CABE" da transferência de dose
na retomada (4,4–4,7 s no gate). A varredura montava três planos por cenário; passou a
montar dois, com a soma e a dose adicional lidas do mesmo plano com foco. Os cinco
testes receberam orçamento explícito de 30 s. Na rodada seguinte, outros três testes
preexistentes (frequência FIT da retomada, desenho de antes da pausa) caíram do mesmo modo,
a 5,3–5,4 s; o orçamento passou a ser global (`testTimeout: 30_000` em `vitest.config.ts`).
Nenhuma asserção mudou; o motor não mudou.

## Decisão do autor — 19/09/2026 (substitui a compensação 1:1 e a recusa de salvamento)

Confirmado pelo autor na conferência de 19/09: no treino automático o baseline é montado
primeiro, sem retirar séries de outros grupos; o foco de core pode somar até duas séries
semanais nos slots existentes, respeitando todos os limites (séries por exercício, teto
ponderado semanal e diário, tempo). Sem folga, a preferência **fica salva** e o plano informa
"Foco salvo, mas nenhum extra foi aplicado por falta de espaço nos limites do treino" — nunca
apresentado como foco atendido. Esta decisão substitui, para o automático, a compensação 1:1
e a recusa de salvamento da política v3.1 (DF 2026-08-05); o desenho manual conserva o par
core/compensador. A autorização cobre a correção e a validação do candidato; a publicação
continua sendo decisão separada.
