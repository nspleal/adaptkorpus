# Handoff — Varredura de erros (bugs de lógica + higiene)

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

Data: 2026-07-05 · Branch: `claude/adaptkorpus-app-dev-9in0hs` · Sem dependência de serviços externos
(nada de Supabase/auth). **Nada escrito no cofre.**

Gate inicial estava limpo (typecheck/lint/280 testes), mas dois caçadores de bugs (subagentes)
acharam 4 defeitos de lógica que passavam pelo gate por estarem em componentes sem teste. Corrigidos
com helpers puros + testes; mais limpezas de baixo risco e higiene de docs.

## 1. Bugs corrigidos (com teste que ancora o cenário)

1. **Aderência keyeada em UTC → data LOCAL.** `RegistroRefeicao.tsx` usava
   `new Date().toISOString().slice(0,10)` no `hojeISO()` e nas varreduras de período/mês. No Brasil
   (UTC-3), às ~21h já virava "amanhã": refeições noturnas caíam no dia seguinte e a aba Dieta
   discordava da Chama (que já usa data local). **Fix:** util puro `src/lib/dia-local.ts:diaLocalISO`
   (mesma regra do `treino-historico.ts`, agora centralizada e reusada por ambos); todas as chaves de
   `RegistroRefeicao` passam por ele. Teste: `dia-local.test.ts` (21:30 local → dia local, não o seguinte).
2. **Streak limitado à janela visível.** O loop percorria só os 7/30 dias exibidos → mostrava 7 na
   aba Semana e 11 na aba Mês. **Fix:** helper puro `aderencia.ts:streakAderencia` que caminha de hoje
   p/ trás (teto 400) até o 1º furo, independente do período. Teste ancora 11 seguidos em ambas as abas.
3. **Tint do calendário fixo em plano de 4 refeições.** `cnt >= 4` impedia um plano de 3 de atingir o
   tier neon num dia perfeito. **Fix:** `aderencia.ts:faixaTint(cnt,total)` proporcional (0..4;
   `cnt >= total` → cheio); a cor do texto do dia usa `cnt >= total`. Teste: plano de 3 com 3/3 → tier
   máximo; plano de 4 inalterado.
4. **Deload ancorava no histórico cru (incluía calibração).** `Painel.tsx` passava `sessoes` cru a
   `precisaDeloadDoHistorico`; se a 1ª entrada fosse calibração, a âncora das 6 semanas deslizava
   (viola a salvaguarda B2). **Fix:** o call-site passa `sessoesTreino(sessoes)`. Teste em
   `treino-progressao.test.ts`: calibração no dia 0 + 1º treino no dia 3 → âncora a partir do dia 3.

## 2. Limpezas de UI

5. **Removida a rota morta `src/app/plano/page.tsx`** — sem links de entrada, copy pré-Fase-1, e usava
   `KAscendente` (viola o CLAUDE.md: ícone = "K em Selo"). `Logo.tsx` intacto.
6. **`/redefinir` — rótulo ≠ comportamento.** "Reenviar link" avançava para o form de nova senha.
   Agora "Reenviar link" é idempotente (reenvia, permanece no passo) e um link discreto separado
   ("Abri o link do e-mail") leva ao passo de criar senha — como o link do e-mail faria. (Tela mock
   de Fase 2; copy ajustável.)

## 3. Changelog + docs
- **Changelog** (`src/app/changelog/page.tsx`): dedupe conservador (removidas 2 entradas de 02 jul
  superadas pelas de 03 jul — "Registre qualquer treino" e "Marcos de constância"); adicionadas 2
  entradas de 05 jul: equipamento 2 níveis (Novo) e correção da curva de Cargas (Correção). Wording
  editorial, ajustável.
- **`docs/situacao-frontend-v8.md`**: marcado **SUPERSEDED** no topo (B1/B2/B3 já implementados).

## 4. Verificação
- `typecheck` ✔ · `lint` ✔ · `test` **290 verdes** (+10) · `build` ✔.
- **E2E Playwright** (build de produção, zero erros de console): semeado 11 dias consecutivos de
  aderência cheia → o badge mostra **"11 dias seguidos no plano" em Semana E Mês** (antes: 7 vs 11);
  os dias aparecem na data local correta (Hoje 05/jul, Ontem 04/jul…). Screenshot anexo.

## 5. Decisões de PRODUTO — pendentes com VOCÊ (não mexi no código)
- **Nome do ebook** contraditório: "A Curva" (`faq/page.tsx:22`) × "O básico do fitness honesto"
  (`ebook/page.tsx:38`) × sem nome (`page.tsx:305`, agora `:307` após edições). Definir o canônico
  (o próprio `ebook` tem `<AValidar>` no título).
- **Política de `session.ts VERSAO`** (`:40`): hoje um bump de versão descarta TODO perfil salvo e
  joga o usuário no onboarding — anula as migrações não-destrutivas de `normalizarPerfil`. Definir um
  caminho de migração real antes de algum dia subir a versão.
- **Ratificação da semântica da curva de Cargas** (por sessão × por dia) — já pendente no
  `docs/handoff-fix-cargas.md`.
- **Curadoria `equipamentoExigido`** dos 53 casa_com — "pendente de aprovação no cofre"
  (`types.ts:147-152`).

## 6. Mocks de Fase-2 (sem ação agora — ficam para o bloco de Auth)
Rotulados no código: login ignora inputs; cadastro→confirmar é fake; confirmar/redefinir sem envio
real. ⚠️ **Maior risco LGPD:** `conta/page.tsx` "Excluir minha conta" só faz `limparSessao()`
(localStorage) apesar da copy prometer exclusão permanente de conta/plano/histórico — resolver junto
com o backend de auth/Ownership.

## Nota
A troca UTC→local re-chaveia dias já gravados no `evk_aderencia` de um usuário existente (o dia de uma
entrada noturna volta ao dia local correto) — descontinuidade única e aceitável no localStorage
transitório; some quando os dados migrarem para o backend.
