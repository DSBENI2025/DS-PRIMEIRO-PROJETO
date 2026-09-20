import { NextRequest, NextResponse } from "next/server";
import { syncBookingPayment } from "@/lib/booking-payment-sync";
import {
  getPreApprovalClient,
  WebhookSignatureValidator,
} from "@/lib/mercadopago";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  claimMercadoPagoWebhook,
  completeWebhookEvent,
  failWebhookEvent,
  type WebhookClaim,
} from "@/lib/webhook-audit";

export async function POST(req: NextRequest) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

  if (!secret) {
    console.error("MERCADO_PAGO_WEBHOOK_SECRET não configurado.");
    return NextResponse.json(
      { error: "Webhook temporariamente indisponível." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const url = new URL(req.url);

  const dataId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("data_id") ||
    String(body?.data?.id || "");

  const xSignature = req.headers.get("x-signature") || "";
  const xRequestId = req.headers.get("x-request-id") || "";

  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId,
      secret,
    });
  } catch (error) {
    console.error("Assinatura inválida do webhook Mercado Pago", error);
    return NextResponse.json(
      { error: "Webhook inválido." },
      { status: 401 }
    );
  }

  const topic = String(
    body.type ||
      url.searchParams.get("type") ||
      url.searchParams.get("topic") ||
      ""
  );

  let claim: WebhookClaim = {
    eventId: null,
    shouldProcess: true,
    duplicate: false,
  };

  try {
    claim = await claimMercadoPagoWebhook({
      topic,
      dataId,
      requestId: xRequestId,
      signature: xSignature,
      body,
    });

    if (!claim.shouldProcess) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
      });
    }
  } catch (error) {
    // Audit/idempotency must not prevent payment/subscription processing.
    console.error("Falha ao registrar auditoria do webhook", error);
  }

  try {
    let handled = false;

    if (topic === "subscription_preapproval" && dataId) {
      const preApproval = getPreApprovalClient();
      const subscription = await preApproval.get({ id: dataId });
      if (!subscription.id) {
        throw new Error("Mercado Pago retornou assinatura sem ID.");
      }

      const supabase = getSupabaseAdmin();

      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: subscription.status,
          next_billing_date: subscription.next_payment_date ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("provider_subscription_id", subscription.id);

      if (error) throw error;
      handled = true;
    }

    if (topic === "payment" && dataId) {
      await syncBookingPayment(dataId);
      handled = true;
    }

    try {
      await completeWebhookEvent(
        claim.eventId,
        handled ? "processed" : "ignored"
      );
    } catch (error) {
      console.error(
        "Webhook processado, mas atualização da auditoria falhou",
        error
      );
    }

    return NextResponse.json({
      ok: true,
      duplicate: claim.duplicate,
      handled,
    });
  } catch (error) {
    console.error("Falha ao processar webhook Mercado Pago", error);

    try {
      await failWebhookEvent(claim.eventId, error);
    } catch (auditError) {
      console.error(
        "Falha adicional ao registrar erro do webhook",
        auditError
      );
    }

    return NextResponse.json(
      { error: "Falha ao processar webhook." },
      { status: 500 }
    );
  }
}
