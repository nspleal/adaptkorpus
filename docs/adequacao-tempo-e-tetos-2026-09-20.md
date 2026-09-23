# Adequação automática: decisões locais de 20/09/2026

Estado: implementação candidata, sem revisão final nem publicação. As decisões de divisão e evolução foram também registradas na candidata local do novo cofre; isso não constitui promoção da documentação canônica.

- Política temporal por tipo real de sessão, inclusive PPL + Upper/Lower híbrido. Upper/lower e full body reduzem primeiro o descanso, apenas o necessário, até 60 s; se ainda não couber, retiram complementares, depois séries, exercícios acima dos mínimos e, se necessário, séries até uma. Ordem reconfirmada por Nicolas na limpeza de 20/09; a versão anterior deste documento e seu teste registravam a ordem inversa incorretamente. Segmentadas preservam a política própria e os descansos principais.
- Mínimos de exercícios diretos por sessão: upper peito 2, costas 2, ombros 1, bíceps 1, tríceps 1; lower quadríceps 2, posterior 2, glúteos 2; full body um de cada um desses oito grupos. Crédito indireto não supre exercício obrigatório.
- Upper: manter puxada e remada em cada sessão, não apenas na soma da semana. Nicolas reconfirmou essa prioridade em 20/09 ao recusar a troca da puxada de um Upper por encolhimento; a cobertura do trapézio deve respeitar ambas as funções por dia.
- Cobertura aprovada em 22/09: para recuperar uma região ausente, pode cair o crédito indireto, preservando séries diretas de todos os grupos, mínimos, tempo e tetos. Nesta correção, a permissão é usada somente para o crédito indireto de bíceps ao cobrir trapézio; a perda é informada no plano. Não autoriza perder outra região já coberta, remover puxada/remada ou encurtar descansos dos exercícios mantidos. O desenho manual conserva seu tratamento próprio.
- O orçamento inicial de slots é heurística, não impedimento suficiente quando a composição cabe nos limites reais.
- Tetos semanal e por sessão contam crédito direto e indireto. Séries do próprio grupo podem cair até uma, sem cruzar mínimos de exercícios. Três séries não são piso absoluto. Remoção por teto só de redundância comprovada acima dos mínimos, preservando funções e alvos; não sacrificar principais para complementares ou excesso de secundários.
- Bíceps e tríceps também têm teto semanal: usar as faixas existentes para nível, fase e foco, sem conceder margem de foco ao grupo não focado. Ombros permanecem secundários na prioridade de retirada; essa classificação é separada da de volume.
- Conflito residual de volume, tempo ou exercícios elegíveis impede aceitar a nova geração e preserva o último plano salvo. Deload no piso de uma série não implica redução fictícia nem invalida por si só uma sessão que caiba.
- Recuperação após retiradas: somente séries comprovadamente cortadas por tempo, em exercícios mantidos, até a dose original da semana. Não recuperar cortes por volume, reinserir removidos ou encurtar descansos. Priorizar principais, depois secundários e complementares já mantidos; conferir tempo e créditos semanais/da sessão a cada incremento, sem novo ciclo de retiradas.
- Editor: exercícios, séries, descansos e contexto do automático precisam sobreviver a abrir/salvar/recarregar. Mudanças relevantes são apresentadas antes de salvar; desenho manual não recebe remoções automáticas nem sobrescrita silenciosa dos descansos.

- Divisão automática aprovada em 20/09: três dias usam upper/lower em todos os níveis, alternando Upper/Lower/Upper nas semanas ímpares e Lower/Upper/Lower nas pares. A partir de quatro dias, divisão estruturada para todos; dose continua condicionada ao nível. Preferência explícita e desenho manual conservam seus contratos.
- Dose entre níveis: diferenças no total de séries são permitidas. Validar por grupo e nível, sem exigir soma semanal ou número de exercícios não decrescente entre iniciante, intermediário e avançado. Não alterar mínimos nem tetos por essa decisão.
- Estabilidade: mesmos exercícios em S1–S5 para o mesmo perfil/equipamento/configuração. Nos três dias alternados, comparar S1/3/5 entre si e S2/4 entre si; o deload S6 usa a composição par de S4. Sem introduzir saltos ou substituições silenciosas para caber em tetos; se a composição estável não cumprir os limites, recusar a nova geração e informar o conflito.
- Exceção de deload autorizada: após todos os diretos do grupo excedido atingirem uma série, reduzir apenas o necessário de outro grupo contribuinte indireto, pela menor perda ponderada nos demais grupos. Preservar todos os exercícios, uma série por exercício e mínimos, tempo e demais tetos. Registrar créditos de todos os grupos afetados antes/depois; não elevar teto nem usar a exceção para adicionar complementares.

## Faixa e teto em upper/lower e full body — aprovação de 20/09

Para hipertrofia, Nicolas aprovou a tabela abaixo, em séries ponderadas por grupo
muscular por semana (diretas 1; indiretas 0,5). São limites do produto, não limites
biológicos universais. A faixa continua sendo o alvo; a composição pode superar seu
topo dentro do máximo permitido. Isso resolve a pendência de costas 16 versus alvo 14
no intermediário de três dias; não autoriza ultrapassar 16 sem foco.

| Nível | Faixa desejada | Máximo sem foco | Teto do grupo com foco |
|---|---|---|---|
| Iniciante | 6–10 | 10 | 13 |
| Intermediário | 10–14 | 16 | 19 |
| Avançado | 12–18 | 18 | 21 |

A tabela já está centralizada em `treino-constants.ts`/`trilhos.ts`; não há nova
exceção no montador. A aprovação vale para full body e upper/lower; não muda a
política das segmentadas, os outros objetivos, o teto de sessão de 12, os mínimos
de exercícios ou o teto reduzido do deload. Foco só concede margem ao grupo focado.
O máximo não se torna meta a preencher. A faixa não cria mínimo semanal novo para
bíceps/tríceps: permanece a decisão específica registrada ao fim deste documento.

## Pendências de validação

A suíte integral ainda tem falhas em investigação. QA final desktop/mobile pendente. A composição de S1–S5 é planejada conjuntamente, separando as duas alternâncias quando há três dias, com ajuste de séries e sem troca por crédito muscular. A validação final permanece pendente.

Após revisão e aprovação, a coordenação deverá promover a documentação canônica no cofre pelo rito próprio. Os registros locais no novo cofre permanecem candidatos, sem publicação.

### Limite superior dos braços

A extensão do teto semanal a bíceps e tríceps não cria mínimo semanal universal nem recomendação de aumentar séries abaixo da faixa. O crítico publica somente os limites superiores existentes de nível/foco, contando crédito direto e indireto. Permanecem os mínimos de exercícios diretos por sessão e requisitos localizados, incluindo bíceps ≥6 ponderadas na S3 do caso autorizado. O editor distingue esse diagnóstico de uma faixa com mínimo.
