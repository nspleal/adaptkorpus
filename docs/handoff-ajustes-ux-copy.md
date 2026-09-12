# Handoff — 4 ajustes de UX/copy (Adaptkorpus)

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

> **Insumo para o cofre.** Esta sessão (app, nuvem) **não escreve no cofre**.
> Branch: `claude/adaptkorpus-app-dev-9in0hs`. Commit: `99959b7`.
> São **decisões de copy/voz de marca** do autor — implementadas no código; voltam para
> arquivar (identidade-de-marca / registro-de-aderência / parametros-motor-treino).

## 1. "não curto" → "não gosto" (rótulo de exibição)
- O bloco de **preferência de alimentos** agora lê **"Alimentos que você não gosta"** (antes
  "não curte"), e os textos de apoio usam **"não gosto"** (antes "não curto").
- 🔒 **Só o rótulo que o usuário lê mudou.** O **conceito interno e do cofre continua "não
  curto"** (nível do alimento, preferência relaxável, distinto de alergia): o identificador
  `naoCurto`, o `excluirAlimentoIds` do motor, a sessão e os testes **não mudaram** — zero
  risco para dado salvo/determinismo. Se o cofre quiser renomear o conceito também, é outra
  decisão (maior).
- **Fora do escopo (deixei como está):** as frases da feature de **troca/variedade** que usam
  "curtir" com outro sentido ("Não curtiu? Gere mais.", "Não curti nenhuma", e a landing
  "Não curtiu um exercício ou alimento?"). Se quiser voz 100% uniforme, troco esses 4 também.

## 2. Editar porção: fração → porcentagem
- As opções do modal "Editar porção" passaram de **½/¾/1/1¼/1½/2 porção** para
  **50% / 75% / 100% (padrão) / 125% / 150% / 200%**.
- O badge no card do prato ("0.50× porção") virou **"50% da porção"** para bater com o modal.
- **A matemática não muda** — o fator de escala (0,5…2) continua igual; o rótulo é cosmético.

## 3. Recomendação visível no exercício guiado
- Antes: os campos de reps/carga eram só "—", sem dizer o que registrar.
- Agora: o campo **REPS mostra a meta como placeholder** (ex. "8–12"), o **CARGA mostra "kg"**,
  e há uma **linha-guia** acima da tabela: *"Registre cada série abaixo: quantas repetições e o
  peso. Meta de hoje: N séries de X–Y reps."* (os números vêm da prescrição do motor).

## 4. Glosas amigáveis de RIR e "% do máximo"
- **RIR** (logo abaixo das pills): *"RIR é a reserva: quantas repetições você ainda conseguiria
  fazer no fim da série. Pare com {min}–{max} na reserva — sem ir até a falha."*
- **% do máximo** (sob o rótulo do toggle): *"Quanto do peso máximo que você levantaria numa
  única repetição."* (o painel de estimativa e a nota "nunca testamos seu 1RM real" continuam.)
- Termos técnicos mantidos (são jargão real do motor); só ganharam tradução em linguagem simples.

## Qualidade
`typecheck` · `lint` · **158 testes** · `build` — verdes. E2E (Playwright, **zero erros de
console**): modal de porção com "50%…200%"; Editar perfil com "Alimentos que você não gosta"
(0 ocorrências de "curte/curto"); sessão guiada com placeholder de reps "6–12", linha-guia e
as duas glosas visíveis.

## Arquivos
`src/components/perfil/DiasEPreferencias.tsx` (copy preferência) ·
`src/components/painel/Painel.tsx` (porção % + badge) ·
`src/components/painel/SessaoTreino.tsx` (guia de reps + glosas).

## Pendência que volta por você (cofre)
- [ ] Aprovar/ajustar a **voz** das 4 mudanças (rótulo "não gosto", glosas de RIR e %máximo) e
      decidir se estende a troca de "curtir" às frases de troca/variedade.
