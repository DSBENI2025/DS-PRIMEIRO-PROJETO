# Produção — Agenda Pro

Este checklist prepara uma instalação real do Agenda Pro.

## 1. Banco de dados

Para um projeto Supabase novo, aplique as migrations em ordem:

1. `supabase/migrations/20260920_000001_baseline.sql`
2. `supabase/migrations/20260920_000002_professional_hours.sql`

O arquivo `supabase/schema.sql` continua sendo a referência consolidada do schema.

Depois da baseline, toda mudança de banco deve entrar em uma nova migration.

## 2. Variáveis obrigatórias do núcleo

Configure no ambiente de produção:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_PLAN_ID`
- `TOKEN_ENCRYPTION_KEY`

`TOKEN_ENCRYPTION_KEY` deve ter pelo menos 32 caracteres e nunca deve ser trocada sem um plano de rotação dos tokens criptografados existentes.

## 3. Integrações opcionais

### Google Agenda

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Callback:

`<NEXT_PUBLIC_APP_URL>/api/google/callback`

### Mercado Pago do estabelecimento

- `MERCADO_PAGO_CLIENT_ID`
- `MERCADO_PAGO_CLIENT_SECRET`

Callback:

`<NEXT_PUBLIC_APP_URL>/api/mercadopago/callback`

### WhatsApp

Consulte `docs/WHATSAPP.md`.

## 4. Supabase Auth

Ative Email/Password e configure:

- Site URL: domínio real do Agenda Pro
- Redirect URLs compatíveis com o domínio de produção

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no navegador.

## 5. Mercado Pago — assinatura SaaS

Crie o plano recorrente e configure:

- Access Token da plataforma
- Plan ID
- webhook em `/api/webhooks/mercadopago`
- assinatura/secret do webhook

Teste os estados de assinatura antes de liberar clientes reais.

## 6. Health check

Endpoint:

`GET /api/health`

Resposta 200 significa que as variáveis obrigatórias estão presentes e o banco respondeu.

Resposta 503 significa ambiente incompleto ou banco indisponível.

O endpoint não expõe tokens nem valores secretos.

## 7. Checklist pós-deploy

1. abrir a landing page
2. criar uma conta de teste
3. concluir onboarding
4. ativar uma assinatura de teste
5. cadastrar serviço e profissional
6. configurar horários gerais
7. configurar pelo menos um profissional com horário individual e validar o fallback
8. abrir o link público
8. criar agendamento
9. testar conflito de horário
10. testar cancelamento
11. conectar Google Agenda
12. testar Pix de sinal
13. validar webhook
14. validar WhatsApp com consentimento
15. abrir relatórios
16. consultar `/api/health`

## 8. GitHub Actions Secrets

Para o workflow de lembretes:

- `AGENDA_PRO_BASE_URL`
- `NOTIFICATION_CRON_SECRET`

Não reutilize credenciais sensíveis desnecessariamente entre serviços.

## 9. Regra de release

Só promover mudanças para produção quando:

- `npm ci` passar
- `npm run check:env` passar no CI
- `npm run typecheck` passar
- `npm audit --omit=dev --audit-level=high` passar
- `npm run build` passar
