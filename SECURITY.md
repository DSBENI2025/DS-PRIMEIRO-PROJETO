# Security Policy

## Supported version

O Agenda Pro ainda está em fase de MVP/piloto. A branch `main` é a única versão suportada.

## Como reportar uma vulnerabilidade

Não abra uma issue pública contendo:

- tokens;
- senhas;
- chaves privadas;
- dados pessoais de clientes;
- credenciais de Supabase, Mercado Pago, Google, WhatsApp ou Vercel;
- exemplos que permitam acesso não autorizado.

Use um canal privado do responsável pelo repositório para compartilhar detalhes sensíveis.

Se o problema puder ser descrito sem segredo, dados pessoais ou instruções exploráveis, abra uma issue com o mínimo de informação necessário e marque que os detalhes técnicos sensíveis devem ser tratados em privado.

## Credencial exposta

Se uma credencial real aparecer em commit, log, issue ou pull request público:

1. considere a credencial comprometida;
2. revogue/rotacione imediatamente no provedor;
3. atualize GitHub Secrets/Vercel Environment Variables;
4. não confie apenas em apagar o arquivo ou reescrever o histórico;
5. revise logs e eventos do provedor para uso indevido.

## Segredos no projeto

Credenciais reais devem existir somente em mecanismos próprios de secrets/variáveis de ambiente.

O CI executa `npm run check:sensitive-files` para bloquear classes comuns de arquivos locais/sensíveis rastreados por Git.

## Dependências

O Dependabot monitora semanalmente:

- dependências npm;
- GitHub Actions.

Atualizações continuam passando pelo CI normal antes de merge.
