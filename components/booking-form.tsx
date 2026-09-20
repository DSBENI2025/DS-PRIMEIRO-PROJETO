"use client";

import { useMemo, useState } from "react";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
};

type Professional = {
  id: string;
  name: string;
};

type BusinessHour = {
  weekday: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
};

type Props = {
  businessId: string;
  businessName: string;
  services: Service[];
  professionals: Professional[];
  hours: BusinessHour[];
};

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function minutes(value: string) {
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function hhmm(total: number) {
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

export default function BookingForm({
  businessId,
  businessName,
  services,
  professionals,
  hours,
}: Props) {
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [professionalId, setProfessionalId] = useState(professionals[0]?.id || "");
  const [date, setDate] = useState(ymd(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [time, setTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedService = services.find((service) => service.id === serviceId);

  const slots = useMemo(() => {
    if (!date || !selectedService) return [];

    const weekday = new Date(date + "T12:00:00").getDay();
    const day = hours.find((item) => item.weekday === weekday);

    if (!day || day.is_closed || !day.opens_at || !day.closes_at) return [];

    const start = minutes(day.opens_at);
    const close = minutes(day.closes_at);
    const result: string[] = [];

    for (let value = start; value + selectedService.duration_minutes <= close; value += 30) {
      result.push(hhmm(value));
    }

    return result;
  }, [date, hours, selectedService]);

  async function submit() {
    setMessage("");
    setSuccess(false);

    if (!serviceId || !professionalId || !date || !time || !customerName.trim() || !customerPhone.trim()) {
      setMessage("Preencha serviço, profissional, data, horário, nome e WhatsApp.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/appointments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          serviceId,
          professionalId,
          date,
          time,
          customerName,
          customerPhone,
          customerEmail,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível concluir o agendamento.");
      }

      setSuccess(true);
      setMessage("Agendamento confirmado para " + new Date(result.startTime).toLocaleString("pt-BR"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="muted">{businessName.toUpperCase()}</div>
      <h1>Agende seu horário</h1>

      <div className="booking-grid">
        <label>
          Serviço
          <select className="input" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setTime(""); }}>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} · {service.duration_minutes} min · R$ {(service.price_cents / 100).toFixed(2).replace(".", ",")}
              </option>
            ))}
          </select>
        </label>

        <label>
          Profissional
          <select className="input" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            {professionals.map((professional) => (
              <option key={professional.id} value={professional.id}>{professional.name}</option>
            ))}
          </select>
        </label>

        <label>
          Data
          <input className="input" type="date" min={ymd(new Date())} value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} />
        </label>

        <label>
          Horário
          <select className="input" value={time} onChange={(e) => setTime(e.target.value)}>
            <option value="">Selecione</option>
            {slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
          </select>
        </label>

        <input className="input" placeholder="Seu nome" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <input className="input" placeholder="WhatsApp" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        <input className="input" type="email" placeholder="E-mail (opcional)" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />

        <button className="cta" onClick={submit} disabled={loading || slots.length === 0}>
          {loading ? "Confirmando..." : "Confirmar agendamento"}
        </button>

        {message && <div className={success ? "success" : ""}>{message}</div>}
      </div>
    </div>
  );
}
