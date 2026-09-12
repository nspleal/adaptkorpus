# Handoff — Páginas institucionais V3 (Termos/Privacidade/Aviso/Suporte/Ebook)

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/adaptkorpus-app-dev-9in0hs`. Commits: `896d1a4` (porte) + `cd77951` (correções da revisão).
> Origem estética: `V3_front_end_evoK.zip` → `design_handoff_institucional/Adaptkorpus Institucional.dc.html`.

## O que entrou

O V3 trouxe o **design de alta fidelidade** das páginas institucionais (eu já tinha versões
simples da etapa anterior — foram **substituídas** pelo design fiel do V3) + a nova **/ebook**.

- **Casca institucional** (`InstitucionalShell`): header sticky com blur em 2 linhas (logo +
  "Voltar ao site"; "Institucional" + sub-nav de pílulas com a página ativa em Pulso `#BDFF00`
  + link ghost "Ebook"); footer Carvão com cross-links + disclaimer canônico + 18+ + copyright.
  Backdrop ambiente (`evkDrift`), controlável por `showAmbient`.
- **LegalLayout**: selo de rascunho pulsante, título + subtítulo + "Última atualização [A validar:]",
  trajetória neon que se desenha, e **grid de leitura** (sumário 250px sticky + coluna 72ch) com
  **scroll-spy** (IntersectionObserver) destacando a seção ativa em Pulso. Props `draftMode`,
  `readingScale`, `showAmbient`. Responsivo: **<880px** empilha e o sumário recolhe (CSS).
- **Termos / Privacidade / Aviso / Suporte**: seções e copy **verbatim do V3**; marcadores
  `[A validar:]` como pílulas tracejadas **visíveis** (decisões pendentes).
- **Suporte**: FAQ acordeão (1º aberto), formulário de contato (UI only → nota de demonstração),
  3 cards legais.
- **/ebook** (nova): capa ilustrativa flutuante (faceless), 4 bullets honestos, R$ 27 compra
  única, CTA `data-checkout="ebook"`, "Conheça o app".
- **Landing**: religados Ebook (footer + faixa "Ver o ebook") → `/ebook`.

Rotas: `/termos` · `/privacidade` · `/aviso` · `/suporte` · `/ebook`.

## Travas de copy mantidas (§8.3)
Nunca "IA" (só negada/"regras adaptativas"); sem promessa de resultado; kcal = "ponto de
partida"; 18+; crédito TACO (NEPA/UNICAMP)/USDA; selo de rascunho + `[A validar:]` visíveis;
disclaimer canônico; neon só no escuro.

## Revisão adversarial (workflow, 13 agentes)
Rodei uma revisão multi-dimensão (fidelidade, travas de copy, LGPD, correção/a11y) com
verificação independente de cada achado + crítico de completude. Resultado: **8 confirmados + 1 lacuna**.

**Corrigidos (commit `cd77951`):**
- Formulário de contato: **foco visível** (borda neon + anel) e **labels associados**
  (htmlFor/id) — WCAG 2.4.7 / 1.3.1 / 4.1.2.
- Scroll-spy passa a marcar a **última seção** ao chegar ao fim da página.
- Prop **`showAmbient`** implementada (lacuna §7).
- **ARIA** no FAQ (aria-controls/region) e na FAQ da landing (aria-expanded).

**Pulados (com justificativa):**
- `evkFloat` (−14 vs −12px) e `evkBlink` (.25 vs .3): keyframes **compartilhadas com a landing**
  — mudar quebraria a V1/V2 por diferença imperceptível.
- Disclaimer do cartão Aviso: a implementação usa o **canônico §8.1** (mais correto que o
  próprio protótipo, que omite "a orientação de").
- Contraste .4 do disclaimer no rodapé: **fidelidade deliberada** ao protótipo (idêntico à
  landing); o disclaimer aparece em **contraste pleno** na página /aviso.

## Qualidade
`typecheck` · `lint` · **130 testes** · `build` verdes. E2E (Playwright): scroll-spy, FAQ,
formulário (foco/labels/aria), responsivo mobile — **zero erros de console**.

## Pendências que voltam por você (cofre) — checklist `[A validar:]`
- [ ] Redação **jurídica final** (Termos/Privacidade/Aviso) — remover selo de rascunho ao fechar.
- [ ] Data de "Última atualização"; valores/ciclo de assinatura; política de reembolso;
      limitação de responsabilidade; **foro**; **razão social/CNPJ**.
- [ ] Processador de pagamento; prazos de retenção; **DPO** (nome + e-mail de privacidade);
      lista de operadores/subprocessadores.
- [ ] **E-mail de suporte** real; integração de envio do formulário.
- [ ] **Ebook**: título/conteúdo final + checkout real (`data-checkout="ebook"`).
- [ ] Decidir se as páginas legais viram **fonte no cofre** (copy curada lá, app só renderiza).
- [ ] (A11y, opcional) Revisitar globalmente o contraste do disclaimer de rodapé (landing + institucional).

## Arquivos
**Novos:** `src/components/legal/{InstitucionalShell,LegalLayout,FaqAccordion,ContactForm,ui}.tsx`,
`src/app/ebook/page.tsx`. **Reescritos:** `src/app/{termos,privacidade,aviso,suporte}/page.tsx`.
**Alterados:** `src/app/page.tsx` (relink ebook), `src/app/globals.css` (grid legal, toc, faq, foco).
