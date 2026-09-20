# Equipe e permissões

O Agenda Pro suporta três papéis:

- **Proprietário**: acesso total, assinatura, integrações, equipe e relatórios.
- **Administrador**: gerencia operação, serviços, profissionais, horários, integrações e equipe. Não altera a assinatura do SaaS nem convida/remove outros administradores.
- **Profissional**: acessa somente os próprios agendamentos, horários e Google Agenda individual.

## Convites

A gestão fica em:

`/painel/equipe`

O proprietário ou administrador informa o e-mail e gera um link de convite.

O Agenda Pro armazena apenas o SHA-256 do token. O token completo aparece somente no link retornado ao criar o convite.

O convite:

- expira em 7 dias;
- só pode ser aceito pelo mesmo e-mail convidado;
- só pode ser usado uma vez;
- pode ser cancelado antes do aceite.

## Profissional vinculado

Um acesso do tipo `professional` precisa estar vinculado a um registro da tabela `professionals`.

O usuário profissional pode:

- ver os próprios agendamentos;
- concluir ou marcar falta nos próprios atendimentos;
- cancelar os próprios agendamentos;
- editar os próprios horários semanais;
- conectar/desconectar o próprio Google Agenda.

Ele não pode:

- abrir relatórios globais;
- administrar Mercado Pago;
- alterar cobrança/sinal;
- gerenciar serviços ou outros profissionais;
- gerenciar a assinatura do Agenda Pro;
- acessar a agenda de outro profissional.

## Banco e RLS

A migration é:

`supabase/migrations/20260920_000004_team_members.sql`

As tabelas principais são:

- `business_members`
- `team_invitations`

As funções auxiliares de RLS são:

- `business_role(business_id)`
- `business_professional_id(business_id)`

As APIs que usam service role também verificam o papel explicitamente no servidor.

## Limitação atual

Nesta versão, uma conta participa de um único estabelecimento por vez. Isso evita ambiguidade de seleção de negócio no MVP.
