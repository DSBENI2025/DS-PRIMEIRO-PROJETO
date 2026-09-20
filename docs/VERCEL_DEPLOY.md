# Deploy de produção pela Vercel

O Agenda Pro possui um workflow manual:

`.github/workflows/deploy-production.yml`

Ele só publica quando alguém inicia **Deploy production to Vercel** no GitHub Actions.

## Secrets obrigatórios no GitHub

Configure no ambiente/repositório:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Esses valores não devem ser colocados em arquivos do repositório.

## Variáveis do aplicativo

As variáveis do Agenda Pro devem ser configuradas no projeto Vercel, não no workflow.

Consulte:

- `.env.example`
- `docs/PRODUCTION.md`

## Pipeline

O workflow:

1. faz checkout do commit;
2. executa `npm ci`;
3. valida a existência dos três secrets da Vercel;
4. executa `vercel pull --environment=production`;
5. gera o artefato com `vercel build --prod`;
6. publica com `vercel deploy --prebuilt --prod`;
7. consulta `/api/health`;
8. falha se variáveis, banco ou schema/migrations estiverem incompletos.

A CLI da Vercel está fixada em `59.20.0` para evitar mudança inesperada do pipeline.

## Preflight

Antes de aplicar migrations ou publicar, execute **Production release preflight**.

O workflow `.github/workflows/release-preflight.yml`:

- valida os secrets de produção sem imprimir valores;
- conecta ao Supabase;
- executa `supabase db push --dry-run`;
- baixa as configurações de produção da Vercel;
- executa `vercel build --prod`;
- não aplica migrations e não publica deployment.

## Primeiro deploy

Antes do primeiro deploy:

1. crie o projeto Agenda Pro na Vercel;
2. vincule o repositório;
3. configure todas as variáveis de produção;
4. configure os três secrets do workflow;
5. configure os secrets do workflow do Supabase;
6. execute **Deploy Supabase migrations**;
7. confirme que as migrations terminaram sem erro;
8. execute **Deploy production to Vercel**.

## Segurança

O workflow usa o GitHub Environment `production`.

É recomendável configurar regras de proteção nesse Environment para exigir aprovação manual antes de cada publicação.
