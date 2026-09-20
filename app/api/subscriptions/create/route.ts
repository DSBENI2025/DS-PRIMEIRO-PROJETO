import { NextRequest, NextResponse } from "next/server";
import { getPreApprovalClient } from "@/lib/mercadopago";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "E-mail obrigatório." }, { status: 400 });
    }

    const planId = process.env.MERCADO_PAGO_PLAN_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!planId || !appUrl) {
      throw new Error("Plano ou URL da aplicação não configurados.");
    }

    const externalReference = crypto.randomUUID();
    const preApproval = getPreApprovalClient();

    const subscription = await preApproval.create({
      body: {
        preapproval_plan_id: planId,
        payer_email: email,
        external_reference: externalReference,
        back_url: appUrl + "/assinatura/retorno",
      },
    });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("subscriptions").insert({
      external_reference: externalReference,
      payer_email: email,
      provider: "mercado_pago",
      provider_subscription_id: subscription.id,
      status: subscription.status ?? "pending",
      checkout_url: subscription.init_point,
    });

    if (error) throw error;

    return NextResponse.json({
      subscriptionId: subscription.id,
      checkoutUrl: subscription.init_point,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Falha ao iniciar assinatura." },
      { status: 500 }
    );
  }
}
