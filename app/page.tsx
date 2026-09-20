export default function Home() {
  return (
    <main>
      <div className="card hero">
        <div className="muted">AGENDA PRO</div>
        <h1>Seu negócio agendando sozinho.</h1>
        <p>
          Página própria de agendamento, serviços, profissionais, horários e painel
          centralizado para pequenos negócios.
        </p>

        <div className="price">R$ 39,90/mês</div>

        <ul className="features">
          <li>Link próprio para enviar no WhatsApp e Instagram</li>
          <li>Cliente escolhe serviço, profissional, data e horário</li>
          <li>Bloqueio automático de conflito de agenda</li>
          <li>Painel com próximos agendamentos</li>
          <li>Cobrança recorrente integrada</li>
        </ul>

        <div className="row actions">
          <a className="cta" href="/login">Criar conta</a>
          <a className="secondary" href="/login">Já sou cliente</a>
        </div>
      </div>
    </main>
  );
}
