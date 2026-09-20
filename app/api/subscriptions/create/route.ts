import { NextRequest, NextResponse } from "next/server";
import { getPreApprovalClient } from "@/lib/mercadopago";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function bearerToken(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let email = typeof body.email === "string" ? body.email.trim() : "";
    let userId: string | null = null;
    let businessId: string | null = null;

    const supabase = getSupabaseAdmin();
    const token = bearerToken(req);

    if (token) {
      const { data } = await supabase.auth.getUser(token);

      if (data.user) {
        userId = data.user.id;
        email = data.user.email || email;

        const { data: business } = await supabase
          .from("businesses")
          .select("id")
          .eq("owner_id", userId)
          .limit(1)
          .maybeSingle();

        businessId = business?.id || null;
      }
    }

    if (!email) {
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

    const { error } = await supabase.from("subscriptions").insert({
      external_reference: externalReference,
      payer_email: email,
      user_id: userId,
      business_id: businessId,
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
