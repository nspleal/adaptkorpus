# Integração do frontend Sites v17

2026-09-15. Candidato local, sem publicação.

## Procedência e escopo

Base do app: `3c363ebdee3d88c0af30b8ee5cc278d2e3b995e9`.
Laboratório Sites v17: `5269571830e0ffb52b626f2bdb5aa6a0103c6142`.
Branch: `trabalho/integracao-frontend-sites-v17`.

Portadas somente as mudanças de Painel, SeletorExercicio, DiasEPreferencias e PlanejarCardio. A branch antiga do laboratório não foi mesclada: sua infraestrutura e seu motor não substituem a produção atual.

Entraram biblioteca de pratos, alimentos por categoria, montagem semanal de cardio e biblioteca de exercícios que não fecha ao clicar fora. Preservados o editor vigente, os alvos anatômicos, o catálogo e todo `src/lib/engine`.

## Ajustes na integração

- Cardio planejado usa o namespace local por conta e a limpeza de logout existentes. Não escreve atividade realizada e não altera a meta automática. Valida dados carregados, minutos e erros de armazenamento.
- A interface informa que a montagem de cardio fica neste navegador e não sincroniza. As escolhas de pratos são temporárias, como no fluxo de substituição existente; a interface declara isso.
- Escolha de prato é revalidada com as restrições atuais. Rótulos de refeições usam MEAL_LABEL. Busca sem resultado tem mensagem própria.
- Grade de cardio ajustada para telas estreitas.

## Verificação

- Suíte completa com CI=true: 214 arquivos, 3.431 aprovados, 24 históricos pulados, zero falhas. Três testes novos verificam normalização, isolamento por conta/limpeza e erro de gravação.
- Typecheck, lint e build: RC 0. Lint mantém cinco warnings preexistentes.
- Build e typecheck finais refeitos após remover a rota temporária de fixture. A primeira checagem imediatamente após sua remoção encontrou tipos gerados obsoletos; o build os regenerou e a checagem final passou.
- Diff de engine, data, EditorTreino e AlvosAnatomicos vazio contra a base; nenhum snapshot alterado.
- QA com perfil fictício local: cardio salvo/recarregado sem sessão realizada; formulário de registro preenche modalidade e duração, cancelar preserva estado; biblioteca busca/aplica prato; categoria seleciona/desmarca todos; cancelar editor preserva plano; clique externo não fecha biblioteca, Escape fecha; alvos anatômicos presentes.
- Layout de cardio e dieta conferido a 375 px sem overflow horizontal. Nomes de refeições confirmados no build final.

## Limites e estado

QA local sem credenciais de produção, banco ou conta real. Persistência remota não exercitada. O servidor de desenvolvimento esbarrou na CSP vigente (unsafe-eval); a política não foi relaxada, e o QA foi feito sobre build otimizado, sem novos erros de aplicação observados.

Nenhum push, merge, deploy ou alteração do cofre. Prévia local em http://127.0.0.1:3137/app com dados fictícios. Logs externos em `segundo cerebro/evidencias/integracao-frontend-sites-v17-20260915`.
