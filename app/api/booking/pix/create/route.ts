import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { businessHasActiveSubscription } from "@/lib/business-access";
import {
  getEffectiveWorkingHours,
  isScheduleBlocked,
} from "@/lib/availability-server";
import { isGoogleCalendarBusy } from "@/lib/google-calendar";
import { getBusinessPaymentClient } from "@/lib/mercadopago-seller";
import { syncBookingPayment } from "@/lib/booking-payment-sync";
import { notifyPixPending } from "@/lib/notifications";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function toMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export async function POST(req: NextRequest) {
  let holdId: string | null = null;

  try {
    const body = await req.json();

    const businessId = String(body.businessId || "");
    const serviceId = String(body.serviceId || "");
    const professionalId = String(body.professionalId || "");
    const date = String(body.date || "");
    const time = String(body.time || "");
    const customerName = String(body.customerName || "").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const customerEmail = String(body.customerEmail || "").trim().toLowerCase();
    const customerCpf = String(body.customerCpf || "").replace(/\D/g, "");
    const whatsappOptIn = body.whatsappOptIn === true;

    if (
      !businessId ||
      !serviceId ||
      !professionalId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}$/.test(time) ||
      !customerName ||
      !customerPhone ||
      !customerEmail ||
      !/^\S+@\S+\.\S+$/.test(customerEmail) ||
      customerCpf.length !== 11
    ) {
      return NextResponse.json(
        { error: "Preencha os dados do agendamento, incluindo e-mail e CPF válidos." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: business } = await supabase
      .from("businesses")
      .select("id,owner_id,name,active,timezone,deposit_enabled,deposit_percent")
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

    if (!business.deposit_enabled) {
      return NextResponse.json(
        { error: "Este estabelecimento não exige sinal via Pix." },
        { status: 400 }
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

    if (service.price_cents <= 0) {
      return NextResponse.json(
        { error: "Este serviço não possui valor para gerar sinal Pix." },
        { status: 400 }
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

    const { data: hours } = await supabase
      .from("business_hours")
      .select("opens_at,closes_at,is_closed")
      .eq("business_id", businessId)
      .eq("weekday", weekday)
      .maybeSingle();

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
      console.error("Falha ao consultar Google Agenda antes do Pix", error);
    }

    const depositPercent = Number(business.deposit_percent || 50);
    const amountCents = Math.max(
      1,
      Math.ceil((service.price_cents * depositPercent) / 100)
    );
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const externalReference = "booking_" + randomUUID().replace(/-/g, "");

    const { data: createdHoldId, error: holdError } = await supabase.rpc(
      "create_booking_payment_hold",
      {
        p_business_id: businessId,
        p_service_id: serviceId,
        p_professional_id: professionalId,
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_customer_email: customerEmail,
        p_start_time: start.toISOString(),
        p_end_time: end.toISOString(),
        p_service_price_cents: service.price_cents,
        p_deposit_percent: depositPercent,
        p_amount_cents: amountCents,
        p_expires_at: expiresAt.toISOString(),
        p_external_reference: externalReference,
      }
    );

    if (holdError || !createdHoldId) {
      if (
        holdError?.message?.includes("slot_unavailable") ||
        holdError?.message?.includes("schedule_blocked")
      ) {
        return NextResponse.json(
          { error: "Esse horário acabou de ser reservado. Escolha outro." },
          { status: 409 }
        );
      }

      throw holdError || new Error("Não foi possível reservar o horário.");
    }

    holdId = String(createdHoldId);

    const paymentClient = await getBusinessPaymentClient(businessId);
    if (!paymentClient) {
      throw new Error("Mercado Pago do estabelecimento não conectado.");
    }

    const payment = await paymentClient.create({
      body: {
        transaction_amount: amountCents / 100,
        description:
          "Sinal " + service.name + " - " + business.name,
        payment_method_id: "pix",
        payer: {
          email: customerEmail,
          identification: {
            type: "CPF",
            number: customerCpf,
          },
        },
        external_reference: externalReference,
        date_of_expiration: expiresAt.toISOString(),
      },
      requestOptions: {
        idempotencyKey: holdId,
      },
    });

    if (!payment.id) {
      throw new Error("Mercado Pago não retornou o ID do pagamento.");
    }

    const transactionData = payment.point_of_interaction?.transaction_data;

    const { error: updateError } = await supabase
      .from("booking_payments")
      .update({
        provider_payment_id: String(payment.id),
        qr_code: transactionData?.qr_code || null,
        ticket_url: transactionData?.ticket_url || null,
        whatsapp_opt_in: whatsappOptIn,
        whatsapp_consent_at: whatsappOptIn ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", holdId);

    if (updateError) throw updateError;

    if (payment.status === "approved") {
      await syncBookingPayment(String(payment.id));
    } else {
      try {
        await notifyPixPending(holdId);
      } catch (error) {
        console.error("Pix criado, mas aviso WhatsApp falhou", error);
      }
    }

    return NextResponse.json({
      reservationId: holdId,
      paymentId: String(payment.id),
      amountCents,
      depositPercent,
      expiresAt: expiresAt.toISOString(),
      qrCode: transactionData?.qr_code || null,
      qrCodeBase64: transactionData?.qr_code_base64 || null,
      ticketUrl: transactionData?.ticket_url || null,
      status: payment.status || "pending",
    });
  } catch (error) {
    console.error(error);

    if (holdId) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase
          .from("booking_payments")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", holdId)
          .eq("status", "pending");
      } catch (cleanupError) {
        console.error("Falha ao liberar pré-reserva Pix", cleanupError);
      }
    }

    return NextResponse.json(
      { error: "Não foi possível gerar o Pix para este horário." },
      { status: 500 }
    );
  }
}
