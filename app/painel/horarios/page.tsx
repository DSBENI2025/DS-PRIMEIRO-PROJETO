"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Day = {
  weekday: number;
  label: string;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
};

const labels = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function HorariosPage() {
  const [businessId, setBusinessId] = useState("");
  const [days, setDays] = useState<Day[]>(
    labels.map((label, weekday) => ({
      weekday,
      label,
      opens_at: "08:00",
      closes_at: "18:00",
      is_closed: weekday === 0 || weekday === 6,
    }))
  );
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

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription?.status !== "authorized") {
        window.location.href = "/painel";
        return;
      }

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (!business) {
        window.location.href = "/onboarding";
        return;
      }

      setBusinessId(business.id);

      const { data: saved } = await supabase
        .from("business_hours")
        .select("weekday,opens_at,closes_at,is_closed")
        .eq("business_id", business.id);

      if (saved) {
        setDays((current) =>
          current.map((day) => {
            const value = saved.find((item) => item.weekday === day.weekday);
            if (!value) return day;
            return {
              ...day,
              opens_at: value.opens_at?.slice(0, 5) || "08:00",
              closes_at: value.closes_at?.slice(0, 5) || "18:00",
              is_closed: value.is_closed,
            };
          })
        );
      }

      setLoading(false);
    }

    load();
  }, []);

  function updateDay(weekday: number, patch: Partial<Day>) {
    setDays((current) =>
      current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day))
    );
  }

  async function save() {
    setMessage("");
    const supabase = getSupabaseBrowser();

    const payload = days.map((day) => ({
      business_id: businessId,
      weekday: day.weekday,
      opens_at: day.is_closed ? null : day.opens_at,
      closes_at: day.is_closed ? null : day.closes_at,
      is_closed: day.is_closed,
    }));

    const { error } = await supabase
      .from("business_hours")
      .upsert(payload, { onConflict: "business_id,weekday" });

    setMessage(error ? error.message : "Horários salvos.");
  }

  if (loading) {
    return <main><div className="card">Carregando horários...</div></main>;
  }

  return (
    <main>
      <div className="row between">
        <div>
          <div className="muted">AGENDA PRO</div>
          <h1>Horários de atendimento</h1>
        </div>
        <a className="secondary" href="/painel">Voltar</a>
      </div>

      <div className="card">
        <div className="list">
          {days.map((day) => (
            <div className="schedule-row" key={day.weekday}>
              <strong>{day.label}</strong>

              <label className="closed-toggle">
                <input
                  type="checkbox"
                  checked={day.is_closed}
                  onChange={(e) => updateDay(day.weekday, { is_closed: e.target.checked })}
                />
                Fechado
              </label>

              <input
                className="input compact"
                type="time"
                disabled={day.is_closed}
                value={day.opens_at}
                onChange={(e) => updateDay(day.weekday, { opens_at: e.target.value })}
              />

              <span>até</span>

              <input
                className="input compact"
                type="time"
                disabled={day.is_closed}
                value={day.closes_at}
                onChange={(e) => updateDay(day.weekday, { closes_at: e.target.value })}
              />
            </div>
          ))}
        </div>

        <button className="cta" onClick={save}>Salvar horários</button>
        {message && <p>{message}</p>}
      </div>
    </main>
  );
}
