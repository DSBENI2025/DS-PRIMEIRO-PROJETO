import { NextRequest, NextResponse } from "next/server";
import {
  getPreApprovalClient,
  WebhookSignatureValidator,
} from "@/lib/mercadopago";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

    if (!secret) {
      throw new Error("Webhook secret não configurado.");
    }

    const url = new URL(req.url);
    const dataId =
      url.searchParams.get("data.id") ||
      url.searchParams.get("data_id") ||
      "";

    const xSignature = req.headers.get("x-signature") || "";
    const xRequestId = req.headers.get("x-request-id") || "";

    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId,
      secret,
    });

    const body = await req.json().catch(() => ({}));
    const topic =
      body.type ||
      url.searchParams.get("type") ||
      url.searchParams.get("topic");

    if (topic === "subscription_preapproval" && dataId) {
      const preApproval = getPreApprovalClient();
      const subscription = await preApproval.get({ id: dataId });
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
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Webhook inválido." },
      { status: 401 }
    );
  }
}
