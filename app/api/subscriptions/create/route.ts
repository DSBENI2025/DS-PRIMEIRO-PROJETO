import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
import { getPreApprovalClient } from "@/lib/mercadopago";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (auth.role !== "owner") {
      return NextResponse.json(
        { error: "Somente o proprietário pode alterar a assinatura." },
        { status: 403 }
      );
    }

    const email = auth.user.email || "";

    if (!email) {
      return NextResponse.json(
        { error: "E-mail obrigatório." },
        { status: 400 }
      );
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
      user_id: auth.user.id,
      business_id: auth.business.id,
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
