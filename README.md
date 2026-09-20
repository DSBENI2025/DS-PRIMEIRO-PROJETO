# Agenda Pro

MVP de SaaS de agendamento para profissionais e pequenos negócios, com cobrança recorrente.

## O que já existe

- cadastro e login com Supabase Auth
- onboarding do negócio
- slug público por estabelecimento
- serviços com duração e preço
- profissionais
- horários de atendimento por dia da semana
- página pública em `/agendar/[slug]`
- criação de agendamento sem login do cliente final
- prevenção de conflito de horário por profissional
- painel com próximos agendamentos
- cancelamento de agendamento
- cobrança recorrente via Mercado Pago
- webhook com validação de assinatura
- bloqueio do painel e da agenda pública sem assinatura `authorized`
- RLS no Supabase
- CI no GitHub Actions
- conexão OAuth com Google Agenda
- consulta de disponibilidade no Google Agenda
- criação e remoção automática de eventos no Google Agenda

## Stack

- Next.js 15
- React 19
- TypeScript
- Supabase Auth + PostgreSQL
- Mercado Pago Node SDK
- GitHub Actions

## Variáveis

Crie as variáveis a partir de `.env.example`:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_PLAN_ID`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`

Nunca publique valores reais dessas credenciais no repositório.

## Supabase

Execute `supabase/schema.sql` no SQL Editor do projeto Supabase.

No Supabase Auth, habilite Email/Password. Em produção, configure a Site URL para o domínio real.

## Mercado Pago

O fluxo usa uma assinatura vinculada a um plano por `preapproval_plan_id`.

Webhook:

`POST /api/webhooks/mercadopago`

O painel só libera os recursos quando a assinatura está com status `authorized`.

## Google Agenda

Crie um projeto no Google Cloud, habilite a Google Calendar API e configure uma credencial OAuth 2.0 do tipo Web Application.

URI de redirecionamento:

`<NEXT_PUBLIC_APP_URL>/api/google/callback`

A integração solicita acesso offline e usa escopos restritos a eventos das agendas do próprio usuário e consulta de disponibilidade.

Os access/refresh tokens são armazenados criptografados. A chave de criptografia deve existir somente nas variáveis de ambiente do servidor.

## Fluxo do usuário

1. cria conta
2. cadastra o negócio
3. assina o Agenda Pro
4. cadastra serviços e profissionais
5. ajusta horários
6. compartilha o link público
7. recebe os agendamentos no painel

## Próximos blocos

- vincular um Google Agenda diferente por profissional
- lembretes por WhatsApp
- depósito/sinal via Pix no agendamento
- mais de um usuário administrador
- relatórios mensais
- plano anual
