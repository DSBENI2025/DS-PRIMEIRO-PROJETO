# Proteção contra arquivos sensíveis no Git

O repositório do Agenda Pro é público. Por isso, arquivos locais e credenciais nunca devem ser versionados.

## Proteção no .gitignore

O projeto ignora explicitamente:

- `.env` e variantes como `.env.production` e `.env.preview`;
- `.vercel/`;
- `supabase/.temp/`;
- `.supabase/`;
- certificados/chaves privadas comuns (`.pem`, `.p12`, `.pfx`, `id_rsa`, etc.).

`.env.example` continua versionado e deve conter somente nomes de variáveis, nunca valores reais.

## Proteção no CI

O comando:

`npm run check:sensitive-files`

inspeciona todos os arquivos rastreados por Git.

O CI falha se encontrar um arquivo proibido mesmo que ele tenha sido adicionado com `git add -f`.

## Limite da proteção

Essa checagem evita classes comuns de vazamento por arquivo. Ela não substitui:

- revisão de secrets no GitHub;
- rotação imediata de qualquer credencial que tenha sido exposta;
- secret scanning da plataforma;
- uso de GitHub Secrets/Vercel Environment Variables.

A varredura feita durante esta revisão não encontrou padrões conhecidos de credenciais reais no código atual.
