"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Professional = {
  id: string;
  name: string;
  active: boolean;
};

type TeamMember = {
  id: string;
  email: string | null;
  role: "admin" | "professional";
  professional_id: string | null;
  active: boolean;
  professionals?: { name?: string } | { name?: string }[] | null;
};

type Invitation = {
  id: string;
  email: string;
  role: "admin" | "professional";
  professional_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  professionals?: { name?: string } | { name?: string }[] | null;
};

function linkedProfessional(
  value: TeamMember["professionals"] | Invitation["professionals"]
) {
  if (!value) return null;
  return Array.isArray(value) ? value[0]?.name || null : value.name || null;
}

export default function TeamPage() {
  const [currentRole, setCurrentRole] = useState<"owner" | "admin">("owner");
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "professional">("professional");
  const [professionalId, setProfessionalId] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function token() {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function load() {
    const accessToken = await token();

    if (!accessToken) {
      window.location.href = "/login?next=/painel/equipe";
      return;
    }

    const response = await fetch("/api/team", {
      headers: {
        Authorization: "Bearer " + accessToken,
      },
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      if (response.status === 403) {
        window.location.href = "/painel";
        return;
      }

      setMessage(result.error || "Não foi possível carregar a equipe.");
      setLoading(false);
      return;
    }

    setCurrentRole(result.currentRole);
    setOwnerEmail(result.owner?.email || null);
    setMembers((result.members || []).filter((item: TeamMember) => item.active));
    setInvitations(
      (result.invitations || []).filter(
        (item: Invitation) =>
          !item.accepted_at && new Date(item.expires_at).getTime() > Date.now()
      )
    );
    setProfessionals(result.professionals || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createInvite() {
    setMessage("");
    setInviteUrl("");

    const accessToken = await token();
    if (!accessToken) return;

    const response = await fetch("/api/team/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
      body: JSON.stringify({
        email,
        role,
        professionalId: role === "professional" ? professionalId : null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "Não foi possível criar o convite.");
      return;
    }

    setInviteUrl(result.inviteUrl);
    setMessage(
      "Convite criado. Copie o link abaixo e envie somente para a pessoa convidada."
    );
    setEmail("");
    await load();
  }

  async function removeMember(id: string) {
    const accessToken = await token();
    if (!accessToken) return;

    const response = await fetch("/api/team/members/" + encodeURIComponent(id), {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "Não foi possível remover o acesso.");
      return;
    }

    setMessage("Acesso removido.");
    await load();
  }

  async function cancelInvite(id: string) {
    const accessToken = await token();
    if (!accessToken) return;

    const response = await fetch(
      "/api/team/invitations/" + encodeURIComponent(id),
      {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + accessToken,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "Não foi possível cancelar o convite.");
      return;
    }

    setMessage("Convite cancelado.");
    await load();
  }

  if (loading) {
    return <main><div className="card">Carregando equipe...</div></main>;
  }

  return (
    <main>
      <div className="row between">
        <div>
          <div className="muted">AGENDA PRO</div>
          <h1>Equipe e acessos</h1>
          <p>
            Administradores gerenciam o negócio. Profissionais acessam somente
            a própria agenda e horários.
          </p>
        </div>
        <a className="secondary" href="/painel">Voltar ao painel</a>
      </div>

      <section className="card">
        <h2>Novo convite</h2>

        <div className="team-invite-grid">
          <label>
            E-mail
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="profissional@email.com"
            />
          </label>

          <label>
            Acesso
            <select
              className="input"
              value={role}
              onChange={(event) => {
                const value = event.target.value as "admin" | "professional";
                setRole(value);
                if (value === "admin") setProfessionalId("");
              }}
            >
              <option value="professional">Profissional</option>
              {currentRole === "owner" && (
                <option value="admin">Administrador</option>
              )}
            </select>
          </label>

          {role === "professional" && (
            <label>
              Vincular ao profissional
              <select
                className="input"
                value={professionalId}
                onChange={(event) => setProfessionalId(event.target.value)}
              >
                <option value="">Selecione</option>
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button className="cta" onClick={createInvite}>
            Gerar link de convite
          </button>
        </div>

        {inviteUrl && (
          <div className="invite-result">
            <div className="public-link">{inviteUrl}</div>
            <button
              className="secondary"
              onClick={() => navigator.clipboard.writeText(inviteUrl)}
            >
              Copiar convite
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Acessos ativos</h2>

        <div className="list">
          <div className="list-item">
            <strong>{ownerEmail || "Proprietário"}</strong>
            <span>Proprietário · acesso total</span>
          </div>

          {members.map((member) => (
            <div className="list-item" key={member.id}>
              <strong>{member.email || "Usuário"}</strong>
              <span>
                {member.role === "admin" ? "Administrador" : "Profissional"}
                {linkedProfessional(member.professionals)
                  ? " · " + linkedProfessional(member.professionals)
                  : ""}
              </span>
              {(currentRole === "owner" || member.role !== "admin") && (
                <button
                  className="danger-link"
                  onClick={() => removeMember(member.id)}
                >
                  Remover acesso
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Convites pendentes</h2>

        <div className="list">
          {invitations.length === 0 && <p>Nenhum convite pendente.</p>}

          {invitations.map((invitation) => (
            <div className="list-item" key={invitation.id}>
              <strong>{invitation.email}</strong>
              <span>
                {invitation.role === "admin" ? "Administrador" : "Profissional"}
                {linkedProfessional(invitation.professionals)
                  ? " · " + linkedProfessional(invitation.professionals)
                  : ""}
                {" · expira em "}
                {new Date(invitation.expires_at).toLocaleDateString("pt-BR")}
              </span>
              <button
                className="danger-link"
                onClick={() => cancelInvite(invitation.id)}
              >
                Cancelar convite
              </button>
            </div>
          ))}
        </div>
      </section>

      {message && <p>{message}</p>}
    </main>
  );
}
