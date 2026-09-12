# Handoff — Registrar refeição + Histórico de aderência (V5)

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/adaptkorpus-app-dev-9in0hs`. Commit: `9062f45`.
> Origem estética: `V5_front_end_evoK.zip` → `design_handoff_registrar_refeicao/Adaptkorpus Registrar Refeição.dc.html`
> (F1 registro na aba Dieta · F2 sub-aba Dieta do Histórico · B4 vazio). A "casca de revisão" do
> protótipo ("Reiniciar registros" / "Ver estado vazio" / "Abrir o app") foi descartada, como manda o handoff.

## O que é (modelo travado)

Registro **binário leve por refeição** — para cada refeição (Café · Almoço · Lanche · Jantar) uma
pergunta: **"Você seguiu a dieta nesta refeição?"** → **"Segui o plano"** ou **"Comi outra coisa"**.
O conjunto alimenta um **histórico de aderência (constância)** — **não** um diário de calorias.

> Regra de ouro: **"comi outra coisa" é estado NEUTRO e acolhedor, nunca falha/culpa.** Sem vermelho,
> sem caloria, sem "você passou X kcal". O foco é **constância, não perfeição**.

## O que entrou

Módulo fiel novo em **`src/components/painel/RegistroRefeicao.tsx`**:
- `useRegistro()` — estado do **dia atual** persistido em **localStorage** (chave `evk_aderencia`,
  um registro por data ISO): `logs[mealId] ∈ null|'seguiu'|'fora'` + `notes[mealId]` (string opcional).
  Hidrata no mount, grava a cada mudança. **Dado genuíno do usuário — nada fabricado.**
- `ResumoDia` — card de aderência do dia ("X de N refeições no plano" + N segmentos + legenda + pílula).
- `ControleRegistro` — controle por refeição: estado **a registrar** (2 botões de peso igual) ·
  confirmação **seguiu** (Folha/Pulso) · confirmação **comeu fora** (NEUTRO + textarea opcional +
  "Sem calorias, sem cobrança") · link **Alterar** (volta a "a registrar").
- `borderRefeicao(status)` — borda do card por estado (seguiu `rgba(22,163,74,.4)` · fora
  `rgba(234,229,219,.16)` · pendente `rgba(234,229,219,.1)`).
- `HistoricoDieta` — visão de aderência ao longo do tempo + **B4** vazio.

### Onde foi integrado (estende telas existentes — sem telas paralelas)
| Parte | Onde vive | Status |
|---|---|---|
| F1 · resumo do dia | topo da aba **Dieta** (`Painel → DietaTab`) | **ligado** |
| F1 · registro por refeição | dentro de cada card de refeição, **abaixo dos pratos, após divisor** | **ligado** |
| F2 · sub-aba **Dieta** | nova sub-aba no Histórico (entre Treinos e Peso) | **ligado** |
| B4 · vazio | dentro da sub-aba Dieta do Histórico (antes de qualquer registro) | **ligado** |

- **Semana** = lista de dias (rótulo Hoje/Ontem/dia, 4 mini-segmentos, "X/N no plano", acordeão de detalhe).
- **Mês** = mini-calendário tingido por aderência (mais "no plano" = mais verde; **nunca vermelho**;
  hoje com anel Pulso); clique abre o detalhe do dia.
- **Resumo do período** ("~X% do plano"), **streak** (dias consecutivos com ≥3/N no plano) e
  **detalhe do dia** (refeições + status + nota opcional em itálico).
- "Hoje" no histórico reflete os registros ao vivo da aba Dieta (props mescladas sobre o localStorage).

> ⚠️ **Substituição do handoff:** o V5 pede trocar o "food-diary" de kcal/macros do Histórico pela visão de
> aderência. Nosso Histórico **não tinha** sub-aba Dieta de calorias (só Treinos/Peso) — então a sub-aba
> Dieta foi **adicionada** já na forma correta (aderência, **zero número de caloria/macro**).
> O cardápio sugerido da aba Dieta **mantém** o "~X kcal" por refeição (é o plano, uma estimativa) — a trava
> de "sem calorias" vale para o **registro** e o **histórico de dieta**, não para o cardápio.

## Travas de copy/produto mantidas (V5 §216)
"Comeu fora" **neutro** (sem vermelho/emoji/culpa) · **aderência = constância, não perfeição** (celebra
streak, nunca pune lapso) · **sem diário de calorias/macros** no registro nem no histórico · **sem "IA"**
("regras adaptativas") · **sem promessa** · **18+** · vermelho `#E5484D` só erro/segurança · neon `#BDFF00`
só no escuro · **dois botões com peso visual igual**. Copy reproduzida **verbatim** do README V5.

## Qualidade
`typecheck` · `lint` · **130 testes** · `build` — verdes. E2E (Playwright), **zero erros de console**:
onboarding → aba Dieta (resumo "1 de 4", marcar "Segui o plano" e "Comi outra coisa" com nota,
pílula "2 a registrar" ao vivo) → Histórico → Dieta (resumo da semana + streak, detalhe do dia com a nota
"Pizza com amigos" persistida, alternância Semana↔Mês, mini-calendário Dom–Sáb).

## Pendências que voltam por você (cofre)
- [ ] **Sincronização entre dispositivos:** hoje a aderência vive em `localStorage` (sem backend). Na fase de
      backend, persistir `logs/notes` por usuário via server client + RLS (mapeia a **Ownership-1**) — modelo
      sugerido no README: `MealLog { mealId, status, note? }` / `DayLog { date, meals }`, **sem calorias**.
- [ ] **Limiar do streak:** hoje "≥3/N refeições no plano" por dia. Confirmar se 3 é o número travado ou se
      escala com o nº de refeições do plano (ex.: ¾).
- [ ] **% do período:** média de (seguiu/N) sobre os dias **com registro**. Confirmar se dias sem registro
      devem entrar como 0 (puxa a média pra baixo) ou continuar fora da conta (postura atual, sem culpa).

## Arquivos
**Novo:** `src/components/painel/RegistroRefeicao.tsx`.
**Alterado:** `src/components/painel/Painel.tsx` (wiring: `useRegistro()` no nível do Painel; `DietaTab`
com `ResumoDia` + `ControleRegistro` por refeição; `Historico` com sub-aba `Dieta` → `HistoricoDieta`).
