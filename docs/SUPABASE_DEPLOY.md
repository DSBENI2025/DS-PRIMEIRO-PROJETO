# Deploy das migrations do Supabase

O Agenda Pro possui um workflow manual de produção:

`.github/workflows/deploy-database.yml`

Ele usa o Supabase CLI oficial e aplica somente migrations pendentes com `supabase db push`.

## Secrets do GitHub

Configure no GitHub Environment `production`:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID`

Nenhum desses valores deve ser salvo no repositório.

## Pipeline

O workflow:

1. faz checkout da `main`;
2. instala o Supabase CLI pelo action oficial;
3. valida os três secrets;
4. vincula o runner ao projeto com `supabase link`;
5. executa `supabase db push --dry-run`;
6. executa `supabase db push`;
7. executa `supabase migration list`;
8. registra um resumo no GitHub Actions.

O workflow não usa `db reset --linked` e não inclui seed de produção.

## Ordem de lançamento

1. Configure o projeto Supabase.
2. Configure os secrets do GitHub Environment `production`.
3. Execute **Production release preflight**.
4. Só continue se o dry-run do banco e o build da Vercel passarem.
5. Execute **Deploy Supabase migrations**.
6. Execute **Deploy production to Vercel**.
7. Verifique `GET /api/health`.

O health check valida tabelas críticas das migrations. Se uma migration estiver ausente ou a Data API não permitir que a chave de servidor alcance uma tabela necessária, a resposta será HTTP 503.

## Chaves do aplicativo

Para projetos novos, prefira:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no navegador;
- `SUPABASE_SECRET_KEY` no servidor.

O Agenda Pro continua aceitando as chaves legadas:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`.

Nunca exponha uma secret key ou service role key em variável `NEXT_PUBLIC_`.

## Data API

As tabelas internas usadas via `supabase-js` precisam conceder apenas os privilégios necessários aos papéis que realmente as acessam.

As migrations do Agenda Pro incluem RLS e grants explícitos nas tabelas sensíveis criadas pelas etapas mais recentes. O `/api/health` funciona como verificação adicional de acesso do servidor.

## Fonte de verdade

- migrations: `supabase/migrations/`
- configuração do CLI: `supabase/config.toml`
- referência consolidada: `supabase/schema.sql`

Depois que um ambiente remoto estiver sob controle de migrations, evite alterações manuais de schema no Dashboard para não criar drift entre Git e banco.
