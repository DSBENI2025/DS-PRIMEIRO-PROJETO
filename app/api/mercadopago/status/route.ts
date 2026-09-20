import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness, roleAllowed } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (!roleAllowed(auth.role, ["owner", "admin"])) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data } = await supabase
      .from("mercadopago_integrations")
      .select("id,seller_user_id,expires_at,updated_at")
      .eq("business_id", auth.business.id)
      .maybeSingle();

    return NextResponse.json({
      connected: Boolean(data),
      integration: data || null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Falha ao consultar Mercado Pago." },
      { status: 500 }
    );
  }
}
