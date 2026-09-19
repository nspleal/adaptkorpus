# Seleção, complementares e placar — 19/09/2026

Base: `6cc5ec2f7913e35335b813ea9c433bab1835b972`. Branch: `trabalho/selecao-complementares-placar`. Candidata isolada; sem autorização de merge ou produção nesta tarefa.

## Comportamento

A seleção prioriza funções de referência dentro do pool elegível e mantém variação entre alternativas da mesma função. Cobertura preserva funções já presentes, não um ranking numérico imutável. O trabalho principal precede complementares. Não foi criado teto universal de três exercícios pequenos; consolidação exige conservação de dose, créditos e cobertura documental.

Um complementar por dia misto; panturrilha em dia de pernas; core e antebraço nos superiores disponíveis. O quinto dia já escolhido pode receber core/antebraço, com exceção ao limite de um no dia dedicado. Manual e cardio explicitamente escolhido são preservados. Poucos dias podem reduzir frequência e omitir complementares, com aviso e checagem independente de adição viável.

No foco de pernas de quatro dias, a exceção do autor permite core 2→1 para viabilizar dois recortes, sem ceder antebraço ou principais. Um dia full-body automático admite segundo costas quando necessário para puxar≥empurrar, dentro de tempo, slots e volume; caso inviável, recusa explicada. A etapa de posteriores não pode anunciar uma segunda flexora que a regra de um posterior removeria depois.

Exceção localizada autorizada posteriormente: iniciante/massa/academia/4d/30min pode trocar remada redundante por encolhimento e tríceps de empurrar por isolado. Somente bíceps/ombros podem ceder até 1,5 ponderada, com pisos 6/3; os demais créditos e alvos, funções puxada/remada, equilíbrio e tempo são preservados. Favoritos, manual, deload e retomada não sofrem a troca. Não é regra geral de redução.

O placar mostra os 12 grupos, inclusive zeros, e distingue “sem faixa”. A unidade semanal ponderada continua direta=1 e indireta=0,5. Não há pesquisa anatômica nova, alteração de catálogo ou regra fisiológica derivada das contagens.

## Correções e provas

A ordem anterior podia selecionar isolados antes da referência, repetir dobradiças e deixar complemento disputar com principais. A continuidade corrigiu também baseline dependente do foco, avisos calculados antes da remoção final de extras, deduplicação que apagava o segundo costas, reserva antiga de core que bloqueava braços e reserva de braços que podia impedir os grandes num Upper curto. No Upper peito/costas/ombros, dois empurrar exigem capacidade para dois puxar antes do piso condicionado de braços.

Prova contra base CP15: sete checks independentes; três falham substantivamente na base (flexora, quinto dia, placar), quatro passam. Os checks de supino/um complementar que também passam na base não são prova discriminante. A worktree-base foi preservada. Não se copiou produção nova para fabricar a falha.

## Testes reancorados

- Composição por função e decisões explícitas substituem quotas de composição sem autorização. Tetos, dose/descanso, tempo, favoritos, manual e baseline são verificados por propriedade.
- Editor: fixtures de compensação/transferência passaram a conter pares realmente desiguais. Round-trip cobra todos os slots e doses, não total histórico 107. A cobertura ausente é testada com omissão deliberada de tríceps no desenho manual; o automático já o preserva.
- Core, deload e focos: controles positivos medidos; redução de frequência é separada de corte de dose. O teste de margem verifica uso da margem, teto e impossibilidade de somar uma série direta; não obriga saturar um teto com créditos fracionários.
- Grade anatômica: mesmo universo semanal de 42 alvos por perfil. Não compara ocorrências dia×alvo como se fossem cobertura semanal. Todas as perdas constam da evidência externa.
- Cinco fórmulas históricas conservam entradas aritméticas explícitas e paridade gerador/crítico. Fotografias de quantidade são snapshots identificados por projeto; o delta de 25min (3→4 no primeiro dia) vem da reserva correta de tríceps.
- Avisos sem ocorrência natural na grade são fixtures de fronteira rotuladas, com cálculo real e mock apenas do retorno da dependência. Não são apresentados como perfis naturais observados.

## QA e limites

Painel real em fixture descartável, sem conta ou backend real: desktop 1440×1000 e mobile 390×844. Cancelar não muda estado; confirmar salva; recarga e editor preservam IDs/dose/descanso. Editor mostra 12 grupos, zero e sem faixa. Revalidação computacional confirma o mesmo plano observado após as mudanças finais. A rota temporária foi removida antes do commit.

O caso aproximado ainda tem cinco tríceps; os traços/doses explicam por que a consolidação conservadora não os remove. Panturrilha pode ser omitida por capacidade. A exceção localizada de trapézio não se estende a 5–7 dias. Esses limites são documentados, não encobertos por testes verdes.

Evidências externas: `../evidencias-selecao-complementares-continuacao-20260919/`, incluindo `RELATORIO.md`, `ANTES-DEPOIS.md`, CSV/JSON completos, decisões, logs, contrafactuais, QA e hashes. SHA final, gate remoto e prévia são registrados ali após commit/push; este documento não afirma publicação em produção.
