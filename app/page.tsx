"use client";

import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function assinar() {
    setError("");
    if (!email) return setError("Informe seu e-mail.");
    setLoading(true);

    try {
      const res = await fetch("/api/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível criar a assinatura.");
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="card">
        <div className="muted">AGENDA PRO</div>
        <h1>Agendamento simples. Receita recorrente.</h1>
        <p>Uma página de agendamento para profissionais e pequenos negócios, com gestão de horários e assinatura mensal.</p>

        <div className="price">R$ 39,90/mês</div>

        <ul className="features">
          <li>Link próprio de agendamento</li>
          <li>Gestão de serviços e horários</li>
          <li>Painel de agendamentos</li>
          <li>Integração preparada para Google Agenda</li>
          <li>Assinatura recorrente</li>
        </ul>

        <div style={{ maxWidth: 420 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            style={{ width: "100%", padding: 14, border: "1px solid #d7d7da", borderRadius: 10, fontSize: 16 }}
          />

          {error && <p style={{ color: "#b00020" }}>{error}</p>}

          <button className="cta" onClick={assinar} disabled={loading}>
            {loading ? "Criando assinatura..." : "Assinar Agenda Pro"}
          </button>
        </div>
      </div>
    </main>
  );
}
