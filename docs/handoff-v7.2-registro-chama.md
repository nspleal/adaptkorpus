# Handoff — V7.2: Registro manual de treino + Chama dos 4 marcos

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/evokorpus-app-dev-9in0hs`. Commit: `07c67dc`. Fontes: os dois pacotes do
> Claude Design (`design_handoff_registro_e_contador_treino` + `design_handoff_chama_marcos`).
> Portei fiel (estilos inline exatos, keyframes `evkChama*`, copy verbatim das telas).

## ⚠️ Para arquivar no cofre: a decisão do contador EVOLUIU

A página `registro-de-aderencia-evokorpus` registra (2026-07-02): *"contador PURO, **sem
marcos/níveis** — sem comemoração"*. O pacote **chama** que você me mandou depois declara:
*"Decisão de produto já tomada: este sistema de **4 marcos por cor** é o definitivo"* (15/25/50/100,
com comemoração única e sutil ao cruzar). Implementei o pacote chama (decisão mais nova do autor).
**As travas de ouro foram todas mantidas**: total que só cresce, nunca zera, fogo nunca apaga,
ausência não fala, sem streak, Pulso fora da chama. → **Atualizar a página do cofre** para refletir
os 4 marcos por cor (e aposentar de vez os marcos 7/30 da V6.2, que saíram do código).

## O que entrou

### Contador de treinos + Chama dos 4 marcos (aba Hoje, acima da saudação)
- **`ChamaContador.tsx`** — porte exato do componente (`Chama.dc.html`): SVG teardrop de 2 camadas,
  paletas âmbar/azul/roxo/**verde Folha `#16A34A` exato**, cinza p/ marco futuro (sem glow, sem
  animação, opacity .55 — nunca punitivo), keyframes com nomes/tempos exatos (`evkChamaBreathe`
  3.6s · `Core` 2.15s · `Glow` 2.6s/`GlowSoft` 2.9s · `Celebra`/`Flash` 1.2s).
- **Cartão do contador**: pill do marco + *"Você já completou **X** dias de treino."* (X na cor do
  marco) + linha de apoio por faixa (copy final do handoff) + **próximos marcos** (chamas apagadas,
  "faltam N dias"; após 100: *"Você chegou no último marco por cor…"*).
- **Comemoração**: única (~1,25s, pop+flash), **só no cruzamento real** de 15/25/50/100 — nunca ao
  abrir o app/trocar de aba/reload. Como o registro acontece em tela cheia (com a chama desmontada),
  o cruzamento fica **pendente** e toca quando a Hoje volta a ficar visível.
- **Saíram**: `marcos.ts`, `MarcoConstancia.tsx` (indicador do Hoje + cartão do Progresso, medalha,
  glow, pós-hiato). O total acumulado no Progresso continua coberto pelo stat existente.
- **`chama.ts` puro + 8 testes** ancorando: fronteiras 14/15 · 24/25 · 49/50 · 99/100; copy por
  faixa (e que nunca fala em "perder/zerar/apagar"); pill; dedupe por dia calendário; monotonicidade.

### Registrar treino feito (formulário pós-fato, 3 entradas)
- **`RegistrarTreino.tsx`** (tela cheia, padrão da sessão guiada): data (passado ok, **futuro
  clampado p/ hoje** — o `max` do input não segura data digitada) + hora; **ponto de partida**
  ("Usar o treino do plano" pré-preenche os exercícios de hoje com séries prescritas e reps no topo
  da faixa, carga em branco / "Montar do zero"); **busca na biblioteca real (163)** com filtros
  Equipamento + Padrão (AND), sem duplicar já-adicionados; **exercício personalizado** com aviso
  permanente no cartão (*"Esse exercício não alimenta o gráfico de carga por exercício."*) e switch
  "Peso corporal (sem carga)"; peso corporal sem coluna de carga + campo **Variação**; séries com
  adicionar/remover; **esforço opcional** (chips Fácil/Na medida/Difícil + RIR lado a lado);
  observação; Salvar desabilitado sem exercício; salvando→salvo com "Ver no histórico"/"Registrar
  outro treino".
