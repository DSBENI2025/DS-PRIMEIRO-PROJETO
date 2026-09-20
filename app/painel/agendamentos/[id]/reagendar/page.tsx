"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Professional = {
  id: string;
  name: string;
  active: boolean;
};

type Appointment = {
  id: string;
  professional_id: string;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  end_time: string;
  status: string;
  services:
    | { name?: string; duration_minutes?: number }
    | { name?: string; duration_minutes?: number }[]
    | null;
  professionals:
    | { name?: string }
    | { name?: string }[]
    | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function recifeParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));

  const map = Object.fromEntries(
    parts
      .filter((item) => item.type !== "literal")
      .map((item) => [item.type, item.value])
  );

  return {
    date: map.year + "-" + map.month + "-" + map.day,
    time: map.hour + ":" + map.minute,
  };
}

function todayRecife() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const map = Object.fromEntries(
    parts
      .filter((item) => item.type !== "literal")
      .map((item) => [item.type, item.value])
  );

  return map.year + "-" + map.month + "-" + map.day;
}

export default function ReschedulePage() {
  const params = useParams<{ id: string }>();
  const appointmentId = String(params.id || "");

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function accessToken() {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  useEffect(() => {
    async function load() {
      const token = await accessToken();

      if (!token) {
        window.location.href =
          "/login?next=" +
          encodeURIComponent(
            "/painel/agendamentos/" + appointmentId + "/reagendar"
          );
        return;
      }

      const response = await fetch(
        "/api/appointments/" + encodeURIComponent(appointmentId),
        {
          headers: {
            Authorization: "Bearer " + token,
          },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.canReschedule) {
        setMessage(
          result.error || "Este agendamento não pode mais ser reagendado."
        );
        setLoaded(true);
        return;
      }

      const value = result.appointment as Appointment;
      const initial = recifeParts(value.start_time);

      setAppointment(value);
      setProfessionals(result.professionals || []);
      setProfessionalId(value.professional_id);
      setDate(initial.date);
      setTime(initial.time);
      setLoaded(true);
    }

    load();
  }, [appointmentId]);

  useEffect(() => {
    if (!loaded || !appointment || !professionalId || !date || success) {
      return;
    }

    const controller = new AbortController();

    async function loadAvailability() {
      setAvailabilityLoading(true);
      setMessage("");

      try {
        const token = await accessToken();
        if (!token) return;

        const query = new URLSearchParams({
          appointmentId,
          professionalId,
          date,
        });

        const response = await fetch(
          "/api/appointments/reschedule/availability?" + query.toString(),
          {
            headers: {
              Authorization: "Bearer " + token,
            },
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Não foi possível consultar horários."
          );
        }

        const nextSlots = Array.isArray(result.slots) ? result.slots : [];
        setSlots(nextSlots);
        setTime((current) =>
          current && nextSlots.includes(current) ? current : ""
        );

        if (nextSlots.length === 0) {
          setMessage("Não há horários livres nesta data.");
        } else if (result.googleChecked === false) {
          setMessage(
            "Horários internos atualizados. O Google será validado novamente ao confirmar."
          );
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSlots([]);
        setTime("");
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível consultar horários."
        );
      } finally {
        if (!controller.signal.aborted) {
          setAvailabilityLoading(false);
        }
      }
    }

    loadAvailability();

    return () => controller.abort();
  }, [
    loaded,
    appointment,
    appointmentId,
    professionalId,
    date,
    success,
  ]);

  async function submit() {
    if (!professionalId || !date || !time) {
      setMessage("Escolha profissional, data e horário.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const token = await accessToken();
      if (!token) return;

      const response = await fetch("/api/appointments/reschedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          appointmentId,
          professionalId,
          date,
          time,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Não foi possível reagendar o atendimento."
        );
      }

      setSuccess(true);
      setMessage(
        result.googleSynced === false
          ? "Reagendamento salvo. O Google Agenda não sincronizou e precisa ser conferido."
          : "Atendimento reagendado com sucesso."
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Erro inesperado."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <main><div className="card">Carregando agendamento...</div></main>;
  }

  if (!appointment) {
    return (
      <main>
        <div className="card form-card">
          <h1>Reagendamento indisponível</h1>
          {message && <p>{message}</p>}
          <a className="secondary" href="/painel">Voltar ao painel</a>
        </div>
      </main>
    );
  }

  const service = one(appointment.services);
  const currentProfessional = one(appointment.professionals);

  return (
    <main>
      <div className="row between">
        <div>
          <div className="muted">AGENDA PRO</div>
          <h1>Reagendar atendimento</h1>
          <p>
            {appointment.customer_name} · {service?.name || "Serviço"} ·{" "}
            {currentProfessional?.name || "Profissional"}
          </p>
        </div>
        <a className="secondary" href="/painel">Voltar ao painel</a>
      </div>

      <section className="card form-card">
        <div className="stack">
          <label>
            Profissional
            <select
              className="input"
              value={professionalId}
              disabled={success}
              onChange={(event) => {
                setProfessionalId(event.target.value);
                setTime("");
              }}
            >
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Nova data
            <input
              className="input"
              type="date"
              min={todayRecife()}
              value={date}
              disabled={success}
              onChange={(event) => {
                setDate(event.target.value);
                setTime("");
              }}
            />
          </label>

          <label>
            Novo horário
            <select
              className="input"
              value={time}
              disabled={success || availabilityLoading}
              onChange={(event) => setTime(event.target.value)}
            >
              <option value="">
                {availabilityLoading
                  ? "Consultando horários..."
                  : "Selecione"}
              </option>
              {slots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </label>

          {!success && (
            <button
              className="cta"
              onClick={submit}
              disabled={
                saving ||
                availabilityLoading ||
                !time ||
                slots.length === 0
              }
            >
              {saving ? "Reagendando..." : "Confirmar novo horário"}
            </button>
          )}

          {message && (
            <div className={success ? "success" : "booking-message"}>
              {message}
            </div>
          )}

          {success && (
            <a className="cta" href="/painel">
              Voltar aos agendamentos
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
