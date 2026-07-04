# Handoff — Lote de DFs 2026-07-04 implementado (V8 completo + substituição fiel + menores)

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre** — escritor único é a
> sessão local; decisões novas voltam por você. Branch: `claude/evokorpus-app-dev-9in0hs`.
> Specs lidas do cofre em `9d57f39`: parametros-motor-treino (DF #11/#12/#13 + §Escada de
> modificações) · parametros-motor-substituicao (§2 grupoPrimario + §Famílias) ·
> registro-de-aderencia (streak ¾) · handoff-frontend-v8 · overview. Protótipos V8.1/V8.2/V8.3
> como fonte de fidelidade visual. Determinismo, sem "IA", sem promessa, sem vermelho fora de
> erro real — honrados.

## TL;DR
**Todo o lote entrou.** 7 commits, **258 testes verdes** (era 204; +54 ancorados nas DFs),
typecheck/lint/build limpos, validação Node contra os 163 reais ✅, **E2E Playwright 22/22
cenários com zero erros de console**. As 3 mecânicas V8 (calibração "Muito fácil", favoritos,
escada visual/hints/adoção) estão vivas ponta a ponta; a substituição agora é fiel à F.2
(filtro duro + famílias — e116 devolve vazio honesto); menores fechados.

## 1. O que mudou (por commit)

| Commit | Conteúdo |
|---|---|
| `1a8cbce` | **Dados:** `grupoPrimario` nos 163 (script `injetar-grupo-primario.mjs`, curadoria do autor via standalone, 163/163 verificados, vocabulário fechado de 18) · `modificacoes-isometricos.ts` (B1, sequências/base verbatim) · `familias.ts` (20 famílias verbatim) |
| `8ff61c1` | **Motor:** `EventoProgressao` = união `EventoTreino \| EventoCalibracao`; fold re-semeia base + **zera `dificeisSeguidos`** + `ultimaAcao='recalibrado (base manual)'`; `SessaoHistorico.tipo?:'calibracao'` (aditivo, sem migração) + `salvarCalibracao()` + `sessoesTreino()`; adaptador expõe `degrauAdotadoId`/`exercicioEfetivo` (B3), `sugereDescida`/`variacaoAnterior` (V8.3), `recalibrado` (B7) |
| `719402f` | **Motor:** `escadaComNomes` (lista/seletor com nomes) · **favoritos no montador** (trilho isento da rotação, aparece toda sessão que couber; pool já aplica os duros; `incluidoPorPreferencia`; set vazio → rotina byte-idêntica) |
| `541f5c8` | **Substituição fiel:** preservação vira **FILTRO DURO** (não preserva `grupoPrimario` NEM padrão → fora) + **famílias** no nível 0 · e116 → **vazio sinalizado** (3 combinações exatas — assert duro que quebra quando o conteúdo 164+ chegar) · e9 → `[e11, e15, e10, e12, e13]` (supinos primeiro) · e1 → `[e156, e157, e40]` (= motor standalone verbatim) · skater intocado (teste próprio) · copy honesta do vazio na UI |
| `5572fbc` | **UI V8.3:** `EscadaPill` (Degrau X de Y + dots + lista read-only) no cartão e no detalhe (e7/e90 incluídos — B4) · cartões de sugestão subida/descida com **"Assumir este degrau"** + "Ver variação" (detalhe read-only, sem "Trocar") · hint B7 acima dos chips · overlay do exercício efetivo · salvaguardas Chama/Cargas via `sessoesTreino()` · pausa por dor persiste no histórico |
| `a02670e` | **UI V8.1:** 4ª pílula "Muito fácil" (guiada + manual; custom sem id não calibra) · `CalibracaoModal` com corpos A/B/C/D automáticos (iniciante travado em 6 + cadeado; inter/avançado clamp 5 + aviso âmbar; escada seletora; Atual→Nova base; borda honesta do topo) |
| `1c696ff` | **UI V8.2:** `favoritos` no perfil/sessão (retrocompat `[]`) · estrela cartão+modal (evkStarPop só na transição) · badge · nome clicável · "Meus favoritos" no Editar-perfil · toast Desfazer 4,5 s · `favoritos-elegibilidade.ts` (4 motivos verbatim) · **sem** estrela na guiada |
| `1ad4a69` | **Menores:** placeholder de foto de prato REMOVIDO · aderência **¾ arredondado** (`lib/aderencia.ts`: 3→2, 4→3) + copy "· dos dias com registro" · copy do peso semeado · changelog (5 entradas 04 jul) |
| `5631ba2` | fix: toggle da estrela sincroniza `rotinaDias` (badge/slots re-montados) + E2E 22/22 |