- **Entradas**: cartão "Treino de hoje" (Hoje, ao lado de "Começar treino") · header da aba Treino ·
  "+ Adicionar treino" no Histórico→Treinos. *(Substitui o link mínimo da V6.3.)*
- **Dados**: sessão manual grava **no mesmo formato da guiada** (+`manual:true`, `hora`, `obs`,
  por-exercício `custom`/`rir`/`variacao`), inserida na **data real escolhida** (ordenada). No
  Histórico tem a **mesma aparência** da guiada + texto discreto "· registrado manualmente" (+data);
  no detalhe, chip neutro "Registrado manualmente" + observação. **Cargas ignora personalizados**
  (sem id estável não há série comparável). Contador **deduplica por dia calendário** (2º treino no
  mesmo dia não soma).

## Revisão adversarial (24 agentes) — o que ela pegou e foi corrigido
- **Comemoração inatingível** (token mudava com a chama desmontada → transição engolida no remount).
- **Data futura digitável** apesar do `max` (clamp no onChange + no salvar).
- **`hojeISO()` era UTC**: a partir das 21h (Brasília) o dia virava "amanhã" — treino guiado datado
  errado e dedupe inflado. Agora é o **dia local**. *(Bug pré-existente da V6.2, corrigido junto.)*
- Aviso do personalizado agora é **permanente no cartão** (README exige; o protótipo só mostrava no
  painel de busca).
- Fidelidade fina: selects com "Todos" (como o protótipo), textarea .92rem.
- Robustez: histórico normaliza entradas corrompidas; `n` = max+1 (chave única mesmo após descarte).

## Decisões minhas que voltam por você
1. **Gramática sobre texto GERADO**: *"falta 1 dia"* (singular; o protótipo gerava "faltam 1 dias")
   e *"1 série"*. Não toquei em copy desenhada.
2. **Lixeira vermelha**: o README do registro diz "não usar o vermelho Alerta em nada deste pacote",
   mas o **protótipo** (fonte de verdade visual) estiliza o remover-exercício com `rgba(229,72,77,…)`.
   Segui o protótipo (ação destrutiva ≈ semântica de segurança). Se preferir neutro, é 1 linha.
3. **"Segundos" (exercícios isométricos)**: o protótipo demonstra cabeçalho "Segundos" p/ Prancha
   via metadado `repUnit` — a **biblioteca real não tem esse metadado**. Ficou tudo em "Reps".
   → Se quiser, você cura no cofre a lista dos exercícios por tempo (Prancha, Prancha lateral,
   Agachamento na parede, Pendura na barra, Pegada estática…) e eu ligo o mecanismo.
4. **Nome da sessão manual**: mantive "Treino registrado" (o mais simples e honesto, como o
   protótipo; o checklist do README deixa o critério em aberto).
5. **`hora`** é coletada e armazenada no registro, mas ainda não é exibida em lugar nenhum (o
   protótipo também não exibia). Decidir se aparece no detalhe da sessão.

## Qualidade
`typecheck` · `lint` · **166 testes** (+8 chama, −7 marcos) · `build` — verdes. E2E (Playwright,
**zero erros de console**): contador acima da saudação (pill/copy por faixa) · cruzamento 14→15 com
**comemoração única** (e sem re-celebrar ao trocar de aba) · dedupe no mesmo dia · data passada
inserida na posição certa · peso corporal sem coluna de carga · personalizado com tag+aviso e fora
do gráfico de Cargas · persistência no reload · selects "Todos" · data futura clampada.

## Arquivos
**Novos:** `src/lib/chama.ts` (+`chama.test.ts`), `src/components/painel/ChamaContador.tsx`,
`src/components/painel/RegistrarTreino.tsx`.
**Alterados:** `Painel.tsx` (contador + entradas + celebração pendente + histórico manual),
`treino-historico.ts` (`registrarSessaoEm` datado + robustez + `hojeISO` local), `SessaoTreino.tsx`
(tipos), `CargasHistorico.tsx` (exclui custom), `DetalheModais.tsx` (chip manual + obs),
`globals.css` (keyframes `evkChama*`), `changelog/page.tsx` (2 releases de 03 jul).
**Removidos:** `marcos.ts`, `marcos.test.ts`, `MarcoConstancia.tsx`.
