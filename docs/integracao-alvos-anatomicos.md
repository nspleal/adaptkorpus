# Integração da classificação anatômica prática (mapa dos 168 ids)

Origem: pacote externo `mapa-consumo-motor-168-20260915`
(`MAPA-MOTOR.json`, schema `adaptkorpus.alvos-operacionais.v1`,
SHA-256 `1db098c3b1a5f9aa8e2635f88d9a4daae09d0fb8429e26b79111134375971360`).
Base do app: `origin/main` = `64c2e7b064265118b3c82cab8d3a4e4a78810f0f`.

**O que este mapa responde:** quais alvos anatômicos cada exercício aborda **pela sua ação**.
**O que ele não responde:** se a dose é suficiente, qual músculo predomina, e se algum
exercício é preferível a outro. É anatomia aplicada à execução — não preferência regional
universal, não garantia de estímulo.

## 1. O que entrou

| Camada | Arquivo | Papel |
|---|---|---|
| Contrato | `src/lib/data/alvos-anatomicos-tipos.ts` | Tipos e vocabulário. Escrito à mão. |
| Dados (motor) | `src/lib/data/alvos-anatomicos-dados.ts` | **GERADO.** 168 ids, 44 alvos, papéis e condicionais. 41 KB. É o único arquivo desta integração no bundle do cliente. |
| Dados (tela) | `src/lib/data/alvos-anatomicos-fontes.ts` | **GERADO.** 17 fichas de fonte, 59 regras com justificativa, descritores, ênfases, 6 limites de discriminação. 76 KB, **fora do bundle** — só a rota o lê. |
| Leitura | `src/lib/data/alvos-anatomicos.ts` | Porta única. Porte fiel de `consulta.py`: mesmas recusas, mesmas saídas. |
| Uso no motor | `src/lib/engine/cobertura-anatomica.ts` | Classe de intercâmbio, passe de cobertura e diagnóstico. |
| Gerador | `scripts/gerar-alvos-anatomicos.mjs` | Lê o pacote e escreve os dois módulos. `--check` prova idempotência. |
| API | `src/app/api/catalogo/alvos-anatomicos/route.ts` | Lista (proveniência + 44 alvos + limites) e detalhe por id. |
| UI | `src/components/painel/AlvosAnatomicos.tsx` | Bloco "O que este exercício aborda", no detalhe e no seletor. |
| Guards | `alvos-anatomicos.test.ts` · `cobertura-anatomica.test.ts` · `alvos-anatomicos-render.test.ts` | **112 testes novos** (40 + 54 + 18). |

Um ponto de contato no motor: `alocarSemana` ganhou um **passe final** e dois campos opcionais
(`nivel`, `relatoCoberturaAnatomica`). `treino-montador.ts` só passa `perfil.nivelExperiencia`.
Nenhuma outra linha do motor mudou.

## 2. Relação com a integração muscular anterior

