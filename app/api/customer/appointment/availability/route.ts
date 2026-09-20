import { NextRequest, NextResponse } from "next/server";
import { getAppointmentAccessByToken } from "@/lib/customer-appointment-access";
import { businessHasActiveSubscription } from "@/lib/business-access";
import { getEffectiveWorkingHours } from "@/lib/availability-server";
import { getGoogleCalendarBusyIntervalsExceptEvent } from "@/lib/google-calendar";
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
    const token = req.nextUrl.searchParams.get("token") || "";
    const requestedProfessionalId =
      req.nextUrl.searchParams.get("professionalId") || "";
    const date = req.nextUrl.searchParams.get("date") || "";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Data inválida." },
        { status: 400 }
      );
    }

    const access = await getAppointmentAccessByToken(token);

    if (!access) {
      return NextResponse.json(
        { error: "Link inválido ou expirado." },
        { status: 404 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: appointment } = await supabase
      .from("appointments")
      .select(
        "id,business_id,professional_id,start_time,end_time,status,google_event_id,google_integration_id,services(duration_minutes)"
      )
      .eq("id", access.appointment_id)
      .maybeSingle();

    if (
      !appointment ||
      appointment.status !== "confirmed" ||
      new Date(appointment.start_time).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "Agendamento não disponível para reagendamento." },
        { status: 409 }
      );
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id,owner_id,active")
      .eq("id", appointment.business_id)
      .maybeSingle();

    if (
      !business?.active ||
      !(await businessHasActiveSubscription(
        appointment.business_id,
        business.owner_id
      ))
    ) {
      return NextResponse.json(
        { error: "A agenda online está temporariamente indisponível." },
        { status: 403 }
      );
    }

    const professionalId =
      requestedProfessionalId || appointment.professional_id;

    const { data: professional } = await supabase
      .from("professionals")
      .select("id,active")
      .eq("id", professionalId)
      .eq("business_id", appointment.business_id)
      .maybeSingle();

    if (!professional?.active) {
      return NextResponse.json(
        { error: "Profissional indisponível." },
        { status: 404 }
      );
    }

    const service = Array.isArray(appointment.services)
      ? appointment.services[0]
      : appointment.services;
    const duration = Number(service?.duration_minutes || 0);

    if (!duration) {
      return NextResponse.json(
        { error: "Duração do serviço inválida." },
        { status: 400 }
      );
    }

    const dayStart = new Date(date + "T00:00:00-03:00");
    const dayEnd = new Date(date + "T23:59:59.999-03:00");

    if (
      Number.isNaN(dayStart.getTime()) ||
      dayStart.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1000
    ) {
      return NextResponse.json(
        { error: "Data fora da janela de reagendamento." },
        { status: 400 }
      );
    }

    const weekday = new Date(date + "T12:00:00-03:00").getUTCDay();
    const hours = await getEffectiveWorkingHours({
      businessId: appointment.business_id,
      professionalId,
      weekday,
    });

    if (!hours || hours.is_closed || !hours.opens_at || !hours.closes_at) {
      return NextResponse.json({ date, professionalId, slots: [] });
    }

    const [appointmentsResult, holdsResult, blocksResult] = await Promise.all([
      supabase
        .from("appointments")
        .select("id,start_time,end_time")
        .eq("professional_id", professionalId)
        .neq("status", "cancelled")
        .neq("id", appointment.id)
        .lt("start_time", dayEnd.toISOString())
        .gt("end_time", dayStart.toISOString()),
      supabase
        .from("booking_payments")
        .select("id,start_time,end_time")
        .eq("professional_id", professionalId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .lt("start_time", dayEnd.toISOString())
        .gt("end_time", dayStart.toISOString()),
      supabase
        .from("schedule_blocks")
        .select("start_time,end_time")
        .eq("business_id", appointment.business_id)
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
      googleBusy = await getGoogleCalendarBusyIntervalsExceptEvent(
        appointment.business_id,
        dayStart.toISOString(),
        dayEnd.toISOString(),
        professionalId,
        appointment.google_event_id,
        appointment.google_integration_id
      );
    } catch (error) {
      googleChecked = false;
      console.error("Falha ao consultar Google no autoatendimento", error);
    }

    const openMinutes = toMinutes(hours.opens_at);
    const closeMinutes = toMinutes(hours.closes_at);
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

      if (
        googleBusy.some((item) =>
          overlaps(start, end, item.start, item.end)
        )
      ) {
        continue;
      }

      slots.push(time);
    }

    return NextResponse.json(
      {
        date,
        professionalId,
        slots,
        googleChecked,
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
      { error: "Não foi possível consultar horários." },
      { status: 500 }
    );
  }
}
