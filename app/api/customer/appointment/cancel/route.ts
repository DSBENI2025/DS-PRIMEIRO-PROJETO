import { NextRequest, NextResponse } from "next/server";
import { getAppointmentAccessByToken } from "@/lib/customer-appointment-access";
import { recordAppointmentEvent } from "@/lib/appointment-history";
import { deleteGoogleCalendarEvent } from "@/lib/google-calendar";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { consumeRateLimit, rateLimitExceeded } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rateLimit = await consumeRateLimit(req, "customer_cancel", 10, 600);

    if (!rateLimit.allowed) {
      return rateLimitExceeded(rateLimit);
    }

    const body = await req.json();
    const token = String(body.token || "");
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
        "id,business_id,professional_id,start_time,status,booking_payment_id,google_event_id,google_integration_id"
      )
      .eq("id", access.appointment_id)
      .maybeSingle();

    if (!appointment) {
      return NextResponse.json(
        { error: "Agendamento não encontrado." },
        { status: 404 }
      );
    }

    if (appointment.status === "cancelled") {
      return NextResponse.json({ cancelled: true });
    }

    if (
      appointment.status !== "confirmed" ||
      new Date(appointment.start_time).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "Este agendamento não pode mais ser cancelado por este link." },
        { status: 409 }
      );
    }

    let paidSignal = false;

    if (appointment.booking_payment_id) {
      const { data: payment } = await supabase
        .from("booking_payments")
        .select("status")
        .eq("id", appointment.booking_payment_id)
        .maybeSingle();

      paidSignal = payment?.status === "approved";
    }

    if (appointment.google_event_id) {
      try {
        await deleteGoogleCalendarEvent(
          appointment.business_id,
          appointment.google_event_id,
          appointment.professional_id,
          appointment.google_integration_id
        );
      } catch (error) {
        console.error(
          "Cancelamento confirmado, mas remoção no Google falhou",
          error
        );
      }
    }

    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointment.id)
      .eq("status", "confirmed");

    if (error) throw error;

    try {
      await recordAppointmentEvent({
        appointmentId: appointment.id,
        businessId: appointment.business_id,
        eventType: "cancelled",
        actorType: "customer",
        metadata: {
          previousStatus: appointment.status,
          professionalId: appointment.professional_id,
          paidSignal,
        },
      });
    } catch (error) {
      console.error("Cancelamento do cliente salvo, mas auditoria falhou", error);
    }

    return NextResponse.json({
      cancelled: true,
      paidSignal,
      refundAutomatic: false,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível cancelar o agendamento." },
      { status: 500 }
    );
  }
}
