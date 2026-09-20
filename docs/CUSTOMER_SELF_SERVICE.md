# Autoatendimento do cliente

Cada agendamento confirmado pode receber um link privado no formato:

`/meu-agendamento/<token>`

O cliente não precisa criar conta.

## Segurança do link

O token possui 256 bits aleatórios.

O banco armazena:

- SHA-256 do token para localização;
- token criptografado com `TOKEN_ENCRYPTION_KEY` para que o link possa ser recuperado novamente;
- expiração;
- último uso;
- eventual revogação.

O token nunca é armazenado em texto puro.

A página usa `noindex, nofollow`.

## O que o cliente pode fazer

- consultar serviço, profissional, data e status;
- visualizar o sinal Pix aprovado;
- cancelar um agendamento futuro confirmado;
- reagendar para outro horário;
- escolher outro profissional ativo;
- consultar disponibilidade real antes de confirmar.

## Reagendamento

O autoatendimento reutiliza as proteções operacionais do Agenda Pro:

- horário individual e fallback geral;
- bloqueios, almoço, folga e férias;
- outros agendamentos;
- pré-reservas Pix;
- Google Agenda;
- duração integral do serviço;
- função PostgreSQL atômica `reschedule_appointment`.

Se o agendamento já possui sinal aprovado, reagendar não cria nova cobrança.

## Cancelamento e Pix

Cancelar pelo link libera o horário.

Se existe sinal Pix aprovado, o pagamento permanece registrado como aprovado. O Agenda Pro informa ao cliente que o reembolso não é automático.

Automação de reembolso continua sendo um bloco futuro separado.

## Validade

O link é válido até 30 dias depois do término atual do atendimento.

Ao reagendar, a validade é estendida automaticamente.

## Migration

`supabase/migrations/20260920_000007_customer_self_service.sql`
