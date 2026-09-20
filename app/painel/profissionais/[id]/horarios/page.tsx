"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Day = {
  weekday: number;
  label: string;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
};

const labels = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export default function ProfessionalHoursPage() {
  const params = useParams<{ id: string }>();
  const professionalId = String(params.id || "");
  const [professionalName, setProfessionalName] = useState("");
  const [days, setDays] = useState<Day[]>([]);
  const [customized, setCustomized] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleInherited, setGoogleInherited] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowser();
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        window.location.href = "/login";
        return;
      }

      const { data: professional } = await supabase
        .from("professionals")
        .select("id,name,business_id")
        .eq("id", professionalId)
        .maybeSingle();

      if (!professional) {
        setMessage("Profissional não encontrado.");
        setLoading(false);
        return;
      }

      setProfessionalName(professional.name);

      const [{ data: custom }, { data: businessHours }, googleStatusResponse] = await Promise.all([
        supabase
          .from("professional_hours")
          .select("weekday,opens_at,closes_at,is_closed")
          .eq("professional_id", professionalId)
          .order("weekday"),
        supabase
          .from("business_hours")
          .select("weekday,opens_at,closes_at,is_closed")
          .eq("business_id", professional.business_id)
          .order("weekday"),
        fetch(
          "/api/google/status?professionalId=" +
            encodeURIComponent(professionalId),
          {
            headers: {
              Authorization:
                "Bearer " + session.session.access_token,
            },
          }
        ),
      ]);

      if (googleStatusResponse.ok) {
        const googleStatus = await googleStatusResponse.json();
        setGoogleConnected(Boolean(googleStatus.connected));
        setGoogleInherited(Boolean(googleStatus.inherited));
      }

      const hasCustom = Boolean(custom && custom.length > 0);
      setCustomized(hasCustom);

      const source = hasCustom ? custom || [] : businessHours || [];

      setDays(
        labels.map((label, weekday) => {
          const value = source.find((item) => item.weekday === weekday);

          return {
            weekday,
            label,
            opens_at: value?.opens_at?.slice(0, 5) || "08:00",
            closes_at: value?.closes_at?.slice(0, 5) || "18:00",
            is_closed: value ? Boolean(value.is_closed) : true,
          };
        })
      );

      setLoading(false);
    }

    load();
  }, [professionalId]);

  function updateDay(weekday: number, patch: Partial<Day>) {
    setDays((current) =>
      current.map((day) =>
        day.weekday === weekday ? { ...day, ...patch } : day
      )
    );
  }

  async function connectGoogle() {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) return;

    const response = await fetch("/api/google/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ professionalId }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(
        result.error || "Não foi possível conectar o Google Agenda."
      );
      return;
    }

    window.location.href = result.authorizationUrl;
  }

  async function disconnectGoogle() {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) return;

    const response = await fetch("/api/google/disconnect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ professionalId }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(
        result.error || "Não foi possível desconectar o Google Agenda."
      );
      return;
    }

    window.location.reload();
  }

  async function save() {
    setMessage("");
    const supabase = getSupabaseBrowser();

    const payload = days.map((day) => ({
      professional_id: professionalId,
      weekday: day.weekday,
      opens_at: day.is_closed ? null : day.opens_at,
      closes_at: day.is_closed ? null : day.closes_at,
      is_closed: day.is_closed,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("professional_hours")
      .upsert(payload, { onConflict: "professional_id,weekday" });

    if (error) {
      setMessage(error.message);
      return;
    }

    setCustomized(true);
    setMessage("Horários individuais salvos.");
  }

  async function resetToBusinessHours() {
    setMessage("");
    const supabase = getSupabaseBrowser();

    const { error } = await supabase
      .from("professional_hours")
      .delete()
      .eq("professional_id", professionalId);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.reload();
  }

  if (loading) {
    return <main><div className="card">Carregando horários...</div></main>;
  }

  return (
    <main>
      <div className="row between">
        <div>
          <div className="muted">AGENDA PRO</div>
          <h1>{professionalName}</h1>
          <p>
            {customized
              ? "Este profissional usa horários próprios."
              : "Este profissional está herdando o horário geral do negócio."}
          </p>
        </div>
        <a className="secondary" href="/painel">Voltar ao painel</a>
      </div>

      <section className="card">
        <div className="row between">
          <div>
            <h2>Google Agenda</h2>
            <p>
              {googleConnected
                ? "Este profissional possui um Google Agenda próprio conectado."
                : googleInherited
                  ? "Este profissional está usando o Google Agenda geral do estabelecimento."
                  : "Nenhum Google Agenda está disponível para este profissional."}
            </p>
          </div>

          {googleConnected ? (
            <button className="secondary" onClick={disconnectGoogle}>
              Desconectar agenda própria
            </button>
          ) : (
            <button className="cta" onClick={connectGoogle}>
              Conectar Google deste profissional
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Disponibilidade semanal</h2>

        <div className="list">
          {days.map((day) => (
            <div className="schedule-row" key={day.weekday}>
              <strong>{day.label}</strong>

              <label className="closed-toggle">
                <input
                  type="checkbox"
                  checked={day.is_closed}
                  onChange={(e) =>
                    updateDay(day.weekday, { is_closed: e.target.checked })
                  }
                />
                Folga
              </label>

              <input
                className="input compact"
                type="time"
                disabled={day.is_closed}
                value={day.opens_at}
                onChange={(e) =>
                  updateDay(day.weekday, { opens_at: e.target.value })
                }
              />

              <span>até</span>

              <input
                className="input compact"
                type="time"
                disabled={day.is_closed}
                value={day.closes_at}
                onChange={(e) =>
                  updateDay(day.weekday, { closes_at: e.target.value })
                }
              />
            </div>
          ))}
        </div>

        <div className="appointment-actions">
          <button className="cta" onClick={save}>
            Salvar agenda individual
          </button>

          {customized && (
            <button className="secondary" onClick={resetToBusinessHours}>
              Voltar a usar horário geral
            </button>
          )}
        </div>

        {message && <p>{message}</p>}
      </section>
    </main>
  );
}
