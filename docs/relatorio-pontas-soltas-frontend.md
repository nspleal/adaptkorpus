# Relatório — Auditoria de pontas soltas do front-end + integrações feitas

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

> **Insumo para o cofre (obsidian).** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/adaptkorpus-app-dev-9in0hs`. Commit desta entrega: `cfb750c`.
> Contexto: varredura completa do front-end procurando botões/abas/links "soltos"
> (só visuais, sem ação) e o que faltava para a experiência ficar coesa — e a correção deles.

---

## 1. Auditoria — o que estava solto (antes)

### A) Links/botões só-visuais, sem ação (corrigíveis no front)
- **Landing → footer**: "Política de privacidade", "Termos de uso", "Contato" e "Ebook" → `href="#"` mortos.
- **Landing → banner ebook**: "Ver o ebook" → `href="#"`.
- **/conta → Dados da conta**: botões **"Alterar"** (nome) e **"Alterar e-mail"** sem `onClick`.
- **/conta → Privacidade**: **"Baixar meus dados"** sem `onClick`.
- **/conta → rodapé legal**: "Termos / Política / Aviso / Suporte" sem destino.
- **Painel → aba Perfil**: mesmos links legais com `href="#"`.
- **Gravidade**: os **consentimentos do cadastro citam** Termos, Aviso e Política (LGPD), mas
  **nenhuma dessas páginas existia** — links mortos em 3 telas. Obrigação legal, não só estética.

### B) Mock à espera de backend (esperado — NÃO é "solto")
- `/login` (inputs não controlados; "Entrar" navega), `/cadastro` (cartão + submit via
  `sessionStorage`), `/conta` modal "Atualizar cartão" (não salva), "Reenviar e-mail".
- APIs `/api/dieta|treino|substituir|catalogo` existem, mas a UI calcula client-side
  (importa o motor direto) — decisão de quando migrar para o servidor.
- Atributo `data-checkout="kiwify"` nas CTAs (placeholder de integração).
→ Tudo isso cai nas **20 tarefas de segurança/Auth/Kiwify** já levantadas.

### C) Faltava para "experiência completa"
- Páginas legais reais; tratamento de **404/erro** com a marca; edição de nome/e-mail;
  exportação de dados (LGPD).

---

## 2. O que foi integrado agora (commit `cfb750c`)

### Páginas institucionais/legais (novas rotas)
- **`/termos`**, **`/privacidade`**, **`/aviso`**, **`/suporte`**.
- Componente compartilhado `src/components/legal/LegalLayout.tsx` (header com logo, voltar,
  rodapé com cross-links + disclaimer). Selo **"Rascunho — conteúdo em validação jurídica"**.
- Conteúdo **estruturado e ancorado nos princípios do cofre** (educacional, 18+, sem promessa,
  fail-safe, LGPD: minimização/consentimento/direitos do titular). Marcações `[A validar:]`
  onde depende de decisão (valores, prazos, DPO, reembolso).
- ⚠️ **A redação final é jurídica e volta por você** para o cofre — não tratar como texto final.

### Religação de TODOS os links legais mortos
- Landing footer, `/conta` (rodapé) e Painel→Perfil agora apontam para as 4 páginas reais
  (via `next/link`). Footer: coluna "Legal" inclui as 4; **"Contato" → `/suporte`**.

### /conta — botões que agora funcionam
- **"Alterar" / "Alterar e-mail"** → modal de edição (atualiza o valor exibido).
- **"Baixar meus dados"** → exporta **`adaptkorpus-meus-dados.json`** no navegador
  (`src/lib/export.ts`). É **stopgap**: exporta os dados da conta visíveis; o export completo
  (perfil + plano + histórico do servidor) é a tarefa **Ownership-4**, com aviso no próprio JSON.

### 404 e erro com a marca
- `src/app/not-found.tsx` (404 "Essa página saiu da rota" + Voltar/Suporte) e
  `src/app/error.tsx` (error boundary; loga só a mensagem técnica, **nunca dado sensível** —
  alinhado a Hardening-2).

---

## 3. Verificação

- `typecheck` ✅ · `lint` ✅ · **130 testes** ✅ · `build` ✅ (rotas novas presentes).
- **E2E (Playwright)**: páginas legais (200), 404 (status 404 + UI), `/conta` "Alterar nome"
  (modal + atualização), "Baixar meus dados" (download `adaptkorpus-meus-dados.json`),
  navegação conta→privacidade. **Sem erros de console** (o único log "404 resource" é a própria
  página de teste inexistente respondendo 404 — esperado).

---

## 4. Ainda solto / decisões que voltam por você (cofre)

- [ ] **Redação jurídica final** de Termos / Privacidade / Aviso (hoje rascunho). Definir:
      valores e ciclo de assinatura, política de reembolso, prazos de retenção, **DPO/encarregado**
      e canal oficial, CNPJ/razão social (rodapé mostra `[CNPJ]`).
- [ ] **E-mail de suporte**: usei placeholder `suporte@adaptkorpus.app` — confirmar o real.
- [ ] **Ebook**: a landing menciona "ebook por R$ 27" e tem "Ver o ebook" ainda em `href="#"`
      (removi só o link do footer). Precisa de **decisão de produto**: página/checkout do ebook,
      ou remover a menção. Não inventei destino.
- [ ] **Export LGPD completo**: hoje é parcial/client-side; o real (perfil + plano + logs) exige
      backend → **Ownership-4**.
- [ ] Confirmar se as páginas legais devem virar **fonte no cofre** (texto curado lá e o app só
      renderiza), mantendo o cofre como fonte de verdade da copy.

---

## 5. Arquivos tocados

**Novos:** `src/app/termos/page.tsx`, `src/app/privacidade/page.tsx`, `src/app/aviso/page.tsx`,
`src/app/suporte/page.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`,
`src/components/legal/LegalLayout.tsx`, `src/lib/export.ts`.
**Alterados:** `src/app/page.tsx` (footer), `src/app/conta/page.tsx` (edição + export + links),
`src/components/painel/Painel.tsx` (links do Perfil).
