import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness, roleAllowed } from "@/lib/auth-server";
import { businessHasActiveSubscription } from "@/lib/business-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type AppointmentRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  start_time: string;
  end_time: string;
  status: string;
  booking_payment_id: string | null;
  services:
    | { name?: string; price_cents?: number }
    | { name?: string; price_cents?: number }[]
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

function safeCell(value: unknown) {
  let text = value == null ? "" : String(value);

  if (/^[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return '"' + text.replace(/"/g, '""') + '"';
}

function localDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function localTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function reais(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (!roleAllowed(auth.role, ["owner", "admin"])) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const active = await businessHasActiveSubscription(
      auth.business.id,
      auth.business.owner_id
    );

    if (!active) {
      return NextResponse.json({ error: "Assinatura inativa." }, { status: 403 });
    }

    const requestedDays = Number(req.nextUrl.searchParams.get("days") || 30);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id,customer_name,customer_phone,customer_email,start_time,end_time,status,booking_payment_id,services(name,price_cents),professionals(name)"
      )
      .eq("business_id", auth.business.id)
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString())
      .order("start_time");

    if (error) throw error;

    const appointments = (data || []) as unknown as AppointmentRow[];
    const paymentIds = appointments
      .map((item) => item.booking_payment_id)
      .filter((value): value is string => Boolean(value));

    const paymentMap = new Map<
      string,
      { amount_cents: number; status: string; paid_at: string | null }
    >();

    if (paymentIds.length > 0) {
      const { data: payments, error: paymentError } = await supabase
        .from("booking_payments")
        .select("id,amount_cents,status,paid_at")
        .in("id", paymentIds);

      if (paymentError) throw paymentError;

      for (const payment of payments || []) {
        paymentMap.set(payment.id, {
          amount_cents: Number(payment.amount_cents || 0),
          status: String(payment.status || ""),
          paid_at: payment.paid_at || null,
        });
      }
    }

    const headers = [
      "Data",
      "Hora",
      "Cliente",
      "WhatsApp",
      "E-mail",
      "Serviço",
      "Profissional",
      "Status",
      "Valor do serviço (R$)",
      "Sinal Pix (R$)",
      "Status do Pix",
      "Data do pagamento Pix",
      "ID do agendamento",
    ];

    const rows = appointments.map((item) => {
      const service = one(item.services);
      const professional = one(item.professionals);
      const payment = item.booking_payment_id
        ? paymentMap.get(item.booking_payment_id)
        : null;

      return [
        localDate(item.start_time),
        localTime(item.start_time),
        item.customer_name,
        item.customer_phone,
        item.customer_email || "",
        service?.name || "",
        professional?.name || "",
        item.status,
        reais(Number(service?.price_cents || 0)),
        payment ? reais(payment.amount_cents) : "",
        payment?.status || "",
        payment?.paid_at ? localDate(payment.paid_at) + " " + localTime(payment.paid_at) : "",
        item.id,
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map(safeCell).join(";"))
      .join("\r\n");

    const filename =
      "agenda-pro-relatorio-" +
      days +
      "-dias-" +
      new Date().toISOString().slice(0, 10) +
      ".csv";

    return new NextResponse("\uFEFF" + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="' + filename + '"',
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível exportar o relatório." },
      { status: 500 }
    );
  }
}
