# Histórico e auditoria de atendimentos

O Agenda Pro registra eventos relevantes do ciclo de vida do atendimento.

## Eventos registrados

- `created`: criação do agendamento;
- `rescheduled`: reagendamento;
- `cancelled`: cancelamento;
- `status_changed`: conclusão, falta ou outra mudança operacional suportada.

## Origem da ação

Cada evento identifica o ator:

- `owner`: proprietário;
- `admin`: administrador;
- `professional`: profissional;
- `customer`: cliente final;
- `system`: automação do sistema.

Quando existe um usuário autenticado, o histórico também registra `actor_user_id`.

## Metadados

Os metadados variam por evento.

Criação registra origem, serviço, profissional e período.

Reagendamento registra:

- profissional anterior;
- novo profissional;
- data/hora anterior;
- nova data/hora.

Cancelamento pode registrar se havia sinal Pix aprovado.

Mudança de status registra o estado anterior e o novo.

## Idempotência

A criação usa `event_key` única no formato:

`created:<appointment_id>`

Isso evita duplicidade quando o webhook do Mercado Pago é processado mais de uma vez.

## Segurança

A tabela `appointment_history` possui RLS.

- proprietário e administrador veem o histórico de todos os atendimentos do negócio;
- profissional vê apenas o histórico dos atendimentos atribuídos a ele;
- cliente final não possui acesso direto à tabela.

As APIs internas repetem a checagem de permissão no servidor, pois usam service role.

## Interface

No painel, cada atendimento possui o botão **Histórico**.

Rota:

`/painel/agendamentos/[id]/historico`

A página mostra uma linha do tempo com data, tipo de ação, ator e mudanças relevantes.

## Observação sobre dados antigos

Eventos ocorridos antes da implantação desta funcionalidade não são reconstruídos automaticamente. O histórico passa a ser confiável a partir da aplicação da migration e do deploy desta versão.

## Migration

`supabase/migrations/20260920_000008_appointment_history.sql`
