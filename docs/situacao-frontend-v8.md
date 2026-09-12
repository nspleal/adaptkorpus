# Situação — Pacotes de design V8 (muito-fácil/calibração · favoritos · escada)

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

> ⚠️ **SUPERSEDED (2026-07-05).** Documento histórico. Os bloqueadores **B1/B2/B3** listados aqui como
> abertos **já foram implementados**: a calibração é gravada como evento `tipo:'calibracao'` no
> histórico (`src/lib/treino-historico.ts`), a adoção de degrau existe ("Assumir este degrau" +
> `degrauId`, `src/lib/treino-progressao.ts`), e as modificações isométricas existem
> (`src/lib/engine/modificacoes-isometricos.ts`). Ver os handoffs `docs/handoff-*` para o estado
> atual. Mantido apenas como registro da auditoria original — **não é backlog vigente**.

> **Insumo para o cofre.** Escrito pela sessão do app (nuvem) em 2026-07-04 — esta sessão **não
> escreve no cofre** (regra de escritor único); o autor arquiva. Branch: `claude/adaptkorpus-app-dev-9in0hs`.
> Base: auditoria de 4 verificadores independentes contra o código real do app, com evidência
> `arquivo:linha` para cada afirmação. Este documento é autossuficiente: um leitor do cofre entende a
> situação sem a conversa que o gerou.

## TL;DR

O autor entregou **3 pacotes de design** (V8.1 "Muito fácil"+calibração · V8.2 Favoritos · V8.3 Escada
de dificuldade). A parte **visual está 100% coberta** — protótipos de alta fidelidade, copy final,
tokens corretos. Porém a frase recorrente dos READMEs, *"o motor já entrega os dados"*, só é
**totalmente verdadeira no caminho de SUBIDA da escada (V8.3)**. A auditoria encontrou **7 pendências
não-visuais** (B1–B7 abaixo): **1 pacote de dados que não existe** (modificações dos isométricos),
**2 decisões de arquitetura/produto profundas** (como a calibração manual grava; como se "aceita" um
degrau) e **4 decisões menores**. Nada disso é bloqueio de UI — é dado/decisão que **volta pelo autor
ao cofre** antes de o código poder ser fiel.

**Plano em 2 levas:** a Leva 1 (destravada, ~70% do escopo) pode ser implementada já; a Leva 2 espera
B1–B7.

---

## 1. Veredito de prontidão por pacote

| Pacote | UI (host existe?) | Motor/dados prontos? | Bloqueadores |
|---|---|---|---|
| **V8.3 Escada** | ✅ cartão (aba Treino), modal de detalhe, sessão guiada | **Parcial** — posição/sugestões prontas; faltam 2 helpers pequenos | B3 (adoção), B4 (e7/e90) — só nas bordas |
| **V8.2 Favoritos** | ✅ cartão, modal, Editar-perfil (bloco irmão localizado) | **Não** — favoritos são 100% novos no código | B5 (regras de produto) |
| **V8.1 Muito fácil + calibração** | ✅ pílulas, padrão de modal, chips de meta | **Não** — sem persistência de calibração; Corpo C sem dados | B1 (dados), B2 (arquitetura), B3 |

## 2. O que JÁ existe no app (confirmado no código — não refazer)

- **Motor de escadas completo e testado** (`src/lib/engine/escadas.ts`): `ESCADAS_DIFICULDADE`
  (10 escadas, 38 ids), `posicaoNaEscada(id) → {degrau, total, escada}`, `localizarNaEscada`,
  `sugerirProximaVariacao` / `sugerirVariacaoAnterior` (ambas respeitam equipamento). O hint de
  **subida** já está ligado na sessão guiada (`treino-progressao.ts:86-88` → `SessaoTreino.tsx:310`),
  hoje como linha discreta (o design V8.3 pede o cartão de sugestão — refino de UI).
- **Pisos de reps já são constantes travadas**: `PISO_REPS_COM_CARGA = 6` e `PISO_ABSOLUTO_REPS = 5`
  (`treino-constants.ts:84-85`) — exatamente o "iniciante 6 travado / absoluto 5" do V8.1.
- **Nível e tipo do exercício já são conhecidos** sem perguntar: `perfil.nivelExperiencia`
  (`Painel.tsx:43`), `repUnitDe()` p/ isométricos (`isometricos.ts`), `loaded` derivado de
  `equipamentoDetalhe`. O roteamento automático do corpo do modal (V8.1 §2) é implementável.
- **`dificeisSeguidos` já é rastreado** no estado do motor (`treino.ts:164-191`) — o gatilho da
  regressão ("Difícil 2×") tem dado real por trás; só não é exposto ao adaptador ainda (trabalho meu).
- **Padrão de modal** (backdrop blur + `evkPop`) já existe ("Senti dor", `SessaoTreino.tsx:440-452`);
  `@keyframes evkPop` e blocos `prefers-reduced-motion` já estão em `globals.css`.
