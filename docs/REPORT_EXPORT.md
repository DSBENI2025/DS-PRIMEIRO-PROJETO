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

## Observação financeira

O campo de valor do serviço segue o mesmo modelo atual dos relatórios do Agenda Pro e usa o preço cadastrado no serviço. Um snapshot imutável de preço por atendimento deve ser adotado para histórico financeiro definitivo quando o produto avançar para conciliação contábil.
