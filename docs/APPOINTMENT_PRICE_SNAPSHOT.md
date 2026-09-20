# Snapshot de preço por atendimento

O Agenda Pro preserva o preço do serviço no momento da criação do atendimento.

Coluna:

`appointments.service_price_cents`

## Motivo

Sem snapshot, alterar o preço de um serviço faria relatórios antigos parecerem ter sido vendidos pelo novo valor.

Com o snapshot:

- reajustes futuros não alteram receita histórica;
- ticket médio permanece consistente;
- ranking financeiro por serviço/profissional fica mais confiável;
- exportação CSV usa o valor original do atendimento.

## Criação sem Pix

A API salva explicitamente o preço vigente do serviço no atendimento.

## Criação com Pix

O trigger usa `booking_payments.service_price_cents`, que já é congelado na criação da pré-reserva.

Isso evita que uma alteração de preço entre geração e aprovação do Pix altere o valor histórico.

## Proteção no banco

Um trigger `before insert` preenche o snapshot caso algum fluxo futuro esqueça de enviá-lo explicitamente.

A prioridade é:

1. preço congelado da pré-reserva Pix;
2. preço atual do serviço;
3. zero apenas como fallback defensivo.

## Dados anteriores

A migration faz backfill dos atendimentos existentes.

Para atendimentos com Pix, usa o snapshot já existente em `booking_payments`.

Para atendimentos antigos sem Pix, usa o preço atual do serviço na data da migration, pois o preço original anterior não estava armazenado.

## Migration

`supabase/migrations/20260920_000009_appointment_price_snapshot.sql`
