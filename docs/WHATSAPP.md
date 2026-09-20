# WhatsApp automático

O Agenda Pro usa a WhatsApp Cloud API para mensagens transacionais relacionadas ao agendamento.

## Consentimento

O cliente pode concluir o agendamento sem aceitar mensagens automáticas.

Quando ele marca a opção de consentimento, o sistema registra:
- `whatsapp_opt_in = true`
- horário do consentimento

Sem consentimento, nenhuma notificação WhatsApp é enviada pelo Agenda Pro.

## Variáveis de ambiente

Configure no servidor:

- `WHATSAPP_GRAPH_VERSION`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_TEMPLATE_LANGUAGE` — padrão `pt_BR`
- `WHATSAPP_TEMPLATE_PIX_PENDING`
- `WHATSAPP_TEMPLATE_BOOKING_CONFIRMED`
- `WHATSAPP_TEMPLATE_REMINDER`
- `WHATSAPP_TEMPLATE_FOLLOWUP`
- `NOTIFICATION_CRON_SECRET`

Nunca coloque tokens reais no GitHub.

## Templates

Crie e aprove estes templates como categoria Utility na conta WhatsApp Business.

### Pix pendente

O template configurado em `WHATSAPP_TEMPLATE_PIX_PENDING` recebe, nesta ordem:

1. nome do cliente
2. nome do estabelecimento
3. serviço
4. valor do sinal
5. horário limite do Pix

### Agendamento confirmado

O template configurado em `WHATSAPP_TEMPLATE_BOOKING_CONFIRMED` recebe:

1. nome do cliente
2. nome do estabelecimento
3. serviço
4. data
5. horário
6. profissional

### Lembrete

O template configurado em `WHATSAPP_TEMPLATE_REMINDER` recebe:

1. nome do cliente
2. nome do estabelecimento
3. serviço
4. data
5. horário
6. profissional

### Pós-atendimento

O template configurado em `WHATSAPP_TEMPLATE_FOLLOWUP` recebe:

1. nome do cliente
2. nome do estabelecimento
3. serviço

## Agendador de lembretes

O arquivo `.github/workflows/notifications.yml` chama o processador de lembretes a cada 5 minutos.

Adicione estes GitHub Actions secrets:

- `AGENDA_PRO_BASE_URL` — exemplo: `https://agenda-pro.seudominio.com`
- `NOTIFICATION_CRON_SECRET` — deve ser o mesmo valor configurado no servidor

O endpoint protegido é:

`POST /api/notifications/process`

A tabela `notification_logs` impede envio duplicado da mesma mensagem.

## Fluxos

### Sem Pix

Agendamento confirmado -> WhatsApp de confirmação -> lembrete -> profissional marca concluído -> pós-atendimento.

### Com Pix

Pix gerado -> aviso de Pix pendente -> pagamento aprovado -> confirmação -> lembrete -> concluído -> pós-atendimento.
