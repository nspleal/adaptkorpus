# CLAUDE.md — Repositório do App Adaptkorpus

Este é o repositório onde o **app Adaptkorpus** é desenvolvido. Regras de trabalho:

## Relação com o cofre (obsidian)

- O **cofre** (repo `obsidian`) é a **fonte de verdade** de produto, decisões, números e
  marca. Toda spec vem de lá (ex.: `conceitos/parametros-motor-dieta-adaptkorpus`,
  `conceitos/gate-de-saude-adaptkorpus`, `conceitos/identidade-de-marca-adaptkorpus`).
- **Sempre leia o cofre** antes de implementar algo que dependa de uma decisão. **Nunca
  escreva** no cofre por aqui — decisões novas voltam pelo humano para serem arquivadas lá.
- Quando o código encodar uma regra travada, **cite a página do cofre** no comentário.

## Princípios inegociáveis (derivam do enquadramento legal — não quebrar)

1. **Nada de IA em runtime.** Tudo é fórmula + dado curado. A copy **nunca** diz "IA".
2. **18+.** Gate de idade na borda (validação) e na conta.
3. **Sem promessa de resultado.** Linguagem de processo/jornada, não de resultado garantido.
4. **Fora do território clínico.** Condição de saúde → o app **não gera plano**, orienta
   profissional (gate de saúde, postura fail-safe).
5. **LGPD desde o início.** Dado de saúde é sensível: RLS em toda tabela, minimização,
   consentimento, segredos fora do repo. Ver `docs/security-lgpd.md`.
6. **Determinismo auditável.** Mesmo input → mesma saída (sustenta o enquadramento legal).

## Fidelidade visual (prioridade travada)

Para qualquer arte (logo/ícone/favicon/mockup) use a **construção canônica do SVG** do
cofre (`identidade-de-marca-adaptkorpus` → "Construção canônica do símbolo"). **Nunca
redesenhe de memória.** Regra de cor: neon **Pulso `#BDFF00`** só em fundo escuro; no
claro o acento é **Folha `#16A34A`**. Ícone do app = **"K em Selo"** (não o "K Ascendente").

## Qualidade (rodar antes de commitar)

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

O **motor** (`src/lib/engine`) é puro e testado — qualquer mudança em número/regra precisa
de teste que ancore no valor da spec. Não introduza dependência de IA, rede ou relógio no
motor (ele deve ser determinístico).

## Segredos

Nunca commitar `.env*`. A `service_role` do Supabase é server-only (`src/lib/supabase/admin.ts`,
com `import 'server-only'`) e **nunca** vai ao browser. Ver `.env.example`.
