import { NextRequest, NextResponse } from "next/server";
import { businessHasActiveSubscription } from "@/lib/business-access";
import {
  getEffectiveWorkingHours,
  isScheduleBlocked,
} from "@/lib/availability-server";
import {
  createGoogleCalendarEvent,
  getEffectiveGoogleIntegrationId,
  isGoogleCalendarBusy,
} from "@/lib/google-calendar";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { notifyBookingConfirmed } from "@/lib/notifications";

function toMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const businessId = String(body.businessId || "");
    const serviceId = String(body.serviceId || "");
    const professionalId = String(body.professionalId || "");
    const date = String(body.date || "");
    const time = String(body.time || "");
    const customerName = String(body.customerName || "").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const customerEmail = String(body.customerEmail || "").trim();
    const whatsappOptIn = body.whatsappOptIn === true;

    if (
      !businessId ||
      !serviceId ||
      !professionalId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}$/.test(time) ||
      !customerName ||
      !customerPhone
    ) {
      return NextResponse.json(
        { error: "Dados do agendamento incompletos." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: business } = await supabase
      .from("businesses")
      .select("id,owner_id,name,active,timezone,deposit_enabled")
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

    const [serviceResult, professionalResult] = await Promise.all([
      supabase
        .from("services")
        .select("id,name,duration_minutes,price_cents,active")
        .eq("id", serviceId)
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase
        .from("professionals")
        .select("id,name,active")
        .eq("id", professionalId)
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    const service = serviceResult.data;
    const professional = professionalResult.data;

    if (!service?.active || !professional?.active) {
      return NextResponse.json(
        { error: "Serviço ou profissional indisponível." },
        { status: 400 }
      );
    }

    if (business.deposit_enabled && service.price_cents > 0) {
      return NextResponse.json(
        { error: "Este horário exige pagamento do sinal via Pix." },
        { status: 409 }
      );
    }

    if (business.timezone !== "America/Recife") {
      return NextResponse.json(
        { error: "Fuso horário ainda não suportado nesta versão." },
        { status: 400 }
      );
    }

    const localStart = date + "T" + time + ":00-03:00";
    const start = new Date(localStart);

    if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Escolha um horário futuro." },
        { status: 400 }
      );
    }

    const end = new Date(
      start.getTime() + service.duration_minutes * 60 * 1000
    );

    const weekday = new Date(date + "T12:00:00-03:00").getUTCDay();

    const hours = await getEffectiveWorkingHours({
      businessId,
      professionalId,
      weekday,
    });

    if (!hours || hours.is_closed || !hours.opens_at || !hours.closes_at) {
      return NextResponse.json(
        { error: "O estabelecimento não atende neste dia." },
        { status: 400 }
      );
    }

    const startMinutes = toMinutes(time);
    const openMinutes = toMinutes(hours.opens_at);
    const closeMinutes = toMinutes(hours.closes_at);

    if (
      startMinutes < openMinutes ||
      startMinutes + service.duration_minutes > closeMinutes
    ) {
      return NextResponse.json(
        { error: "Horário fora do expediente." },
        { status: 400 }
      );
    }

    const { data: conflict } = await supabase
      .from("appointments")
      .select("id")
      .eq("professional_id", professionalId)
      .neq("status", "cancelled")
      .lt("start_time", end.toISOString())
      .gt("end_time", start.toISOString())
      .limit(1);

    if (conflict && conflict.length > 0) {
      return NextResponse.json(
        { error: "Esse horário acabou de ser ocupado. Escolha outro." },
        { status: 409 }
      );
    }

    const { data: pendingHold } = await supabase
      .from("booking_payments")
      .select("id")
      .eq("professional_id", professionalId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .lt("start_time", end.toISOString())
      .gt("end_time", start.toISOString())
      .limit(1);

    if (pendingHold && pendingHold.length > 0) {
      return NextResponse.json(
        { error: "Esse horário está temporariamente reservado para pagamento." },
        { status: 409 }
      );
    }

    const blocked = await isScheduleBlocked({
      businessId,
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
      const googleBusy = await isGoogleCalendarBusy(
        businessId,
        start.toISOString(),
        end.toISOString(),
        professionalId
      );

      if (googleBusy) {
        return NextResponse.json(
          { error: "Esse horário está ocupado no Google Agenda." },
          { status: 409 }
        );
      }
    } catch (error) {
      console.error("Falha ao validar disponibilidade no Google Agenda", error);
    }

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        business_id: businessId,
        service_id: serviceId,
        professional_id: professionalId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "confirmed",
        whatsapp_opt_in: whatsappOptIn,
        whatsapp_consent_at: whatsappOptIn ? new Date().toISOString() : null,
      })
      .select("id,start_time,end_time")
      .single();

    if (error) throw error;

    try {
      const googleEventId = await createGoogleCalendarEvent({
        businessId,
        professionalId,
        summary: service.name + " - " + customerName,
        description:
          "Cliente: " +
          customerName +
          "\nWhatsApp: " +
          customerPhone +
          (customerEmail ? "\nE-mail: " + customerEmail : "") +
          "\nProfissional: " +
          professional.name,
        startTime: appointment.start_time,
        endTime: appointment.end_time,
        timeZone: business.timezone,
      });

      if (googleEventId) {
        const googleIntegrationId =
          await getEffectiveGoogleIntegrationId(
            businessId,
            professionalId
          );

        await supabase
          .from("appointments")
          .update({
            google_event_id: googleEventId,
            google_integration_id: googleIntegrationId,
          })
          .eq("id", appointment.id);
      }
    } catch (error) {
      console.error("Agendamento criado, mas evento Google falhou", error);
    }

    try {
      await notifyBookingConfirmed(appointment.id);
    } catch (error) {
      console.error("Agendamento criado, mas confirmação WhatsApp falhou", error);
    }

    return NextResponse.json({
      appointmentId: appointment.id,
      startTime: appointment.start_time,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Falha ao confirmar o agendamento." },
      { status: 500 }
    );
  }
}