- **Persistência versionada** já tem padrão (`session.ts` `evk_sessao` v1; `treino-historico.ts`
  `evk_treinos`) — favoritos e calibração seguem o mesmo molde quando decididos.
- **Pré-preenchimento da calibração** é derivável do fold existente (`progressoDosExercicios` devolve
  `repsAlvo`/`cargaKg`/segundos por exercício).

## 3. Correções aos READMEs dos pacotes (itens stale/imprecisos)

1. **V8.2 §voz — "discrepância 'não curte' → 'não gosto'": JÁ RESOLVIDA em produção.** O rótulo
   visível é "Alimentos que você não gosta" (`DiasEPreferencias.tsx:122`) e toda copy de usuário usa
   "gosto/gostou". O que resta de "naoCurto" é **id interno travado no cofre** — não renomear.
2. **V8.1 "todas as decisões já estão travadas; a tarefa é composição visual": impreciso.** B1 (dados
   isométricos) e B2 (arquitetura da gravação) são bloqueadores reais de dados/arquitetura — o próprio
   checklist do README os lista como pendentes.
3. **V8.3 "o motor já entrega os dados": verdadeiro só para a SUBIDA.** A descida (regressão) existe
   como primitiva mas não está exposta ao UI; a lista expandida precisa de um helper de
   "escada com nomes" que ainda não existe (pequeno, trabalho meu).

## 4. Os 7 bloqueadores (B1–B7) — o que volta pelo autor

### B1 · Modificações dos 5 isométricos — **DADO NOVO, não existe** 🔴
O Corpo C da calibração (V8.1 §5) renderiza "Atual → Nova base" (ex.: Prancha *pés no chão* →
*pés elevados*). Essa lista de modificações por isométrico **não existe em lugar nenhum** —
`isometricos.ts:13` explicitamente adia "modificação" para o cofre, e as escadas de core em
`escadas.ts` são escadas **entre exercícios diferentes**, não alavancas do mesmo exercício.
**Precisa:** curadoria no cofre de uma sequência ordenada de modificações (com nomes) para
e7 Prancha · e90 Prancha lateral · e94 Agachamento na parede · e118 Pendura na barra ·
e140 Pegada estática. **Sem isso, o Corpo C e a borda isométrica não têm o que renderizar.**

### B2 · Calibração manual × modelo derivado-do-histórico — **DECISÃO DE ARQUITETURA** 🔴
O contrato atual do motor (Bloco B, travado): *alvo = função pura do histórico* (`estadoAposHistorico`,
fold sobre `evk_treinos`; docstring em `treino-progressao.ts:16-22` — "sem localStorage novo").
"Salvar nova calibração" grava uma **base manual que sobrepõe** o alvo derivado — contradiz o contrato.
**Opções para o autor decidir:**
- **(a) Evento novo no histórico** — a calibração vira um `EventoProgressao` tipo `'calibracao'` gravado
  em `evk_treinos`; o fold o consome. *Prós:* preserva "alvo = f(histórico)", auditável, export LGPD já
  cobre. *Contras:* mexe no shape do histórico (migração de versão).
- **(b) Store de override** — nova chave `evk_calibracao` por exercício; o seed do fold parte dela.
  *Prós:* não toca no histórico. *Contras:* cria uma segunda fonte de verdade do alvo.
- *Recomendação da sessão do app: (a) — mantém o determinismo auditável com uma única fonte.*

### B3 · Como se "aceita" subir/descer de degrau — **DECISÃO DE PRODUTO** 🔴
Hoje o hint de escada é **decorativo**: `montarRotina` ignora `variacaoNivel` e nada troca o exercício
mostrado na rotina/sessão. Tanto o hint (V8.3) quanto a calibração por escada (V8.1 Corpo B) pressupõem
um caminho de **adoção** que não existe. O checklist do V8.3 deixa isso explicitamente fora do escopo
da peça ("onde a pessoa aceita a sugestão"). **Precisa:** decidir onde/como o aceite acontece (só pela
calibração manual? botão no hint? troca automática nunca?) e como isso alimenta o montador/sessão.

### B4 · e7/e90 têm dois eixos de progressão — **RECONCILIAR** 🟡
Prancha (e7) e Prancha lateral (e90) são **isométricos** (V8.1 → Corpo C, modificação) **e** estão em
**escadas mapeadas** (`coreEstabilidade` degrau 2/4; `coreObliquo` degrau 2/3 → V8.3 mostraria o
indicador "Degrau X de Y"). Os outros 3 holds não estão em escada nenhuma. **Precisa:** decidir qual
eixo vale em cada superfície (proposta: indicador de escada aparece; calibração usa modificação).

