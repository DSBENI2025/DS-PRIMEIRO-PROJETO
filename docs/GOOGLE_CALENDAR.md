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

## 4. Funcionamento

- o usuário conecta o Google Agenda pelo painel;
- o callback armazena os tokens criptografados;
- antes de criar um agendamento, o sistema consulta `freeBusy`;
- depois da reserva, cria um evento em `primary`;
- ao cancelar pelo painel, tenta remover o evento correspondente;
- access tokens expirados são renovados com o refresh token.

## Limitação atual

Nesta versão, existe uma conexão Google por negócio. A evolução planejada é uma conexão por profissional.
