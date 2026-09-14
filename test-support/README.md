# Seletor atual e fotografias da etapa 1

`npm test` executa obrigatoriamente todos os projetos de `vitest.config.ts`; o Gate em `.github/workflows/gate.yml` usa esse mesmo comando, sem seleção de projeto nem continue-on-error.

- `atual`: todos os arquivos usuais, exceto os 12 que precisam das duas leituras.
- `atual:<arquivo>`: cada um dos 12 arquivos usa o seletor real (ADAPT_TEST_SELETOR_ATUAL=1). A exclusão é limitada ao nome completo de cada teste histórico classificado, dentro daquele arquivo.
- `historico-seletor-etapa1`: os 12 arquivos completos usam a fixture histórica identificada (variável 0).

`selecao-etapa1-classificacao.json` versiona as 53 diferenças: arquivo, nome completo, motivo e prova sucessora. Não é uma lista de testes atuais aprovados: **qualquer teste novo é incluído por padrão**, inclusive dentro dos 12 arquivos. Renomear um teste histórico deixa de excluí-lo até que sua classificação seja reavaliada. Nenhuma exclusão é por substring, prefixo, expressão livre ou nome de exercício.

Na revisão E2-02, eram 196 testes originais aplicáveis ao atual e 39 dirigidos atuais. Os demais arquivos continuam na execução atual normal. A execução histórica não substitui esses testes. Os 53 casos exclusivos da leitura histórica aparecem como skipped nos projetos atuais e são executados no histórico, preservando suas fotografias.

As provas sucessoras de `src/lib/engine/distribuicao-etapa2.test.ts` e `distribuicao-contratos-atuais.test.ts` cobrem recortes e intenção, banda ponderada, cascata em divisão estável, dias não atendidos, favoritos, duração e cardio terminal. O mapa explica as comparações estruturais que deixaram de ser propriedades do auto, sem dispensar as invariantes numéricas.

Para inspeção dirigida, `npm test -- src/lib/engine/trilhos.test.ts` executa as duas leituras desse arquivo. `npm test` sem filtros é a validação obrigatória; não requer runner ou variável externa. Uma falha no seletor atual retorna status não zero mesmo que o histórico passe. Essa propriedade foi demonstrada com um teste temporário novo no arquivo trilhos, restaurado byte a byte após a prova; logs ficam no pacote externo da rodada 3.
