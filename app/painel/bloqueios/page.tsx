"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Professional = {
  id: string;
  name: string;
  active: boolean;
};

type Block = {
  id: string;
  professional_id: string | null;
  start_time: string;
  end_time: string;
  reason: string | null;
  professionals?: { name?: string } | { name?: string }[] | null;
};

function professionalName(value: Block["professionals"]) {
  if (!value) return null;
  return Array.isArray(value) ? value[0]?.name || null : value.name || null;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ScheduleBlocksPage() {
  const [role, setRole] = useState<"owner" | "admin" | "professional">("owner");
  const [myProfessionalId, setMyProfessionalId] = useState<string | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [professionalId, setProfessionalId] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function accessToken() {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function load() {
    const token = await accessToken();

    if (!token) {
      window.location.href = "/login?next=/painel/bloqueios";
      return;
    }

    const response = await fetch("/api/blocks", {
      headers: {
        Authorization: "Bearer " + token,
      },
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "Não foi possível carregar os bloqueios.");
      setLoading(false);
      return;
    }

    setRole(result.role);
    setMyProfessionalId(result.professionalId || null);
    setProfessionals(result.professionals || []);
    setBlocks(result.blocks || []);

    if (result.role === "professional" && result.professionalId) {
      setProfessionalId(result.professionalId);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createBlock() {
    setMessage("");
    const token = await accessToken();
    if (!token) return;

    const response = await fetch("/api/blocks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        professionalId:
          role === "professional" ? myProfessionalId : professionalId || null,
        startLocal,
        endLocal,
        reason,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "Não foi possível criar o bloqueio.");
      return;
    }

    setMessage("Período bloqueado. Os horários deixaram de aparecer para clientes.");
    setStartLocal("");
    setEndLocal("");
    setReason("");
    await load();
  }

  async function removeBlock(id: string) {
    const token = await accessToken();
    if (!token) return;

    const response = await fetch("/api/blocks/" + encodeURIComponent(id), {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "Não foi possível remover o bloqueio.");
      return;
    }

    setMessage("Bloqueio removido.");
    await load();
  }

  if (loading) {
    return <main><div className="card">Carregando bloqueios...</div></main>;
  }

  return (
    <main>
      <div className="row between">
        <div>
          <div className="muted">AGENDA PRO</div>
          <h1>Folgas e bloqueios</h1>
          <p>
            Bloqueie almoço, compromisso, férias ou qualquer período em que não
            devem entrar novos agendamentos.
          </p>
        </div>
        <a className="secondary" href="/painel">Voltar ao painel</a>
      </div>

      <section className="card">
        <h2>Novo bloqueio</h2>

        <div className="block-form-grid">
          {role !== "professional" && (
            <label>
              Aplicar a
              <select
                className="input"
                value={professionalId}
                onChange={(event) => setProfessionalId(event.target.value)}
              >
                <option value="">Todo o estabelecimento</option>
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Início
            <input
              className="input"
              type="datetime-local"
              value={startLocal}
              onChange={(event) => setStartLocal(event.target.value)}
            />
          </label>

          <label>
            Fim
            <input
              className="input"
              type="datetime-local"
              value={endLocal}
              onChange={(event) => setEndLocal(event.target.value)}
            />
          </label>

          <label>
            Motivo
            <input
              className="input"
              value={reason}
              maxLength={160}
              placeholder="Ex.: almoço, férias, consulta"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          <button className="cta" onClick={createBlock}>
            Bloquear período
          </button>
        </div>

        {message && <p>{message}</p>}
      </section>

      <section className="card">
        <h2>Bloqueios recentes e futuros</h2>

        <div className="list">
          {blocks.length === 0 && <p>Nenhum período bloqueado.</p>}

          {blocks.map((block) => {
            const ownBlock =
              role !== "professional" ||
              block.professional_id === myProfessionalId;

            return (
              <div className="list-item" key={block.id}>
                <strong>
                  {block.professional_id
                    ? professionalName(block.professionals) || "Profissional"
                    : "Todo o estabelecimento"}
                </strong>
                <span>
                  {formatDateTime(block.start_time)} até{" "}
                  {formatDateTime(block.end_time)}
                </span>
                {block.reason && <span>{block.reason}</span>}

                {ownBlock && (
                  <button
                    className="danger-link"
                    onClick={() => removeBlock(block.id)}
                  >
                    Remover bloqueio
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