A `trabalho/integracao-classificacao-muscular` (`8cb647f`) **não está em produção**: ela parte
de `67f5368` (PR #10) e a `main` já andou além dela (PR #11, `64c2e7b`). Por isso ela não foi
importada — trazê-la junto seria empurrar um checkout antigo por cima da produção, que não é o
que esta tarefa pede.

O que foi **reaproveitado dela** é o desenho, que continua certo e que a faz encaixar sem
conflito quando ela chegar:

| Dela | Aqui |
|---|---|
| `musculatura-tipos` / `-dados` / `musculatura.ts` | `alvos-anatomicos-tipos` / `-dados` / `-fontes` / `alvos-anatomicos.ts` |
| Dado gerado **fora** de `exercises.ts` (que se sobrescreve na regeneração do xlsx) | idem |
| Rota própria + `<details>` que carrega sob demanda | `/api/catalogo/alvos-anatomicos` + mesmo padrão |
| Fonte **por afirmação**, com limite ao lado | Fonte por **regra**, com ação, natureza e justificativa |
| "Campo vazio é ausência de AFIRMAÇÃO, nunca de fenômeno" | "Condicional pendente não cobre e não nega" |
| Guard "o módulo não exporta peso/quota/score" | O mesmo guard, ampliado (§7) |

As duas respondem perguntas diferentes e **convivem**: aquela diz o que a pesquisa sustenta
sobre um exercício; esta diz quais alvos a ação dele aborda. Nenhuma sobrescreve a outra, e os
nomes não colidem.

## 3. Conferência do pacote contra a base

- **18/18 arquivos** do pacote batem com `HASHES.json`.
- **23/23 testes** de `testar.py` passam no pacote, como entregue.
- `ENTRADAS.json` referencia `…/adaptkorpus-integra-musculatura/src/lib/data/exercises.ts`
  com SHA-256 `22a936a1…`. O `exercises.ts` de `origin/main` tem **exatamente esse hash**: o
  catálogo não andou entre o pacote e a base.
- Os **168 ids** de `CATALOGO-168.json` são os 168 de `exercises.ts`, e os 12 campos
  (`nomePt`, `nomeEn`, `grupoMuscular`, `grupoPrimario`, `padraoMovimento`, `nivel`, `tipo`,
  `equipamento`, `equipamentoDetalhe`, `local`, `tier`, `comoFazer`) coincidem em **todos** —
  zero divergências. `grupoCatalogo` do mapa == `grupoPrimario` do app em 168/168.

## 4. Como a cobertura entra na seleção

Os alvos desejados de um dia são os alvos dos grupos que **o template do dia já previa**.
Nada é acrescentado: os três grupos do pacote que não são grupo do catálogo — `adutores`,
`flexores_quadril`, `perna_anterior` — nunca viram obrigação, e sinergista não vira grupo novo.

O passe roda **por último**, depois de tudo estar decidido (slots por dia, grupo de cada slot,
favoritos, padrões contados, foco, reservas, dias curtos). Dentro de cada slot ele troca o
exercício por outro do **mesmo grupo** e da **mesma classe de intercâmbio**, e só quando o
outro aborda um alvo do dia que **nenhum outro slot aborda**.

### Classe de intercâmbio — a trava

Dois exercícios da mesma classe são indistinguíveis para todo o resto do motor:

`padraoMovimento` · `tipo` · `temCarga` · isometria (com a faixa de hold do nível) ·
`UNILATERAL_DOIS_LADOS` · **conjunto de grupos secundários**

Os cinco primeiros fixam descanso e execução; o sexto fixa o crédito ponderado de 0,5, que é
o que alimenta o déficit e decide **quantos** slots cada grupo recebe.

### Duas versões que foram medidas e descartadas

1. **Desempate dentro de `escolher`.** A escolha diferente movia o cursor de rotação e os
   usados do dia; os slots seguintes caíam em candidatos de outra classe. Medido em
   6d/75 min avançado: **32 → 34 slots, 124 → 130 séries**, e em `Ombros +
   complementares` um slot de `e54` (isolado, 90 s) virava `e119` (puxar, 180 s) — +380 s.
   Cobertura anatômica comprando volume e tempo. Descartada.
2. **Trocar também em empate**, usando a ação classificada como critério. Em Prioridades 4d
   trocava `e22` (barra fixa supinada) por `e162` (remada com elástico) num perfil de academia
   **sem ganhar um alvo sequer**. O pool vem ordenado por popularidade (tier↑, id); mexer nele
   de graça piora a escolha em troca de nada. Descartada — a ação classificada ficou como
   **desempate** entre candidatos que já ganham o mesmo número de alvos novos.

## 5. Antes × depois, medido

`origin/main` (`64c2e7b`, worktree limpo) × esta branch, mesmos perfis, mesma semana (3).
O nome do cenário é o **perfil**; a divisão sai do motor (`divisaoPreferida: 'prioridades'`
no primeiro, `auto` nos demais).


| Cenário | Slots | Séries | Duração máx (Σ) | Descanso mín | Alvos abordados |
|---|---|---|---|---|---|
| Prioridades 4d/60 min | 24 → 24 | 93 → 93 | 13160 → 13160 s | 60 → 60 s | 26 → **28** |
| 6d/75 min, avançado | 32 → 32 | 124 → 124 | 19970 → 19970 s | 60 → 60 s | 26 → **30** |
| 4d/60 min, intermediário | 23 → 23 | 89 → 89 | 12280 → 12280 s | 60 → 60 s | 27 → 27 (idêntico) |
| 3d/30 min, intermediário | 12 → 12 | 37 → 37 | 5180 → 5180 s | 60 → 60 s | 21 → 21 (idêntico) |
| 2d/20 min, iniciante | 6 → 6 | 18 → 18 | 2220 → 2220 s | 60 → 60 s | 14 → 14 (idêntico) |
| Foco ombros (compensa peito) | 25 → 25 | 93 → 93 | 12880 → 12880 s | 60 → 60 s | 27 → 27 (idêntico) |
| Foco bíceps (compensa costas) | 25 → 25 | 93 → 93 | 12740 → 12740 s | 60 → 60 s | 27 → 27 (idêntico) |
| Casa com halteres+elástico, 3d/45 min | 15 → 15 | 59 → 59 | 7740 → 7740 s | 60 → 60 s | 26 → 26 (idêntico) |
| Casa sem equipamento, 3d/40 min, iniciante | 14 → 14 | 42 → 42 | 6540 → 6540 s | 60 → 60 s | 18 → 18 |
| 5d/90 min, avançado | 27 → 27 | 104 → 104 | 17660 → 17660 s | 90 → 90 s | 26 → **30** |

**Nenhuma duração de dia mudou** (mín e máx, dia a dia, nos 10 cenários). Slots, séries e
descanso idênticos. Nenhum alvo perdido em lugar nenhum. Cinco cenários saem **byte a byte
iguais** ao de antes.

Foram **10 trocas em 8 dias**, de 38 dias somados nos dez cenários. Por dia, o que o dia passou a abordar:

| Cenário · dia | Trocas | Alvos que o DIA ganhou |
|---|---|---|
| Prioridades · Peito + Ombros | `e52` Elevação lateral → `e107` Crucifixo invertido na máquina · `e53` Elevação lateral na polia → `e99` Elevação frontal na polia | `da` Deltoide anterior · `dp` Deltoide posterior |
| 6d/75 · Peito + Tríceps | `e4` Abdominal (crunch) → `e148` Inseto morto | `oe` · `oi` Oblíquos · `ta` Transverso |
| 6d/75 · Ombros + complementares | `e52` → `e98` Elevação frontal · `e5` Abdominal na polia → `e8` Roda abdominal | `da` · `oe` · `oi` |
| 6d/75 · Complementares | `e6` Abdominal na máquina → `e8` Roda abdominal | `oe` · `oi` |
| 5d/90 · Pernas | `e4` → `e148` | `oe` · `oi` · `ta` |
| 5d/90 · Ombros + Braços | `e52` → `e107` | `dp` |
| 5d/90 · Complementares | `e5` → `e8` | `oe` · `oi` |
| Casa sem equipamento · Full-body C | `e149` Abdominal bicicleta → `e148` Inseto morto | `ta` |

Nos outros 30 dias, nenhuma troca: ou o dia já abordava tudo o que os alvos dos seus grupos
pediam, ou não havia candidato da mesma classe que abordasse algo novo.

## 6. Diagnóstico do que não foi identificado

`diagnosticarDia` devolve, por alvo descoberto, um destes motivos — e **nenhum é veredito**:

| Motivo | Significa |
|---|---|
| `sem_candidato_no_catalogo` | nenhum exercício do catálogo aborda este alvo diretamente, em condição nenhuma |
| `sem_candidato_elegivel` | há candidato no catálogo, mas nenhum passou por equipamento/nível |
| `condicao_de_execucao_nao_declarada` | só candidato condicional, e a execução não foi declarada (vem com a condição que resolveria) |
| `slots_do_dia_esgotados` | havia candidato elegível e os slots do dia acabaram antes |

Casos reais medidos: `mu` (multífido) e `it` (tibial anterior) são
`sem_candidato_no_catalogo` — o pacote já os registra em `limitesDeDiscriminacao`, e **nenhum
exercício foi criado para esconder a ausência**. Em casa sem equipamento, `gd`/`gn` (glúteo
médio/mínimo) e `ts` (trapézio superior) saem como `sem_candidato_elegivel`.

O diagnóstico **não** entra em `rotina.avisos`, não bloqueia o editor e não diz que o treino é
ruim. É consultado sob demanda.

## 7. O que a integração não faz — e o que garante que continue assim

| Não faz | Garantido por |
|---|---|
| Aumentar duração, volume, séries ou reduzir descanso | classe de intercâmbio + teste ③ (duração idêntica desfazendo as trocas) |
| Criar peso de ativação ou hipertrofia | teste ⑤ (nenhum export casa `peso\|quota\|score\|ativação\|hipertrofia\|prescr\|substitu\|frequência`) |
| Transformar sinergista em grupo obrigatório | alvos do dia saem só dos grupos do template; teste ⑤ |
| Mexer no crédito parcial de 0,5 | secundários entram na classe: exercício trocado credita igual |
| Tocar no treino manual | `rotinaCustom` não passa pelo alocador; teste ④ cobra os ids exatos |
| Bloquear o editor ou declarar treino perigoso | diagnóstico separado dos avisos; teste ⑥ |
| Presumir execução | e104, e139, e85/e88/e89 ficam pendentes; testes ⑨ ⑩ ⑪ e ⑦ |
| Promover rótulo antigo ou sítio de eletrodo a região | `limitesDeDiscriminacao` portado e cobrado nos testes ⑲ ㉒ |
| Trazer as 1.706 relações de origem para o seletor | teste ㉑ (o JSON dos dados não contém `R\d{4}` nem `evidenciaOrigemIds`) |

## 8. Distinções que os testes travam

Rosca não isola cabeça longa nem curta (nem martelo, nem 21) · tríceps tem três cabeças
participantes e um exercício fecha as três · supino **não** cobre deltoide posterior como alvo
direto · stiff/bom dia **não** recebem a cabeça curta do bíceps femoral (flexão de joelho
recebe) · sóleo participa **em pé** · `e129` é adução da coxa apesar do grupo histórico
`gluteos` do catálogo · `e167` (Y-T-W) **não** é puxada de latíssimo · peitoral tem **duas**
cabeças, sem terceira quota inferior · inclinação e trajetória são **descritores** · a
comparação de Cabral 2022 traz protocolo (barra, 0° vs 45°, 50–70 % 1RM) e o limite de que
não prova hipertrofia, com `usarComoPesoAutomatico: false` · cardio é informativo.

## 9. Regenerar

```bash
node scripts/gerar-alvos-anatomicos.mjs --pacote "<raiz do pacote>"
node scripts/gerar-alvos-anatomicos.mjs --pacote "<raiz do pacote>" --check   # falha se divergir
npm run typecheck && npm run lint && npm test && npm run build
```

O caminho padrão do pacote é proveniência, não dependência de runtime: nada no app o abre.
Se o catálogo mudar, o teste ① derruba a suíte antes de a divergência virar silêncio — e a
resposta é analisar os ids alterados, nunca descartar a pesquisa.

## 10. Decisões materiais tomadas aqui

1. **Base = `origin/main` (`64c2e7b`)**, não a branch da integração muscular. Ela está atrás
   da produção; usá-la seria importar um checkout antigo por cima (§2).
2. **Passe final, não desempate no alocador** — medido, e a alternativa comprava volume (§4).
3. **Melhora estrita** como única razão de trocar; ação classificada só desempata (§4).
4. **Secundários dentro da classe de intercâmbio.** Sem isso a cobertura mexe no déficit e,
   por ele, na quantidade de slots. É a decisão que separa "escolher melhor" de "treinar mais".
5. **`evidenciaOrigemIds` e `preferenciaRegionalComprovada` não foram portados.** As 1.706
   relações são contexto científico e ficam no pacote; um campo vazio de preferência viajaria
   como lugar a preencher com peso.
6. **Descritores não viraram critério de escolha.** São dados do contrato e aparecem na tela
   ditos como descritores; o seletor não os lê.
