# Agenda Pro

MVP de SaaS de agendamento para profissionais e pequenos negócios, com cobrança recorrente.

## O que já existe

- cadastro e login com Supabase Auth
- onboarding do negócio
- slug público por estabelecimento
- serviços com duração e preço
- profissionais
- equipe com papéis de proprietário, administrador e profissional
- convites seguros por link
- horários gerais do estabelecimento
- horários individuais por profissional, com fallback para o horário geral
- bloqueios de almoço, folgas, compromissos e férias
- página pública em `/agendar/[slug]`
- criação de agendamento sem login do cliente final
- disponibilidade pública em tempo real
- slots livres considerando Agenda Pro, Pix e Google Agenda
- prevenção de conflito de horário por profissional
- painel com próximos agendamentos
- reagendamento com revalidação completa de disponibilidade
- autoatendimento do cliente por link seguro
- consulta, cancelamento e reagendamento sem login
- histórico/auditoria de criação, reagendamento, cancelamento e status
- exportação CSV dos relatórios em 7, 30 ou 90 dias
- preço histórico congelado por agendamento para relatórios financeiros
- rate limit persistente nos endpoints públicos de agenda, Pix e autoatendimento
- cancelamento de agendamento
- cobrança recorrente via Mercado Pago
- webhook com validação de assinatura
- auditoria e idempotência de entregas do webhook Mercado Pago
- bloqueio do painel e da agenda pública sem assinatura `authorized`
- RLS no Supabase
- CI no GitHub Actions
- preflight de produção e smoke tests automáticos pós-deploy
- CI bloqueando arquivos locais/sensíveis rastreados acidentalmente
- conexão OAuth com Google Agenda geral
- Google Agenda individual por profissional, com fallback para o geral
- consulta de disponibilidade no Google Agenda efetivo
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

- Next.js 16
- React 19
- TypeScript
- Supabase Auth + PostgreSQL
- Mercado Pago Node SDK
- GitHub Actions

## Variáveis

Crie as variáveis a partir de `.env.example`:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferencial)
- `SUPABASE_SECRET_KEY` (preferencial, somente servidor)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (compatibilidade legada)
- `SUPABASE_SERVICE_ROLE_KEY` (compatibilidade legada, somente servidor)
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
- `RATE_LIMIT_SECRET`

Nunca publique valores reais dessas credenciais no repositório.

## Produção

Checklist completo em `docs/PRODUCTION.md`.

Preflight de produção: `.github/workflows/release-preflight.yml`.

Migrations do Supabase via GitHub Actions: `docs/SUPABASE_DEPLOY.md`.

Deploy pela Vercel via GitHub Actions: `docs/VERCEL_DEPLOY.md`.

Health check: `GET /api/health`.

## Supabase

As migrations são a fonte de verdade do banco e podem ser aplicadas pelo workflow `.github/workflows/deploy-database.yml`. `supabase/schema.sql` permanece como referência consolidada.

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
5. ajusta os horários gerais e, se necessário, a agenda individual de cada profissional
6. compartilha o link público
7. recebe os agendamentos no painel

## Próximos blocos

- reembolso automático quando aplicável
- plano anual
