# Lista para o Claude Design — 7 peças que faltam (não criei nada sem arte)

> Conforme combinado: estas peças precisam de **página/layout novo**, então **não implementei
> nada visual** — você produz no Claude Design e me devolve o handoff estético (`.dc.html`),
> que eu porto fielmente como nos V1–V5. Para cada peça: o que é, o que precisa ter, e as
> travas que a arte deve respeitar. Travas GERAIS (valem p/ todas): dark theme Floresta
> `#0D2818`/Carvão `#0F0F0E` · neon Pulso `#BDFF00` só no escuro · vermelho `#E5484D` só
> erro/segurança · Jakarta Sans · sem "IA" · sem promessa de resultado · 18+ no rodapé.

## 1. Página `/reembolso` (confiança · prioridade alta)
- **O quê:** página institucional de garantia/reembolso + **link no rodapé** + **badge/selo
  na landing** (zona dos chips de "Honestidade").
- **Conteúdo (direção do cofre):** "7 dias de garantia (CDC). Não gostou? Devolvemos tudo —
  sem perguntas. Peça pelo e-mail de suporte ou na sua conta; processamos em até 2 dias
  úteis." + passo-a-passo simples (3 passos) + FAQ curto de cobrança.
- **Nota:** o texto final ainda passa pela revisão jurídica — desenhar com copy provisória
  marcada (temos o componente `AValidar` p/ isso).

## 2. Página `/faq` (~30 Q&A)
- **O quê:** FAQ robusto em **5 categorias**: Assinatura/Cancelamento · Treino · Dieta ·
  Conta/dados · Legal/18+. Acordeão ou lista âncora por categoria; busca opcional.
- **Eu cuido:** do JSON-LD (schema FAQ p/ Google) e de rascunhar as ~30 Q&A a partir do
  cofre para você aprovar — o design só precisa do padrão visual de pergunta/resposta
  (estado aberto/fechado) e da navegação por categoria.

## 3. Página `/changelog`
- **O quê:** changelog público, tom honesto, 1–2 linhas por release, ordem cronológica
  inversa. Um item = data + título curto + linha de descrição (+ tag opcional
  novo/melhoria/correção).
- **Eu cuido:** de alimentar o conteúdo a cada handoff (já tenho o histórico V1→V5+V2 pronto).

## 4. Quadro "fazemos / não fazemos" na `/privacidade`
- **O quê:** seção nova no topo da página de privacidade existente (LegalLayout): quadro de
  duas colunas — **Fazemos:** RLS isola seu dado · você exporta/exclui quando quiser ·
  medição anônima sem cookie. **Não fazemos:** não vendemos dados · não pedimos foto ·
  não usamos seus dados de saúde p/ publicidade.
- **⚠️ Trava do cofre:** **NÃO prometer "sem anúncios"** (decisão futura em aberto) — a
  copy não pode travar isso.

## 5. Marcos de constância (7/30 dias) — upgrade do registro V5
- **O quê:** marcos visuais no fluxo de aderência (aba Hoje/Dieta e/ou Progresso): "7 dias
  registrando" / "30 dias" — celebração leve (selo/medalha/anel de progresso).
- **⚠️ Trava no-blame (regra de ouro do V5):** **NUNCA** "você perdeu a sequência", nunca
  streak que zera com culpa. O marco celebra o acumulado; a ausência simplesmente não fala.
- **Estados que a arte precisa cobrir:** progresso rumo ao marco (ex. 4/7), marco atingido
  (celebração), e o estado neutro pós-hiato (recomeça sem punição).

## 6. Gráfico de progressão de carga (Histórico)
- **O quê:** no Histórico → sub-aba Treinos (ou nova sub-aba "Cargas"): gráfico por
  **exercício** (eixo X = data da sessão, Y = carga) + seletor de exercício + resumo
  "você estava em X kg, hoje Y kg".
- **Temos:** os dados por sessão já existem (série a série: reps × kg). Há um gráfico de
  peso corporal (linha/área SVG) cuja linguagem visual pode ser a base.
- **⚠️ Trava:** motivação concreta **sem promessa** ("evolução da carga", nunca "você VAI
  levantar X").

## 7. Opt-in de notificações (Web Push) + toque de reengajamento
- **O quê:** cartão/tela de opt-in explícito ("Quer lembretes do seu treino e refeições?")
  + estado nas configurações (ativar/desativar por tipo: treino · refeição) + a peça de
  reengajamento (1 aviso após 7+ dias sem uso).
- **Copy de direção (cofre):** tom neutro, sem culpa — "Seu treino de hoje te espera" ·
  "Seu plano continua aqui". Um toque e silêncio; nada de sequência de pressão.
- **Nota:** o backend de agendamento (service worker + Supabase Edge) entra na fase
  Supabase; o design pode vir antes que eu deixo a UI pronta e desligada por env.

---
### Fora desta lista (não é design)
- **Modo de preparo dos 96 pratos** e **erros comuns dos exercícios** = CONTEÚDO (cofre
  produz; os slots "em breve" já existem no app).
- Decisões §6 em aberto (CRM, plano anual, order bump, ads…) = não travadas, não implemento.
