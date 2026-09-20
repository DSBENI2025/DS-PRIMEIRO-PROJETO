import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
import {
  getEffectiveWorkingHours,
  isScheduleBlocked,
} from "@/lib/availability-server";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  isGoogleCalendarBusyExceptEvent,
  updateGoogleCalendarEvent,
} from "@/lib/google-calendar";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function toMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const appointmentId = String(body.appointmentId || "");
    let professionalId = String(body.professionalId || "");
    const date = String(body.date || "");
    const time = String(body.time || "");

    if (
      !appointmentId ||
      !professionalId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}$/.test(time)
    ) {
      return NextResponse.json(
        { error: "Dados de reagendamento inválidos." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: appointment } = await supabase
      .from("appointments")
      .select(
        "id,business_id,service_id,professional_id,customer_name,customer_phone,customer_email,start_time,end_time,status,google_event_id,services(name,duration_minutes),professionals(name)"
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

    if (auth.role === "professional") {
      if (
        !auth.professionalId ||
        appointment.professional_id !== auth.professionalId
      ) {
        return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      }

      professionalId = auth.professionalId;
    }

    const { data: professional } = await supabase
      .from("professionals")
      .select("id,name,active")
      .eq("id", professionalId)
      .eq("business_id", auth.business.id)
      .maybeSingle();

    if (!professional?.active) {
      return NextResponse.json(
        { error: "Profissional indisponível." },
        { status: 404 }
      );
    }

    const service = one(appointment.services);
    const duration = Number(service?.duration_minutes || 0);

    if (!service || !duration) {
      return NextResponse.json(
        { error: "Serviço inválido para reagendamento." },
        { status: 400 }
      );
    }

    if (auth.business.timezone !== "America/Recife") {
      return NextResponse.json(
        { error: "Fuso horário ainda não suportado nesta versão." },
        { status: 400 }
      );
    }

    const start = new Date(date + "T" + time + ":00-03:00");
    const end = new Date(start.getTime() + duration * 60 * 1000);

    if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Escolha um horário futuro." },
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
      return NextResponse.json(
        { error: "O profissional não atende neste dia." },
        { status: 400 }
      );
    }

    const startMinutes = toMinutes(time);
    const openMinutes = toMinutes(hours.opens_at);
    const closeMinutes = toMinutes(hours.closes_at);

    if (
      startMinutes < openMinutes ||
      startMinutes + duration > closeMinutes
    ) {
      return NextResponse.json(
        { error: "Horário fora do expediente do profissional." },
        { status: 400 }
      );
    }

    const blocked = await isScheduleBlocked({
      businessId: auth.business.id,
      professionalId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });

    if (blocked) {
      return NextResponse.json(
        { error: "Este horário está bloqueado na agenda." },
        { status: 409 }
      );
    }

    try {
      const googleBusy = await isGoogleCalendarBusyExceptEvent(
        auth.business.id,
        start.toISOString(),
        end.toISOString(),
        professionalId,
        appointment.google_event_id
      );

      if (googleBusy) {
        return NextResponse.json(
          { error: "Esse horário está ocupado no Google Agenda." },
          { status: 409 }
        );
      }
    } catch (error) {
      console.error("Falha ao validar Google no reagendamento", error);
    }

    const oldProfessionalId = appointment.professional_id;
    const oldGoogleEventId = appointment.google_event_id;

    const { data: updatedId, error: rescheduleError } = await supabase.rpc(
      "reschedule_appointment",
      {
        p_appointment_id: appointment.id,
        p_professional_id: professionalId,
        p_start_time: start.toISOString(),
        p_end_time: end.toISOString(),
      }
    );

    if (rescheduleError || !updatedId) {
      const message = rescheduleError?.message || "";

      if (
        message.includes("slot_unavailable") ||
        message.includes("schedule_blocked") ||
        message.includes("appointments_no_overlap")
      ) {
        return NextResponse.json(
          { error: "Esse horário acabou de ficar indisponível." },
          { status: 409 }
        );
      }

      throw rescheduleError || new Error("Reagendamento não concluído.");
    }

    let googleSynced = true;
    let googleEventId = oldGoogleEventId as string | null;

    try {
      if (oldProfessionalId === professionalId && oldGoogleEventId) {
        const patched = await updateGoogleCalendarEvent({
          businessId: auth.business.id,
          professionalId,
          eventId: oldGoogleEventId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          timeZone: auth.business.timezone,
        });

        if (!patched) {
          const created = await createGoogleCalendarEvent({
            businessId: auth.business.id,
            professionalId,
            summary: String(service.name || "Agendamento") + " - " + appointment.customer_name,
            description:
              "Cliente: " +
              appointment.customer_name +
              "\nWhatsApp: " +
              appointment.customer_phone +
              (appointment.customer_email
                ? "\nE-mail: " + appointment.customer_email
                : "") +
              "\nProfissional: " +
              professional.name,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            timeZone: auth.business.timezone,
          });

          if (created) googleEventId = created;
        }
      } else if (oldProfessionalId !== professionalId) {
        let oldRemoved = true;

        if (oldGoogleEventId) {
          oldRemoved = await deleteGoogleCalendarEvent(
            auth.business.id,
            oldGoogleEventId,
            oldProfessionalId
          );
        }

        if (oldRemoved) {
          const created = await createGoogleCalendarEvent({
            businessId: auth.business.id,
            professionalId,
            summary: String(service.name || "Agendamento") + " - " + appointment.customer_name,
            description:
              "Cliente: " +
              appointment.customer_name +
              "\nWhatsApp: " +
              appointment.customer_phone +
              (appointment.customer_email
                ? "\nE-mail: " + appointment.customer_email
                : "") +
              "\nProfissional: " +
              professional.name,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            timeZone: auth.business.timezone,
          });

          googleEventId = created || null;
        } else {
          googleSynced = false;
        }
      } else if (!oldGoogleEventId) {
        const created = await createGoogleCalendarEvent({
          businessId: auth.business.id,
          professionalId,
          summary: String(service.name || "Agendamento") + " - " + appointment.customer_name,
          description:
            "Cliente: " +
            appointment.customer_name +
            "\nWhatsApp: " +
            appointment.customer_phone +
            (appointment.customer_email
              ? "\nE-mail: " + appointment.customer_email
              : "") +
            "\nProfissional: " +
            professional.name,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          timeZone: auth.business.timezone,
        });

        if (created) googleEventId = created;
      }

      if (googleEventId !== oldGoogleEventId) {
        await supabase
          .from("appointments")
          .update({ google_event_id: googleEventId })
          .eq("id", appointment.id);
      }
    } catch (error) {
      googleSynced = false;
      console.error("Reagendamento salvo, mas Google não sincronizou", error);
    }

    return NextResponse.json({
      rescheduled: true,
      appointmentId: appointment.id,
      professionalId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      googleSynced,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível reagendar o atendimento." },
      { status: 500 }
    );
  }
}
