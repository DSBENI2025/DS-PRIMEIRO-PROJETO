import { NextRequest, NextResponse } from "next/server";
import { getEffectiveWorkingHours } from "@/lib/availability-server";
import { businessHasActiveSubscription } from "@/lib/business-access";
import { getGoogleCalendarBusyIntervals } from "@/lib/google-calendar";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function toMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function hhmm(total: number) {
  return (
    String(Math.floor(total / 60)).padStart(2, "0") +
    ":" +
    String(total % 60).padStart(2, "0")
  );
}

function overlaps(
  start: Date,
  end: Date,
  occupiedStart: string,
  occupiedEnd: string
) {
  return (
    start.getTime() < new Date(occupiedEnd).getTime() &&
    end.getTime() > new Date(occupiedStart).getTime()
  );
}

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get("businessId") || "";
    const serviceId = req.nextUrl.searchParams.get("serviceId") || "";
    const professionalId =
      req.nextUrl.searchParams.get("professionalId") || "";
    const date = req.nextUrl.searchParams.get("date") || "";

    if (
      !businessId ||
      !serviceId ||
      !professionalId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      return NextResponse.json(
        { error: "Parâmetros de disponibilidade inválidos." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: business } = await supabase
      .from("businesses")
      .select("id,owner_id,active,timezone")
      .eq("id", businessId)
      .maybeSingle();

    if (!business || !business.active) {
      return NextResponse.json(
        { error: "Estabelecimento indisponível." },
        { status: 404 }
      );
    }

    const activeSubscription = await businessHasActiveSubscription(
      business.id,
      business.owner_id
    );

    if (!activeSubscription) {
      return NextResponse.json(
        { error: "Agenda online indisponível." },
        { status: 403 }
      );
    }

    if (business.timezone !== "America/Recife") {
      return NextResponse.json(
        { error: "Fuso horário ainda não suportado nesta versão." },
        { status: 400 }
      );
    }

    const [serviceResult, professionalResult] = await Promise.all([
      supabase
        .from("services")
        .select("id,duration_minutes,active")
        .eq("id", serviceId)
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase
        .from("professionals")
        .select("id,active")
        .eq("id", professionalId)
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    const service = serviceResult.data;
    const professional = professionalResult.data;

    if (!service?.active || !professional?.active) {
      return NextResponse.json(
        { error: "Serviço ou profissional indisponível." },
        { status: 404 }
      );
    }

    const dayStart = new Date(date + "T00:00:00-03:00");
    const dayEnd = new Date(date + "T23:59:59.999-03:00");

    if (
      Number.isNaN(dayStart.getTime()) ||
      Number.isNaN(dayEnd.getTime())
    ) {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    }

    const maxDate = Date.now() + 90 * 24 * 60 * 60 * 1000;

    if (
      dayEnd.getTime() < Date.now() - 24 * 60 * 60 * 1000 ||
      dayStart.getTime() > maxDate
    ) {
      return NextResponse.json(
        { error: "Data fora da janela de agendamento." },
        { status: 400 }
      );
    }

    const weekday = new Date(date + "T12:00:00-03:00").getUTCDay();
    const hours = await getEffectiveWorkingHours({
      businessId,
      professionalId,
      weekday,
    });

    if (!hours || hours.is_closed || !hours.opens_at || !hours.closes_at) {
      return NextResponse.json({
        date,
        slots: [],
        googleChecked: true,
      });
    }

    const openMinutes = toMinutes(hours.opens_at);
    const closeMinutes = toMinutes(hours.closes_at);
    const duration = Number(service.duration_minutes);

    const [appointmentsResult, holdsResult, blocksResult] = await Promise.all([
      supabase
        .from("appointments")
        .select("start_time,end_time")
        .eq("professional_id", professionalId)
        .neq("status", "cancelled")
        .lt("start_time", dayEnd.toISOString())
        .gt("end_time", dayStart.toISOString()),
      supabase
        .from("booking_payments")
        .select("start_time,end_time")
        .eq("professional_id", professionalId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .lt("start_time", dayEnd.toISOString())
        .gt("end_time", dayStart.toISOString()),
      supabase
        .from("schedule_blocks")
        .select("start_time,end_time")
        .eq("business_id", businessId)
        .lt("start_time", dayEnd.toISOString())
        .gt("end_time", dayStart.toISOString())
        .or(
          "professional_id.is.null,professional_id.eq." + professionalId
        ),
    ]);

    if (appointmentsResult.error) throw appointmentsResult.error;
    if (holdsResult.error) throw holdsResult.error;
    if (blocksResult.error) throw blocksResult.error;

    let googleBusy: { start: string; end: string }[] = [];
    let googleChecked = true;

    try {
      googleBusy = await getGoogleCalendarBusyIntervals(
        businessId,
        dayStart.toISOString(),
        dayEnd.toISOString(),
        professionalId
      );
    } catch (error) {
      googleChecked = false;
      console.error("Falha ao consultar disponibilidade diária no Google", error);
    }

    const appointments = appointmentsResult.data || [];
    const holds = holdsResult.data || [];
    const blocks = blocksResult.data || [];
    const slots: string[] = [];

    for (
      let value = openMinutes;
      value + duration <= closeMinutes;
      value += 30
    ) {
      const time = hhmm(value);
      const start = new Date(date + "T" + time + ":00-03:00");
      const end = new Date(start.getTime() + duration * 60 * 1000);

      if (start.getTime() <= Date.now()) continue;

      const internalBusy =
        appointments.some((item) =>
          overlaps(start, end, item.start_time, item.end_time)
        ) ||
        holds.some((item) =>
          overlaps(start, end, item.start_time, item.end_time)
        ) ||
        blocks.some((item) =>
          overlaps(start, end, item.start_time, item.end_time)
        );

      if (internalBusy) continue;

      const externalBusy = googleBusy.some((item) =>
        overlaps(start, end, item.start, item.end)
      );

      if (externalBusy) continue;

      slots.push(time);
    }

    return NextResponse.json(
      {
        date,
        slots,
        googleChecked,
        durationMinutes: duration,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível consultar os horários disponíveis." },
      { status: 500 }
    );
  }
}
