# Auditoria de webhooks do Mercado Pago

O Agenda Pro registra entregas válidas do webhook do Mercado Pago em:

`webhook_events`

## Objetivos

- evitar repetir efeitos para a mesma entrega;
- permitir retry quando o processamento interno falha;
- diferenciar webhook inválido de falha operacional;
- manter trilha de auditoria sem armazenar o payload completo.

## Validação

A assinatura do Mercado Pago é validada antes de qualquer registro no banco.

Webhook com assinatura inválida retorna:

`401 Unauthorized`

Nenhum evento de auditoria é criado nesse caso.

## Chave idempotente

A chave da entrega é um SHA-256 calculado a partir de:

- tópico;
- data ID;
- request ID;
- assinatura;
- corpo recebido.

A chave não usa somente o ID do pagamento, porque o mesmo pagamento pode gerar atualizações legítimas posteriores de status.

## Estados

- `processing`: entrega em processamento;
- `processed`: processada com sucesso;
- `ignored`: tópico válido, mas sem ação suportada;
- `failed`: processamento falhou e pode ser tentado novamente.

Entregas `processing` há mais de cinco minutos podem ser retomadas.

## Retry

Falha de processamento interno retorna HTTP `500`, permitindo que o provedor tente novamente.

Uma entrega já `processed` ou `ignored` retorna HTTP `200` sem repetir o efeito.

Se a própria camada de auditoria falhar, o webhook continua sendo processado. O pagamento ou a assinatura não devem ficar indisponíveis por causa de uma falha auxiliar de logging.

## Dados armazenados

A tabela registra somente:

- provider;
- hash da entrega;
- tópico;
- data ID;
- request ID;
- status;
- número de tentativas;
- timestamps;
- mensagem de erro limitada.

O payload completo e a assinatura não são persistidos.

## Migration

`supabase/migrations/20260920_000011_webhook_events.sql`
