# Recuperação de aderência

Correção dirigida de 12/09/2026. O mount de `useRegistro` escrevia o estado inicial vazio antes da atualização de estado agendada pelo primeiro efeito. Além disso, o GET do servidor substituía edições locais do mesmo dia sem distinguir uma falha de sincronização.

Agora apenas ações de registro escrevem dados. `pendenteSync` é metadado local por dia, guardado dentro da chave de aderência já isolada por usuário e limpa no logout. Não é transmitido ao banco. O servidor continua sendo a origem de dias sem alterações locais pendentes; edições desta sessão prevalecem sobre respostas de leitura atrasadas.

Os PUTs da instância são serializados. A confirmação de uma fotografia anterior não limpa uma edição mais recente. Falha mantém a pendência; nova edição, recarga ou botão Tentar sincronizar reenvia o estado atual. Não há loop automático de tentativas. Dias legados ausentes no servidor mantêm a janela de migração de 30 dias; edições explicitamente pendentes não são descartadas por idade.

Se o storage falhar, a edição fica em memória e a interface avisa que não existe cópia durável no aparelho. Não promete recuperação após fechar a página nesse caso. Callbacks e retries verificam o escopo antes de acessar dados ou reenviar. O histórico não grava cache de um GET atrasado.

Limites: isto não resolve a causa interna do timeout histórico no provedor. Também não introduz controle de revisão entre dois dispositivos editando simultaneamente o mesmo dia: o contrato remoto existente continua de última escrita. A serialização é da instância; autenticação/RLS e a unicidade remota continuam vigentes. Não há mudança de schema nem migração de dados reais.

Verificação: controlador com rede/storage controlados; execução do código real do hook com efeitos e dependências injetados; teste do retry após troca de conta. A reprodução do mount na base mostra PUT e cache vazios. O instrumento do hook não é uma montagem completa do React no navegador: outras falhas do baseline compartilham a escrita inicial, portanto não provam quatro defeitos independentes.
