"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function normalizeSlug(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/businesses/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ name, slug: normalizeSlug(slug || name), phone }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível criar o negócio.");

      window.location.href = "/painel";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="card form-card">
        <div className="muted">CONFIGURAÇÃO INICIAL</div>
        <h1>Cadastre seu negócio</h1>
        <form onSubmit={submit} className="stack">
          <label>
            Nome do negócio
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Link desejado
            <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="minha-barbearia" />
          </label>
          <label>
            WhatsApp
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="81999999999" />
          </label>
          <button className="cta" type="submit" disabled={loading}>
            {loading ? "Criando..." : "Criar negócio"}
          </button>
        </form>
        {message && <p>{message}</p>}
      </div>
    </main>
  );
}
