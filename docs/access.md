# Como acessar, rodar e publicar o app

O código está no GitHub (`nspleal/evokorpus`), na branch de desenvolvimento
**`claude/evokorpus-app-dev-9in0hs`**.

## A) Rodar localmente (mais rápido — só para ver funcionando)

Pré-requisito: **Node 20+** (recomendado 22; há um `.nvmrc`).

### Jeito fácil — lançador (duplo-clique)
Depois de baixar/clonar o projeto:
- **Windows:** duplo-clique em **`[DEV] iniciar (precisa Node instalado).bat`**
- **Mac / Linux:** duplo-clique em **`[DEV] iniciar (Mac e Linux, precisa Node).command`**

> Para testar **SEM instalar nada**, NÃO use estes — baixe o **pacote portátil**
> (`evokorpus-portatil-windows.zip`) na aba **Releases**. Ver seção abaixo.
  (Mac, 1ª vez: botão direito → Abrir)

Ele instala tudo na primeira vez, sobe o app e abre o navegador em
**http://localhost:3000**. Para parar, feche a janela.

### Pela linha de comando
```bash
git clone https://github.com/nspleal/evokorpus.git
cd evokorpus
git checkout claude/evokorpus-app-dev-9in0hs
npm install
npm run dev
```

Abra **http://localhost:3000**. Vá em **Começar → /onboarding**, preencha e clique em
**Gerar meu plano**: o motor roda no seu navegador (gate de saúde → calorias → macros →
cardápio de exemplo). **Não precisa de Supabase** para essa demonstração.

Para testar os números do motor:

```bash
npm test
```

## B) Rodar com backend (Supabase — conta, login, persistência)

1. Crie um projeto em **supabase.com** (tier grátis).
2. Aplique as migrations (SQL Editor do Supabase, em ordem):
   `supabase/migrations/0001_init.sql` → `0002_rls.sql` → `0003_seed_reference.sql`
   (ou use a Supabase CLI — ver `supabase/README.md`).
3. Copie `.env.example` para `.env.local` e preencha:
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` (**segredo**, só servidor)
   - `KIWIFY_WEBHOOK_SECRET` (quando for ligar a assinatura)
4. `npm run dev`.

## C) Publicar (Vercel — colocar no ar)

1. Em **vercel.com**, importe o repositório `nspleal/evokorpus` e selecione a branch.
2. Em **Settings → Environment Variables**, adicione as mesmas variáveis do `.env.local`
   (a `service_role` só como variável de servidor — **nunca** com prefixo `NEXT_PUBLIC_`).
3. Deploy. A Vercel detecta Next.js automaticamente (build `npm run build`).
4. Configure o **webhook da Kiwify** apontando para
   `https://SEU-DOMINIO/api/webhooks/kiwify` e use o mesmo `KIWIFY_WEBHOOK_SECRET`.

## Importar a base completa de conteúdo

O seed atual é um **subconjunto** para a demo. Para importar os 163 exercícios / 125
alimentos / 56 pratos (dos `.xlsx` do autor), ver **`supabase/README.md`** → "Importar a
base completa".

## Onde pedir ajuda ao Claude (este chat)

Qualquer alteração de produto/decisão você traz aqui; eu implemento neste repo e faço push
para a branch de desenvolvimento. Não edito o cofre — decisões novas você arquiva lá.
