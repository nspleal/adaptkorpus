# Manutenção dirigida — catálogo e aderência

## Nomes após regeneração

Os nomes de e49 e e126 são curadoria de apresentação em `src/lib/data/nomes-exercicios.ts`, aplicada na montagem de `EXERCISES`, tal como a lateralidade. O array cru pode conter os nomes antigos sem fazê-los voltar à interface. Não remover essa montagem ao regenerar o arquivo.

O teste `nomes-exercicios.test.ts` recompila o módulo real com os três rótulos antigos e compara os 168 exercícios com o catálogo atual. O teste D20 também exige nomes inequívocos no catálogo exportado. IDs, instruções, séries, equipamento e histórico permanecem iguais.

Não existe importador completo de exercícios XLSX neste repositório; `gerar-seed.mjs` importa alimentos e receitas. Esta correção protege a etapa de montagem do catálogo e a regressão em testes. Não afirma ter executado um importador externo nem atualizado a planilha de origem.

## Incidente F1

O incidente de 12/09 teve respostas 504 em serviços do Supabase e sucesso em tentativas posteriores. Isso é evidência de indisponibilidade, não prova da causa interna. Ausência de erro no banco não demonstra que uma requisição não o atingiu.

A consulta dirigida ao log histórico da Vercel foi recusada com `ExceedsBillingLimitError`. Não foi contratado plano nem alterado limite. A causa interna permanece pendente de evidência do provedor.

A rota de aderência registra somente evento, etapa, duração e status HTTP do aplicativo/upstream. Não registra corpo, data do registro, usuário, cookies, mensagens brutas ou detalhes de erro. Exceção de transporte devolve `500 falha_gravacao`; falha nunca vira sucesso. Nenhum retry de escrita foi adicionado: repetir uma atualização antiga pode sobrescrever uma edição mais recente, apesar da unicidade por dia.

Se ocorrer novamente, correlacionar horário, deployment, etapa e upstreamStatus com os logs do provedor. O novo registro melhora diagnóstico; não significa que o timeout foi eliminado. As permissões das duas RPCs foram reconferidas no banco: anon sem EXECUTE, authenticated com EXECUTE, SECURITY INVOKER.
