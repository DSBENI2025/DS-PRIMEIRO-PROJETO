"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function login() {
    setMessage("");
    const supabase = getSupabaseBrowser();
    const result = await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    window.location.href = "/painel";
  }

  async function cadastro() {
    setMessage("");
    const supabase = getSupabaseBrowser();
    const result = await supabase.auth.signUp({ email, password });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage("Conta criada. Confirme seu e-mail caso essa opção esteja ativa.");
  }

  return (
    <main>
      <div className="card form-card">
        <div className="muted">AGENDA PRO</div>
        <h1>Acessar painel</h1>
        <div className="stack">
          <input className="input" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="cta" onClick={login}>Entrar</button>
          <button className="secondary" onClick={cadastro}>Criar conta</button>
        </div>
        {message && <p>{message}</p>}
      </div>
    </main>
  );
}
