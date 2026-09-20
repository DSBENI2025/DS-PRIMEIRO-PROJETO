"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type HistoryItem = {
  id: string;
  event_type: "created" | "rescheduled" | "cancelled" | "status_changed";
  actor_type: "owner" | "admin" | "professional" | "customer" | "system";
  actorEmail: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type Appointment = {
  id: string;
  customer_name: string;
  start_time: string;
  end_time: string;
  status: string;
  services?: { name?: string } | { name?: string }[] | null;
  professionals?: { name?: string } | { name?: string }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function dateTime(value: unknown) {
  if (typeof value !== "string") return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function eventTitle(item: HistoryItem) {
  if (item.event_type === "created") return "Agendamento criado";
  if (item.event_type === "rescheduled") return "Agendamento reagendado";
  if (item.event_type === "cancelled") return "Agendamento cancelado";

  const to = String(item.metadata?.to || "");
  if (to === "completed") return "Atendimento concluído";
  if (to === "no_show") return "Cliente não compareceu";
  return "Status do atendimento alterado";
}

function actorLabel(item: HistoryItem) {
  const labels = {
    owner: "Proprietário",
    admin: "Administrador",
    professional: "Profissional",
    customer: "Cliente",
    system: "Sistema",
  };

  const base = labels[item.actor_type] || "Usuário";
  return item.actorEmail ? base + " · " + item.actorEmail : base;
}

export default function AppointmentHistoryPage() {
  const params = useParams<{ id: string }>();
  const appointmentId = String(params.id || "");
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [professionalNames, setProfessionalNames] = useState<
    Record<string, string>
  >({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        window.location.href =
          "/login?next=" +
          encodeURIComponent(
            "/painel/agendamentos/" + appointmentId + "/historico"
          );
        return;
      }

      const response = await fetch(
        "/api/appointments/" +
          encodeURIComponent(appointmentId) +
          "/history",
        {
          headers: {
            Authorization: "Bearer " + token,
          },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Não foi possível carregar o histórico.");
        setLoading(false);
        return;
      }

      setAppointment(result.appointment);
      setHistory(result.history || []);
      setProfessionalNames(result.professionalNames || {});
      setLoading(false);
    }

    load();
  }, [appointmentId]);

  const service = useMemo(
    () => one(appointment?.services),
    [appointment]
  );
  const professional = useMemo(
    () => one(appointment?.professionals),
    [appointment]
  );

  if (loading) {
    return <main><div className="card">Carregando histórico...</div></main>;
  }

  return (
    <main>
      <div className="row between">
        <div>
          <div className="muted">AGENDA PRO</div>
          <h1>Histórico do atendimento</h1>
          {appointment && (
            <p>
              {appointment.customer_name} · {service?.name || "Serviço"} ·{" "}
              {professional?.name || "Profissional"}
            </p>
          )}
        </div>
        <a className="secondary" href="/painel">
          Voltar ao painel
        </a>
      </div>

      {appointment && (
        <section className="card">
          <div className="appointment-summary">
            <div>
              <span>Horário atual</span>
              <strong>{dateTime(appointment.start_time)}</strong>
            </div>
            <div>
              <span>Status atual</span>
              <strong>{appointment.status}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Linha do tempo</h2>

        {history.length === 0 ? (
          <p>
            Ainda não há eventos de auditoria para este atendimento. Eventos
            anteriores à implantação do histórico não são reconstruídos.
          </p>
        ) : (
          <div className="timeline">
            {history.map((item) => {
              const oldProfessionalId = String(
                item.metadata?.oldProfessionalId || ""
              );
              const newProfessionalId = String(
                item.metadata?.newProfessionalId || ""
              );
              const changedProfessional =
                item.event_type === "rescheduled" &&
                oldProfessionalId &&
                newProfessionalId &&
                oldProfessionalId !== newProfessionalId;

              return (
                <div className="timeline-item" key={item.id}>
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <strong>{eventTitle(item)}</strong>
                    <span className="timeline-meta">
                      {dateTime(item.created_at)} · {actorLabel(item)}
                    </span>

                    {item.event_type === "created" && (
                      <p>
                        Horário inicial:{" "}
                        {dateTime(item.metadata?.startTime)}
                      </p>
                    )}

                    {item.event_type === "rescheduled" && (
                      <div className="timeline-change">
                        <span>
                          De: {dateTime(item.metadata?.oldStartTime)}
                        </span>
                        <span>
                          Para: {dateTime(item.metadata?.newStartTime)}
                        </span>
                        {changedProfessional && (
                          <span>
                            Profissional:{" "}
                            {professionalNames[oldProfessionalId] ||
                              "anterior"}{" "}
                            →{" "}
                            {professionalNames[newProfessionalId] ||
                              "novo"}
                          </span>
                        )}
                      </div>
                    )}

                    {item.event_type === "status_changed" && (
                      <p>
                        {String(item.metadata?.from || "")} →{" "}
                        {String(item.metadata?.to || "")}
                      </p>
                    )}

                    {item.event_type === "cancelled" &&
                      item.metadata?.paidSignal === true && (
                        <p>O agendamento tinha sinal Pix aprovado.</p>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {message && <div className="booking-message">{message}</div>}
    </main>
  );
}
