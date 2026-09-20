# Agenda Pro

SaaS de agendamento com cobrança recorrente.

## Stack
- Next.js + TypeScript
- Mercado Pago Assinaturas
- Supabase/PostgreSQL
- Deploy preparado para Vercel

## Fluxo de cobrança
1. Cliente informa o e-mail e clica em **Assinar**.
2. `POST /api/subscriptions/create` cria a assinatura no Mercado Pago.
3. O cliente é redirecionado para o checkout retornado pelo Mercado Pago.
4. O Mercado Pago envia eventos para `/api/webhooks/mercadopago`.
5. O webhook valida a assinatura da notificação.
6. O backend consulta a assinatura no Mercado Pago.
7. A tabela `subscriptions` é atualizada e serve como fonte de verdade para liberar ou bloquear recursos.

## Variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha:
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_PLAN_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

Nunca envie credenciais reais para o GitHub.

## Banco
Execute `supabase/schema.sql` no SQL Editor do Supabase.

## Status de assinatura
A aplicação deve tratar a tabela `subscriptions` como fonte de verdade para liberar recursos.

Status esperados:
- pending
- authorized
- paused
- cancelled

## Próximas fases
- autenticação
- onboarding do negócio
- serviços e profissionais
- horários e bloqueios
- página pública de agendamento
- sincronização Google Agenda
- bloqueio automático por status da assinatura
- cancelamento e reativação
