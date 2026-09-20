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

Nunca publique valores reais dessas credenciais no repositório.

## Supabase

Execute `supabase/schema.sql` no SQL Editor do projeto Supabase.

No Supabase Auth, habilite Email/Password. Em produção, configure a Site URL para o domínio real.

## Mercado Pago

O fluxo usa uma assinatura vinculada a um plano por `preapproval_plan_id`.

Webhook:

`POST /api/webhooks/mercadopago`

O painel só libera os recursos quando a assinatura está com status `authorized`.

## Fluxo do usuário

1. cria conta
2. cadastra o negócio
3. assina o Agenda Pro
4. cadastra serviços e profissionais
5. ajusta horários
6. compartilha o link público
7. recebe os agendamentos no painel

## Próximos blocos

- sincronização com Google Calendar
- lembretes por WhatsApp
- depósito/sinal via Pix no agendamento
- mais de um usuário administrador
- relatórios mensais
- plano anual
