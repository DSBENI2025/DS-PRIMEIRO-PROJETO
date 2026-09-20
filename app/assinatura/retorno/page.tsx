export default function RetornoAssinatura() {
  return (
    <main>
      <div className="card form-card">
        <div className="muted">AGENDA PRO</div>
        <h1>Assinatura recebida</h1>
        <p>
          O Mercado Pago está confirmando sua assinatura. O painel será liberado
          automaticamente quando o status mudar para autorizado.
        </p>
        <a className="cta" href="/painel">Voltar ao painel</a>
      </div>
    </main>
  );
}
