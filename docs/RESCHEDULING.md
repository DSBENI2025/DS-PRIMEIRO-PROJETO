# Reagendamento de atendimentos

O Agenda Pro permite reagendar atendimentos futuros com status `confirmed`.

## Acesso

No painel, cada atendimento futuro confirmado possui o botão **Reagendar**.

Rota:

`/painel/agendamentos/[id]/reagendar`

Proprietários e administradores podem trocar também o profissional.

Um usuário com papel `professional` só pode reagendar atendimentos atribuídos a ele e não pode movê-los para outro profissional.

## Validações

Antes de exibir ou confirmar o novo horário, o sistema considera:

- horário individual do profissional;
- fallback para o horário geral;
- bloqueios, folgas e férias;
- outros agendamentos;
- pré-reservas Pix ativas;
- Google Agenda efetivo;
- duração integral do serviço.

O próprio atendimento sendo reagendado é excluído da checagem de conflito.

## Concorrência

A função PostgreSQL `reschedule_appointment`:

1. bloqueia a linha do atendimento;
2. usa advisory lock no profissional de destino;
3. verifica bloqueios;
4. verifica outros atendimentos;
5. verifica pré-reservas Pix;
6. atualiza profissional, início e fim de forma atômica.

A exclusion constraint de agendamentos continua funcionando como proteção adicional.

## Agendamentos com sinal Pix

Quando o atendimento já possui um pagamento aprovado, o reagendamento não gera nova cobrança.

O registro de `booking_payments` aprovado é atualizado com o novo profissional e novo período para manter os dados operacionais alinhados.

## Google Agenda

Cada atendimento novo passa a armazenar:

- `google_event_id`;
- `google_integration_id`.

Isso identifica exatamente em qual conexão Google o evento foi criado.

No reagendamento:

- mesma integração Google: o evento existente é atualizado;
- integração diferente: o evento é removido da agenda antiga e criado na nova;
- sem Google conectado: o reagendamento local continua normalmente;
- falha de sincronização Google após o banco ser atualizado: a resposta informa `googleSynced = false` para conferência operacional.

Essa referência também melhora o cancelamento quando o profissional muda sua configuração de Google depois da criação do atendimento.

## Migration

`supabase/migrations/20260920_000006_reschedule_appointment.sql`
