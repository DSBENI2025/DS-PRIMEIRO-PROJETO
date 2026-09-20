"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Appointment = {
  id: string;
  business_id: string;
  service_id: string;
  professional_id: string;
  customer_name: string;
  start_time: string;
  end_time: string;
  status: string;
  businesses?: { name?: string; phone?: string | null } | { name?: string; phone?: string | null }[] | null;
  services?: { name?: string; duration_minutes?: number; price_cents?: number } | { name?: string; duration_minutes?: number; price_cents?: number }[] | null;
  professionals?: { name?: string } | { name?: string }[] | null;
};

type Professional = { id: string; name: string };
type Payment = { amount_cents: number; status: string; paid_at: string | null } | null;

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function recifeDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function recifeDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function CustomerAppointmentPage() {
  const params = useParams<{ token: string }>();
  const token = String(params.token || "");
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [payment, setPayment] = useState<Payment>(null);
  const [canCancel, setCanCancel] = useState(false);
  const [canReschedule, setCanReschedule] = useState(false);
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel">("view");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    setLoading(true);

    const response = await fetch(
      "/api/customer/appointment?token=" + encodeURIComponent(token),
      { cache: "no-store" }
    );

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "Não foi possível carregar o agendamento.");
      setLoading(false);
      return;
    }

    setAppointment(result.appointment);
    setProfessionals(result.professionals || []);
    setPayment(result.payment || null);
    setCanCancel(Boolean(result.canCancel));
    setCanReschedule(Boolean(result.canReschedule));
    setProfessionalId(result.appointment.professional_id);
    setDate(recifeDate(result.appointment.start_time));
    setTime("");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    if (
      mode !== "reschedule" ||
      !professionalId ||
      !date ||
      !canReschedule
    ) {
      return;
    }

    const controller = new AbortController();
    setAvailabilityLoading(true);
    setMessage("");

    const query = new URLSearchParams({
      token,
      professionalId,
      date,
    });

    fetch("/api/customer/appointment/availability?" + query.toString(), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Não foi possível consultar horários.");
        }

        setSlots(Array.isArray(result.slots) ? result.slots : []);
        setTime((current) =>
          current && result.slots?.includes(current) ? current : ""
        );

        if (result.googleChecked === false) {
          setMessage(
            "A disponibilidade interna foi carregada. O Google Agenda será validado novamente ao confirmar."
          );
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSlots([]);
        setTime("");
        setMessage(
          error instanceof Error ? error.message : "Falha ao consultar horários."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setAvailabilityLoading(false);
      });

    return () => controller.abort();
  }, [mode, professionalId, date, token, canReschedule]);

  const business = useMemo(
    () => one(appointment?.businesses),
    [appointment]
  );
  const service = useMemo(
    () => one(appointment?.services),
    [appointment]
  );
  const professional = useMemo(
    () => one(appointment?.professionals),
    [appointment]
  );

  async function cancelAppointment() {
    setActionLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/customer/appointment/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível cancelar.");
      }

      setMessage(
        result.paidSignal
          ? "Agendamento cancelado. O sinal já pago não é reembolsado automaticamente; fale com o estabelecimento sobre a política de reembolso."
          : "Agendamento cancelado."
      );
      setMode("view");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao cancelar."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function rescheduleAppointment() {
    if (!professionalId || !date || !time) {
      setMessage("Escolha profissional, data e horário.");
      return;
    }

    setActionLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/customer/appointment/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          professionalId,
          date,
          time,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível reagendar.");
      }

      setMessage(
        result.googleSynced === false
          ? "Agendamento reagendado. A sincronização com o Google Agenda precisa ser conferida pelo estabelecimento."
          : "Agendamento reagendado com sucesso."
      );
      setMode("view");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao reagendar."
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main>
        <div className="card form-card">Carregando seu agendamento...</div>
      </main>
    );
  }

  if (!appointment) {
    return (
      <main>
        <div className="card form-card">
          <h1>Agendamento indisponível</h1>
          <p>{message || "Este link não está mais disponível."}</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="customer-portal">
        <section className="card">
          <div className="muted">MEU AGENDAMENTO</div>
          <h1>{business?.name || "Agenda Pro"}</h1>

          <div className="appointment-summary">
            <div>
              <span>Serviço</span>
              <strong>{service?.name || "Serviço"}</strong>
            </div>
            <div>
              <span>Profissional</span>
              <strong>{professional?.name || "Profissional"}</strong>
            </div>
            <div>
              <span>Data e horário</span>
              <strong>{recifeDateTime(appointment.start_time)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{appointment.status}</strong>
            </div>
          </div>

          {payment?.status === "approved" && (
            <div className="deposit-note">
              Sinal pago: <strong>{brl(payment.amount_cents)}</strong>.
              Reagendar não gera uma nova cobrança.
            </div>
          )}

          {mode === "view" && appointment.status === "confirmed" && (
            <div className="appointment-actions">
              {canReschedule && (
                <button
                  className="cta"
                  onClick={() => {
                    setMode("reschedule");
                    setMessage("");
                  }}
                >
                  Reagendar
                </button>
              )}
              {canCancel && (
                <button
                  className="secondary"
                  onClick={() => {
                    setMode("cancel");
                    setMessage("");
                  }}
                >
                  Cancelar agendamento
                </button>
              )}
            </div>
          )}

          {mode === "reschedule" && (
            <div className="self-service-form">
              <h2>Escolha o novo horário</h2>

              <label>
                Profissional
                <select
                  className="input"
                  value={professionalId}
                  onChange={(event) => {
                    setProfessionalId(event.target.value);
                    setTime("");
                  }}
                >
                  {professionals.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Data
                <input
                  className="input"
                  type="date"
                  min={recifeDate(new Date().toISOString())}
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setTime("");
                  }}
                />
              </label>

              <label>
                Horário
                <select
                  className="input"
                  value={time}
                  disabled={availabilityLoading}
                  onChange={(event) => setTime(event.target.value)}
                >
                  <option value="">
                    {availabilityLoading ? "Consultando..." : "Selecione"}
                  </option>
                  {slots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>

              {!availabilityLoading && slots.length === 0 && (
                <p>Não há horários livres nessa data.</p>
              )}

              <div className="appointment-actions">
                <button
                  className="cta"
                  disabled={actionLoading || !time}
                  onClick={rescheduleAppointment}
                >
                  {actionLoading ? "Reagendando..." : "Confirmar novo horário"}
                </button>
                <button
                  className="secondary"
                  onClick={() => setMode("view")}
                >
                  Voltar
                </button>
              </div>
            </div>
          )}

          {mode === "cancel" && (
            <div className="booking-message">
              <strong>Confirmar cancelamento?</strong>
              <p>
                O horário será liberado imediatamente.
                {payment?.status === "approved"
                  ? " O reembolso do sinal não acontece automaticamente."
                  : ""}
              </p>
              <div className="appointment-actions">
                <button
                  className="danger-button"
                  disabled={actionLoading}
                  onClick={cancelAppointment}
                >
                  {actionLoading ? "Cancelando..." : "Sim, cancelar"}
                </button>
                <button
                  className="secondary"
                  onClick={() => setMode("view")}
                >
                  Manter agendamento
                </button>
              </div>
            </div>
          )}

          {business?.phone && (
            <p>
              Precisa de ajuda? Entre em contato com o estabelecimento:{" "}
              <strong>{business.phone}</strong>
            </p>
          )}

          {message && (
            <div className="booking-message">{message}</div>
          )}
        </section>
      </div>
    </main>
  );
}
