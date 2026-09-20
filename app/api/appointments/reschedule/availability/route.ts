import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
import { getEffectiveWorkingHours } from "@/lib/availability-server";
import { isGoogleCalendarBusyExceptEvent } from "@/lib/google-calendar";
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
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const appointmentId =
      req.nextUrl.searchParams.get("appointmentId") || "";
    const requestedProfessionalId =
      req.nextUrl.searchParams.get("professionalId") || "";
    const date = req.nextUrl.searchParams.get("date") || "";

    if (!appointmentId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Parâmetros de reagendamento inválidos." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: appointment } = await supabase
      .from("appointments")
      .select(
        "id,business_id,professional_id,service_id,start_time,end_time,status,google_event_id,services(duration_minutes)"
      )
      .eq("id", appointmentId)
      .eq("business_id", auth.business.id)
      .maybeSingle();

    if (!appointment || appointment.status !== "confirmed") {
      return NextResponse.json(
        { error: "Agendamento não disponível para reagendamento." },
        { status: 404 }
      );
    }

    if (new Date(appointment.start_time).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Apenas agendamentos futuros podem ser reagendados." },
        { status: 409 }
      );
    }

    let professionalId =
      requestedProfessionalId || appointment.professional_id;

    if (auth.role === "professional") {
      if (!auth.professionalId) {
        return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      }

      if (appointment.professional_id !== auth.professionalId) {
        return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      }

      professionalId = auth.professionalId;
    }

    const { data: professional } = await supabase
      .from("professionals")
      .select("id,active")
      .eq("id", professionalId)
      .eq("business_id", auth.business.id)
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

    const weekday = new Date(date + "T12:00:00-03:00").getUTCDay();
    const hours = await getEffectiveWorkingHours({
      businessId: auth.business.id,
      professionalId,
      weekday,
    });

    if (!hours || hours.is_closed || !hours.opens_at || !hours.closes_at) {
      return NextResponse.json({ date, slots: [], googleChecked: true });
    }

    const dayStart = new Date(date + "T00:00:00-03:00");
    const dayEnd = new Date(date + "T23:59:59.999-03:00");
    const openMinutes = toMinutes(hours.opens_at);
    const closeMinutes = toMinutes(hours.closes_at);

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
        .eq("business_id", auth.business.id)
        .lt("start_time", dayEnd.toISOString())
        .gt("end_time", dayStart.toISOString())
        .or(
          "professional_id.is.null,professional_id.eq." + professionalId
        ),
    ]);

    if (appointmentsResult.error) throw appointmentsResult.error;
    if (holdsResult.error) throw holdsResult.error;
    if (blocksResult.error) throw blocksResult.error;

    const appointments = appointmentsResult.data || [];
    const holds = holdsResult.data || [];
    const blocks = blocksResult.data || [];
    const slots: string[] = [];
    let googleChecked = true;

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

      try {
        const googleBusy = await isGoogleCalendarBusyExceptEvent(
          auth.business.id,
          start.toISOString(),
          end.toISOString(),
          professionalId,
          appointment.google_event_id
        );

        if (googleBusy) continue;
      } catch (error) {
        googleChecked = false;
        console.error(
          "Falha ao consultar Google para reagendamento",
          error
        );
      }

      slots.push(time);
    }

    return NextResponse.json(
      {
        date,
        professionalId,
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
      { error: "Não foi possível consultar opções de reagendamento." },
      { status: 500 }
    );
  }
}
