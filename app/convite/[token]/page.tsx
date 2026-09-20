"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function AcceptInvitationPage() {
  const params = useParams<{ token: string }>();
  const inviteToken = String(params.token || "");
  const [authenticated, setAuthenticated] = useState(false);
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      setAuthenticated(Boolean(data.session));
      setLoading(false);
    }

    check();
  }, []);

  async function accept() {
    setMessage("");
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      setAuthenticated(false);
      return;
    }

    const response = await fetch("/api/team/invitations/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
      body: JSON.stringify({ token: inviteToken }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "Não foi possível aceitar o convite.");
      return;
    }

    setAccepted(true);
    setMessage("Convite aceito. Seu acesso à equipe está ativo.");
  }

  const nextPath = "/convite/" + encodeURIComponent(inviteToken);

  if (loading) {
    return <main><div className="card form-card">Carregando convite...</div></main>;
  }

  return (
    <main>
      <div className="card form-card">
        <div className="muted">AGENDA PRO</div>
        <h1>Convite para equipe</h1>

        {!authenticated ? (
          <>
            <p>
              Entre ou crie sua conta usando exatamente o e-mail que recebeu o
              convite.
            </p>
            <a
              className="cta"
              href={"/login?next=" + encodeURIComponent(nextPath)}
            >
              Entrar ou criar conta
            </a>
          </>
        ) : accepted ? (
          <a className="cta" href="/painel">
            Abrir meu painel
          </a>
        ) : (
          <>
            <p>
              Confirme para vincular sua conta a este estabelecimento.
            </p>
            <button className="cta" onClick={accept}>
              Aceitar convite
            </button>
          </>
        )}

        {message && <p>{message}</p>}
      </div>
    </main>
  );
}
