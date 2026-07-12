# Confirmação de Presença — Marcia & Matheus

Sistema de RSVP de casamento, feito em Next.js (App Router) + TypeScript, na mesma
identidade visual e stack do site de lista de presentes original — pronto para
hospedar na Vercel.

## Como funciona

O sistema trabalha com o conceito de **convites**, não de uma lista simples de
convidados. Cada convite tem um responsável, um número de WhatsApp e uma ou mais
pessoas vinculadas, cada uma com seu próprio status (**pendente**, **confirmado**
ou **não vai**).

### Fluxo do convidado (`/`)

1. O convidado digita os **4 últimos dígitos** do WhatsApp cadastrado no convite.
2. O sistema busca internamente pelo número completo e, se encontrar exatamente um
   convite correspondente, mostra o nome do responsável e pergunta **"Este é
   você?"**. Em nenhum momento uma lista de possíveis convites é exibida.
3. Depois de confirmar a identidade, o convidado vê só as pessoas do próprio
   convite e pode confirmar, cancelar ou alterar cada uma — nunca adicionar
   alguém novo.
4. Qualquer alteração só é permitida **até 28 de agosto de 2026**. Depois disso,
   a tela vira somente leitura com uma mensagem pedindo para falar com os noivos.

### Área dos noivos (`/admin`)

Login por senha, com:

- **Dashboard** com total de pessoas, confirmados, pendentes e "não vão".
- **Gestão de convites**: criar convite (responsável + WhatsApp + pessoas),
  editar, excluir, adicionar/remover pessoas e sobrescrever o status de qualquer
  pessoa a qualquer momento (mesmo depois do prazo).
- **Histórico** por convite, com registro de cada confirmação/alteração feita
  pelo próprio convidado ou pela administração.

### Privacidade

- A API pública (`/api/rsvp/*`) nunca retorna a lista de convites nem o WhatsApp
  de ninguém — só o nome do responsável do convite encontrado, e só depois que a
  busca por 4 dígitos resultar em exatamente um convite.
- A sessão do convidado usa um token assinado (HMAC), emitido só depois do
  "Sim, sou eu", válido por 45 minutos e vinculado a um único convite.
- A busca por 4 dígitos é limitada por IP (20 tentativas por hora) para
  dificultar tentativas de descobrir convidados por força bruta.
- Os endpoints administrativos (`/api/admin/*`) exigem o cookie de sessão do
  admin em todas as chamadas.

## Rodando localmente

```bash
npm install
cp .env.example .env.local
# edite .env.local com sua senha de admin e as credenciais do Redis (veja abaixo)
npm run dev
```

## Deploy na Vercel — passo a passo

1. **Suba este projeto para um repositório no GitHub** (ou use `vercel deploy`
   direto pela CLI, se preferir).
2. Na Vercel, clique em **Add New → Project** e importe o repositório.
3. Antes (ou depois) do primeiro deploy, crie o banco de dados:
   - No dashboard do projeto, vá em **Storage → Marketplace Database Providers
     → Upstash → Redis**.
   - Crie um banco Redis gratuito e **conecte ao projeto**. Isso preenche
     automaticamente as variáveis `KV_REST_API_URL`/`UPSTASH_REDIS_REST_URL` e
     equivalentes de token.
4. Em **Settings → Environment Variables**, adicione:
   - `ADMIN_PASSWORD` → a senha que Marcia e Matheus usarão em `/admin`.
   - `RSVP_TOKEN_SECRET` → qualquer string aleatória longa (segredo do token de
     sessão do convidado).
5. Clique em **Deploy**.

## Estrutura

```
app/
  page.tsx                          → tela pública de confirmação (busca → identidade → checklist)
  admin/page.tsx                     → painel dos noivos (login + dashboard + gestão)
  api/rsvp/search/                    → busca por últimos 4 dígitos (rate limited, público)
  api/rsvp/invite/                     → GET carrega o convite do token; PATCH altera status (respeita prazo)
  api/admin/invites/                    → GET lista / POST cria convites (admin)
  api/admin/invites/[id]/                → PUT edita / DELETE exclui um convite (admin)
  api/admin/invites/[id]/people/           → POST adiciona pessoa (admin)
  api/admin/invites/[id]/people/[personId]/ → PATCH sobrescreve status / DELETE remove pessoa (admin)
  api/admin/invites/[id]/history/            → GET histórico do convite (admin)
  api/admin/stats/                            → GET totais do dashboard (admin)
  api/admin/login|logout|session/              → autenticação do admin
components/
  GuestApp.tsx                        → fluxo de busca/identidade/checklist (cliente)
  AdminApp.tsx                         → login + dashboard + gestão de convites (cliente)
lib/
  invites.ts                            → acesso ao Redis (Upstash): convites, pessoas, histórico
  guestToken.ts                          → token assinado de sessão do convidado
  deadline.ts                             → prazo fixo de alteração (28/08/2026)
  auth.ts                                  → senha e cookie de sessão do admin
  rateLimit.ts                              → limitador de tentativas por IP
  types.ts                                   → modelos de dados
```

## Trocar a senha de admin ou o prazo depois

- Senha: edite `ADMIN_PASSWORD` em **Settings → Environment Variables** na
  Vercel e faça um novo deploy.
- Prazo: edite a constante `RSVP_DEADLINE` em `lib/deadline.ts`.
