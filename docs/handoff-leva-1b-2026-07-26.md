# Ficha de handoff — Leva 1B (relógio do mesociclo + aba Dieta no celular)

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

**Data:** 2026-07-26 · **Branch:** `claude/evokorpus-app-dev-9in0hs` · **Gate:** verde
(typecheck · lint · **396 testes** · build) + medição Playwright a 390/360 px.
Fonte: cofre `outputs/plano-pos-feedback-beta-2026-07-26` §Complemento (Leva 1B) +
`conceitos/parametros-motor-treino-evokorpus` §"Fiquei doente". **Esta ficha volta p/ a
sessão local arquivar** — nada foi escrito no cofre.

---

## 📣 NOTA DO DEPLOY — ler antes de avisar os amigos

**O contador de semana de alguns testadores VAI DIMINUIR** (ex.: "Semana 4/6" → "Semana
2/6"). Isso é **a correção aparecendo**, não perda de dado: a semana passou a contar as
semanas em que a pessoa **treinou**, e não as que o calendário passou. Quem estava sendo
empurrado para uma semana que nunca treinou volta para a semana real.

**Nada reseta** (DF 2026-07-05 — contas do beta migram sem reset): histórico, Chama, pesos,
aderência e perfil ficam intactos; só o **número da semana** se corrige, e ele já era
derivado. Quem treinou toda semana **não vê diferença nenhuma**.

---

## Bloco 1 — Relógio do mesociclo (mitigação interina)

### O que passou a valer
```
semana = ((nº de semanas-calendário com ≥ 1 sessão registrada, ANTERIORES à corrente) % 6) + 1
```
`semanaDoCiclo(inicio, hoje, datasSessao)` — segue **função pura** de (âncora, hoje, datas),
sem estado novo e **autocorrigindo retroativamente**. A semana **corrente é excluída de
propósito**: se contasse, a prescrição saltaria no instante do 1º registro da semana
(testado). Sessão **manual conta igual à guiada** — o Painel alimenta o relógio com
`sessoesTreino(sessoes)`, que preserva `manual: true` e descarta só eventos
(calibração/sinal de fadiga).

### O nó do deload reativo — resolvido como o cofre pediu
O truque antigo (`novaAncora = hoje − 35 d`) só funcionava com derivação por calendário;
com contagem por atividade ele **não deriva mais semana 6**. Agora:
- fadiga → `{ semanaEfetiva: 6, deload: true, novaAncoraISO: hoje+7, novoDeloadAteISO: hoje+7 }`;
- enquanto `hoje < deloadAte`, a **marca explícita** manda (semana 6, alívio) e **nada é
  regravado** (sem loop de escrita);
- a âncora nova é o **FIM** do alívio (não `hoje`) — assim, se a pessoa treinar durante o
  alívio, aquele bucket **não vira semana de rampa**, e o ciclo novo começa no piso. Testado.

**Estado novo introduzido — consciente:** `deloadAte` (ISO) no jsonb `preferencias`
(`PerfilResumo` + mapper + `perfilResumoSchema`). **Zero SQL** (a 0005 absorve). Marca
vencida de ciclo antigo é ignorada (teste).

### 🐛 Bug que a mitigação teria criado — achado e travado
Ao fim do alívio de 7 dias, o **próprio `sinal_fadiga` que o disparou ainda estava dentro
da janela de 7 dias** (e os "difícil" dentro da de 14) → o alívio **re-dispararia a si
mesmo, para sempre**. Corrigido em `sinaisFadigaDoHistorico(historico, hoje, desdeISO?)`:
a evidência **anterior à âncora** não conta — e como a âncora nova é o fim do alívio, tudo
que o causou fica atrás dela. Isso também conserta um caso pré-existente (os "difícil"
antigos podiam re-disparar um alívio logo após o anterior). 4 testes cobrem o loop.

### Trava de tom — cumprida
Semana que não avança **não gera mensagem nenhuma**. Nenhuma copy foi adicionada; o
contador simplesmente segura em silêncio ("ausência não fala").

### ⚠️ O que a mitigação NÃO faz
Quem parou 3 meses volta **na mesma semana, com o mesmo volume**. Ela impede a rampa de
**subir sozinha** (o defeito morre), mas **não é retomada suave** — isso segue sendo a spec
**2.3**, dependente da pesquisa de destreino. Nenhuma copy do app sugere o contrário.

### Testes (12 novos)
Os 7 casos do cofre + extras: conta nova sem sessão → semana 1 (inclusive 35 d parado) ·
treinou 1 semana e pulou a seguinte → **segura** (2 e 3 semanas depois também) · 5 semanas
com treino → semana 6 · treinar na 6 → ciclo novo na 1 · 1ª sessão da semana corrente **não**
muda a semana · várias sessões na mesma semana contam uma vez · sessão anterior à âncora
não conta · parado 6 semanas **não** deloada sozinho · alívio reativo sem `hoje − 35 d` ·
durante o alívio não reancora · fim do alívio → semana 1 mesmo tendo treinado nele · marca
vencida ignorada · loop-guard (4) · sessão manual move o relógio.

## Bloco 2 — Aba Dieta no celular

**Medido antes:** a ~390 px sobravam ~125 px de nav → cabiam "Hoje" e parte de "Treino";
**"Dieta" ficava fora da viewport**, sem affordance (barra de rolagem é overlay no mobile).

**Correção barata (sem redesenho de navegação)** — `globals.css` + 3 `className` no Painel,
tudo dentro de `@media (max-width: 560px)`:
- a marca **cede espaço**: some o wordmark "evokorpus", fica o símbolo;
- respiro do topo e das abas menor (`padding`/`font-size`);
- `minWidth: 0` na nav (deixa o flex encolher de verdade);
- **affordance**: `mask-image` esmaece a borda direita — o que passa dela desbota em vez de
  ser cortado a seco, sinalizando "tem mais para o lado".

**Resultado medido:** nav 125 px → **253 px** a 390 px e **223 px** a 360 px; em ambos
**"Hoje · Treino · Dieta" ficam visíveis SEM scroll** ✅, com a 4ª aba desbotando na borda.
**Desktop intocado** (≥ 561 px): 6 abas visíveis, wordmark de volta, mesma altura de aba.

## Verificação executada
- Gate completo verde (396 testes).
- Playwright: nav medida a 390 e 360 px (visibilidade por `getBoundingClientRect`), desktop
  1280 px conferido, screenshot do topo a 390 px.
- Fora do escopo, registrado: o `CheckBox` dos consentimentos é um `<div>` sem
  `role="checkbox"`/`aria-checked`/teclado (lacuna de acessibilidade do aceite, p/ leva
  futura). Aviso de build `process.version` do `@supabase/ssr` no Edge é **pré-existente**.

## Checklist ao vivo (autor)
1. Conta que ficou parada: o contador **diminui** e o volume/RIR não sobem mais sozinhos.
2. Botão de fadiga → alívio na hora; 7 dias depois → **Semana 1/6** com volume no piso,
   **sem** entrar em alívio de novo (era o loop).
3. Treinar 1 semana, pular a seguinte, voltar → a semana **não** andou.
4. Celular (~390 px): "Dieta" visível sem arrastar; a aba seguinte desbota na borda.
5. Avisar os amigos usando a **Nota do deploy** acima.
