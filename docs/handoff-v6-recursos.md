# Handoff — Integração V6 (institucional + recursos do painel)

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/evokorpus-app-dev-9in0hs`. Commits: `61796f8` (V6.1 institucional) +
> `163efaf` (V6.2 painel). Fontes: os dois pacotes do Claude Design (V6.1 reembolso/faq/
> changelog · V6.2 recursos do painel). Portei fiel (estilos inline, tokens, keyframes `evk*`).

## V6.1 — institucional + landing (commit `61796f8`)
- **/reembolso** — garantia de 7 dias (cartão acento **Pulso**, não vermelho), 3 passos,
  FAQ de cobrança (`FaqAccordion` reusado). Mantém o **selo de rascunho** + marcadores
  `[A validar]` (é jurídico).
- **/faq** — 5 categorias / 11 Q&A com **busca** client (categoria vazia mantém a âncora do
  sumário). Sem selo de rascunho (é informacional). **Ajustei a copy** "não curto"→"não gosto"
  na resposta de Dieta (consistência com o rename já publicado).
- **/changelog** — coluna única, grupos por mês, tags **Novo** (Pulso) / **Melhoria·Correção**
  (Bone neutra) — **sem vermelho**. Pílula "Exemplos ilustrativos de formato".
- **/privacidade** — nova seção **"O que fazemos e o que não fazemos"** no topo (Fazemos =
  tint Pulso; Não fazemos = Bone neutro, **nunca** vermelho). 🔒 **Nunca "sem anúncios"** (respeitado).
- **Landing** — chip **"7 dias de garantia"** (Pulso) → /reembolso + link **Reembolso** no rodapé.
- As 3 rotas novas entraram no rodapé institucional (sem órfãos). O "bug de aba ativa" do
  protótipo **não existia** na nossa versão (derivado do prop, não do DOM) → nada a fazer.

## V6.2 — recursos do painel (commit `163efaf`)
- **Enabler de persistência (necessário p/ os recursos serem reais):** o histórico de treino
  agora **persiste** (`localStorage evk_treinos`, datado + id de exercício; carimbo em
  `concluirSessao`, hidrata no mount). Antes era só em memória (zerava no reload). Transitório,
  mesmo padrão de `evk_sessao`/`evk_aderencia` — migra p/ Supabase (RLS/minimização) na fase de backend.
- **Marcos de constância** — `marcos.ts` puro (+7 testes): conta **dias distintos** de treino,
  **cumulativo, nunca zera**. Cartão completo no **Progresso** + indicador compacto no **Hoje**.
  Estados: progresso · atingido (medalha + glow) · **pós-hiato sem culpa** ("nenhum dia conta
  contra você"). Sem streak punitivo.
- **Progressão de carga** — nova sub-aba **"Cargas"** no Histórico: seletor de exercício +
  curva (maior carga/dia) reusando o gráfico do peso + resumo **passado/presente** + pílula de
  delta (Pulso). 🔒 nunca promessa futura.
- **Notificações** — cartão no **Perfil** + **modal de opt-in** (nada pré-ativado). Toggles
  Treino/Refeição (switch reaproveitado), "Desativar tudo", e preview do reengajamento em
  cartão **claro** (`#F4F3EF`, é o SO que renderiza — proposital). "Agora não" **não reinsiste**.
  `Notification.requestPermission()` best-effort no "Ativar"; **agendamento/entrega real via push
  é backend diferido** (SW push + Edge/cron).

## Qualidade
`typecheck` · `lint` · **165 testes** (+7 marcos) · `build` — verdes. E2E (Playwright, **zero
erros de console** + screenshots fiéis comparados aos `.dc.html`): as 5 telas institucionais
(reembolso, faq busca, changelog sem vermelho, privacidade fazemos/não fazemos, landing chip/rodapé);
marcos no Hoje+Progresso **persistindo no reload**; Cargas (curva + delta +14 kg + sem promessa);
notificações (opt-in → toggles → "Agora não" não reinsiste).

## Pendências que voltam por você

### `[A validar]` (jurídico — trocar antes de publicar)
- [ ] Prazo/condições do **CDC** para a garantia (Reembolso).
- [ ] Prazo do **banco/operadora** até o estorno aparecer (Reembolso, FAQ).
- [ ] **Valores/ciclo** e **e-mail do DPO** (reusados no FAQ).

### Decisões de produto pendentes (do handoff V6.2)
- [ ] **O que vem depois do marco de 30 dias?** (novo nível 60/90 ou 30 vira o teto). Hoje capo em 30/30.
- [ ] **Definição exata de "dia de treino registrado"** (uso hoje: dia com ≥1 sessão guiada concluída).
- [ ] **Exercícios "iguais" após troca permanente** (Cargas): manter séries separadas ou unificar.

### Conteúdo (o cofre alimenta)
- [ ] **FAQ completo (~30 Q&A)** — entreguei o padrão + 11 exemplos; faltam as demais.
- [ ] **Changelog real** — hoje 5 itens ilustrativos; alimentar a cada release.
- [ ] Nota na **/privacidade** citando o provedor de medição (Vercel Analytics, cookieless).

## Arquivos
**Novos:** `src/app/{reembolso,faq,changelog}/page.tsx`, `src/components/legal/FaqBusca.tsx`,
`src/lib/{marcos(+test),treino-historico,notificacoes}.ts`,
`src/components/painel/{GraficoLinha,MarcoConstancia,CargasHistorico,Notificacoes}.tsx`.
**Alterados:** `InstitucionalShell.tsx`, `privacidade/page.tsx`, `app/page.tsx` (V6.1);
`Painel.tsx`, `SessaoTreino.tsx` (V6.2).
