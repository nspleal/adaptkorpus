# Os dois resíduos do PR #18 — cinco tríceps e panturrilha omitida (20/09/2026)

Base: `67350feaed9c8f7658ff5febfcc1c39f9a8833d5` (produção do PR #18).
Branch: `trabalho/triceps-panturrilha`.

O PR #18 foi publicado com dois pontos abertos, nomeados no próprio relatório: o dia de braços do
caso relatado terminava com cinco exercícios de tríceps, e a panturrilha não entrava no dia de
pernas. Este documento registra a correção dos dois.

## O que foi reproduzido

A fixture é a **aproximada** do relato, a mesma do PR #18 — intermediário/massa/academia, quatro
dias, Prioridades, 75 min **sem limite de tempo**, foco agregado em braços, variação 1, semana 5.
Não é reexecução do perfil privado real e não se atribui equivalência a ele. A semana inteira, com
exercícios, séries, crédito direto e ponderado, duração e ocupação dos dias, está em
`../evidencias-triceps-panturrilha-20260920/ANTES-DEPOIS.md`.

## Causa ① — o quinto tríceps

O dia tinha quatro tríceps de baseline (3 séries cada) e o extra do bloco de foco (2 séries): 14
séries no total. Com o teto de 4 séries por exercício do intermediário, **14 séries cabem em quatro
exercícios**; o quinto existia só para carregar dose.

Duas etapas concorriam para isso. `consolidarPequenos` roda **antes** de `adicionarBlocoFoco`, então
nunca via o extra. E a guarda de traços mecânicos era **circular**: protegia todo traço presente,
inclusive o que o próprio slot candidato a sair introduzia, de modo que um extra com traço próprio
nunca podia ser consolidado, por mais redundante que fosse a composição.

**Correção.** Um segundo passe de consolidação roda depois que o extra existe e está marcado, e só
o extra é candidato. Ele sai quando a sua **função** (a família do cofre) e **todos os seus alvos
documentais** continuam cobertos pelos mantidos e a dose inteira cabe neles dentro do teto por
exercício. Alvos e funções continuam sendo barreira dura; séries totais, crédito de cada grupo,
tetos semanal/sessão/exercício e tempo continuam conferidos. O slot de baseline continua protegido
pela guarda de traços completa. Nenhum teto universal de quantidade foi criado, e nenhuma pesquisa
anatômica foi alterada.

Resultado no caso relatado: **5 → 4 exercícios de tríceps**, as mesmas 14 séries diretas e 18
ponderadas, os mesmos alvos, e o dia de 69 para 67 minutos. O plano diz o que aconteceu.

## Causa ② — a panturrilha

O orçamento de slots do dia (`orcamentoSlotsDoDia`) é função do **tempo**. Para quem marcou "sem
limite de tempo" o motor nem avalia limite (`estadoLimite: NAO_AVALIADO`), mas o orçamento continuava
valendo como se houvesse. Varredura de 336 perfis sobre a versão publicada: **284 sem panturrilha, e
em todos eles o dia de pernas estava cheio**.

No caso relatado os três grupos de pernas precisam dos sete slots para alcançar o mínimo da faixa:
quadríceps entrega 12 séries em três exercícios, e com dois exercícios o teto por exercício só
permite 8, abaixo do mínimo 10. Não havia como incluir a panturrilha sem tirar série de um grupo
principal. Foi medida também a alternativa de consolidar um exercício de pernas redundante — o
afundo tem exatamente os mesmos alvos e o mesmo traço do agachamento —, mas redistribuir a dose
sempre reduz o crédito **indireto** de glúteos, o que a regra de não perder crédito proíbe. Essa
via foi descartada por medição, não por suposição.

**Decisão do autor (20/09/2026), aplicada como está escrita.** Quando o usuário marcou "sem limite
de tempo" e os slots do orçamento são necessários para atender aos grupos principais, o dia de
pernas pode receber **um slot além do orçamento, exclusivamente para a panturrilha**. Preservar os
tetos semanal, por sessão e por exercício, sem retirar séries de outros grupos. Exibir a duração
estimada real, mesmo acima do tempo informado. **Não** aplicar a perfis com tempo limitado e **não**
alterar desenho manual.

Resultado: **+64 perfis com panturrilha** na mesma varredura de 336, **nenhum perfil a perdeu** e
**nenhum grupo perdeu crédito ponderado**. No caso relatado ela entra somando 4 séries, traz três
alvos novos (`gl`, `gm`, `so`) e o dia de pernas passa de 94 para 104,7 minutos — exibidos como são.

## O que não mudou

Prioridade dos principais sobre complementares; um complementar por dia comum; panturrilha só em dia
com pernas; core e antebraço nos dias elegíveis; dia dedicado podendo receber mais de um; frequência
menor de core nos casos aprovados; as exceções já aprovadas de foco de pernas, full-body de um dia e
trapézio, sem generalização; direto 1,0 e indireto 0,5; política semanal, limites por sessão, tempo,
equipamento, banidos e favoritos. Desenho manual e pesquisa anatômica intocados.

## Limites que permanecem

Os 220 perfis que continuam sem panturrilha são todos de **tempo limitado**, onde a exceção não vale
por decisão do autor. Nesses casos o dia de pernas segue cheio com trabalho principal e a ausência
continua sendo nomeada no plano com o impedimento. Não se declara cobertura muscular completa.

Regressões: `src/lib/engine/regressao-triceps-panturrilha-2026-09-20.test.ts`. Quatro asserções
substantivas falham sobre `67350fe` e passam aqui; as demais são guardas das propriedades que não
podiam mudar. Evidências: `../evidencias-triceps-panturrilha-20260920/`.
