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
- WhatsApp transacional com consentimento explícito
- aviso de Pix pendente
- confirmação automática do agendamento
- lembrete programável por estabelecimento
- pós-atendimento após conclusão
- logs idempotentes de notificações
- conexão Mercado Pago por estabelecimento via OAuth + PKCE
- sinal Pix configurável por negócio
- pré-reserva do horário por 30 minutos
- confirmação automática do agendamento após aprovação do Pix

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
- `MERCADO_PAGO_CLIENT_ID`
- `MERCADO_PAGO_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `WHATSAPP_GRAPH_VERSION`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_TEMPLATE_LANGUAGE`
- `WHATSAPP_TEMPLATE_PIX_PENDING`
- `WHATSAPP_TEMPLATE_BOOKING_CONFIRMED`
- `WHATSAPP_TEMPLATE_REMINDER`
- `WHATSAPP_TEMPLATE_FOLLOWUP`
- `NOTIFICATION_CRON_SECRET`

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

## Sinal Pix por estabelecimento

A assinatura mensal do Agenda Pro utiliza a credencial da plataforma.

O sinal pago pelo cliente final utiliza OAuth do Mercado Pago para que cada
estabelecimento conecte a própria conta. O Agenda Pro não usa a credencial da
plataforma para receber o sinal do cliente.

Callback OAuth do Mercado Pago:

`<NEXT_PUBLIC_APP_URL>/api/mercadopago/callback`

O sinal começa desativado. Depois que o estabelecimento conecta o Mercado Pago,
ele pode habilitar o sinal e escolher um percentual entre 10% e 100%.

Com o sinal ativo:
1. o horário é pré-reservado;
2. um Pix é gerado na conta Mercado Pago do estabelecimento;
3. a pré-reserva dura 30 minutos;
4. o webhook confirma o pagamento;
5. o agendamento definitivo é criado;
6. o evento é sincronizado com o Google Agenda, quando conectado.

## WhatsApp

A configuração detalhada está em `docs/WHATSAPP.md`.

As mensagens usam templates previamente aprovados na WhatsApp Business Platform. O cliente precisa consentir no formulário de agendamento para receber mensagens automáticas.

Os lembretes são processados pelo workflow `.github/workflows/notifications.yml`, que roda a cada 5 minutos e chama um endpoint protegido por segredo.

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
- reembolso automático quando aplicável
- mais de um usuário administrador
- relatórios mensais
- plano anual
