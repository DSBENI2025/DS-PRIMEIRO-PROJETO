"use client";

import { useEffect, useMemo, useState } from "react";

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

type PixPayment = {
  reservationId: string;
  amountCents: number;
  depositPercent: number;
  expiresAt: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  status: string;
};

type Props = {
  businessId: string;
  businessName: string;
  services: Service[];
  professionals: Professional[];
  hours: BusinessHour[];
  depositEnabled: boolean;
  depositPercent: number;
  paymentReady: boolean;
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
  return (
    String(Math.floor(total / 60)).padStart(2, "0") +
    ":" +
    String(total % 60).padStart(2, "0")
  );
}

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function BookingForm({
  businessId,
  businessName,
  services,
  professionals,
  hours,
  depositEnabled,
  depositPercent,
  paymentReady,
}: Props) {
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [professionalId, setProfessionalId] = useState(
    professionals[0]?.id || ""
  );
  const [date, setDate] = useState(
    ymd(new Date(Date.now() + 24 * 60 * 60 * 1000))
  );
  const [time, setTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<PixPayment | null>(null);

  const selectedService = services.find((service) => service.id === serviceId);
  const requiresPix =
    Boolean(depositEnabled) && Boolean(selectedService?.price_cents);

  const depositAmountCents = selectedService
    ? Math.ceil((selectedService.price_cents * depositPercent) / 100)
    : 0;

  const slots = useMemo(() => {
    if (!date || !selectedService) return [];

    const weekday = new Date(date + "T12:00:00").getDay();
    const day = hours.find((item) => item.weekday === weekday);

    if (!day || day.is_closed || !day.opens_at || !day.closes_at) return [];

    const start = minutes(day.opens_at);
    const close = minutes(day.closes_at);
    const result: string[] = [];

    for (
      let value = start;
      value + selectedService.duration_minutes <= close;
      value += 30
    ) {
      result.push(hhmm(value));
    }

    return result;
  }, [date, hours, selectedService]);

  useEffect(() => {
    if (!payment?.reservationId || success) return;

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(
          "/api/booking/status?reservationId=" +
            encodeURIComponent(payment.reservationId),
          { cache: "no-store" }
        );

        if (!response.ok) return;

        const result = await response.json();

        if (result.confirmed) {
          setSuccess(true);
          setPayment((current) =>
            current ? { ...current, status: "approved" } : current
          );
          setMessage(
            "Pagamento aprovado. Agendamento confirmado para " +
              new Date(result.startTime).toLocaleString("pt-BR")
          );
          window.clearInterval(timer);
          return;
        }

        if (
          ["expired", "cancelled", "rejected", "conflict"].includes(
            result.status
          )
        ) {
          setPayment((current) =>
            current ? { ...current, status: result.status } : current
          );
          setMessage(
            result.status === "expired"
              ? "O Pix expirou e o horário foi liberado. Gere uma nova reserva."
              : "O pagamento não confirmou. O horário foi liberado."
          );
          window.clearInterval(timer);
        }
      } catch (error) {
        console.error("Falha ao consultar confirmação Pix", error);
      }
    }, 4000);

    return () => window.clearInterval(timer);
  }, [payment?.reservationId, success]);

  function resetSelection() {
    if (payment?.status === "pending") return;
    setPayment(null);
    setSuccess(false);
    setMessage("");
    setTime("");
  }

  async function submit() {
    setMessage("");
    setSuccess(false);

    if (
      !serviceId ||
      !professionalId ||
      !date ||
      !time ||
      !customerName.trim() ||
      !customerPhone.trim()
    ) {
      setMessage(
        "Preencha serviço, profissional, data, horário, nome e WhatsApp."
      );
      return;
    }

    if (requiresPix && !/^\S+@\S+\.\S+$/.test(customerEmail.trim())) {
      setMessage("Informe um e-mail válido para gerar o Pix.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        requiresPix ? "/api/booking/pix/create" : "/api/appointments/create",
        {
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
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Não foi possível concluir o agendamento."
        );
      }

      if (requiresPix) {
        setPayment({
          reservationId: result.reservationId,
          amountCents: result.amountCents,
          depositPercent: result.depositPercent,
          expiresAt: result.expiresAt,
          qrCode: result.qrCode,
          qrCodeBase64: result.qrCodeBase64,
          ticketUrl: result.ticketUrl,
          status: result.status || "pending",
        });

        if (result.status === "approved") {
          setSuccess(true);
          setMessage("Pagamento aprovado. Seu agendamento está confirmado.");
        } else {
          setMessage(
            "Pix gerado. O horário fica reservado por 30 minutos enquanto aguardamos o pagamento."
          );
        }
      } else {
        setSuccess(true);
        setMessage(
          "Agendamento confirmado para " +
            new Date(result.startTime).toLocaleString("pt-BR")
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Erro inesperado."
      );
    } finally {
      setLoading(false);
    }
  }

  const formLocked = payment?.status === "pending";

  return (
    <div className="card">
      <div className="muted">{businessName.toUpperCase()}</div>
      <h1>Agende seu horário</h1>

      <div className="booking-grid">
        <label>
          Serviço
          <select
            className="input"
            value={serviceId}
            disabled={formLocked}
            onChange={(e) => {
              setServiceId(e.target.value);
              setTime("");
              resetSelection();
            }}
          >
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} · {service.duration_minutes} min ·{" "}
                {brl(service.price_cents)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Profissional
          <select
            className="input"
            value={professionalId}
            disabled={formLocked}
            onChange={(e) => setProfessionalId(e.target.value)}
          >
            {professionals.map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professional.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Data
          <input
            className="input"
            type="date"
            min={ymd(new Date())}
            value={date}
            disabled={formLocked}
            onChange={(e) => {
              setDate(e.target.value);
              setTime("");
              resetSelection();
            }}
          />
        </label>

        <label>
          Horário
          <select
            className="input"
            value={time}
            disabled={formLocked}
            onChange={(e) => setTime(e.target.value)}
          >
            <option value="">Selecione</option>
            {slots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </label>

        <input
          className="input"
          placeholder="Seu nome"
          disabled={formLocked}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
        <input
          className="input"
          placeholder="WhatsApp"
          disabled={formLocked}
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
        />
        <input
          className="input"
          type="email"
          placeholder={requiresPix ? "E-mail para o Pix" : "E-mail (opcional)"}
          disabled={formLocked}
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
        />

        {requiresPix && !paymentReady && !payment && (
          <div className="booking-message">
            O sinal Pix está temporariamente indisponível. Entre em contato com
            o estabelecimento para reservar este horário.
          </div>
        )}

        {requiresPix && selectedService && paymentReady && !payment && (
          <div className="deposit-note">
            Para reservar este horário: sinal de {depositPercent}% (
            <strong>{brl(depositAmountCents)}</strong>) via Pix. O restante é
            pago diretamente ao estabelecimento.
          </div>
        )}

        {!payment && (
          <button
            className="cta"
            onClick={submit}
            disabled={
              loading ||
              slots.length === 0 ||
              (requiresPix && !paymentReady)
            }
          >
            {loading
              ? "Processando..."
              : requiresPix
                ? "Gerar Pix de " + brl(depositAmountCents)
                : "Confirmar agendamento"}
          </button>
        )}

        {payment && (
          <div className="pix-card">
            <h2>
              {success ? "Pagamento aprovado" : "Pague o sinal via Pix"}
            </h2>

            <div className="pix-amount">{brl(payment.amountCents)}</div>

            {!success && payment.status === "pending" && (
              <>
                {payment.qrCodeBase64 && (
                  <img
                    className="pix-qr"
                    src={"data:image/png;base64," + payment.qrCodeBase64}
                    alt="QR Code Pix"
                  />
                )}

                {payment.qrCode && (
                  <>
                    <textarea
                      className="input pix-copy"
                      readOnly
                      value={payment.qrCode}
                    />
                    <button
                      className="secondary"
                      onClick={() =>
                        navigator.clipboard.writeText(payment.qrCode || "")
                      }
                    >
                      Copiar código Pix
                    </button>
                  </>
                )}

                {payment.ticketUrl && (
                  <a
                    className="secondary"
                    href={payment.ticketUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir página de pagamento
                  </a>
                )}

                <p>
                  Válido até{" "}
                  {new Date(payment.expiresAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  . A confirmação acontece automaticamente.
                </p>
              </>
            )}

            {payment.status !== "pending" && !success && (
              <button className="secondary" onClick={resetSelection}>
                Escolher outro horário
              </button>
            )}
          </div>
        )}

        {message && (
          <div className={success ? "success" : "booking-message"}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
