import { NextRequest, NextResponse } from "next/server";
import { businessHasActiveSubscription } from "@/lib/business-access";
import { recordAppointmentEvent } from "@/lib/appointment-history";
import {
  extendAppointmentAccessToken,
  getAppointmentAccessByToken,
} from "@/lib/customer-appointment-access";
import {
  getEffectiveWorkingHours,
  isScheduleBlocked,
} from "@/lib/availability-server";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getEffectiveGoogleIntegrationId,
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
    const body = await req.json();
    const token = String(body.token || "");
    const professionalId = String(body.professionalId || "");
    const date = String(body.date || "");
    const time = String(body.time || "");

    if (
      !professionalId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}$/.test(time)
    ) {
      return NextResponse.json(
        { error: "Dados de reagendamento inválidos." },
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
        "id,business_id,service_id,professional_id,customer_name,customer_phone,customer_email,start_time,end_time,status,google_event_id,google_integration_id,booking_payment_id,services(name,duration_minutes),businesses(name,timezone,owner_id,active)"
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

    const { data: professional } = await supabase
      .from("professionals")
      .select("id,name,active")
      .eq("id", professionalId)
      .eq("business_id", appointment.business_id)
      .maybeSingle();

    if (!professional?.active) {
      return NextResponse.json(
        { error: "Profissional indisponível." },
        { status: 404 }
      );
    }

    const service = one(appointment.services);
    const business = one(appointment.businesses);
    const duration = Number(service?.duration_minutes || 0);

    if (!service || !duration || !business) {
      return NextResponse.json(
        { error: "Dados do agendamento inválidos." },
        { status: 400 }
      );
    }

    if (
      !business.active ||
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

    if (business.timezone !== "America/Recife") {
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
      businessId: appointment.business_id,
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
      businessId: appointment.business_id,
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
        appointment.business_id,
        start.toISOString(),
        end.toISOString(),
        professionalId,
        appointment.google_event_id,
        appointment.google_integration_id
      );

      if (googleBusy) {
        return NextResponse.json(
          { error: "Esse horário está ocupado no Google Agenda." },
          { status: 409 }
        );
      }
    } catch (error) {
      console.error("Falha ao validar Google no autoatendimento", error);
    }

    const oldProfessionalId = appointment.professional_id;
    const oldGoogleEventId = appointment.google_event_id as string | null;
    const oldGoogleIntegrationId =
      appointment.google_integration_id as string | null;

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

      throw rescheduleError || new Error("Falha ao reagendar.");
    }

    try {
      await recordAppointmentEvent({
        appointmentId: appointment.id,
        businessId: appointment.business_id,
        eventType: "rescheduled",
        actorType: "customer",
        metadata: {
          oldProfessionalId,
          newProfessionalId: professionalId,
          oldStartTime: appointment.start_time,
          newStartTime: start.toISOString(),
          oldEndTime: appointment.end_time,
          newEndTime: end.toISOString(),
        },
      });
    } catch (error) {
      console.error("Reagendamento do cliente salvo, mas auditoria falhou", error);
    }

    let googleSynced = true;

    try {
      const nextIntegrationId = await getEffectiveGoogleIntegrationId(
        appointment.business_id,
        professionalId
      );

      const summary =
        (service.name || "Agendamento") +
        " - " +
        appointment.customer_name;

      const description =
        "Cliente: " +
        appointment.customer_name +
        "\nWhatsApp: " +
        appointment.customer_phone +
        (appointment.customer_email
          ? "\nE-mail: " + appointment.customer_email
          : "") +
        "\nProfissional: " +
        professional.name;

      let nextEventId: string | null = oldGoogleEventId;

      if (
        oldGoogleEventId &&
        oldGoogleIntegrationId &&
        nextIntegrationId === oldGoogleIntegrationId
      ) {
        const updated = await updateGoogleCalendarEvent({
          businessId: appointment.business_id,
          integrationId: oldGoogleIntegrationId,
          professionalId,
          eventId: oldGoogleEventId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          timeZone: business.timezone,
          summary,
          description,
        });

        if (!updated) {
          nextEventId = await createGoogleCalendarEvent({
            businessId: appointment.business_id,
            professionalId,
            summary,
            description,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            timeZone: business.timezone,
          });
        }
      } else {
        if (oldGoogleEventId) {
          try {
            await deleteGoogleCalendarEvent(
              appointment.business_id,
              oldGoogleEventId,
              oldProfessionalId,
              oldGoogleIntegrationId
            );
          } catch (error) {
            console.error("Falha ao remover evento antigo no Google", error);
          }
        }

        nextEventId = nextIntegrationId
          ? await createGoogleCalendarEvent({
              businessId: appointment.business_id,
              professionalId,
              summary,
              description,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              timeZone: business.timezone,
            })
          : null;
      }

      await supabase
        .from("appointments")
        .update({
          google_event_id: nextEventId,
          google_integration_id: nextEventId ? nextIntegrationId : null,
        })
        .eq("id", appointment.id);
    } catch (error) {
      googleSynced = false;
      console.error(
        "Reagendamento concluído, mas sincronização Google falhou",
        error
      );
    }

    await extendAppointmentAccessToken(
      appointment.id,
      end.toISOString()
    );

    return NextResponse.json({
      rescheduled: true,
      appointmentId: appointment.id,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      professionalId,
      googleSynced,
      paidBooking: Boolean(appointment.booking_payment_id),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível reagendar o atendimento." },
      { status: 500 }
    );
  }
}
