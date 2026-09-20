import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  isWhatsAppConfigured,
  normalizeWhatsAppPhone,
  sendWhatsAppTemplate,
} from "@/lib/whatsapp";

type NotificationType =
  | "pix_pending"
  | "booking_confirmed"
  | "reminder"
  | "followup";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    dateStyle: "short",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function claimNotification(args: {
  businessId: string;
  appointmentId?: string | null;
  bookingPaymentId?: string | null;
  type: NotificationType;
  recipient: string;
}) {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("notification_logs")
    .select("id,status")
    .eq("notification_type", args.type);

  if (args.appointmentId) {
    query = query.eq("appointment_id", args.appointmentId);
  } else if (args.bookingPaymentId) {
    query = query.eq("booking_payment_id", args.bookingPaymentId);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing?.status === "sent" || existing?.status === "processing") {
    return null;
  }

  if (existing) {
    const { data, error } = await supabase
      .from("notification_logs")
      .update({
        status: "processing",
        error_message: null,
        recipient: args.recipient,
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) throw error;
    return data.id as string;
  }

  const { data, error } = await supabase
    .from("notification_logs")
    .insert({
      business_id: args.businessId,
      appointment_id: args.appointmentId || null,
      booking_payment_id: args.bookingPaymentId || null,
      channel: "whatsapp",
      notification_type: args.type,
      recipient: args.recipient,
      status: "processing",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }

  return data.id as string;
}

async function finalizeLog(
  logId: string,
  status: "sent" | "failed" | "skipped",
  providerMessageId?: string | null,
  errorMessage?: string | null
) {
  const supabase = getSupabaseAdmin();

  await supabase
    .from("notification_logs")
    .update({
      status,
      provider_message_id: providerMessageId || null,
      error_message: errorMessage || null,
    })
    .eq("id", logId);
}

async function sendOnce(args: {
  businessId: string;
  appointmentId?: string | null;
  bookingPaymentId?: string | null;
  type: NotificationType;
  phone: string;
  templateName?: string;
  parameters: string[];
  enabled: boolean;
  optedIn: boolean;
}) {
  const normalized = normalizeWhatsAppPhone(args.phone);

  if (
    !args.enabled ||
    !args.optedIn ||
    !normalized ||
    !args.templateName ||
    !isWhatsAppConfigured()
  ) {
    return { sent: false, skipped: true };
  }

  const logId = await claimNotification({
    businessId: args.businessId,
    appointmentId: args.appointmentId,
    bookingPaymentId: args.bookingPaymentId,
    type: args.type,
    recipient: normalized,
  });

  if (!logId) {
    return { sent: false, skipped: true };
  }

  try {
    const result = await sendWhatsAppTemplate({
      to: normalized,
      templateName: args.templateName,
      bodyParameters: args.parameters,
    });

    await finalizeLog(logId, "sent", result.messageId);
    return { sent: true, messageId: result.messageId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha no WhatsApp.";
    await finalizeLog(logId, "failed", null, message);
    throw error;
  }
}

export async function notifyPixPending(bookingPaymentId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("booking_payments")
    .select(
      "id,business_id,customer_name,customer_phone,whatsapp_opt_in,amount_cents,expires_at,services(name),businesses(name,whatsapp_enabled)"
    )
    .eq("id", bookingPaymentId)
    .single();

  if (error) throw error;

  const service = Array.isArray(data.services)
    ? data.services[0]
    : data.services;
  const business = Array.isArray(data.businesses)
    ? data.businesses[0]
    : data.businesses;

  return sendOnce({
    businessId: data.business_id,
    bookingPaymentId: data.id,
    type: "pix_pending",
    phone: data.customer_phone,
    templateName: process.env.WHATSAPP_TEMPLATE_PIX_PENDING,
    enabled: Boolean(business?.whatsapp_enabled),
    optedIn: Boolean(data.whatsapp_opt_in),
    parameters: [
      data.customer_name,
      business?.name || "Estabelecimento",
      service?.name || "Serviço",
      brl(Number(data.amount_cents || 0)),
      formatTime(data.expires_at),
    ],
  });
}

export async function notifyBookingConfirmed(appointmentId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id,business_id,customer_name,customer_phone,whatsapp_opt_in,start_time,services(name),professionals(name),businesses(name,whatsapp_enabled)"
    )
    .eq("id", appointmentId)
    .single();

  if (error) throw error;

  const service = Array.isArray(data.services)
    ? data.services[0]
    : data.services;
  const professional = Array.isArray(data.professionals)
    ? data.professionals[0]
    : data.professionals;
  const business = Array.isArray(data.businesses)
    ? data.businesses[0]
    : data.businesses;

  return sendOnce({
    businessId: data.business_id,
    appointmentId: data.id,
    type: "booking_confirmed",
    phone: data.customer_phone,
    templateName: process.env.WHATSAPP_TEMPLATE_BOOKING_CONFIRMED,
    enabled: Boolean(business?.whatsapp_enabled),
    optedIn: Boolean(data.whatsapp_opt_in),
    parameters: [
      data.customer_name,
      business?.name || "Estabelecimento",
      service?.name || "Serviço",
      formatDate(data.start_time),
      formatTime(data.start_time),
      professional?.name || "Profissional",
    ],
  });
}

export async function notifyReminder(appointmentId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id,business_id,customer_name,customer_phone,whatsapp_opt_in,start_time,services(name),professionals(name),businesses(name,whatsapp_enabled)"
    )
    .eq("id", appointmentId)
    .single();

  if (error) throw error;

  const service = Array.isArray(data.services)
    ? data.services[0]
    : data.services;
  const professional = Array.isArray(data.professionals)
    ? data.professionals[0]
    : data.professionals;
  const business = Array.isArray(data.businesses)
    ? data.businesses[0]
    : data.businesses;

  return sendOnce({
    businessId: data.business_id,
    appointmentId: data.id,
    type: "reminder",
    phone: data.customer_phone,
    templateName: process.env.WHATSAPP_TEMPLATE_REMINDER,
    enabled: Boolean(business?.whatsapp_enabled),
    optedIn: Boolean(data.whatsapp_opt_in),
    parameters: [
      data.customer_name,
      business?.name || "Estabelecimento",
      service?.name || "Serviço",
      formatDate(data.start_time),
      formatTime(data.start_time),
      professional?.name || "Profissional",
    ],
  });
}

export async function notifyFollowup(appointmentId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id,business_id,customer_name,customer_phone,whatsapp_opt_in,services(name),businesses(name,whatsapp_enabled,whatsapp_followup_enabled)"
    )
    .eq("id", appointmentId)
    .single();

  if (error) throw error;

  const service = Array.isArray(data.services)
    ? data.services[0]
    : data.services;
  const business = Array.isArray(data.businesses)
    ? data.businesses[0]
    : data.businesses;

  return sendOnce({
    businessId: data.business_id,
    appointmentId: data.id,
    type: "followup",
    phone: data.customer_phone,
    templateName: process.env.WHATSAPP_TEMPLATE_FOLLOWUP,
    enabled:
      Boolean(business?.whatsapp_enabled) &&
      Boolean(business?.whatsapp_followup_enabled),
    optedIn: Boolean(data.whatsapp_opt_in),
    parameters: [
      data.customer_name,
      business?.name || "Estabelecimento",
      service?.name || "Serviço",
    ],
  });
}
