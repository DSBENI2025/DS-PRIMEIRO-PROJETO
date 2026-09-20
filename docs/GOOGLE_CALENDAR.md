# Google Agenda — configuração

## 1. Google Cloud

1. Crie ou selecione um projeto.
2. Ative a Google Calendar API.
3. Configure a tela de consentimento OAuth.
4. Crie credenciais OAuth 2.0 do tipo Web Application.
5. Adicione a URI de redirecionamento:
   `https://SEU-DOMINIO/api/google/callback`

Para ambiente local:
`http://localhost:3000/api/google/callback`

## 2. Variáveis

Configure no ambiente do servidor:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`

A chave de criptografia deve ser uma senha aleatória longa, com no mínimo 32 caracteres, e nunca deve ser colocada no GitHub.

## 3. Escopos

O Agenda Pro solicita:

- `https://www.googleapis.com/auth/calendar.events.owned`
- `https://www.googleapis.com/auth/calendar.freebusy`

## 4. Calendário geral

O estabelecimento pode conectar um Google Agenda pelo painel principal.

Esse calendário funciona como fallback para profissionais que não possuem conexão própria.

## 5. Calendário por profissional

Na página:

`/painel/profissionais/[id]/horarios`

é possível conectar um Google Agenda exclusivo para aquele profissional.

A prioridade é:

1. Google Agenda próprio do profissional;
2. Google Agenda geral do estabelecimento;
3. sem integração Google.

Antes de confirmar uma reserva, o Agenda Pro consulta a disponibilidade no calendário efetivo.

Depois da reserva, o evento é criado nesse mesmo calendário.

No cancelamento, o sistema tenta remover o evento do calendário correspondente.

## 6. Tokens

Os access/refresh tokens são armazenados criptografados.

Access tokens expirados são renovados usando o refresh token.

Ao renovar, somente o registro específico daquela conexão é atualizado.

## 7. Migração

Para habilitar calendários individuais aplique:

`supabase/migrations/20260920_000003_professional_google_calendar.sql`