### B5 · Regras de produto dos favoritos — **3 DECISÕES** 🟡
(a) **Badge "por preferência"**: acende para todo favorito que entrou no plano, ou só quando o
desempate do montador foi decisivo? (muda a lógica do flag `incluidoPorPreferencia`);
(b) **Motivos de descompasso**: conjunto fechado + copy exata ("pede equipamento de academia",
"nível avançado", "fora dos dias que você treina", outro?);
(c) **Toast "Desfazer"**: duração (~4,5 s no protótipo) e comportamento se a pessoa sair da tela.

### B6 · `variacaoNivel` (relativo) × degrau da escada (absoluto) — **RECONCILIAR** 🟡
O motor conta `variacaoNivel` como offset relativo (0, ±1 por progressão); a escada usa índice absoluto
(`posicaoNaEscada`). Para pré-selecionar o degrau atual no seletor da calibração e gravar a nova base,
os dois precisam ser reconciliados (proposta: absoluto = degrau da escada; `variacaoNivel` derivado).

### B7 · Ciclo da flag "meta recalibrada" — **DECISÃO MENOR** 🟢
O hint "Sua meta foi recalibrada…" (V8.1 §7) aparece só na 1ª sessão seguinte e é consumido, ou
persiste até a meta ser atingida? (checklist do próprio README).

## 5. Plano de implementação em 2 levas

### Leva 1 — destravada (nenhuma dependência de B1–B7; posso começar já)
- **V8.3 quase inteiro:** componente "Degrau X de Y" (pílula de dots + lista expandida read-only,
  alimentados por `posicaoNaEscada` + helper novo de escada-com-nomes) no cartão e no modal;
  cartão de sugestão de **subida** com "Ver variação" (substitui a linha discreta atual);
  hint de **descida** (expor a regressão no adaptador via `ultimaAcao`); modo leitura no modal de
  detalhe (abrir por id de exercício, sem botão "Trocar").
- **V8.2 parcial:** persistência dos favoritos (padrão `session.ts`); estrela no cartão + modal
  (com `evkStarPop`); nome do exercício clicável; seção "Meus favoritos" em Editar-perfil (ao lado do
  bloco de alimentos); elegibilidade com motivo (equipamento/nível reusam `locaisPermitidos` +
  `DIFICULDADE_LIBERADA`; "dias" deriva da rotina montada) com copy provisória sinalizada; toast
  "Desfazer" (~4,5 s provisório).
- **V8.1 parcial:** 4ª pílula "Muito fácil" (guiada + registro manual); casca do modal; **Corpo A**
  (com carga — pisos 5/6 já constantes; iniciante travado em 6, inter/avançado clamp em 5 + aviso
  amarelo); **Corpo B** (seletor de escada — ids/baseIndex prontos); **Corpo D** borda peso corporal
  (topo detectável por `posicaoNaEscada.degrau === total`). O botão **"Salvar" fica desabilitado ou
  atrás de flag** até B2 — sem onde gravar coerentemente.

### Leva 2 — pós-decisões
- B2 decidido → gravação da calibração + hint "meta recalibrada" (com B7) + pré-seleção reconciliada (B6).
- B1 curado → Corpo C isométrico + borda isométrica.
- B3 decidido → adoção real de degrau (sessão/montador passam a refletir a variação assumida).
- B5 decidido → preferência no montador + flag por slot + badge "Favorito" + copy final dos motivos.

## 6. Tabela-resumo para virar DF no cofre

| # | Tipo | Pergunta ao autor | Destrava |
|---|---|---|---|
| B1 | Dado | Curar modificações (atual → mais difícil, com nomes) dos 5 isométricos | V8.1 Corpo C + borda isométrica |
| B2 | Arquitetura | Calibração grava como **evento no histórico** (recomendado) ou **store de override**? | Botão "Salvar" da calibração inteira |
| B3 | Produto | Onde/como a pessoa **aceita** subir/descer de degrau (e o que muda no plano)? | Adoção de variação (V8.3+V8.1) |
| B4 | Produto | e7/e90: escada, modificação, ou ambos (por superfície)? | Indicador × Corpo C nesses 2 |
| B5 | Produto | Badge "por preferência" (regra exata) · motivos de descompasso (copy) · toast (duração/saída) | Montador de favoritos + badge + copy final |
| B6 | Produto | Degrau "atual" oficial = absoluto da escada (recomendado)? | Pré-seleção e gravação do seletor |
| B7 | Produto | Flag "meta recalibrada": consome na 1ª exibição (recomendado) ou até bater a meta? | Hint pós-calibração |

## 7. Pendências visuais fora destes pacotes (registro)

- **Animações faceless dos 163 exercícios** — arte do autor; slots "em breve" continuam.
- **Foto de prato** — decidir se o app terá; placeholder "Imagem do prato · em breve" continua.

---
*Evidências completas (arquivo:linha por achado) na auditoria da sessão do app (4 verificadores).
Nada foi escrito no cofre. Decisões B1–B7 voltam pelo autor para arquivamento.*
