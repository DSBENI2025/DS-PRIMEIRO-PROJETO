# Agenda individual por profissional

O Agenda Pro permite definir horários semanais específicos para cada profissional.

## Regra de fallback

Se não existir nenhuma configuração em `professional_hours` para um profissional, ele herda o horário geral cadastrado em `business_hours`.

Quando o estabelecimento salva uma agenda individual, os registros de `professional_hours` passam a ser usados para aquele profissional.

O botão **Voltar a usar horário geral** remove a configuração individual e restaura o fallback.

## Interface

No painel:

`Profissionais -> Editar horários`

Rota:

`/painel/profissionais/[id]/horarios`

## Agendamento público

Depois que o cliente escolhe o profissional, os horários exibidos são calculados usando:

1. agenda individual do profissional;
2. se não existir, agenda geral do estabelecimento.

## Segurança

A API de agendamento sem Pix valida os horários novamente no servidor.

A pré-reserva Pix também é validada no PostgreSQL pela função `create_booking_payment_hold`. Assim, chamadas manuais à API não conseguem criar uma pré-reserva fora da disponibilidade efetiva do profissional.

## Migração

`supabase/migrations/20260920_000002_professional_hours.sql`
