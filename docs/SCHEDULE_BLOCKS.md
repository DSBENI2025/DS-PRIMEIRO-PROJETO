# Folgas, férias e bloqueios

A gestão fica em:

`/painel/bloqueios`

## Casos de uso

O bloqueio pode representar:

- almoço;
- consulta;
- compromisso particular;
- treinamento;
- folga;
- férias;
- fechamento temporário do estabelecimento.

## Escopo

Proprietários e administradores podem criar:

- bloqueio para todo o estabelecimento;
- bloqueio para um profissional específico.

Profissionais podem criar e remover somente os próprios bloqueios.

Bloqueios gerais aparecem para o profissional, mas só proprietário/admin podem removê-los.

## Conflito com atendimentos existentes

O Agenda Pro não cria um novo bloqueio se já houver atendimento confirmado no período.

Primeiro é necessário cancelar ou reagendar o atendimento existente.

## Novos agendamentos

Depois que um bloqueio é criado:

1. os horários deixam de aparecer em `/api/availability`;
2. a criação normal revalida o bloqueio;
3. a criação de pré-reserva Pix revalida o bloqueio;
4. gatilhos no PostgreSQL impedem inserts que tentem contornar as APIs.

## Banco

Migration:

`supabase/migrations/20260920_000005_schedule_blocks.sql`

Tabela:

`schedule_blocks`

Os gatilhos protegem:

- `appointments`;
- `booking_payments`.
