# Sinal Pix no agendamento

## Separação de contas

A cobrança mensal do Agenda Pro pertence à plataforma.

O sinal do agendamento pertence ao estabelecimento. Por isso, cada negócio
conecta a própria conta Mercado Pago por OAuth.

## Configuração da aplicação Mercado Pago

Na aplicação usada pelo Agenda Pro, configure a URL de redirecionamento:

`https://SEU-DOMINIO/api/mercadopago/callback`

Para desenvolvimento:

`http://localhost:3000/api/mercadopago/callback`

Variáveis necessárias:

- `MERCADO_PAGO_CLIENT_ID`
- `MERCADO_PAGO_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY`

A credencial da plataforma `MERCADO_PAGO_ACCESS_TOKEN` continua sendo usada
na cobrança da assinatura recorrente do Agenda Pro.

## Fluxo

1. O estabelecimento conecta o Mercado Pago pelo painel.
2. O Agenda Pro usa OAuth Authorization Code com PKCE.
3. Access token e refresh token ficam criptografados no banco.
4. O estabelecimento ativa o sinal Pix e escolhe o percentual.
5. O cliente escolhe serviço, profissional, data e horário.
6. O servidor cria uma pré-reserva de 30 minutos.
7. O Pix é criado usando o token Mercado Pago do estabelecimento.
8. O cliente recebe QR Code e Pix Copia e Cola.
9. O webhook de pagamento consulta a transação usando o token do vendedor.
10. Se aprovado, o banco converte a pré-reserva em agendamento confirmado.
11. Se o Pix expira ou é rejeitado, o horário volta a ficar disponível.

## Concorrência

A criação da pré-reserva usa lock transacional por profissional. O banco também
possui uma constraint de exclusão para impedir sobreposição de agendamentos
confirmados.

## Segurança

- tokens OAuth nunca são enviados ao navegador;
- tokens são criptografados antes de serem persistidos;
- endpoints administrativos exigem sessão autenticada;
- a página pública recebe somente dados necessários ao checkout;
- a confirmação do agendamento depende do webhook, não de uma resposta visual
  do navegador.

## Limitações desta versão

- cancelamento de agendamento pago não dispara reembolso automaticamente;
- o sinal é calculado sobre o valor integral do serviço;
- o prazo da pré-reserva está fixado em 30 minutos.
