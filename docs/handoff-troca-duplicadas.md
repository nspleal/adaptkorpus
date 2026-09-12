# Handoff — Bug "3 opções iguais" na troca + lacuna de variedade (dieta restritiva)

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/adaptkorpus-app-dev-9in0hs`. Commit do fix: `75b0e06`.
> Origem: teste manual do usuário no seletor **Trocar** (prato) mostrando opções idênticas.

## Sintoma
O modal "Trocar" exibia as **3 opções iguais** (ex.: base "Mamão com aveia…" → 3× "Aveia com
banana e linhaça"; base "Omelete de espinafre" → 3× a mesma). Acontecia muito em **dietas
restritivas** (vegana/vegetariana) e no botão "gerar mais variedade".

## Diagnóstico (dois problemas distintos)

### A) Bug de programação — CORRIGIDO nesta sessão
`substituirPrato` / `substituirExercicio` devolvem **um** melhor candidato e, por design,
**relaxam o "gosto"/variedade no fallback** (melhor sugerir um repetido do que nada). O modal
chamava essas funções **em laço** (3×) excluindo via *gosto* os já achados — mas, como o gosto
é relaxável, quando sobravam poucos elegíveis o motor **ignorava a exclusão e repetia** o mesmo
prato. O laço empurrava a duplicata. (Determinismo e regras do motor **intactos** — o motor
sempre esteve certo; o erro era montar a *lista* em cima de uma função de *escolha única*.)

**Fix:** helpers PUROS no motor — `listarSubstituicoesPrato` / `listarSubstituicoesExercicio`
— que deduplicam por id e **param quando o pool elegível se esgota**. O Painel passou a usá-los;
"gerar mais" recicla o ciclo ao esgotar (sem botão morto); o modal ficou honesto (subtítulo
reflete 1/2/3 opções; sem candidato → "Sem alternativa elegível agora"). +5 testes de regressão.

### B) Lacuna de dados/regra — DECISÃO DE PRODUTO (volta para você)
Mesmo com o fix, **dieta vegana** tem pouquíssimos substitutos elegíveis por slot. O filtro
**duro que barra é o PISO DE PROTEÍNA do dia**, não a janela de kcal. Medição (perfil F, saúde,
70 kg, vegana — piso 84 g/dia, janela 2082–2301 kcal, escala 0,5–3×):

| Slot | Pratos veganos no slot | Passam | Fora da janela kcal | **Abaixo do piso de proteína** |
|---|---|---|---|---|
| Café | 2 | 1 | 0 | **1** |
| Almoço | 13 | **0** | 0 | **13** |
| Lanche | 4 | **0** | 0 | **4** |
| Jantar | 10 | 1 | 0 | **9** |

Ou seja: os pratos vegetais existem no banco, mas trocar derruba a proteína do dia abaixo do
piso → o motor (corretamente) os rejeita. Para referência, perfis onívoro/vegetariano têm pool
saudável (café 4–5, almoço 12, lanche 5–9, jantar 11–12 opções distintas).

**Perguntas para travar no cofre** (qualquer mudança de número/regra precisa vir daqui):
- [ ] **Cobertura de receitas:** adicionar pratos veganos de **alta proteína** (tofu firme/defumado,
      seitan, soja texturizada, grão-de-bico/lentilha em porção maior) por slot — sobretudo
      almoço/lanche/jantar — para o vegano ter ≥3 trocas reais?
- [ ] **Regra do piso na troca:** o piso de proteína do dia deve continuar **duro por troca
      isolada**, ou a troca pode **rebalancear as outras refeições** (ex.: subir proteína em outro
      slot) para liberar mais opções sem furar o piso diário?
- [ ] **Janela de escala:** a faixa `ESCALA_PORCAO` (0,5–3×) é suficiente, ou pratos veganos
      ricos em carbo deveriam poder escalar mais para alcançar o piso? (impacto em porção realista).

> Nada disso foi alterado no código — são números/políticas da spec. O fix de A só tornou o app
> **honesto** (mostra 1–2 opções reais ou "sem alternativa") em vez de fingir 3 com clones.

## Qualidade
`typecheck` · `lint` · **135 testes** (130 + 5 de regressão) · `build` — verdes. E2E (Playwright),
**zero erros de console**: onívoro (3 distintas + "gerar mais" cicla 0→1→2→0…) e vegana (slot sem
elegível mostra "Sem alternativa elegível agora", sem duplicata, sem botão morto).

## Arquivos
**Alterados:** `src/lib/engine/substituicao.ts` (novos `listarSubstituicoes*`),
`src/lib/engine/index.ts` (export), `src/lib/engine/substituicao.test.ts` (+5 testes),
`src/components/painel/Painel.tsx` (modal usa os helpers; "gerar mais" cicla; copy honesta).
