# Rate limit dos endpoints públicos

O Agenda Pro usa rate limit persistente no PostgreSQL para reduzir abuso dos endpoints públicos.

## Privacidade

O IP não é armazenado em texto puro.

O servidor gera um HMAC-SHA256 usando `RATE_LIMIT_SECRET` e usa apenas esse hash como chave do bucket.

`RATE_LIMIT_SECRET` deve ter no mínimo 32 caracteres e deve ser configurado como segredo de produção.

## Limites atuais

Janela de 10 minutos:

- disponibilidade pública: 120 requisições por IP;
- criação de agendamento sem Pix: 12;
- criação de Pix: 6;
- polling do status Pix: 240;
- visualização do autoatendimento: 60;
- disponibilidade para reagendamento do cliente: 120;
- cancelamento pelo cliente: 10;
- reagendamento pelo cliente: 20.

Os limites foram escolhidos para permitir uso normal, inclusive o polling do Pix, e restringir automação abusiva.

## Resposta

Quando o limite é ultrapassado:

- HTTP `429 Too Many Requests`;
- cabeçalho `Retry-After`;
- mensagem amigável para tentar novamente depois.

## Persistência

A tabela é:

`rate_limit_buckets`

A função atômica é:

`consume_rate_limit(key_hash, action, max_requests, window_seconds)`

Isso funciona em ambiente serverless sem depender da memória de uma instância específica.

Buckets expirados são removidos durante novas chamadas.

## Disponibilidade do sistema

O rate limiter é uma camada auxiliar de proteção e opera em modo fail-open: se o banco ou a função de rate limit falhar, a operação principal não é bloqueada apenas por essa falha.

Erros dessa camada são registrados no log do servidor.

## Migration

`supabase/migrations/20260920_000010_public_rate_limits.sql`
