import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
import { businessHasActiveSubscription } from "@/lib/business-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const [{ data: business }, activeSubscription] = await Promise.all([
      supabase
        .from("businesses")
        .select(
          "id,name,slug,phone,deposit_enabled,deposit_percent,whatsapp_enabled,whatsapp_reminder_minutes,whatsapp_followup_enabled"
        )
        .eq("id", auth.business.id)
        .maybeSingle(),
      businessHasActiveSubscription(
        auth.business.id,
        auth.business.owner_id
      ),
    ]);

    if (!business) {
      return NextResponse.json(
        { error: "Negócio não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      role: auth.role,
      professionalId: auth.professionalId,
      business,
      subscriptionStatus: activeSubscription ? "authorized" : "inactive",
      permissions: {
        manageBusiness: ["owner", "admin"].includes(auth.role),
        manageBilling: auth.role === "owner",
        manageTeam: ["owner", "admin"].includes(auth.role),
        viewReports: ["owner", "admin"].includes(auth.role),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível carregar o contexto da conta." },
      { status: 500 }
    );
  }
}
