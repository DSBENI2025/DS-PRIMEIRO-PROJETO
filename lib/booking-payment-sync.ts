import { randomUUID } from "crypto";
import { createGoogleCalendarEvent } from "@/lib/google-calendar";
import { getPaymentClient } from "@/lib/mercadopago";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type PaymentStatus =
  | "pending"
  | "approved"
  | "cancelled"
  | "rejected"
  | "refunded";

function localStatus(providerStatus: string | null | undefined): PaymentStatus {
  if (providerStatus === "approved") return "approved";
  if (providerStatus === "cancelled") return "cancelled";
  if (providerStatus === "rejected") return "rejected";
  if (providerStatus === "refunded" || providerStatus === "charged_back") {
    return "refunded";
  }
  return "pending";
}

export async function syncBookingPayment(paymentId: string) {
  const paymentClient = getPaymentClient();
  const payment = await paymentClient.get({ id: paymentId });

  if (!payment.id) {
    throw new Error("Pagamento Mercado Pago sem ID.");
  }

  const providerPaymentId = String(payment.id);
  const status = localStatus(payment.status);
  const supabase = getSupabaseAdmin();

  const { data: bookingPayment } = await supabase
    .from("booking_payments")
    .select("id,status,appointment_id")
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();

  if (!bookingPayment) {
    return { handled: false, status };
  }

  if (status !== "approved") {
    const { error } = await supabase
      .from("booking_payments")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingPayment.id)
      .neq("status", "approved");

    if (error) throw error;

    return { handled: true, status };
  }

  const paidAt =
    payment.date_approved ||
    payment.date_last_updated ||
    new Date().toISOString();

  const { data: appointmentId, error: finalizeError } = await supabase.rpc(
    "finalize_booking_payment",
    {
      p_provider_payment_id: providerPaymentId,
      p_paid_at: paidAt,
    }
  );

  if (finalizeError) {
    console.error("Falha ao finalizar agendamento pago", finalizeError);
    return { handled: true, status: "conflict" as const };
  }

  if (!appointmentId) {
    return { handled: true, status: "approved" as const };
  }

  const marker = "syncing:" + randomUUID();

  const { data: claimed } = await supabase
    .from("appointments")
    .update({ google_event_id: marker })
    .eq("id", appointmentId)
    .is("google_event_id", null)
    .select("id")
    .maybeSingle();

  if (!claimed) {
    return {
      handled: true,
      status: "approved" as const,
      appointmentId,
    };
  }

  try {
    const { data: appointment, error } = await supabase
      .from("appointments")
      .select(
        "id,business_id,customer_name,customer_phone,customer_email,start_time,end_time,services(name),professionals(name),businesses(name,timezone)"
      )
      .eq("id", appointmentId)
      .single();

    if (error) throw error;

    const service = Array.isArray(appointment.services)
      ? appointment.services[0]
      : appointment.services;
    const professional = Array.isArray(appointment.professionals)
      ? appointment.professionals[0]
      : appointment.professionals;
    const business = Array.isArray(appointment.businesses)
      ? appointment.businesses[0]
      : appointment.businesses;

    const googleEventId = await createGoogleCalendarEvent({
      businessId: appointment.business_id,
      summary:
        (service?.name || "Agendamento") +
        " - " +
        appointment.customer_name,
      description:
        "Cliente: " +
        appointment.customer_name +
        "\nWhatsApp: " +
        appointment.customer_phone +
        (appointment.customer_email
          ? "\nE-mail: " + appointment.customer_email
          : "") +
        "\nProfissional: " +
        (professional?.name || "Não informado"),
      startTime: appointment.start_time,
      endTime: appointment.end_time,
      timeZone: business?.timezone || "America/Recife",
    });

    await supabase
      .from("appointments")
      .update({ google_event_id: googleEventId })
      .eq("id", appointmentId)
      .eq("google_event_id", marker);
  } catch (error) {
    console.error("Agendamento pago confirmado, mas sincronização Google falhou", error);

    await supabase
      .from("appointments")
      .update({ google_event_id: null })
      .eq("id", appointmentId)
      .eq("google_event_id", marker);
  }

  return {
    handled: true,
    status: "approved" as const,
    appointmentId,
  };
}
