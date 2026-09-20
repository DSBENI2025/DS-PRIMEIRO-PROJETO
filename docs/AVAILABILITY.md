# Disponibilidade em tempo real

O endpoint público é:

`GET /api/availability`

Parâmetros:

- `businessId`
- `serviceId`
- `professionalId`
- `date` no formato `YYYY-MM-DD`

## Como os horários são calculados

O backend monta slots a cada 30 minutos e remove qualquer opção que conflite com:

1. horário individual do profissional;
2. fallback do horário geral do estabelecimento;
3. agendamentos confirmados no Agenda Pro;
4. pré-reservas Pix ainda válidas;
5. intervalos ocupados no Google Agenda efetivo do profissional.

A duração do serviço é considerada integralmente. Um horário só aparece se o serviço inteiro couber dentro do expediente.

## Google Agenda

O sistema consulta o `freeBusy` uma única vez para o dia inteiro e cruza os intervalos localmente.

Se o Google estiver temporariamente indisponível, os horários internos ainda são exibidos e a disponibilidade do Google é validada novamente na confirmação final do agendamento.

## Segurança

A lista pública de horários melhora a experiência, mas não é a autoridade final.

As rotas de criação de agendamento e Pix continuam repetindo as validações de:

- expediente;
- conflito interno;
- pré-reserva Pix;
- Google Agenda;
- assinatura ativa;
- profissional e serviço ativos.

Isso evita corrida entre dois clientes que visualizam o mesmo horário ao mesmo tempo.

## Janela

A consulta pública aceita datas de até 90 dias no futuro.
