"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

function safeNext() {
  if (typeof window === "undefined") return "/painel";

  const next = new URLSearchParams(window.location.search).get("next") || "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/painel";
}

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

    window.location.href = safeNext();
  }

  async function cadastro() {
    setMessage("");
    const supabase = getSupabaseBrowser();
    const next = safeNext();
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          window.location.origin +
          "/login?next=" +
          encodeURIComponent(next),
      },
    });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (result.data.session) {
      window.location.href = next;
      return;
    }

    setMessage(
      "Conta criada. Confirme seu e-mail e depois entre para continuar."
    );
  }

  return (
    <main>
      <div className="card form-card">
        <div className="muted">AGENDA PRO</div>
        <h1>Acessar painel</h1>
        <div className="stack">
          <input
            className="input"
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="cta" onClick={login}>Entrar</button>
          <button className="secondary" onClick={cadastro}>Criar conta</button>
        </div>
        {message && <p>{message}</p>}
      </div>
    </main>
  );
}