## 2. Saída dos testes (gate final)
```
typecheck ✅ · lint ✅ · vitest: 24 arquivos, 258 testes ✅ · build ✅
validação Node (163 reais): TODAS as checagens ✅ (famílias ligadas C2 e11,e15,e10,e12,e13 ·
  e116 vazio · varredura = EXATAMENTE 3 vazios · determinismo 100× · escadas íntegras)
E2E Playwright (build de produção, 22/22, ZERO erros de console):
  favoritos (estrela→badge→persistência→Meus favoritos→toast/desfazer) · e26 nunca no plano
  do iniciante + motivo honesto · pill Degrau X de Y + lista "Atual" · e116 troca vazia
  honesta · calibração com carga (modal→salvar→evento tipo:'calibracao'→Chama em 0 dias→
  hint "meta recalibrada" 1×) · hint de escada→Ver variação read-only→Assumir este degrau
  (e1 INI → e113 INT exibido no guiado E no cartão — anti-"conserto" respeitado) ·
  aderência "dos dias com registro" · prato sem placeholder
```

## 3. Divergências / decisões de implementação (NÃO são de produto — reviso se discordar)

1. **"Em pausa por dor" (B5) precisou de persistência nova.** A pausa era transiente (só na
   sessão em andamento). Mínimo fiel: a sessão guiada agora grava `pausado: true` no registro
   do exercício do histórico; o motivo deriva da **ocorrência mais recente** (treinar de novo
   sem pausar limpa). Aditivo, sem migração.
2. **B7 com semântica DERIVADA** (sem flag persistida): o hint "Sua meta foi recalibrada…"
   aparece enquanto o **último** evento do exercício for calibração e some no feedback
   seguinte. Nuance: reabrir a guiada 2× **sem treinar** mostra o hint de novo — coerente com
   "alvo = f(histórico)"; se quiser exibição-única literal, precisa de flag local (1 linha).
3. **Rótulos de regressão do `sugereDescida`**: derivado dos literais de `ultimaAcao`
   (`'−…'` / `'desce 1 variação'`) — ancorados em teste; se o motor ganhar rótulos novos de
   regressão, o teste acusa.
4. **Motivo de equipamento único**: o conjunto fechado tem só "pede equipamento de academia";
   um favorito de **casa-com** para quem treina **sem nada** recebe esse mesmo texto (levemente
   impreciso). Se quiser um 5º texto ("pede equipamento de casa"), é decisão sua.
5. **Assert "exatamente 3 vazios"** (teste + script): quebra DE PROPÓSITO quando os exercícios
   164+ (puxar casa-sem) chegarem — o furo deve sumir, não crescer.
6. **Calibração no Histórico**: a entrada `tipo:'calibracao'` fica **visível** na lista do
   Histórico (transparência) — as exclusões travadas são só Chama e Cargas (apliquei também ao
   contador "treinos" da aba Progresso, por coerência com "não é treino").
7. **Corpo A e o chin-up**: exercícios com `equipamentoDetalhe ≠ 'Peso corporal'` caem no corpo
   de carga (derivação `loaded` pré-existente do app) — inclui barra fixa/paralelas. Coerente
   com a progressão atual; se quiser tratá-los como peso corporal com escada, é ajuste na
   derivação (pré-existente, não deste lote).
8. **"Assumir este degrau" como botão-pílula** (borda neon) ao lado do texto-botão "Ver
   variação": o protótipo V8.3 antecede o B3 e não tinha o botão; mantive a família visual do
   cartão de sugestão.
9. **Toast do Editar-perfil**: remoção/desfazer operam no estado local do formulário (persiste
   no "Salvar", como o bloco irmão de alimentos); "sair da tela = confirma" vale dentro do
   formulário — Cancelar do formulário descarta tudo (semântica pré-existente da tela).

## 4. Decisões novas que surgiram (voltam por você — nada foi decidido como produto)
- **Nenhuma decisão de produto pendente deste lote.** Os 9 itens acima são mecânica de
  implementação já resolvida de forma conservadora; reviso qualquer um se você preferir outro
  desenho. O que segue aberto é o que o cofre já lista: conteúdo 164+ (puxar casa-sem / pike),
  animações faceless, e o eventual 5º texto de descompasso (item 4).

## 5. Arquivos
**Novos:** `engine/modificacoes-isometricos.ts(+test)` · `engine/familias.ts(+test)` ·
`engine/escadas.ts§escadaComNomes` · `lib/aderencia.ts(+test)` · `lib/favoritos-elegibilidade.ts(+test)` ·
`components/painel/EscadaDegraus.tsx` · `CalibracaoModal.tsx` · `Favoritos.tsx` ·
`scripts/injetar-grupo-primario.mjs`.
**Alterados:** `data/types.ts` (GrupoPrimario) · `data/exercises.ts` (163× grupoPrimario) ·
`engine/treino.ts` (EventoCalibracao + fold) · `treino-types.ts` (incluidoPorPreferencia) ·
`treino-montador.ts` (favoritos) · `substituicao.ts` (filtro duro + famílias) · `engine/index.ts` ·
`lib/treino-historico.ts` (tipo + salvarCalibracao + sessoesTreino) · `lib/treino-progressao.ts`
(calibração/descida/adoção/B7) · `lib/session.ts` (favoritos) · `Painel.tsx` · `SessaoTreino.tsx` ·
`RegistrarTreino.tsx` · `DetalheModais.tsx` · `EditarPerfil.tsx` · `RegistroRefeicao.tsx` ·
`globals.css` (evkExpand/evkStarPop/evkToastIn) · `changelog/page.tsx` · testes atualizados com
comentários citando as DFs.
