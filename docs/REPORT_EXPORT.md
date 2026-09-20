# Exportação CSV de relatórios

A área de relatórios permite exportar os atendimentos dos períodos de 7, 30 ou 90 dias.

Rota da API:

`GET /api/reports/export?days=30`

## Permissões

Somente:

- proprietário;
- administrador.

Profissionais não podem exportar o relatório global do estabelecimento.

A assinatura do Agenda Pro também precisa estar ativa.

## Colunas exportadas

- data;
- hora;
- cliente;
- WhatsApp;
- e-mail;
- serviço;
- profissional;
- status;
- valor do serviço;
- sinal Pix;
- status do Pix;
- data do pagamento Pix;
- ID do agendamento.

## Compatibilidade

O arquivo:

- usa UTF-8 com BOM;
- usa ponto e vírgula como separador;
- protege células iniciadas por `=`, `+`, `-` ou `@` contra formula injection;
- pode ser aberto em Excel, Google Sheets e ferramentas equivalentes.

## Valor histórico

O campo de valor do serviço usa `appointments.service_price_cents`, congelado no momento em que o atendimento é criado.

Se o estabelecimento reajustar o preço do serviço depois, relatórios e exportações de atendimentos já existentes preservam o valor original.

Atendimentos antigos existentes antes da migration `000009` são preenchidos com a melhor referência disponível no momento da migração: primeiro o snapshot do Pix, quando existir; caso contrário, o preço atual do serviço naquele momento.
